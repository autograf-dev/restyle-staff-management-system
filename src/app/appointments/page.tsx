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
import { ArrowUpDown, Search, Calendar, Clock, User, MapPin, ChevronLeft, ChevronRight } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { toast } from "sonner"
import { Dialog as ConfirmDialog, DialogContent as ConfirmContent, DialogHeader as ConfirmHeader, DialogTitle as ConfirmTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useRouter, useSearchParams } from "next/navigation"
import { useUser } from "@/contexts/user-context"

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
  // Enriched data
  serviceName?: string
  startTime?: string
  endTime?: string
  assignedStaffFirstName?: string
  assignedStaffLastName?: string
  contactName?: string
  contactPhone?: string
}

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

function useAppointments() {
  const [data, setData] = React.useState<Appointment[]>([])
  const [loading, setLoading] = React.useState<boolean>(true)
  const [currentPage, setCurrentPage] = React.useState<number>(1)
  const [totalPages, setTotalPages] = React.useState<number>(1)
  const [total, setTotal] = React.useState<number>(0)
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [searchTerm, setSearchTerm] = React.useState<string>("")
  const isInitialMount = React.useRef(true)
  const isMounted = React.useRef(false)

  React.useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  const fetchAppointments = React.useCallback(async () => {
    if (!isMounted.current) return
    
    // Set loading state only if component is still mounted
    if (isMounted.current) {
      setLoading(true)
    }
    
    const controller = new AbortController()
    const { signal } = controller

    try {
      const res = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/getAllBookings`, { signal })
      if (!res.ok) throw new Error("Failed to fetch appointments")
      const json = await res.json()
      
      const bookings: RawAppointment[] = json.bookings || []
      
      // Helper function to delay execution with abort check
      const delay = (ms: number) => new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (signal.aborted) {
            reject(new Error('Aborted'))
          } else {
            resolve(undefined)
          }
        }, ms)
        
        if (signal.aborted) {
          clearTimeout(timeout)
          reject(new Error('Aborted'))
        }
      })
      
      // Helper function to process bookings in batches with abort checks
      const processInBatches = async <T,>(items: T[], batchSize: number, processor: (item: T) => Promise<Appointment>) => {
        const results = []
        for (let i = 0; i < items.length; i += batchSize) {
          // Check if aborted before processing each batch
          if (signal.aborted) {
            throw new Error('Aborted')
          }
          
          const batch = items.slice(i, i + batchSize)
          const batchResults = await Promise.all(batch.map(processor))
          results.push(...batchResults)
          
          // Small delay between batches with abort check
          if (i + batchSize < items.length && !signal.aborted) {
            await delay(100)
          }
        }
        return results
      }

      // Process bookings in smaller batches (10 at a time)
      const enrichedBookings = await processInBatches(bookings, 10, async (booking: RawAppointment) => {
        // Check abort status before processing each booking
        if (signal.aborted) {
          throw new Error('Aborted')
        }

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
        }

        // Use the existing title as service name
        details.serviceName = booking.title || 'Untitled Service'

        // Fetch appointment details for times (with error handling and abort check)
        if (!signal.aborted) {
          try {
            const apptRes = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/getBooking?id=${booking.id}`, { signal })
            if (apptRes.ok && !signal.aborted) {
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
            if (!signal.aborted) {
              console.warn(`Failed to fetch booking details for ${booking.id}:`, error)
            }
          }
        }

        // Fetch staff details (with error handling and abort check)
        if (details.assigned_user_id && !signal.aborted) {
          try {
            const staffRes = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/Staff?id=${details.assigned_user_id}`, { signal })
            if (staffRes.ok && !signal.aborted) {
              const staffData = await staffRes.json()
              if (staffData.firstName) {
                details.assignedStaffFirstName = staffData.firstName
                details.assignedStaffLastName = staffData.lastName
              }
            }
          } catch (error) {
            if (!signal.aborted) {
              console.warn(`Failed to fetch staff details for ${details.assigned_user_id}:`, error)
            }
          }
        }

        // Fetch contact details (with error handling and abort check)
        if (booking.contact_id && !signal.aborted) {
          try {
            const contactRes = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/getContact?id=${booking.contact_id}`, { signal })
            if (contactRes.ok && !signal.aborted) {
              const contactData = await contactRes.json()
              if (contactData.contact) {
                details.contactName = `${contactData.contact.firstName || ""} ${contactData.contact.lastName || ""}`.trim()
                details.contactPhone = contactData.contact.phone
              }
            }
          } catch (error) {
            if (!signal.aborted) {
              console.warn(`Failed to fetch contact details for ${booking.contact_id}:`, error)
            }
          }
        }

        return details
      })

      // Only update state if component is still mounted and request wasn't aborted
      if (isMounted.current && !signal.aborted) {
        setData(enrichedBookings)
        setTotal(json.totalBookings || enrichedBookings.length)
        setTotalPages(Math.ceil((json.totalBookings || enrichedBookings.length) / 20))
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Request was intentionally aborted, don't show error
        return
      } else {
        console.error("Failed to fetch appointments:", error)
        if (isMounted.current) {
          toast.error("Failed to load appointments")
        }
      }
    } finally {
      // Only update loading state if component is still mounted
      if (isMounted.current) {
        setLoading(false)
      }
    }

    // Return cleanup function to abort requests
    return () => {
      controller.abort()
    }
  }, [])

  React.useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      const cleanup = fetchAppointments()
      return () => {
        // Call cleanup function if it exists
        if (cleanup && typeof cleanup.then === 'function') {
          cleanup.then(cleanupFn => {
            if (typeof cleanupFn === 'function') {
              cleanupFn()
            }
          })
        }
      }
    }
  }, [fetchAppointments])

  return { 
    data, 
    loading, 
    setData, 
    currentPage, 
    setCurrentPage, 
    totalPages, 
    total, 
    fetchAppointments,
    statusFilter,
    setStatusFilter,
    searchTerm,
    setSearchTerm
  }
}

