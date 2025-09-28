"use client"
import * as React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { RoleGuard } from "@/components/role-guard"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRouter } from "next/navigation"
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  User as UserIcon, 
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  RefreshCcw,
  DollarSign,
  CheckCircle,
  X
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
  payment_status?: 'pending' | 'paid' | 'failed'
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
  const [lastUpdated, setLastUpdated] = React.useState<number>(0)


  const fetchAppointments = React.useCallback(async (forceRefresh: boolean = false) => {
      setLoading(true)
      try {
        // Cache read (10 min TTL)
        try {
          const cached = JSON.parse(localStorage.getItem('restyle.calendar.appointments') || 'null') as { data: Appointment[]; fetchedAt: number } | null
          const ttl = 10 * 60 * 1000
          if (!forceRefresh && cached && Date.now() - cached.fetchedAt < ttl) {
            setData(cached.data || [])
            setLastUpdated(cached.fetchedAt)
            setLoading(false)
            return
          }
        } catch {}

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

            // Check payment status by looking up transactions with proper paid status
            try {
              const transactionRes = await fetch(`/api/transactions?appointmentId=${booking.id}&limit=1`)
              console.log(`Payment status check for ${booking.id}: Status ${transactionRes.status}`)
              if (transactionRes.ok) {
                const transactionData = await transactionRes.json()
                console.log(`Transaction data for ${booking.id}:`, transactionData)
                if (transactionData.ok && transactionData.data && transactionData.data.length > 0) {
                  const transaction = transactionData.data[0]
                  console.log(`Transaction details for ${booking.id}:`, {
                    status: transaction.status,
                    paymentStatus: transaction.paymentStatus,
                    paid: transaction.paid,
                    id: transaction.id
                  })
                  // Check if transaction has paid status
                  if (transaction.status === 'Paid' || transaction.paymentStatus === 'Paid' || transaction.paid === true || transaction.paid === 'Yes') {
                    details.payment_status = 'paid'
                    console.log(`✅ Appointment ${booking.id} marked as PAID`)
                  } else {
                    details.payment_status = 'pending'
                    console.log(`⏳ Appointment ${booking.id} marked as PENDING`)
                  }
                } else {
                  // No transaction found - still pending payment
                  details.payment_status = 'pending'
                  console.log(`❌ No transaction found for ${booking.id}`)
                }
              } else {
                details.payment_status = 'pending'
                console.log(`❌ API call failed for ${booking.id}: ${transactionRes.status}`)
              }
            } catch (error) {
              console.warn(`Failed to check payment status for booking ${booking.id}:`, error)
              details.payment_status = 'pending'
            }

            // Contact and staff detail fetches are skipped here to improve performance.

            return details
          })
        )
        
        const filtered = enrichedBookings.filter(apt => apt.startTime)
        setData(filtered)
        const nowTs = Date.now()
        setLastUpdated(nowTs)
        try { localStorage.setItem('restyle.calendar.appointments', JSON.stringify({ data: filtered, fetchedAt: nowTs })) } catch {}
      } catch (error) {
        console.error("Failed to fetch appointments:", error)
        toast.error("Failed to load appointments")
      } finally {
        setLoading(false)
      }
    }, [])

    React.useEffect(() => {
      fetchAppointments()
      const interval = setInterval(() => fetchAppointments(true), 10 * 60 * 1000)
      return () => clearInterval(interval)
    }, [fetchAppointments])

  const refresh = async () => { 
    try { 
      localStorage.removeItem('restyle.calendar.appointments') 
      await fetchAppointments(true) // Force refetch
    } catch (error) {
      console.error('Error refreshing appointments:', error)
    }
  }
  return { data, loading, refresh, lastUpdated }
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
const StaffOverviewView = ({ 
  appointments, 
  user, 
  onAppointmentClick 
}: { 
  appointments: Appointment[], 
  user: User | null,
  onAppointmentClick: (appointment: Appointment) => void 
}) => {
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
  // Visual padding for the time grid so first/last rows aren't clipped
  const GRID_TOP_PADDING = 48
  const GRID_BOTTOM_PADDING = 16

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
    const position = GRID_TOP_PADDING + ((currentMinutes - dayStartMinutes) / 30) * 60 // 60px per 30min slot
    
    return position
  }

  // Auto-scroll to current time on component mount
  React.useEffect(() => {
    const scrollToCurrentTime = () => {
      if (!scrollContainerRef.current) return
      
      const currentTimePosition = getCurrentTimePosition()
      if (currentTimePosition !== null) {
        // Center the current-time indicator in the viewport for best UX
        const container = scrollContainerRef.current
        const containerHeight = container.clientHeight || 0
        // If the container hasn't been laid out yet, retry shortly
        if (containerHeight <= 1) {
          setTimeout(scrollToCurrentTime, 150)
          return
        }
        const totalHeight = timeSlots.length * 60 + GRID_TOP_PADDING + GRID_BOTTOM_PADDING
        const desiredTop = currentTimePosition - (containerHeight / 2)
        const clampedTop = Math.max(0, Math.min(totalHeight - containerHeight, desiredTop))
        container.scrollTop = clampedTop
      } else {
        // If outside 8AM-8PM, snap to nearest bound
        const hourNow = new Date().getHours()
        if (hourNow < 8) {
          scrollContainerRef.current.scrollTop = 0
        } else {
          const totalHeight = timeSlots.length * 60 + GRID_TOP_PADDING + GRID_BOTTOM_PADDING
          scrollContainerRef.current.scrollTop = totalHeight
        }
      }
    }

    // Delay scroll to ensure component is fully rendered
    const timer = setTimeout(scrollToCurrentTime, 250)
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
    if (headerScrollRef.current) headerScrollRef.current.scrollLeft = 0
    if (columnsScrollRef.current) columnsScrollRef.current.scrollLeft = 0
    // Do not force vertical scroll to 8 AM here; allow current-time autoscroll to take precedence
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

  // Generate time slots from 8:00 AM to 8:00 PM inclusive (30-min increments)
  const generateTimeSlots = () => {
    const slots: string[] = []
    // 8:00 AM → 7:30 PM
    for (let hour = 8; hour <= 19; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        slots.push(`${hour.toString().padStart(2,'0')}:${minute.toString().padStart(2,'0')}`)
      }
    }
    // Add final 8:00 PM slot, but not 8:30 PM
    slots.push('20:00')
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
    const dayEndMinutesExclusive = 20 * 60 // 8:00 PM end-of-day
    if (startMinutes < dayStartMinutes || startMinutes >= dayEndMinutesExclusive) {
      return { display: 'none' }
    }
    
    const topOffset = GRID_TOP_PADDING + ((startMinutes - dayStartMinutes) / 30) * 60 // 60px per 30min slot
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
    
    const topOffset = GRID_TOP_PADDING + ((startMinutes - dayStartMinutes) / 30) * 60 // 60px per 30min slot
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
    <div className="space-y-3">
{(user?.role === 'admin' || user?.role === 'manager') && (
  <div className="w-full">
    <div className="bg-gradient-to-r from-[#601625]/5 to-[#751a29]/5 rounded-lg border border-[#601625]/20 p-3 flex items-center gap-3">
      <button
        className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-[#601625]/10 transition-all duration-200 border border-[#601625]/20 text-[#601625]"
        onClick={() => {
          const delta = -columnWidth*3
          const h = headerScrollRef.current
          const b = columnsScrollRef.current
          if (h) h.scrollBy({ left: delta, behavior: 'smooth' })
          if (b) b.scrollBy({ left: delta, behavior: 'smooth' })
        }}
        aria-label="Scroll left"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      
      <div className="flex-1 flex items-center gap-2 px-2">
        <div className="flex-1 flex items-center gap-1.5">
          {staff.slice(0, 8).map((_, index) => (
            <div 
              key={index}
              className="h-2 bg-gradient-to-r from-[#601625]/20 to-[#751a29]/20 rounded-full flex-1 cursor-pointer hover:from-[#601625]/40 hover:to-[#751a29]/40 transition-all duration-200 border border-[#601625]/10"
              onClick={() => {
                const scrollPosition = (index * columnWidth * staff.length) / 8
                const h = headerScrollRef.current
                const b = columnsScrollRef.current
                if (h) h.scrollTo({ left: scrollPosition, behavior: 'smooth' })
                if (b) b.scrollTo({ left: scrollPosition, behavior: 'smooth' })
              }}
            />
          ))}
        </div>
      </div>
      
      <button
        className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-[#601625]/10 transition-all duration-200 border border-[#601625]/20 text-[#601625]"
        onClick={() => {
          const delta = columnWidth*3
          const h = headerScrollRef.current
          const b = columnsScrollRef.current
          if (h) h.scrollBy({ left: delta, behavior: 'smooth' })
          if (b) b.scrollBy({ left: delta, behavior: 'smooth' })
        }}
        aria-label="Scroll right"
      >
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  </div>
)}
    <div className="bg-background rounded-xl border border-[#601625]/20 shadow-sm overflow-hidden w-full">
      
      {/* Header - Sticky time column + scrollable staff columns */}
      <div className="sticky top-0 z-20 bg-gradient-to-r from-[#601625]/5 to-[#751a29]/5 border-b border-[#601625]/20 flex w-full items-center">
        {/* Sticky Time Header */}
        <div className="w-[120px] p-4 border-r border-[#601625]/20 font-semibold text-sm bg-[#601625]/10 flex items-center justify-center flex-shrink-0 text-[#601625]">
          
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
                <div key={staffMember.ghl_id} className="w-[220px] p-4 border-r last:border-r-0 border-[#601625]/20 bg-background flex-shrink-0" style={{ width: `${columnWidth}px` }}>
                  <div className="text-center">
                    <div className="font-medium text-sm truncate mb-1 text-[#601625]" title={staffMember.name}>
                      {staffMember.name}
                    </div>
                    <div className="text-xs text-[#751a29]/70">
                      {appts.length} appointments
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      
      </div>

      {/* Scrollable Time grid container */}
      <div className="max-h-[600px] overflow-y-auto w-full pt-2 pb-6" ref={scrollContainerRef}>
        <div className="flex w-full" style={{ height: `${(timeSlots.length * 60) + GRID_TOP_PADDING + GRID_BOTTOM_PADDING}px` }}>
          {/* Sticky Time column */}
          <div className="w-[120px] border-r bg-muted/30 flex-shrink-0 relative">
            {timeSlots.map((time, index) => (
              <div
                key={time}
                className="absolute left-0 right-0 border-b border-border/50 px-3 flex items-center justify-end"
                style={{ 
                  top: `${GRID_TOP_PADDING + index * 60}px`, 
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
            <div className="flex relative" style={{ minWidth: `${staff.length * columnWidth}px`, height: `${timeSlots.length * 60 + GRID_TOP_PADDING + GRID_BOTTOM_PADDING}px` }}>
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
                        top: `${GRID_TOP_PADDING + index * 60}px`, 
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
                        className="absolute left-0 right-0 border-t-2 border-primary z-20"
                        style={{ top: `${currentTimePosition}px` }}
                      >
                        <div className="absolute -left-1 -top-1 w-2 h-2 bg-primary rounded-full"></div>
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

                    const duration = appointment.startTime && appointment.endTime 
                      ? (new Date(appointment.endTime).getTime() - new Date(appointment.startTime).getTime()) / (1000 * 60)
                      : 30
                    
                    // Determine if this is a short appointment (30 mins or less)
                    const isShortAppointment = duration <= 30
                    
                    return (
                      <div
                        key={appointment.id}
                        className={`group absolute rounded-md cursor-pointer transition-all duration-200 hover:shadow-lg border-l-4 backdrop-blur-sm overflow-hidden ${
                          appointment.appointment_status === 'cancelled'
                            ? 'border-l-gray-300 bg-gray-100/60 hover:bg-gray-200/80 opacity-60 cursor-default'
                            : 'border-l-[#601625] bg-gradient-to-r from-[#601625]/10 to-[#751a29]/10 hover:from-[#601625]/20 hover:to-[#751a29]/20'
                        } ${isShortAppointment ? 'px-2 py-1' : 'px-3 py-2'}`}
                        style={style}
                        onClick={() => appointment.appointment_status !== 'cancelled' && onAppointmentClick(appointment)}
                        title={`${appointment.serviceName} - ${appointment.contactName}\n${appointment.startTime && formatTime(appointment.startTime)}${appointment.endTime && ` - ${formatTime(appointment.endTime)}`}${appointment.appointment_status === 'cancelled' ? '\n(Cancelled)' : ''}\nClick for details`}
                      >
                        {/* Service name - always show for proper identification */}
                        <div className={`font-medium truncate leading-tight ${
                          appointment.appointment_status === 'cancelled' 
                            ? 'text-gray-500 line-through' 
                            : 'text-[#601625]'
                        } ${isShortAppointment ? 'text-[10px]' : 'text-xs'}`}>
                          {appointment.serviceName}
                        </div>
                        
                        {!isShortAppointment && (
                          <div className="text-[10px] text-[#751a29]/70 truncate mt-0.5">
                            {appointment.contactName}
                          </div>
                        )}
                        
                        {/* Status indicator - only show paid when applicable */}
                        {appointment.payment_status === 'paid' && (
                          <div className="absolute top-1 right-1">
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500 text-white font-medium">
                              PAID
                            </span>
                          </div>
                        )}
                        
                        {/* Hover overlay with full details */}
                        <div className="absolute inset-0 bg-[#601625]/95 text-white p-2 rounded-md opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-30 flex flex-col justify-center">
                          <div className="text-xs font-medium truncate mb-1">
                            {appointment.serviceName}
                          </div>
                          <div className="text-xs truncate mb-1">
                            {appointment.contactName}
                          </div>
                          <div className="text-xs text-white/80 mb-2">
                            {appointment.startTime && formatTime(appointment.startTime)}
                            {appointment.endTime && ` - ${formatTime(appointment.endTime)}`}
                          </div>
                          <div className="flex items-center justify-end">
                            {appointment.payment_status === 'paid' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200">
                                PAID
                              </span>
                            )}
                            {appointment.appointment_status === 'cancelled' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-200 ml-2">
                                CANCELLED
                              </span>
                            )}
                          </div>
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
  const { data: appointments, loading, refresh } = useAppointments()
  const { user } = useUser()
  const [currentDate, setCurrentDate] = React.useState(new Date())
  const [view, setView] = React.useState<CalendarView>('day')
  const [selectedAppointment, setSelectedAppointment] = React.useState<Appointment | null>(null)
  const [detailsOpen, setDetailsOpen] = React.useState(false)
  const [staffView, setStaffView] = React.useState(true) // Default to staff view only
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

  // Cancel booking state
  const [cancelConfirmOpen, setCancelConfirmOpen] = React.useState(false)
  const [bookingToCancel, setBookingToCancel] = React.useState<Appointment | null>(null)
  const [cancelLoading, setCancelLoading] = React.useState(false)

  // Reschedule state
  const [rescheduleOpen, setRescheduleOpen] = React.useState(false)
  const [bookingToReschedule, setBookingToReschedule] = React.useState<Appointment | null>(null)
  const [rescheduleLoading, setRescheduleLoading] = React.useState(false)
  
  // Reschedule form data
  const [selectedStaff, setSelectedStaff] = React.useState<string>("")
  const [staffOptions, setStaffOptions] = React.useState<Array<{
    label: string;
    value: string;
    badge?: string;
    icon?: string;
  }>>([{
    label: 'Any available staff',
    value: 'any',
    badge: 'Recommended',
    icon: 'user'
  }])
  const [selectedDate, setSelectedDate] = React.useState<string>("")
  const [selectedTime, setSelectedTime] = React.useState<string>("")
  const [availableDates, setAvailableDates] = React.useState<Array<{
    dateString: string;
    dayName: string;
    dateDisplay: string;
    label?: string;
    date: Date;
  }>>([])
  const [availableSlots, setAvailableSlots] = React.useState<Array<{
    time: string;
    isPast: boolean;
  }>>([])
  const [loadingStaff, setLoadingStaff] = React.useState(false)
  const [loadingSlots, setLoadingSlots] = React.useState(false)
  const [workingSlots, setWorkingSlots] = React.useState<Record<string, string[]>>({})

  // Helper function to check if appointment is within 2 hours
  const isWithinTwoHours = (startTimeString?: string) => {
    if (!startTimeString) return false
    const start = new Date(startTimeString)
    const now = new Date()
    return start.getTime() <= now.getTime() + 2 * 60 * 60 * 1000
  }

  // Helper function to check if appointment has ended
  const isAppointmentEnded = (endTimeString?: string) => {
    if (!endTimeString) return false
    const end = new Date(endTimeString)
    const now = new Date()
    return now.getTime() > end.getTime()
  }

  // Helper functions for reschedule
  const getTimeZoneOffsetInMs = (timeZone: string, utcDate: Date) => {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
    const parts = dtf.formatToParts(utcDate)
    const map: Record<string, string> = {}
    for (const p of parts) {
      if (p.type !== 'literal') map[p.type] = p.value
    }
    const asUTC = Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      Number(map.hour),
      Number(map.minute),
      Number(map.second)
    )
    return asUTC - utcDate.getTime()
  }

  const denverWallTimeToUtcIso = (year: number, month: number, day: number, hour: number, minute: number) => {
    const baseUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0))
    const offset = getTimeZoneOffsetInMs('America/Denver', baseUtc)
    return new Date(baseUtc.getTime() - offset).toISOString()
  }

  const isSlotInPast = (slotTime: string, dateString: string) => {
    const now = new Date()
    const [year, month, day] = dateString.split('-').map(Number)
    const slotDate = new Date(year, month - 1, day)
    
    const timeMatch = slotTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
    if (!timeMatch) return false
    
    let hour = parseInt(timeMatch[1])
    const minute = parseInt(timeMatch[2])
    const period = timeMatch[3].toUpperCase()
    
    if (period === 'PM' && hour !== 12) hour += 12
    if (period === 'AM' && hour === 12) hour = 0
    
    slotDate.setHours(hour, minute, 0, 0)
    return slotDate < now
  }

  // Cancel appointment function
  const handleCancelAppointment = async (appointment: Appointment) => {
    if (isWithinTwoHours(appointment.startTime)) {
      toast.error("Cannot cancel - appointment starts within 2 hours")
      return
    }
    if (isAppointmentEnded(appointment.endTime)) {
      toast.error("Cannot cancel - appointment has already ended")
      return
    }
    setBookingToCancel(appointment)
    setCancelConfirmOpen(true)
  }

  const confirmCancelAppointment = async () => {
    if (!bookingToCancel) return
    
    setCancelLoading(true)
    try {
      const res = await fetch("https://restyle-api.netlify.app/.netlify/functions/cancelbooking", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bookingId: bookingToCancel.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Cancel failed")
      
      // Refresh appointments
      await refresh()
      toast.success("Appointment cancelled successfully")
      setCancelConfirmOpen(false)
      setBookingToCancel(null)
      setDetailsOpen(false)
      setSelectedAppointment(null)
    } catch (error) {
      console.error(error)
      toast.error(`Cancellation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setCancelLoading(false)
    }
  }

  // Reschedule appointment function
  const handleRescheduleAppointment = async (appointment: Appointment) => {
    if (isWithinTwoHours(appointment.startTime)) {
      toast.error("Cannot reschedule - appointment starts within 2 hours")
      return
    }
    if (isAppointmentEnded(appointment.endTime)) {
      toast.error("Cannot reschedule - appointment has already ended")
      return
    }
    
    setBookingToReschedule(appointment)
    setSelectedStaff(appointment.assigned_user_id || "any")
    setSelectedDate("")
    setSelectedTime("")
    setRescheduleOpen(true)
    setDetailsOpen(false)
  }

  const fetchStaffOptions = async () => {
    if (!rescheduleOpen || !bookingToReschedule?.calendar_id) return
    
    setLoadingStaff(true)
    const controller = new AbortController()
    
    try {
      // Use the same API as checkout to get service details with team members
      const serviceRes = await fetch(`/api/services?groupId=${bookingToReschedule.groupId || 'default'}`, { signal: controller.signal })
      const serviceData = await serviceRes.json()
      
      // Find the specific service by matching calendar_id with service id
      const serviceObj = (serviceData.services || []).find((s: { id: string }) => s.id === bookingToReschedule.calendar_id)
      const teamMembers = serviceObj?.teamMembers || []

      console.log('Service found:', serviceObj?.name)
      console.log('Team members:', teamMembers)

      // Start with "Any available staff" option
      const items = [{
        label: 'Any available staff',
        value: 'any',
        badge: 'Recommended',
        icon: 'user'
      }]

      // Fetch staff data to get names for team members
      const staffDataRes = await fetch('/api/barber-hours', { signal: controller.signal })
      const staffDataJson = await staffDataRes.json()
      const allStaffData = staffDataJson.ok ? (staffDataJson.data || []) : []

      // Create staff map for quick lookup
      const staffMap: Record<string, string> = {}
      allStaffData.forEach((staff: Record<string, string>) => {
        const id = staff['ghl_id']
        const name = staff['Barber/Name']
        if (id) staffMap[id] = name || id
      })

      // Add staff members assigned to this service (like checkout "Available Staff" tab)
      const assignedStaff = teamMembers.map((member: { userId: string; priority?: number; selected?: boolean }) => {
        const staffName = staffMap[member.userId] || `Staff ${member.userId}`
        return {
          label: staffName,
          value: member.userId,
          icon: 'user'
        }
      }).filter((staff: { label: string; value: string; icon: string }) => staff.label !== `Staff ${staff.value}`) // Filter out staff without names

      const allStaffOptions = [...items, ...assignedStaff]
      
      console.log('Final staff options:', allStaffOptions)
      
      if (rescheduleOpen) {
        setStaffOptions(allStaffOptions)
      }
    } catch (error) {
      if (!controller.signal.aborted && rescheduleOpen) {
        console.error('Error fetching staff options:', error)
        setStaffOptions([{
          label: 'Any available staff',
          value: 'any',
          badge: 'Recommended',
          icon: 'user'
        }])
      }
    } finally {
      if (rescheduleOpen) {
        setLoadingStaff(false)
      }
    }
  }

  const fetchAvailableDates = async () => {
    if (!bookingToReschedule?.calendar_id || !rescheduleOpen) return
    
    setLoadingSlots(true)
    const controller = new AbortController()
    
    try {
      const userId = selectedStaff && selectedStaff !== 'any' ? selectedStaff : null
      let apiUrl = `https://restyle-api.netlify.app/.netlify/functions/staffSlots?calendarId=${bookingToReschedule.calendar_id}`
      if (userId) {
        apiUrl += `&userId=${userId}`
      }
      
      const response = await fetch(apiUrl, { signal: controller.signal })
      const data = await response.json()
      
      if (data.slots) {
        const workingDates = Object.keys(data.slots).sort()
        
        const dates = workingDates.map((dateString) => {
          const [year, month, day] = dateString.split('-').map(Number)
          const date = new Date(year, month - 1, day)
          
          const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
          const dateDisplay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          
          return {
            dateString,
            dayName,
            dateDisplay,
            label: '',
            date
          }
        })
        
        if (rescheduleOpen) {
          setAvailableDates(dates)
          setWorkingSlots(data.slots)
          
          // Auto-select first future date
          const today = new Date().toISOString().split('T')[0]
          const firstFutureDate = dates.find(d => d.dateString >= today)
          if (firstFutureDate) {
            setSelectedDate(firstFutureDate.dateString)
            fetchSlotsForDate(firstFutureDate.dateString, data.slots)
          }
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error('Error fetching dates:', error)
      }
    } finally {
      if (rescheduleOpen) {
        setLoadingSlots(false)
      }
    }
  }

  const fetchSlotsForDate = (dateString: string, workingSlots: Record<string, string[]>) => {
    if (workingSlots[dateString]) {
      const slotsForSelectedDate = workingSlots[dateString]
      const slotsWithStatus = slotsForSelectedDate.map((slot: string) => ({
        time: slot,
        isPast: isSlotInPast(slot, dateString)
      }))
      
      const availableSlots = slotsWithStatus.filter((slot) => !slot.isPast)
      setAvailableSlots(availableSlots)
    } else {
      setAvailableSlots([])
    }
  }

  const confirmReschedule = async () => {
    if (!bookingToReschedule || !selectedDate || !selectedTime) return
    
    setRescheduleLoading(true)
    try {
      const jsDate = new Date(selectedDate + 'T00:00:00')
      const timeMatch = selectedTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
      
      if (timeMatch) {
        let hour = parseInt(timeMatch[1])
        const minute = parseInt(timeMatch[2])
        const period = timeMatch[3].toUpperCase()
        
        if (period === 'PM' && hour !== 12) hour += 12
        if (period === 'AM' && hour === 12) hour = 0
        
        jsDate.setHours(hour, minute, 0, 0)
        const localStartTime = jsDate
        
        // Calculate end time based on original duration
        const originalStart = new Date(bookingToReschedule.startTime!)
        const originalEnd = new Date(bookingToReschedule.endTime!)
        const duration = originalEnd.getTime() - originalStart.getTime()
        const localEndTime = new Date(localStartTime.getTime() + duration)
        
        // Determine assignedUserId
        let assignedUserIdToSend = selectedStaff
        if (selectedStaff === 'any') {
          const realStaff = staffOptions.filter(item => item.value !== 'any')
          if (realStaff.length > 0) {
            assignedUserIdToSend = realStaff[0].value
          } else if (bookingToReschedule.assigned_user_id) {
            assignedUserIdToSend = bookingToReschedule.assigned_user_id
          }
        }

        if (!assignedUserIdToSend || assignedUserIdToSend === 'any') {
          throw new Error('A team member needs to be selected')
        }

        let updateUrl = `https://restyle-api.netlify.app/.netlify/functions/updateappointment?appointmentId=${bookingToReschedule.id}`
        updateUrl += `&assignedUserId=${assignedUserIdToSend}`
        
        // Convert to UTC ISO
        const y1 = localStartTime.getFullYear()
        const m1 = localStartTime.getMonth() + 1
        const d1 = localStartTime.getDate()
        const h1 = localStartTime.getHours()
        const min1 = localStartTime.getMinutes()
        const startTimeFormatted = denverWallTimeToUtcIso(y1, m1, d1, h1, min1)
        const y2 = localEndTime.getFullYear()
        const m2 = localEndTime.getMonth() + 1
        const d2 = localEndTime.getDate()
        const h2 = localEndTime.getHours()
        const min2 = localEndTime.getMinutes()
        const endTimeFormatted = denverWallTimeToUtcIso(y2, m2, d2, h2, min2)
        
        updateUrl += `&startTime=${encodeURIComponent(startTimeFormatted)}`
        updateUrl += `&endTime=${encodeURIComponent(endTimeFormatted)}`
        
        const response = await fetch(updateUrl)
        const data = await response.json()
        
        if (data.message && data.message.includes('successfully')) {
          toast.success("Appointment rescheduled successfully")
          setRescheduleOpen(false)
          resetRescheduleForm()
          await refresh()
        } else {
          throw new Error(data.error || 'Reschedule failed')
        }
      }
    } catch (error) {
      console.error('Reschedule error:', error)
      toast.error(`Reschedule failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setRescheduleLoading(false)
    }
  }

  const resetRescheduleForm = () => {
    setBookingToReschedule(null)
    setSelectedStaff("")
    setSelectedDate("")
    setSelectedTime("")
    setAvailableDates([])
    setAvailableSlots([])
    setWorkingSlots({})
  }

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

  // Effect to fetch staff when reschedule dialog opens
  React.useEffect(() => {
    if (rescheduleOpen) {
      fetchStaffOptions()
    }
  }, [rescheduleOpen])

  // Effect to fetch dates when staff changes
  React.useEffect(() => {
    if (rescheduleOpen && selectedStaff && bookingToReschedule) {
      setWorkingSlots({})
      setAvailableDates([])
      setAvailableSlots([])
      setSelectedDate("")
      setSelectedTime("")
      fetchAvailableDates()
    }
  }, [selectedStaff, rescheduleOpen, bookingToReschedule])

  // Effect to fetch slots when date changes
  React.useEffect(() => {
    if (selectedDate && workingSlots && Object.keys(workingSlots).length > 0) {
      fetchSlotsForDate(selectedDate, workingSlots)
    }
  }, [selectedDate, workingSlots])

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

          <div className="flex flex-1 flex-col gap-4 p-4 pt-0 h-full overflow-hidden">
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
                    {/* View type selectors */}
                    <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
                      <Button
                        variant={view === 'day' ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setView('day')}
                        className="h-7 text-xs"
                      >
                        Day
                      </Button>
                      <Button
                        variant={view === 'month' ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setView('month')}
                        className="h-7 text-xs"
                      >
                        Month
                      </Button>
                      <Button
                        variant={view === 'year' ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setView('year')}
                        className="h-7 text-xs"
                      >
                        Year
                      </Button>
                    </div>
                    <button
                      className="inline-flex h-8 w-8 items-center justify-center rounded border"
                      title="Refresh (bypass cache)"
                      onClick={() => refresh()}
                    >
                      <RefreshCcw className="h-4 w-4" />
                    </button>
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
                  <Card className="flex-1">
                    <CardContent className="p-6 h-full">
                      {isSalonDayOff(currentDate) ? (
                        <div className="text-center py-12 text-red-600">
                          <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p className="font-medium">Salon is closed today</p>
                          <p className="text-sm text-muted-foreground mt-2">No bookings available</p>
                        </div>
                      ) : (
                        <>
                          {/* Staff View Only */}
                          {(user?.role === 'admin' || user?.role === 'manager' || user?.role === 'barber') ? (
                            <StaffOverviewView 
                              appointments={dayAppointments} 
                              user={user} 
                              onAppointmentClick={(appointment) => {
                                setSelectedAppointment(appointment)
                                setDetailsOpen(true)
                              }}
                            />
                          ) : (
                            <div className="text-center py-12 text-muted-foreground">
                              <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                              <p>Access restricted. Please contact your administrator.</p>
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

          {/* Appointment Details Dialog */}
          <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
            <SheetContent side="right" className="w-full sm:max-w-lg bg-white">
              <SheetHeader className="pb-4">
                <SheetTitle className="text-lg font-semibold text-[#601625]">
                  Appointment Details
                </SheetTitle>
                <SheetDescription className="text-gray-600">
                  View and manage this appointment
                </SheetDescription>
              </SheetHeader>
              
              {selectedAppointment && (
                <div className="space-y-6">
                  {/* Streamlined Appointment Card */}
                  <div className="p-5 bg-gradient-to-r from-[#601625]/5 to-[#751a29]/5 border border-[#601625]/20 rounded-2xl space-y-4">
                    <div className="flex items-start gap-3">
                      <CalendarIcon className="h-5 w-5 text-[#601625] mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-[#601625] text-base leading-tight">
                          {selectedAppointment.serviceName || selectedAppointment.title}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {selectedAppointment.contactName}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-[#751a29] flex-shrink-0" />
                      <span className="font-medium text-gray-800">
                        {selectedAppointment.startTime && formatTime(selectedAppointment.startTime)}
                        {selectedAppointment.endTime && ` - ${formatTime(selectedAppointment.endTime)}`}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <UserIcon className="h-4 w-4 text-[#751a29] flex-shrink-0" />
                      <span className="text-gray-800">
                        with {selectedAppointment.assigned_user_id ? 
                          (staffMap[selectedAppointment.assigned_user_id] || 'Unknown Staff') : 
                          'Unassigned'
                        }
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <CalendarIcon className="h-4 w-4 text-[#751a29] flex-shrink-0" />
                      <span className="text-sm text-gray-600">
                        {selectedAppointment.startTime && formatDate(new Date(selectedAppointment.startTime))}
                      </span>
                    </div>
                  </div>
                  
                  {/* Status Badge */}
                  <div className="flex items-center justify-center">
                    <Badge 
                      variant={
                        selectedAppointment.appointment_status === 'confirmed' ? 'default' :
                        selectedAppointment.appointment_status === 'cancelled' ? 'destructive' :
                        'secondary'
                      }
                      className="px-4 py-1.5 text-sm font-medium"
                      style={{
                        backgroundColor: selectedAppointment.appointment_status === 'confirmed' ? '#601625' : undefined,
                        color: selectedAppointment.appointment_status === 'confirmed' ? 'white' : undefined
                      }}
                    >
                      {selectedAppointment.appointment_status || selectedAppointment.status || 'Unknown'}
                    </Badge>
                  </div>
                  
                  {/* Payment Section */}
                  {selectedAppointment.appointment_status === 'confirmed' && selectedAppointment.payment_status !== 'paid' && (
                    <Button 
                      className="w-full bg-gradient-to-r from-[#601625] to-[#751a29] hover:from-[#4a1119] hover:to-[#5e1521] text-white rounded-xl py-3 font-medium shadow-lg"
                      onClick={() => {
                        router.push(`/checkout?appointmentId=${selectedAppointment.id}&calendarId=${selectedAppointment.calendar_id}&staffId=${selectedAppointment.assigned_user_id}`)
                      }}
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      Checkout
                    </Button>
                  )}

                  {/* Paid Status Section */}
                  {selectedAppointment.payment_status === 'paid' && (
                    <div className="p-4 border border-green-200 bg-green-50 rounded-xl text-center">
                      <div className="flex items-center justify-center gap-2 text-green-700">
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-medium">Payment Completed</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-2">
                    {selectedAppointment.appointment_status === 'cancelled' ? (
                      <div className="flex-1 text-center py-3 text-sm text-gray-500 bg-gray-100 rounded-xl">
                        <X className="h-4 w-4 mx-auto mb-1" />
                        This appointment has been cancelled
                      </div>
                    ) : (
                      <>
                        <Button 
                          variant="outline"
                          className="flex-1 border-[#601625]/30 text-[#601625] hover:bg-[#601625]/5 hover:border-[#601625]/50 rounded-xl py-2.5 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => handleRescheduleAppointment(selectedAppointment)}
                          disabled={
                            selectedAppointment.appointment_status === 'cancelled' || 
                            cancelLoading || 
                            isWithinTwoHours(selectedAppointment.startTime) ||
                            isAppointmentEnded(selectedAppointment.endTime)
                          }
                        >
                          <RefreshCcw className="h-4 w-4 mr-2" />
                          {isAppointmentEnded(selectedAppointment.endTime) ? "Ended" : 
                           isWithinTwoHours(selectedAppointment.startTime) ? "Too Late" : "Reschedule"}
                        </Button>
                        <Button 
                          variant="outline"
                          className="flex-1 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 rounded-xl py-2.5 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => handleCancelAppointment(selectedAppointment)}
                          disabled={
                            selectedAppointment.appointment_status === 'cancelled' || 
                            cancelLoading || 
                            isWithinTwoHours(selectedAppointment.startTime) ||
                            isAppointmentEnded(selectedAppointment.endTime)
                          }
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {cancelLoading ? "Cancelling..." : 
                           isAppointmentEnded(selectedAppointment.endTime) ? "Ended" :
                           isWithinTwoHours(selectedAppointment.startTime) ? "Too Late" : "Cancel"}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </SheetContent>
          </Sheet>

          {/* Cancel Confirmation Dialog */}
          <Dialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
            <DialogContent className="bg-white rounded-2xl border-[#601625]/20">
              <DialogHeader>
                <DialogTitle className="text-[#601625] text-lg font-semibold">
                  Cancel Appointment
                </DialogTitle>
                <DialogDescription className="text-gray-600">
                  Are you sure you want to cancel this appointment? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-3 mt-6">
                <Button 
                  variant="outline" 
                  onClick={() => setCancelConfirmOpen(false)} 
                  className="flex-1 border-[#601625]/30 text-[#601625] hover:bg-[#601625]/5 rounded-xl py-2.5 font-medium"
                >
                  Keep Appointment
                </Button>
                <Button 
                  onClick={confirmCancelAppointment}
                  disabled={cancelLoading}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2.5 font-medium"
                >
                  {cancelLoading ? "Cancelling..." : "Cancel Appointment"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Reschedule Dialog */}
          <Dialog open={rescheduleOpen} onOpenChange={(open) => {
            setRescheduleOpen(open)
            if (!open) {
              resetRescheduleForm()
            }
          }}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl border-[#601625]/20">
              <DialogHeader>
                <DialogTitle className="text-[#601625] text-lg font-semibold">
                  Reschedule Appointment
                </DialogTitle>
                <DialogDescription className="text-gray-600">
                  Choose a new date and time for this appointment
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* Current Appointment Info */}
                {bookingToReschedule && (
                  <div className="p-4 bg-[#601625]/5 border border-[#601625]/20 rounded-xl">
                    <h4 className="font-semibold mb-3 text-[#601625]">Current Appointment Details</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">Service:</span>
                        <div className="text-gray-900">{bookingToReschedule.serviceName || bookingToReschedule.title}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Date & Time:</span>
                        <div className="text-gray-900">
                          {bookingToReschedule.startTime && formatDate(new Date(bookingToReschedule.startTime))} at {bookingToReschedule.startTime && formatTime(bookingToReschedule.startTime)}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Staff:</span>
                        <div className="text-gray-900">
                          {bookingToReschedule.assigned_user_id ? 
                            (staffMap[bookingToReschedule.assigned_user_id] || 'Unknown Staff') : 
                            'Unassigned'
                          }
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Customer:</span>
                        <div className="text-gray-900">{bookingToReschedule.contactName}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Staff Selection */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-[#601625]">Select Staff Member</Label>
                  {loadingStaff ? (
                    <Skeleton className="h-12 w-full" />
                  ) : (
                    <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                      <SelectTrigger className="w-full border-[#601625]/30 focus:border-[#601625] focus:ring-[#601625]/20">
                        <SelectValue placeholder="Choose a staff member" />
                      </SelectTrigger>
                      <SelectContent>
                        {staffOptions.map((staff) => (
                          <SelectItem key={staff.value} value={staff.value}>
                            <div className="flex items-center gap-2">
                              <UserIcon className="h-4 w-4" />
                              {staff.label}
                              {staff.badge && (
                                <Badge variant="secondary" className="text-xs bg-[#601625]/10 text-[#601625]">
                                  {staff.badge}
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Date Selection */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-[#601625]">Select Date</Label>
                    {loadingSlots ? (
                      <div className="h-60 rounded-xl bg-gray-100 animate-pulse border" />
                    ) : (
                      <div className="border border-[#601625]/20 rounded-xl p-4 max-h-60 overflow-y-auto">
                        <div className="grid grid-cols-7 gap-2 text-xs">
                          {availableDates.map((date) => (
                            <div
                              key={date.dateString}
                              onClick={() => setSelectedDate(date.dateString)}
                              className={`p-3 text-center cursor-pointer rounded-lg transition-colors ${
                                selectedDate === date.dateString
                                  ? 'bg-[#601625] text-white'
                                  : 'hover:bg-[#601625]/10 text-gray-700'
                              }`}
                            >
                              <div className="font-medium">{date.dayName}</div>
                              <div className="text-xs opacity-80">{date.dateDisplay}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Time Selection */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-[#601625]">Select Time</Label>
                    {selectedDate ? (
                      <div className="border border-[#601625]/20 rounded-xl p-4 max-h-60 overflow-y-auto">
                        <div className="grid grid-cols-2 gap-2">
                          {availableSlots.map((slot) => (
                            <Button
                              key={slot.time}
                              variant={selectedTime === slot.time ? "default" : "ghost"}
                              size="sm"
                              onClick={() => setSelectedTime(slot.time)}
                              className={`text-xs justify-center rounded-lg ${
                                selectedTime === slot.time 
                                  ? "bg-[#601625] text-white hover:bg-[#751a29]" 
                                  : "hover:bg-[#601625]/10 text-gray-700"
                              }`}
                            >
                              {slot.time}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="h-60 rounded-xl border-2 border-dashed border-[#601625]/20 flex items-center justify-center text-gray-500">
                        Select a date first
                      </div>
                    )}
                  </div>
                </div>

                {/* Summary */}
                {selectedDate && selectedTime && selectedStaff && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                    <h4 className="font-medium mb-3 text-green-800">New Appointment Summary</h4>
                    <div className="grid grid-cols-3 gap-4 text-sm text-green-700">
                      <div>
                        <span className="font-medium">Staff:</span> {staffOptions.find(s => s.value === selectedStaff)?.label}
                      </div>
                      <div>
                        <span className="font-medium">Date:</span> {(() => {
                          // Parse date safely to avoid timezone issues
                          const [year, month, day] = selectedDate.split('-').map(Number)
                          const date = new Date(year, month - 1, day)
                          return date.toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            month: 'short', 
                            day: 'numeric' 
                          })
                        })()}
                      </div>
                      <div>
                        <span className="font-medium">Time:</span> {selectedTime}
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setRescheduleOpen(false)}
                    disabled={rescheduleLoading}
                    className="border-[#601625]/30 text-[#601625] hover:bg-[#601625]/5 rounded-xl"
                  >
                    Cancel
                  </Button>
                  
                  <Button
                    onClick={confirmReschedule}
                    disabled={!selectedDate || !selectedTime || !selectedStaff || rescheduleLoading}
                    className="bg-[#601625] hover:bg-[#751a29] text-white rounded-xl"
                  >
                    {rescheduleLoading ? 'Rescheduling...' : 'Confirm Reschedule'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </SidebarInset>
      </SidebarProvider>
    </RoleGuard>
  )
}
