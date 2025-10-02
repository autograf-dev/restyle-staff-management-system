"use client"

export const dynamic = 'force-dynamic'
import { AppSidebar } from "@/components/app-sidebar"
import { RoleGuard } from "@/components/role-guard"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { 
  Target,
  Calendar,
  DollarSign,
  Users,
  Gauge,
  Info
} from "lucide-react"
import { useUser } from "@/contexts/user-context"
import { useEffect, useState, useMemo, Suspense } from "react"

interface TxRow {
  id: string
  paymentDate: string | null
  method: string | null
  totalPaid: number | null
  tip: number | null
  customerPhone: string | null
  staff: string | null
  items: Array<{
    staffName: string
    serviceName: string
    price: number
  }>
}

export default function MatrixPage() {
  const { user } = useUser()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<TxRow[]>([])
  const [services, setServices] = useState<unknown[]>([])
  const [targetRevenueAmount, setTargetRevenueAmount] = useState<number | null>(null)
  const [targetPercentage, setTargetPercentage] = useState<number>(80)
  const [savingTarget, setSavingTarget] = useState(false)
  const [weights, setWeights] = useState<{ revenue: number }>({ revenue: 100 })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [staffFilter, setStaffFilter] = useState<'today' | '7days' | '30days' | 'all'>('30days')


  // Fetch transactions and services data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        // Fetch transactions
        const transactionsRes = await fetch(`/api/transactions?limit=1000`)
        const transactionsJson = await transactionsRes.json()
        if (!transactionsRes.ok || !transactionsJson.ok) throw new Error(transactionsJson.error || 'Failed to load transactions')
        
        const transactions = transactionsJson.data || []
        setRows(transactions)

        // Fetch services
        const servicesRes = await fetch('https://restyle-backend.netlify.app/.netlify/functions/getAllServices')
        if (servicesRes.ok) {
          const servicesJson = await servicesRes.json()
          if (servicesJson.success) {
            const servicesData = servicesJson.calendars || []
            setServices(servicesData)
          }
        }


        // Fetch stored target revenue (per team if applicable)
        try {
          const trRes = await fetch(`/api/settings/target-revenue`)
          const trJson = await trRes.json()
          if (trRes.ok && trJson.ok) {
            if (typeof trJson.value === 'number') setTargetRevenueAmount(trJson.value)
            if (trJson.value && typeof trJson.value === 'object') {
              if (typeof trJson.value.amount === 'number') setTargetRevenueAmount(trJson.value.amount)
              if (typeof trJson.value.targetPercentage === 'number') setTargetPercentage(trJson.value.targetPercentage)
              if (trJson.value.weights) setWeights({
                revenue: Number(trJson.value.weights.revenue ?? 100)
              })
            }
          }
        } catch {}

      } catch (e: unknown) {
        console.error('Error loading data:', e)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  // Calculate real metrics from transaction data
  const metrics = useMemo(() => {
    const totalRevenue = rows.reduce((sum, row) => sum + (row.totalPaid || 0), 0)
    const totalTransactions = rows.length
    // Count only customers who have transactions (unique phone numbers from transactions)
    const uniqueCustomers = new Set(rows.map(row => row.customerPhone).filter(Boolean)).size
    const averageTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0
    const totalTips = rows.reduce((sum, row) => sum + (row.tip || 0), 0)
    
    // Use actual services count from the services API
    const serviceCount = services.length

    // Count unique staff from transactions
    const allStaff = new Set()
    rows.forEach(row => {
      if (row.items) {
        row.items.forEach(item => {
          if (item.staffName) allStaff.add(item.staffName)
        })
      }
    })
    const staffCount = allStaff.size

    // Calculate performance percentage - ONLY REVENUE BASED
    // Prefer stored target revenue; fallback to heuristic based on services x staff
    const targetRevenue = typeof targetRevenueAmount === 'number' && targetRevenueAmount > 0
      ? targetRevenueAmount
      : serviceCount * staffCount * 1000
    const performancePercentage = targetRevenue > 0 ? Math.min(Math.round((totalRevenue / targetRevenue) * 100), 100) : 0

    return {
      totalRevenue,
      totalTransactions,
      uniqueCustomers,
      averageTransaction,
      totalTips,
      serviceCount,
      staffCount,
      performancePercentage,
      targetPercentage,
      targetRevenue
    }
  }, [rows, services, targetRevenueAmount, targetPercentage])

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount)

  // Filter rows based on staff filter
  const filteredRows = useMemo(() => {
    if (staffFilter === 'all') return rows
    
    const now = new Date()
    const filterDate = new Date()
    
    if (staffFilter === 'today') {
      filterDate.setDate(now.getDate())
    } else if (staffFilter === '7days') {
      filterDate.setDate(now.getDate() - 7)
    } else if (staffFilter === '30days') {
      filterDate.setDate(now.getDate() - 30)
    }
    
    const filtered = rows.filter(row => {
      if (!row.paymentDate) return false
      const paymentDate = new Date(row.paymentDate)
      
      if (staffFilter === 'today') {
        return paymentDate.toDateString() === now.toDateString()
      } else {
        filterDate.setHours(0, 0, 0, 0)
        paymentDate.setHours(0, 0, 0, 0)
        return paymentDate >= filterDate
      }
    })
    
    console.log(`Filter: ${staffFilter}, Total rows: ${rows.length}, Filtered rows: ${filtered.length}`)
    return filtered
  }, [rows, staffFilter])

  const saveTargetRevenue = async () => {
    setSavingTarget(true)
    try {
      const res = await fetch('/api/settings/target-revenue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: { amount: targetRevenueAmount, targetPercentage, weights: { revenue: 100 } } })
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Failed')
      setDialogOpen(false)
    } catch (e) {
      console.error('Failed saving target revenue', e)
    } finally {
      setSavingTarget(false)
    }
  }

  if (loading) {
    return (
      <SidebarProvider>
        <Suspense fallback={<div>Loading...</div>}>
          <AppSidebar />
        </Suspense>
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center justify-between gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <h1 className="text-lg font-semibold">Matrix</h1>
            </div>
            {user?.role === 'admin' && (
              <div className="pr-4">
                <Button variant="default" onClick={() => setDialogOpen(true)}>Set Targets</Button>
              </div>
            )}
          </header>

          {/* Dialog: Set Targets */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Set Targets</DialogTitle>
                <DialogDescription>Configure target revenue and weightage for performance calculation.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-neutral-700">Target Revenue (amount)</label>
                  <Input
                    type="number"
                    min={0}
                    value={targetRevenueAmount ?? ''}
                    onChange={(e) => setTargetRevenueAmount(Number(e.target.value))}
                    placeholder="e.g. 15000"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-700">Revenue Weight %</label>
                  <Input type="number" min={0} max={100} value={weights.revenue}
                    onChange={(e) => setWeights({ ...weights, revenue: Number(e.target.value) })} />
                </div>
                <div className="text-xs text-neutral-500">Performance is calculated based on revenue achievement vs target.</div>
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={saveTargetRevenue} disabled={savingTarget}>{savingTarget ? 'Saving...' : 'Save'}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="rounded-2xl border-neutral-200 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[12px] font-medium text-neutral-500 uppercase tracking-wide">Loading...</div>
                        <div className="text-2xl font-bold text-neutral-900 mt-1">
                          <Skeleton className="h-8 w-16" />
                        </div>
                      </div>
                      <div className="p-2 bg-neutral-100 rounded-lg">
                        <Skeleton className="h-6 w-6" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <RoleGuard requiredRole="barber">
      <SidebarProvider>
        <Suspense fallback={<div>Loading...</div>}>
          <AppSidebar />
        </Suspense>
        <SidebarInset>
              <header className="flex h-16 shrink-0 items-center justify-between gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
                <div className="flex items-center gap-2 px-4">
                  <SidebarTrigger className="-ml-1" />
                  <Separator orientation="vertical" className="mr-2 h-4" />
                  <h1 className="text-lg font-semibold">Matrix</h1>
                </div>
                {user?.role === 'admin' && (
                  <div className="pr-4">
                    <Button variant="default" onClick={() => setDialogOpen(true)}>Set Targets</Button>
                  </div>
                )}
              </header>
              
              <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
            {/* Key Metrics */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card className="rounded-2xl border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[12px] font-medium text-neutral-500 uppercase tracking-wide">Total Revenue</div>
                      <div className="text-2xl font-bold text-neutral-900 mt-1">{formatCurrency(metrics.totalRevenue)}</div>
                    </div>
                    <div className="p-2 bg-[#601625]/10 rounded-lg">
                      <DollarSign className="h-6 w-6 text-[#601625]" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[12px] font-medium text-neutral-500 uppercase tracking-wide">Total Customers</div>
                      <div className="text-2xl font-bold text-neutral-900 mt-1">{metrics.uniqueCustomers}</div>
                    </div>
                    <div className="p-2 bg-[#601625]/10 rounded-lg">
                      <Users className="h-6 w-6 text-[#601625]" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[12px] font-medium text-neutral-500 uppercase tracking-wide">Total Transactions</div>
                      <div className="text-2xl font-bold text-neutral-900 mt-1">{metrics.totalTransactions}</div>
                    </div>
                    <div className="p-2 bg-[#601625]/10 rounded-lg">
                      <Calendar className="h-6 w-6 text-[#601625]" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[12px] font-medium text-neutral-500 uppercase tracking-wide">Total Services</div>
                      <div className="text-2xl font-bold text-neutral-900 mt-1">{metrics.serviceCount}</div>
                    </div>
                    <div className="p-2 bg-[#601625]/10 rounded-lg">
                      <Target className="h-6 w-6 text-[#601625]" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Professional Gauge & Line Chart Section */}
            <TooltipProvider>
              <div className="grid gap-8 md:grid-cols-2">
                {/* Professional Gauge Chart - 50% width */}
                <Card className="rounded-2xl border-neutral-200 shadow-sm hover:shadow-md transition-all duration-300">
                  <CardHeader className="pb-6">
                    <CardTitle className="flex items-center gap-3 text-xl font-semibold">
                      <div className="p-2 bg-[#601625]/10 rounded-lg">
                        <Gauge className="h-6 w-6 text-[#601625]" />
                      </div>
                      Business Performance
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-neutral-400 hover:text-[#601625] cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-[#601625] text-white border-[#601625]">
                          <p className="text-white">Overall business performance based on revenue, customer satisfaction, and operational efficiency</p>
                        </TooltipContent>
                      </Tooltip>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {/* Professional Doughnut Chart */}
                    <div className="relative w-full h-80 flex items-center justify-center">
                      <div className="relative w-80 h-80">
                        <svg className="w-full h-full" viewBox="0 0 200 200">
                          {/* Background Circle */}
                          <circle
                            cx="100"
                            cy="100"
                            r="80"
                            fill="none"
                            stroke="#e5e7eb"
                            strokeWidth="20"
                          />
                          
                          {/* Progress Arc */}
                          <circle
                            cx="100"
                            cy="100"
                            r="80"
                            fill="none"
                            stroke="url(#progressGradient)"
                            strokeWidth="20"
                            strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 80}`}
                            strokeDashoffset={`${2 * Math.PI * 80 * (1 - metrics.performancePercentage / 100)}`}
                            transform="rotate(-90 100 100)"
                            className="transition-all duration-1000 ease-out"
                          />
                          
                          {/* Target Indicator */}
                          <circle
                            cx="100"
                            cy="100"
                            r="80"
                            fill="none"
                            stroke="#fbbf24"
                            strokeWidth="3"
                            strokeDasharray="8 4"
                            strokeDashoffset={`${2 * Math.PI * 80 * (1 - metrics.targetPercentage / 100)}`}
                            transform="rotate(-90 100 100)"
                            opacity="0.7"
                          />
                          
                          {/* Gradient Definition */}
                          <defs>
                            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#ef4444" />
                              <stop offset="50%" stopColor="#f59e0b" />
                              <stop offset="100%" stopColor="#10b981" />
                            </linearGradient>
                          </defs>
                          
                          {/* Center Text */}
                          <text
                            x="100"
                            y="100"
                            fontSize="36"
                            fill="#601625"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className="font-bold"
                          >
                            {metrics.performancePercentage}%
                          </text>
                          
                          <text
                            x="100"
                            y="125"
                            fontSize="14"
                            fill="#6b7280"
                            textAnchor="middle"
                            className="font-medium"
                          >
                            Performance
                          </text>
                          
                          <text
                            x="100"
                            y="145"
                            fontSize="12"
                            fill="#9ca3af"
                            textAnchor="middle"
                          >
                            Target: {metrics.targetPercentage}%
                          </text>
                        </svg>
                      </div>
                    </div>
                    
                    {/* Revenue Information - Left Column */}
                    <div className="mt-8 grid grid-cols-2 gap-4">
                      <div className="flex justify-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex flex-col items-center p-4 bg-[#601625]/5 rounded-xl hover:bg-[#601625]/10 transition-colors cursor-pointer w-full">
                              <div className="w-6 h-6 rounded-full bg-[#601625] mb-3 flex items-center justify-center">
                                <DollarSign className="h-3 w-3 text-white" />
                              </div>
                              <div className="text-sm font-medium text-neutral-700 mb-1">Revenue Performance</div>
                              <div className="text-2xl font-bold text-[#601625] mb-1">{metrics.performancePercentage}%</div>
                              <div className="text-xs text-neutral-500 text-center">
                                <div>Actual: {formatCurrency(metrics.totalRevenue)}</div>
                                <div>Target: {formatCurrency(metrics.targetRevenue)}</div>
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="bg-[#601625] text-white border-[#601625]">
                            <p className="text-white">Revenue achievement: {metrics.totalRevenue.toLocaleString()} / {metrics.targetRevenue.toLocaleString()}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      
                      <div className="flex justify-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex flex-col items-center p-4 bg-green-50 rounded-xl hover:bg-green-100 transition-colors cursor-pointer w-full">
                              <div className="w-6 h-6 rounded-full bg-green-500 mb-3 flex items-center justify-center">
                                <Target className="h-3 w-3 text-white" />
                              </div>
                              <div className="text-sm font-medium text-neutral-700 mb-1">Target Achievement</div>
                              <div className="text-2xl font-bold text-green-600 mb-1">{metrics.performancePercentage}%</div>
                              <div className="text-xs text-neutral-500 text-center">
                                <div className="font-semibold">Target: {metrics.targetPercentage}%</div>
                                <div className="font-semibold">Achieved: {metrics.performancePercentage}%</div>
                                <div className="mt-1 text-green-600">
                                  {metrics.performancePercentage >= metrics.targetPercentage ? '✅ Goal Reached!' : '📈 In Progress'}
                                </div>
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="bg-[#601625] text-white border-[#601625]">
                            <p className="text-white">Target: {metrics.targetPercentage}% | Achieved: {metrics.performancePercentage}%</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Staff Performance Chart - 50% width */}
                <Card className="rounded-2xl border-neutral-200 shadow-sm hover:shadow-md transition-all duration-300">
                  <CardHeader className="pb-6">
                    <div className="space-y-4">
                      {/* Title Row */}
                      <div className="flex items-center gap-4">
                        <CardTitle className="flex items-center gap-4 text-xl font-semibold">
                          <div className="p-2 bg-[#601625]/10 rounded-lg">
                            <Users className="h-6 w-6 text-[#601625]" />
                          </div>
                          Staff Performance
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-neutral-400 hover:text-[#601625] cursor-help ml-2" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-[#601625] text-white border-[#601625]">
                              <p className="text-white">Individual staff performance based on revenue and services</p>
                            </TooltipContent>
                          </Tooltip>
                        </CardTitle>
                      </div>
                      
                      {/* Filters Row */}
                      <div className="flex items-center justify-between">
                        <div className="flex gap-3">
                          <Button
                            variant={staffFilter === 'today' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setStaffFilter('today')}
                            className="text-xs px-4 py-2"
                          >
                            Today
                          </Button>
                          <Button
                            variant={staffFilter === '7days' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setStaffFilter('7days')}
                            className="text-xs px-4 py-2"
                          >
                            7 Days
                          </Button>
                          <Button
                            variant={staffFilter === '30days' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setStaffFilter('30days')}
                            className="text-xs px-4 py-2"
                          >
                            30 Days
                          </Button>
                          <Button
                            variant={staffFilter === 'all' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setStaffFilter('all')}
                            className="text-xs px-4 py-2"
                          >
                            All Time
                          </Button>
                        </div>
                        <div className="text-sm text-neutral-500 font-medium">
                          {filteredRows.length} transactions
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {/* Staff Performance Bars */}
                    <div className="h-80 flex items-center justify-center">
                      <div className="w-full h-64 relative">
                        <svg className="w-full h-full" viewBox="0 0 400 200">
                          {/* Grid Lines */}
                          <defs>
                            <pattern id="staffGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e7eb" strokeWidth="1"/>
                            </pattern>
                          </defs>
                          <rect width="100%" height="100%" fill="url(#staffGrid)" />
                          
                          {/* Y-axis labels */}
                          <text x="10" y="30" fontSize="12" fill="#6b7280">$10K</text>
                          <text x="10" y="60" fontSize="12" fill="#6b7280">$8K</text>
                          <text x="10" y="90" fontSize="12" fill="#6b7280">$6K</text>
                          <text x="10" y="120" fontSize="12" fill="#6b7280">$4K</text>
                          <text x="10" y="150" fontSize="12" fill="#6b7280">$2K</text>
                          <text x="10" y="180" fontSize="12" fill="#6b7280">$0</text>
                          
                          {/* Staff Performance Bars */}
                          {(() => {
                            // Calculate staff performance from filtered data
                            const staffMap = new Map()
                            
                            filteredRows.forEach(row => {
                              if (row.staff) {
                                const staffNames = row.staff.split(',').map(name => name.trim()).filter(name => name)
                                
                                staffNames.forEach(staffName => {
                                  if (!staffMap.has(staffName)) {
                                    staffMap.set(staffName, {
                                      staffId: staffName,
                                      staffName: staffName,
                                      totalRevenue: 0,
                                      totalServices: 0,
                                      totalTransactions: 0,
                                      totalDays: new Set()
                                    })
                                  }
                                  
                                  const staff = staffMap.get(staffName)
                                  staff.totalRevenue += (row.totalPaid || 0) / staffNames.length
                                  staff.totalServices += 1 / staffNames.length
                                  staff.totalTransactions += 1 / staffNames.length
                                  
                                  if (row.paymentDate) {
                                    const date = new Date(row.paymentDate).toDateString()
                                    staff.totalDays.add(date)
                                  }
                                })
                              }
                            })
                            
                            const performance = Array.from(staffMap.values()).map(staff => {
                              const uniqueDays = staff.totalDays.size
                              const avgTransactionsPerDay = uniqueDays > 0 ? staff.totalTransactions / uniqueDays : 0
                              const avgRevenuePerDay = uniqueDays > 0 ? staff.totalRevenue / uniqueDays : 0

                              return {
                                ...staff,
                                uniqueDays,
                                avgTransactionsPerDay: Math.round(avgTransactionsPerDay * 10) / 10,
                                avgRevenuePerDay: Math.round(avgRevenuePerDay * 100) / 100
                              }
                            }).sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 5)
                            
                            const maxRevenue = Math.max(...performance.map(s => s.totalRevenue), 1)
                            
                            if (performance.length === 0) {
                              return (
                                <text
                                  x="200"
                                  y="100"
                                  fontSize="16"
                                  fill="#6b7280"
                                  textAnchor="middle"
                                >
                                  No staff data available
                                </text>
                              )
                            }
                            
                            return performance.map((staff, index) => {
                              const barHeight = (staff.totalRevenue / maxRevenue) * 120
                              const x = 50 + (index * 70) // Increased spacing between bars
                              const y = 180 - barHeight
                              const barWidth = 55 // Increased width
                              
                              return (
                                <g key={staff.staffName}>
                                  {/* Background Bar */}
                                  <rect
                                    x={x}
                                    y={180 - 120}
                                    width={barWidth}
                                    height={120}
                                    fill="#f3f4f6"
                                    rx="4"
                                    opacity="0.3"
                                  />
                                  
                                  {/* Main Bar */}
                                  <rect
                                    x={x}
                                    y={y}
                                    width={barWidth}
                                    height={barHeight}
                                    fill="url(#staffGradient)"
                                    rx="4"
                                    className="hover:opacity-80 transition-opacity cursor-pointer"
                                    stroke="#601625"
                                    strokeWidth="1"
                                  />
                                  
                                  {/* Staff Name */}
                                  <text
                                    x={x + barWidth/2}
                                    y="195"
                                    fontSize="11"
                                    fill="#6b7280"
                                    textAnchor="middle"
                                    fontWeight="500"
                                  >
                                    {staff.staffName.split(' ')[0]}
                                  </text>
                                  
                                  {/* Revenue Amount */}
                                  <text
                                    x={x + barWidth/2}
                                    y={y - 8}
                                    fontSize="11"
                                    fill="#601625"
                                    textAnchor="middle"
                                    fontWeight="bold"
                                  >
                                    ${Math.round(staff.totalRevenue).toLocaleString()}
                                  </text>
                                  
                                  {/* Daily Average */}
                                  <text
                                    x={x + barWidth/2}
                                    y={y - 20}
                                    fontSize="9"
                                    fill="#8B2635"
                                    textAnchor="middle"
                                    fontWeight="500"
                                  >
                                    {staff.avgTransactionsPerDay}/day
                                  </text>
                                  
                                  {/* Tooltip */}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <rect
                                        x={x}
                                        y={y}
                                        width={barWidth}
                                        height={barHeight}
                                        fill="transparent"
                                        className="cursor-pointer"
                                      />
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-[#601625] text-white border-[#601625]">
                                      <div className="text-white text-sm">
                                        <div className="font-bold">{staff.staffName}</div>
                                        <div>Revenue: ${staff.totalRevenue.toLocaleString()}</div>
                                        <div>Services: {Math.round(staff.totalServices)}</div>
                                        <div>Avg/Day: {staff.avgTransactionsPerDay} transactions</div>
                                        <div>Days Active: {staff.uniqueDays}</div>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </g>
                              )
                            })
                          })()}
                          
                          {/* Gradient Definition */}
                          <defs>
                            <linearGradient id="staffGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" stopColor="#601625" />
                              <stop offset="100%" stopColor="#8B2635" />
                            </linearGradient>
                          </defs>
                        </svg>
                      </div>
                    </div>
                    
                        {/* Staff Statistics */}
                        <div className="mt-10 grid grid-cols-2 gap-6">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="text-center p-6 bg-[#601625]/5 rounded-xl hover:bg-[#601625]/10 transition-colors cursor-pointer">
                                <div className="text-4xl font-bold text-[#601625] mb-2">
                                  {(() => {
                                    const staffSet = new Set()
                                    filteredRows.forEach(row => {
                                      if (row.staff) {
                                        const staffNames = row.staff.split(',').map(name => name.trim()).filter(name => name)
                                        staffNames.forEach(name => staffSet.add(name))
                                      }
                                    })
                                    return staffSet.size
                                  })()}
                                </div>
                                <div className="text-sm font-semibold text-neutral-600">Active Staff</div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="bg-[#601625] text-white border-[#601625]">
                              <p className="text-white">Staff members with transactions in selected period</p>
                            </TooltipContent>
                          </Tooltip>
                          
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="text-center p-6 bg-green-50 rounded-xl hover:bg-green-100 transition-colors cursor-pointer">
                                <div className="text-4xl font-bold text-green-600 mb-2">
                                  {(() => {
                                    const totalRevenue = filteredRows.reduce((sum, row) => sum + (row.totalPaid || 0), 0)
                                    const totalTransactions = filteredRows.length
                                    const avgTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0
                                    return formatCurrency(avgTransaction)
                                  })()}
                                </div>
                                <div className="text-sm font-semibold text-neutral-600">Avg Transaction</div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="bg-[#601625] text-white border-[#601625]">
                              <p className="text-white">Average transaction value in selected period</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                  </CardContent>
                </Card>
              </div>
            </TooltipProvider>
          </div>
        </SidebarInset>
      </SidebarProvider>
      
      {/* Dialog: Set Targets */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Targets</DialogTitle>
            <DialogDescription>Configure target revenue and weightage for performance calculation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-neutral-700">Target Revenue (amount)</label>
              <Input
                type="number"
                min={0}
                value={targetRevenueAmount ?? ''}
                onChange={(e) => setTargetRevenueAmount(Number(e.target.value))}
                placeholder="e.g. 15000"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-700">Revenue Weight %</label>
              <Input type="number" min={0} max={100} value={weights.revenue}
                onChange={(e) => setWeights({ ...weights, revenue: Number(e.target.value) })} />
            </div>
            <div className="text-xs text-neutral-500">Performance is calculated based on revenue achievement vs target.</div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={saveTargetRevenue} disabled={savingTarget}>{savingTarget ? 'Saving...' : 'Save'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </RoleGuard>
  )
}