"use client"
import * as React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { RoleGuard } from "@/components/role-guard"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRouter } from "next/navigation"
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  Users,
  Plus,
  Eye,
  Filter
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useUser } from "@/contexts/user-context"
import { toast } from "sonner"

// Types
type RawAppointment = {
  id?: string
  calendar_id?: string
  contact_id?: string
  title?: string
  status?: string
  appointment_status?: string
  assigned_user_id?: string
  address?: string
  is_recurring?: boolean
  trace_id?: string
  startTime?: string
  endTime?: string
}

type Appointment = {
  id: string
  calendar_id: string
  contact_id: string
  title: string
  status: string
  appointment_status: string
  assigned_user_id: string
  address: string
  is_recurring: boolean
  trace_id: string
  groupId?: string
  serviceName?: string
  startTime?: string
  endTime?: string
  assignedStaffFirstName?: string
  assignedStaffLastName?: string
  contactName?: string
  contactPhone?: string
}

type StaffMember = {
  id: string
  ghl_id: string
  firstName: string
  lastName: string
  email: string
  role: string
  name: string
  appointments: Appointment[]
}

type TimeSlot = {
  time: string
  hour: number
  minute: number
  label: string
}

// Time slots from 7 AM to 10 PM in 30-minute intervals
const generateTimeSlots = (): TimeSlot[] => {
  const slots: TimeSlot[] = []
  for (let hour = 7; hour <= 22; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const time24 = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      const time12 = new Date(`2000-01-01T${time24}:00`).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
      slots.push({
        time: time24,
        hour,
        minute,
        label: time12
      })
    }
  }
  return slots
}

const TIME_SLOTS = generateTimeSlots()

