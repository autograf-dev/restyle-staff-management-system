"use client"
import { AppSidebar } from "@/components/app-sidebar"
import { RoleGuard } from "@/components/role-guard"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { useEffect, useMemo, useState } from "react"
import { 
  Calendar, 
  Users, 
  DollarSign, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  Activity,
  CheckCircle,
  XCircle,
  AlertCircle,
  UserCheck,
  UserX,
  CalendarDays
} from "lucide-react"
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer,
  Area,
  AreaChart
} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart"
import { useUser } from "@/contexts/user-context"

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
  serviceName?: string
  startTime?: string
  endTime?: string
  assignedStaffFirstName?: string
  assignedStaffLastName?: string
  contactName?: string
  contactPhone?: string
}

type Contact = {
  id: string
  contactName: string
  firstName: string
  lastName: string
  phone: string | null
  dateAdded: string
}

type Staff = {
  id?: string
  firstName?: string
  lastName?: string
  [key: string]: unknown
}

// Custom hooks
function useAppointments() {
  const [data, setData] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAppointments = async () => {
      setLoading(true)
      setError(null)
      
      const controller = new AbortController()
      const { signal } = controller

      try {
        // Use the correct endpoint from appointments page
        const res = await fetch("https://restyle-backend.netlify.app/.netlify/functions/getAllBookings", { signal })
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`)
        }
        
        const json = await res.json()
        const bookings = json?.bookings || []
        
        // Process a limited number of appointments for dashboard performance
        const limitedBookings = bookings.slice(0, 50)
        
        // Process appointments in smaller batches to avoid overwhelming the API
        const enrichedBookings: Appointment[] = []
        
        for (let i = 0; i < limitedBookings.length; i += 5) {
          if (signal.aborted) break
          
          const batch = limitedBookings.slice(i, i + 5)
          const batchResults = await Promise.all(
            batch.map(async (booking: { id?: string; calendar_id?: string; contact_id?: string; assigned_user_id?: string; title?: string; status?: string; startTime?: string; endTime?: string; appointment_status?: string; address?: string; is_recurring?: boolean; trace_id?: string }) => {
              if (signal.aborted) throw new Error('Aborted')

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

              // Try to fetch appointment details (with timeout and error handling)
              try {
                const apptRes = await Promise.race([
                  fetch(`https://restyle-backend.netlify.app/.netlify/functions/getBooking?id=${booking.id}`, { signal }),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
                ]) as Response
                
                if (apptRes.ok && !signal.aborted) {
                  const apptData = await apptRes.json()
                  if (apptData.appointment) {
                    details.startTime = apptData.appointment.startTime
                    details.endTime = apptData.appointment.endTime
                    details.appointment_status = apptData.appointment.appointmentStatus || details.appointment_status
                  }
                }
              } catch (error) {
                // Silently fail for individual appointment details
                console.warn(`Failed to fetch details for booking ${booking.id}:`, error)
              }

              return details
            })
          )
          
          enrichedBookings.push(...batchResults)
          
          // Small delay between batches
          if (i + 5 < limitedBookings.length && !signal.aborted) {
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        }
        
        if (!signal.aborted) {
          setData(enrichedBookings)
        }
      } catch (error) {
        if (!signal.aborted) {
          console.error("Failed to fetch appointments:", error)
          setError(error instanceof Error ? error.message : 'Unknown error')
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false)
        }
      }

      return () => controller.abort()
    }

    fetchAppointments()
  }, [])

  return { data, loading, error }
}

function useContacts() {
  const [data, setData] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchContacts = async () => {
      setLoading(true)
      setError(null)
      
      const controller = new AbortController()
      const { signal } = controller

      try {
        // Use the correct endpoint with limit for dashboard performance
        const res = await fetch("https://restyle-backend.netlify.app/.netlify/functions/getcontacts?page=1&limit=500", { signal })
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`)
        }
        
        const json = await res.json()
        const contacts = Array.isArray(json?.contacts) 
          ? json.contacts 
          : (json?.contacts?.contacts || [])
        
        const mapped: Contact[] = contacts.map((c: { id?: string; firstName?: string; lastName?: string; phone?: string; email?: string; dateAdded?: string; contactName?: string }) => ({
          id: String(c.id ?? ""),
          contactName: c.contactName || `${c.firstName || ""} ${c.lastName || ""}`.trim(),
          firstName: c.firstName || "",
          lastName: c.lastName || "",
          phone: c.phone ?? null,
          dateAdded: c.dateAdded || new Date().toISOString(),
        }))
        
        if (!signal.aborted) {
          setData(mapped)
        }
      } catch (error) {
        if (!signal.aborted) {
          console.error("Failed to fetch contacts:", error)
          setError(error instanceof Error ? error.message : 'Unknown error')
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false)
        }
      }

      return () => controller.abort()
    }

    fetchContacts()
  }, [])

  return { data, loading, error }
}

function useStaff() {
  const [data, setData] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStaff = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const res = await fetch('/api/barber-hours')
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`)
        }
        
        const json = await res.json()
        setData(json?.data || [])
      } catch (error) {
        console.error("Failed to fetch staff:", error)
        setError(error instanceof Error ? error.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchStaff()
  }, [])

  return { data, loading, error }
}

