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
import { PaymentMethodsSection, type PaymentMethod } from "@/components/payment-methods-section"
import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Lock, Eye, EyeOff, ArrowLeft, DollarSign, TrendingUp, Users, Calendar as CalendarIcon, CreditCard, Package, Receipt, Gift, Smartphone, CheckCircle, Clock, XCircle, Timer, Scissors } from "lucide-react"
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
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [serviceCategories, setServiceCategories] = useState<any[]>([])
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null)
  const [showAllStaff, setShowAllStaff] = useState(false)
  const [sectionsLoading, setSectionsLoading] = useState(true)
  
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
      setSectionsLoading(true)
      try {
        const res = await fetch(`/api/transactions?limit=100`)
        const json = await res.json()
        if (!res.ok || !json.ok) throw new Error(json.error || 'Failed to load')
        
        const transactions = json.data || []
        setRows(transactions)
        
        // Add 0.5 second delay for skeleton loading
        setTimeout(() => {
          setSectionsLoading(false)
        }, 500)
      } catch (e: unknown) {
        console.error('Error loading payments:', e)
        setSectionsLoading(false)
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
    if (filteredRows.length === 0) return

    // Group transactions by staff
    const staffMap = new Map()
    
    filteredRows.forEach(row => {
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
    
    filteredRows.forEach(row => {
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

    // Calculate payment methods - map checkout methods to proper names
    const paymentMethodsMap = new Map()
    
    // Define the payment methods from checkout page
    const checkoutMethods = {
      'visa': 'Visa',
      'mastercard': 'Mastercard', 
      'amex': 'American Express',
      'debit': 'Debit Card',
      'cash': 'Cash',
      'split_payment': 'Split Payment',
      'service_split': 'Service Split',
      'gift_card': 'Gift Card',
      'other': 'Other'
    }
    
    // Debug: Log unique payment methods found in data
    const uniqueMethods = [...new Set(filteredRows.map(row => row.method || 'null'))]
    console.log('📊 Payment methods found in data:', uniqueMethods)
    console.log('📊 Total transactions:', filteredRows.length)
    
    // Debug: Show sample transactions with different methods
    const methodSamples: Record<string, { count: number; totalRevenue: number; sample: any }> = {}
    filteredRows.forEach(row => {
      const method = row.method || 'null'
      if (!methodSamples[method]) {
        methodSamples[method] = {
          count: 0,
          totalRevenue: 0,
          sample: row
        }
      }
      methodSamples[method].count++
      methodSamples[method].totalRevenue += row.totalPaid || 0
    })
    console.log('📊 Method breakdown:', methodSamples)
    
    filteredRows.forEach(row => {
      const rawMethod = row.method || 'other'
      const method = rawMethod.toLowerCase()
      
      // Map to proper display name
      const displayName = checkoutMethods[method as keyof typeof checkoutMethods] || rawMethod
      const methodKey = method
      
      if (!paymentMethodsMap.has(methodKey)) {
        paymentMethodsMap.set(methodKey, {
          name: displayName,
          type: method,
          revenue: 0,
          count: 0,
          icon: getPaymentIcon(method)
        })
      }
      
      const methodData = paymentMethodsMap.get(methodKey)
      methodData.revenue += row.totalPaid || 0
      methodData.count += 1
    })
    
    console.log('📊 Final payment methods calculated:', Array.from(paymentMethodsMap.values()))

    const totalRevenue = Array.from(paymentMethodsMap.values()).reduce((sum, method) => sum + method.revenue, 0)
    
    const paymentMethodsData = Array.from(paymentMethodsMap.values())
      .map(method => ({
        ...method,
        percentage: totalRevenue > 0 ? (method.revenue / totalRevenue) * 100 : 0
      }))
      .sort((a, b) => b.revenue - a.revenue)
    
    setPaymentMethods(paymentMethodsData)
  }, [filteredRows])

  // Fetch service categories data
  useEffect(() => {
    const fetchServiceCategories = async () => {
      try {
        // Fetch groups
        const groupsResponse = await fetch('/api/groups')
        if (!groupsResponse.ok) throw new Error('Failed to fetch groups')
        const groupsData = await groupsResponse.json()
        const groups = groupsData.groups || []

        // Fetch services for each group and calculate stats
        const categoryPromises = groups.map(async (group: any) => {
          try {
            const servicesResponse = await fetch(`/api/services?groupId=${group.id}`)
            if (!servicesResponse.ok) return null
            const servicesData = await servicesResponse.json()
            const services = servicesData.services || []

            // Calculate total price from service descriptions
            const totalPrice = services.reduce((sum: number, service: any) => {
              const description = service.description || ''
              const priceMatch = description.match(/CA\$(\d+\.?\d*)/i)
              return sum + (priceMatch ? parseFloat(priceMatch[1]) : 0)
            }, 0)

            // Calculate total assigned staff count
            const totalStaffCount = services.reduce((count: number, service: any) => {
              const teamMembers = service.teamMembers || []
              return count + teamMembers.length
            }, 0)
      
      return {
              id: group.id,
              name: group.name,
              description: group.description,
              serviceCount: services.length,
              totalPrice: totalPrice,
              totalStaffCount: totalStaffCount,
              icon: getServiceCategoryIcon(group.name)
            }
          } catch (error) {
            console.error(`Error fetching services for group ${group.name}:`, error)
            return {
              id: group.id,
              name: group.name,
              description: group.description,
              serviceCount: 0,
              totalPrice: 0,
              totalStaffCount: 0,
              icon: getServiceCategoryIcon(group.name)
            }
          }
        })

        const categories = await Promise.all(categoryPromises)
        const validCategories = categories.filter(Boolean)
        
        console.log('📊 Service categories loaded:', validCategories)
        setServiceCategories(validCategories)
      } catch (error) {
        console.error('Error fetching service categories:', error)
      }
    }

    fetchServiceCategories()
  }, [])

  // Helper function for service category icons
  const getServiceCategoryIcon = (categoryName: string) => {
    const name = categoryName.toLowerCase()
    if (name.includes('bridal') || name.includes('wedding')) return <Gift className="h-4 w-4" />
    if (name.includes('facial') || name.includes('skin')) return <Package className="h-4 w-4" />
    if (name.includes('laser') || name.includes('hair')) return <Scissors className="h-4 w-4" />
    if (name.includes('threading') || name.includes('waxing')) return <Scissors className="h-4 w-4" />
    if (name.includes('gents') || name.includes('men')) return <Users className="h-4 w-4" />
    if (name.includes('ladies') || name.includes('women')) return <Users className="h-4 w-4" />
    return <Package className="h-4 w-4" />
  }

  // Helper function for payment method icons
  const getPaymentIcon = (method: string) => {
    const methodLower = method.toLowerCase()
    if (methodLower === 'cash') return <DollarSign className="h-4 w-4" />
    if (methodLower === 'visa' || methodLower === 'mastercard' || methodLower === 'amex' || methodLower === 'debit') return <CreditCard className="h-4 w-4" />
    if (methodLower === 'gift_card') return <Gift className="h-4 w-4" />
    if (methodLower === 'split_payment' || methodLower === 'service_split') return <Receipt className="h-4 w-4" />
    return <Smartphone className="h-4 w-4" />
  }

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
                  {sectionsLoading ? (
                <>
                  <Skeleton className="h-[88px] rounded-2xl" />
                  <Skeleton className="h-[88px] rounded-2xl" />
                  <Skeleton className="h-[88px] rounded-2xl" />
                  <Skeleton className="h-[88px] rounded-2xl" />
                  <Skeleton className="h-[88px] rounded-2xl" />
                </>
                  ) : (
                    <>
                  <Card className="rounded-2xl border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[12px] font-medium text-neutral-500 uppercase tracking-wide">Total Revenue</div>
                          <div className="text-[24px] font-bold text-neutral-900 mt-1">{formatCurrency(kpis.revenue)}</div>
                        </div>
                        <div className="h-10 w-10 rounded-xl bg-[#601625]/10 flex items-center justify-center">
                          <DollarSign className="h-5 w-5 text-[#601625]" />
                        </div>
                      </div>
                </CardContent>
              </Card>

                  <Card className="rounded-2xl border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[12px] font-medium text-neutral-500 uppercase tracking-wide">Total Tips</div>
                          <div className="text-[24px] font-bold text-neutral-900 mt-1">{formatCurrency(kpis.tips)}</div>
            </div>
                        <div className="h-10 w-10 rounded-xl bg-[#601625]/10 flex items-center justify-center">
                          <TrendingUp className="h-5 w-5 text-[#601625]" />
                        </div>
                      </div>
                </CardContent>
              </Card>

                  <Card className="rounded-2xl border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[12px] font-medium text-neutral-500 uppercase tracking-wide">Transactions</div>
                          <div className="text-[24px] font-bold text-neutral-900 mt-1">{kpis.count}</div>
                        </div>
                        <div className="h-10 w-10 rounded-xl bg-[#601625]/10 flex items-center justify-center">
                          <CreditCard className="h-5 w-5 text-[#601625]" />
                        </div>
                      </div>
                </CardContent>
              </Card>

                  <Card className="rounded-2xl border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[12px] font-medium text-neutral-500 uppercase tracking-wide">Active Staff</div>
                          <div className="text-[24px] font-bold text-neutral-900 mt-1">{kpis.uniqueStaff}</div>
                        </div>
                        <div className="h-10 w-10 rounded-xl bg-[#601625]/10 flex items-center justify-center">
                          <Users className="h-5 w-5 text-[#601625]" />
                        </div>
                      </div>
                </CardContent>
              </Card>

                  <Card className="rounded-2xl border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[12px] font-medium text-neutral-500 uppercase tracking-wide">Avg. Ticket</div>
                          <div className="text-[24px] font-bold text-neutral-900 mt-1">{formatCurrency(kpis.avg)}</div>
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

            {/* Payment Methods Section - Full Width */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-[#601625]">Payment Methods</h2>
                <Badge variant="outline" className="text-xs border-[#601625]/20 text-[#601625] px-3 py-1">
                  {sectionsLoading ? <Skeleton className="h-4 w-8" /> : `${paymentMethods.length} Methods`}
                </Badge>
              </div>
              
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-3">
                {sectionsLoading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <Card key={index} className="rounded-xl border-neutral-200 shadow-sm">
                      <CardContent className="p-3">
                        <div className="flex flex-col items-center text-center space-y-2">
                          <Skeleton className="h-8 w-8 rounded-lg" />
                          <div className="space-y-1">
                            <Skeleton className="h-3 w-12" />
                            <Skeleton className="h-4 w-16" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  paymentMethods.map((method, index) => (
                    <Card 
                      key={method.type} 
                      className="rounded-xl border-neutral-200 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <CardContent className="p-3">
                        <div className="flex flex-col items-center text-center space-y-2">
                          <div className="h-8 w-8 rounded-lg bg-[#601625]/10 flex items-center justify-center">
                            {method.icon}
                          </div>
                          <div>
                            <div className="text-[10px] font-medium text-neutral-500 uppercase tracking-wide">
                              {method.name}
                            </div>
                            <div className="text-[16px] font-bold text-neutral-900 mt-1">
                              {formatCurrency(method.revenue)}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>

            {/* Service Categories Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-[#601625]" />
                  <h2 className="text-lg font-semibold text-[#601625]">Service Categories</h2>
                  <Badge variant="outline" className="text-xs border-[#601625]/20 text-[#601625] px-3 py-1">
                    {sectionsLoading ? <Skeleton className="h-4 w-8" /> : `${serviceCategories.length} Categories`}
                  </Badge>
                </div>
              </div>
              
              <div className="flex items-center gap-3 overflow-x-auto pb-2">
                {sectionsLoading ? (
                  Array.from({ length: 7 }).map((_, index) => (
                    <Card
                      key={index}
                      className="min-w-[180px] max-w-[180px] rounded-lg border-[#601625]/20 shadow-sm flex-shrink-0"
                    >
                      <CardContent className="py-2 px-3">
                        <div className="flex flex-col items-center text-center space-y-1">
                          <Skeleton className="h-7 w-7 rounded-lg" />
                          <div className="w-full space-y-1">
                            <Skeleton className="h-4 w-20 mx-auto" />
                            <Skeleton className="h-3 w-16 mx-auto" />
                            <Skeleton className="h-3 w-12 mx-auto" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  serviceCategories.map((category, index) => (
                    <Card
                      key={category.id}
                      className="min-w-[180px] max-w-[180px] rounded-lg border-[#601625]/20 shadow-sm hover:shadow-md transition-all duration-200 hover:border-[#601625]/40 flex-shrink-0"
                    >
                      <CardContent className="py-2 px-3">
                        <div className="flex flex-col items-center text-center space-y-1">
                          <div className="h-7 w-7 rounded-lg bg-[#601625]/10 flex items-center justify-center">
                            <div className="h-4 w-4 text-[#601625]">
                              {category.icon}
                            </div>
                          </div>
                          <div className="w-full">
                            <div className="text-base font-semibold text-[#601625] mb-1 truncate">
                              {category.name}
                            </div>
                            <div className="text-sm text-neutral-600 space-y-0.5">
                              <div className="truncate">{category.serviceCount} services</div>
                              <div className="font-medium text-[#601625] truncate">{formatCurrency(category.totalPrice)}</div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>

            {/* Staff Performance & Services Revenue Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Staff Performance Table - 50% */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium text-[#601625]">Staff Performance</h2>
                  <Badge variant="outline" className="text-xs border-[#601625]/20 text-[#601625] px-3 py-1">
                    {sectionsLoading ? <Skeleton className="h-4 w-8" /> : "Top 5 Staff"}
                  </Badge>
                </div>
                
                {sectionsLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div key={index} className="flex items-center space-x-4 p-3 border rounded-lg">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-24" />
                          <div className="flex space-x-2">
                            <Skeleton className="h-3 w-16" />
                            <Skeleton className="h-3 w-12" />
                            <Skeleton className="h-3 w-14" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <StaffPerformanceTable 
                    data={staffPerformance.slice(0, 5)} 
                    selectedStaff={selectedStaff}
                    onStaffSelect={setSelectedStaff}
                  />
                )}
              </div>

              {/* Services Revenue - 50% */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium text-[#601625]">Services Revenue</h2>
                  <Badge variant="outline" className="text-xs border-[#601625]/20 text-[#601625] px-3 py-1">
                    {sectionsLoading ? <Skeleton className="h-4 w-8" /> : "Top 5 Services"}
                  </Badge>
                </div>
                
                {sectionsLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div key={index} className="flex items-center space-x-4 p-3 border rounded-lg">
                        <Skeleton className="h-6 w-6 rounded" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <div className="flex space-x-2">
                            <Skeleton className="h-3 w-16" />
                            <Skeleton className="h-3 w-12" />
                            <Skeleton className="h-3 w-14" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ServicesRevenueTable data={servicesRevenue} />
                )}
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

