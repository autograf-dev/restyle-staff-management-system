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
  User as UserIcon, 
  MapPin,
  Plus,
  Eye,
  Edit,
  Trash2,
  ArrowLeft,
  ArrowRight
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useUser, type User } from "@/contexts/user-context"
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
          bookings.slice(0, 50).map(async (booking: RawAppointment) => {
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

            // Contact and staff detail fetches are skipped here to improve performance.

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
const StaffOverviewView = ({ appointments, user }: { appointments: Appointment[], user: User | null }) => {
  const [staff, setStaff] = React.useState<{
    id: string;
    ghl_id: string;
    name: string;
    email: string;
    role: string;
  }[]>([])
  const [loading, setLoading] = React.useState(true)
  const [leaves, setLeaves] = React.useState<{
    "🔒 Row ID": string;
    ghl_id: string;
    "Event/Name": string;
    "Event/Start": string;
    "Event/End": string;
  }[]>([])
  const [breaks, setBreaks] = React.useState<{
    "🔒 Row ID": string;
    ghl_id: string;
    "Block/Name": string;
    "Block/Recurring": string;
    "Block/Recurring Day": string;
    "Block/Start": string;
    "Block/End": string;
    "Block/Date": string;
  }[]>([])
  const [salonHours, setSalonHours] = React.useState<{
    id: string;
    day_of_week: number;
    is_open: boolean;
    open_time: number | null;
    close_time: number | null;
  }[]>([])
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const headerScrollRef = React.useRef<HTMLDivElement>(null)
  const columnsScrollRef = React.useRef<HTMLDivElement>(null)
  const columnWidth = 220
  const [currentTime, setCurrentTime] = React.useState(new Date())

  // Update current time every minute
  React.useEffect(() => {
    const updateTime = () => setCurrentTime(new Date())
    const interval = setInterval(updateTime, 60000) // Update every minute
    return () => clearInterval(interval)
  }, [])

  // Calculate current time position for live line
  const getCurrentTimePosition = () => {
    const now = currentTime
    const hour = now.getHours()
    const minute = now.getMinutes()
    
    // Only show if within business hours (8 AM to 8 PM)
    if (hour < 8 || hour >= 20) return null
    
    const currentMinutes = hour * 60 + minute
    const dayStartMinutes = 8 * 60 // 8 AM
    const position = ((currentMinutes - dayStartMinutes) / 30) * 60 // 60px per 30min slot
    
    return position
  }

  // Auto-scroll to current time on component mount
  React.useEffect(() => {
    const scrollToCurrentTime = () => {
      if (!scrollContainerRef.current) return
      
      const currentTimePosition = getCurrentTimePosition()
      if (currentTimePosition !== null) {
        // Scroll to current time minus some offset to show context
        const scrollTop = Math.max(0, currentTimePosition - 120) // Show 2 hours before
        scrollContainerRef.current.scrollTop = scrollTop
      }
    }

    // Delay scroll to ensure component is fully rendered
    const timer = setTimeout(scrollToCurrentTime, 500)
    return () => clearTimeout(timer)
  }, [staff]) // Re-run when staff data loads

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch staff data
        const staffRes = await fetch('/api/barber-hours')
        const staffJson = await staffRes.json()
        
        if (staffJson.ok) {
          const staffData = staffJson.data || []
          let staffMembers = staffData.map((barber: {
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
          
          // Filter staff based on user role
          if (user?.role === 'barber' && user.ghlId) {
            // For barber role, only show their own data
            staffMembers = staffMembers.filter((member: { ghl_id: string }) => member.ghl_id === user.ghlId)
          }
          // For admin/manager roles, show all staff (no filtering)
          
          setStaff(staffMembers)
        }

        // Fetch leaves data
        const leavesRes = await fetch('/api/leaves')
        const leavesJson = await leavesRes.json()
        if (leavesJson.ok) {
          setLeaves(leavesJson.data || [])
        }

        // Fetch breaks data
        const breaksRes = await fetch('/api/time-blocks')
        const breaksJson = await breaksRes.json()
        if (breaksJson.ok) {
          setBreaks(breaksJson.data || [])
        }

        // Fetch salon hours data
        const salonRes = await fetch('/api/business-hours')
        const salonJson = await salonRes.json()
        if (salonJson.ok) {
          setSalonHours(salonJson.data || [])
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user])

  // Auto-scroll to 8 AM on component mount
  React.useEffect(() => {
    if (scrollContainerRef.current) {
      // Scroll to 8 AM position (0 slots * 60px = 0px since we start at 8AM)
      scrollContainerRef.current.scrollTop = 0
    }
    if (headerScrollRef.current) headerScrollRef.current.scrollLeft = 0
    if (columnsScrollRef.current) columnsScrollRef.current.scrollLeft = 0
  }, [staff]) // Trigger after staff data is loaded

  // Keep header and body horizontal scroll in sync
  React.useEffect(() => {
    const headerEl = headerScrollRef.current
    const bodyEl = columnsScrollRef.current
    if (!headerEl || !bodyEl) return
    const onHeader = () => { if (bodyEl.scrollLeft !== headerEl.scrollLeft) bodyEl.scrollLeft = headerEl.scrollLeft }
    const onBody = () => { if (headerEl.scrollLeft !== bodyEl.scrollLeft) headerEl.scrollLeft = bodyEl.scrollLeft }
    headerEl.addEventListener('scroll', onHeader)
    bodyEl.addEventListener('scroll', onBody)
    return () => {
      headerEl.removeEventListener('scroll', onHeader)
      bodyEl.removeEventListener('scroll', onBody)
    }
  }, [headerScrollRef.current, columnsScrollRef.current])

  // Generate time slots from 8AM to 8PM (12-hour range)
  const generateTimeSlots = () => {
    const slots: string[] = []
    // 8 AM to 8 PM (8:00 to 20:00) in 30-minute intervals
    for (let hour = 8; hour <= 20; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        slots.push(`${hour.toString().padStart(2,'0')}:${minute.toString().padStart(2,'0')}`)
      }
    }
    return slots
  }

  const timeSlots = generateTimeSlots()

  // Helper function to get appointment position and height (8AM to 8PM range)
  const getAppointmentStyleImproved = (appointment: Appointment) => {
    if (!appointment.startTime || !appointment.endTime) return { display: 'none' }
    
    const start = new Date(appointment.startTime)
    const end = new Date(appointment.endTime)
    
    const startHour = start.getHours()
    const startMinute = start.getMinutes()
    const endHour = end.getHours()
    const endMinute = end.getMinutes()
    
    // Calculate position from 8AM (480 minutes from midnight)
    const dayStartMinutes = 8 * 60 // 8 AM start
    const startMinutes = startHour * 60 + startMinute
    const endMinutes = endHour * 60 + endMinute
    
    // Only show appointments within 8AM-8PM range
    const dayEndMinutesExclusive = 20 * 60 + 30 // 8:30 PM (end of 8 PM slot)
    if (startMinutes < dayStartMinutes || startMinutes >= dayEndMinutesExclusive) {
      return { display: 'none' }
    }
    
    const topOffset = ((startMinutes - dayStartMinutes) / 30) * 60 // 60px per 30min slot
    const height = ((endMinutes - startMinutes) / 30) * 60
    
    return {
      position: 'absolute' as const,
      top: `${Math.max(0, topOffset)}px`,
      height: `${Math.max(30, height - 4)}px`,
      left: '4px',
      right: '4px',
      zIndex: 10
    }
  }



  // Get appointments for a specific staff member
  const getStaffAppointments = (staffGhlId: string) => {
    return appointments.filter(apt => apt.assigned_user_id === staffGhlId)
  }

  // Get leaves for a specific staff member
  const getStaffLeaves = (staffGhlId: string) => {
    return leaves.filter(leave => leave.ghl_id === staffGhlId)
  }

  // Get breaks for a specific staff member
  const getStaffBreaks = (staffGhlId: string) => {
    return breaks.filter(breakItem => breakItem.ghl_id === staffGhlId)
  }

  // Helper function to get leave/break position and height
  const getLeaveBreakStyle = (startTime: string, endTime: string) => {
    const start = new Date(startTime)
    const end = new Date(endTime)
    
    const startHour = start.getHours()
    const startMinute = start.getMinutes()
    const endHour = end.getHours()
    const endMinute = end.getMinutes()
    
    // Calculate position from 8AM (480 minutes from midnight)
    const dayStartMinutes = 8 * 60 // Start from 8AM (480 minutes)
    const startMinutes = startHour * 60 + startMinute
    const endMinutes = endHour * 60 + endMinute
    
    // Only show if within 8AM-8PM range
    if (startMinutes < dayStartMinutes || startMinutes >= 20 * 60) {
      return { display: 'none' }
    }
    
    const topOffset = ((startMinutes - dayStartMinutes) / 30) * 60 // 60px per 30min slot
    const height = ((endMinutes - startMinutes) / 30) * 60
    
    return {
      position: 'absolute' as const,
      top: `${Math.max(0, topOffset)}px`,
      height: `${Math.max(30, height - 4)}px`,
      left: '4px',
      right: '4px',
      zIndex: 5
    }
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
        <UserIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <h3 className="font-medium mb-2">No Staff Members Found</h3>
        <p className="text-sm">Staff members with the &apos;barber&apos; role will appear here.</p>
      </div>
    )
  }

  return (
    <>
{(user?.role === 'admin' || user?.role === 'manager') && (
  <div className="pr-2 flex items-center gap-1 py-4">
    <button
      className="h-7 w-7 rounded border bg-background hover:bg-accent flex items-center justify-center"
      onClick={() => {
        const delta = -columnWidth*2
        const h = headerScrollRef.current
        const b = columnsScrollRef.current
        if (h) h.scrollBy({ left: delta, behavior: 'smooth' })
        if (b) b.scrollBy({ left: delta, behavior: 'smooth' })
      }}
      aria-label="Scroll left"
      title="Scroll left"
    >
      <ArrowLeft className="h-4 w-4" />
    </button>
    <button
      className="h-7 w-7 rounded border bg-background hover:bg-accent flex items-center justify-center"
      onClick={() => {
        const delta = columnWidth*2
        const h = headerScrollRef.current
        const b = columnsScrollRef.current
        if (h) h.scrollBy({ left: delta, behavior: 'smooth' })
        if (b) b.scrollBy({ left: delta, behavior: 'smooth' })
      }}
      aria-label="Scroll right"
      title="Scroll right"
    >
      <ArrowRight className="h-4 w-4" />
    </button>
  </div>
)}
    <div className="bg-background rounded-lg border shadow-sm overflow-hidden w-full">
      
      {/* Header - Sticky time column + scrollable staff columns */}
      <div className="sticky top-0 z-20 bg-background border-b flex w-full items-center">
        {/* Sticky Time Header */}
        <div className="w-[120px] p-4 border-r font-semibold text-sm bg-muted/50 flex items-center justify-center flex-shrink-0">
          <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
          Time
          
        </div>
        
        {/* Scrollable Staff Headers */}
        <div className="flex-1 overflow-x-auto" ref={headerScrollRef}>
          <div className="flex" style={{ minWidth: `${staff.length * columnWidth}px` }}>
            {staff.map((staffMember) => {
              const appts = getStaffAppointments(staffMember.ghl_id)
              // Build a compact list of time chips for that day
              const chips = appts
                .filter(a => a.startTime)
                .sort((a,b) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime())
                .slice(0,4) // show first 4
                .map((a) => new Date(a.startTime!))
              return (
                <div key={staffMember.ghl_id} className="w-[220px] p-4 border-r last:border-r-0 bg-background flex-shrink-0" style={{ width: `${columnWidth}px` }}>
                  <div className="text-center">
                    <div className="font-medium text-sm truncate mb-1" title={staffMember.name}>
                      {staffMember.name}
                    </div>
                    <div className="text-xs text-muted-foreground mb-2">
                      {appts.length} appointments
                    </div>
                    <div className="flex flex-wrap gap-1 justify-center">
                      {chips.map((d, idx) => (
                        <button
                          key={idx}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20"
                          onClick={() => {
                            const minutesFromStart = (d.getHours()*60 + d.getMinutes()) - (8*60)
                            const slotIndex = Math.max(0, Math.floor(minutesFromStart / 30))
                            if (scrollContainerRef.current) {
                              scrollContainerRef.current.scrollTop = slotIndex * 60
                            }
                          }}
                          title={d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}
                        >
                          {d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}
                        </button>
                      ))}
                      {appts.length > 4 && (
                        <span className="text-[10px] text-muted-foreground">+{appts.length - 4} more</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      
      </div>

      {/* Scrollable Time grid container */}
      <div className="max-h-[600px] overflow-y-auto w-full" ref={scrollContainerRef}>
        <div className="flex w-full" style={{ height: `${timeSlots.length * 60}px` }}>
          {/* Sticky Time column */}
          <div className="w-[120px] border-r bg-muted/30 flex-shrink-0 relative">
            {timeSlots.map((time, index) => (
              <div
                key={time}
                className="absolute left-0 right-0 border-b border-border/50 px-3 flex items-center justify-end"
                style={{ 
                  top: `${index * 60}px`, 
                  height: '60px'
                }}
              >
                {time.endsWith(':00') && (
                  <span className="text-sm font-medium text-muted-foreground">
                    {(() => {
                      const hour = parseInt(time)
                      if (hour === 0) return '12:00 AM'
                      if (hour < 12) return `${hour}:00 AM`
                      if (hour === 12) return '12:00 PM'
                      return `${hour - 12}:00 PM`
                    })()}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Scrollable Staff columns container */}
          <div className="flex-1 overflow-x-auto" ref={columnsScrollRef} onScroll={(e) => {
            const h = headerScrollRef.current
            const sl = (e.currentTarget as HTMLDivElement).scrollLeft
            if (h && Math.abs(h.scrollLeft - sl) > 1) {
              h.scrollLeft = sl
            }
          }}>
            <div className="flex relative" style={{ minWidth: `${staff.length * columnWidth}px`, height: `${timeSlots.length * 60}px` }}>
              {/* Staff columns */}
              {staff.map((staffMember) => (
                <div key={staffMember.ghl_id} className="border-r last:border-r-0 bg-background flex-shrink-0 relative" style={{ width: `${columnWidth}px` }}>
                  {/* Hour lines for this staff column */}
                  {timeSlots.map((time, index) => (
                    <div
                      key={time}
                      className={`absolute left-0 right-0 ${
                        time.endsWith(':00') ? 'border-b border-border' : 'border-b border-border/30'
                      }`}
                      style={{ 
                        top: `${index * 60}px`, 
                        height: '60px'
                      }}
                    />
                  ))}

                  {/* Live time indicator */}
                  {(() => {
                    const currentTimePosition = getCurrentTimePosition()
                    if (currentTimePosition === null) return null
                    
                    return (
                      <div
                        className="absolute left-0 right-0 border-t-2 border-red-500 z-20"
                        style={{ top: `${currentTimePosition}px` }}
                      >
                        <div className="absolute -left-1 -top-1 w-2 h-2 bg-red-500 rounded-full"></div>
                      </div>
                    )
                  })()}

                  {/* Leaves for this staff member */}
                  {getStaffLeaves(staffMember.ghl_id).map((leave) => {
                    const style = getLeaveBreakStyle(leave["Event/Start"], leave["Event/End"])
                    if (style.display === 'none') return null

                    return (
                      <div
                        key={`leave-${leave["🔒 Row ID"]}`}
                        className="absolute rounded-md px-3 py-2 border-l-4 border-l-orange-400 bg-orange-100/50 backdrop-blur-sm"
                        style={style}
                        title={`Leave: ${leave["Event/Name"]}`}
                      >
                        <div className="text-sm font-medium text-orange-700 truncate">
                          Leave
                        </div>
                        <div className="text-xs text-orange-600 truncate mt-1">
                          {leave["Event/Name"]}
                        </div>
                      </div>
                    )
                  })}

                  {/* Breaks for this staff member */}
                  {getStaffBreaks(staffMember.ghl_id).map((breakItem) => {
                    // For recurring breaks, we need to check if it applies to current day
                    const currentDay = new Date().getDay() // 0 = Sunday, 1 = Monday, etc.
                    const recurringDays = breakItem["Block/Recurring Day"]?.split(',') || []
                    
                    // Skip if it's a recurring break and doesn't apply to current day
                    if (breakItem["Block/Recurring"] === "true" && !recurringDays.includes(currentDay.toString())) {
                      return null
                    }

                    // Create start and end times for the break
                    const startMinutes = parseInt(breakItem["Block/Start"]) || 0
                    const endMinutes = parseInt(breakItem["Block/End"]) || 0
                    
                    // Convert minutes to time strings
                    const startHour = Math.floor(startMinutes / 60)
                    const startMin = startMinutes % 60
                    const endHour = Math.floor(endMinutes / 60)
                    const endMin = endMinutes % 60
                    
                    const startTime = `${startHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')}:00`
                    const endTime = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}:00`
                    
                    const style = getLeaveBreakStyle(startTime, endTime)
                    if (style.display === 'none') return null

                    return (
                      <div
                        key={`break-${breakItem["🔒 Row ID"]}`}
                        className="absolute rounded-md px-3 py-2 border-l-4 border-l-gray-400 bg-gray-100/50 backdrop-blur-sm"
                        style={style}
                        title={`Break: ${breakItem["Block/Name"]}`}
                      >
                        <div className="text-sm font-medium text-gray-600 truncate">
                          Break
                        </div>
                        <div className="text-xs text-gray-500 truncate mt-1">
                          {breakItem["Block/Name"]}
                        </div>
                      </div>
                    )
                  })}

                  {/* Appointments for this staff member */}
                  {getStaffAppointments(staffMember.ghl_id).map((appointment) => {
                    const style = getAppointmentStyleImproved(appointment)
                    if (style.display === 'none') return null

                    const staffName = staff.find(s => s.ghl_id === staffMember.ghl_id)?.name || ''
                    return (
                      <div
                        key={appointment.id}
                        className="absolute rounded-md px-3 py-2 cursor-pointer transition-all duration-200 hover:shadow-md border-l-4 border-l-primary bg-primary/10 hover:bg-primary/20 backdrop-blur-sm"
                        style={style}
                        onClick={() => {
                          window.location.href = `/appointments?view=details&id=${appointment.id}`
                        }}
                        title={`${appointment.serviceName} - ${appointment.contactName}`}
                      >
                        <div className="text-sm font-medium text-primary truncate">
                          {appointment.serviceName}
                        </div>
                        {staffName && (
                          <div className="text-[11px] text-muted-foreground truncate">
                            {staffName}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground truncate mt-1">
                          {appointment.contactName}
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <div className="text-xs text-primary/80 font-medium">
                            {appointment.startTime && formatTime(appointment.startTime)}
                            {appointment.endTime && ` - ${formatTime(appointment.endTime)}`}
                          </div>
                          <span className={`inline-block px-1.5 py-0.5 rounded-full text-[11px] font-medium ${
                            appointment.appointment_status === 'confirmed' 
                              ? 'bg-green-100 text-green-700' 
                              : appointment.appointment_status === 'cancelled'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {appointment.appointment_status}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
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
  const [salonHours, setSalonHours] = React.useState<{
    id: string;
    day_of_week: number;
    is_open: boolean;
    open_time: number | null;
    close_time: number | null;
  }[]>([])
  const [staffMap, setStaffMap] = React.useState<Record<string, string>>({})
  const [leaves, setLeaves] = React.useState<{
    "🔒 Row ID": string;
    ghl_id: string;
    "Event/Name": string;
    "Event/Start": string;
    "Event/End": string;
  }[]>([])
  const [breaks, setBreaks] = React.useState<{
    "🔒 Row ID": string;
    ghl_id: string;
    "Block/Name": string;
    "Block/Recurring": string;
    "Block/Recurring Day": string;
    "Block/Start": string;
    "Block/End": string;
    "Block/Date": string;
  }[]>([])

  // Fetch salon hours
  React.useEffect(() => {
    const fetchSalonHours = async () => {
      try {
        const salonRes = await fetch('/api/business-hours')
        const salonJson = await salonRes.json()
        if (salonJson.ok) {
          setSalonHours(salonJson.data || [])
        }
      } catch (error) {
        console.error('Failed to fetch salon hours:', error)
      }
    }
    fetchSalonHours()
  }, [])

  // Fetch staff map and leave/break datasets for indicators
  React.useEffect(() => {
    const fetchMeta = async () => {
      try {
        const [staffRes, leavesRes, breaksRes] = await Promise.all([
          fetch('/api/barber-hours'),
          fetch('/api/leaves'),
          fetch('/api/time-blocks')
        ])

        const staffJson = await staffRes.json().catch(() => ({ ok: false }))
        if (staffJson?.ok) {
          const map: Record<string, string> = {}
          ;(staffJson.data || []).forEach((barber: Record<string, string>) => {
            const id = barber['ghl_id']
            const name = barber['Barber/Name']
            if (id) map[id] = name || id
          })
          setStaffMap(map)
        }

        const leavesJson = await leavesRes.json().catch(() => ({ ok: false }))
        if (leavesJson?.ok) setLeaves(leavesJson.data || [])

        const breaksJson = await breaksRes.json().catch(() => ({ ok: false }))
        if (breaksJson?.ok) setBreaks(breaksJson.data || [])
      } catch (e) {
        console.warn('Failed fetching calendar meta', e)
      }
    }
    fetchMeta()
  }, [])

  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth()

  // Check if admin view is requested via URL params
  React.useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const isAdminView = searchParams.get('admin') === 'true'
    const isStaffView = searchParams.get('staff') === 'true' 
    if ((isAdminView || isStaffView) && (user?.role === 'admin' || user?.role === 'manager' || user?.role === 'barber')) {
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

  // Check if a day is a salon day-off
  const isSalonDayOff = (date: Date) => {
    const dayOfWeek = date.getDay() // 0 = Sunday, 1 = Monday, etc.
    const dayHours = salonHours.find(hour => hour.day_of_week === dayOfWeek)
    return dayHours && !dayHours.is_open
  }

  // Utility: same day check (ignoring time)
  const isSameDay = (a: Date, b: Date) => {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  }

  // Get leaves for a given date (scoped by role)
  const getLeavesForDate = (date: Date) => {
    const items = leaves.filter((lv) => {
      const start = new Date(lv['Event/Start'])
      const end = new Date(lv['Event/End'])
      // Treat end as exclusive (if end is 27th 00:00, leave is only on 26th)
      const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate())
      const endDayExclusive = new Date(end.getFullYear(), end.getMonth(), end.getDate())
      const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      return d >= startDay && d < endDayExclusive
    })
    if (user?.role === 'barber' && user.ghlId) return items.filter(i => i.ghl_id === user.ghlId)
    return items
  }

  // Get breaks for a given date (scoped by role)
  const getBreaksForDate = (date: Date) => {
    const dow = date.getDay().toString()
    const items = breaks.filter((bk) => {
      if (bk['Block/Recurring'] === 'true') {
        const days = (bk['Block/Recurring Day'] || '').split(',')
        return days.includes(dow)
      }
      if (!bk['Block/Date']) return false
      const d = new Date(bk['Block/Date'])
      return isSameDay(d, date)
    })
    if (user?.role === 'barber' && user.ghlId) return items.filter(i => i.ghl_id === user.ghlId)
    return items
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
                      {(user?.role === 'admin' || user?.role === 'manager' || user?.role === 'barber') && (
                        <Button
                          variant={staffView ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => {
                            setStaffView(!staffView)
                            if (!staffView) setView('day')
                          }}
                          className="h-8 px-3 text-xs"
                        >
                          {user?.role === 'barber' ? 'My Schedule' : 'Staff View'}
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
                          <Badge variant="outline" className="ml-2">
                            {user?.role === 'barber' ? 'My Schedule' : 'Staff View'}
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {dayAppointments.length} appointments scheduled
                        {staffView && user?.role === 'barber' && ' - My Schedule'}
                        {staffView && (user?.role === 'admin' || user?.role === 'manager') && ' - Admin View: All Staff'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {isSalonDayOff(currentDate) ? (
                        <div className="text-center py-12 text-red-600">
                          <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p className="font-medium">Salon is closed today</p>
                          <p className="text-sm text-muted-foreground mt-2">No bookings available</p>
                        </div>
                      ) : (
                        <>
                          {(() => {
                            const dayLeaves = getLeavesForDate(currentDate)
                            const dayBreaks = getBreaksForDate(currentDate)
                            if (dayLeaves.length === 0 && dayBreaks.length === 0) return null
                            return (
                              <div className="mb-3 text-xs">
                                {dayLeaves.length > 0 && (
                                  <div className="text-orange-700">Leaves: {dayLeaves.map(l => `${staffMap[l.ghl_id] || l.ghl_id} (${l['Event/Name']})`).join(', ')}</div>
                                )}
                                {dayBreaks.length > 0 && (
                                  <div className="text-gray-600">Breaks: {dayBreaks.map(b => `${staffMap[b.ghl_id] || b.ghl_id} (${b['Block/Name']})`).join(', ')}</div>
                                )}
                              </div>
                            )
                          })()}
                          {staffView && (user?.role === 'admin' || user?.role === 'manager' || user?.role === 'barber') ? (
                            <StaffOverviewView appointments={dayAppointments} user={user} />
                          ) : dayAppointments.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                              <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                              <p>No bookings scheduled for this day</p>
                            </div>
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
                        </>
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
                              day.appointments.length > 0 && !day.isToday && "bg-primary/10 border-primary/20",
                              isSalonDayOff(day.date) && "bg-red-50 border-red-200"
                            )}
                          >
                            <div className="flex flex-col h-full">
                              <div className="text-sm font-medium">{day.dayNumber}</div>
                              {/* Leaves/Breaks indicators */}
                              {(() => {
                                const dayLeaves = getLeavesForDate(day.date)
                                const dayBreaks = getBreaksForDate(day.date)
                                return (
                                  <>
                                    {dayLeaves.length > 0 && (
                                      <button onClick={(e) => { e.stopPropagation(); window.location.href = '/settings/leaves'; }} className="inline-flex items-center gap-1 mt-1 text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-200">
                                        {dayLeaves.length} {dayLeaves.length>1? 'Leaves':'Leave'}
                                      </button>
                                    )}
                                    {dayBreaks.length > 0 && (
                                      <button onClick={(e) => { e.stopPropagation(); window.location.href = '/settings/breaks'; }} className="inline-flex items-center gap-1 mt-1 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-800 border border-gray-200">
                                        {dayBreaks.length} {dayBreaks.length>1? 'Breaks':'Break'}
                                      </button>
                                    )}
                                  </>
                                )
                              })()}
                              {isSalonDayOff(day.date) && (
                                <div className="text-xs text-red-600 font-medium mt-1">
                                  Salon Closed
                                </div>
                              )}
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
                                    day.appointments.length > 0 && !day.isToday && "bg-primary/20",
                                    isSalonDayOff(day.date) && "bg-red-100 text-red-700"
                                  )}
                                >
                                  <div className="relative w-full h-full flex items-center justify-center">
                                    {day.dayNumber}
                                    {/* Corner markers for leaves/breaks */}
                                    {(() => {
                                      const dayLeaves = getLeavesForDate(day.date)
                                      const dayBreaks = getBreaksForDate(day.date)
                                      return (
                                        <>
                                          {dayLeaves.length > 0 && (
                                            <button onClick={(e) => { e.stopPropagation(); window.location.href = '/settings/leaves'; }} className="absolute left-1 top-1 text-[9px] px-1 rounded bg-orange-100 text-orange-800 border border-orange-200" title={dayLeaves.map(l => `${staffMap[l.ghl_id] || l.ghl_id}: ${l['Event/Name']}`).join(', ')}>L</button>
                                          )}
                                          {dayBreaks.length > 0 && (
                                            <button onClick={(e) => { e.stopPropagation(); window.location.href = '/settings/breaks'; }} className="absolute right-1 bottom-1 text-[9px] px-1 rounded bg-gray-100 text-gray-800 border border-gray-200" title={dayBreaks.map(b => `${staffMap[b.ghl_id] || b.ghl_id}: ${b['Block/Name']}`).join(', ')}>B</button>
                                          )}
                                        </>
                                      )
                                    })()}
                                  </div>
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
                      <UserIcon className="h-4 w-4 text-muted-foreground" />
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
                      <UserIcon className="h-4 w-4 text-muted-foreground" />
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
