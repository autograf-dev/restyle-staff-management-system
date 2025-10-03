"use client"
import { AppSidebar } from "@/components/app-sidebar"
import { RoleGuard } from "@/components/role-guard"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { StaffPerformanceTable, type StaffPerformance } from "@/components/staff-performance-table"
import { ServicesRevenueTable, type ServiceRevenue } from "@/components/services-revenue-table"
import { type PaymentMethod } from "@/components/payment-methods-section"
import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Lock, Eye, EyeOff, ArrowLeft, DollarSign, TrendingUp, Users, Calendar as CalendarIcon, CreditCard, Package, Receipt, Gift, Smartphone, Scissors } from "lucide-react"
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

interface OldTxItemRow {
  idx: number
  rowId: string
  paymentId: string
  staffName: string | null
  staffTipSplit: number
  staffTipCollected: number
  serviceId: string | null
  serviceName: string | null
  servicePrice: number
  paidCheck: boolean
  paymentDate: string | null
  paymentAt: string | null
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
  const [rows, setRows] = useState<TxRow[]>([])
  const [oldTxItems, setOldTxItems] = useState<OldTxItemRow[]>([])
  const [staffPerformance, setStaffPerformance] = useState<StaffPerformance[]>([])
  const [servicesRevenue, setServicesRevenue] = useState<ServiceRevenue[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [serviceCategories, setServiceCategories] = useState<Array<{
    id: string;
    name: string;
    description: string;
    serviceCount: number;
    totalPrice: number;
    totalStaffCount: number;
    icon: React.ReactNode;
  }>>([])
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null)
  const [sectionsLoading, setSectionsLoading] = useState(true)
  
  // Date Filter State
  type FilterType = "today" | "thisWeek" | "thisMonth" | "thisYear" | "custom" | "alltime"
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("alltime")
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [customDateDialogOpen, setCustomDateDialogOpen] = useState(false)
  const [tempStartDate, setTempStartDate] = useState<Date | undefined>()
  const [tempEndDate, setTempEndDate] = useState<Date | undefined>()
  const [staffDetailDialogOpen, setStaffDetailDialogOpen] = useState(false)