// Custom hooks
function useStaffAndAppointments(selectedDate: Date) {
  const [staff, setStaff] = React.useState<StaffMember[]>([])
  const [loading, setLoading] = React.useState<boolean>(true)
  const [appointments, setAppointments] = React.useState<Appointment[]>([])

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    try {
      // Fetch staff members from local API
      const staffRes = await fetch('/api/getUsers')
      if (!staffRes.ok) throw new Error("Failed to fetch staff")
      const staffJson = await staffRes.json()
      const users = staffJson.users || []

      // Filter for barbers and staff with ghl_id
      const staffMembers = users
        .filter((user: any) => user.user_metadata?.role === 'barber' && user.user_metadata?.ghl_id)
        .map((user: any) => ({
          id: user.id,
          ghl_id: user.user_metadata.ghl_id,
          firstName: user.user_metadata.firstName || '',
          lastName: user.user_metadata.lastName || '',
          email: user.email || '',
          role: user.user_metadata.role || 'barber',
          name: `${user.user_metadata.firstName || ''} ${user.user_metadata.lastName || ''}`.trim() || user.email,
          appointments: []
        }))

      // Fetch all appointments using the same pattern as the appointments page
      const res = await fetch("https://restyle-backend.netlify.app/.netlify/functions/getAllBookings")
      if (!res.ok) throw new Error("Failed to fetch appointments")
      const json = await res.json()
      const bookings: RawAppointment[] = json.bookings || []
      
      // Process appointments in batches for better performance
      const batchSize = 10
      const enrichedBookings: Appointment[] = []
      
      for (let i = 0; i < Math.min(bookings.length, 200); i += batchSize) {
        const batch = bookings.slice(i, i + batchSize)
        const batchResults = await Promise.all(batch.map(async (booking: RawAppointment) => {
          const details: Appointment = {
            id: String(booking.id || ""),
            calendar_id: String(booking.calendar_id || ""),
            contact_id: String(booking.contact_id || ""),
            title: booking.title || "",
            status: booking.status || "",
            appointment_status: booking.appointment_status || "",
            assigned_user_id: String(booking.assigned_user_id || ""),
            address: booking.address || "",
            is_recurring: booking.is_recurring || false,
            trace_id: booking.trace_id || "",
            serviceName: booking.title || 'Untitled Service',
          }

          // Fetch appointment details for times
          if (booking.id) {
            try {
              const apptRes = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/getBooking?id=${booking.id}`)
              if (apptRes.ok) {
                const apptData = await apptRes.json()
                if (apptData.appointment) {
                  details.startTime = apptData.appointment.startTime
                  details.endTime = apptData.appointment.endTime
                  details.appointment_status = apptData.appointment.appointmentStatus || details.appointment_status
                  details.assigned_user_id = apptData.appointment.assignedUserId || details.assigned_user_id
                  details.groupId = apptData.appointment.groupId || apptData.appointment.group_id
                }
              }
            } catch (error) {
              console.warn(`Failed to fetch booking details for ${booking.id}:`, error)
            }
          }

          // Fetch staff details
          if (details.assigned_user_id) {
            try {
              const staffRes = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/Staff?id=${details.assigned_user_id}`)
              if (staffRes.ok) {
                const staffData = await staffRes.json()
                if (staffData.firstName) {
                  details.assignedStaffFirstName = staffData.firstName
                  details.assignedStaffLastName = staffData.lastName
                }
              }
            } catch (error) {
              console.warn(`Failed to fetch staff details for ${details.assigned_user_id}:`, error)
            }
          }

          // Fetch contact details
          if (booking.contact_id) {
            try {
              const contactRes = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/getContact?id=${booking.contact_id}`)
              if (contactRes.ok) {
                const contactData = await contactRes.json()
                if (contactData.contact) {
                  details.contactName = `${contactData.contact.firstName || ""} ${contactData.contact.lastName || ""}`.trim()
                  details.contactPhone = contactData.contact.phone
                }
              }
            } catch (error) {
              console.warn(`Failed to fetch contact details for ${booking.contact_id}:`, error)
            }
          }

          return details
        }))
        
        enrichedBookings.push(...batchResults)
      }

      // Filter appointments for the selected date
      const dateStr = selectedDate.toDateString()
      const dayAppointments = enrichedBookings.filter(apt => 
        apt.startTime && new Date(apt.startTime).toDateString() === dateStr
      )

      // Group appointments by staff member
      const staffWithAppointments = staffMembers.map((staffMember: any) => ({
        ...staffMember,
        appointments: dayAppointments.filter(apt => 
          apt.assigned_user_id === staffMember.ghl_id
        ).sort((a, b) => 
          new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime()
        )
      }))

      setStaff(staffWithAppointments)
      setAppointments(dayAppointments)
    } catch (error) {
      console.error("Failed to fetch data:", error)
      toast.error("Failed to load calendar data")
      setStaff([])
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  return { staff, appointments, loading, refetch: fetchData }
}

// Utility functions
function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

function getAppointmentStyle(appointment: Appointment) {
  if (!appointment.startTime || !appointment.endTime) {
    return { top: 0, height: 60 } // Default 1-hour block
  }

  const start = new Date(appointment.startTime)
  const end = new Date(appointment.endTime)
  
  // Calculate position based on time slots (7 AM = 0)
  const startMinutes = (start.getHours() - 7) * 60 + start.getMinutes()
  const duration = (end.getTime() - start.getTime()) / (1000 * 60) // duration in minutes
  
  // Each 30-minute slot is approximately 60px high
  const pixelsPerMinute = 2
  const top = startMinutes * pixelsPerMinute
  const height = Math.max(duration * pixelsPerMinute, 30) // Minimum 30px height
  
  return { top, height }
}

function getStatusColor(status: string) {
  switch (status?.toLowerCase()) {
    case 'confirmed':
      return 'bg-green-100 border-green-300 text-green-800'
    case 'cancelled':
      return 'bg-red-100 border-red-300 text-red-800'
    case 'pending':
      return 'bg-yellow-100 border-yellow-300 text-yellow-800'
    default:
      return 'bg-blue-100 border-blue-300 text-blue-800'
  }
}

export default function AdminCalendarPage() {
  const router = useRouter()
  const { user } = useUser()
  const [selectedDate, setSelectedDate] = React.useState(new Date())
  const [selectedStaffFilter, setSelectedStaffFilter] = React.useState<string>("all")
  const { staff, appointments, loading, refetch } = useStaffAndAppointments(selectedDate)

  // Filter staff based on selection
  const filteredStaff = React.useMemo(() => {
    if (selectedStaffFilter === "all") return staff
    return staff.filter((s: any) => s.ghl_id === selectedStaffFilter)
  }, [staff, selectedStaffFilter])

  // Navigation functions
  const navigatePrevious = () => {
    const newDate = new Date(selectedDate)
    newDate.setDate(selectedDate.getDate() - 1)
    setSelectedDate(newDate)
  }

  const navigateNext = () => {
    const newDate = new Date(selectedDate)
    newDate.setDate(selectedDate.getDate() + 1)
    setSelectedDate(newDate)
  }

  const goToToday = () => {
    setSelectedDate(new Date())
  }

  const openAppointmentDetails = (appointment: Appointment) => {
    router.push(`/appointments?view=details&id=${encodeURIComponent(appointment.id)}`)
  }

  const totalAppointments = filteredStaff.reduce((sum: number, s: any) => sum + s.appointments.length, 0)

  return (
    <RoleGuard requiredRole="admin">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex items-center justify-between w-full px-4">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4" />
                <h1 className="text-xl font-semibold">Staff Calendar</h1>
                <Badge variant="secondary" className="ml-2">
                  <Users className="h-3 w-3 mr-1" />
                  Admin View
                </Badge>
              </div>
              <Button onClick={() => router.push('/appointments?view=new')} className="bg-primary text-primary-foreground">
                <Plus className="h-4 w-4 mr-2" />
                New Appointment
              </Button>
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            {/* Calendar Controls */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={navigatePrevious}
                        className="h-9 w-9"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={navigateNext}
                        className="h-9 w-9"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-2xl font-bold">{formatDate(selectedDate)}</h2>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={goToToday}
                        className="text-xs"
                      >
                        Today
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {/* Staff Filter */}
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-muted-foreground" />
                      <Select value={selectedStaffFilter} onValueChange={setSelectedStaffFilter}>
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Staff ({staff.length})</SelectItem>
                          {staff.map(staffMember => (
                            <SelectItem key={staffMember.ghl_id} value={staffMember.ghl_id}>
                              {staffMember.name} ({staffMember.appointments.length})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Stats */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {filteredStaff.length} Staff
                      </div>
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="h-4 w-4" />
                        {totalAppointments} Appointments
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Calendar Grid */}
            {loading ? (
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-96 w-full" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="flex">
                    {/* Time Column */}
                    <div className="w-20 border-r bg-gray-50/50">
                      <div className="h-16 border-b flex items-center justify-center text-sm font-medium text-muted-foreground">
                        Time
                      </div>
                      <div className="relative">
                        {TIME_SLOTS.filter(slot => slot.minute === 0).map((slot) => (
                          <div 
                            key={slot.time}
                            className="h-[120px] border-b border-gray-200 flex items-start justify-center pt-2"
                          >
                            <span className="text-xs text-muted-foreground font-medium">
                              {slot.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Staff Columns */}
                    <div className="flex-1 overflow-x-auto">
                      <div className="flex min-w-max">
                        {filteredStaff.map((staffMember) => (
                          <div key={staffMember.ghl_id} className="min-w-[280px] border-r">
                            {/* Staff Header */}
                            <div className="h-16 border-b bg-gray-50/50 p-4 flex items-center justify-between">
                              <div>
                                <div className="font-medium">{staffMember.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {staffMember.appointments.length} appointments
                                </div>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                <User className="h-3 w-3 mr-1" />
                                {staffMember.role}
                              </Badge>
                            </div>

                            {/* Appointments Column */}
                            <div className="relative">
                              {/* Time Grid Background */}
                              {TIME_SLOTS.filter(slot => slot.minute === 0).map((slot) => (
                                <div 
                                  key={slot.time}
                                  className="h-[120px] border-b border-gray-100"
                                />
                              ))}

                              {/* Half-hour Grid Lines */}
                              {TIME_SLOTS.filter(slot => slot.minute === 30).map((slot) => (
                                <div 
                                  key={slot.time}
                                  className="absolute w-full border-b border-gray-50"
                                  style={{ top: ((slot.hour - 7) * 120) + 60 }}
                                />
                              ))}

                              {/* Appointments */}
                              {staffMember.appointments.map((appointment) => {
                                const style = getAppointmentStyle(appointment)
                                return (
                                  <div
                                    key={appointment.id}
                                    onClick={() => openAppointmentDetails(appointment)}
                                    className={cn(
                                      "absolute left-1 right-1 rounded-lg border-l-4 p-2 cursor-pointer hover:shadow-md transition-all text-xs overflow-hidden",
                                      getStatusColor(appointment.appointment_status)
                                    )}
                                    style={{
                                      top: `${style.top}px`,
                                      height: `${style.height}px`,
                                      zIndex: 10
                                    }}
                                    title={`${appointment.serviceName} - ${appointment.contactName}`}
                                  >
                                    <div className="font-medium truncate">{appointment.serviceName}</div>
                                    <div className="truncate opacity-75">{appointment.contactName}</div>
                                    {appointment.startTime && (
                                      <div className="flex items-center gap-1 mt-1 opacity-75">
                                        <Clock className="h-3 w-3" />
                                        {formatTime(appointment.startTime)}
                                        {appointment.endTime && (
                                          <>-{formatTime(appointment.endTime)}</>
                                        )}
                                      </div>
                                    )}
                                    <div className="mt-1">
                                      <Badge 
                                        size="sm" 
                                        variant="secondary"
                                        className="text-xs opacity-75"
                                      >
                                        {appointment.appointment_status}
                                      </Badge>
                                    </div>
                                  </div>
                                )
                              })}

                              {/* Empty State */}
                              {staffMember.appointments.length === 0 && (
                                <div className="absolute inset-0 flex items-center justify-center text-center text-muted-foreground">
                                  <div>
                                    <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No appointments</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}

                        {/* Empty State for No Staff */}
                        {filteredStaff.length === 0 && (
                          <div className="flex-1 flex items-center justify-center py-12">
                            <div className="text-center text-muted-foreground">
                              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                              <p className="text-lg font-medium">No staff members found</p>
                              <p className="text-sm">Staff members need to have the 'barber' role and a GHL ID to appear in the calendar.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Stats */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{staff.length}</div>
                  <p className="text-xs text-muted-foreground">Active staff members</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Appointments</CardTitle>
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalAppointments}</div>
                  <p className="text-xs text-muted-foreground">For {formatDate(selectedDate)}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Confirmed</CardTitle>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {appointments.filter(apt => apt.appointment_status?.toLowerCase() === 'confirmed').length}
                  </div>
                  <p className="text-xs text-muted-foreground">Confirmed bookings</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {appointments.filter(apt => apt.appointment_status?.toLowerCase() === 'cancelled').length}
                  </div>
                  <p className="text-xs text-muted-foreground">Cancelled bookings</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </RoleGuard>
  )
}