function formatDateTime(isoString?: string) {
  if (!isoString) return 'N/A'
  try {
    const date = new Date(isoString)
    return date.toLocaleString('en-US', {
      timeZone: 'America/Edmonton',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    })
  } catch {
    return isoString
  }
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

function getAppointmentStatus(appointment: Appointment) {
  const status = (appointment.appointment_status || '').toLowerCase()
  const now = new Date()
  const startTime = appointment.startTime ? new Date(appointment.startTime) : null
  
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

function AppointmentsPageInner() {
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
    fetchAppointments
  } = useAppointments()

  const [selected, setSelected] = React.useState<Appointment | null>(null)
  const [detailsOpen, setDetailsOpen] = React.useState(false)
  // (moved) Effects for deep-linking placed after new-appointment state
  const [cancelConfirmOpen, setCancelConfirmOpen] = React.useState(false)
  const [appointmentToCancel, setAppointmentToCancel] = React.useState<Appointment | null>(null)
  const [cancelLoading, setCancelLoading] = React.useState(false)

  // Delete booking state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false)
  const [appointmentToDelete, setAppointmentToDelete] = React.useState<Appointment | null>(null)
  const [deleteLoading, setDeleteLoading] = React.useState(false)

  // Reschedule state
  const [rescheduleOpen, setRescheduleOpen] = React.useState(false)
  const [appointmentToReschedule, setAppointmentToReschedule] = React.useState<Appointment | null>(null)
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
  const [newAppServices, setNewAppServices] = React.useState<Array<{ id?: string; name?: string; duration?: number; label?: string; value?: string; description?: string }>>([])
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

  // Open details dialog or new appointment dialog when query params exist
  React.useEffect(() => {
    const view = searchParams?.get("view")
    const id = searchParams?.get("id")
    if (view === "details" && id && data.length > 0) {
      const found = data.find((a) => a.id === id)
      if (found) {
        setSelected(found)
        setDetailsOpen(true)
      }
    } else if (view === "new") {
      setNewAppointmentOpen(true)
    }
  }, [searchParams, data])

  // Keep URL in sync when dialog opens/closes
  React.useEffect(() => {
    if (detailsOpen && selected) {
      const params = new URLSearchParams(Array.from(searchParams?.entries?.() || []))
      params.set("view", "details")
      params.set("id", selected.id)
      router.replace(`?${params.toString()}`)
    } else if (newAppointmentOpen) {
      const params = new URLSearchParams(Array.from(searchParams?.entries?.() || []))
      params.set("view", "new")
      router.replace(`?${params.toString()}`)
    } else {
      const params = new URLSearchParams(Array.from(searchParams?.entries?.() || []))
      params.delete("view")
      params.delete("id")
      const qs = params.toString()
      router.replace(qs ? `?${qs}` : "")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailsOpen, selected, newAppointmentOpen])

  // Helper function to check if appointment is within 2 hours
  const isWithinTwoHours = (startTime?: string) => {
    if (!startTime) return false
    const start = new Date(startTime)
    const now = new Date()
    return start.getTime() <= now.getTime() + 2 * 60 * 60 * 1000
  }

  // Cancel booking function
  const handleCancelBooking = async (appointment: Appointment) => {
    if (isWithinTwoHours(appointment.startTime)) {
      toast.error("Cannot cancel - booking starts within 2 hours")
      return
    }
    setAppointmentToCancel(appointment)
    setCancelConfirmOpen(true)
  }

  const confirmCancelBooking = async () => {
    if (!appointmentToCancel) return
    
    setCancelLoading(true)
    try {
      const res = await fetch("https://restyle-api.netlify.app/.netlify/functions/cancelbooking", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bookingId: appointmentToCancel.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Cancel failed")
      
      // Refresh appointments
      await fetchAppointments()
      toast.success("Appointment cancelled successfully")
      setCancelConfirmOpen(false)
      setAppointmentToCancel(null)
    } catch (error) {
      console.error(error)
      toast.error(`Cancellation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setCancelLoading(false)
    }
  }

  // Delete booking functions
  const handleDeleteBooking = async (appointment: Appointment) => {
    setAppointmentToDelete(appointment)
    setDeleteConfirmOpen(true)
  }

  const confirmDeleteBooking = async () => {
    if (!appointmentToDelete) return
    
    setDeleteLoading(true)
    try {
      const res = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/deletebooking?bookingId=${appointmentToDelete.id}`, {
        method: "DELETE",
        headers: {
          "Accept": "application/json"
        }
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Delete failed")
      
      // Refresh appointments
      await fetchAppointments()
      toast.success("Appointment deleted successfully")
      setDeleteConfirmOpen(false)
      setAppointmentToDelete(null)
      
      // Close details dialog if open
      if (selected?.id === appointmentToDelete.id) {
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
  const handleRescheduleBooking = async (appointment: Appointment) => {
    if (isWithinTwoHours(appointment.startTime)) {
      toast.error("Cannot reschedule - booking starts within 2 hours")
      return
    }
    
    setAppointmentToReschedule(appointment)
    setSelectedStaff(appointment.assigned_user_id || "any")
    setSelectedDate("")
    setSelectedTime("")
    setRescheduleOpen(true)
    
    // Staff options will be fetched automatically by useEffect
  }

  const fetchStaffOptions = async () => {
    if (!rescheduleOpen || !appointmentToReschedule?.calendar_id) return
    
    setLoadingStaff(true)
    const controller = new AbortController()
    
    try {
      // Fetch service details to get team members (like in Vue.js file)
      const serviceRes = await fetch(`https://restyle-api.netlify.app/.netlify/functions/Services?id=${appointmentToReschedule.groupId || 'default'}`, { signal: controller.signal })
      const serviceData = await serviceRes.json()
      
      const serviceObj = (serviceData.calendars || []).find((s: { id: string }) => s.id === appointmentToReschedule.calendar_id)
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
    if (!appointmentToReschedule?.calendar_id || !rescheduleOpen) return
    
    setLoadingSlots(true)
    const controller = new AbortController()
    
    try {
      const userId = selectedStaff && selectedStaff !== 'any' ? selectedStaff : null
      let apiUrl = `https://restyle-api.netlify.app/.netlify/functions/staffSlots?calendarId=${appointmentToReschedule.calendar_id}`
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
    if (!appointmentToReschedule || !selectedDate || !selectedTime) return
    
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
        
        // Convert to UTC (MST is UTC-7)
        const mstOffset = -7 * 60 * 60 * 1000
        const utcStartTime = new Date(jsDate.getTime() - mstOffset)
        
        // Calculate end time based on original duration
        const originalStart = new Date(appointmentToReschedule.startTime!)
        const originalEnd = new Date(appointmentToReschedule.endTime!)
        const duration = originalEnd.getTime() - originalStart.getTime()
        const utcEndTime = new Date(utcStartTime.getTime() + duration)
        
        // Determine assignedUserId (similar to Vue.js implementation)
        let assignedUserIdToSend = selectedStaff
        if (selectedStaff === 'any') {
          // If "any" is selected, use the first real staff member or current appointment staff
          const realStaff = staffOptions.filter(item => item.value !== 'any')
          if (realStaff.length > 0) {
            assignedUserIdToSend = realStaff[0].value
          } else if (appointmentToReschedule.assigned_user_id) {
            assignedUserIdToSend = appointmentToReschedule.assigned_user_id
          }
        }

        if (!assignedUserIdToSend || assignedUserIdToSend === 'any') {
          throw new Error('A team member needs to be selected. assignedUserId is missing')
        }

        let updateUrl = `https://restyle-api.netlify.app/.netlify/functions/updateappointment?appointmentId=${appointmentToReschedule.id}`
        updateUrl += `&assignedUserId=${assignedUserIdToSend}`
        updateUrl += `&startTime=${encodeURIComponent(utcStartTime.toISOString())}`
        updateUrl += `&endTime=${encodeURIComponent(utcEndTime.toISOString())}`
        
        const response = await fetch(updateUrl)
        const data = await response.json()
        
        if (data.message && data.message.includes('successfully')) {
          toast.success("Appointment rescheduled successfully")
          setRescheduleOpen(false)
          resetRescheduleForm()
          await fetchAppointments()
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
    setAppointmentToReschedule(null)
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
    if (rescheduleOpen && selectedStaff && appointmentToReschedule) {
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
  }, [selectedStaff, rescheduleOpen, appointmentToReschedule])

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
      const res = await fetch('https://restyle-api.netlify.app/.netlify/functions/supabasegroups')
      const data = await res.json()
      
      const departments = data.groups.map((group: { id: string; name: string; description?: string }) => ({
        label: group.name,
        value: group.id,
        description: group.description || '',
        icon: 'user'
      }))
      
      setNewAppDepartments(departments)
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
      const res = await fetch(`https://restyle-api.netlify.app/.netlify/functions/Services?id=${departmentId}`)
      const data = await res.json()
      
      const services = (data.calendars || []).map((service: { id: string; name: string; duration?: number; slotDuration?: number; teamMembers?: Array<{ userId: string; name: string }> }) => ({
        label: service.name,
        value: service.id,
        description: `Duration: ${service.slotDuration} mins | Staff: ${service.teamMembers?.length ?? 0}`
      }))
      
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
      const res = await fetch(`https://restyle-api.netlify.app/.netlify/functions/Services?id=${newAppSelectedDepartment}`)
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
          const staffRes = await fetch(`https://restyle-api.netlify.app/.netlify/functions/Staff?id=${member.userId}`)
          const staffData = await staffRes.json()
          return {
            label: staffData.name,
            value: member.userId, // Use member.userId like Vue.js
            originalStaffId: staffData.id,
            icon: 'user'
          }
        } catch {
          console.warn('Failed to fetch staff details for:', member.userId)
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
    
    setNewAppLoadingSlots(true)
    const serviceId = newAppSelectedService
    const userId = newAppSelectedStaff && newAppSelectedStaff !== 'any' ? newAppSelectedStaff : null

    try {
      let apiUrl = `https://restyle-api.netlify.app/.netlify/functions/staffSlots?calendarId=${serviceId}`
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
      }
    } catch (error) {
      console.error('Error fetching working slots:', error)
      setNewAppWorkingSlots({})
      setNewAppDates([])
    } finally {
      setNewAppLoadingSlots(false)
    }
  }

  // Generate available dates from working slots
  const generateNewAppDates = (workingSlots: Record<string, string[]>) => {
    const today = new Date()
    const todayDateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    
    const workingDates = Object.keys(workingSlots)
      .filter(dateString => dateString >= todayDateString)
      .sort()
    
    const dates = workingDates.map((dateString) => {
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
    
    setNewAppDates(dates)
  }

  // Fetch slots for selected date
  const fetchNewAppSlotsForDate = (dateString: string) => {
    if (!dateString || !newAppWorkingSlots[dateString]) {
      setNewAppSlots([])
      return
    }

    const slotsForSelectedDate = newAppWorkingSlots[dateString]
    const slotsWithStatus = slotsForSelectedDate.map((slot: string) => ({
      time: slot,
      isPast: isNewAppSlotInPast(slot, dateString),
      isUnavailable: false
    }))
    
    const availableSlots = slotsWithStatus.filter((slot: TimeSlot) => !slot.isPast)
    setNewAppSlots(availableSlots)
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

  // Step navigation functions
  const goToNextNewAppStep = () => {
    setNewAppCurrentStep(prev => Math.min(prev + 1, 5))
  }

  const goToPrevNewAppStep = () => {
    setNewAppCurrentStep(prev => Math.max(prev - 1, 1))
  }

  // Handle department selection
  const handleNewAppDepartmentSelect = (departmentId: string) => {
    setNewAppSelectedDepartment(departmentId)
    setNewAppSelectedService("")
    setNewAppSelectedStaff("")
    fetchNewAppServices(departmentId)
    goToNextNewAppStep()
  }

  // Handle service selection
  const handleNewAppServiceSelect = (serviceId: string) => {
    setNewAppSelectedService(serviceId)
    setNewAppSelectedStaff("")
    fetchNewAppStaff(serviceId)
    goToNextNewAppStep()
  }

  // Handle staff selection
  const handleNewAppStaffSelect = (staffId: string) => {
    setNewAppSelectedStaff(staffId)
    fetchNewAppWorkingSlots()
    goToNextNewAppStep()
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
        `https://restyle-api.netlify.app/.netlify/functions/customer?${params.toString()}`
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

      const mstOffset = -7 * 60 * 60 * 1000
      const utcStartTime = new Date(jsDate.getTime() - mstOffset)

      // Get service duration
      const selectedServiceObj = newAppServices.find(s => s.value === newAppSelectedService)
      const durationMatch = selectedServiceObj?.description?.match(/Duration: (\d+) mins/)
      const duration = durationMatch ? parseInt(durationMatch[1]) : 120
      const utcEndTime = new Date(utcStartTime.getTime() + duration * 60 * 1000)

      const startTime = utcStartTime.toISOString()
      const endTime = utcEndTime.toISOString()

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
      const contactName = `${newAppContactForm.firstName} ${newAppContactForm.lastName}`.trim()
      const title = `${serviceName} - ${contactName}`
      
      let bookUrl = `https://restyle-api.netlify.app/.netlify/functions/Apointment?contactId=${contactId}&calendarId=${newAppSelectedService}&startTime=${startTime}&endTime=${endTime}&title=${encodeURIComponent(title)}`
      if (assignedUserId) bookUrl += `&assignedUserId=${assignedUserId}`

      const bookRes = await fetch(bookUrl)
      const bookData = await bookRes.json()

      if (!bookData.response?.id) {
        throw new Error(bookData.error || 'Booking failed')
      }

      toast.success("Appointment created successfully!")
      setNewAppointmentOpen(false)
      resetNewAppointmentForm()
      await fetchAppointments()
    } catch (error) {
      console.error('New appointment error:', error)
      toast.error(`Failed to create appointment: ${error instanceof Error ? error.message : 'Unknown error'}`)
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

  // Filter data based on status and search
  const filteredData = React.useMemo(() => {
    let filtered = data

    // If barber, force filter to own assignments
    if (user?.role === 'barber' && user.ghlId) {
      filtered = filtered.filter(a => (a.assigned_user_id || '') === user.ghlId)
    }

    // If logged in as a barber, only show appointments assigned to their ghl_id
    if (user?.role === 'barber' && user.ghlId) {
      filtered = filtered.filter(a => (a.assigned_user_id || '') === user.ghlId)
    }

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter(appointment => {
        const appointmentStatus = getAppointmentStatus(appointment)
        return appointmentStatus === statusFilter
      })
    }

    // Filter by search term
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(appointment => 
        (appointment.serviceName || '').toLowerCase().includes(search) ||
        (appointment.contactName || '').toLowerCase().includes(search) ||
        (appointment.assignedStaffFirstName || '').toLowerCase().includes(search) ||
        (appointment.assignedStaffLastName || '').toLowerCase().includes(search) ||
        (appointment.contactPhone || '').includes(search)
      )
    }

    // Sort by start time (most recent first for past, earliest first for upcoming)
    return filtered.sort((a, b) => {
      const aTime = a.startTime ? new Date(a.startTime).getTime() : 0
      const bTime = b.startTime ? new Date(b.startTime).getTime() : 0
      
      const aStatus = getAppointmentStatus(a)
      const bStatus = getAppointmentStatus(b)
      
      // Priority: cancelled last, then upcoming (earliest first), then past (most recent first)
      if (aStatus === 'cancelled' && bStatus !== 'cancelled') return 1
      if (bStatus === 'cancelled' && aStatus !== 'cancelled') return -1
      if (aStatus === 'upcoming' && bStatus === 'past') return -1
      if (bStatus === 'upcoming' && aStatus === 'past') return 1
      
      if (aStatus === 'upcoming' && bStatus === 'upcoming') {
        return aTime - bTime // earliest first for upcoming
      }
      
      if (aStatus === 'past' && bStatus === 'past') {
        return bTime - aTime // most recent first for past
      }
      
      return aTime - bTime
    })
  }, [data, statusFilter, searchTerm])

  const columns: ColumnDef<Appointment>[] = [
    {
      accessorKey: "serviceName",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Service <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const appointment = row.original
        const status = getAppointmentStatus(appointment)
        const withinTwoHours = isWithinTwoHours(appointment.startTime)
        const isCancelled = status === 'cancelled'
        const isPast = status === 'past'
        
        return (
          <div className="space-y-1">
            <div className="font-medium">
              {appointment.serviceName || appointment.title || 'Untitled Service'}
            </div>
            {!isCancelled && !isPast && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={withinTwoHours}
                  title={withinTwoHours ? "Cannot reschedule - booking starts within 2 hours" : "Reschedule appointment"}
                  onClick={() => handleRescheduleBooking(appointment)}
                  className="h-6 px-2 text-xs"
                >
                  Reschedule
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={withinTwoHours}
                  title={withinTwoHours ? "Cannot cancel - booking starts within 2 hours" : "Cancel appointment"}
                  onClick={() => handleCancelBooking(appointment)}
                  className="h-6 px-2 text-xs"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "contactName",
      header: "Customer",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.contactName || 'Unknown Customer'}</div>
          <div className="text-sm text-muted-foreground">{row.original.contactPhone || ''}</div>
        </div>
      ),
    },
    {
      accessorKey: "startTime",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Start Time <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="text-sm">
          {formatDateTime(row.original.startTime)}
        </div>
      ),
    },
    {
      accessorKey: "duration",
      header: "Duration",
      cell: ({ row }) => (
        <div className="text-sm">
          {formatDuration(row.original.startTime, row.original.endTime)}
        </div>
      ),
    },
    {
      accessorKey: "assignedStaffFirstName",
      header: "Staff",
      cell: ({ row }) => {
        const staffName = `${row.original.assignedStaffFirstName || ''} ${row.original.assignedStaffLastName || ''}`.trim()
        return (
          <div className="text-sm">
            {staffName || 'Unassigned'}
          </div>
        )
      },
    },
    {
      accessorKey: "appointment_status",
      header: "Status",
      cell: ({ row }) => {
        const status = getAppointmentStatus(row.original)
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
      cell: ({ row }) => {
        const appointment = row.original
        
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelected(appointment)
              setDetailsOpen(true)
            }}
          >
            View Details
          </Button>
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

  // Count appointments by status
  const statusCounts = React.useMemo(() => {
    const counts = { all: filteredData.length, upcoming: 0, past: 0, cancelled: 0 }
    filteredData.forEach(appointment => {
      const status = getAppointmentStatus(appointment)
      counts[status as keyof typeof counts]++
    })
    return counts
  }, [filteredData])

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
              <Button onClick={() => setNewAppointmentOpen(true)} className="bg-primary text-primary-foreground">
                <Calendar className="h-4 w-4 mr-2" />
                Add Appointment
              </Button>
            </div>
          </header>
          
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <div className="text-2xl font-bold">{statusCounts.all}</div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <div className="text-2xl font-bold">{statusCounts.upcoming}</div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Past</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <div className="text-2xl font-bold">{statusCounts.past}</div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <div className="text-2xl font-bold">{statusCounts.cancelled}</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Filters and Search */}
            <Card>
              <CardHeader>
                <CardTitle>Filter Appointments</CardTitle>
                <CardDescription>Filter and search through all appointments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4 md:flex-row md:items-center">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by customer, staff, service, or phone..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-auto">
                      <TabsList>
                        <TabsTrigger value="all">All ({statusCounts.all})</TabsTrigger>
                        <TabsTrigger value="upcoming">Upcoming ({statusCounts.upcoming})</TabsTrigger>
                        <TabsTrigger value="past">Past ({statusCounts.past})</TabsTrigger>
                        <TabsTrigger value="cancelled">Cancelled ({statusCounts.cancelled})</TabsTrigger>
                      </TabsList>
                    </Tabs>
              </div>
            </div>
              </CardContent>
            </Card>

            {/* Appointments Table */}
            <Card>
              <CardHeader>
                <CardTitle>Appointments ({filteredData.length})</CardTitle>
                <CardDescription>
                  Manage and view all salon appointments
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-2">
                    {[...Array(10)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                          <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                              <TableHead key={header.id}>
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
                            <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                              {row.getVisibleCells().map((cell) => (
                                <TableCell key={cell.id}>
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={columns.length} className="h-24 text-center">
                              No appointments found.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Appointment Details Modal */}
          <ConfirmDialog open={detailsOpen} onOpenChange={setDetailsOpen}>
            <ConfirmContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <ConfirmHeader>
                <ConfirmTitle>
                  {selected?.serviceName || selected?.title || 'Appointment Details'}
                </ConfirmTitle>
                <div className="text-sm text-muted-foreground">
                  Appointment ID: {selected?.id}
                </div>
              </ConfirmHeader>
              
              {selected && (
                <div className="mt-6 space-y-6">
                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Status</label>
                        <div className="mt-1">
                          <Badge variant={getStatusBadgeVariant(getAppointmentStatus(selected))}>
                            {selected.appointment_status?.charAt(0).toUpperCase() + selected.appointment_status?.slice(1) || 'Unknown'}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Duration</label>
                        <p className="mt-1 text-sm">{formatDuration(selected.startTime, selected.endTime)}</p>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Start Time</label>
                      <p className="mt-1 text-sm">{formatDateTime(selected.startTime)}</p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-muted-foreground">End Time</label>
                      <p className="mt-1 text-sm">{formatDateTime(selected.endTime)}</p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Customer</label>
                      <p className="mt-1 text-sm font-medium">{selected.contactName || 'Unknown Customer'}</p>
                      {selected.contactPhone && (
                        <p className="text-sm text-muted-foreground">{selected.contactPhone}</p>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Assigned Staff</label>
                      <p className="mt-1 text-sm">
                        {`${selected.assignedStaffFirstName || ''} ${selected.assignedStaffLastName || ''}`.trim() || 'Unassigned'}
                </p>
              </div>

                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Location</label>
                      <p className="mt-1 text-sm">{selected.address || 'Not specified'}</p>
            </div>

                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Recurring</label>
                      <p className="mt-1 text-sm">{selected.is_recurring ? 'Yes' : 'No'}</p>
          </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-6 border-t">
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-muted-foreground">Actions</h3>
                      <div className="flex gap-2">
                        {/* Cancel Button */}
                        {getAppointmentStatus(selected) !== 'cancelled' && getAppointmentStatus(selected) !== 'past' && (
                          <Button
                            onClick={() => {
                              setDetailsOpen(false)
                              handleCancelBooking(selected)
                            }}
                            disabled={isWithinTwoHours(selected.startTime)}
                            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white border-orange-500"
                          >
                            Cancel
                          </Button>
                        )}

                        {/* Reschedule Button */}
                        {getAppointmentStatus(selected) !== 'cancelled' && getAppointmentStatus(selected) !== 'past' && (
                          <Button
                            onClick={() => {
                              setDetailsOpen(false)
                              handleRescheduleBooking(selected)
                            }}
                            disabled={isWithinTwoHours(selected.startTime)}
                            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white border-blue-500"
                          >
                            Reschedule
                          </Button>
                        )}

                        {/* Delete Button */}
                        <Button
                          onClick={() => {
                            setDetailsOpen(false)
                            handleDeleteBooking(selected)
                          }}
                          className="flex-1 bg-red-500 hover:bg-red-600 text-white border-red-500"
                        >
                          Delete
                        </Button>
                      </div>

                      {/* Disabled state message */}
                      {isWithinTwoHours(selected.startTime) && getAppointmentStatus(selected) !== 'cancelled' && getAppointmentStatus(selected) !== 'past' && (
                        <p className="text-xs text-muted-foreground text-center pt-2">
                          Cancel and Reschedule are disabled - appointment starts within 2 hours
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </ConfirmContent>
          </ConfirmDialog>

          {/* Cancel Confirmation Dialog */}
          <ConfirmDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
            <ConfirmContent>
              <ConfirmHeader>
                <ConfirmTitle>Cancel Appointment</ConfirmTitle>
              </ConfirmHeader>
              <div className="py-4">
                <p>Are you sure you want to cancel this appointment?</p>
                {appointmentToCancel && (
                  <div className="mt-2 p-3 bg-muted rounded-md">
                    <p className="font-medium">{appointmentToCancel.serviceName}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(appointmentToCancel.startTime)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Customer: {appointmentToCancel.contactName || 'Unknown'}
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
                <p className="mt-2">Are you sure you want to permanently delete this appointment?</p>
                {appointmentToDelete && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="font-medium text-red-800">{appointmentToDelete.serviceName}</p>
                    <p className="text-sm text-red-700">
                      {formatDateTime(appointmentToDelete.startTime)}
                    </p>
                    <p className="text-sm text-red-700">
                      Customer: {appointmentToDelete.contactName || 'Unknown'}
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
                {appointmentToReschedule && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-semibold mb-2">Current Appointment Details</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Service:</span> {appointmentToReschedule.serviceName || appointmentToReschedule.title}
                      </div>
                      <div>
                        <span className="font-medium">Date & Time:</span> {formatDateTime(appointmentToReschedule.startTime)}
                      </div>
                      <div>
                        <span className="font-medium">Staff:</span> {appointmentToReschedule.assignedStaffFirstName} {appointmentToReschedule.assignedStaffLastName}
                      </div>
                      <div>
                        <span className="font-medium">Customer:</span> {appointmentToReschedule.contactName}
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
          <ConfirmDialog open={newAppointmentOpen} onOpenChange={(open) => {
            setNewAppointmentOpen(open)
            if (!open) {
              resetNewAppointmentForm()
            }
          }}>
            <ConfirmContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <ConfirmHeader>
                <ConfirmTitle>Create New Appointment</ConfirmTitle>
              </ConfirmHeader>
              
              <div className="space-y-6">
                {/* Step 1: Department Selection */}
                {newAppCurrentStep === 1 && (
                  <div className="space-y-4">
                    <div className="text-center">
                      <h3 className="text-lg font-semibold mb-2">Choose Department</h3>
                      <p className="text-sm text-muted-foreground">Select the service category</p>
                    </div>
                    
                    {newAppLoadingDepts ? (
                      <div className="space-y-3">
                        {[...Array(4)].map((_, i) => (
                          <Skeleton key={i} className="h-16 w-full" />
                        ))}
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {newAppDepartments.map((dept) => (
                          <div
                            key={dept.value || dept.id || dept.name || Math.random().toString(36)}
                            onClick={() => handleNewAppDepartmentSelect(dept.value || dept.id || '')}
                            className={`p-4 border rounded-lg cursor-pointer transition-all hover:border-primary ${
                              newAppSelectedDepartment === (dept.value || dept.id)
                                ? 'border-primary bg-primary/5'
                                : 'border-border'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <User className="h-5 w-5 text-primary" />
                              <div>
                                <div className="font-medium">{dept.label || dept.name}</div>
                                <div className="text-sm text-muted-foreground">{dept.description || ''}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Step 2: Service Selection */}
                {newAppCurrentStep === 2 && (
                  <div className="space-y-4">
                    <div className="text-center">
                      <h3 className="text-lg font-semibold mb-2">Select Service</h3>
                      <p className="text-sm text-muted-foreground">Choose the specific service</p>
                    </div>
                    
                    {newAppLoadingServices ? (
                      <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                          <Skeleton key={i} className="h-16 w-full" />
                        ))}
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {newAppServices.map((service) => (
                          <div
                            key={service.value || service.id || Math.random().toString(36)}
                            onClick={() => handleNewAppServiceSelect(service.value || service.id || '')}
                            className={`p-4 border rounded-lg cursor-pointer transition-all hover:border-primary ${
                              newAppSelectedService === (service.value || service.id)
                                ? 'border-primary bg-primary/5'
                                : 'border-border'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Calendar className="h-5 w-5 text-primary" />
                              <div>
                                <div className="font-medium">{service.label || service.name}</div>
                                <div className="text-sm text-muted-foreground">{service.description || ''}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <Button variant="outline" onClick={goToPrevNewAppStep}>
                      <ChevronLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                  </div>
                )}

                {/* Step 3: Staff Selection */}
                {newAppCurrentStep === 3 && (
                  <div className="space-y-4">
                    <div className="text-center">
                      <h3 className="text-lg font-semibold mb-2">Choose Staff</h3>
                      <p className="text-sm text-muted-foreground">Select your preferred staff member</p>
                    </div>
                    
                    {newAppLoadingStaff ? (
                      <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                          <Skeleton key={i} className="h-16 w-full" />
                        ))}
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {newAppStaff.map((staff) => (
                          <div
                            key={staff.value || staff.id || staff.email || Math.random().toString(36)}
                            onClick={() => handleNewAppStaffSelect(staff.value || staff.id || '')}
                            className={`p-4 border rounded-lg cursor-pointer transition-all hover:border-primary ${
                              newAppSelectedStaff === (staff.value || staff.id)
                                ? 'border-primary bg-primary/5'
                                : 'border-border'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <User className="h-5 w-5 text-primary" />
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{staff.label || staff.name || staff.email}</span>
                                {staff.badge && (
                                  <Badge variant="secondary" className="text-xs">
                                    {staff.badge}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <Button variant="outline" onClick={goToPrevNewAppStep}>
                      <ChevronLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                  </div>
                )}

                {/* Step 4: Date & Time Selection */}
                {newAppCurrentStep === 4 && (
                  <div className="space-y-4">
                    <div className="text-center">
                      <h3 className="text-lg font-semibold mb-2">Select Date & Time</h3>
                      <p className="text-sm text-muted-foreground">Choose your preferred appointment slot</p>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Date Selection */}
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Select Date</Label>
                        {newAppLoadingSlots ? (
                          <div className="h-60 rounded-lg bg-gray-100 animate-pulse" />
                        ) : (
                          <div className="h-60 overflow-y-auto border rounded-lg p-2">
                            <div className="grid grid-cols-1 gap-1">
                              {newAppDates.map((dateInfo) => (
                                <Button
                                  key={dateInfo.dateString}
                                  variant={newAppSelectedDate === dateInfo.dateString ? "default" : "ghost"}
                                  size="sm"
                                  className={`justify-start text-left h-auto p-2 ${
                                    newAppSelectedDate === dateInfo.dateString 
                                      ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                                      : "hover:bg-gray-100"
                                  }`}
                                  onClick={() => handleNewAppDateSelect(dateInfo.dateString)}
                                >
                                  <div className="flex flex-col items-start">
                                    <span className="text-xs opacity-70">
                                      {dateInfo.dayName}
                                    </span>
                                    <span className="font-medium">
                                      {dateInfo.dateDisplay}
                                    </span>
                                  </div>
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Time Selection */}
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Select Time</Label>
                        {newAppSelectedDate ? (
                          <div className="h-60 overflow-y-auto border rounded-lg p-2">
                            <div className="grid grid-cols-2 gap-2">
                              {newAppSlots.map((slot) => (
                                <Button
                                  key={slot.time}
                                  variant={newAppSelectedTime === slot.time ? "default" : "outline"}
                                  size="sm"
                                  className={`text-xs ${
                                    newAppSelectedTime === slot.time 
                                      ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                                      : "hover:bg-gray-50"
                                  }`}
                                  onClick={() => handleNewAppTimeSelect(slot.time)}
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
                    
                    <Button variant="outline" onClick={goToPrevNewAppStep}>
                      <ChevronLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                  </div>
                )}

                {/* Step 5: Contact Information */}
                {newAppCurrentStep === 5 && (
                  <div className="space-y-4">
                    <div className="text-center">
                      <h3 className="text-lg font-semibold mb-2">Contact Information</h3>
                      <p className="text-sm text-muted-foreground">Enter customer details</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="newapp-firstname">First Name *</Label>
                        <Input
                          id="newapp-firstname"
                          value={newAppContactForm.firstName}
                          onChange={(e) => setNewAppContactForm(prev => ({ ...prev, firstName: e.target.value }))}
                          placeholder="First Name"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="newapp-lastname">Last Name *</Label>
                        <Input
                          id="newapp-lastname"
                          value={newAppContactForm.lastName}
                          onChange={(e) => setNewAppContactForm(prev => ({ ...prev, lastName: e.target.value }))}
                          placeholder="Last Name"
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="newapp-phone">Phone Number *</Label>
                      <Input
                        id="newapp-phone"
                        value={newAppContactForm.phone}
                        onChange={(e) => setNewAppContactForm(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="+1 (555) 123-4567"
                        required
                      />
                    </div>

                    {/* Appointment Summary */}
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-medium mb-3">Appointment Summary</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Service:</span> {newAppServices.find(s => s.value === newAppSelectedService)?.label}
                        </div>
                        <div>
                          <span className="font-medium">Staff:</span> {newAppStaff.find(s => s.value === newAppSelectedStaff)?.label}
                        </div>
                        <div>
                          <span className="font-medium">Date:</span> {newAppSelectedDate}
                        </div>
                        <div>
                          <span className="font-medium">Time:</span> {newAppSelectedTime}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={goToPrevNewAppStep} className="flex-1">
                        <ChevronLeft className="h-4 w-4 mr-2" />
                        Back
                      </Button>
                      <Button 
                        onClick={submitNewAppointment}
                        disabled={!newAppContactForm.firstName || !newAppContactForm.lastName || !newAppContactForm.phone || newAppLoading}
                        className="flex-1 bg-primary"
                      >
                        {newAppLoading ? 'Creating...' : 'Create Appointment'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </ConfirmContent>
          </ConfirmDialog>
        </SidebarInset>
      </SidebarProvider>
    </RoleGuard>
  )
}

export default function AppointmentsPage() {
  return (
    <React.Suspense fallback={<div className="p-4">Loading…</div>}>
      <AppointmentsPageInner />
    </React.Suspense>
  )
}
