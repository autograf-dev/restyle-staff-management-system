"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { RoleGuard } from "@/components/role-guard"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  Users, 
  RefreshCw, 
  DollarSign,
  TrendingUp,
  Calendar,
  CreditCard,
  Percent
} from "lucide-react"
import React, { useState, useEffect, useMemo } from "react"
import { toast } from "sonner"

// Transaction type
interface TxRow {
  id: string
  paymentDate: string | null
  method: string | null
  subtotal: number | null
  tax: number | null
  tip: number | null
  totalPaid: number | null
  services: string | null
  staff: string | null
  customerPhone: string | null
  customerLookup: string | null
  walkInCustomerId: string | null
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

// Staff type
type StaffMember = {
  id: string
  name: string
  ghl_id: string
}

export default function TodayDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<TxRow[]>([])
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null)
  const [kpiData, setKpiData] = useState({
    totalRevenue: 0,
    totalTips: 0,
    transactionsCount: 0,
    activeStaff: 0,
    totalTax: 0
  })
  const [paymentMethodData, setPaymentMethodData] = useState<Array<{
    method: string
    totalRevenue: number
    transactionCount: number
  }>>([])

  const formatCurrency = (n?: number | null) =>
    new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(Number(n || 0))

  const formatDate = (s?: string | null) => {
    if (!s) return "—"
    try {
      const date = new Date(s)
      return date.toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" })
    } catch {
      return "—"
    }
  }

  const getCustomerName = (transaction: TxRow) => {
    if (transaction.walkInCustomerId && transaction.walkInCustomerId.trim() !== "") {
      return transaction.walkInCustomerId.trim()
    }
    if (transaction.customerLookup && transaction.customerLookup.trim() !== "") {
      return transaction.customerLookup.trim()
    }
    if (transaction.customerPhone) return `Guest (${transaction.customerPhone})`
    return "Walk-in Guest"
  }

  const getServiceName = (transaction: TxRow) => {
    if (transaction.services && transaction.services.trim() !== "") return transaction.services.trim()
    if (transaction.items?.length) {
      const names = transaction.items.map(i => i.serviceName).filter(Boolean).join(", ")
      if (names) return names
    }
    return "Service Not Specified"
  }

  const getCustomerPhone = (transaction: TxRow) =>
    transaction.customerPhone && transaction.customerPhone.trim() !== "" ? transaction.customerPhone.trim() : "No Phone Provided"

  // Filter transactions for today
  const todayTransactions = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    return transactions.filter(tx => {
      if (!tx.paymentDate) return false
      const txDate = new Date(tx.paymentDate)
      return txDate >= today && txDate < tomorrow
    })
  }, [transactions])

  // Calculate staff metrics for today
  const staffMetrics = useMemo(() => {
    const metrics = new Map<string, {
      name: string
      ghl_id: string
      revenue: number
      tips: number
      transactions: number
      services: number
      products: number
    }>()

    // Initialize all staff
    staffList.forEach(staff => {
      metrics.set(staff.name.toLowerCase(), {
        name: staff.name,
        ghl_id: staff.ghl_id,
        revenue: 0,
        tips: 0,
        transactions: 0,
        services: 0,
        products: 0
      })
    })

    // Calculate metrics from today's transactions
    todayTransactions.forEach(tx => {
      if (tx.items) {
        tx.items.forEach(item => {
          const staffKey = item.staffName.toLowerCase()
          const metric = metrics.get(staffKey)
          if (metric) {
            const isProduct = String(item.serviceId || '').toLowerCase().startsWith('product-')
            metric.revenue += Number(item.price || 0)
            metric.tips += Number(item.staffTipCollected || 0)
            
            if (isProduct) {
              metric.products += Number(item.price || 0)
            } else {
              metric.services += Number(item.price || 0)
            }
            
            // Count unique transactions
            metric.transactions += 1
          }
        })
      }
    })

    return metrics
  }, [todayTransactions, staffList])

  // Get filtered transactions for selected staff
  const selectedStaffTransactions = useMemo(() => {
    if (!selectedStaff) return []
    
    return todayTransactions.filter(tx => {
      if (tx.items) {
        return tx.items.some(item => 
          item.staffName.toLowerCase() === selectedStaff.toLowerCase()
        )
      }
      return false
    })
  }, [todayTransactions, selectedStaff])

  const selectedStaffMetrics = selectedStaff ? staffMetrics.get(selectedStaff.toLowerCase()) : null

  // Load all data
  const loadData = async () => {
    setLoading(true)
    try {
      // Use exact same date range logic as payments page
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const end = new Date(new Date(start).getTime() + 24 * 60 * 60 * 1000).toISOString()
      const rangeQuery = `&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
      
      const [txRes, staffRes, kpiRevenueRes, kpiTipsRes, kpiCountRes, kpiStaffRes, kpiTaxRes, paymentMethodRes] = await Promise.all([
        fetch('/api/transactions?limit=10000'),
        fetch('/api/barber-hours'),
        fetch(`/api/kpi/total-revenue?filter=today${rangeQuery}`),
        fetch(`/api/kpi/total-tips?filter=today${rangeQuery}`),
        fetch(`/api/kpi/transactions-count?filter=today${rangeQuery}`),
        fetch(`/api/kpi/active-staff?filter=today${rangeQuery}`),
        fetch(`/api/kpi/total-tax?filter=today${rangeQuery}`),
        fetch(`/api/kpi/revenue-by-payment-method?filter=today${rangeQuery}`)
      ])

      const [txData, staffData, revenueData, tipsData, countData, staffCountData, taxData, paymentData] = await Promise.all([
        txRes.json(),
        staffRes.json(),
        kpiRevenueRes.json(),
        kpiTipsRes.json(),
        kpiCountRes.json(),
        kpiStaffRes.json(),
        kpiTaxRes.json(),
        paymentMethodRes.json()
      ])

      if (txData.ok) setTransactions(txData.data || [])
      
      if (staffData.ok) {
        const staff = (staffData.data || []).map((s: { [key: string]: string | number | null | undefined }) => ({
          id: s["🔒 Row ID"] || s["ð Row ID"] || "",
          name: s["Barber/Name"],
          ghl_id: s["ghl_id"]
        }))
        setStaffList(staff)
        if (staff.length > 0 && !selectedStaff) {
          setSelectedStaff(staff[0].name)
        }
      }

      if (revenueData.ok && tipsData.ok && countData.ok && staffCountData.ok && taxData.ok) {
        setKpiData({
          totalRevenue: revenueData.data.totalRevenue,
          totalTips: tipsData.data.totalTips,
          transactionsCount: countData.data.transactionsCount,
          activeStaff: staffCountData.data.activeStaff,
          totalTax: taxData.data.totalTax
        })
      }

      if (paymentData.ok) {
        setPaymentMethodData(paymentData.data.paymentMethods || [])
      }

    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  if (loading) {
    return (
      <RoleGuard requiredRole="manager">
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="flex h-16 shrink-0 items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <h1 className="text-xl font-semibold">Today&apos;s Overview</h1>
            </header>
            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="h-8 w-8 animate-spin" />
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </RoleGuard>
    )
  }

  return (
    <RoleGuard requiredRole="manager">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex flex-col gap-2 px-4 py-4">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4" />
                <h1 className="text-xl font-semibold">Today&apos;s Overview</h1>
              </div>
              <Button 
                onClick={loadData} 
                variant="outline" 
                size="sm"
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
            <p className="text-sm text-muted-foreground ml-12">View today&apos;s performance metrics and staff activity</p>
          </header>
          
          <div className="flex flex-1 flex-col gap-6 p-4 pt-0">

            {/* KPI Cards from Payments Tab */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold">{formatCurrency(kpiData.totalRevenue)}</div>
                      <p className="text-xs text-muted-foreground">Today&apos;s total revenue</p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Tips</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold">{formatCurrency(kpiData.totalTips)}</div>
                      <p className="text-xs text-muted-foreground">Tips collected today</p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Transactions</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold">{kpiData.transactionsCount}</div>
                      <p className="text-xs text-muted-foreground">Completed today</p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Staff</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-8 w-12" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold">{kpiData.activeStaff}</div>
                      <p className="text-xs text-muted-foreground">Staff working today</p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Tax</CardTitle>
                  <Percent className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold">{formatCurrency(kpiData.totalTax)}</div>
                      <p className="text-xs text-muted-foreground">Tax collected today</p>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Payment Methods Section */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Revenue by Payment Method</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {paymentMethodData.map((method, index) => (
                  <div key={method.method} className="rounded-lg border border-neutral-200 p-3 hover:shadow-sm transition-shadow bg-white">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-neutral-600 capitalize truncate">{method.method}</span>
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          index === 0 ? "bg-green-500" : 
                          index === 1 ? "bg-blue-500" : 
                          index === 2 ? "bg-purple-500" : 
                          index === 3 ? "bg-orange-500" : 
                          "bg-gray-500"
                        }`}
                      />
                    </div>
                    <div className="text-lg font-bold text-neutral-900">{formatCurrency(method.totalRevenue)}</div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">
                      {method.transactionCount} transaction{method.transactionCount !== 1 ? "s" : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Staff Selection Grid */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Select Staff Member</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-3">
                {Array.from(staffMetrics.values()).filter(staff => staff.transactions > 0).map((staff) => {
                  const isSelected = staff.name === selectedStaff
                  return (
                    <button
                      key={staff.ghl_id}
                      onClick={() => setSelectedStaff(staff.name)}
                      className={`
                        w-full flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:shadow-md
                        ${isSelected 
                          ? 'border-primary bg-primary text-primary-foreground shadow-lg' 
                          : 'border-border bg-card hover:border-primary/50'
                        }
                      `}
                    >
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className={`text-sm font-semibold ${
                          isSelected ? 'bg-primary-foreground text-primary' : 'bg-primary/10 text-primary'
                        }`}>
                          {staff.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-center space-y-1 w-full">
                        <div className="font-medium text-sm leading-tight">
                          {staff.name}
                        </div>
                        <div className="text-xs">
                          {formatCurrency(staff.revenue)}
                        </div>
                        <Badge 
                          variant={isSelected ? "secondary" : "outline"} 
                          className={`text-xs ${
                            isSelected 
                              ? 'bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30' 
                              : ''
                          }`}
                        >
                          {staff.transactions} txn
                        </Badge>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Selected Staff Details */}
            {selectedStaffMetrics && (
              <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20 border-4 border-primary/20">
                      <AvatarFallback className="text-xl bg-primary/10 text-primary font-bold">
                        {selectedStaffMetrics.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <CardTitle className="text-2xl text-primary">{selectedStaffMetrics.name}</CardTitle>
                      <div className="flex gap-3 mt-3 flex-wrap">
                        <Badge variant="default" className="bg-primary/20 text-primary border-primary/30">
                          <DollarSign className="h-3 w-3 mr-1" />
                          Revenue: {formatCurrency(selectedStaffMetrics.revenue)}
                        </Badge>
                        <Badge variant="outline" className="bg-white/50">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          Tips: {formatCurrency(selectedStaffMetrics.tips)}
                        </Badge>
                        <Badge variant="outline" className="bg-white/50">
                          <Calendar className="h-3 w-3 mr-1" />
                          {selectedStaffMetrics.transactions} Transactions
                        </Badge>
                        <Badge variant="outline" className="bg-white/50">
                          Services: {formatCurrency(selectedStaffMetrics.services)}
                        </Badge>
                        <Badge variant="outline" className="bg-white/50">
                          Products: {formatCurrency(selectedStaffMetrics.products)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            )}

            {/* Transactions Table for Selected Staff */}
            {selectedStaff && selectedStaffTransactions.length > 0 && (
              <Card className="border-neutral-200 shadow-none">
                <CardHeader className="py-3 px-4 border-b border-gray-100">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-900">
                    <div className="w-2 h-2 bg-[#601625] rounded-full" />
                    Today&apos;s Transactions - {selectedStaff}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="overflow-hidden rounded-xl border border-gray-200 shadow-lg bg-white">
                    {/* Header */}
                    <div className="hidden lg:grid grid-cols-12 bg-white border-b-2 border-gray-100 px-6 py-4">
                      <div className="col-span-3">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-[#601625] rounded-full" />
                          <span className="text-sm font-semibold text-gray-700 tracking-wide">SERVICE</span>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <span className="text-sm font-semibold text-gray-700 tracking-wide">CUSTOMER</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-sm font-semibold text-gray-700 tracking-wide">PHONE</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-sm font-semibold text-gray-700 tracking-wide">TIPS</span>
                      </div>
                      <div className="col-span-3">
                        <span className="text-sm font-semibold text-gray-700 tracking-wide">PAYMENT</span>
                      </div>
                    </div>

                    <div className="divide-y divide-gray-100">
                      {selectedStaffTransactions.map((r, index) => (
                        <div
                          key={r.id}
                          className={`hidden lg:grid grid-cols-12 items-center px-6 py-6 hover:bg-gray-50/50 transition-all duration-200 ${
                            index % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                          }`}
                        >
                          {/* Service */}
                          <div className="col-span-3 min-w-0">
                            <div className="flex items-center gap-4">
                              <div className="w-2 h-2 bg-[#601625] rounded-full flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="text-base font-semibold text-gray-900 truncate leading-tight">
                                  {getServiceName(r)}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {r.paymentDate ? new Date(r.paymentDate).toLocaleTimeString('en-CA', { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  }) : '—'}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Customer */}
                          <div className="col-span-2 min-w-0">
                            <div className="min-w-0 flex-1">
                              <div className="text-base font-semibold text-gray-900 truncate">
                                {getCustomerName(r)}
                              </div>
                            </div>
                          </div>

                          {/* Phone */}
                          <div className="col-span-2">
                            <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-600/20">
                              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-1.5" />
                              {getCustomerPhone(r)}
                            </span>
                          </div>

                          {/* Tips */}
                          <div className="col-span-2">
                            <div className="text-lg font-bold text-[#751a29]">{formatCurrency(r.tip)}</div>
                          </div>

                          {/* Payment */}
                          <div className="col-span-3">
                            <div className="flex flex-col gap-1">
                              <div className="text-xl font-bold text-gray-900">{formatCurrency(r.totalPaid)}</div>
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5" />
                                  {r.method || "Unknown"}
                                </span>
                                <span className="text-xs text-gray-500 font-mono">{formatDate(r.paymentDate)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Mobile cards */}
                      {selectedStaffTransactions.map((r) => (
                        <div key={`mobile-${r.id}`} className="lg:hidden p-4 border-b border-gray-100 last:border-b-0">
                          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4 shadow-sm">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-2 h-2 bg-[#601625] rounded-full" />
                                <div>
                                  <div className="text-base font-semibold text-gray-900">{getServiceName(r)}</div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {r.paymentDate ? new Date(r.paymentDate).toLocaleTimeString('en-CA', { 
                                      hour: '2-digit', 
                                      minute: '2-digit' 
                                    }) : '—'}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xl font-bold text-gray-900">{formatCurrency(r.totalPaid)}</div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5" />
                                    {r.method || "Unknown"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Customer</div>
                                <div className="text-sm font-medium text-gray-900">{getCustomerName(r)}</div>
                                <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-600/20 mt-1">
                                  {getCustomerPhone(r)}
                                </span>
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Tips</div>
                                <div className="text-lg font-bold text-[#751a29]">{formatCurrency(r.tip)}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedStaff && selectedStaffTransactions.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Transactions Today</h3>
                  <p className="text-muted-foreground text-center">
                    {selectedStaff} has no transactions recorded for today yet.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </RoleGuard>
  )
}
