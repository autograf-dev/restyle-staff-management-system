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
      const [txRes, staffRes, kpiRevenueRes, kpiTipsRes, kpiCountRes, kpiStaffRes, kpiTaxRes, paymentMethodRes] = await Promise.all([
        fetch('/api/transactions?limit=10000'),
        fetch('/api/barber-hours'),
        fetch('/api/kpi/total-revenue?filter=today'),
        fetch('/api/kpi/total-tips?filter=today'),
        fetch('/api/kpi/transactions-count?filter=today'),
        fetch('/api/kpi/active-staff?filter=today'),
        fetch('/api/kpi/total-tax?filter=today'),
        fetch('/api/kpi/revenue-by-payment-method?filter=today')
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
              <h1 className="text-xl font-semibold">Today&apos;s Dashboard</h1>
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
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <h1 className="text-xl font-semibold">Today&apos;s Dashboard</h1>
            </div>
            <p className="text-sm text-muted-foreground ml-12">View today&apos;s performance metrics and staff activity</p>
          </header>
          
          <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
            <div className="flex items-center justify-end">
              <Button 
                onClick={loadData} 
                variant="outline" 
                size="sm"
                disabled={loading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>

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
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                {paymentMethodData.map((method, index) => (
                  <Card key={method.method}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-2 h-2 rounded-full ${
                          index === 0 ? 'bg-green-500' :
                          index === 1 ? 'bg-blue-500' :
                          index === 2 ? 'bg-purple-500' :
                          'bg-orange-500'
                        }`}></div>
                        <span className="text-xs font-medium text-gray-600 capitalize">{method.method}</span>
                      </div>
                      <div className="text-lg font-bold text-gray-900 mb-1">
                        {formatCurrency(method.totalRevenue)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {method.transactionCount} transaction{method.transactionCount !== 1 ? 's' : ''}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Staff Selection Grid */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Select Staff Member</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-3">
                {Array.from(staffMetrics.values()).map((staff) => {
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
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Today&apos;s Transactions - {selectedStaff}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Services</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Tips</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedStaffTransactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="font-medium">
                            {tx.paymentDate ? new Date(tx.paymentDate).toLocaleTimeString('en-CA', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            }) : '—'}
                          </TableCell>
                          <TableCell>
                            {tx.walkInCustomerId || tx.customerLookup || `Guest (${tx.customerPhone})`}
                          </TableCell>
                          <TableCell>
                            {tx.items?.map(i => i.serviceName).filter(Boolean).join(', ') || tx.services || '—'}
                          </TableCell>
                          <TableCell className="capitalize">{tx.method || '—'}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(tx.totalPaid)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(tx.tip)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
