"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { RoleGuard } from "@/components/role-guard"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Trash2, Search, Eye, DollarSign, TrendingUp, Users, Calendar, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react"
import { CreditCard } from "lucide-react"
import Link from "next/link"

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
  // Keep payment status for new functionality
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

export default function PaymentsPage() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<TxRow[]>([])
  const [query, setQuery] = useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<TxRow | null>(null)
  const [customerNames, setCustomerNames] = useState<Record<string, string>>({})
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [kpiData, setKpiData] = useState({
    totalRevenue: 0,
    totalTips: 0,
    transactionsCount: 0,
    activeStaff: 0,
    totalTax: 0
  })
  const [loadingKpis, setLoadingKpis] = useState(false)
  const [paymentMethodData, setPaymentMethodData] = useState<Array<{
    method: string
    totalRevenue: number
    transactionCount: number
  }>>([])
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false)
  const itemsPerPage = 50

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      (r.services || "").toLowerCase().includes(q) ||
      (r.staff || "").toLowerCase().includes(q) ||
      (r.customerPhone || "").toLowerCase().includes(q) ||
      (r.customerLookup || "").toLowerCase().includes(q) ||
      (r.id || "").toLowerCase().includes(q)
    )
  }, [rows, query])

  const formatCurrency = (n?: number | null) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Number(n || 0))
  const formatDate = (s?: string | null) => {
    if (!s) return "—"
    try {
      const date = new Date(s)
      return date.toLocaleDateString('en-CA', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      })
    } catch {
      return "—"
    }
  }
  
  // Function to fetch customer name from Netlify API
  const fetchCustomerFromAPI = async (customerId: string): Promise<string | null> => {
    try {
      const res = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/getContact?id=${encodeURIComponent(customerId)}`)
      if (!res.ok) return null
      
          const json = await res.json()
          if (json?.contact) {
            const contact = json.contact
        return contact.contactName || 
              contact.name || 
              `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 
               null
          }
      return null
        } catch (error) {
      console.error(`Error fetching contact ${customerId}:`, error)
      return null
    }
  }

  // Function to fetch customer names for transactions that need API lookup
  const fetchCustomerNames = async (transactions: TxRow[]) => {
    const customerIds = transactions
      .map(tx => tx.customerLookup)
      .filter(id => id && id.trim() !== '' && !customerNames[id])
    
    if (customerIds.length === 0) return

    setLoadingCustomers(true)
    const nameMap: Record<string, string> = {}
    
    // Fetch each customer individually
    await Promise.allSettled(
      customerIds.map(async (customerId) => {
        if (customerId) {
          const name = await fetchCustomerFromAPI(customerId)
          if (name) {
            nameMap[customerId] = name
          }
        }
      })
    )
    
    if (Object.keys(nameMap).length > 0) {
      setCustomerNames(prev => ({ ...prev, ...nameMap }))
    }
    setLoadingCustomers(false)
  }

  // Helper function to get customer display name with API fallback
  const getCustomerName = (transaction: TxRow) => {
    // First try to get from customerLookup field (this contains the actual customer name)
    if (transaction.customerLookup && transaction.customerLookup.trim() !== '') {
      const lookupId = transaction.customerLookup.trim()
      
      // Check if we have the name from API
      if (customerNames[lookupId]) {
        return customerNames[lookupId]
      }
      
      // If it looks like a customer ID (not a name), try to fetch from API
      if (lookupId.length > 10 && !lookupId.includes(' ')) {
        // This looks like a customer ID, fetch from API
        fetchCustomerFromAPI(lookupId).then(name => {
          if (name) {
            setCustomerNames(prev => ({ ...prev, [lookupId]: name }))
          }
        })
        return 'Loading...'
      }
      
      // If it contains spaces, it's probably already a name
      return lookupId
    }
    
    // Fallback to phone number if no name available
    if (transaction.customerPhone) {
      return `Guest (${transaction.customerPhone})`
    }
    
    return 'Walk-in Guest'
  }

  // Helper function to get service name with fallback
  const getServiceName = (transaction: TxRow) => {
    // First try to get from services field
    if (transaction.services && transaction.services.trim() !== '') {
      return transaction.services.trim()
    }
    
    // Fallback to service names from items
    if (transaction.items && transaction.items.length > 0) {
      const serviceNames = transaction.items
        .map(item => item.serviceName)
        .filter(Boolean)
        .join(', ')
      if (serviceNames) {
        return serviceNames
      }
    }
    
    return 'Service Not Specified'
  }

  // Helper function to get staff name with fallback
  const getStaffName = (transaction: TxRow) => {
    // First try to get from items (most accurate)
    if (transaction.items && transaction.items.length > 0) {
      const staffNames = transaction.items
        .map(item => item.staffName)
        .filter(Boolean)
        .join(', ')
      if (staffNames) {
        return staffNames
      }
    }
    
    // Fallback to payment staff field
    if (transaction.staff && transaction.staff.trim() !== '') {
      return transaction.staff.trim()
    }
    
    return 'Staff Not Assigned'
  }

  // Helper function to get customer phone with fallback
  const getCustomerPhone = (transaction: TxRow) => {
    if (transaction.customerPhone && transaction.customerPhone.trim() !== '') {
      return transaction.customerPhone.trim()
    }
    
    return 'No Phone Provided'
  }

  const kpis = useMemo(() => {
    const count = filtered.length
    const revenue = filtered.reduce((sum, r) => sum + Number(r.totalPaid || 0), 0)
    const tips = filtered.reduce((sum, r) => sum + Number(r.tip || 0), 0)
    const avg = count > 0 ? revenue / count : 0
    
    // Calculate unique staff count - handle comma-separated staff names
    const uniqueStaff = new Set(
      filtered
        .map(r => r.staff)
        .filter(Boolean)
        .flatMap(staff => staff!.split(',').map(name => name.trim()))
        .filter(name => name.length > 0)
    ).size
    
    // Calculate total tip splits (sum of all staff tip splits)
    const totalTipSplits = filtered.reduce((sum, r) => {
      if (r.items) {
        return sum + r.items.reduce((itemSum, item) => itemSum + Number(item.staffTipSplit || 0), 0)
      }
      return sum
    }, 0)
    
    return { count, revenue, tips, avg, uniqueStaff, totalTipSplits }
  }, [filtered])

  const loadKpiData = async () => {
    setLoadingKpis(true)
    
    try {
      const [revenueRes, tipsRes, countRes, staffRes, taxRes] = await Promise.all([
        fetch(`/api/kpi/total-revenue?filter=today`),
        fetch(`/api/kpi/total-tips?filter=today`),
        fetch(`/api/kpi/transactions-count?filter=today`),
        fetch(`/api/kpi/active-staff?filter=today`),
        fetch(`/api/kpi/total-tax?filter=today`)
      ])

      const [revenueData, tipsData, countData, staffData, taxData] = await Promise.all([
        revenueRes.json(),
        tipsRes.json(),
        countRes.json(),
        staffRes.json(),
        taxRes.json()
      ])

      console.log('KPI API Responses:', { revenueData, tipsData, countData, staffData, taxData })
      
      if (revenueData.ok && tipsData.ok && countData.ok && staffData.ok && taxData.ok) {
        setKpiData({
          totalRevenue: revenueData.data.totalRevenue,
          totalTips: tipsData.data.totalTips,
          transactionsCount: countData.data.transactionsCount,
          activeStaff: staffData.data.activeStaff,
          totalTax: taxData.data.totalTax
        })
      } else {
        console.error('Error loading KPI data:', { revenueData, tipsData, countData, staffData, taxData })
      }
    } catch (e: unknown) {
      console.error('Error loading KPI data:', e)
    } finally {
      setLoadingKpis(false)
    }
  }

  const loadPaymentMethodData = async () => {
    setLoadingPaymentMethods(true)
    
    try {
      const response = await fetch(`/api/kpi/revenue-by-payment-method?filter=today`)
      const data = await response.json()
      
      if (data.ok) {
        setPaymentMethodData(data.data.paymentMethods)
        console.log('Payment method data loaded:', data.data.paymentMethods)
      } else {
        console.error('Error loading payment method data:', data)
      }
    } catch (e: unknown) {
      console.error('Error loading payment method data:', e)
    } finally {
      setLoadingPaymentMethods(false)
    }
  }

  const loadTransactions = async (page: number = 1) => {
      setLoading(true)
    
      try {
      const offset = (page - 1) * itemsPerPage
      const res = await fetch(`/api/transactions?limit=${itemsPerPage}&offset=${offset}`)
        const json = await res.json()
        if (!res.ok || !json.ok) throw new Error(json.error || 'Failed to load')
        
        const transactions = json.data || []
      const total = json.total || transactions.length
      
        setRows(transactions)
      setTotalCount(total)
      setTotalPages(Math.ceil(total / itemsPerPage))
      setCurrentPage(page)
      
      // Fetch customer names for transactions that need API lookup
      await fetchCustomerNames(transactions)
      
      } catch (e: unknown) {
        console.error('Error loading payments:', e)
        const errorMessage = e instanceof Error ? e.message : 'Unknown error'
        toast.error('Failed to load payments: ' + errorMessage)
      } finally {
        setLoading(false)
      }
    }

  useEffect(() => {
    loadTransactions(1)
    loadKpiData()
    loadPaymentMethodData()
  }, [])

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      loadTransactions(page)
    }
  }

  const resetAndReload = () => {
    setCurrentPage(1)
    setQuery("")
    loadTransactions(1)
  }

  const handleDeleteClick = (transaction: TxRow) => {
    setSelectedTransaction(transaction)
    setDeleteDialogOpen(true)
  }

  const onDelete = async () => {
    if (!selectedTransaction) return
    
    console.log('Starting delete process for transaction:', selectedTransaction.id)
    const prev = rows
    
    // Don't remove from UI immediately to see if delete actually works
    setDeleteDialogOpen(false)
    
    try {
      console.log('Sending DELETE request to:', `/api/transactions?id=${encodeURIComponent(selectedTransaction.id)}`)
      const res = await fetch(`/api/transactions?id=${encodeURIComponent(selectedTransaction.id)}`, { method: 'DELETE' })
      console.log('Delete response status:', res.status)
      const json = await res.json().catch(() => ({}))
      console.log('Delete response data:', json)
      
      if (!res.ok || json?.ok === false) {
        throw new Error(json.error || `Delete failed with status ${res.status}`)
      }
      
      // Only remove from UI after successful API call
      setRows(p => p.filter(r => r.id !== selectedTransaction.id))
      toast.success('Transaction deleted successfully')
      console.log('Transaction deleted successfully from database')
    } catch (e: unknown) {
      console.error('Error deleting transaction:', e)
      const errorMessage = e instanceof Error ? e.message : 'Unknown error'
      toast.error(`Could not delete transaction: ${errorMessage}`)
    } finally {
      setSelectedTransaction(null)
    }
  }

  return (
    <RoleGuard>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="font-sans">
          <header className="flex flex-col gap-2 px-4 py-4">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4" />
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-[#601625]" />
                  <h1 className="text-xl font-semibold">Payments</h1>
                </div>
              </div>
              <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  className="h-9 w-64 rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#601625]/20"
                  placeholder="Search services, staff, phone, ID"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                </div>
                <Button
                  onClick={resetAndReload}
                  disabled={loading}
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 text-sm font-medium hover:bg-[#601625]/5 hover:border-[#601625]/30 hover:text-[#601625] transition-all duration-200"
                >
                  <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground ml-[4.5rem]">View and manage all customer payments and transactions</p>
          </header>
          <div className="flex flex-1 flex-col gap-6 p-4 pt-0" style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
            <div className="w-full">
              <Card className="border-neutral-200 shadow-none">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* KPI Section */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900">Key Performance Indicators</h3>
                    <p className="text-sm text-gray-500">Track your business metrics</p>
                  </div>

                  {/* Enhanced KPI Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                    <Card className="rounded-2xl border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-[12px] font-medium text-neutral-500 uppercase tracking-wide">Today&apos;s Revenue</div>
                            <div className="text-[24px] font-bold text-neutral-900 mt-1">
                              {loadingKpis ? (
                                <div className="h-6 w-20 bg-gray-200 rounded animate-pulse"></div>
                              ) : (
                                formatCurrency(kpiData.totalRevenue)
                              )}
                            </div>
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
                            <div className="text-[12px] font-medium text-neutral-500 uppercase tracking-wide">Today&apos;s Tips</div>
                            <div className="text-[24px] font-bold text-neutral-900 mt-1">
                              {loadingKpis ? (
                                <div className="h-6 w-20 bg-gray-200 rounded animate-pulse"></div>
                              ) : (
                                formatCurrency(kpiData.totalTips)
                              )}
                            </div>
                          </div>
                          <div className="h-10 w-10 rounded-xl bg-[#751a29]/10 flex items-center justify-center">
                            <TrendingUp className="h-5 w-5 text-[#751a29]" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="rounded-2xl border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-[12px] font-medium text-neutral-500 uppercase tracking-wide">Today&apos;s Transactions</div>
                            <div className="text-[24px] font-bold text-neutral-900 mt-1">
                              {loadingKpis ? (
                                <div className="h-6 w-16 bg-gray-200 rounded animate-pulse"></div>
                              ) : (
                                kpiData.transactionsCount
                              )}
                            </div>
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
                            <div className="text-[12px] font-medium text-neutral-500 uppercase tracking-wide">Today&apos;s Staff</div>
                            <div className="text-[24px] font-bold text-neutral-900 mt-1">
                              {loadingKpis ? (
                                <div className="h-6 w-12 bg-gray-200 rounded animate-pulse"></div>
                              ) : (
                                kpiData.activeStaff
                              )}
                            </div>
                          </div>
                          <div className="h-10 w-10 rounded-xl bg-[#751a29]/10 flex items-center justify-center">
                            <Users className="h-5 w-5 text-[#751a29]" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="rounded-2xl border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-[12px] font-medium text-neutral-500 uppercase tracking-wide">Today&apos;s Tax</div>
                            <div className="text-[24px] font-bold text-neutral-900 mt-1">
                              {loadingKpis ? (
                                <div className="h-6 w-20 bg-gray-200 rounded animate-pulse"></div>
                              ) : (
                                formatCurrency(kpiData.totalTax)
                              )}
                            </div>
                          </div>
                          <div className="h-10 w-10 rounded-xl bg-[#601625]/10 flex items-center justify-center">
                            <Calendar className="h-5 w-5 text-[#601625]" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Payment Method Breakdown */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Today&apos;s Revenue by Payment Method</h3>
                    {loadingPaymentMethods ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="bg-white rounded-lg border border-gray-200 p-3">
                            <div className="animate-pulse">
                              <div className="h-3 bg-gray-200 rounded w-3/4 mb-2"></div>
                              <div className="h-5 bg-gray-200 rounded w-1/2 mb-1"></div>
                              <div className="h-2 bg-gray-200 rounded w-1/3"></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : paymentMethodData.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        {paymentMethodData.map((method, index) => (
                          <div key={method.method} className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-2 mb-2">
                              <div className={`w-2 h-2 rounded-full ${
                                index === 0 ? 'bg-green-500' :
                                index === 1 ? 'bg-blue-500' :
                                index === 2 ? 'bg-purple-500' :
                                index === 3 ? 'bg-orange-500' :
                                'bg-gray-500'
                              }`}></div>
                              <span className="text-xs font-medium text-gray-600 truncate capitalize">{method.method}</span>
                            </div>
                            <div className="text-lg font-bold text-gray-900 mb-1">
                              {formatCurrency(method.totalRevenue)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {method.transactionCount} transaction{method.transactionCount !== 1 ? 's' : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <div className="text-sm">No payment data available for today</div>
                      </div>
                    )}
                  </div>
                  {loading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full rounded-xl" />
                      ))}
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-gray-200 shadow-lg bg-white">
                  {/* Professional Table Header */}
                  <div className="hidden lg:grid grid-cols-12 bg-white border-b-2 border-gray-100 px-6 py-4">
                    <div className="col-span-3">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-[#601625] rounded-full"></div>
                        <span className="text-sm font-semibold text-gray-700 tracking-wide">SERVICE</span>
                          </div>
                        </div>
                    <div className="col-span-2">
                      <span className="text-sm font-semibold text-gray-700 tracking-wide">STAFF</span>
                          </div>
                    <div className="col-span-2">
                      <span className="text-sm font-semibold text-gray-700 tracking-wide">CUSTOMER</span>
                        </div>
                    <div className="col-span-2">
                      <span className="text-sm font-semibold text-gray-700 tracking-wide">TIPS</span>
                          </div>
                    <div className="col-span-2">
                      <span className="text-sm font-semibold text-gray-700 tracking-wide">PAYMENT</span>
                        </div>
                    <div className="col-span-1 text-right">
                      <span className="text-sm font-semibold text-gray-700 tracking-wide">ACTIONS</span>
                          </div>
                        </div>
                      <div className="divide-y divide-gray-100">
                        {filtered.map((r, index) => (
                          <div key={r.id} className={`hidden lg:grid grid-cols-12 items-center px-6 py-6 hover:bg-gray-50/50 transition-all duration-200 group ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                            {/* Service Column */}
                            <div className="col-span-3 min-w-0">
                              <div className="flex items-center gap-4">
                                <div className="w-2 h-2 bg-[#601625] rounded-full flex-shrink-0"></div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-base font-semibold text-gray-900 truncate leading-tight">
                                    {getServiceName(r)}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    Transaction #{r.id.slice(-8)}
                                </div>
                              </div>
                            </div>
                            </div>

                            {/* Staff Column */}
                            <div className="col-span-2">
                              <div className="flex flex-col gap-2">
                                {r.items && r.items.length > 0 ? (
                                  r.items.map((item, idx) => (
                                    <div key={idx} className="inline-flex items-center rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 w-fit">
                                      <span className="truncate">{item.staffName || 'Staff Not Assigned'}</span>
                                    </div>
                                  ))
                                ) : (
                                  <div className="inline-flex items-center rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 w-fit">
                                    <span className="truncate">{getStaffName(r)}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Customer Column */}
                            <div className="col-span-2 min-w-0">
                                <div className="min-w-0 flex-1">
                                <div className="text-base font-semibold text-gray-900 truncate">
                                  {getCustomerName(r)}
                                  {loadingCustomers && getCustomerName(r) === 'Loading...' && (
                                    <span className="ml-2 text-xs text-gray-500">⏳</span>
                                  )}
                                </div>
                                  <div className="mt-1">
                                  <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-600/20">
                                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-1.5"></div>
                                    {getCustomerPhone(r)}
                                    </span>
                                  </div>
                                </div>
                              </div>

                            {/* Tips Column */}
                            <div className="col-span-2">
                                <div className="flex flex-col gap-1">
                                <div className="text-lg font-bold text-[#751a29]">{formatCurrency(r.tip)}</div>
                                </div>
                              </div>

                            {/* Payment Column */}
                            <div className="col-span-2">
                                <div className="flex flex-col gap-1">
                                <div className="text-xl font-bold text-gray-900">{formatCurrency(r.totalPaid)}</div>
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></div>
                                    {r.method || 'Unknown'}
                                  </span>
                                  <span className="text-xs text-gray-500 font-mono">{formatDate(r.paymentDate)}</span>
                                </div>
                              </div>
                            </div>

                            {/* Actions Column */}
                            <div className="col-span-1 flex justify-end gap-2">
                              <Link 
                                href={`/payments/${encodeURIComponent(r.id)}`} 
                                className="inline-flex h-9 items-center rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-sm"
                              >
                                <Eye className="h-4 w-4 mr-1.5" /> View
                              </Link>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-9 rounded-lg px-3 text-sm font-medium text-red-700 border-red-300 hover:bg-red-50 hover:border-red-400 transition-all duration-200 shadow-sm" 
                                onClick={() => handleDeleteClick(r)}
                              >
                                <Trash2 className="h-4 w-4 mr-1.5" /> Delete
                              </Button>
                            </div>
                          </div>
                        ))}
                        
                        {/* Professional Mobile Card Layout */}
                        {filtered.map((r) => (
                          <div key={`mobile-${r.id}`} className="lg:hidden p-4 border-b border-gray-100 last:border-b-0">
                            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4 shadow-sm">
                              {/* Header with Service and Amount */}
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 bg-[#601625] rounded-full flex-shrink-0"></div>
                                  <div>
                                    <div className="text-base font-semibold text-gray-900">{getServiceName(r)}</div>
                                    <div className="text-xs text-gray-500 mt-1">Transaction #{r.id.slice(-8)}</div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xl font-bold text-gray-900">{formatCurrency(r.totalPaid)}</div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></div>
                                      {r.method || 'Unknown'}
                                    </span>
                                    <span className="text-xs text-gray-500 font-mono">{formatDate(r.paymentDate)}</span>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Staff and Customer Info */}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Staff</div>
                                {r.items && r.items.length > 0 ? (
                                    <div className="space-y-2">
                                      {r.items.map((item, idx) => (
                                        <div key={idx} className="inline-flex items-center rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 w-fit">
                                          <span className="truncate">{item.staffName || 'Staff Not Assigned'}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="inline-flex items-center rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 w-fit">
                                      <span className="truncate">{getStaffName(r)}</span>
                                    </div>
                                )}
                              </div>
                              
                                <div>
                                  <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Customer</div>
                                  <div className="text-sm font-semibold text-gray-900 truncate">
                                    {getCustomerName(r)}
                                    {loadingCustomers && getCustomerName(r) === 'Loading...' && (
                                      <span className="ml-2 text-xs text-gray-500">⏳</span>
                                    )}
                                  </div>
                                  <div className="mt-2">
                                    <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-600/20">
                                      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-1.5"></div>
                                      {getCustomerPhone(r)}
                                  </span>
                                </div>
                                </div>
                              </div>
                              
                              {/* Tips and Actions */}
                              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                                <div>
                                  <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Tips</div>
                                  <div className="text-lg font-bold text-[#751a29]">{formatCurrency(r.tip)}</div>
                                </div>
                                <div className="flex gap-2">
                                  <Link 
                                    href={`/payments/${encodeURIComponent(r.id)}`} 
                                    className="inline-flex h-9 items-center rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-sm"
                                  >
                                    <Eye className="h-4 w-4 mr-1.5" /> View
                                </Link>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                    className="h-9 rounded-lg px-3 text-sm font-medium text-red-700 border-red-300 hover:bg-red-50 hover:border-red-400 transition-all duration-200 shadow-sm" 
                                  onClick={() => handleDeleteClick(r)}
                                >
                                    <Trash2 className="h-4 w-4 mr-1.5" /> Delete
                                </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {filtered.length === 0 && !loading && (
                          <div className="p-12 text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div className="text-lg font-semibold text-gray-900 mb-2">No transactions found</div>
                            <div className="text-sm text-gray-500">Try adjusting your search criteria or date range</div>
                          </div>
                        )}
                        
                        {/* Professional Pagination */}
                        {totalPages > 1 && !loading && (
                          <div className="px-6 py-6 border-t border-gray-200 bg-gray-50/50">
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                              {/* Page Info */}
                              <div className="text-sm text-gray-600 font-medium">
                                Showing <span className="font-semibold text-gray-900">{((currentPage - 1) * itemsPerPage) + 1}</span> to <span className="font-semibold text-gray-900">{Math.min(currentPage * itemsPerPage, totalCount)}</span> of <span className="font-semibold text-gray-900">{totalCount.toLocaleString()}</span> transactions
                              </div>
                              
                              {/* Pagination Controls */}
                              <div className="flex items-center gap-2">
                                {/* Previous Button */}
                                <Button
                                  onClick={() => goToPage(currentPage - 1)}
                                  disabled={currentPage === 1}
                                  variant="outline"
                                  size="sm"
                                  className="h-10 px-4 text-sm font-medium border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <ChevronLeft className="h-4 w-4 mr-1" />
                                  Previous
                                </Button>
                                
                                {/* Page Numbers */}
                                <div className="flex items-center gap-1">
                                  {/* First page */}
                                  {currentPage > 3 && (
                                    <>
                                      <Button
                                        onClick={() => goToPage(1)}
                                        variant="outline"
                                        size="sm"
                                        className="h-10 w-10 text-sm font-semibold border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
                                      >
                                        1
                                      </Button>
                                      {currentPage > 4 && <span className="text-gray-400 px-2">...</span>}
                                    </>
                                  )}
                                  
                                  {/* Pages around current page */}
                                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    const startPage = Math.max(1, currentPage - 2)
                                    const page = startPage + i
                                    if (page > totalPages) return null
                                    
                                    return (
                                      <Button
                                        key={page}
                                        onClick={() => goToPage(page)}
                                        variant={page === currentPage ? "default" : "outline"}
                                        size="sm"
                                        className={`h-10 w-10 text-sm font-semibold transition-all duration-200 ${
                                          page === currentPage
                                            ? "bg-[#601625] text-white hover:bg-[#751a29] shadow-sm"
                                            : "border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
                                        }`}
                                      >
                                        {page}
                                      </Button>
                                    )
                                  })}
                                  
                                  {/* Last page */}
                                  {currentPage < totalPages - 2 && (
                                    <>
                                      {currentPage < totalPages - 3 && <span className="text-gray-400 px-2">...</span>}
                                      <Button
                                        onClick={() => goToPage(totalPages)}
                                        variant="outline"
                                        size="sm"
                                        className="h-10 w-10 text-sm font-semibold border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
                                      >
                                        {totalPages}
                                      </Button>
                                    </>
                                  )}
                                </div>
                                
                                {/* Next Button */}
                                <Button
                                  onClick={() => goToPage(currentPage + 1)}
                                  disabled={currentPage === totalPages}
                                  variant="outline"
                                  size="sm"
                                  className="h-10 px-4 text-sm font-medium border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Next
                                  <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[18px] font-semibold">Delete Transaction</DialogTitle>
            <DialogDescription className="text-[14px] text-neutral-600">
              Are you sure you want to delete this transaction? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <div className="py-4">
              <div className="bg-neutral-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-[14px]">
                  <span className="text-neutral-600">Transaction ID:</span>
                  <span className="font-mono text-[12px]">{selectedTransaction.id}</span>
                </div>
                <div className="flex justify-between text-[14px]">
                  <span className="text-neutral-600">Services:</span>
                  <span className="font-medium">{selectedTransaction.services || '—'}</span>
                </div>
                <div className="flex justify-between text-[14px]">
                  <span className="text-neutral-600">Total:</span>
                  <span className="font-bold text-green-600">{formatCurrency(selectedTransaction.totalPaid)}</span>
                </div>
                <div className="flex justify-between text-[14px]">
                  <span className="text-neutral-600">Staff:</span>
                  <span className="font-medium">{selectedTransaction.staff || '—'}</span>
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <Button 
              variant="outline" 
              onClick={() => setDeleteDialogOpen(false)}
              className="text-[14px]"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={onDelete}
              className="text-[14px] bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Transaction
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </RoleGuard>
  )
}


