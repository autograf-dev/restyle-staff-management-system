"use client"
import { AppSidebar } from "@/components/app-sidebar"
import { RoleGuard } from "@/components/role-guard"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { StaffPerformanceTable, type StaffPerformance } from "@/components/staff-performance-table"
import { ServicesRevenueTable, type ServiceRevenue } from "@/components/services-revenue-table"
import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Lock, Eye, EyeOff, ArrowLeft, DollarSign, TrendingUp, Users, Calendar as CalendarIcon, CreditCard, Package, Receipt } from "lucide-react"
import { useUser } from "@/contexts/user-context"
import { format } from "date-fns"
import type { DateRange } from "react-day-picker"

interface TxRow {
  id: string
  paymentDate: string | null
  method: string | null
  subtotal: number | null
  tax: number | null
  tip: number | null
  totalPaid: number | null
  services: string | null
  serviceIds: string | null
  staff: string | null
  customerPhone: string | null
  customerLookup: string | null
  status?: string | null
  paymentStatus?: string | null
  paid?: string | null
  items?: Array<{
  id: string
    serviceId: string
    serviceName: string
    price: number
    staffName: string
    staffTipSplit: number
    staffTipCollected: number
  }>
}

export default function DashboardPage() {
  const { user } = useUser()
  const router = useRouter()
  
  // PIN Protection State
  const [isPinVerified, setIsPinVerified] = useState(false)
  const [pinInput, setPinInput] = useState("")
  const [showPin, setShowPin] = useState(false)
  const [pinError, setPinError] = useState("")
  const [attempts, setAttempts] = useState(0)
  
  // Dashboard PIN - you can change this to any 4-6 digit PIN
  const DASHBOARD_PIN = "57216"
  const MAX_ATTEMPTS = 10

  // Data State
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<TxRow[]>([])
  const [staffPerformance, setStaffPerformance] = useState<StaffPerformance[]>([])
  const [servicesRevenue, setServicesRevenue] = useState<ServiceRevenue[]>([])
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null)
  const [showAllStaff, setShowAllStaff] = useState(false)
  
  // Date Filter State
  type FilterType = "today" | "thisWeek" | "thisMonth" | "thisYear" | "custom"
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("today")
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)

  const formatCurrency = (n?: number | null) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Number(n || 0))

  // Get date range based on filter
  const getDateRange = (filter: FilterType): { start: Date; end: Date } => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    switch (filter) {
      case "today":
        return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
      case "thisWeek": {
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - today.getDay())
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 7)
        return { start: weekStart, end: weekEnd }
      }
      case "thisMonth": {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
        return { start: monthStart, end: monthEnd }
      }
      case "thisYear": {
        const yearStart = new Date(now.getFullYear(), 0, 1)
        const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59)
        return { start: yearStart, end: yearEnd }
      }
      case "custom":
        if (dateRange?.from && dateRange?.to) {
          return { start: dateRange.from, end: dateRange.to }
        }
        return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
      default:
        return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
    }
  }

  // Filter rows based on selected date range
  const filteredRows = useMemo(() => {
    const { start, end } = getDateRange(selectedFilter)
    return rows.filter(row => {
      if (!row.paymentDate) return false
      const paymentDate = new Date(row.paymentDate)
      return paymentDate >= start && paymentDate <= end
    })
  }, [rows, selectedFilter, dateRange])

  // Calculate KPIs from filtered data
  const kpis = useMemo(() => {
    const count = filteredRows.length
    const revenue = filteredRows.reduce((sum, r) => sum + Number(r.totalPaid || 0), 0)
    const tips = filteredRows.reduce((sum, r) => sum + Number(r.tip || 0), 0)
    const subtotal = filteredRows.reduce((sum, r) => sum + Number(r.subtotal || 0), 0)
    const tax = filteredRows.reduce((sum, r) => sum + Number(r.tax || 0), 0)
    const avg = count > 0 ? revenue / count : 0
    
    // Calculate unique staff count - handle comma-separated staff names
    const uniqueStaff = new Set(
      filteredRows
        .map(r => r.staff)
        .filter(Boolean)
        .flatMap(staff => staff!.split(',').map(name => name.trim()))
        .filter(name => name.length > 0)
    ).size
    
    // Calculate payment method breakdown
    const paymentMethods = filteredRows.reduce((acc, r) => {
      const method = (r.method || 'other').toLowerCase()
      const amount = Number(r.totalPaid || 0)
      
      if (method.includes('cash')) {
        acc.cash += amount
      } else if (method.includes('card') || method.includes('credit') || method.includes('debit')) {
        acc.card += amount
      } else if (method.includes('gift')) {
        acc.giftCard += amount
      } else {
        acc.other += amount
      }
      
      return acc
    }, { cash: 0, card: 0, giftCard: 0, other: 0 })
    
    return { count, revenue, tips, avg, uniqueStaff, subtotal, tax, paymentMethods }
  }, [filteredRows])

  // Fetch transactions data
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/transactions?limit=100`)
        const json = await res.json()
        if (!res.ok || !json.ok) throw new Error(json.error || 'Failed to load')
        
        const transactions = json.data || []
        setRows(transactions)
      } catch (e: unknown) {
        console.error('Error loading payments:', e)
      } finally {
          setLoading(false)
        }
      }

    if (isPinVerified) {
      load()
    }
  }, [isPinVerified])

  // Calculate staff performance
  useEffect(() => {
    if (rows.length === 0) return

    // Group transactions by staff
    const staffMap = new Map()
    
    rows.forEach(row => {
      if (row.staff) {
        // Split staff field by comma and process each staff member
        const staffNames = row.staff.split(',').map(name => name.trim()).filter(name => name)
        
        staffNames.forEach(staffName => {
          if (!staffMap.has(staffName)) {
            staffMap.set(staffName, {
              staffId: staffName,
              staffName: staffName,
              totalRevenue: 0,
              totalServices: 0,
              totalHours: 0,
              ratings: []
            })
          }
          
          const staff = staffMap.get(staffName)
          // Split revenue equally among staff members
          staff.totalRevenue += (row.totalPaid || 0) / staffNames.length
          staff.totalServices += 1 / staffNames.length // Split service count
          
          // Add rating if available (mock data for now)
          if (Math.random() > 0.3) { // 70% chance of having a rating
            staff.ratings.push(3.5 + Math.random() * 1.5) // Rating between 3.5-5.0
          }
        })
      }
    })

    // Calculate performance metrics
    const performance = Array.from(staffMap.values()).map(staff => {
      const avgRating = staff.ratings.length > 0 
        ? staff.ratings.reduce((sum: number, rating: number) => sum + rating, 0) / staff.ratings.length
        : 4.0 // Default rating if no ratings

      // Mock hours calculation (8 hours per day, 5 days per week)
      const totalHours = Math.max(1, Math.floor(staff.totalServices / 2) * 8)
      
      // Efficiency = revenue per hour
      const efficiency = totalHours > 0 ? Math.round((staff.totalRevenue / totalHours) * 100) / 100 : 0

      return {
        ...staff,
        avgRating: Math.round(avgRating * 10) / 10, // Round to 1 decimal
        totalHours,
        efficiency: Math.min(100, Math.round(efficiency)) // Cap at 100%
      }
    })

    // Sort by revenue descending
    performance.sort((a, b) => b.totalRevenue - a.totalRevenue)
    
    setStaffPerformance(performance)

    // Calculate services revenue
    const servicesMap = new Map()
    
    rows.forEach(row => {
      if (row.services) {
        const services = row.services.split(',').map(s => s.trim()).filter(s => s)
        const revenuePerService = (row.totalPaid || 0) / services.length
        
        services.forEach(service => {
          if (!servicesMap.has(service)) {
            servicesMap.set(service, {
              name: service,
              revenue: 0,
              count: 0
            })
          }
          
          const serviceData = servicesMap.get(service)
          serviceData.revenue += revenuePerService
          serviceData.count += 1
        })
      }
    })

    const topServices = Array.from(servicesMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map(service => ({
        name: service.name,
        revenue: service.revenue,
        count: service.count,
        avgPrice: service.revenue / service.count
      }))
    
    setServicesRevenue(topServices)
  }, [rows])

  // Handle PIN verification
  const handlePinSubmit = () => {
    if (pinInput === DASHBOARD_PIN) {
      setIsPinVerified(true)
      setPinError("")
      setPinInput("")
      setAttempts(0)
    } else {
      const newAttempts = attempts + 1
      setAttempts(newAttempts)
      setPinError(`Incorrect PIN. ${MAX_ATTEMPTS - newAttempts} attempts remaining.`)
      setPinInput("")
      
      if (newAttempts >= MAX_ATTEMPTS) {
        setPinError("Too many failed attempts. Please contact administrator.")
      }
    }
  }

  const handlePinKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && pinInput.length >= 4 && attempts < MAX_ATTEMPTS) {
      handlePinSubmit()
    }
  }

  const handleGoBack = () => {
    router.push('/appointments')
  }

  // Check if user has access to dashboard
  useEffect(() => {
    // Reset PIN verification when user changes
    setIsPinVerified(false)
    setPinInput("")
    setPinError("")
    setAttempts(0)
  }, [user])

  // If PIN not verified, show PIN entry dialog
  if (!isPinVerified) {
    return (
      <RoleGuard requiredTeamPrefix="">
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 border-b border-[#601625]/20">
              <div className="flex items-center gap-2 px-4">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4 bg-[#601625]/30" />
                <h1 className="font-semibold text-[#601625]">Dashboard</h1>
              </div>
            </header>

            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
              <Dialog open={true}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader className="text-center">
                    <DialogTitle className="flex items-center justify-center gap-2 text-xl text-[#601625]">
                      <Lock className="h-6 w-6 text-[#601625]" />
                      Admin Access Only
                    </DialogTitle>
                    <DialogDescription className="mt-2 text-[#751a29]/80">
                      Please enter PIN:
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 pt-4">
                    <div className="relative">
                      <Input
                        type={showPin ? "text" : "password"}
                        placeholder="Enter PIN"
                        value={pinInput}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                          setPinInput(value)
                          setPinError("")
                        }}
                        onKeyPress={handlePinKeyPress}
                        className="pr-10 text-center text-lg tracking-widest border-[#601625]/30 focus:border-[#601625] focus:ring-[#601625]/20"
                        maxLength={6}
                        disabled={attempts >= MAX_ATTEMPTS}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-[#601625]/10"
                        onClick={() => setShowPin(!showPin)}
                        disabled={attempts >= MAX_ATTEMPTS}
                      >
                        {showPin ? (
                          <EyeOff className="h-4 w-4 text-[#601625]/70" />
                        ) : (
                          <Eye className="h-4 w-4 text-[#601625]/70" />
                        )}
                      </Button>
                    </div>
                    
                    {pinError && (
                      <div className="text-sm text-red-700 text-center bg-red-50 border border-red-200 p-3 rounded-md">
                        {pinError}
                      </div>
                    )}
                    
                    <div className="flex gap-3">
                      <Button 
                        variant="outline"
                        onClick={handleGoBack}
                        className="flex-1 border-[#601625]/30 text-[#601625] hover:bg-[#601625]/10 hover:border-[#601625]/50"
                      >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Go Back
                      </Button>
                      <Button 
                        onClick={handlePinSubmit}
                        disabled={pinInput.length < 4 || attempts >= MAX_ATTEMPTS}
                        className="flex-1 bg-[#601625] hover:bg-[#751a29] text-white transition-colors duration-200"
                      >
                        {attempts >= MAX_ATTEMPTS ? "Access Locked" : "Verify PIN"}
                      </Button>
                    </div>
                    
                    <div className="text-xs text-[#751a29]/60 text-center">
                      PIN must be 4-6 digits
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </RoleGuard>
    )
  }

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
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
            {/* Date Filter Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant={selectedFilter === "today" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedFilter("today")}
                className={`rounded-full h-8 px-4 text-xs font-medium transition-all ${
                  selectedFilter === "today"
                    ? "bg-[#601625] hover:bg-[#751a29] text-white"
                    : "hover:bg-[#601625]/5"
                }`}
              >
                Today
              </Button>
              <Button
                variant={selectedFilter === "thisWeek" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedFilter("thisWeek")}
                className={`rounded-full h-8 px-4 text-xs font-medium transition-all ${
                  selectedFilter === "thisWeek"
                    ? "bg-[#601625] hover:bg-[#751a29] text-white"
                    : "hover:bg-[#601625]/5"
                }`}
              >
                This Week
              </Button>
              <Button
                variant={selectedFilter === "thisMonth" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedFilter("thisMonth")}
                className={`rounded-full h-8 px-4 text-xs font-medium transition-all ${
                  selectedFilter === "thisMonth"
                    ? "bg-[#601625] hover:bg-[#751a29] text-white"
                    : "hover:bg-[#601625]/5"
                }`}
              >
                This Month
              </Button>
              <Button
                variant={selectedFilter === "thisYear" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedFilter("thisYear")}
                className={`rounded-full h-8 px-4 text-xs font-medium transition-all ${
                  selectedFilter === "thisYear"
                    ? "bg-[#601625] hover:bg-[#751a29] text-white"
                    : "hover:bg-[#601625]/5"
                }`}
              >
                This Year
              </Button>
              
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant={selectedFilter === "custom" ? "default" : "outline"}
                    size="sm"
                    className={`rounded-full h-8 px-4 text-xs font-medium transition-all ${
                      selectedFilter === "custom"
                        ? "bg-[#601625] hover:bg-[#751a29] text-white"
                        : "hover:bg-[#601625]/5"
                    }`}
                  >
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                    {dateRange?.from && dateRange?.to
                      ? `${format(dateRange.from, "MMM dd")} - ${format(dateRange.to, "MMM dd")}`
                      : "Custom"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={(range) => {
                      setDateRange(range)
                      // Only close and apply filter when BOTH dates are selected
                      if (range?.from && range?.to) {
                        setSelectedFilter("custom")
                        setIsCalendarOpen(false)
                      }
                    }}
                    disabled={(date) => {
                      // Disable future dates - only allow today and past dates
                      return date > new Date()
                    }}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
                  </div>

            {/* Enhanced KPI Cards - Cloned from Payments Page */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {loading ? (
                <>
                  <Skeleton className="h-[88px] rounded-2xl" />
                  <Skeleton className="h-[88px] rounded-2xl" />
                  <Skeleton className="h-[88px] rounded-2xl" />
                  <Skeleton className="h-[88px] rounded-2xl" />
                  <Skeleton className="h-[88px] rounded-2xl" />
                </>
                  ) : (
                    <>
                  <Card className="rounded-xl border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[12px] font-bold text-slate-500 uppercase tracking-wide">Total Revenue</div>
                          <div className="text-[24px] font-normal text-[#601625] mt-1">{formatCurrency(kpis.revenue)}</div>
                        </div>
                        <div className="h-10 w-10 rounded-xl bg-[#601625]/10 flex items-center justify-center">
                          <DollarSign className="h-5 w-5 text-[#601625]" />
                        </div>
                      </div>
                </CardContent>
              </Card>

                  <Card className="rounded-xl border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[12px] font-bold text-slate-500 uppercase tracking-wide">Total Tips</div>
                          <div className="text-[24px] font-normal text-[#601625] mt-1">{formatCurrency(kpis.tips)}</div>
            </div>
                        <div className="h-10 w-10 rounded-xl bg-[#601625]/10 flex items-center justify-center">
                          <TrendingUp className="h-5 w-5 text-[#601625]" />
                                    </div>
                                  </div>
                </CardContent>
              </Card>

                  <Card className="rounded-xl border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[12px] font-bold text-slate-500 uppercase tracking-wide">Transactions</div>
                          <div className="text-[24px] font-normal text-[#601625] mt-1">{kpis.count}</div>
                                      </div>
                        <div className="h-10 w-10 rounded-xl bg-[#601625]/10 flex items-center justify-center">
                          <CreditCard className="h-5 w-5 text-[#601625]" />
                                      </div>
                                    </div>
                </CardContent>
              </Card>

                  <Card className="rounded-xl border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[12px] font-bold text-slate-500 uppercase tracking-wide">Active Staff</div>
                          <div className="text-[24px] font-normal text-[#601625] mt-1">{kpis.uniqueStaff}</div>
            </div>
                        <div className="h-10 w-10 rounded-xl bg-[#601625]/10 flex items-center justify-center">
                          <Users className="h-5 w-5 text-[#601625]" />
                                    </div>
                                    </div>
                </CardContent>
              </Card>

                  <Card className="rounded-xl border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[12px] font-bold text-slate-500 uppercase tracking-wide">Avg. Ticket</div>
                          <div className="text-[24px] font-normal text-[#601625] mt-1">{formatCurrency(kpis.avg)}</div>
                                    </div>
                        <div className="h-10 w-10 rounded-xl bg-[#601625]/10 flex items-center justify-center">
                          <CalendarIcon className="h-5 w-5 text-[#601625]" />
                                    </div>
                                  </div>
                </CardContent>
              </Card>
                    </>
                  )}
            </div>

            {/* Staff Performance & Services Revenue Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Staff Performance Table - 50% */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium text-[#601625]">Staff Performance</h2>
                  <Badge variant="outline" className="text-xs border-[#601625]/20 text-[#601625] px-3 py-1">
                    Top 5 Staff
                  </Badge>
                </div>
                
                <StaffPerformanceTable 
                  data={staffPerformance.slice(0, 5)} 
                  selectedStaff={selectedStaff}
                  onStaffSelect={setSelectedStaff}
                />
                                      </div>

              {/* Services Revenue - 50% */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium text-[#601625]">Services Revenue</h2>
                  <Badge variant="outline" className="text-xs border-[#601625]/20 text-[#601625] px-3 py-1">
                    Top 5 Services
                  </Badge>
                                      </div>
                
                <ServicesRevenueTable data={servicesRevenue} />
                                    </div>
                                  </div>

            {/* Expanded Staff Detail Card */}
            {selectedStaff && (
              <Card className="rounded-xl border-2 border-slate-300 shadow-lg bg-gradient-to-r from-slate-50 to-white">
                <CardContent className="p-6">
                  {(() => {
                    const staff = staffPerformance.find(s => s.staffId === selectedStaff)
                    if (!staff) return null
                    
                                return (
                      <div className="space-y-6">
                        {/* Staff Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-slate-600 flex items-center justify-center">
                              <span className="text-white font-medium text-lg">
                                {staff.staffName.charAt(0).toUpperCase()}
                              </span>
                                      </div>
                            <div>
                              <h3 className="text-xl font-medium text-slate-700">{staff.staffName}</h3>
                              <p className="text-sm text-slate-500">Staff Member</p>
                                      </div>
                                    </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedStaff(null)}
                            className="text-slate-600 border-slate-200 hover:bg-slate-50"
                          >
                            Close
                          </Button>
                                  </div>

                        {/* Performance Metrics Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                          <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                            <div className="text-2xl font-medium text-slate-800">{formatCurrency(staff.totalRevenue)}</div>
                            <div className="text-sm text-slate-500">Total Revenue</div>
                                      </div>
                          <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                            <div className="text-2xl font-medium text-slate-800">{Math.round(staff.totalServices)}</div>
                            <div className="text-sm text-slate-500">Services Completed</div>
                                      </div>
                          <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                            <div className="text-2xl font-medium text-slate-800">{staff.totalHours}h</div>
                            <div className="text-sm text-slate-500">Total Hours</div>
                                      </div>
                          <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                            <div className="text-2xl font-medium text-slate-800">{staff.efficiency}%</div>
                            <div className="text-sm text-slate-500">Efficiency</div>
                                    </div>
                                  </div>

                        {/* Rating & Performance Details */}
                        <div className="grid md:grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <h4 className="font-medium text-slate-700">Performance Rating</h4>
                            <div className="flex items-center gap-2">
                              <div className="flex">
                                {[...Array(5)].map((_, i) => (
                                  <span
                                    key={i}
                                    className={`text-lg ${
                                      i < Math.floor(staff.avgRating) ? 'text-yellow-400' : 'text-gray-300'
                                    }`}
                                  >
                                    ★
                                  </span>
                                ))}
                      </div>
                              <span className="font-medium text-slate-700">{staff.avgRating.toFixed(1)}/5.0</span>
                    </div>
            </div>

                          <div className="space-y-3">
                            <h4 className="font-medium text-slate-700">Performance Summary</h4>
                            <div className="text-sm text-slate-600 space-y-1">
                              <p>• Average revenue per service: {formatCurrency(staff.totalRevenue / staff.totalServices)}</p>
                              <p>• Revenue per hour: {formatCurrency(staff.totalRevenue / staff.totalHours)}</p>
                              <p>• Services per hour: {(staff.totalServices / staff.totalHours).toFixed(1)}</p>
                  </div>
                  </div>
                </div>
                      </div>
                    )
                  })()}
              </CardContent>
            </Card>
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </RoleGuard>
  )
}

