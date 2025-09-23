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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { useRouter } from "next/navigation"
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  MapPin,
  Plus,
  Eye,
  Edit,
  Trash2
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
  notes?: string
  customValues?: Record<string, unknown>
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

type CalendarView = 'day' | 'month' | 'year'

type CalendarDay = {
  date: Date
  isCurrentMonth: boolean
  isToday: boolean
  appointments: Appointment[]
  dayNumber: number
}

// Custom hooks
function useAppointments() {
  const [data, setData] = React.useState<Appointment[]>([])
  const [loading, setLoading] = React.useState<boolean>(true)

  React.useEffect(() => {
    const fetchAppointments = async () => {
      setLoading(true)
      try {
        const res = await fetch("https://restyle-backend.netlify.app/.netlify/functions/getAllBookings")
        if (!res.ok) throw new Error("Failed to fetch appointments")
        const json = await res.json()
        const bookings = json?.bookings || []
        
        // Process appointments with enrichment for contact and staff
        const enrichedBookings = await Promise.all(
          bookings.slice(0, 100).map(async (booking: RawAppointment) => {
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

            // Fetch appointment details for time
            try {
              const apptRes = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/getBooking?id=${booking.id}`)
              if (apptRes.ok) {
                const apptData = await apptRes.json()
                if (apptData.appointment) {
                  details.startTime = apptData.appointment.startTime
                  details.endTime = apptData.appointment.endTime
                  details.appointment_status = apptData.appointment.appointmentStatus || details.appointment_status
                }
              }
            } catch {
              console.warn(`Failed to fetch details for booking ${booking.id}`)
            }

            // Contact details
            if (booking.contact_id) {
              try {
                const contactRes = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/getcontact?id=${booking.contact_id}`)
                if (contactRes.ok) {
                  const contactData = await contactRes.json()
                  const c = contactData.contact || contactData.data || contactData
                  if (c) {
                    details.contactName = c.contactName || c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim()
                    details.contactPhone = c.phone || null
                  }
                }
              } catch {}
            }

            // Staff details
            if (booking.assigned_user_id) {
              try {
                const staffRes = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/Staff?id=${booking.assigned_user_id}`)
                if (staffRes.ok) {
                  const staffData = await staffRes.json()
                  details.assignedStaffFirstName = staffData.firstName
                  details.assignedStaffLastName = staffData.lastName
                }
              } catch {}
            }

            return details
          })
        )
        
        setData(enrichedBookings.filter(apt => apt.startTime)) // Only include appointments with time
      } catch (error) {
        console.error("Failed to fetch appointments:", error)
        toast.error("Failed to load appointments")
      } finally {
        setLoading(false)
      }
    }

    fetchAppointments()
  }, [])

  return { data, loading }
}

// Utility functions
function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: '2-digit',
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

// Staff Overview Component - Acuity-style time grid calendar
const StaffOverviewView = ({ appointments }: { appointments: Appointment[] }) => {
  const [staff, setStaff] = React.useState<{
    id: string;
    ghl_id: string;
    name: string;
    email: string;
    role: string;
  }[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchStaff = async () => {
      try {
        const staffRes = await fetch('/api/barber-hours')
        const staffJson = await staffRes.json()
        
        if (staffJson.ok) {
          const staffData = staffJson.data || []
          const staffMembers = staffData.map((barber: {
            "🔒 Row ID"?: string;
            "ð Row ID"?: string;
            "Barber/Name": string;
            "ghl_id": string;
            "Barber/Email": string;
            [key: string]: string | number | boolean | null | undefined;
          }) => ({
            id: barber["🔒 Row ID"] || barber["ð Row ID"] || barber.ghl_id,
            ghl_id: barber.ghl_id,
            name: barber["Barber/Name"],
            email: barber["Barber/Email"],
            role: 'barber'
          }))
          
          setStaff(staffMembers)
        }
      } catch (error) {
        console.error('Failed to fetch staff:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStaff()
  }, [])

  // Generate time slots from 8 AM to 8 PM (12 hours)
  const generateTimeSlots = () => {
    const slots = []
    for (let hour = 8; hour < 20; hour++) {
      slots.push(`${hour}:00`)
      slots.push(`${hour}:30`)
    }
    return slots
  }

  const timeSlots = generateTimeSlots()

  // Helper function to get appointment position and height
  const getAppointmentStyle = (appointment: Appointment) => {
    if (!appointment.startTime || !appointment.endTime) return { display: 'none' }
    
    const start = new Date(appointment.startTime)
    const end = new Date(appointment.endTime)
    
    const startHour = start.getHours()
    const startMinute = start.getMinutes()
    const endHour = end.getHours()
    const endMinute = end.getMinutes()
    
    // Calculate position from 8 AM (480 minutes)
    const dayStartMinutes = 8 * 60 // 8 AM in minutes
    const startMinutes = startHour * 60 + startMinute
    const endMinutes = endHour * 60 + endMinute
    
    const topOffset = ((startMinutes - dayStartMinutes) / 30) * 40 // 40px per 30min slot
    const height = ((endMinutes - startMinutes) / 30) * 40
    
    return {
      position: 'absolute' as const,
      top: `${Math.max(0, topOffset)}px`,
      height: `${Math.max(20, height - 2)}px`,
      left: '2px',
      right: '2px',
      zIndex: 10
    }
  }

  // Get appointments for a specific staff member
  const getStaffAppointments = (staffGhlId: string) => {
    return appointments.filter(apt => apt.assigned_user_id === staffGhlId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading staff calendar...</p>
        </div>
      </div>
    )
  }

  if (staff.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <h3 className="font-medium mb-2">No Staff Members Found</h3>
        <p className="text-sm">Staff members with the &apos;barber&apos; role will appear here.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      {/* Header with staff names */}
      <div className="grid border-b bg-gray-50" style={{ gridTemplateColumns: '80px ' + 'repeat(' + staff.length + ', 1fr)' }}>
        <div className="p-3 border-r font-medium text-sm text-center bg-gray-100">
          Time
        </div>
        {staff.map((staffMember) => (
          <div key={staffMember.ghl_id} className="p-3 border-r last:border-r-0 text-center">
            <div className="font-medium text-sm truncate" title={staffMember.name}>
              {staffMember.name}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {getStaffAppointments(staffMember.ghl_id).length} appointments
            </div>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div className="relative" style={{ height: '960px' }}> {/* 24 slots * 40px = 960px */}
        {/* Time labels and grid lines */}
        <div className="absolute inset-0 grid border-r" style={{ gridTemplateColumns: '80px ' + 'repeat(' + staff.length + ', 1fr)' }}>
          <div className="relative">
            {timeSlots.map((time, index) => (
              <div
                key={time}
                className="absolute left-0 right-0 border-b text-xs text-gray-500 bg-gray-50 px-2 flex items-center justify-center"
                style={{ 
                  top: `${index * 40}px`, 
                  height: '40px',
                  borderBottomColor: time.endsWith(':00') ? '#e5e7eb' : '#f3f4f6'
                }}
              >
                {time.endsWith(':00') && (
                  <span className="font-medium">
                    {parseInt(time) > 12 ? `${parseInt(time) - 12}:00 PM` : `${time} AM`}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Staff columns */}
          {staff.map((staffMember) => (
            <div key={staffMember.ghl_id} className="relative border-r last:border-r-0">
              {/* Grid lines for this staff column */}
              {timeSlots.map((time, index) => (
                <div
                  key={time}
                  className="absolute left-0 right-0 border-b"
                  style={{ 
                    top: `${index * 40}px`, 
                    height: '40px',
                    borderBottomColor: time.endsWith(':00') ? '#e5e7eb' : '#f3f4f6'
                  }}
                />
              ))}

              {/* Appointments for this staff member */}
              {getStaffAppointments(staffMember.ghl_id).map((appointment) => {
                const style = getAppointmentStyle(appointment)
                if (style.display === 'none') return null

                return (
                  <div
                    key={appointment.id}
                    className="bg-blue-100 border border-blue-300 rounded px-2 py-1 cursor-pointer hover:bg-blue-200 transition-colors shadow-sm"
                    style={style}
                    onClick={() => {
                      // Navigate to appointment details
                      window.location.href = `/appointments?view=details&id=${appointment.id}`
                    }}
                    title={`${appointment.serviceName} - ${appointment.contactName}`}
                  >
                    <div className="text-xs font-medium text-blue-800 truncate">
                      {appointment.serviceName}
                    </div>
                    <div className="text-xs text-blue-600 truncate">
                      {appointment.contactName}
                    </div>
                    <div className="text-xs text-blue-500 mt-1">
                      {appointment.startTime && formatTime(appointment.startTime)}
                      {appointment.endTime && ` - ${formatTime(appointment.endTime)}`}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function getCalendarDays(year: number, month: number): CalendarDay[] {
  const firstDay = new Date(year, month, 1)
  const startDate = new Date(firstDay)
  startDate.setDate(startDate.getDate() - firstDay.getDay()) // Start from Sunday
  
  const days: CalendarDay[] = []
  const today = new Date()
  
  for (let i = 0; i < 42; i++) { // 6 rows × 7 days
    const currentDate = new Date(startDate)
    currentDate.setDate(startDate.getDate() + i)
    
    days.push({
      date: new Date(currentDate),
      isCurrentMonth: currentDate.getMonth() === month,
      isToday: currentDate.toDateString() === today.toDateString(),
      appointments: [],
      dayNumber: currentDate.getDate()
    })
  }
  
  return days
}

function getYearMonths(year: number) {
  const months = []
  for (let month = 0; month < 12; month++) {
    months.push({
      name: new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long' }),
      value: month,
      days: getCalendarDays(year, month).slice(0, 42)
    })
  }
  return months
}

export default function CalendarPage() {
  const router = useRouter()
  const { data: appointments, loading } = useAppointments()
  const { user } = useUser()
  const [currentDate, setCurrentDate] = React.useState(new Date())
  const [view, setView] = React.useState<CalendarView>('month')
  const [selectedAppointment] = React.useState<Appointment | null>(null)
  const [detailsOpen, setDetailsOpen] = React.useState(false)
  const [staffView, setStaffView] = React.useState(false) // New state for staff view

  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth()

  // Check if admin view is requested via URL params
  React.useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const isAdminView = searchParams.get('admin') === 'true'
    const isStaffView = searchParams.get('staff') === 'true' 
    if ((isAdminView || isStaffView) && (user?.role === 'admin' || user?.role === 'manager')) {
      setStaffView(true)
      setView('day') // Default to day view for staff calendar
    }
  }, [user])

  // Scope to barber's own appointments if barber
  const scopedAppointments = React.useMemo(() => {
    if (user?.role === 'barber' && user.ghlId) {
      return appointments.filter(a => (a.assigned_user_id || '') === user.ghlId)
    }
    return appointments
  }, [appointments, user?.role, user?.ghlId])

  // Group appointments by date
  const appointmentsByDate = React.useMemo(() => {
    const grouped: Record<string, Appointment[]> = {}
    
    scopedAppointments.forEach(appointment => {
      if (appointment.startTime) {
        const dateKey = new Date(appointment.startTime).toDateString()
        if (!grouped[dateKey]) {
          grouped[dateKey] = []
        }
        grouped[dateKey].push(appointment)
      }
    })
    
    return grouped
  }, [scopedAppointments])

  // Get calendar data with appointments
  const calendarDays = React.useMemo(() => {
    const days = getCalendarDays(currentYear, currentMonth)
    return days.map(day => ({
      ...day,
      appointments: appointmentsByDate[day.date.toDateString()] || []
    }))
  }, [currentYear, currentMonth, appointmentsByDate])

  const yearMonths = React.useMemo(() => {
    return getYearMonths(currentYear).map(month => ({
      ...month,
      days: month.days.map(day => ({
        ...day,
        appointments: appointmentsByDate[day.date.toDateString()] || []
      }))
    }))
  }, [currentYear, appointmentsByDate])

  // Navigation functions
  const navigatePrevious = () => {
    const newDate = new Date(currentDate)
    if (view === 'month') {
      newDate.setMonth(currentMonth - 1)
    } else if (view === 'year') {
      newDate.setFullYear(currentYear - 1)
    } else if (view === 'day') {
      newDate.setDate(currentDate.getDate() - 1)
    }
    setCurrentDate(newDate)
  }

  const navigateNext = () => {
    const newDate = new Date(currentDate)
    if (view === 'month') {
      newDate.setMonth(currentMonth + 1)
    } else if (view === 'year') {
      newDate.setFullYear(currentYear + 1)
    } else if (view === 'day') {
      newDate.setDate(currentDate.getDate() + 1)
    }
    setCurrentDate(newDate)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const openAppointmentDetails = (appointment: Appointment) => {
    // Navigate to appointments page with query params to open the same details dialog
    router.push(`/appointments?view=details&id=${encodeURIComponent(appointment.id)}`)
  }

  // Get current period label
  const getCurrentPeriodLabel = () => {
    if (view === 'day') {
      return formatDate(currentDate)
    } else if (view === 'month') {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    } else {
      return currentYear.toString()
    }
  }

  // Day view appointments
  const dayAppointments = appointmentsByDate[currentDate.toDateString()] || []

  return (
    <RoleGuard requiredTeamPrefix="">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4 w-full">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <h1 className="text-xl font-semibold">Calendar</h1>
              <Badge variant="secondary" className="ml-2">
                <CalendarIcon className="h-3 w-3 mr-1" />
                Appointments
              </Badge>
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
                      <h2 className="text-2xl font-bold">{getCurrentPeriodLabel()}</h2>
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
                  
                  <div className="flex items-center gap-2">
                    <div className="flex items-center border rounded-lg p-1">
                      <Button
                        variant={view === 'day' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setView('day')}
                        className="h-8 px-3 text-xs"
                      >
                        Day
                      </Button>
                      <Button
                        variant={view === 'month' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setView('month')}
                        className="h-8 px-3 text-xs"
                      >
                        Month
                      </Button>
                      <Button
                        variant={view === 'year' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setView('year')}
                        className="h-8 px-3 text-xs"
                      >
                        Year
                      </Button>
                      {(user?.role === 'admin' || user?.role === 'manager') && (
                        <Button
                          variant={staffView ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => {
                            setStaffView(!staffView)
                            if (!staffView) setView('day')
                          }}
                          className="h-8 px-3 text-xs"
                        >
                          Staff View
                        </Button>
                      )}
                    </div>
                    
                    <Button size="sm" className="h-8" onClick={() => router.push(`/appointments?view=new`)}>
                      <Plus className="h-4 w-4 mr-2" />
                      New Appointment
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Calendar Views */}
            {loading ? (
              <Card>
                <CardContent className="p-6">
                  <Skeleton className="h-96 w-full" />
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Day View */}
                {view === 'day' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CalendarIcon className="h-5 w-5" />
                        {formatDate(currentDate)}
                        {staffView && (
                          <Badge variant="outline" className="ml-2">Staff View</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {dayAppointments.length} appointments scheduled
                        {staffView && (user?.role === 'admin' || user?.role === 'manager') && ' - Admin View: All Staff'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {dayAppointments.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No appointments scheduled for this day</p>
                        </div>
                      ) : staffView && (user?.role === 'admin' || user?.role === 'manager') ? (
                        <StaffOverviewView appointments={dayAppointments} />
                      ) : (
                        <div className="space-y-3">
                          {dayAppointments
                            .sort((a, b) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime())
                            .map((appointment) => (
                              <div
                                key={appointment.id}
                                onClick={() => openAppointmentDetails(appointment)}
                                className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full bg-primary"></div>
                                    <div>
                                      <div className="font-medium">{appointment.serviceName}</div>
                                      {appointment.contactName ? (
                                        <div className="text-sm text-muted-foreground">
                                          {appointment.contactName}
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-medium">
                                      {formatTime(appointment.startTime!)}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      {`${appointment.assignedStaffFirstName || ''} ${appointment.assignedStaffLastName || ''}`.trim() || 'Unassigned'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Month View */}
                {view === 'month' && (
                  <Card>
                    <CardContent className="p-6">
                      {/* Weekday Headers */}
                      <div className="grid grid-cols-7 gap-1 mb-2">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                          <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                            {day}
                          </div>
                        ))}
                      </div>
                      
                      {/* Calendar Grid */}
                      <div className="grid grid-cols-7 gap-1">
                        {calendarDays.map((day, index) => (
                          <div
                            key={index}
                            onClick={() => {
                              setCurrentDate(day.date)
                              setView('day')
                            }}
                            className={cn(
                              "aspect-square p-2 border rounded-lg cursor-pointer transition-all hover:bg-accent relative",
                              !day.isCurrentMonth && "text-muted-foreground bg-muted/30",
                              day.isToday && "bg-primary text-primary-foreground font-bold",
                              day.appointments.length > 0 && !day.isToday && "bg-primary/10 border-primary/20"
                            )}
                          >
                            <div className="flex flex-col h-full">
                              <div className="text-sm font-medium">{day.dayNumber}</div>
                              {day.appointments.length > 0 && (
                                <div className="flex-1 mt-1">
                                  {day.appointments.slice(0, 3).map((appointment, aptIndex) => (
                                    <div
                                      key={aptIndex}
                                      className={cn(
                                        "text-xs px-1 py-0.5 rounded mb-0.5 truncate",
                                        day.isToday 
                                          ? "bg-primary-foreground/20 text-primary-foreground" 
                                          : "bg-primary text-primary-foreground"
                                      )}
                                      title={`${appointment.serviceName} - ${formatTime(appointment.startTime!)}`}
                                    >
                                      {appointment.serviceName}
                                    </div>
                                  ))}
                                  {day.appointments.length > 3 && (
                                    <div className="text-xs text-muted-foreground">
                                      +{day.appointments.length - 3} more
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Year View */}
                {view === 'year' && (
                  <Card>
                    <CardContent className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {yearMonths.map((month) => (
                          <div
                            key={month.value}
                            onClick={() => {
                              setCurrentDate(new Date(currentYear, month.value, 1))
                              setView('month')
                            }}
                            className="border rounded-lg p-4 cursor-pointer hover:bg-accent transition-colors"
                          >
                            <h3 className="font-semibold text-center mb-3">{month.name}</h3>
                            <div className="grid grid-cols-7 gap-1">
                              {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day, idx) => (
                                <div key={`wd-${idx}`} className="text-xs text-center text-muted-foreground p-1">
                                  {day}
                                </div>
                              ))}
                              {month.days.map((day, index) => (
                                <div
                                  key={index}
                                  className={cn(
                                    "aspect-square text-xs flex items-center justify-center rounded",
                                    !day.isCurrentMonth && "text-muted-foreground",
                                    day.isToday && "bg-primary text-primary-foreground font-bold",
                                    day.appointments.length > 0 && !day.isToday && "bg-primary/20"
                                  )}
                                >
                                  {day.dayNumber}
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 text-xs text-center text-muted-foreground">
                              {month.days.reduce((sum, day) => sum + day.appointments.length, 0)} appointments
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>

          {/* Appointment Details Sheet */}
          <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
            <SheetContent side="right" className="w-full sm:max-w-md">
              <SheetHeader>
                <SheetTitle>{selectedAppointment?.serviceName}</SheetTitle>
                <SheetDescription>Appointment Details</SheetDescription>
              </SheetHeader>
              
              {selectedAppointment && (
                <div className="mt-6 space-y-6">
                  {/* Basic Info */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{selectedAppointment.contactName || 'Unknown Customer'}</div>
                        <div className="text-sm text-muted-foreground">{selectedAppointment.contactPhone || 'No phone'}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">
                          {selectedAppointment.startTime && formatTime(selectedAppointment.startTime)}
                          {selectedAppointment.endTime && ` - ${formatTime(selectedAppointment.endTime)}`}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {selectedAppointment.startTime && new Date(selectedAppointment.startTime).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">
                          {`${selectedAppointment.assignedStaffFirstName || ''} ${selectedAppointment.assignedStaffLastName || ''}`.trim() || 'Unassigned'}
                        </div>
                        <div className="text-sm text-muted-foreground">Staff Member</div>
                      </div>
                    </div>
                    
                    {selectedAppointment.address && (
                      <div className="flex items-center gap-3">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{selectedAppointment.address}</div>
                          <div className="text-sm text-muted-foreground">Location</div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Status */}
                  <div>
                    <Badge 
                      variant={
                        selectedAppointment.appointment_status === 'confirmed' ? 'default' :
                        selectedAppointment.appointment_status === 'cancelled' ? 'destructive' :
                        'secondary'
                      }
                    >
                      {selectedAppointment.appointment_status || selectedAppointment.status || 'Unknown'}
                    </Badge>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex gap-2 pt-4">
                    <Button size="sm" variant="outline" className="flex-1">
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1">
                      <Eye className="h-4 w-4 mr-2" />
                      View Full
                    </Button>
                    <Button size="sm" variant="destructive" className="flex-1">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </SidebarInset>
      </SidebarProvider>
    </RoleGuard>
  )
}
