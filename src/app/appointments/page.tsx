"use client"
import * as React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { RoleGuard } from "@/components/role-guard"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table"
import { ArrowUpDown, Search, Calendar, Clock, User, Users, MapPin, ChevronLeft, ChevronRight, RefreshCcw, CheckCircle, XCircle, Loader2, ArrowLeft, CheckCircle2, AlertCircle, Scissors, Crown, Sparkles, Heart, Zap, Flame, Gem, Star as StarIcon, MoreVertical } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { toast } from "sonner"
import { Dialog as ConfirmDialog, DialogContent as ConfirmContent, DialogHeader as ConfirmHeader, DialogTitle as ConfirmTitle } from "@/components/ui/dialog"
import { AppointmentNew } from "@/components/appointment-new"
import { Label } from "@/components/ui/label"
import { useRouter, useSearchParams } from "next/navigation"
import { useUser } from "@/contexts/user-context"

type Booking = {
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
  // Enriched data
  serviceName?: string
  startTime?: string
  endTime?: string
  assignedStaffFirstName?: string
  assignedStaffLastName?: string
  contactName?: string
  contactPhone?: string
  createdAt?: string
  durationMinutes?: number
  price?: number
}

type RawBooking = {
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
}

type StaffMember = {
  label: string
  value: string
  icon: string
  badge?: string
}

type DateInfo = {
  dateString: string
  dayName: string
  dateDisplay: string
  label: string
  date: Date
}

type TimeSlot = {
  time: string
  isPast: boolean
}

function useBookings() {
  const [data, setData] = React.useState<Booking[]>([])
  const [loading, setLoading] = React.useState<boolean>(true)
  const [currentPage, setCurrentPage] = React.useState<number>(1)
  const [totalPages, setTotalPages] = React.useState<number>(1)
  const [total, setTotal] = React.useState<number>(0)
  const [statusFilter, setStatusFilter] = React.useState<string>("upcoming")
  const [searchTerm, setSearchTerm] = React.useState<string>("")
  const isInitialMount = React.useRef(true)
  const isMounted = React.useRef(false)
  const [lastUpdated, setLastUpdated] = React.useState<number>(0)
  
  // Separate pagination state for each tab
  const [paginationState, setPaginationState] = React.useState<Record<string, { page: number; totalPages: number; total: number }>>({
    upcoming: { page: 1, totalPages: 1, total: 0 },
    past: { page: 1, totalPages: 1, total: 0 },
    confirmed: { page: 1, totalPages: 1, total: 0 },
    cancelled: { page: 1, totalPages: 1, total: 0 }
  })

  React.useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  const fetchBookings = React.useCallback(
    async (
      forceRefresh: boolean = false,
      params?: { assignedUserId?: string; page?: number; search?: string; appointmentStatus?: string; timeFilter?: string }
    ) => {
    if (!isMounted.current) return
    if (isMounted.current) {
      setLoading(true)
    }

    const controller = new AbortController()
    const { signal } = controller

    try {
        const pageToUse = params?.page ?? 1
        const qs = new URLSearchParams()
        qs.set('page', String(pageToUse))
        qs.set('pageSize', '20')
        if (params?.assignedUserId) qs.set('assigned_user_id', params.assignedUserId)
        const searchValue = params?.search ?? searchTerm
        if (searchValue) qs.set('search', searchValue)
        
        // Handle different filter types
        if (statusFilter === 'upcoming' || statusFilter === 'past') {
          // For time-based filtering, we'll use appointment_status and add time filter
          qs.set('appointment_status', 'confirmed')
          if (statusFilter === 'upcoming') {
            qs.set('time_filter', 'upcoming')
          } else {
            qs.set('time_filter', 'past')
          }
        } else {
          // For status-based filtering (confirmed/cancelled)
          const statusValue = params?.appointmentStatus ?? (statusFilter === 'confirmed' ? 'confirmed' : 'cancelled')
        if (statusValue) qs.set('appointment_status', statusValue)
        }

        const res = await fetch(`/api/bookings?${qs.toString()}`, { signal })
        if (!res.ok) {
          const errorText = await res.text()
          console.error('API Error:', res.status, errorText)
          throw new Error(`Failed to fetch bookings: ${res.status} - ${errorText}`)
        }
        const json = await res.json()

      if (isMounted.current && !signal.aborted) {
          setData((json.bookings || []) as Booking[])
          setTotal(Number(json.total) || (json.bookings?.length || 0))
          setTotalPages(Number(json.totalPages) || 1)
          setCurrentPage(pageToUse)
          
          // Update pagination state for current tab
          setPaginationState(prev => ({
            ...prev,
            [statusFilter]: {
              page: pageToUse,
              totalPages: Number(json.totalPages) || 1,
              total: Number(json.total) || (json.bookings?.length || 0)
            }
          }))
          
          setLastUpdated(Date.now())
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return
      } else {
          console.error('Failed to fetch bookings:', error)
        if (isMounted.current) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error'
            toast.error(`Failed to load appointments: ${errorMsg}`)
        }
      }
    } finally {
        if (isMounted.current) setLoading(false)
    }

    return () => {
      controller.abort()
    }
    },
    [statusFilter, searchTerm]
  )

  return { 
    data, 
    loading, 
    setData, 
    currentPage, 
    setCurrentPage, 
    totalPages, 
    total, 
    fetchBookings,
    statusFilter,
    setStatusFilter,
    searchTerm,
    setSearchTerm,
    lastUpdated,
    paginationState,
    setPaginationState
  }
}

function formatDateTime(isoString?: string) {
  if (!isoString) return 'N/A'
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return isoString
  // Always render in America/Denver wall time so table and details match
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  return dtf.format(date)
}

function formatDuration(startIso?: string, endIso?: string) {
  if (!startIso || !endIso) return '—'
  const mins = Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m} mins`
}

function formatServiceDuration(durationMinutes?: number) {
  if (!durationMinutes || durationMinutes <= 0) return '—'
  const h = Math.floor(durationMinutes / 60)
  const m = durationMinutes % 60
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m} mins`
}

// Convert America/Denver wall time to UTC ISO, mirroring supabase.vue
function getTimeZoneOffsetInMs(timeZone: string, utcDate: Date) {
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

function denverWallTimeToUtcIso(year: number, month: number, day: number, hour: number, minute: number) {
  const baseUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0))
  const offset = getTimeZoneOffsetInMs('America/Denver', baseUtc)
  return new Date(baseUtc.getTime() - offset).toISOString()
}

function getBookingStatus(booking: Booking) {
  const status = (booking.appointment_status || '').toLowerCase()
  const now = new Date()
  const startTime = booking.startTime ? new Date(booking.startTime) : null
  
  if (status === 'cancelled') return 'cancelled'
  if (!startTime) return 'unknown'
  
  if (startTime < now) return 'past'
  return 'upcoming'
}

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case 'confirmed':
    case 'upcoming':
      return 'default'
    case 'cancelled':
      return 'destructive'
    case 'past':
      return 'secondary'
    default:
      return 'outline'
  }
}

function getStatusBadgeClasses(status: string) {
  switch (status) {
    case 'confirmed':
    case 'upcoming':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'cancelled':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'past':
      return 'bg-gray-100 text-gray-800 border-gray-200'
    default:
      return 'bg-blue-100 text-blue-800 border-blue-200'
  }
}

function BookingsPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useUser()
  const {
    data,
    loading,
    statusFilter,
    setStatusFilter,
    searchTerm,
    setSearchTerm,
    currentPage,
    setCurrentPage,
    totalPages,
    total,
    fetchBookings: fetchBookings,
    lastUpdated,
    paginationState,
    setPaginationState
  } = useBookings()

  const [selected, setSelected] = React.useState<Booking | null>(null)
  const [detailsOpen, setDetailsOpen] = React.useState(false)
  const [loadingDetails, setLoadingDetails] = React.useState(false)
  const [ghlBookingDetails, setGhlBookingDetails] = React.useState<Record<string, unknown> | null>(null)
  // (moved) Effects for deep-linking placed after new-booking state
  const [cancelConfirmOpen, setCancelConfirmOpen] = React.useState(false)
  const [bookingToCancel, setBookingToCancel] = React.useState<Booking | null>(null)
  const [cancelLoading, setCancelLoading] = React.useState(false)

  // Delete booking state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false)
  const [bookingToDelete, setBookingToDelete] = React.useState<Booking | null>(null)
  const [deleteLoading, setDeleteLoading] = React.useState(false)

  // Reschedule state
  const [rescheduleOpen, setRescheduleOpen] = React.useState(false)
  const [bookingToReschedule, setBookingToReschedule] = React.useState<Booking | null>(null)
  const [rescheduleLoading, setRescheduleLoading] = React.useState(false)
  
  // Reschedule form data
  const [selectedStaff, setSelectedStaff] = React.useState<string>("")
  const [staffOptions, setStaffOptions] = React.useState<StaffMember[]>([{
    label: 'Any available staff',
    value: 'any',
    badge: 'Recommended',
    icon: 'user'
  }])
  const [selectedDate, setSelectedDate] = React.useState<string>("")
  const [selectedTime, setSelectedTime] = React.useState<string>("")
  const [availableDates, setAvailableDates] = React.useState<DateInfo[]>([])
  const [availableSlots, setAvailableSlots] = React.useState<TimeSlot[]>([])
  const [loadingStaff, setLoadingStaff] = React.useState(false)
  const [loadingSlots, setLoadingSlots] = React.useState(false)
  const [workingSlots, setWorkingSlots] = React.useState<Record<string, string[]>>({})

  // New appointment state
  const [newAppointmentOpen, setNewAppointmentOpen] = React.useState(false)
  const [newAppCurrentStep, setNewAppCurrentStep] = React.useState(1)
  const [newAppDepartments, setNewAppDepartments] = React.useState<Array<{ id?: string; name?: string; label?: string; value?: string; description?: string; icon?: string }>>([])
  const [newAppSelectedDepartment, setNewAppSelectedDepartment] = React.useState<string>("")
  const [newAppServices, setNewAppServices] = React.useState<Array<{ id?: string; name?: string; duration?: number; price?: number; label?: string; value?: string; description?: string; staffCount?: number }>>([])
  const [newAppSelectedService, setNewAppSelectedService] = React.useState<string>("")
  const [newAppStaff, setNewAppStaff] = React.useState<Array<{ id?: string; name?: string; email?: string; label?: string; value?: string; badge?: string; icon?: string }>>([])
  const [newAppSelectedStaff, setNewAppSelectedStaff] = React.useState<string>("")
  const [newAppDates, setNewAppDates] = React.useState<DateInfo[]>([])
  const [newAppSelectedDate, setNewAppSelectedDate] = React.useState<string>("")
  const [newAppSlots, setNewAppSlots] = React.useState<TimeSlot[]>([])
  const [newAppSelectedTime, setNewAppSelectedTime] = React.useState<string>("")
  const [newAppContactForm, setNewAppContactForm] = React.useState({
    firstName: '',
    lastName: '',
    phone: '',
    optIn: false
  })
  const [newAppLoading, setNewAppLoading] = React.useState(false)
  const [newAppWorkingSlots, setNewAppWorkingSlots] = React.useState<Record<string, string[]>>({})
  const [newAppLoadingDepts, setNewAppLoadingDepts] = React.useState(false)
  const [newAppLoadingServices, setNewAppLoadingServices] = React.useState(false)
  const [newAppLoadingStaff, setNewAppLoadingStaff] = React.useState(false)
  const [newAppLoadingSlots, setNewAppLoadingSlots] = React.useState(false)
  const [newAppLoadingDates, setNewAppLoadingDates] = React.useState(false)
  // Track requested date from deep link to choose nearest available
  const desiredNewAppDateRef = React.useRef<string | null>(null)

  // Fetch GHL booking details
  const fetchGHLBookingDetails = React.useCallback(async (bookingId: string) => {
    setLoadingDetails(true)
    setGhlBookingDetails(null)
    try {
      const response = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/getBooking?id=${bookingId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch booking details')
      }
      const data = await response.json()
      setGhlBookingDetails(data)
    } catch (error) {
      console.error('Error fetching GHL booking details:', error)
      toast.error('Failed to load full booking details')
    } finally {
      setLoadingDetails(false)
    }
  }, [])

  // Open details dialog or new appointment dialog when query params exist
  React.useEffect(() => {
    const view = searchParams?.get("view")
    const id = searchParams?.get("id")
    if (view === "details" && id && data.length > 0) {
      const found = data.find((a) => a.id === id)
      if (found) {
        setSelected(found)
        setDetailsOpen(true)
        fetchGHLBookingDetails(found.id)
      }
    }
  }, [searchParams, data, fetchGHLBookingDetails])

  // Open New Appointment dialog from calendar deep-link and prefill date/time
  React.useEffect(() => {
    const openBooking = searchParams?.get("openBooking") === "1"
    if (!openBooking) return
    setNewAppointmentOpen(true)
    const dateParam = searchParams?.get("date")
    const hourParam = searchParams?.get("hour")
    const minuteParam = searchParams?.get("minute")
    if (dateParam) {
      desiredNewAppDateRef.current = dateParam
      setNewAppSelectedDate(dateParam)
    }
    if (hourParam && minuteParam) {
      const h = Number(hourParam)
      const m = Number(minuteParam)
      const ampm = h >= 12 ? 'PM' : 'AM'
      const h12 = ((h + 11) % 12) + 1
      const mm = String(m).padStart(2, '0')
      setNewAppSelectedTime(`${h12}:${mm} ${ampm}`)
    }
  }, [searchParams])

  // When available dates load, if requested date is not available, pick the next available date >= requested
  React.useEffect(() => {
    const desired = desiredNewAppDateRef.current
    if (!desired) return
    if (!newAppDates || newAppDates.length === 0) return
    const hasDesired = newAppDates.some(d => d.dateString === desired)
    if (hasDesired) return
    const next = newAppDates.find(d => d.dateString >= desired)
    if (next) {
      setNewAppSelectedDate(next.dateString)
    } else {
      // fallback to the first available date
      setNewAppSelectedDate(newAppDates[0].dateString)
    }
  }, [newAppDates])

  // Fetch bookings on mount and when filters change (server-side pagination + filtering)
  React.useEffect(() => {
    const assigned = user?.role === 'barber' ? user.ghlId : undefined
    const page = paginationState[statusFilter]?.page || 1
    const appointmentStatus = statusFilter === 'confirmed' ? 'confirmed' : statusFilter === 'cancelled' ? 'cancelled' : undefined
    fetchBookings(false, { assignedUserId: assigned, page, search: searchTerm || undefined, appointmentStatus })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, user?.ghlId, statusFilter, searchTerm, paginationState.upcoming?.page, paginationState.past?.page, paginationState.confirmed?.page, paginationState.cancelled?.page])

  // Manual refresh helper
  const refreshBookings = React.useCallback(async () => {
    const assigned = user?.role === 'barber' ? user.ghlId : undefined
    const currentTabState = paginationState[statusFilter]
    await fetchBookings(true, { 
      assignedUserId: assigned, 
      page: currentTabState?.page || 1, 
      search: searchTerm || undefined, 
      appointmentStatus: statusFilter === 'confirmed' ? 'confirmed' : statusFilter === 'cancelled' ? 'cancelled' : undefined 
    })
  }, [fetchBookings, user?.role, user?.ghlId, statusFilter, searchTerm, paginationState])

  // Handle tab change with pagination reset
  const handleTabChange = React.useCallback((newTab: string) => {
    setStatusFilter(newTab)
    // Reset to page 1 for the new tab
    setPaginationState(prev => ({
      ...prev,
      [newTab]: { ...prev[newTab], page: 1 }
    }))
  }, [setStatusFilter, setPaginationState])

  // Keep URL in sync when dialog opens/closes
  React.useEffect(() => {
    if (detailsOpen && selected) {
      const params = new URLSearchParams(Array.from(searchParams?.entries?.() || []))
      params.set("view", "details")
      params.set("id", selected.id)
      router.replace(`?${params.toString()}`)
    } else if (!detailsOpen) {
      // Clear URL params and reset GHL details when closing
      const params = new URLSearchParams(Array.from(searchParams?.entries?.() || []))
      params.delete("view")
      params.delete("id")
      router.replace(params.toString() ? `?${params.toString()}` : window.location.pathname)
      setGhlBookingDetails(null)
      setLoadingDetails(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailsOpen, selected])

  // Helper function to check if appointment is within 2 hours
  const isWithinTwoHours = (startTime?: string) => {
    if (!startTime) return false
    const start = new Date(startTime)
    const now = new Date()
    return start.getTime() <= now.getTime() + 2 * 60 * 60 * 1000
  }

  // Cancel booking function
  const handleCancelBooking = async (booking: Booking) => {
    if (isWithinTwoHours(booking.startTime)) {
      toast.error("Cannot cancel - appointment starts within 2 hours")
      return
    }
    setBookingToCancel(booking)
    setCancelConfirmOpen(true)
  }

  const confirmCancelBooking = async () => {
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
      await refreshBookings()
      toast.success("Appointment cancelled successfully")
      setCancelConfirmOpen(false)
      setBookingToCancel(null)
    } catch (error) {
      console.error(error)
      toast.error(`Cancellation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setCancelLoading(false)
    }
  }

  // Delete booking functions
  const handleDeleteBooking = async (booking: Booking) => {
    setBookingToDelete(booking)
    setDeleteConfirmOpen(true)
  }

  const confirmDeleteBooking = async () => {
    if (!bookingToDelete) return
    
    setDeleteLoading(true)
    try {
      const res = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/deletebooking?bookingId=${bookingToDelete.id}`, {
        method: "DELETE",
        headers: {
          "Accept": "application/json"
        }
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Delete failed")
      
      // Refresh appointments
      await refreshBookings()
      toast.success("Appointment deleted successfully")
      setDeleteConfirmOpen(false)
      setBookingToDelete(null)
      
      // Close details dialog if open
      if (selected?.id === bookingToDelete.id) {
        setDetailsOpen(false)
        setSelected(null)
      }
    } catch (error) {
      console.error(error)
      toast.error(`Delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setDeleteLoading(false)
    }
  }

  // Reschedule functions
  const handleRescheduleBooking = async (booking: Booking) => {
    setBookingToReschedule(booking)
    setSelectedStaff(booking.assigned_user_id || "any")
    setSelectedDate("")
    setSelectedTime("")
    setRescheduleOpen(true)
    
    // Staff options will be fetched automatically by useEffect
  }

  const fetchStaffOptions = async () => {
    if (!rescheduleOpen || !bookingToReschedule?.calendar_id) return
    
    setLoadingStaff(true)
    const controller = new AbortController()
    
    try {
      // Fetch service details to get team members (like in Vue.js file)
      const serviceRes = await fetch(`https://restyle-api.netlify.app/.netlify/functions/Services?id=${bookingToReschedule.groupId || 'default'}`, { signal: controller.signal })
      const serviceData = await serviceRes.json()
      
      const serviceObj = (serviceData.calendars || []).find((s: { id: string }) => s.id === bookingToReschedule.calendar_id)
      const teamMembers = serviceObj?.teamMembers || []
      console.log('Team members for service:', teamMembers)

      const items: StaffMember[] = [{
        label: 'Any available staff',
        value: 'any',
        badge: 'Recommended',
        icon: 'user'
      }]

      // Fetch individual staff details for each team member (use member.userId as value like Vue.js)
      const staffPromises = teamMembers.map(async (member: { userId: string; name: string; email?: string }) => {
        try {
          const staffRes = await fetch(`https://restyle-api.netlify.app/.netlify/functions/Staff?id=${member.userId}`, { signal: controller.signal })
          const staffData = await staffRes.json()
          return {
            label: staffData.name,
            value: member.userId, // Use member.userId instead of staffData.id to match Vue.js
            originalStaffId: staffData.id, // Keep original for reference
            icon: 'user'
          }
        } catch {
          console.warn('Failed to fetch staff details for:', member.userId)
          return null
        }
      })

      const staffResults = await Promise.all(staffPromises)
      const validStaff = staffResults.filter(Boolean)
      
      const allStaffOptions = [...items, ...validStaff]
      console.log('Staff options created:', allStaffOptions)
      
      // Only update state if dialog is still open
      if (rescheduleOpen) {
        setStaffOptions(allStaffOptions)
        console.log('Staff options set in state')
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error('Error fetching staff:', error)
        if (rescheduleOpen) {
          setStaffOptions([{
            label: 'Any available staff',
            value: 'any',
            badge: 'Recommended',
            icon: 'user'
          }])
        }
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
        // Get all available dates (including past ones for full month view)
        const workingDates = Object.keys(data.slots).sort()
        
        const dates = workingDates.map((dateString, index) => {
          const [year, month, day] = dateString.split('-').map(Number)
          const date = new Date(year, month - 1, day)
          
          const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
          const dateDisplay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          
          return {
            dateString,
            dayName,
            dateDisplay,
            label: '', // Remove labels for cleaner UI
            date
          }
        })
        
        // Only update state if dialog is still open
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
      
      const availableSlots = slotsWithStatus.filter((slot: TimeSlot) => !slot.isPast)
      setAvailableSlots(availableSlots)
    } else {
      setAvailableSlots([])
    }
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

  const getTomorrowDateString = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
  }

  const isThisWeek = (dateString: string) => {
    const today = new Date()
    const targetDate = new Date(dateString + 'T00:00:00')
    const diffTime = targetDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays > 1 && diffDays <= 7
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
        
        // Determine assignedUserId (similar to Vue.js implementation)
        let assignedUserIdToSend = selectedStaff
        if (selectedStaff === 'any') {
          // If "any" is selected, use the first real staff member or current appointment staff
          const realStaff = staffOptions.filter(item => item.value !== 'any')
          if (realStaff.length > 0) {
            assignedUserIdToSend = realStaff[0].value
          } else if (bookingToReschedule.assigned_user_id) {
            assignedUserIdToSend = bookingToReschedule.assigned_user_id
          }
        }

        if (!assignedUserIdToSend || assignedUserIdToSend === 'any') {
          throw new Error('A team member needs to be selected. assignedUserId is missing')
        }

        let updateUrl = `https://restyle-api.netlify.app/.netlify/functions/updateappointment?appointmentId=${bookingToReschedule.id}`
        updateUrl += `&assignedUserId=${assignedUserIdToSend}`
        
        // Convert America/Denver wall time to UTC ISO (mirror Vue logic)
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
          // Clear any view param to avoid reopening a dialog on reload
          try {
            const params = new URLSearchParams(Array.from(searchParams?.entries?.() || []))
            params.delete("view")
            params.delete("id")
            const qs = params.toString()
            router.replace(qs ? `?${qs}` : "")
          } catch {}
          // Invalidate cache and force refresh
          try { localStorage.removeItem('restyle.bookings.cache') } catch {}
          await refreshBookings()
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

  // Effect to fetch staff when reschedule dialog opens
  React.useEffect(() => {
    if (rescheduleOpen) {
      fetchStaffOptions()
    }
  }, [rescheduleOpen])

  // Effect to fetch dates when staff changes (re-fetch with new userId)
  React.useEffect(() => {
    if (rescheduleOpen && selectedStaff && bookingToReschedule) {
      console.log('Staff changed to:', selectedStaff, '- refetching working slots')
      // Clear current data and refetch with new staff ID
      setWorkingSlots({})
      setAvailableDates([])
      setAvailableSlots([])
      setSelectedDate("")
      setSelectedTime("")
      
      // Fetch available dates with the new staff selection
      fetchAvailableDates()
    }
  }, [selectedStaff, rescheduleOpen, bookingToReschedule])

  // Effect to fetch slots when date changes
  React.useEffect(() => {
    if (selectedDate && workingSlots && Object.keys(workingSlots).length > 0) {
      fetchSlotsForDate(selectedDate, workingSlots)
    }
  }, [selectedDate, workingSlots])

  // New Appointment Functions (based on Vue.js supabase.vue)
  
  // Fetch departments for new appointment
  const fetchNewAppDepartments = async () => {
    setNewAppLoadingDepts(true)
    try {
      const res = await fetch('https://restyle-backend.netlify.app/.netlify/functions/supabasegroups')
      const data = await res.json()
      
      const departments = data.groups.map((group: { id: string; name: string; description?: string }) => ({
        label: group.name,
        value: group.id,
        description: group.description || '',
        icon: 'user'
      }))

      // Sort alphabetically by display label to match checkout UI
      departments.sort((a: { label?: string }, b: { label?: string }) =>
        String(a.label || '').localeCompare(String(b.label || ''), undefined, { sensitivity: 'base' })
      )

      setNewAppDepartments(departments)

      // Select first group by default and load its services
      if (departments.length > 0) {
        const firstId = String(departments[0].value || departments[0].label || '')
        setNewAppSelectedDepartment(firstId)
        fetchNewAppServices(firstId)
      }
    } catch {
      console.error('Error fetching departments')
      setNewAppDepartments([])
    } finally {
      setNewAppLoadingDepts(false)
    }
  }

  // Fetch services for selected department
  const fetchNewAppServices = async (departmentId: string) => {
    if (!departmentId) return
    
    setNewAppLoadingServices(true)
    try {
      const res = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/Services?id=${departmentId}`)
      const data = await res.json()
      
      const services = (data.calendars || []).map((service: {
        id?: string;
        name?: string;
        description?: string;
        slotDuration?: number;
        duration?: number;
        slotDurationUnit?: string;
        durationUnit?: string;
        durationMinutes?: number;
        timeSlotDuration?: number;
        length?: number;
        serviceDuration?: number;
        durationInMinutes?: number;
        timeDuration?: number;
        appointmentDuration?: number;
        bookingDuration?: number;
        sessionDuration?: number;
        teamMembers?: Array<{ userId: string; priority?: number; selected?: boolean }>;
      }) => {
        // Debug: Log ALL possible duration fields
        console.log(`Service: ${service.name}`, {
          slotDuration: service.slotDuration,
          slotDurationUnit: service.slotDurationUnit,
          duration: service.duration,
          durationMinutes: service.durationMinutes,
          timeSlotDuration: service.timeSlotDuration,
          length: service.length,
          serviceDuration: service.serviceDuration,
          durationInMinutes: service.durationInMinutes,
          timeDuration: service.timeDuration,
          appointmentDuration: service.appointmentDuration,
          bookingDuration: service.bookingDuration,
          sessionDuration: service.sessionDuration
        })
        
        // Try multiple possible duration field names - check ALL possible fields
        const possibleDurations = [
          service.slotDuration,
          service.duration,
          service.durationMinutes,
          service.timeSlotDuration,
          service.length,
          service.serviceDuration,
          service.durationInMinutes,
          service.timeDuration,
          service.appointmentDuration,
          service.bookingDuration,
          service.sessionDuration
        ].filter(d => d !== null && d !== undefined && d > 0)
        
        const rawDuration = possibleDurations[0] || 0
        
        // Try to determine the correct duration conversion
        let durationInMins = 0
        
        if (rawDuration > 0) {
          // Check the slotDurationUnit to determine conversion
          const durationUnit = service.slotDurationUnit || 'hours'
          
          if (durationUnit === 'hours') {
            durationInMins = rawDuration * 60 // Convert hours to minutes
          } else if (durationUnit === 'mins' || durationUnit === 'minutes') {
            durationInMins = rawDuration // Already in minutes
          } else {
            // Fallback: if duration is very small (likely in hours), convert to minutes
            if (rawDuration < 10) {
              durationInMins = rawDuration * 60 // Convert hours to minutes
            } else if (rawDuration >= 10) {
              durationInMins = rawDuration // Already in minutes
            }
          }
        }
        
        // If still no duration found, try to extract from description
        if (durationInMins === 0 && service.description) {
          const durationMatch = service.description.match(/(\d+)\s*(?:min|mins|minute|minutes|hr|hrs|hour|hours)/i)
          if (durationMatch) {
            const durationValue = parseInt(durationMatch[1])
            const unit = durationMatch[0].toLowerCase()
            if (unit.includes('hr') || unit.includes('hour')) {
              durationInMins = durationValue * 60
            } else {
              durationInMins = durationValue
            }
          }
        }
        
        
        // Extract price from description HTML (like supabase.vue)
        let price = 0
        if (service.description) {
          const priceMatch = service.description.match(/CA\$(\d+\.?\d*)/i)
          if (priceMatch) {
            price = parseFloat(priceMatch[1])
          }
        }
        
        // Debug: Log the final duration
        console.log(`Final duration for ${service.name}: ${durationInMins} minutes (from raw: ${rawDuration}, used field: ${possibleDurations[0] ? 'found' : 'none'})`)
        
        return {
          label: service.name,
          value: service.id,
          duration: durationInMins, // Store as number
          price: price, // Store price
          description: `Duration: ${durationInMins} mins | Staff: ${service.teamMembers?.length ?? 0}`,
          staffCount: service.teamMembers?.length ?? 0
        }
      })
      
      setNewAppServices(services)
    } catch {
      console.error('Error fetching services')
      setNewAppServices([])
    } finally {
      setNewAppLoadingServices(false)
    }
  }

  // Fetch staff for selected service
  const fetchNewAppStaff = async (serviceId: string) => {
    if (!serviceId || !newAppSelectedDepartment) return
    
    setNewAppLoadingStaff(true)
    try {
      const res = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/Services?id=${newAppSelectedDepartment}`)
      const data = await res.json()
      
      const serviceObj = (data.calendars || []).find((s: { id: string; teamMembers?: Array<{ userId: string; name: string }> }) => s.id === serviceId)
      const teamMembers = serviceObj?.teamMembers || []

      const items = [{
        label: 'Any available staff',
        value: 'any',
        badge: 'Recommended',
        icon: 'user'
      }]

      const staffPromises = teamMembers.map(async (member: { userId: string; name: string; email?: string }) => {
        try {
          const staffRes = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/Staff?id=${member.userId}`)
          const staffData = await staffRes.json()
          
          console.log('👤 Staff API response for member:', member.userId, staffData)
          
          // Comprehensive name derivation like Vue.js supabase.vue
          const derivedName =
            staffData?.data?.name ||
            staffData?.name ||
            staffData?.fullName ||
            staffData?.displayName ||
            [staffData?.staff?.firstName, staffData?.staff?.lastName].filter(Boolean).join(' ') ||
            [staffData?.users?.firstName, staffData?.users?.lastName].filter(Boolean).join(' ') ||
            [staffData?.firstName, staffData?.lastName].filter(Boolean).join(' ') ||
            staffData?.user?.name ||
            'Staff'
          
          console.log('✅ Derived staff name:', derivedName, 'for userId:', member.userId)
          
          return {
            label: derivedName,
            value: member.userId, // Use member.userId like Vue.js
            originalStaffId: staffData?.id,
            icon: 'user'
          }
        } catch (error) {
          console.warn('❌ Failed to fetch staff details for:', member.userId, error)
          return null
        }
      })

      const staffResults = await Promise.all(staffPromises)
      const validStaff = staffResults.filter(Boolean)
      
      setNewAppStaff([...items, ...validStaff])
    } catch {
      console.error('Error fetching staff')
      setNewAppStaff([{
        label: 'Any available staff',
        value: 'any',
        badge: 'Recommended',
        icon: 'user'
      }])
    } finally {
      setNewAppLoadingStaff(false)
    }
  }

  // Fetch working slots for selected service and staff
  const fetchNewAppWorkingSlots = async () => {
    if (!newAppSelectedService) return
    
    setNewAppLoadingDates(true)
    const serviceId = newAppSelectedService
    const userId = newAppSelectedStaff && newAppSelectedStaff !== 'any' ? newAppSelectedStaff : null

    try {
      let apiUrl = `https://restyle-backend.netlify.app/.netlify/functions/staffSlots?calendarId=${serviceId}`
      if (userId) {
        apiUrl += `&userId=${userId}`
      }
      
      const response = await fetch(apiUrl)
      const data = await response.json()
      
      if (data.slots) {
        setNewAppWorkingSlots(data.slots)
        generateNewAppDates(data.slots)
      } else {
        setNewAppWorkingSlots({})
        setNewAppDates([])
        setNewAppSlots([])
        setNewAppLoadingSlots(false)
      }
    } catch (error) {
      console.error('Error fetching working slots:', error)
      setNewAppWorkingSlots({})
      setNewAppDates([])
      setNewAppSlots([])
      setNewAppLoadingSlots(false)
    } finally {
      setNewAppLoadingDates(false)
    }
  }

  // Generate available dates from working slots
  const generateNewAppDates = (workingSlots: Record<string, string[]>) => {
    const today = new Date()
    const todayDateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    
    const workingDates = Object.keys(workingSlots)
      .filter(dateString => {
        // Always include future dates
        if (dateString > todayDateString) return true
        
        // For today's date, only include if it has available slots
        if (dateString === todayDateString) {
          const todaySlots = workingSlots[dateString] || []
          const availableTodaySlots = todaySlots.filter(slot => !isNewAppSlotInPast(slot, dateString))
          return availableTodaySlots.length > 0
        }
        
        return false
      })
      .sort()
    
    const dates = workingDates.map((dateString) => {
      const [year, month, day] = dateString.split('-').map(Number)
      const date = new Date(year, month - 1, day)
      
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
      const dateDisplay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      
      let label = ''
      if (dateString === todayDateString) {
        label = 'TODAY'
      } else {
        const diffTime = new Date(dateString + 'T00:00:00').getTime() - today.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        if (diffDays === 1) label = 'TOMORROW'
        else if (diffDays <= 7) label = 'THIS WEEK'
        else label = 'NEXT WEEK'
      }
      
      return {
        dateString,
        dayName,
        dateDisplay,
        label,
        date
      }
    })
    
    setNewAppDates(dates)
    
    // If we already have a selected date, refresh its slots
    if (newAppSelectedDate) {
      fetchNewAppSlotsForDate(newAppSelectedDate)
    }
  }

  // Fetch slots for selected date
  const fetchNewAppSlotsForDate = (dateString: string) => {
    if (!dateString) {
      setNewAppSlots([])
      setNewAppLoadingSlots(false)
      return
    }

    // Check if we already have slots for this date
    if (newAppWorkingSlots[dateString]) {
      // We have slots, process them immediately without loading state
      const slotsForSelectedDate = newAppWorkingSlots[dateString]
      const slotsWithStatus = slotsForSelectedDate.map((slot: string) => ({
        time: slot,
        isPast: isNewAppSlotInPast(slot, dateString),
        isUnavailable: false
      }))
      
      const availableSlots = slotsWithStatus.filter((slot: TimeSlot) => !slot.isPast)
      setNewAppSlots(availableSlots)
      setNewAppLoadingSlots(false)
    } else {
      // We don't have slots yet, show loading state
      setNewAppLoadingSlots(true)
      setNewAppSlots([])
    }
  }

  // Helper function to check if slot is in past for new appointments
  const isNewAppSlotInPast = (slotTime: string, dateString: string) => {
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

  // Helper function to format date for display
  const formatSelectedDate = (dateString: string) => {
    if (!dateString) return ''
    try {
      const [year, month, day] = dateString.split('-').map(Number)
      const date = new Date(year, month - 1, day)
      return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    } catch (error) {
      console.error('Error formatting date:', error)
      return dateString
    }
  }

  // Reset new appointment form
  const resetNewAppointmentForm = () => {
    setNewAppCurrentStep(1)
    setNewAppSelectedDepartment("")
    setNewAppSelectedService("")
    setNewAppSelectedStaff("")
    setNewAppSelectedDate("")
    setNewAppSelectedTime("")
    setNewAppContactForm({
      firstName: '',
      lastName: '',
      phone: '',
      optIn: false
    })
    setNewAppServices([])
    setNewAppStaff([])
    setNewAppDates([])
    setNewAppSlots([])
    setNewAppWorkingSlots({})
  }

  // Step navigation functions (Updated for 4-step flow)
  const goToNextNewAppStep = () => {
    setNewAppCurrentStep(prev => Math.min(prev + 1, 4))
  }

  const goToPrevNewAppStep = () => {
    setNewAppCurrentStep(prev => Math.max(prev - 1, 1))
  }

  // Handle department selection - only fetch services, don't auto-advance
  const handleNewAppDepartmentSelect = (departmentId: string) => {
    setNewAppSelectedDepartment(departmentId)
    setNewAppSelectedService("")
    setNewAppSelectedStaff("")
    fetchNewAppServices(departmentId)
    // Don't auto-advance - stay on Step 1 to show services
  }

  // Handle service selection - advance to staff selection
  const handleNewAppServiceSelect = (serviceId: string) => {
    setNewAppSelectedService(serviceId)
    setNewAppSelectedStaff("")
    fetchNewAppStaff(serviceId)
    goToNextNewAppStep() // Go to Step 2 (Staff)
  }

  // Handle staff selection - advance to date/time
  const handleNewAppStaffSelect = (staffId: string) => {
    setNewAppSelectedStaff(staffId)
    fetchNewAppWorkingSlots()
    // Don't auto-advance - let user click Continue button
  }

  // Handle date selection
  const handleNewAppDateSelect = (dateString: string) => {
    setNewAppSelectedDate(dateString)
    setNewAppSelectedTime("")
    fetchNewAppSlotsForDate(dateString)
  }

  // Handle time selection
  const handleNewAppTimeSelect = (time: string) => {
    setNewAppSelectedTime(time)
    goToNextNewAppStep()
  }

  // Submit new appointment
  const submitNewAppointment = async () => {
    setNewAppLoading(true)
    
    try {
      // Create contact first
      const params = new URLSearchParams({
        firstName: newAppContactForm.firstName,
        lastName: newAppContactForm.lastName,
        phone: newAppContactForm.phone,
        notes: 'From staff dashboard'
      })

      const contactRes = await fetch(
        `https://restyle-backend.netlify.app/.netlify/functions/customer?${params.toString()}`
      )
      const contactData = await contactRes.json()

      let contactId = null
      if (contactData?.details?.message === 'This location does not allow duplicated contacts.' && 
          contactData?.details?.meta?.contactId) {
        contactId = contactData.details.meta.contactId
      } else if (contactData.success && contactData.contact?.contact?.id) {
        contactId = contactData.contact.contact.id
      } else {
        throw new Error('Contact creation failed')
      }

      // Book appointment
      const [year, month, day] = newAppSelectedDate.split('-').map(Number)
      const jsDate = new Date(year, month - 1, day)

      const slotMatch = newAppSelectedTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
      let hour = 9, minute = 0
      if (slotMatch) {
        hour = parseInt(slotMatch[1])
        minute = parseInt(slotMatch[2])
        const period = slotMatch[3].toUpperCase()
        if (period === 'PM' && hour !== 12) hour += 12
        if (period === 'AM' && hour === 12) hour = 0
      }

      jsDate.setHours(hour, minute, 0, 0)
      const localStartTime = jsDate

      // Get service duration - use the duration property directly
      const selectedServiceObj = newAppServices.find(s => s.value === newAppSelectedService)
      const duration = selectedServiceObj?.duration || 120 // Use duration property directly
      const localEndTime = new Date(localStartTime.getTime() + duration * 60 * 1000)

      // Convert America/Denver wall time to UTC ISO (mirror Vue logic)
      const y1 = localStartTime.getFullYear()
      const m1 = localStartTime.getMonth() + 1
      const d1 = localStartTime.getDate()
      const h1 = localStartTime.getHours()
      const min1 = localStartTime.getMinutes()
      const startTime = denverWallTimeToUtcIso(y1, m1, d1, h1, min1)
      const y2 = localEndTime.getFullYear()
      const m2 = localEndTime.getMonth() + 1
      const d2 = localEndTime.getDate()
      const h2 = localEndTime.getHours()
      const min2 = localEndTime.getMinutes()
      const endTime = denverWallTimeToUtcIso(y2, m2, d2, h2, min2)

      let assignedUserId = newAppSelectedStaff
      if (assignedUserId === 'any' || !assignedUserId) {
        const realStaff = newAppStaff.filter(item => item.value !== 'any')
        if (realStaff.length > 0) {
          assignedUserId = realStaff[Math.floor(Math.random() * realStaff.length)].value || ''
        } else {
          throw new Error('No staff available for this service')
        }
      }

      const serviceName = selectedServiceObj?.label || 'Service'
      const servicePrice = selectedServiceObj?.price || 0
      const contactName = `${newAppContactForm.firstName} ${newAppContactForm.lastName}`.trim()
      const title = `${serviceName} - ${contactName}`
      
      // Get staff name
      const staffObj = newAppStaff.find(s => s.value === assignedUserId)
      const staffName = staffObj?.label || 'Any available staff'
      
      // Build booking URL with all required parameters (matching supabase.vue)
      let bookUrl = `https://restyle-backend.netlify.app/.netlify/functions/Apointment?contactId=${contactId}&calendarId=${newAppSelectedService}&startTime=${startTime}&endTime=${endTime}&title=${encodeURIComponent(title)}`
      if (assignedUserId) bookUrl += `&assignedUserId=${assignedUserId}`
      
      // Add enhanced data parameters (matching supabase.vue)
      bookUrl += `&serviceName=${encodeURIComponent(serviceName)}`
      bookUrl += `&servicePrice=${servicePrice}`
      bookUrl += `&serviceDuration=${duration}`
      bookUrl += `&staffName=${encodeURIComponent(staffName)}`
      bookUrl += `&customerFirstName=${encodeURIComponent(newAppContactForm.firstName)}`
      bookUrl += `&customerLastName=${encodeURIComponent(newAppContactForm.lastName)}`

      // Log enhanced booking data
      console.log('📊 Enhanced Booking Data:')
      console.log('Service Name:', serviceName)
      console.log('Service Price:', servicePrice)
      console.log('Service Duration:', duration, 'minutes')
      console.log('Staff Name:', staffName)
      console.log('Staff ID:', assignedUserId)
      console.log('Customer Name:', `${newAppContactForm.firstName} ${newAppContactForm.lastName}`)
      console.log('Start Time (UTC):', startTime)
      console.log('End Time (UTC):', endTime)
      console.log('📡 Booking URL:', bookUrl)

      const bookRes = await fetch(bookUrl)
      const bookData = await bookRes.json()
      console.log('✅ Booking Response:', bookData)

      if (!bookData.response?.id) {
        throw new Error(bookData.error || 'Booking failed')
      }

      toast.success("Appointment created successfully!")
      // Close dialog and reset form first
      setNewAppointmentOpen(false)
      resetNewAppointmentForm()
      
      // Clear search term to prevent phone number from appearing in search field
      setSearchTerm("")
      
      // Clear URL params - navigate to clean appointments page
      router.replace(window.location.pathname)
      
      // Invalidate cache and force refresh
      try { localStorage.removeItem('restyle.bookings.cache') } catch {}
      await refreshBookings()
      // Refresh working slots data so the booked time is no longer offered when reopening
      try { await fetchNewAppWorkingSlots() } catch {}
    } catch (error) {
      console.error('New appointment error:', error)
      toast.error(`Failed to create booking: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setNewAppLoading(false)
    }
  }

  // Effect to fetch departments when dialog opens
  React.useEffect(() => {
    if (newAppointmentOpen) {
      fetchNewAppDepartments()
    }
  }, [newAppointmentOpen])

  // Effect to refetch working slots when staff changes
  React.useEffect(() => {
    if (newAppSelectedStaff && newAppSelectedService) {
      fetchNewAppWorkingSlots()
    }
  }, [newAppSelectedStaff])

  // Just use the data directly - filtering is done server-side now
  const filteredData = React.useMemo(() => {
    return data
  }, [data])

  const columns: ColumnDef<Booking>[] = [
    {
      accessorKey: "title",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4">
          Booking Details <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const appointment = row.original
        return (
          <div className="font-medium text-gray-900">
            {appointment.title || 'Untitled Booking'}
          </div>
        )
      },
    },
    {
      accessorKey: "startTime",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4">
          Start Time <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const startTime = row.original.startTime
        if (!startTime) return <div className="text-sm text-gray-500">—</div>
		const date = new Date(startTime)
		const now = new Date()
		const isPast = date < now
		const isToday = date.toDateString() === now.toDateString()
		// Use the same formatter as details view to avoid timezone conversion
		const formatted = formatDateTime(startTime)
		const lastCommaIndex = formatted.lastIndexOf(', ')
		const dateStr = lastCommaIndex !== -1 ? formatted.slice(0, lastCommaIndex) : formatted
		const timeStr = lastCommaIndex !== -1 ? formatted.slice(lastCommaIndex + 2) : ''
		
		return (
		  <div className="text-sm whitespace-nowrap">
			<span
			  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${
				isPast
				  ? 'bg-gray-50 text-gray-700 border-gray-200'
				  : 'bg-[#601625]/5 text-[#601625] border-[#601625]/20'
			  }`}
			>
			  <span className="font-medium">{dateStr}</span>
			  <span className="text-xs opacity-70">{timeStr}</span>
			  {isToday && (
				<span className="ml-1 inline-flex items-center rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-[10px] font-semibold">
				  Today
				</span>
			  )}
			</span>
          </div>
        )
      },
    },
    {
      accessorKey: "duration",
      header: "Duration",
      cell: ({ row }) => (
        <div className="text-sm text-gray-700">
          {row.original.durationMinutes ? `${row.original.durationMinutes} mins` : '—'}
        </div>
      ),
    },
    {
      accessorKey: "price",
      header: "Price",
      cell: ({ row }) => (
        <div className="text-sm font-medium text-gray-900">
          {row.original.price ? `$${Number(row.original.price).toFixed(2)}` : '—'}
        </div>
      ),
    },
    {
      accessorKey: "assignedStaffFirstName",
      header: "Staff",
      cell: ({ row }) => {
        const staffName = `${row.original.assignedStaffFirstName || ''} ${row.original.assignedStaffLastName || ''}`.trim()
        const fallback = row.original.assigned_user_id ? 'Assigned Staff' : 'Any available staff'
        return (
          <div className="text-sm text-gray-700">
            {staffName || fallback}
          </div>
        )
      },
    },
    {
      accessorKey: "appointment_status",
      header: "Status",
      cell: ({ row }) => {
        const status = getBookingStatus(row.original)
        const displayStatus = row.original.appointment_status || status
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeClasses(status)}`}>
            {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
          </span>
        )
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const appointment = row.original
        const status = getBookingStatus(appointment)
        const withinTwoHours = isWithinTwoHours(appointment.startTime)
        const isCancelled = status === 'cancelled'
        const isPast = status === 'past'
        
        return (
          <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelected(appointment)
              setDetailsOpen(true)
              fetchGHLBookingDetails(appointment.id)
            }}
              className="h-8 px-3 text-xs hover:bg-[#601625] hover:text-white transition-colors"
          >
              View
          </Button>
            {!isCancelled && !isPast && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  title="Reschedule appointment"
                  onClick={() => handleRescheduleBooking(appointment)}
                  className="h-8 px-3 text-xs hover:bg-[#601625] hover:text-white transition-colors"
                >
                  Reschedule
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={withinTwoHours}
                  title={withinTwoHours ? "Cannot cancel - appointment starts within 2 hours" : "Cancel appointment"}
                  onClick={() => handleCancelBooking(appointment)}
                  className="h-8 px-3 text-xs hover:bg-red-600 hover:text-white transition-colors disabled:opacity-50"
                >
                  Cancel
                </Button>
              </>
            )}
          </div>
        )
      },
    },
  ]

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <RoleGuard>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <div className="flex items-center justify-between w-full px-4">
              <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <h1 className="text-xl font-semibold">Appointments</h1>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => refreshBookings()} 
                  title="Refresh appointments"
                  className="border-gray-300 hover:bg-[#601625] hover:text-white hover:border-[#601625]"
                >
                  <RefreshCcw className="h-4 w-4" />
                </Button>
                {/* Desktop add button */}
                <Button 
                  onClick={() => setNewAppointmentOpen(true)} 
                  className="hidden sm:inline-flex bg-[#601625] text-white hover:bg-[#4a1119]"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Add Appointment
                </Button>
                {/* Mobile three-dot menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild className="sm:hidden">
                    <Button variant="outline" size="icon" className="h-10 w-10">
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => setNewAppointmentOpen(true)}>
                      <Calendar className="h-4 w-4 mr-2" /> Add Appointment
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>
          
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            {/* Search Bar and Status Tabs */}
            <Card className="border-neutral-200 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by customer, staff, service, or phone..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 h-11 border-gray-300 focus:border-primary focus:ring-primary"
                    />
                  </div>
                  {searchTerm && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSearchTerm("")}
                      className="h-11 px-4 border-gray-300 hover:bg-primary hover:text-white"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reset
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Status Tabs - Upcoming / Past / Confirmed / Cancelled */}
            <div className="flex gap-2 flex-nowrap overflow-x-auto py-1">
              <button
                onClick={() => handleTabChange('upcoming')}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs lg:px-6 lg:py-3 lg:text-sm rounded-full border transition-colors shrink-0 ${
                  statusFilter === 'upcoming'
                    ? 'bg-[#601625]/10 text-[#601625] border-[#601625]/30'
                    : 'bg-white text-neutral-700 border-gray-200 hover:bg-neutral-50'
                }`}
              >
                <Calendar className="hidden lg:inline-block h-4 w-4" />
                Upcoming
                {paginationState.upcoming?.total > 0 && (
                  <Badge variant="secondary" className="hidden lg:inline-flex ml-2 bg-[#601625]/10 text-[#601625] border-[#601625]/20 text-[10px] px-2 py-0.5">
                    {paginationState.upcoming.total}
                  </Badge>
                )}
              </button>
              <button
                onClick={() => handleTabChange('past')}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs lg:px-6 lg:py-3 lg:text-sm rounded-full border transition-colors shrink-0 ${
                  statusFilter === 'past'
                    ? 'bg-gray-50 text-gray-700 border-gray-300'
                    : 'bg-white text-neutral-700 border-gray-200 hover:bg-neutral-50'
                }`}
              >
                <Clock className="hidden lg:inline-block h-4 w-4" />
                Past
                {paginationState.past?.total > 0 && (
                  <Badge variant="secondary" className="hidden lg:inline-flex ml-2 bg-gray-100 text-gray-600 border-gray-200 text-[10px] px-2 py-0.5">
                    {paginationState.past.total}
                  </Badge>
                )}
              </button>
              <button
                onClick={() => handleTabChange('confirmed')}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs lg:px-6 lg:py-3 lg:text-sm rounded-full border transition-colors shrink-0 ${
                  statusFilter === 'confirmed'
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-white text-neutral-700 border-gray-200 hover:bg-neutral-50'
                }`}
              >
                <CheckCircle className="hidden lg:inline-block h-4 w-4" />
                Confirmed
                {paginationState.confirmed?.total > 0 && (
                  <Badge variant="secondary" className="hidden lg:inline-flex ml-2 bg-green-100 text-green-600 border-green-200 text-[10px] px-2 py-0.5">
                    {paginationState.confirmed.total}
                  </Badge>
                )}
              </button>
              <button
                onClick={() => handleTabChange('cancelled')}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs lg:px-6 lg:py-3 lg:text-sm rounded-full border transition-colors shrink-0 ${
                  statusFilter === 'cancelled'
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-white text-neutral-700 border-gray-200 hover:bg-neutral-50'
                }`}
              >
                <XCircle className="hidden lg:inline-block h-4 w-4" />
                Cancelled
                {paginationState.cancelled?.total > 0 && (
                  <Badge variant="secondary" className="hidden lg:inline-flex ml-2 bg-red-100 text-red-600 border-red-200 text-[10px] px-2 py-0.5">
                    {paginationState.cancelled.total}
                  </Badge>
                )}
              </button>
            </div>

            {/* Appointments Table / Mobile Cards */}
            <Card className="border-neutral-200 shadow-sm p-1 bg-[#601625]/5 ">
              <CardHeader className="border-b border-neutral-200 p-2 bg-[#601625]/5 ">
                <div className="flex items-center justify-between">
                  <div className="hidden lg:block text-sm font-medium text-neutral-900">
                    Appointments List
                  </div>
                  
                  {/* Top Pagination */}
                  {(() => {
                    const currentTabState = paginationState[statusFilter]
                    const tabTotalPages = currentTabState?.totalPages || 1
                    const tabCurrentPage = currentTabState?.page || 1
                    
                    if (tabTotalPages <= 1) return null
                    
                    return (
                    <div className="hidden lg:flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                          onClick={() => {
                            const newPage = Math.max(1, tabCurrentPage - 1)
                            setPaginationState(prev => ({
                              ...prev,
                              [statusFilter]: { ...prev[statusFilter], page: newPage }
                            }))
                          }}
                          disabled={tabCurrentPage === 1}
                        className="h-8 border-gray-300 hover:bg-[#601625] hover:text-white hover:border-[#601625] disabled:opacity-50"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      
                      {/* Page numbers */}
                        {Array.from({ length: Math.min(5, tabTotalPages) }, (_, i) => {
                        let pageNum
                          if (tabTotalPages <= 5) {
                          pageNum = i + 1
                          } else if (tabCurrentPage <= 3) {
                          pageNum = i + 1
                          } else if (tabCurrentPage >= tabTotalPages - 2) {
                            pageNum = tabTotalPages - 4 + i
                        } else {
                            pageNum = tabCurrentPage - 2 + i
                        }
                        
                        return (
                          <Button
                            key={pageNum}
                              variant={tabCurrentPage === pageNum ? "default" : "outline"}
                            size="sm"
                              onClick={() => {
                                setPaginationState(prev => ({
                                  ...prev,
                                  [statusFilter]: { ...prev[statusFilter], page: pageNum }
                                }))
                              }}
                            className={`h-8 w-8 p-0 ${
                                tabCurrentPage === pageNum 
                                ? "bg-[#601625] text-white border-[#601625] hover:bg-[#4a1119]" 
                                : "border-gray-300 hover:bg-[#601625] hover:text-white hover:border-[#601625]"
                            }`}
                          >
                            {pageNum}
                          </Button>
                        )
                      })}

                      <Button
                        variant="outline"
                        size="sm"
                          onClick={() => {
                            const newPage = Math.min(tabTotalPages, tabCurrentPage + 1)
                            setPaginationState(prev => ({
                              ...prev,
                              [statusFilter]: { ...prev[statusFilter], page: newPage }
                            }))
                          }}
                          disabled={tabCurrentPage === tabTotalPages}
                        className="h-8 border-gray-300 hover:bg-[#601625] hover:text-white hover:border-[#601625] disabled:opacity-50"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                    )
                  })()}
                </div>

                {/* Mobile pager with primary styling */}
                {(() => {
                  const currentTabState = paginationState[statusFilter]
                  const tabTotalPages = currentTabState?.totalPages || 1
                  const tabCurrentPage = currentTabState?.page || 1
                  if (tabTotalPages <= 1) return null
                  return (
                    <div className="lg:hidden">
                    
                      <div className="flex items-center justify-between px-0 py-1.5">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            const newPage = Math.max(1, tabCurrentPage - 1)
                            setPaginationState(prev => ({
                              ...prev,
                              [statusFilter]: { ...prev[statusFilter], page: newPage }
                            }))
                          }}
                          disabled={tabCurrentPage === 1}
                          className="h-8 w-8 border-[#601625]/30 text-[#601625] hover:bg-[#601625] hover:text-white hover:border-[#601625]"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex flex-col items-center">
                          <div className="text-xs uppercase tracking-wide text-[#601625] font-semibold">Page</div>
                          <div className="text-sm text-neutral-900 -mt-0.5"><span className="font-semibold">{tabCurrentPage}</span> / {tabTotalPages}</div>
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            const newPage = Math.min(tabTotalPages, tabCurrentPage + 1)
                            setPaginationState(prev => ({
                              ...prev,
                              [statusFilter]: { ...prev[statusFilter], page: newPage }
                            }))
                          }}
                          disabled={tabCurrentPage === tabTotalPages}
                          className="h-8 w-8 border-[#601625]/30 text-[#601625] hover:bg-[#601625] hover:text-white hover:border-[#601625]"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })()}
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="space-y-2 p-6">
                    {[...Array(10)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="rounded-md border-0 hidden lg:block">
                    <Table>
                      <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id} className="bg-gray-50 border-b border-gray-200 hover:bg-gray-50">
                              {headerGroup.headers.map((header, index) => (
                                <TableHead 
                                  key={header.id} 
                                  className={`font-semibold text-gray-700 ${index === 0 ? 'pl-6' : ''}`}
                                >
                                {header.isPlaceholder
                                  ? null
                                  : flexRender(header.column.columnDef.header, header.getContext())}
                              </TableHead>
                            ))}
                          </TableRow>
                        ))}
                      </TableHeader>
                      <TableBody>
                        {table.getRowModel().rows?.length ? (
                          table.getRowModel().rows.map((row) => (
                              <TableRow 
                                key={row.id} 
                                data-state={row.getIsSelected() && "selected"}
                                className="border-b border-gray-100 hover:bg-[#601625]/5 transition-colors"
                              >
                                {row.getVisibleCells().map((cell, index) => (
                                  <TableCell key={cell.id} className={`py-4 ${index === 0 ? 'pl-6' : ''}`}>
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                              <TableCell colSpan={columns.length} className="h-32 text-center">
                                <div className="flex flex-col items-center justify-center gap-2 text-gray-500">
                                  <Calendar className="h-10 w-10 text-gray-400" />
                                  <p className="text-sm font-medium">No appointments found</p>
                                  <p className="text-xs">Try adjusting your filters</p>
                                </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                    </div>

                    {/* Mobile cards */}
                    <div className="lg:hidden p-3 space-y-3">
                      {data.map((row) => (
                        <div key={row.id} className="bg-white rounded-2xl ring-1 ring-neutral-200 p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-2 bg-[#601625] rounded-full" />
                              <div>
                                <div className="text-[15px] font-semibold text-gray-900 leading-tight">{row.serviceName || row.title || 'Untitled Service'}</div>
                                <div className="text-[11px] text-gray-500 mt-1">{formatDateTime(row.startTime)}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              {row.price ? (
                                <div className="text-[20px] font-bold text-gray-900">${Number(row.price).toFixed(2)}</div>
                              ) : null}
                              <div className="flex items-center justify-end gap-2 mt-1">
                                <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium border ${getStatusBadgeClasses(getBookingStatus(row))}`}
                                >
                                  {getBookingStatus(row).charAt(0).toUpperCase() + getBookingStatus(row).slice(1)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="text-[13px] text-gray-900">
                              <span className="text-[12px] font-semibold text-gray-800 mr-1">Staff :</span>
                              {`${row.assignedStaffFirstName || ''} ${row.assignedStaffLastName || ''}`.trim() || 'Any available staff'}
                            </div>
                            <div>
                              <div className="text-[13px] font-semibold text-gray-900 break-words">
                                <span className="font-semibold text-gray-800">Customer -</span> {row.contactName || 'Unknown'}
                              </div>
                              {row.contactPhone && (
                                <div className="text-[12px] text-neutral-600 mt-0.5 break-words">({row.contactPhone})</div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-start gap-2 pt-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-lg px-2 text-[12px] font-medium"
                              onClick={() => {
                                setSelected(row)
                                setDetailsOpen(true)
                                fetchGHLBookingDetails(row.id)
                              }}
                            >
                              View
                            </Button>
                            {getBookingStatus(row) !== 'cancelled' && getBookingStatus(row) !== 'past' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 rounded-lg px-2 text-[12px] font-medium"
                                  onClick={() => handleRescheduleBooking(row)}
                                >
                                  Reschedule
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 rounded-lg px-2 text-[12px] font-medium text-red-700 border-red-300 hover:bg-red-50 hover:border-red-400"
                                  onClick={() => handleCancelBooking(row)}
                                >
                                  Cancel
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Bottom Pagination with Info */}
                    {(() => {
                      const currentTabState = paginationState[statusFilter]
                      const tabTotalPages = currentTabState?.totalPages || 1
                      const tabCurrentPage = currentTabState?.page || 1
                      const tabTotal = currentTabState?.total || 0
                      
                      if (tabTotalPages <= 1) return null
                      
                      return (
                      <div className="hidden lg:flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-gray-50">
                        <div className="flex items-center gap-2 text-sm text-neutral-600">
                            <span>Showing {((tabCurrentPage - 1) * 20) + 1}-{Math.min(tabCurrentPage * 20, tabTotal)} of {tabTotal}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                              onClick={() => {
                                const newPage = Math.max(1, tabCurrentPage - 1)
                                setPaginationState(prev => ({
                                  ...prev,
                                  [statusFilter]: { ...prev[statusFilter], page: newPage }
                                }))
                              }}
                              disabled={tabCurrentPage === 1}
                            className="h-8 border-gray-300 hover:bg-[#601625] hover:text-white hover:border-[#601625] disabled:opacity-50"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          
                          {/* Page numbers */}
                            {Array.from({ length: Math.min(5, tabTotalPages) }, (_, i) => {
                            let pageNum
                              if (tabTotalPages <= 5) {
                              pageNum = i + 1
                              } else if (tabCurrentPage <= 3) {
                              pageNum = i + 1
                              } else if (tabCurrentPage >= tabTotalPages - 2) {
                                pageNum = tabTotalPages - 4 + i
                            } else {
                                pageNum = tabCurrentPage - 2 + i
                            }
                            
                            return (
                              <Button
                                key={pageNum}
                                  variant={tabCurrentPage === pageNum ? "default" : "outline"}
                                size="sm"
                                  onClick={() => {
                                    setPaginationState(prev => ({
                                      ...prev,
                                      [statusFilter]: { ...prev[statusFilter], page: pageNum }
                                    }))
                                  }}
                                className={`h-8 w-8 p-0 ${
                                    tabCurrentPage === pageNum 
                                    ? "bg-[#601625] text-white border-[#601625] hover:bg-[#4a1119]" 
                                    : "border-gray-300 hover:bg-[#601625] hover:text-white hover:border-[#601625]"
                                }`}
                              >
                                {pageNum}
                              </Button>
                            )
                          })}

                          <Button
                            variant="outline"
                            size="sm"
                              onClick={() => {
                                const newPage = Math.min(tabTotalPages, tabCurrentPage + 1)
                                setPaginationState(prev => ({
                                  ...prev,
                                  [statusFilter]: { ...prev[statusFilter], page: newPage }
                                }))
                              }}
                              disabled={tabCurrentPage === tabTotalPages}
                            className="h-8 border-gray-300 hover:bg-[#601625] hover:text-white hover:border-[#601625] disabled:opacity-50"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                  </div>
                      )
                    })()}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Appointment Details Drawer */}
          <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
            <SheetContent side="right" className="w-full sm:max-w-xl bg-gradient-to-br from-white to-gray-50 p-0 overflow-hidden [&>button]:text-white [&>button]:hover:bg-white/20 [&>button]:top-6 [&>button]:right-6">
              {selected && (
                <div className="flex flex-col h-full">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-[#601625] to-[#751a29] px-6 py-5 text-white">
                    <SheetHeader>
                      <SheetTitle className="text-xl font-bold text-white mb-1">
                        Appointment Details
                </SheetTitle>
                      <SheetDescription className="text-white/80 text-sm">
                        {selected.title || 'Booking Information'}
                </SheetDescription>
              </SheetHeader>
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                    {/* Status Badge */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">Status</span>
                      <Badge 
                        className={`text-xs font-semibold px-3 py-1 ${getStatusBadgeClasses(getBookingStatus(selected))}`}
                      >
                            {selected.appointment_status?.charAt(0).toUpperCase() + selected.appointment_status?.slice(1) || 'Unknown'}
                          </Badge>
                    </div>

                    <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>

                    {/* Details Grid */}
                    <div className="space-y-4">
                      {/* Service */}
                      <div className="group hover:bg-white hover:shadow-sm rounded-lg p-3 transition-all">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Service</label>
                        <p className="mt-1 text-base font-medium text-gray-900">
                          {selected.serviceName || selected.title || 'Untitled Service'}
                        </p>
                    </div>

                      {/* Customer */}
                      <div className="group hover:bg-white hover:shadow-sm rounded-lg p-3 transition-all">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</label>
                        <p className="mt-1 text-base font-medium text-gray-900">
                          {selected.contactName || 'Unknown Customer'}
                        </p>
                      {selected.contactPhone && (
                          <p className="text-sm text-gray-600 mt-0.5">{selected.contactPhone}</p>
                      )}
                    </div>

                      {/* Staff */}
                      <div className="group hover:bg-white hover:shadow-sm rounded-lg p-3 transition-all">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Assigned Staff</label>
                        <p className="mt-1 text-base font-medium text-gray-900">
                          {`${selected.assignedStaffFirstName || ''} ${selected.assignedStaffLastName || ''}`.trim() || 'Any available staff'}
                        </p>
                      </div>

                      {/* Time Details */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="group hover:bg-white hover:shadow-sm rounded-lg p-3 transition-all">
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Start Time</label>
                          {loadingDetails ? (
                            <Skeleton className="h-5 w-32 mt-1" />
                          ) : (
                      <p className="mt-1 text-sm font-medium text-[#601625]">
                              {ghlBookingDetails?.appointment && (ghlBookingDetails.appointment as Record<string, unknown>).startTime 
                                ? formatDateTime(String((ghlBookingDetails.appointment as Record<string, unknown>).startTime)) 
                                : formatDateTime(selected.startTime)}
                            </p>
                          )}
                        </div>
                        <div className="group hover:bg-white hover:shadow-sm rounded-lg p-3 transition-all">
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Duration</label>
                          <p className="mt-1 text-sm font-medium text-gray-900">
                            {selected.durationMinutes ? `${selected.durationMinutes} mins` : formatDuration(selected.startTime, selected.endTime)}
                      </p>
                    </div>
                  </div>

                      {/* Price */}
                      {selected.price && (
                        <div className="group hover:bg-white hover:shadow-sm rounded-lg p-3 transition-all">
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Price</label>
                          <p className="mt-1 text-2xl font-bold text-[#601625]">
                            ${Number(selected.price).toFixed(2)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="border-t border-gray-200 bg-white px-6 py-4">
                    {getBookingStatus(selected) !== 'cancelled' && getBookingStatus(selected) !== 'past' ? (
                      <>
                        <div className="flex gap-3">
                          <Button
                            onClick={() => {
                              setDetailsOpen(false)
                              handleRescheduleBooking(selected)
                            }}
                            className="flex-1 bg-[#601625] hover:bg-[#4a1119] text-white h-11 font-medium shadow-lg shadow-[#601625]/20"
                          >
                            <Calendar className="h-4 w-4 mr-2" />
                            Reschedule
                          </Button>
                          <Button
                            onClick={() => {
                              setDetailsOpen(false)
                              handleCancelBooking(selected)
                            }}
                            disabled={isWithinTwoHours(selected.startTime)}
                            variant="outline"
                            className="flex-1 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 h-11 font-medium"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Cancel
                          </Button>
                        </div>
                        {isWithinTwoHours(selected.startTime) && (
                          <p className="text-xs text-gray-500 text-center mt-3">
                            ⚠️ Cancellation disabled - appointment starts within 2 hours
                          </p>
                        )}
                      </>
                    ) : (
                        <Button
                          onClick={() => {
                            setDetailsOpen(false)
                            handleDeleteBooking(selected)
                          }}
                        variant="outline"
                        className="w-full border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 h-11 font-medium"
                        >
                        Delete Appointment
                        </Button>
                    )}
                  </div>
                </div>
              )}
            </SheetContent>
          </Sheet>

          {/* Cancel Confirmation Dialog */}
          <ConfirmDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
            <ConfirmContent>
              <ConfirmHeader>
                <ConfirmTitle>Cancel Appointment</ConfirmTitle>
              </ConfirmHeader>
              <div className="py-4">
                <p>Are you sure you want to cancel this appointment?</p>
                {bookingToCancel && (
                  <div className="mt-2 p-3 bg-muted rounded-md">
                    <p className="font-medium">{bookingToCancel.serviceName}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(bookingToCancel.startTime)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Customer: {bookingToCancel.contactName || 'Unknown'}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setCancelConfirmOpen(false)}
                  disabled={cancelLoading}
                >
                  Keep Appointment
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmCancelBooking}
                  disabled={cancelLoading}
                >
                  {cancelLoading ? "Cancelling..." : "Cancel Appointment"}
                </Button>
              </div>
            </ConfirmContent>
          </ConfirmDialog>

          {/* Delete Confirmation Dialog */}
          <ConfirmDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
            <ConfirmContent>
              <ConfirmHeader>
                <ConfirmTitle>Delete Appointment</ConfirmTitle>
              </ConfirmHeader>
              <div className="py-4">
                <p className="text-red-600 font-medium">⚠️ This action cannot be undone!</p>
                <p className="mt-2">Are you sure you want to permanently delete this booking?</p>
                {bookingToDelete && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="font-medium text-red-800">{bookingToDelete.serviceName}</p>
                    <p className="text-sm text-red-700">
                      {formatDateTime(bookingToDelete.startTime)}
                    </p>
                    <p className="text-sm text-red-700">
                      Customer: {bookingToDelete.contactName || 'Unknown'}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirmOpen(false)}
                  disabled={deleteLoading}
                >
                  Keep Appointment
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmDeleteBooking}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? "Deleting..." : "Delete Permanently"}
                </Button>
              </div>
            </ConfirmContent>
          </ConfirmDialog>

          {/* Reschedule Dialog - Simplified Dashboard Style */}
          <ConfirmDialog open={rescheduleOpen} onOpenChange={(open) => {
            setRescheduleOpen(open)
            if (!open) {
              resetRescheduleForm()
            }
          }}>
            <ConfirmContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
              <ConfirmHeader>
                <ConfirmTitle>Reschedule Appointment</ConfirmTitle>
              </ConfirmHeader>
              
              <div className="space-y-6">
                {/* Current Appointment Info */}
                {bookingToReschedule && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-semibold mb-2">Current Appointment Details</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Service:</span> {bookingToReschedule.serviceName || bookingToReschedule.title}
                      </div>
                      <div>
                        <span className="font-medium">Date & Time:</span> {formatDateTime(bookingToReschedule.startTime)}
                      </div>
                      <div>
                        <span className="font-medium">Staff:</span> {bookingToReschedule.assignedStaffFirstName} {bookingToReschedule.assignedStaffLastName}
                      </div>
                      <div>
                        <span className="font-medium">Customer:</span> {bookingToReschedule.contactName}
                      </div>
                    </div>
                  </div>
                )}

                {/* Staff Selection - Full Width Row */}
                <div className="space-y-3 mb-6">
                  <Label className="text-sm font-medium">Select Staff Member</Label>
                  {loadingStaff ? (
                    <Skeleton className="h-12 w-full" />
                  ) : (
                    <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose a staff member" />
                      </SelectTrigger>
                      <SelectContent>
                        {staffOptions.map((staff) => (
                          <SelectItem key={staff.value} value={staff.value}>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              {staff.label}
                              {staff.badge && (
                                <Badge variant="secondary" className="text-xs">
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
                    <Label className="text-sm font-medium">Select Date</Label>
                    {loadingSlots ? (
                      <div className="h-60 rounded-lg bg-gray-100 animate-pulse" />
                    ) : (
                      <div className="border rounded-lg p-3 max-h-60 overflow-y-auto">
                        <div className="grid grid-cols-7 gap-1 text-xs">
                          {availableDates.map((date) => (
                            <div
                              key={date.dateString}
                              onClick={() => setSelectedDate(date.dateString)}
                              className={`p-2 text-center cursor-pointer rounded transition-colors ${
                                selectedDate === date.dateString
                                  ? 'bg-primary text-primary-foreground'
                                  : 'hover:bg-gray-100'
                              }`}
                            >
                              <div className="font-medium">{date.dayName}</div>
                              <div>{date.dateDisplay}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Time Selection */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Select Time</Label>
                    {selectedDate ? (
                      <div className="border rounded-lg p-3 max-h-60 overflow-y-auto">
                        <div className="grid grid-cols-2 gap-1">
                          {availableSlots.map((slot) => (
                            <Button
                              key={slot.time}
                              variant={selectedTime === slot.time ? "default" : "ghost"}
                              size="sm"
                              onClick={() => setSelectedTime(slot.time)}
                              className={`text-xs justify-center ${
                                selectedTime === slot.time ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""
                              }`}
                            >
                              {slot.time}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="h-60 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-500">
                        Select a date first
                      </div>
                    )}
                  </div>
                </div>

                {/* Summary */}
                {selectedDate && selectedTime && selectedStaff && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="font-medium mb-2 text-green-800">New Appointment Summary</h4>
                    <div className="grid grid-cols-3 gap-4 text-sm text-green-700">
                      <div>
                        <span className="font-medium">Staff:</span> {staffOptions.find(s => s.value === selectedStaff)?.label}
                      </div>
                      <div>
                        <span className="font-medium">Date:</span> {new Date(selectedDate).toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
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
                  >
                    Cancel
                  </Button>
                  
                  <Button
                    onClick={confirmReschedule}
                    disabled={!selectedDate || !selectedTime || !selectedStaff || rescheduleLoading}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {rescheduleLoading ? 'Rescheduling...' : 'Confirm Reschedule'}
                  </Button>
                </div>
              </div>
            </ConfirmContent>
          </ConfirmDialog>

          {/* New Appointment Dialog */}
          <AppointmentNew
            open={newAppointmentOpen}
            onOpenChange={(open) => {
              setNewAppointmentOpen(open)
              if (!open) {
                resetNewAppointmentForm()
                const params = new URLSearchParams(Array.from(searchParams?.entries?.() || []))
                params.delete('openBooking')
                params.delete('date')
                params.delete('hour')
                params.delete('minute')
                router.replace(`?${params.toString()}`)
              }
            }}
            currentStep={newAppCurrentStep}
            goToNextStep={goToNextNewAppStep}
            goToPrevStep={goToPrevNewAppStep}
            loadingDepts={newAppLoadingDepts}
            departments={newAppDepartments}
            selectedDepartment={newAppSelectedDepartment}
            setSelectedDepartment={setNewAppSelectedDepartment}
            onDepartmentSelect={handleNewAppDepartmentSelect}
            loadingServices={newAppLoadingServices}
            services={newAppServices}
            selectedService={newAppSelectedService}
            onServiceSelect={handleNewAppServiceSelect}
            loadingStaff={newAppLoadingStaff}
            staff={newAppStaff}
            selectedStaff={newAppSelectedStaff}
            onStaffSelect={handleNewAppStaffSelect}
            loadingDates={newAppLoadingDates}
            dates={newAppDates}
            selectedDate={newAppSelectedDate}
            onDateSelect={handleNewAppDateSelect}
            loadingSlots={newAppLoadingSlots}
            slots={newAppSlots}
            selectedTime={newAppSelectedTime}
            onTimeSelect={handleNewAppTimeSelect}
            contactForm={newAppContactForm}
            setContactForm={setNewAppContactForm}
            submitting={newAppLoading}
            onSubmit={submitNewAppointment}
            formatServiceDuration={formatServiceDuration}
            formatSelectedDate={formatSelectedDate}
          />
        </SidebarInset>
      </SidebarProvider>
    </RoleGuard>
  )
}

export default function BookingsPage() {
  return (
    <React.Suspense fallback={<div className="p-4">Loading…</div>}>
      <BookingsPageInner />
    </React.Suspense>
  )
}