  const formatCurrency = (n?: number | null) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Number(n || 0))

  // Handle custom date dialog
  const handleCustomDateClick = () => {
    setCustomDateDialogOpen(true)
    // Initialize with current date range if available
    if (dateRange?.from) setTempStartDate(dateRange.from)
    if (dateRange?.to) setTempEndDate(dateRange.to)
  }

  const handleApplyCustomDate = () => {
    if (tempStartDate && tempEndDate) {
      // Ensure end date includes the full day (23:59:59)
      const endDate = new Date(tempEndDate)
      endDate.setHours(23, 59, 59, 999)
      
      setDateRange({ from: tempStartDate, to: endDate })
      setSelectedFilter("custom")
      setCustomDateDialogOpen(false)
    }
  }

  const handleCancelCustomDate = () => {
    setCustomDateDialogOpen(false)
    setTempStartDate(undefined)
    setTempEndDate(undefined)
  }

  // Handle staff detail dialog
  const handleStaffSelect = (staffId: string | null) => {
    if (staffId) {
      setSelectedStaff(staffId)
      setStaffDetailDialogOpen(true)
    }
  }

  const handleCloseStaffDetail = () => {
    setStaffDetailDialogOpen(false)
    setSelectedStaff(null)
  }

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
      case "alltime": {
        return { start: new Date(1970, 0, 1), end: new Date(2100, 0, 1) }
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

  // Special date range function for V1 data (which is in 2025)
  const getV1DateRange = (filter: FilterType): { start: Date; end: Date } => {
    // V1 data is from 2025, so we need to adjust date ranges accordingly
    const v1Year = 2025
    const now = new Date()
    const today = new Date(v1Year, now.getMonth(), now.getDate())
    
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
        const monthStart = new Date(v1Year, now.getMonth(), 1)
        const monthEnd = new Date(v1Year, now.getMonth() + 1, 0, 23, 59, 59)
        return { start: monthStart, end: monthEnd }
      }
      case "thisYear": {
        // For V1 data, "thisYear" means all of 2025 since that's when the V1 data exists
        const yearStart = new Date(v1Year, 0, 1)
        const yearEnd = new Date(v1Year, 11, 31, 23, 59, 59)
        return { start: yearStart, end: yearEnd }
      }
      case "alltime": {
        return { start: new Date(v1Year, 0, 1), end: new Date(v1Year, 11, 31, 23, 59, 59) }
      }
      case "custom":
        if (dateRange?.from && dateRange?.to) {
          // For custom ranges, use the selected dates but map them to 2025
          const fromYear = v1Year
          const toYear = v1Year
          const start = new Date(fromYear, dateRange.from.getMonth(), dateRange.from.getDate())
          const end = new Date(toYear, dateRange.to.getMonth(), dateRange.to.getDate(), 23, 59, 59)
          return { start, end }
        }
        // Fallback to all of 2025
        return { start: new Date(v1Year, 0, 1), end: new Date(v1Year, 11, 31, 23, 59, 59) }
      default:
        // Default to all of 2025 for V1 data
        return { start: new Date(v1Year, 0, 1), end: new Date(v1Year, 11, 31, 23, 59, 59) }
    }
  }

  // Filter rows based on selected date range
  const filteredRows = useMemo(() => {
    // For alltime, include all rows (even those without Payment/Date)
    if (selectedFilter === "alltime") {
      console.log('📅 Date Filter Debug (alltime):', {
        selectedFilter,
        totalRows: rows.length
      })
      return rows
    }

    const { start, end } = getDateRange(selectedFilter)
    const normalizeDate = (date: Date) => {
      const normalized = new Date(date)
      normalized.setHours(0, 0, 0, 0)
      return normalized
    }
    const startDate = normalizeDate(start)
    const endDate = normalizeDate(end)
    const filtered = rows.filter(row => {
      if (!row.paymentDate) return false
      const paymentDate = normalizeDate(new Date(row.paymentDate))
      return paymentDate >= startDate && paymentDate <= endDate
    })
    console.log('📅 Date Filter Debug:', {
      selectedFilter,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      totalRows: rows.length,
      filteredRows: filtered.length,
      samplePaymentDates: filtered.slice(0, 3).map(r => r.paymentDate)
    })
    return filtered
  }, [rows, selectedFilter, dateRange])

  // Filter old transaction items based on selected date range (V1 data is in 2025)
  const filteredOldTxItems = useMemo(() => {
    const { start, end } = getV1DateRange(selectedFilter)
    
    // Normalize dates to compare only date parts (ignore time)
    const normalizeDate = (date: Date) => {
      const normalized = new Date(date)
      normalized.setHours(0, 0, 0, 0)
      return normalized
    }
    
    const startDate = normalizeDate(start)
    const endDate = normalizeDate(end)
    
    const filtered = oldTxItems.filter(item => {
      if (!item.paymentDate && !item.paymentAt) return false
      try {
        // Use payment_at if available, otherwise fall back to payment_date
        const dateStr = item.paymentAt || item.paymentDate
        if (!dateStr) return false
        
        const paymentDate = normalizeDate(new Date(dateStr))
        return paymentDate >= startDate && paymentDate <= endDate
      } catch {
        return false
      }
    })
    
    // Debug logging
    console.log('📅 V1 Transaction Items Filter Debug (2025 data):', {
      selectedFilter,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      totalOldItems: oldTxItems.length,
      filteredOldItems: filtered.length,
      sampleOldPaymentDates: filtered.slice(0, 3).map(r => r.paymentAt || r.paymentDate)
    })
    
    return filtered
  }, [oldTxItems, selectedFilter, dateRange])

  // Calculate KPIs from filtered data
  const kpis = useMemo(() => {
    const count = filteredRows.length
    const revenue = filteredRows.reduce((sum, r) => sum + Number(r.totalPaid || 0), 0)
    const tips = filteredRows.reduce((sum, r) => sum + Number(r.tip || 0), 0)
    // Service revenue ONLY from Transaction Items → strict sum of item.price
    const subtotal = filteredRows.reduce((sum, r) => {
      const itemsTotal = Array.isArray(r.items)
        ? r.items.reduce((s: number, it: any) => s + Number(it.price || 0), 0)
        : 0
      return sum + itemsTotal
    }, 0)
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

  // Calculate V1 metrics from old transaction items (comprehensive structure)
  const v1Metrics = useMemo(() => {
    if (filteredOldTxItems.length === 0) {
      return {
        // Store Level Metrics
        store: {
          totalRevenue: 0,
          totalTax: 0,
          serviceRevenue: 0,
          productRevenue: 0,
          totalTips: 0,
          totalTransactions: 0,
          uniqueStaffCount: 0
        },
        // Per Employee Metrics
        employees: new Map<string, {
          staffName: string,
          totalRevenue: number,
          totalTax: number,
          serviceRevenue: number,
          productRevenue: number,
          totalTips: number,
          transactionCount: number
        }>()
      }
    }

    const employees = new Map<string, {
      staffName: string,
      totalRevenue: number,
      totalTax: number,
      serviceRevenue: number,
      productRevenue: number,
      totalTips: number,
      transactionCount: number
    }>()
    
    const uniquePayments = new Set<string>()
    
    // Store level totals
    let storeTotalRevenue = 0
    let storeTotalTax = 0  // V1 data doesn't have tax info, will be 0
    let storeServiceRevenue = 0
    let storeProductRevenue = 0  // V1 data doesn't have product info, will be 0
    let storeTotalTips = 0

    // Process each transaction item
    filteredOldTxItems.forEach(item => {
      if (!item.staffName) return
      
      const staffName = item.staffName.trim()
      const servicePrice = item.servicePrice || 0
      const tipCollected = item.staffTipCollected || 0
      
      // V1 data only has service revenue, no product revenue or tax breakdown
      const itemTotalRevenue = servicePrice
      const itemTax = 0  // Not available in V1 data
      const itemServiceRevenue = servicePrice
      const itemProductRevenue = 0  // Not available in V1 data
      
      // Update store level totals
      storeTotalRevenue += itemTotalRevenue
      storeTotalTax += itemTax
      storeServiceRevenue += itemServiceRevenue
      storeProductRevenue += itemProductRevenue
      storeTotalTips += tipCollected
      
      // Track unique payments for transaction count
      if (item.paymentId) {
        uniquePayments.add(item.paymentId)
      }
      
      // Update or create employee metrics
      if (!employees.has(staffName)) {
        employees.set(staffName, {
          staffName,
          totalRevenue: 0,
          totalTax: 0,
          serviceRevenue: 0,
          productRevenue: 0,
          totalTips: 0,
          transactionCount: 0
        })
      }
      
      const emp = employees.get(staffName)!
      emp.totalRevenue += itemTotalRevenue
      emp.totalTax += itemTax
      emp.serviceRevenue += itemServiceRevenue
      emp.productRevenue += itemProductRevenue
      emp.totalTips += tipCollected
      
      // Count transactions per employee (each item is part of a transaction)
      if (item.paymentId) {
        emp.transactionCount += 1
      }
    })

    const totalTransactions = uniquePayments.size
    const uniqueStaffCount = employees.size

    console.log('📊 V1 Comprehensive Metrics Calculated:', {
      storeLevel: {
        totalRevenue: storeTotalRevenue,
        totalTax: storeTotalTax,
        serviceRevenue: storeServiceRevenue,
        productRevenue: storeProductRevenue,
        totalTips: storeTotalTips,
        totalTransactions,
        uniqueStaffCount
      },
      employeeCount: employees.size,
      sampleEmployees: Array.from(employees.entries()).slice(0, 3).map(([name, data]) => ({
        name,
        revenue: data.totalRevenue,
        tips: data.totalTips,
        transactions: data.transactionCount
      })),
      totalItems: filteredOldTxItems.length
    })

    return {
      store: {
        totalRevenue: storeTotalRevenue,
        totalTax: storeTotalTax,
        serviceRevenue: storeServiceRevenue,
        productRevenue: storeProductRevenue,
        totalTips: storeTotalTips,
        totalTransactions,
        uniqueStaffCount
      },
      employees
    }
  }, [filteredOldTxItems])


  // Fetch transactions data
  useEffect(() => {
    const load = async () => {
      setSectionsLoading(true)
      try {
        // Fetch ALL current transactions with batched parallel paging and incremental append
        const fetchAllTransactionsParallel = async () => {
          const pageSize = 1000
          // First call to read total
          const headRes = await fetch(`/api/transactions?limit=1&offset=0`)
          const headJson = await headRes.json()
          if (!headRes.ok || !headJson.ok) {
            console.warn('Failed to read transaction total:', headJson.error)
            return [] as any[]
          }
          const total: number = Number(headJson.total || 0)
          const pages = Math.ceil(total / pageSize)

          const concurrency = 5
          let all: any[] = []
          for (let start = 0; start < pages; start += concurrency) {
            const tasks = [] as Promise<any>[]
            for (let p = start; p < Math.min(start + concurrency, pages); p++) {
              const offset = p * pageSize
              tasks.push(
                fetch(`/api/transactions?limit=${pageSize}&offset=${offset}`)
                  .then(r => r.json().then(j => ({ r, j })))
                  .then(({ r, j }) => {
                    if (!r.ok || !j.ok) {
                      console.warn('Failed to load transactions page:', j.error)
                      return []
                    }
                    const batch = j.data || []
                    // Incrementally append so UI renders while loading
                    setRows(prev => prev.concat(batch))
                    return batch
                  })
              )
            }
            const results = await Promise.all(tasks)
            results.forEach(b => { all = all.concat(b) })
          }
          return all
        }

        const [allTransactions, oldItemsRes] = await Promise.all([
          fetchAllTransactionsParallel(),
          fetch(`/api/old-transaction-items?limit=1000`)
        ])
        
        // ensure rows state is set if incremental appends didn't cover
        if (allTransactions.length > 0) setRows(allTransactions)
        
        // Process old transaction items
        const oldItemsJson = await oldItemsRes.json()
        if (!oldItemsRes.ok || !oldItemsJson.ok) {
          console.warn('Failed to load old transaction items:', oldItemsJson.error)
        } else {
          const oldItems = oldItemsJson.data || []
          console.log('📊 Loaded old transaction items:', oldItems.length)
          setOldTxItems(oldItems)
        }
        
        // Add 0.5 second delay for skeleton loading
        setTimeout(() => {
          setSectionsLoading(false)
        }, 500)
      } catch (e: unknown) {
        console.error('Error loading data:', e)
        setSectionsLoading(false)
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
          
          // Add rating if available (stable mock data based on staff name)
          const staffHash = staffName.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
          if (staffHash % 10 > 3) { // 70% chance of having a rating based on name hash
            const rating = 3.5 + (staffHash % 15) / 10 // Rating between 3.5-5.0 based on name
            staff.ratings.push(rating)
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
    const methodSamples: Record<string, { count: number; totalRevenue: number; sample: TxRow }> = {}
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
        const categoryPromises = groups.map(async (group: { id: string; name: string; description: string }) => {
          try {
            const servicesResponse = await fetch(`/api/services?groupId=${group.id}`)
            if (!servicesResponse.ok) return null
            const servicesData = await servicesResponse.json()
            const services = servicesData.services || []

            // Calculate total price from service descriptions
            const totalPrice = services.reduce((sum: number, service: { description?: string }) => {
              const description = service.description || ''
              const priceMatch = description.match(/CA\$(\d+\.?\d*)/i)
              return sum + (priceMatch ? parseFloat(priceMatch[1]) : 0)
            }, 0)

            // Calculate total assigned staff count
            const totalStaffCount = services.reduce((count: number, service: { teamMembers?: Array<unknown> }) => {
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
                variant={selectedFilter === "alltime" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedFilter("alltime")}
                className={`rounded-full h-8 px-4 text-xs font-medium transition-all ${
                  selectedFilter === "alltime"
                    ? "bg-[#601625] hover:bg-[#751a29] text-white"
                    : "hover:bg-[#601625]/5"
                }`}
              >
                All Time
              </Button>
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
              
              <Button
                variant={selectedFilter === "custom" ? "default" : "outline"}
                size="sm"
                className={`rounded-full h-8 px-4 text-xs font-medium transition-all ${
                  selectedFilter === "custom"
                    ? "bg-[#601625] hover:bg-[#751a29] text-white"
                    : "hover:bg-[#601625]/5"
                }`}
                onClick={handleCustomDateClick}
              >
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                {dateRange?.from && dateRange?.to
                  ? `${format(dateRange.from, "MMM dd")} - ${format(dateRange.to, "MMM dd")}`
                  : "Custom"}
              </Button>
                  </div>

            {/* KPI Summary removed as requested */}

            {/* Metrics from V1 Section - Comprehensive Structure */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-[#601625]" />
                  <h2 className="text-lg font-semibold text-[#601625]">Matrix</h2>
                  <Badge variant="outline" className="text-xs border-[#601625]/20 text-[#601625] px-3 py-1">
                    {sectionsLoading ? <Skeleton className="h-4 w-12" /> : `${kpis.count} Transactions`}
                  </Badge>
                </div>
                <Badge variant="secondary" className="text-xs bg-[#601625]/10 text-[#601625] border-[#601625]/20">
                  Current Data
                </Badge>
              </div>

              {/* 1. STORE LEVEL METRICS */}
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-[#601625] flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-[#601625] text-white flex items-center justify-center text-xs font-bold">1</div>
                  Store Level Metrics
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {sectionsLoading ? (
                    Array.from({ length: 5 }).map((_, index) => (
                      <Card key={index} className="rounded-2xl border-neutral-200 shadow-sm">
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between">
                            <div className="space-y-2">
                              <Skeleton className="h-3 w-24" />
                              <Skeleton className="h-6 w-20" />
                            </div>
                            <Skeleton className="h-10 w-10 rounded-xl" />
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <>
                      <Card className="rounded-2xl border-[#601625]/20 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-[#601625]/5 to-[#751a29]/5">
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-[12px] font-medium text-[#601625]/70 uppercase tracking-wide">Total Revenue</div>
                              <div className="text-[20px] font-bold text-[#601625] mt-1">{formatCurrency(kpis.revenue)}</div>
                            </div>
                            <div className="h-10 w-10 rounded-xl bg-[#601625]/15 flex items-center justify-center">
                              <DollarSign className="h-5 w-5 text-[#601625]" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="rounded-2xl border-[#601625]/20 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-[#601625]/5 to-[#751a29]/5">
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-[12px] font-medium text-[#601625]/70 uppercase tracking-wide">Total Tax</div>
                              <div className="text-[20px] font-bold text-[#601625] mt-1">{formatCurrency(kpis.tax)}</div>
                            </div>
                            <div className="h-10 w-10 rounded-xl bg-[#601625]/15 flex items-center justify-center">
                              <Receipt className="h-5 w-5 text-[#601625]" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="rounded-2xl border-[#601625]/20 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-[#601625]/5 to-[#751a29]/5">
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-[12px] font-medium text-[#601625]/70 uppercase tracking-wide">Service Revenue</div>
                              <div className="text-[20px] font-bold text-[#601625] mt-1">{formatCurrency(kpis.subtotal)}</div>
                            </div>
                            <div className="h-10 w-10 rounded-xl bg-[#601625]/15 flex items-center justify-center">
                              <Scissors className="h-5 w-5 text-[#601625]" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="rounded-2xl border-[#601625]/20 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-[#601625]/5 to-[#751a29]/5">
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-[12px] font-medium text-[#601625]/70 uppercase tracking-wide">Product Revenue</div>
                              <div className="text-[20px] font-bold text-[#601625] mt-1">{formatCurrency(Math.max(0, kpis.revenue - kpis.subtotal))}</div>
                            </div>
                            <div className="h-10 w-10 rounded-xl bg-[#601625]/15 flex items-center justify-center">
                              <Package className="h-5 w-5 text-[#601625]" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="rounded-2xl border-[#601625]/20 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-[#601625]/5 to-[#751a29]/5">
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-[12px] font-medium text-[#601625]/70 uppercase tracking-wide">Total Tips</div>
                              <div className="text-[20px] font-bold text-[#601625] mt-1">{formatCurrency(kpis.tips)}</div>
                            </div>
                            <div className="h-10 w-10 rounded-xl bg-[#601625]/15 flex items-center justify-center">
                              <TrendingUp className="h-5 w-5 text-[#601625]" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </>
                  )}
                </div>
              </div>

              {/* 2. PER EMPLOYEE METRICS */}
              {!sectionsLoading && v1Metrics.employees.size > 0 && (
                <div className="space-y-4">
                  <h3 className="text-md font-semibold text-[#601625] flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-[#601625] text-white flex items-center justify-center text-xs font-bold">2</div>
                    Per Employee Metrics ({v1Metrics.store.uniqueStaffCount} Staff Members)
                  </h3>
                  
                  <Card className="rounded-2xl border-[#601625]/20 shadow-sm bg-gradient-to-br from-[#601625]/5 to-[#751a29]/5">
                    <CardContent className="p-6">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-[#601625]/20">
                              <th className="text-left py-3 px-4 text-sm font-semibold text-[#601625]">Staff Member</th>
                              <th className="text-right py-3 px-4 text-sm font-semibold text-[#601625]">Total Revenue</th>
                              <th className="text-right py-3 px-4 text-sm font-semibold text-[#601625]">Total Tax</th>
                              <th className="text-right py-3 px-4 text-sm font-semibold text-[#601625]">Service Revenue</th>
                              <th className="text-right py-3 px-4 text-sm font-semibold text-[#601625]">Product Revenue</th>
                              <th className="text-right py-3 px-4 text-sm font-semibold text-[#601625]">Tips</th>
                              <th className="text-right py-3 px-4 text-sm font-semibold text-[#601625]">Transactions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from(v1Metrics.employees.entries())
                              .sort(([,a], [,b]) => b.totalRevenue - a.totalRevenue) // Sort by total revenue descending
                              .slice(0, 20) // Show top 20 staff
                              .map(([staffName, empData]) => (
                                <tr key={staffName} className="border-b border-[#601625]/10 hover:bg-[#601625]/5 transition-colors">
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-3">
                                      <div className="h-8 w-8 rounded-full bg-[#601625] flex items-center justify-center">
                                        <span className="text-white font-semibold text-sm">
                                          {staffName.charAt(0).toUpperCase()}
                                        </span>
                                      </div>
                                      <span className="font-medium text-[#601625]">{staffName}</span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-right font-bold text-[#601625]">{formatCurrency(empData.totalRevenue)}</td>
                                  <td className="py-3 px-4 text-right text-gray-400">{formatCurrency(empData.totalTax)}</td>
                                  <td className="py-3 px-4 text-right font-medium text-[#601625]">{formatCurrency(empData.serviceRevenue)}</td>
                                  <td className="py-3 px-4 text-right text-gray-400">{formatCurrency(empData.productRevenue)}</td>
                                  <td className="py-3 px-4 text-right font-medium text-[#751a29]">{formatCurrency(empData.totalTips)}</td>
                                  <td className="py-3 px-4 text-right text-neutral-600">{empData.transactionCount}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                      
                      {v1Metrics.employees.size > 20 && (
                        <div className="mt-4 text-center text-sm text-[#601625]/60">
                          Showing top 20 of {v1Metrics.employees.size} staff members
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>

            {/* Payment Methods section removed per request */}

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
                    onStaffSelect={handleStaffSelect}
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

          </div>
        </SidebarInset>
      </SidebarProvider>

      {/* Custom Date Range Dialog */}
      <Dialog open={customDateDialogOpen} onOpenChange={setCustomDateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Date Range</DialogTitle>
            <DialogDescription>
              Choose your start and end dates to filter the dashboard data.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {tempStartDate ? format(tempStartDate, "PPP") : "Select start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={tempStartDate}
                    onSelect={setTempStartDate}
                    disabled={(date) => date > new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {tempEndDate ? format(tempEndDate, "PPP") : "Select end date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={tempEndDate}
                    onSelect={setTempEndDate}
                    disabled={(date) => date > new Date() || (tempStartDate ? date < tempStartDate : false)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
                                      </div>
                                      </div>
          
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={handleCancelCustomDate}>
              Cancel
            </Button>
            <Button 
              onClick={handleApplyCustomDate}
              disabled={!tempStartDate || !tempEndDate}
              className="bg-[#601625] hover:bg-[#751a29]"
            >
              Apply Filter
            </Button>
                                    </div>
        </DialogContent>
      </Dialog>

      {/* Staff Detail Dialog */}
      <Dialog open={staffDetailDialogOpen} onOpenChange={setStaffDetailDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#601625] flex items-center justify-center">
                <span className="text-white font-semibold text-lg">
                  {selectedStaff ? staffPerformance.find(s => s.staffId === selectedStaff)?.staffName.charAt(0).toUpperCase() : 'S'}
                </span>
                                  </div>
              <div>
                <div className="text-xl font-semibold text-[#601625]">
                  {selectedStaff ? staffPerformance.find(s => s.staffId === selectedStaff)?.staffName : 'Staff Member'}
                </div>
                <div className="text-sm text-neutral-500">Performance Details</div>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {selectedStaff && (() => {
            const staff = staffPerformance.find(s => s.staffId === selectedStaff)
            if (!staff) return null
            
                                return (
              <div className="space-y-6 py-4">
                {/* Performance Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-[#601625]/5 rounded-xl border border-[#601625]/10">
                    <div className="text-2xl font-bold text-[#601625]">{formatCurrency(staff.totalRevenue)}</div>
                    <div className="text-sm font-medium text-neutral-600 mt-1">Total Revenue</div>
                                      </div>
                  <div className="text-center p-4 bg-[#601625]/5 rounded-xl border border-[#601625]/10">
                    <div className="text-2xl font-bold text-[#601625]">{Math.round(staff.totalServices)}</div>
                    <div className="text-sm font-medium text-neutral-600 mt-1">Services Completed</div>
                                      </div>
                  <div className="text-center p-4 bg-[#601625]/5 rounded-xl border border-[#601625]/10">
                    <div className="text-2xl font-bold text-[#601625]">{staff.totalHours}h</div>
                    <div className="text-sm font-medium text-neutral-600 mt-1">Total Hours</div>
                                      </div>
                  <div className="text-center p-4 bg-[#601625]/5 rounded-xl border border-[#601625]/10">
                    <div className="text-2xl font-bold text-[#601625]">{staff.efficiency}%</div>
                    <div className="text-sm font-medium text-neutral-600 mt-1">Efficiency</div>
                                    </div>
                                  </div>

                {/* Rating & Performance Details */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-[#601625]">Performance Rating</h4>
                    <div className="flex items-center gap-3">
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <span
                            key={i}
                            className={`text-2xl ${
                              i < Math.floor(staff.avgRating) ? 'text-yellow-400' : 'text-neutral-300'
                            }`}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                      <span className="text-lg font-bold text-[#601625]">{staff.avgRating.toFixed(1)}/5.0</span>
                    </div>
            </div>

                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-[#601625]">Performance Summary</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-neutral-50 rounded-lg">
                        <span className="text-sm font-medium text-neutral-600">Avg Revenue/Service</span>
                        <span className="font-bold text-[#601625]">{formatCurrency(staff.totalRevenue / staff.totalServices)}</span>
                  </div>
                      <div className="flex justify-between items-center p-3 bg-neutral-50 rounded-lg">
                        <span className="text-sm font-medium text-neutral-600">Revenue/Hour</span>
                        <span className="font-bold text-[#601625]">{formatCurrency(staff.totalRevenue / staff.totalHours)}</span>
                  </div>
                      <div className="flex justify-between items-center p-3 bg-neutral-50 rounded-lg">
                        <span className="text-sm font-medium text-neutral-600">Services/Hour</span>
                        <span className="font-bold text-[#601625]">{(staff.totalServices / staff.totalHours).toFixed(1)}</span>
                </div>
          </div>
                  </div>
                </div>
              </div>
            )
          })()}
          
          <div className="flex justify-end pt-4 border-t border-neutral-200">
            <Button 
              onClick={handleCloseStaffDetail}
              className="bg-[#601625] hover:bg-[#751a29] text-white"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </RoleGuard>
  )
}