// Utility functions
function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

function getAppointmentStatus(appointment: Appointment) {
  const status = (appointment.appointment_status || '').toLowerCase()
  const now = new Date()
  const startTime = appointment.startTime ? new Date(appointment.startTime) : null
  
  if (status === 'cancelled') return 'cancelled'
  if (status === 'confirmed') return 'confirmed'
  if (!startTime) return 'pending'
  
  if (startTime < now) return 'completed'
  return 'upcoming'
}

export default function DashboardPage() {
  const { user } = useUser()
  const { data: appointments, loading: appointmentsLoading, error: appointmentsError } = useAppointments()
  const { data: contacts, loading: contactsLoading, error: contactsError } = useContacts()
  const { data: staff, loading: staffLoading, error: staffError } = useStaff()

  // Scope data for barbers
  const scopedAppointments = useMemo(() => {
    if (user?.role === 'barber' && user.ghlId) {
      return appointments.filter(a => (a.assigned_user_id || '') === user.ghlId)
    }
    return appointments
  }, [appointments, user?.role, user?.ghlId])

  const scopedStaff = useMemo(() => {
    if (user?.role === 'barber' && user.ghlId) {
      return staff.filter((s) => String((s as unknown as { ghl_id?: string }).ghl_id || '') === user.ghlId)
    }
    return staff
  }, [staff, user?.role, user?.ghlId])

  // Calculate KPIs
  const kpis = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const thisWeek = new Date(today.getTime() - (today.getDay() * 24 * 60 * 60 * 1000))
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    
    // Appointment metrics
    const totalAppointments = scopedAppointments.length
    const confirmedAppointments = scopedAppointments.filter(a => getAppointmentStatus(a) === 'confirmed').length
    const cancelledAppointments = scopedAppointments.filter(a => getAppointmentStatus(a) === 'cancelled').length
    const pendingAppointments = scopedAppointments.filter(a => getAppointmentStatus(a) === 'pending').length
    const completedAppointments = scopedAppointments.filter(a => getAppointmentStatus(a) === 'completed').length
    
    // Today's appointments
    const todayAppointments = scopedAppointments.filter(a => {
      if (!a.startTime) return false
      const startDate = new Date(a.startTime)
      return startDate >= today && startDate < new Date(today.getTime() + 24 * 60 * 60 * 1000)
    }).length
    
    // Revenue estimation (assuming $50 average per appointment)
    const estimatedRevenue = completedAppointments * 50
    const thisMonthRevenue = appointments.filter(a => {
      if (!a.startTime || getAppointmentStatus(a) !== 'completed') return false
      const startDate = new Date(a.startTime)
      return startDate >= thisMonth
    }).length * 50
    
    // Customer metrics
    const totalCustomers = contacts.length
    const newCustomersThisMonth = contacts.filter(c => {
      const addedDate = new Date(c.dateAdded)
      return addedDate >= thisMonth
    }).length
    
    // Staff metrics
    const totalStaff = scopedStaff.length
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
    const dayName = days[new Date().getDay()]
    const workingToday = staff.filter((s) => {
      const start = String(s[`${dayName}/Start Value`] ?? '0')
      const end = String(s[`${dayName}/End Value`] ?? '0')
      return start !== '0' && end !== '0'
    }).length
    
    // Calculate percentages
    const confirmationRate = totalAppointments > 0 ? (confirmedAppointments / totalAppointments * 100) : 0
    const cancellationRate = totalAppointments > 0 ? (cancelledAppointments / totalAppointments * 100) : 0
    
    return {
      totalAppointments,
      confirmedAppointments,
      cancelledAppointments,
      pendingAppointments,
      completedAppointments,
      todayAppointments,
      estimatedRevenue,
      thisMonthRevenue,
      totalCustomers,
      newCustomersThisMonth,
      totalStaff,
      workingToday,
      confirmationRate,
      cancellationRate
    }
  }, [scopedAppointments, contacts, scopedStaff])

  // Service popularity data
  const servicePopularity = useMemo(() => {
    const serviceCounts = scopedAppointments.reduce((acc, appointment) => {
      const service = appointment.serviceName || 'Unknown Service'
      acc[service] = (acc[service] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    return Object.entries(serviceCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
  }, [scopedAppointments])

  // Customer growth data (last 6 months)
  const customerGrowthData = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => {
      const date = new Date()
      date.setMonth(date.getMonth() - (5 - i))
      date.setDate(1)
      return {
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        key: date.toISOString().slice(0, 7)
      }
    })
    
    return months.map(month => {
      const monthCustomers = contacts.filter(c => {
        return c.dateAdded.slice(0, 7) === month.key
      }).length
      
      return {
        month: month.month,
        customers: monthCustomers
      }
    })
  }, [contacts])

  // Status distribution data for pie chart
  const statusDistribution = useMemo(() => {
    const confirmed = scopedAppointments.filter(a => getAppointmentStatus(a) === 'confirmed').length
    const cancelled = scopedAppointments.filter(a => getAppointmentStatus(a) === 'cancelled').length
    const pending = scopedAppointments.filter(a => getAppointmentStatus(a) === 'pending').length
    const completed = scopedAppointments.filter(a => getAppointmentStatus(a) === 'completed').length
    
    return [
      { name: 'Confirmed', value: confirmed, color: '#10b981' },
      { name: 'Completed', value: completed, color: '#3b82f6' },
      { name: 'Pending', value: pending, color: '#f59e0b' },
      { name: 'Cancelled', value: cancelled, color: '#ef4444' }
    ].filter(item => item.value > 0)
  }, [scopedAppointments])

  // Staff workload data for doughnut chart
  const staffWorkloadData = useMemo(() => {
    const staffCounts = scopedAppointments.reduce((acc, appointment) => {
      const staffName = `${appointment.assignedStaffFirstName || ''} ${appointment.assignedStaffLastName || ''}`.trim() || 'Unassigned'
      acc[staffName] = (acc[staffName] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']
    
    return Object.entries(staffCounts)
      .map(([name, count], index) => ({ 
        name, 
        count, 
        color: colors[index % colors.length] 
      }))
      .sort((a, b) => b.count - a.count)
  }, [scopedAppointments])

  // Hourly booking patterns
  const hourlyBookingData = useMemo(() => {
    const hourCounts = Array.from({ length: 24 }, (_, hour) => ({
      hour: hour,
      timeLabel: `${hour.toString().padStart(2, '0')}:00`,
      appointments: 0
    }))
    
    scopedAppointments.forEach(appointment => {
      if (appointment.startTime) {
        const hour = new Date(appointment.startTime).getHours()
        if (hour >= 0 && hour < 24) {
          hourCounts[hour].appointments++
        }
      }
    })
    
    // Filter to business hours (8 AM to 8 PM) or hours with appointments
    return hourCounts.filter(item => 
      (item.hour >= 8 && item.hour <= 20) || item.appointments > 0
    )
  }, [scopedAppointments])

  // This week vs last week comparison
  const weeklyComparisonData = useMemo(() => {
    const now = new Date()
    const thisWeekStart = new Date(now.getTime() - (now.getDay() * 24 * 60 * 60 * 1000))
    const lastWeekStart = new Date(thisWeekStart.getTime() - (7 * 24 * 60 * 60 * 1000))
    
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    
    return days.map((day, index) => {
      const thisWeekDay = new Date(thisWeekStart.getTime() + (index * 24 * 60 * 60 * 1000))
      const lastWeekDay = new Date(lastWeekStart.getTime() + (index * 24 * 60 * 60 * 1000))
      
      const thisWeekCount = scopedAppointments.filter(a => {
        if (!a.startTime) return false
        const appointmentDate = new Date(a.startTime)
        return appointmentDate.toDateString() === thisWeekDay.toDateString()
      }).length
      
      const lastWeekCount = scopedAppointments.filter(a => {
        if (!a.startTime) return false
        const appointmentDate = new Date(a.startTime)
        return appointmentDate.toDateString() === lastWeekDay.toDateString()
      }).length
      
      return {
        day,
        thisWeek: thisWeekCount,
        lastWeek: lastWeekCount
      }
    })
  }, [scopedAppointments])

  const chartConfig: ChartConfig = {
    total: { label: "Total", color: "#3b82f6" },
    confirmed: { label: "Confirmed", color: "#10b981" },
    cancelled: { label: "Cancelled", color: "#ef4444" },
    completed: { label: "Completed", color: "#8b5cf6" },
    customers: { label: "New Customers", color: "#06b6d4" }
  }

  const loading = appointmentsLoading || contactsLoading || staffLoading
  const hasErrors = appointmentsError || contactsError || staffError

  return (
    <RoleGuard requiredTeamPrefix="">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <h1 className="text-xl font-semibold">Dashboard</h1>
              <Badge variant="secondary" className="ml-2">Analytics</Badge>
              {hasErrors && (
                <Badge variant="destructive" className="ml-2">
                  Data Loading Issues
                </Badge>
              )}
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
            {/* Error Messages */}
            {hasErrors && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-amber-800">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-medium">Some data may be incomplete:</span>
                  </div>
                  <ul className="mt-2 text-sm text-amber-700 list-disc list-inside space-y-1">
                    {appointmentsError && <li>Appointments: {appointmentsError}</li>}
                    {contactsError && <li>Customers: {contactsError}</li>}
                    {staffError && <li>Staff: {staffError}</li>}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Main KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
              <Card className="relative overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Appointments</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold">{kpis.totalAppointments}</div>
                      <p className="text-xs text-muted-foreground">
                        {kpis.todayAppointments} scheduled today
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold">{kpis.totalCustomers}</div>
                      <p className="text-xs text-muted-foreground">
                        +{kpis.newCustomersThisMonth} this month
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Working Staff</CardTitle>
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold">{kpis.workingToday}</div>
                      <p className="text-xs text-muted-foreground">
                        of {kpis.totalStaff} total staff
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Secondary KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Confirmed</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold text-green-600">{kpis.confirmedAppointments}</div>
                      <p className="text-xs text-muted-foreground">
                        {kpis.confirmationRate.toFixed(1)}% rate
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completed</CardTitle>
                  <Activity className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold text-blue-600">{kpis.completedAppointments}</div>
                      <p className="text-xs text-muted-foreground">
                        Services delivered
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending</CardTitle>
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold text-amber-600">{kpis.pendingAppointments}</div>
                      <p className="text-xs text-muted-foreground">
                        Awaiting confirmation
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
                  <XCircle className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold text-red-600">{kpis.cancelledAppointments}</div>
                      <p className="text-xs text-muted-foreground">
                        {kpis.cancellationRate.toFixed(1)}% rate
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Charts Section */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Staff Workload Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5" />
                    Staff Workload
                  </CardTitle>
                  <CardDescription>Appointments per staff member</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : staffWorkloadData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={staffWorkloadData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="count"
                        >
                          {staffWorkloadData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <ChartTooltip
                          content={({ active, payload }: { active?: boolean; payload?: Array<{ payload?: { name: string; count: number } }> }) => {
                            if (active && payload && payload[0]) {
                              const data = payload?.[0]?.payload as { name: string; count: number } | undefined
                              if (!data) return null
                              const total = staffWorkloadData.reduce((sum, item) => sum + item.count, 0)
                              const percentage = total > 0 ? ((data.count / total) * 100).toFixed(1) : '0'
                              return (
                                <div className="rounded-lg border bg-background p-3 shadow-lg">
                                  <div className="font-semibold text-foreground">{data.name}</div>
                                  <div className="space-y-1 mt-1">
                                    <div className="text-sm text-muted-foreground">
                                      <span className="font-medium">{data.count}</span> appointments
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      <span className="font-medium">{percentage}%</span> of total workload
                                    </div>
                                  </div>
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <UserX className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <div>No staff assignments yet</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Status Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Status Overview
                  </CardTitle>
                  <CardDescription>Appointment status breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : statusDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={statusDistribution}
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {statusDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <ChartTooltip 
                          content={({ active, payload }: { active?: boolean; payload?: Array<{ payload?: { name: string; value: number } }> }) => {
                            if (active && payload && payload[0]) {
                              const data = payload?.[0]?.payload as { name: string; value: number } | undefined
                              if (!data) return null
                              const total = statusDistribution.reduce((sum, item) => sum + item.value, 0)
                              const percentage = total > 0 ? ((data.value / total) * 100).toFixed(1) : '0'
                              return (
                                <div className="rounded-lg border bg-background p-3 shadow-lg">
                                  <div className="font-semibold text-foreground">{data.name} Status</div>
                                  <div className="space-y-1 mt-1">
                                    <div className="text-sm text-muted-foreground">
                                      <span className="font-medium">{data.value}</span> appointments
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      <span className="font-medium">{percentage}%</span> of all appointments
                                    </div>
                                  </div>
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <div>No appointments yet</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Hourly Booking Patterns */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Peak Hours
                  </CardTitle>
                  <CardDescription>Busiest times of day</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : hourlyBookingData.some(item => item.appointments > 0) ? (
                    <ChartContainer config={chartConfig} className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={hourlyBookingData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis 
                            dataKey="timeLabel" 
                            tick={{ fontSize: 10 }}
                            interval={1}
                            angle={-45}
                            textAnchor="end"
                            height={60}
                          />
                          <YAxis 
                            tick={{ fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <ChartTooltip 
                            content={({ active, payload, label }) => {
                              if (active && payload && payload[0]) {
                                const value = payload[0].value as number
                                const total = hourlyBookingData.reduce((sum, item) => sum + item.appointments, 0)
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0'
                                return (
                                  <div className="rounded-lg border bg-background p-3 shadow-lg">
                                    <div className="font-semibold text-foreground">{label}</div>
                                    <div className="space-y-1 mt-1">
                                      <div className="text-sm text-muted-foreground">
                                        <span className="font-medium">{value}</span> appointments
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        <span className="font-medium">{percentage}%</span> of daily bookings
                                      </div>
                                    </div>
                                  </div>
                                )
                              }
                              return null
                            }}
                          />
                          <Bar 
                            dataKey="appointments" 
                            fill="#3b82f6" 
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <div>No time data available</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Customer Growth */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Customer Growth (6 Months)
                  </CardTitle>
                  <CardDescription>New customer acquisitions over time</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : (
                    <ChartContainer config={chartConfig} className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={customerGrowthData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis 
                            dataKey="month" 
                            tick={{ fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis 
                            tick={{ fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <ChartTooltip 
                            content={({ active, payload, label }) => {
                              if (active && payload && payload[0]) {
                                const value = payload[0].value as number
                                const total = customerGrowthData.reduce((sum, item) => sum + item.customers, 0)
                                const average = total / customerGrowthData.length
                                const comparison = value > average ? 'above' : value < average ? 'below' : 'at'
                                return (
                                  <div className="rounded-lg border bg-background p-3 shadow-lg">
                                    <div className="font-semibold text-foreground">{label}</div>
                                    <div className="space-y-1 mt-1">
                                      <div className="text-sm text-muted-foreground">
                                        <span className="font-medium">{value}</span> new customers
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        <span className="font-medium">{comparison}</span> average ({average.toFixed(1)})
                                      </div>
                                    </div>
                                  </div>
                                )
                              }
                              return null
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="customers"
                            stroke="#06b6d4"
                            strokeWidth={3}
                            dot={{ fill: "#06b6d4", strokeWidth: 2, r: 6 }}
                            activeDot={{ r: 8, stroke: "#06b6d4", strokeWidth: 2 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              {/* Service Popularity */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Popular Services
                  </CardTitle>
                  <CardDescription>Most requested services</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : servicePopularity.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={servicePopularity} layout="horizontal">
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis type="number" tick={{ fontSize: 12 }} />
                          <YAxis 
                            dataKey="name" 
                            type="category" 
                            tick={{ fontSize: 11 }}
                            width={100}
                          />
                          <ChartTooltip 
                            content={({ active, payload }) => {
                              if (active && payload && payload[0]) {
                                const data = payload[0].payload
                                const total = servicePopularity.reduce((sum, item) => sum + item.count, 0)
                                const percentage = total > 0 ? ((data.count / total) * 100).toFixed(1) : '0'
                                const rank = servicePopularity.findIndex(item => item.name === data.name) + 1
                                return (
                                  <div className="rounded-lg border bg-background p-3 shadow-lg">
                                    <div className="font-semibold text-foreground">{data.name}</div>
                                    <div className="space-y-1 mt-1">
                                      <div className="text-sm text-muted-foreground">
                                        <span className="font-medium">{data.count}</span> bookings
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        <span className="font-medium">{percentage}%</span> of all services
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        <span className="font-medium">#{rank}</span> most popular
                                      </div>
                                    </div>
                                  </div>
                                )
                              }
                              return null
                            }}
                          />
                          <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <div>No service data available</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Summary Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  Business Overview
                </CardTitle>
                <CardDescription>Key performance insights for Restyle Salon</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                  <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="text-2xl font-bold text-green-700">{kpis.confirmationRate.toFixed(1)}%</div>
                    <div className="text-sm text-green-600">Confirmation Rate</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="text-2xl font-bold text-purple-700">{((kpis.workingToday / Math.max(1, kpis.totalStaff)) * 100).toFixed(0)}%</div>
                    <div className="text-sm text-purple-600">Staff Utilization</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </RoleGuard>
  )
}
