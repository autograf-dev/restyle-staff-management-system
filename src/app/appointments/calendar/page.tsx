"use client"
import * as React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { RoleGuard } from "@/components/role-guard"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"

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
function useAppointments(view: CalendarView, currentDate: Date) {
  const [data, setData] = React.useState<Appointment[]>([])
  const [loading, setLoading] = React.useState<boolean>(true)
  const [lastUpdated, setLastUpdated] = React.useState<number>(0)

  const fetchAppointments = React.useCallback(async (forceRefresh: boolean = false) => {
      setLoading(true)
      try {
        // Calculate date range in America/Denver wall time based on view
        let startDate: string | undefined
        let endDate: string | undefined
        
        if (view === 'day') {
          const y = currentDate.getFullYear()
          const m = currentDate.getMonth() + 1
          const d = currentDate.getDate()
          // Denver midnight to 23:59
          startDate = convertDenverWallTimeToUtcIso(y, m, d, 0, 0)
          endDate = convertDenverWallTimeToUtcIso(y, m, d, 23, 59)
        } else if (view === 'month') {
          const y = currentDate.getFullYear()
          const m = currentDate.getMonth() + 1
          const firstDay = 1
          const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
          startDate = convertDenverWallTimeToUtcIso(y, m, firstDay, 0, 0)
          endDate = convertDenverWallTimeToUtcIso(y, m, lastDay, 23, 59)
        } else if (view === 'year') {
          const y = currentDate.getFullYear()
          startDate = convertDenverWallTimeToUtcIso(y, 1, 1, 0, 0)
          endDate = convertDenverWallTimeToUtcIso(y, 12, 31, 23, 59)
        }
        // For all views we now use explicit date range
        
        // Cache key includes view and date for proper cache separation
        const cacheKey = `restyle.calendar.appointments.${view}.${currentDate.toDateString()}`
        
        // Cache read (10 min TTL) - temporarily disabled for debugging
        try {
          const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null') as { data: Appointment[]; fetchedAt: number } | null
          const ttl = 10 * 60 * 1000
          // Force refresh to bypass cache during debugging
          if (!forceRefresh && cached && Date.now() - cached.fetchedAt < ttl && false) {
            setData(cached?.data || [])
            setLastUpdated(cached?.fetchedAt || Date.now())
            setLoading(false)
            console.log(`📅 Calendar ${view}: Using cached data (${cached?.data?.length || 0} appointments)`)
            return
          } else if (cached) {
            console.log(`📅 Calendar ${view}: Bypassing cache (had ${cached.data?.length || 0} appointments, age: ${Math.round((Date.now() - cached.fetchedAt) / 60000)} min)`)
          }
        } catch {}

        // Build API URL with date filtering for all views
        let apiUrl = '/api/bookings?'
        const params = new URLSearchParams()
        
        if (startDate && endDate) {
          params.append('startDate', startDate)
          params.append('endDate', endDate)
          // Use a generous limit to include all appointments in range
          params.append('pageSize', view === 'year' ? '20000' : '5000')
          console.log(`📅 Calendar ${view}: Fetching appointments for date range ${startDate} to ${endDate}`)
        }
        params.append('page', '1')
        
        apiUrl += params.toString()
        
        console.log(`📅 Calendar ${view}: Fetching from ${apiUrl}`)
        const res = await fetch(apiUrl)
        
        if (!res.ok) {
          const errorText = await res.text()
          console.error('📅 Calendar: API Error:', res.status, errorText)
          throw new Error(`Failed to fetch appointments: ${res.status} - ${errorText}`)
        }
        
        const json = await res.json()
        const allBookings = json?.bookings || []
        const total = json?.total || 0
        
        console.log(`📅 Calendar: Fetched ${allBookings.length} of ${total} total appointments`)
        console.log('📅 Calendar: Sample booking:', allBookings[0])
        
        // Map the API response data to Appointment format
        const appointments: Appointment[] = allBookings.map((booking: {
          id?: string;
          calendar_id?: string;
          contact_id?: string;
          title?: string;
          status?: string;
          appointment_status?: string;
          assigned_user_id?: string;
          address?: string;
          is_recurring?: boolean;
          trace_id?: string;
          serviceName?: string;
          startTime?: string;
          endTime?: string;
          assignedStaffFirstName?: string;
          assignedStaffLastName?: string;
          contactName?: string;
          contactPhone?: string;
          durationMinutes?: number;
          payment_status?: string;
        }) => {
          // Calculate endTime from startTime + durationMinutes if endTime is missing
          let calculatedEndTime = booking.endTime
          if (!calculatedEndTime && booking.startTime && booking.durationMinutes) {
            const startDate = new Date(booking.startTime)
            const endDate = new Date(startDate.getTime() + booking.durationMinutes * 60 * 1000)
            calculatedEndTime = endDate.toISOString()
          }
          
          return {
            id: String(booking.id || ""),
            calendar_id: String(booking.calendar_id || ""),
            contact_id: String(booking.contact_id || ""),
            title: booking.title || booking.serviceName || "",
            status: booking.status || "",
            appointment_status: booking.appointment_status || "",
            assigned_user_id: String(booking.assigned_user_id || ""),
            address: booking.address || "",
            is_recurring: Boolean(booking.is_recurring || false),
            trace_id: booking.trace_id || "",
            serviceName: booking.serviceName || booking.title || 'Untitled Service',
            // Use the startTime and calculated endTime
            startTime: booking.startTime,
            endTime: calculatedEndTime,
            // Use the enriched staff data from the API
            assignedStaffFirstName: booking.assignedStaffFirstName || "",
            assignedStaffLastName: booking.assignedStaffLastName || "",
            contactName: booking.contactName || "",
            contactPhone: booking.contactPhone || "",
            // Payment status from API response or default to pending
            payment_status: booking.payment_status || 'pending'
          }
        })
        
        console.log(`📅 Calendar: Mapped ${appointments.length} appointments`)
        
        // Filter appointments with valid start times - but be more lenient
        const filtered = appointments.filter(apt => {
          const hasStartTime = apt.startTime && apt.startTime.trim() !== ''
          if (!hasStartTime) {
            console.warn('📅 Calendar: Appointment missing startTime:', apt.id, apt.title)
          }
          return hasStartTime
        })
        
        console.log(`📅 Calendar: After filtering for startTime: ${filtered.length} appointments`)
        
        if (filtered.length > 0) {
          const dates = filtered.map(a => new Date(a.startTime!).getTime()).filter(t => !isNaN(t))
          if (dates.length > 0) {
            console.log(`📅 Calendar: Date range: ${new Date(Math.min(...dates)).toLocaleDateString()} to ${new Date(Math.max(...dates)).toLocaleDateString()}`)
          }
          
          // Sample some appointments for debugging
          console.log('📅 Calendar: Sample appointments:', filtered.slice(0, 3).map(a => ({
            id: a.id,
            title: a.title,
            startTime: a.startTime,
            serviceName: a.serviceName,
            contactName: a.contactName
          })))
        } else {
          console.warn('📅 Calendar: No appointments with valid start times found!')
          console.log('📅 Calendar: Sample raw bookings:', allBookings.slice(0, 3))
        }
        
        setData(filtered)
        const nowTs = Date.now()
        setLastUpdated(nowTs)
        try { 
          localStorage.setItem(cacheKey, JSON.stringify({ data: filtered, fetchedAt: nowTs })) 
        } catch {}
      } catch (error) {
        console.error(`📅 Calendar ${view}: Failed to fetch appointments:`, error)
        toast.error(`Failed to load appointments: ${error instanceof Error ? error.message : 'Unknown error'}`)
      } finally {
        setLoading(false)
      }
    }, [view, currentDate])

    React.useEffect(() => {
      fetchAppointments()
      const interval = setInterval(() => fetchAppointments(true), 10 * 60 * 1000)
      return () => clearInterval(interval)
    }, [fetchAppointments])

  const refresh = async () => { 
    try { 
      // Clear cache for all views/dates
      const keys = Object.keys(localStorage).filter(key => key.startsWith('restyle.calendar.appointments.'))
      keys.forEach(key => localStorage.removeItem(key))
      await fetchAppointments(true) // Force refetch
    } catch (error) {
      console.error('Error refreshing appointments:', error)
    }
  }
  return { data, loading, refresh, lastUpdated }
}

// Utility functions
function formatTime(dateString: string) {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date)
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date)
}

function getHourMinuteInTimeZone(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  const parts = dtf.formatToParts(date)
  const map: Record<string, string> = {}
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value
  }
  return {
    hour: Number(map.hour || '0'),
    minute: Number(map.minute || '0')
  }
}

function convertDenverWallTimeToUtcIso(year: number, month: number, day: number, hour: number, minute: number) {
  const baseUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0))
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = dtf.formatToParts(baseUtc)
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
  const offset = asUTC - baseUtc.getTime()
  return new Date(baseUtc.getTime() - offset).toISOString()
}

// Staff Overview Component - Acuity-style time grid calendar
const StaffOverviewView = ({ 
  appointments, 
  user, 
  currentDate,
  onAppointmentClick 
}: { 
  appointments: Appointment[], 
  user: User | null,
  currentDate: Date,
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
  // Minimal padding for the time grid
  const GRID_TOP_PADDING = 8
  const GRID_BOTTOM_PADDING = 16
  // Reduced hour slot height to fit everything in viewport (12 hours * 60px = 720px + padding = ~744px total)
  const HOUR_SLOT_HEIGHT = 60

  // Update current time every minute
  React.useEffect(() => {
    const updateTime = () => setCurrentTime(new Date())
    const interval = setInterval(updateTime, 60000) // Update every minute
    return () => clearInterval(interval)
  }, [])

  // Calculate current time position for live line
  const getCurrentTimePosition = () => {
    const now = currentTime
    const { hour, minute } = getHourMinuteInTimeZone(now, 'America/Denver')
    
    // Only show if within business hours (8 AM to 7 PM)
    if (hour < 8 || hour >= 19) return null
    
    const currentMinutes = hour * 60 + minute
    const dayStartMinutes = 8 * 60 // 8 AM
    const position = GRID_TOP_PADDING + ((currentMinutes - dayStartMinutes) / 60) * HOUR_SLOT_HEIGHT // Use reduced slot height
    
    return position
  }

  // Auto-scroll disabled for full-view calendar
  React.useEffect(() => {
    // No auto-scrolling since we want the entire calendar visible
  }, [staff])

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
            role: 'barber',
            workingHours: {
              monday: { start: barber["Monday/Start Value"], end: barber["Monday/End Value"] },
              tuesday: { start: barber["Tuesday/Start Value"], end: barber["Tuesday/End Value"] },
              wednesday: { start: barber["Wednesday/Start Value"], end: barber["Wednesday/End Value"] },
              thursday: { start: barber["Thursday/Start Value"], end: barber["Thursday/End Value"] },
              friday: { start: barber["Friday/Start Value"], end: barber["Friday/End Value"] },
              saturday: { start: barber["Saturday/Start Value"], end: barber["Saturday/End Value"] },
              sunday: { start: barber["Sunday/Start Value"], end: barber["Sunday/End Value"] }
            }
          }))

          // Debug: Log the first staff member's working hours
          if (staffMembers.length > 0) {
            console.log("📅 Staff working hours sample:", {
              staff: staffMembers[0].name,
              workingHours: staffMembers[0].workingHours,
              currentDate: currentDate,
              dayOfWeek: currentDate.getDay()
            })
            
            console.log("📅 All Staff Members loaded:", staffMembers.map((s: { name: string; ghl_id: string; role: string }) => ({
              name: s.name,
              ghl_id: s.ghl_id,
              role: s.role
            })))
            
            // Debug staff IDs vs appointment IDs for today
            const todayAppointments = appointments.filter(apt => {
              if (!apt.startTime) return false
              const aptDate = new Date(apt.startTime).toDateString()
              return aptDate === currentDate.toDateString()
            })
            
            if (todayAppointments.length > 0) {
              const appointmentStaffIds = todayAppointments.map((a: Appointment) => a.assigned_user_id)
              const staffGhlIds = staffMembers.map((s: { ghl_id: string }) => s.ghl_id)
              console.log("📅 Staff ID Matching Debug:", {
                appointmentStaffIds,
                staffGhlIds,
                matchingIds: appointmentStaffIds.filter((id: string) => staffGhlIds.includes(id)),
                missingStaffIds: appointmentStaffIds.filter((id: string) => !staffGhlIds.includes(id))
              })
            }
          }
          
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
        console.log('📅 Salon hours API response:', salonJson)
        if (salonJson.ok) {
          setSalonHours(salonJson.data || [])
          console.log('📅 Salon hours data set:', salonJson.data)
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user])

  // No auto-scroll since calendar is now fully visible
  React.useEffect(() => {
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

  // Generate time slots from 8:00 AM to 7:00 PM inclusive (hourly)
  const generateTimeSlots = () => {
    const slots: string[] = []
    // 8:00 AM → 7:00 PM (12 hours total)
    for (let hour = 8; hour <= 19; hour++) {
      slots.push(`${hour.toString().padStart(2,'0')}:00`)
    }
    return slots
  }

  const timeSlots = generateTimeSlots()
  
  // Debug: Log the first few time slots
  console.log(`📅 Time slots generated:`, timeSlots.slice(0, 10))

  // Helper function to get appointment position and height (8AM to 8PM range)
  const getAppointmentStyleImproved = (appointment: Appointment) => {
    if (!appointment.startTime || !appointment.endTime) {
      console.log(`📅 Appointment ${appointment.id} missing time:`, { startTime: appointment.startTime, endTime: appointment.endTime })
      return { display: 'none' }
    }
    
    const start = new Date(appointment.startTime)
    const end = new Date(appointment.endTime)
    const { hour: startHour, minute: startMinute } = getHourMinuteInTimeZone(start, 'America/Denver')
    const { hour: endHour, minute: endMinute } = getHourMinuteInTimeZone(end, 'America/Denver')
    
    // Calculate position from 8AM (480 minutes from midnight)
    const dayStartMinutes = 8 * 60 // 8 AM start
    const startMinutes = startHour * 60 + startMinute
    const endMinutes = endHour * 60 + endMinute
    
    // Only show appointments within 8AM-8PM range
    const dayEndMinutesExclusive = 20 * 60 // 8:00 PM end-of-day
    if (startMinutes < dayStartMinutes || startMinutes >= dayEndMinutesExclusive) {
      console.log(`📅 Appointment ${appointment.id} outside time range:`, {
        title: appointment.title,
        startTime: appointment.startTime,
        startMinutes,
        dayStartMinutes,
        dayEndMinutesExclusive,
        reason: startMinutes < dayStartMinutes ? 'before 8AM' : 'after 8PM'
      })
      return { display: 'none' }
    }
    
    const topOffset = GRID_TOP_PADDING + ((startMinutes - dayStartMinutes) / 60) * HOUR_SLOT_HEIGHT // Use reduced slot height
    const height = ((endMinutes - startMinutes) / 60) * HOUR_SLOT_HEIGHT
    
    console.log(`📅 Appointment ${appointment.id} positioned:`, {
      title: appointment.title,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      startMinutes,
      endMinutes,
      topOffset,
      height,
      assigned_user_id: appointment.assigned_user_id
    })
    
    return {
      position: 'absolute' as const,
      top: `${Math.max(0, topOffset)}px`,
      height: `${Math.max(30, height - 4)}px`,
      left: '4px',
      right: '4px',
      zIndex: 10
    }
  }

  // Get staff appointments for the current day
  const getStaffAppointments = (staffGhlId: string) => {
    // Filter from the appointments prop (already filtered to current day)
    const filtered = appointments.filter((apt: Appointment) => apt.assigned_user_id === staffGhlId)
    console.log(`📅 Staff Appointments Debug for ${staffGhlId}:`, {
      staffGhlId,
      currentDate: currentDate.toDateString(),
      totalAppointments: appointments.length,
      filteredAppointments: filtered.length,
      sampleFiltered: filtered.slice(0, 2).map((a: Appointment) => ({
        id: a.id,
        title: a.title,
        assigned_user_id: a.assigned_user_id,
        startTime: a.startTime
      }))
    })
    return filtered
  }

  // Get appointments for a specific staff member
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
    
    const topOffset = GRID_TOP_PADDING + ((startMinutes - dayStartMinutes) / 60) * HOUR_SLOT_HEIGHT // Use reduced slot height
    const height = ((endMinutes - startMinutes) / 60) * HOUR_SLOT_HEIGHT
    
    return {
      position: 'absolute' as const,
      top: `${Math.max(0, topOffset)}px`,
      height: `${Math.max(30, height - 4)}px`,
      left: '4px',
      right: '4px',
      zIndex: 5
    }
  }

  // Helper function to get staff working hours for current day
  const getStaffWorkingHours = (staffMember: { workingHours?: Record<string, { start: string | number | null, end: string | number | null }> }) => {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const currentDayName = dayNames[currentDate.getDay()]
    const workingDay = staffMember.workingHours?.[currentDayName]
    
    if (!workingDay || !workingDay.start || !workingDay.end || 
        workingDay.start === 0 || workingDay.end === 0 || 
        workingDay.start === '0' || workingDay.end === '0' ||
        workingDay.start === null || workingDay.end === null) {
      return null // Day off or no working hours set
    }

    // Convert minutes from midnight to hours for calculation
    const startMinutes = Number(workingDay.start)
    const endMinutes = Number(workingDay.end)
    
    return {
      startMinutes: startMinutes,
      endMinutes: endMinutes,
      startHour: startMinutes / 60,
      endHour: endMinutes / 60
    }
  }

  // Helper function to get salon working hours for current day
  const getSalonWorkingHours = () => {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const currentDayName = currentDate.getDay()
    const dayHours = salonHours.find(hour => hour.day_of_week === currentDayName)
    
    console.log(`📅 Salon hours debug:`, {
      currentDate: currentDate,
      currentDayName: currentDayName,
      dayHours: dayHours,
      allSalonHours: salonHours,
      lookingForDay: currentDayName
    })
    
    if (!dayHours || !dayHours.is_open || !dayHours.open_time || !dayHours.close_time) {
      console.log(`📅 Salon is closed for day ${currentDayName}`)
      return null // Salon is closed
    }

    const result = {
      startMinutes: dayHours.open_time,
      endMinutes: dayHours.close_time
    }
    
    console.log(`📅 Salon working hours:`, {
      openTime: `${Math.floor(dayHours.open_time/60)}:${(dayHours.open_time%60).toString().padStart(2,'0')}`,
      closeTime: `${Math.floor(dayHours.close_time/60)}:${(dayHours.close_time%60).toString().padStart(2,'0')}`,
      startMinutes: dayHours.open_time,
      endMinutes: dayHours.close_time
    })
    
    return result
  }

  // Helper function to check if staff member is on leave for current day
  const isStaffOnLeave = (staffGhlId: string) => {
    const dayLeaves = getStaffLeaves(staffGhlId)
    return dayLeaves.some(leave => {
      const start = new Date(leave["Event/Start"])
      const end = new Date(leave["Event/End"])
      const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate())
      const endDayExclusive = new Date(end.getFullYear(), end.getMonth(), end.getDate())
      const currentDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate())
      return currentDay >= startDay && currentDay < endDayExclusive
    })
  }

  // Helper function to get break periods for staff member on current day
  const getStaffBreakPeriods = (staffGhlId: string) => {
    const dayBreaks = getStaffBreaks(staffGhlId)
    const periods: { startMinutes: number, endMinutes: number }[] = []
    
    dayBreaks.forEach(breakItem => {
      const startTime = breakItem["Block/Start"]
      const endTime = breakItem["Block/End"]
      
      if (startTime && endTime) {
        // Break times are stored as minutes from midnight
        const startMinutes = parseInt(startTime)
        const endMinutes = parseInt(endTime)
        
        // Only include breaks within our calendar range (8AM-8PM)
        if (startMinutes >= 8 * 60 && endMinutes <= 20 * 60) {
          periods.push({ startMinutes, endMinutes })
        }
      }
    })
    
    return periods
  }

  // Helper function to get non-working time periods for a staff member
  const getNonWorkingPeriods = (staffMember: { workingHours?: Record<string, { start: string | number | null, end: string | number | null }>, name?: string, ghl_id?: string }) => {
    const periods: { startMinutes: number, endMinutes: number, type: string }[] = []
    const dayStartMinutes = 8 * 60 // Calendar starts at 8AM
    const dayEndMinutes = 20 * 60  // Gray area extends till 8PM (even though view ends at 7PM)

    // Check if staff member is on leave - grey out entire day
    if (staffMember.ghl_id && isStaffOnLeave(staffMember.ghl_id)) {
      console.log(`📅 ${staffMember.name} is on leave - greying entire day`)
      return [{
        startMinutes: 8 * 60, // 8AM
        endMinutes: 20 * 60,  // 8PM
        type: 'leave'
      }]
    }

    // Get salon working hours
    const salonHours = getSalonWorkingHours()
    
    // Get staff working hours
    const workingHours = getStaffWorkingHours(staffMember)
    
    // If salon is closed, grey out entire day
    if (!salonHours) {
      console.log(`📅 Salon is closed - greying entire day for ${staffMember.name}`)
      return [{
        startMinutes: 8 * 60, // 8AM
        endMinutes: 20 * 60,  // 8PM
        type: 'salon-closed'
      }]
    }

    // If staff has no working hours, grey out entire day
    if (!workingHours) {
      console.log(`📅 ${staffMember.name} has no working hours - greying entire day`)
      return [{
        startMinutes: 8 * 60, // 8AM
        endMinutes: 20 * 60,  // 8PM
        type: 'staff-off'
      }]
    }

    console.log(`📅 ${staffMember.name} working analysis:`, {
      salon: {
        hours: `${Math.floor(salonHours.startMinutes/60)}:${(salonHours.startMinutes%60).toString().padStart(2,'0')} - ${Math.floor(salonHours.endMinutes/60)}:${(salonHours.endMinutes%60).toString().padStart(2,'0')}`,
        minutes: `${salonHours.startMinutes} - ${salonHours.endMinutes}`
      },
      staff: {
        hours: `${Math.floor(workingHours.startMinutes/60)}:${(workingHours.startMinutes%60).toString().padStart(2,'0')} - ${Math.floor(workingHours.endMinutes/60)}:${(workingHours.endMinutes%60).toString().padStart(2,'0')}`,
        minutes: `${workingHours.startMinutes} - ${workingHours.endMinutes}`
      }
    })

    // Salon hours greying (before salon opens and after salon closes)
    console.log(`📅 Salon hours calculation for ${staffMember.name}:`, {
      dayStart: `${dayStartMinutes} (${Math.floor(dayStartMinutes/60)}:${(dayStartMinutes%60).toString().padStart(2,'0')})`,
      dayEnd: `${dayEndMinutes} (${Math.floor(dayEndMinutes/60)}:${(dayEndMinutes%60).toString().padStart(2,'0')})`,
      salonStart: `${salonHours.startMinutes} (${Math.floor(salonHours.startMinutes/60)}:${(salonHours.startMinutes%60).toString().padStart(2,'0')})`,
      salonEnd: `${salonHours.endMinutes} (${Math.floor(salonHours.endMinutes/60)}:${(salonHours.endMinutes%60).toString().padStart(2,'0')})`
    })
    
    if (salonHours.startMinutes > dayStartMinutes) {
      const beforeOpenPeriod = {
        startMinutes: dayStartMinutes,
        endMinutes: Math.min(salonHours.startMinutes, dayEndMinutes),
        type: 'salon-closed'
      }
      console.log(`📅 Adding before-open period:`, beforeOpenPeriod)
      periods.push(beforeOpenPeriod)
    }
    
    if (salonHours.endMinutes < dayEndMinutes) {
      const afterClosePeriod = {
        startMinutes: Math.max(salonHours.endMinutes, dayStartMinutes),
        endMinutes: dayEndMinutes,
        type: 'salon-closed'
      }
      console.log(`📅 Adding after-close period:`, {
        ...afterClosePeriod,
        timeRange: `${Math.floor(afterClosePeriod.startMinutes/60)}:${(afterClosePeriod.startMinutes%60).toString().padStart(2,'0')} - ${Math.floor(afterClosePeriod.endMinutes/60)}:${(afterClosePeriod.endMinutes%60).toString().padStart(2,'0')}`,
        shouldCover: "Should gray out entire area after salon closes"
      })
      periods.push(afterClosePeriod)
    }

    // Staff hours greying (before staff starts and after staff ends, but only within salon hours)
    // Only add staff-specific graying within salon operating hours
    const effectiveWorkStart = Math.max(workingHours.startMinutes, salonHours.startMinutes)
    const effectiveWorkEnd = Math.min(workingHours.endMinutes, salonHours.endMinutes)
    
    console.log(`📅 Staff hours calculation for ${staffMember.name}:`, {
      salonOpen: salonHours.startMinutes,
      salonClose: salonHours.endMinutes,
      staffStart: workingHours.startMinutes,
      staffEnd: workingHours.endMinutes,
      effectiveStart: effectiveWorkStart,
      effectiveEnd: effectiveWorkEnd
    })
    
    // Before staff starts (within salon hours only)
    if (effectiveWorkStart > salonHours.startMinutes) {
      const beforeStaffPeriod = {
        startMinutes: salonHours.startMinutes,
        endMinutes: effectiveWorkStart,
        type: 'staff-off'
      }
      console.log(`📅 Adding before-staff period:`, beforeStaffPeriod)
      periods.push(beforeStaffPeriod)
    }
    
    // After staff ends (within salon hours only)
    if (effectiveWorkEnd < salonHours.endMinutes) {
      const afterStaffPeriod = {
        startMinutes: effectiveWorkEnd,
        endMinutes: salonHours.endMinutes,
        type: 'staff-off'
      }
      console.log(`📅 Adding after-staff period:`, afterStaffPeriod)
      periods.push(afterStaffPeriod)
    }

    // Add break periods
    if (staffMember.ghl_id) {
      const breakPeriods = getStaffBreakPeriods(staffMember.ghl_id)
      if (breakPeriods.length > 0) {
        console.log(`📅 ${staffMember.name} has ${breakPeriods.length} break periods:`, breakPeriods)
      }
      periods.push(...breakPeriods.map(period => ({ ...period, type: 'break' })))
    }
    
    // Sort periods by start time 
    periods.sort((a, b) => a.startMinutes - b.startMinutes)
    
    // Simple approach - don't merge, just return all periods
    // Let CSS handle overlapping with z-index and opacity
    const finalPeriods = periods.filter(p => p.startMinutes < p.endMinutes)
    
    console.log(`📅 ${staffMember.name} non-working periods (final):`, finalPeriods.map(p => ({
      type: p.type,
      time: `${Math.floor(p.startMinutes/60)}:${(p.startMinutes%60).toString().padStart(2,'0')} - ${Math.floor(p.endMinutes/60)}:${(p.endMinutes%60).toString().padStart(2,'0')}`,
      startMinutes: p.startMinutes,
      endMinutes: p.endMinutes
    })))
    
    return finalPeriods
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
    <div className="bg-background rounded-xl border border-[#601625]/20 shadow-sm overflow-hidden w-full">
      
      {/* Horizontal scrolling navigation - moved to top of calendar */}
      {(user?.role === 'admin' || user?.role === 'manager') && (
        <div className="bg-gradient-to-r from-[#601625]/5 to-[#751a29]/5 border-b border-[#601625]/20 p-2 flex items-center gap-3">
          <button
            className="h-6 w-6 rounded-lg flex items-center justify-center hover:bg-[#601625]/10 transition-all duration-200 border border-[#601625]/20 text-[#601625] flex-shrink-0"
            onClick={() => {
              const delta = -columnWidth*3
              const h = headerScrollRef.current
              const b = columnsScrollRef.current
              if (h) h.scrollBy({ left: delta, behavior: 'smooth' })
              if (b) b.scrollBy({ left: delta, behavior: 'smooth' })
            }}
            aria-label="Scroll left"
          >
            <ArrowLeft className="h-3 w-3" />
          </button>
          
          <div className="flex-1 flex items-center gap-1 px-1">
            {staff.slice(0, 8).map((_, index) => (
              <div 
                key={index}
                className="h-1.5 bg-gradient-to-r from-[#601625]/20 to-[#751a29]/20 rounded-full flex-1 cursor-pointer hover:from-[#601625]/40 hover:to-[#751a29]/40 transition-all duration-200 border border-[#601625]/10"
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
          
          <button
            className="h-6 w-6 rounded-lg flex items-center justify-center hover:bg-[#601625]/10 transition-all duration-200 border border-[#601625]/20 text-[#601625] flex-shrink-0"
            onClick={() => {
              const delta = columnWidth*3
              const h = headerScrollRef.current
              const b = columnsScrollRef.current
              if (h) h.scrollBy({ left: delta, behavior: 'smooth' })
              if (b) b.scrollBy({ left: delta, behavior: 'smooth' })
            }}
            aria-label="Scroll right"
          >
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      )}
      
      {/* Header - Sticky time column + scrollable staff columns */}
      <div className="sticky top-0 z-20 bg-gradient-to-r from-[#601625]/5 to-[#751a29]/5 border-b border-[#601625]/20 flex w-full items-center">
        {/* Sticky Time Header */}
        <div className="w-[80px] p-4 border-r border-[#601625]/20 font-semibold text-sm bg-transparent flex items-center justify-center flex-shrink-0 text-[#601625]">
          
        </div>
        
        {/* Scrollable Staff Headers */}
        <div className="flex-1 overflow-x-auto" ref={headerScrollRef}>
          <div className="flex" style={{ minWidth: `${staff.length * columnWidth}px` }}>
            {staff.map((staffMember) => {
              const appts = getStaffAppointments(staffMember.ghl_id)
              // Build a compact list of time chips for that day
              const chips = appts
                .filter((a: Appointment) => a.startTime)
                .sort((a: Appointment, b: Appointment) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime())
                .slice(0,4) // show first 4
                .map((a: Appointment) => new Date(a.startTime!))
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

      {/* Fixed height Time grid container - no scrolling */}
      <div className="w-full pb-6" style={{ height: `${(12 * HOUR_SLOT_HEIGHT) + GRID_TOP_PADDING + GRID_BOTTOM_PADDING + 24}px` }} ref={scrollContainerRef}>
        <div className="flex w-full" style={{ height: `${(12 * HOUR_SLOT_HEIGHT) + GRID_TOP_PADDING + GRID_BOTTOM_PADDING}px` }}>
          {/* Sticky Time column */}
          <div className="w-[80px] border-r bg-muted/30 flex-shrink-0 relative">
            {timeSlots.map((time, index) => {
              return (
                <div
                  key={time}
                  className={"absolute left-0 right-0 px-2 flex items-center justify-end border-b border-border"}
                  style={{ 
                    top: `${GRID_TOP_PADDING + index * HOUR_SLOT_HEIGHT}px`, 
                    height: `${HOUR_SLOT_HEIGHT}px`
                  }}
                >
                  <span className="text-xs font-medium text-muted-foreground">
                    {(() => {
                      const hour = parseInt(time)
                      if (hour === 12) return '12 PM'
                      if (hour > 12) return `${hour - 12} PM`
                      return `${hour} AM`
                    })()}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Scrollable Staff columns container */}
          <div className="flex-1 overflow-x-auto" ref={columnsScrollRef} onScroll={(e) => {
            const h = headerScrollRef.current
            const sl = (e.currentTarget as HTMLDivElement).scrollLeft
            if (h && Math.abs(h.scrollLeft - sl) > 1) {
              h.scrollLeft = sl
            }
          }}>
            <div className="flex relative" style={{ minWidth: `${staff.length * columnWidth}px`, height: `${(12 * HOUR_SLOT_HEIGHT) + GRID_TOP_PADDING + GRID_BOTTOM_PADDING}px` }}>
              {/* Staff columns */}
              {staff.map((staffMember) => (
                <div key={staffMember.ghl_id} className="border-r last:border-r-0 bg-background flex-shrink-0 relative" style={{ width: `${columnWidth}px` }}>
                  {/* Hour lines for this staff column */}
                  {timeSlots.map((time, index) => {
                    return (
                      <div
                        key={time}
                        className={`absolute left-0 right-0 border-b border-border`}
                        style={{ 
                          top: `${GRID_TOP_PADDING + index * HOUR_SLOT_HEIGHT}px`, 
                          height: `${HOUR_SLOT_HEIGHT}px`
                        }}
                      />
                    )
                  })}

                  {/* Non-working hours grey overlay */}
                  {getNonWorkingPeriods(staffMember).map((period, index) => {
                    // Calculate slot index based on time
    // Each slot is 60 minutes, starting from 8:00 AM (slot 0)
    const startSlotIndex = (period.startMinutes - (8 * 60)) / 60
    const endSlotIndex = (period.endMinutes - (8 * 60)) / 60
    
    // Position based on slot index (each slot is now HOUR_SLOT_HEIGHT high)
    // Use the exact same positioning as the time slot lines
    const startPosition = GRID_TOP_PADDING + startSlotIndex * HOUR_SLOT_HEIGHT
    const endPosition = GRID_TOP_PADDING + endSlotIndex * HOUR_SLOT_HEIGHT
                    const height = endPosition - startPosition
                    
                    // Debug logging
                    console.log(`📅 ${staffMember.name} period ${index}:`, {
                      type: period.type,
                      startMinutes: period.startMinutes,
                      endMinutes: period.endMinutes,
                      startTime: `${Math.floor(period.startMinutes/60)}:${(period.startMinutes%60).toString().padStart(2,'0')}`,
                      endTime: `${Math.floor(period.endMinutes/60)}:${(period.endMinutes%60).toString().padStart(2,'0')}`,
                      startSlotIndex,
                      endSlotIndex,
                      startPosition,
                      endPosition,
                      height,
                      GRID_TOP_PADDING,
                      expectedSlots: `Should cover slots ${startSlotIndex} to ${endSlotIndex} (${endSlotIndex - startSlotIndex} slots)`,
                      timeSlotMapping: {
                        slot10: '18:00 (6 PM)',
                        slot11: '19:00 (7 PM)'
                      }
                    })
                    
                    // Validate positioning
                    if (height <= 0) {
                      console.warn(`📅 Invalid height for ${staffMember.name} period ${index}:`, height)
                      return null
                    }
                    
                    // Different styling based on type
                    let bgClass = "bg-gray-200/40"
                    let titleText = `${staffMember.name} is not working during this time`
                    let zIndex = 1
                    
                    switch (period.type) {
                      case 'leave':
                        bgClass = "bg-orange-200/60"
                        titleText = `${staffMember.name} is on leave`
                        zIndex = 4
                        break
                      case 'salon-closed':
                        bgClass = "bg-red-200/50"
                        titleText = "Salon is closed during this time"
                        zIndex = 3 // Highest priority
                        break
                      case 'staff-off':
                        bgClass = "bg-gray-300/50"
                        titleText = `${staffMember.name} is not scheduled to work`
                        zIndex = 2
                        break
                      case 'break':
                        bgClass = "bg-blue-200/50"
                        titleText = `${staffMember.name} is on break`
                        zIndex = 4
                        break
                    }
                    
                    return (
                      <div
                        key={`non-working-${index}`}
                        className={`absolute left-0 right-0 ${bgClass} group cursor-help`}
                        style={{
                          top: `${startPosition}px`,
                          height: `${height}px`,
                          zIndex: zIndex
                        }}
                        title={titleText}
                      >
                        {/* Tooltip */}
                        <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gray-900 text-white text-xs rounded px-2 py-1 pointer-events-none z-50 whitespace-nowrap left-2 top-1">
                          {titleText}
                          <div className="text-gray-300 text-[10px]">
                            {Math.floor(period.startMinutes/60)}:{(period.startMinutes%60).toString().padStart(2,'0')} - {Math.floor(period.endMinutes/60)}:{(period.endMinutes%60).toString().padStart(2,'0')}
                          </div>
                        </div>
                      </div>
                    )
                  })}

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
                  {getStaffAppointments(staffMember.ghl_id).map((appointment: Appointment) => {
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
  const [currentDate, setCurrentDate] = React.useState(new Date()) // Set to date with known appointments
  const [view, setView] = React.useState<CalendarView>('day')
  const { data: appointments, loading, refresh } = useAppointments(view, currentDate)
  const { user } = useUser()
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
    console.log(`📅 Scoping appointments:`, {
      totalAppointments: appointments.length,
      userRole: user?.role,
      userGhlId: user?.ghlId,
      sampleAssignedUserIds: appointments.slice(0, 5).map(a => a.assigned_user_id)
    })
    
    if (user?.role === 'barber' && user.ghlId) {
      const filtered = appointments.filter(a => (a.assigned_user_id || '') === user.ghlId)
      console.log(`📅 Barber filter: ${filtered.length} appointments match ghlId ${user.ghlId}`)
      return filtered
    }
    console.log(`📅 No barber filter applied, returning all ${appointments.length} appointments`)
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

  // Day view appointments - bypass all filtering for debugging
  const dayAppointments = React.useMemo(() => {
    const dateKey = currentDate.toDateString()
    // Use appointments directly like the appointments tab
    const todaysAppointments = appointments.filter(appointment => {
      if (!appointment.startTime) return false
      const appointmentDate = new Date(appointment.startTime).toDateString()
      return appointmentDate === dateKey
    })
    
    console.log(`📅 DIRECT filter debug:`, {
      currentDate: dateKey,
      totalAppointments: appointments.length,
      todaysAppointments: todaysAppointments.length,
      sampleAppointments: appointments.slice(0, 3).map(a => ({
        id: a.id,
        startTime: a.startTime,
        assigned_user_id: a.assigned_user_id
      }))
    })
    
    return todaysAppointments
  }, [appointments, currentDate])
  
  // Debug day appointments
  console.log(`📅 Calendar Day View Debug:`, {
    currentDate: currentDate.toDateString(),
    availableDates: Object.keys(appointmentsByDate).slice(0, 10),
    dayAppointments: dayAppointments.length,
    totalAppointments: scopedAppointments.length,
    sampleDayAppointments: dayAppointments.slice(0, 3).map(a => ({
      id: a.id,
      title: a.title,
      startTime: a.startTime,
      assigned_user_id: a.assigned_user_id
    }))
  })
  
  // Debug today's appointment assigned_user_ids
  if (dayAppointments.length > 0) {
    console.log(`📅 Today's appointments staff IDs:`, dayAppointments.map(a => a.assigned_user_id))
  }

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
            <div className="flex items-center justify-between gap-2 px-4 w-full">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4" />
                <h1 className="text-xl font-semibold">Calendar</h1>
                <Badge variant="secondary" className="ml-2">
                  <CalendarIcon className="h-3 w-3 mr-1" />
                  Appointments
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" className="h-8 bg-[#601625] hover:bg-[#751a29]" onClick={() => router.push('/walk-in')}>
                  <UserIcon className="h-4 w-4 mr-2" />
                  Walk-in
                </Button>
                <Button size="sm" className="h-8" onClick={() => router.push(`/appointments?view=new`)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Appointment
                </Button>
              </div>
            </div>
          </header>

          <div className="flex flex-col min-h-0 flex-1">
            {/* Calendar Controls */}
            <div className="flex items-center justify-between p-4 bg-background border-b flex-shrink-0">
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
              </div>
            </div>

            {/* Calendar Views */}
            {loading ? (
              <div className="flex-1 p-4 min-h-0">
                <Skeleton className="h-full w-full" />
              </div>
            ) : (
              <>
                {/* Day View */}
                {view === 'day' && (
                  <div className="flex-1 h-full px-4 py-4">
                    {isSalonDayOff(currentDate) ? (
                      <div className="text-center py-12 text-red-600 h-full flex flex-col items-center justify-center">
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
                            currentDate={currentDate}
                            onAppointmentClick={(appointment) => {
                              setSelectedAppointment(appointment)
                              setDetailsOpen(true)
                            }}
                          />
                        ) : (
                          <div className="text-center py-12 text-muted-foreground h-full flex flex-col items-center justify-center">
                            <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>Access restricted. Please contact your administrator.</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Month View */}
                {view === 'month' && (
                  <div className="flex-1 p-4 h-full overflow-auto">
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
                  </div>
                )}

                {/* Year View */}
                {view === 'year' && (
                  <div className="flex-1 p-4 h-full overflow-auto">
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
                  </div>
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
