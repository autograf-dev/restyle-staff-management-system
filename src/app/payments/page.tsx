"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { RoleGuard } from "@/components/role-guard"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Trash2, Search, Eye, DollarSign, TrendingUp, Users, Calendar, RefreshCw, ChevronLeft, ChevronRight, CreditCard, Filter, X } from "lucide-react"
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
  // Walk-in guest fields
  walkInCustomerId: string | null
  walkInPhone: string | null
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
  const [searchQuery, setSearchQuery] = useState("")
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
  const [searchLoading, setSearchLoading] = useState(false)
  const [isSearchMode, setIsSearchMode] = useState(false)
  const [staffOptions, setStaffOptions] = useState<string[]>([])
  const [selectedStaff, setSelectedStaff] = useState<string>("")
  const PAYMENT_METHODS = [
    { id: "visa", name: "Visa" },
    { id: "mastercard", name: "Mastercard" },
    { id: "amex", name: "Amex" },
    { id: "debit", name: "Debit" },
    { id: "cash", name: "Cash" },
  ] as const
  const [selectedMethod, setSelectedMethod] = useState<string>("")
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  // ✅ single declaration only
  const itemsPerPage = 50

  const filtered = useMemo(() => {
    // Always return all rows - no client-side filtering
    // Search only works via the Search button
    return rows
  }, [rows])

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

  // ---------- existing logic (unchanged) ----------
  // Load staff list for dropdown
  useEffect(() => {
    const loadStaff = async () => {
      try {
        const res = await fetch('/api/barber-hours')
        const json = await res.json()
        if (!res.ok || !json.ok) return
        const namesSet = new Set<string>(
          (json.data as Array<Record<string, unknown>> | undefined || [])
            .map((row) => String(row['Barber/Name'] || '').trim())
            .filter((n) => n.length > 0)
        )
        const names: string[] = Array.from(namesSet).sort((a, b) => a.localeCompare(b))
        setStaffOptions(names)
      } catch {
        // silent fail
      }
    }
    loadStaff()
  }, [])
  const fetchCustomerFromAPI = async (customerId: string): Promise<string | null> => {
    try {
      const res = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/getContact?id=${encodeURIComponent(customerId)}`)
      if (!res.ok) return null
      const json = await res.json()
      if (json?.contact) {
        const c = json.contact
        return c.contactName || c.name || `${c.firstName || ""} ${c.lastName || ""}`.trim() || null
      }
      return null
    } catch {
      return null
    }
  }

  const fetchCustomerNames = async (transactions: TxRow[]) => {
    const customerIds = transactions
      .map(tx => tx.customerLookup)
      .filter(id => id && id.trim() !== "" && !customerNames[id!]) as string[]
    if (customerIds.length === 0) return

    setLoadingCustomers(true)
    const nameMap: Record<string, string> = {}

    await Promise.allSettled(
      customerIds.map(async (customerId) => {
        const name = await fetchCustomerFromAPI(customerId)
        if (name) nameMap[customerId] = name
      })
    )

    if (Object.keys(nameMap).length > 0) setCustomerNames(prev => ({ ...prev, ...nameMap }))
    setLoadingCustomers(false)
  }

  const getCustomerName = (transaction: TxRow) => {
    // Check for walk-in guest name first
    if (transaction.walkInCustomerId && transaction.walkInCustomerId.trim() !== "") {
      const walkInName = transaction.walkInCustomerId.trim()
      // Return the walk-in name as-is, don't append phone number
      return walkInName
    }
    
    // Then check regular customer lookup
    if (transaction.customerLookup && transaction.customerLookup.trim() !== "") {
      const lookupId = transaction.customerLookup.trim()
      if (customerNames[lookupId]) return customerNames[lookupId]
      if (lookupId.length > 10 && !lookupId.includes(" ")) {
        fetchCustomerFromAPI(lookupId).then(name => name && setCustomerNames(prev => ({ ...prev, [lookupId]: name })))
        return "Loading..."
      }
      return lookupId
    }
    
    // Fallback to phone-based guest
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

  const getStaffName = (transaction: TxRow) => {
    if (transaction.items?.length) {
      const names = transaction.items.map(i => i.staffName).filter(Boolean).join(", ")
      if (names) return names
    }
    if (transaction.staff && transaction.staff.trim() !== "") return transaction.staff.trim()
    return "Staff Not Assigned"
  }

  const getCustomerPhone = (transaction: TxRow) =>
    transaction.customerPhone && transaction.customerPhone.trim() !== "" ? transaction.customerPhone.trim() : "No Phone Provided"

  const kpis = useMemo(() => {
    const count = filtered.length
    const revenue = filtered.reduce((sum, r) => sum + Number(r.totalPaid || 0), 0)
    const tips = filtered.reduce((sum, r) => sum + Number(r.tip || 0), 0)
    const avg = count > 0 ? revenue / count : 0

    const uniqueStaff = new Set(
      filtered
        .map(r => r.staff)
        .filter(Boolean)
        .flatMap(staff => staff!.split(",").map(name => name.trim()))
        .filter(name => name.length > 0)
    ).size

    const totalTipSplits = filtered.reduce((sum, r) => {
      if (r.items) return sum + r.items.reduce((itemSum, item) => itemSum + Number(item.staffTipSplit || 0), 0)
      return sum
    }, 0)

    return { count, revenue, tips, avg, uniqueStaff, totalTipSplits }
  }, [filtered])

  const loadKpiData = async () => {
    setLoadingKpis(true)
    try {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const end = new Date(new Date(start).getTime() + 24 * 60 * 60 * 1000).toISOString()
      const rangeQuery = `&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
      const [revenueRes, tipsRes, countRes, staffRes, taxRes] = await Promise.all([
        fetch(`/api/kpi/total-revenue?filter=today${rangeQuery}`),
        fetch(`/api/kpi/total-tips?filter=today${rangeQuery}`),
        fetch(`/api/kpi/transactions-count?filter=today${rangeQuery}`),
        fetch(`/api/kpi/active-staff?filter=today${rangeQuery}`),
        fetch(`/api/kpi/total-tax?filter=today${rangeQuery}`)
      ])

      const [revenueData, tipsData, countData, staffData, taxData] = await Promise.all([
        revenueRes.json(),
        tipsRes.json(),
        countRes.json(),
        staffRes.json(),
        taxRes.json()
      ])

      if (revenueData.ok && tipsData.ok && countData.ok && staffData.ok && taxData.ok) {
        setKpiData({
          totalRevenue: revenueData.data.totalRevenue,
          totalTips: tipsData.data.totalTips,
          transactionsCount: countData.data.transactionsCount,
          activeStaff: staffData.data.activeStaff,
          totalTax: taxData.data.totalTax
        })
      }
    } finally {
      setLoadingKpis(false)
    }
  }

  const loadPaymentMethodData = async () => {
    setLoadingPaymentMethods(true)
    try {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const end = new Date(new Date(start).getTime() + 24 * 60 * 60 * 1000).toISOString()
      const response = await fetch(`/api/kpi/revenue-by-payment-method?filter=today&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`)
      const data = await response.json()
      if (data.ok) setPaymentMethodData(data.data.paymentMethods)
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
      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to load")

      const transactions = json.data || []
      const total = json.total || transactions.length

      setRows(transactions)
      setTotalCount(total)
      setTotalPages(Math.ceil(total / itemsPerPage))
      setCurrentPage(page)

      await fetchCustomerNames(transactions)
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "Unknown error"
      toast.error("Failed to load payments: " + errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const searchTransactions = async (searchQuery: string, staffFilter: string = "", methodFilter: string = "") => {
    if (!searchQuery.trim() && !staffFilter.trim() && !methodFilter.trim()) {
      toast.error("Please use at least one filter")
      return
    }

    setSearchLoading(true)
    try {
      const params = new URLSearchParams({
        limit: itemsPerPage.toString(),
        offset: "0"
      })
      
      if (searchQuery.trim()) {
        params.append("q", searchQuery.trim())
      }
      
      if (staffFilter.trim()) {
        params.append("staff", staffFilter.trim())
      }
      if (methodFilter.trim()) {
        params.append("method", methodFilter.trim())
      }

      const res = await fetch(`/api/transactions/search?${params.toString()}`)
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || "Search failed")

      const transactions = json.data || []
      const total = json.total || transactions.length

      setRows(transactions)
      setTotalCount(total)
      setTotalPages(Math.ceil(total / itemsPerPage))
      setCurrentPage(1)
      setIsSearchMode(true)

      await fetchCustomerNames(transactions)
      
      // Scroll to the table
      const tableElement = document.getElementById('transactions-table')
      if (tableElement) {
        tableElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }

      const parts: string[] = []
      if (searchQuery.trim()) parts.push(`service "${searchQuery}"`)
      if (staffFilter.trim()) parts.push(`staff "${staffFilter}"`)
      if (methodFilter.trim()) parts.push(`method "${methodFilter}"`)
      const searchType = parts.join(" + ")
      toast.success(`Found ${total} transaction${total !== 1 ? 's' : ''} for ${searchType}`)
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "Unknown error"
      toast.error("Search failed: " + errorMessage)
    } finally {
      setSearchLoading(false)
    }
  }

  useEffect(() => {
    loadTransactions(1)
    loadKpiData()
    loadPaymentMethodData()
  }, [])

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) loadTransactions(page)
  }

  const resetAndReload = () => {
    setCurrentPage(1)
    setSearchQuery("")
    setSelectedStaff("")
    setSelectedMethod("")
    setIsSearchMode(false)
    loadTransactions(1)
  }

  const handleSearch = () => {
    searchTransactions(searchQuery, selectedStaff, selectedMethod)
  }

  const handleStaffFilter = (staff: string) => {
    setSelectedStaff(staff)
    if (staff.trim()) {
      // If staff is selected, filter immediately
      searchTransactions("", staff, selectedMethod)
    } else {
      // If "All staff" is selected, reset to show all transactions
      setIsSearchMode(false)
      loadTransactions(1)
    }
  }

  const handleMethodFilter = (method: string) => {
    setSelectedMethod(method)
    if (method.trim()) {
      searchTransactions("", selectedStaff, method)
    } else {
      setIsSearchMode(false)
      loadTransactions(1)
    }
  }

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    
    // If input is cleared, automatically reset to show all transactions
    if (value.trim() === "") {
      setIsSearchMode(false)
      loadTransactions(1)
    }
  }


  const handleDeleteClick = (transaction: TxRow) => {
    setSelectedTransaction(transaction)
    setDeleteDialogOpen(true)
  }

  const onDelete = async () => {
    if (!selectedTransaction) return
    setDeleteDialogOpen(false)
    try {
      const res = await fetch(`/api/transactions?id=${encodeURIComponent(selectedTransaction.id)}`, { method: "DELETE" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.ok === false) throw new Error(json.error || `Delete failed with status ${res.status}`)
      setRows(p => p.filter(r => r.id !== selectedTransaction.id))
      toast.success("Transaction deleted successfully")
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "Unknown error"
      toast.error(`Could not delete transaction: ${errorMessage}`)
    } finally {
      setSelectedTransaction(null)
    }
  }
  // ---------- end existing logic ----------

  return (
    <RoleGuard>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="font-sans">
          {/* Header */}
          <header className="flex flex-col gap-2 px-4 py-4">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4" />
                <div className="flex items-center gap-2">
                  <CreditCard className="hidden md:inline-block h-5 w-5 text-[#601625]" />
                  <h1 className="text-xl font-semibold">Payments</h1>
                </div>
              </div>
              {/* Mobile filter toggle */}
              <div className="md:hidden">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={mobileFiltersOpen ? "Close filters" : "Open filters"}
                  className="h-9 w-9"
                  onClick={() => setMobileFiltersOpen((v) => !v)}
                >
                  {mobileFiltersOpen ? (
                    <X className="h-4 w-4" />
                  ) : (
                    <Filter className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground md:ml-[4.5rem] ml-0 hidden md:block">
              View and manage all customer payments and transactions
            </p>
          </header>

          <div
            className="flex flex-1 flex-col gap-6 p-4 pt-0"
            style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}
          >
            {/* ===== Overview (single clean card with 2 horizontal panels) ===== */}
            {/* COMMENTED OUT - Matrix/KPI Overview Section
            <Card className="border-neutral-200 shadow-none">
              <CardHeader className="md:py-1.5 px-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#601625] rounded-full" />
                  <h3 className="text-base md:text-sm font-semibold text-gray-900 sm:text-[25px]">Today&apos;s Overview</h3>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-2">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* KPIs */}
                  {/* <section className="rounded-2xl ring-1 ring-neutral-200 bg-white p-4 md:rounded-xl md:border md:border-neutral-200 md:ring-0 md:p-4">
                    <header className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-base md:text-sm font-semibold text-gray-900 tracking-tight sm:text-[20px]">Key Performance Indicators </h4>
                      </div>
                      <div className="h-8 w-8 rounded-lg bg-[#601625]/10 flex items-center justify-center">
                        <TrendingUp className="h-4 w-4 text-[#601625]" />
                      </div>
                    </header>

                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                      <div className="rounded-xl ring-1 ring-neutral-200 p-4 md:rounded-lg md:border md:border-neutral-200 md:ring-0 md:p-3 bg-white">
                        <div className="text-[11px] text-neutral-500 font-medium uppercase">Revenue</div>
                        <div className="mt-1 text-[20px] font-bold text-neutral-900">
                          {loadingKpis ? <div className="h-5 w-20 bg-gray-200 rounded animate-pulse" /> : formatCurrency(kpiData.totalRevenue)}
                        </div>
                      </div>

                      <div className="rounded-xl ring-1 ring-neutral-200 p-4 md:rounded-lg md:border md:border-neutral-200 md:ring-0 md:p-3 bg-white">
                        <div className="text-[11px] text-neutral-500 font-medium uppercase">Tips</div>
                        <div className="mt-1 text-[20px] font-bold text-neutral-900">
                          {loadingKpis ? <div className="h-5 w-16 bg-gray-200 rounded animate-pulse" /> : formatCurrency(kpiData.totalTips)}
                        </div>
                      </div>

                      <div className="rounded-xl ring-1 ring-neutral-200 p-4 md:rounded-lg md:border md:border-neutral-200 md:ring-0 md:p-3 bg-white">
                        <div className="text-[11px] text-neutral-500 font-medium uppercase">Transactions</div>
                        <div className="mt-1 text-[20px] font-bold text-neutral-900">
                          {loadingKpis ? <div className="h-5 w-12 bg-gray-200 rounded animate-pulse" /> : kpiData.transactionsCount}
                        </div>
                      </div>

                      <div className="rounded-xl ring-1 ring-neutral-200 p-4 md:rounded-lg md:border md:border-neutral-200 md:ring-0 md:p-3 bg-white">
                        <div className="text-[11px] text-neutral-500 font-medium uppercase">Active Staff</div>
                        <div className="mt-1 text-[20px] font-bold text-neutral-900">
                          {loadingKpis ? <div className="h-5 w-10 bg-gray-200 rounded animate-pulse" /> : kpiData.activeStaff}
                        </div>
                      </div>

                      <div className="rounded-xl ring-1 ring-neutral-200 p-4 md:rounded-lg md:border md:border-neutral-200 md:ring-0 md:p-3 bg-white">
                        <div className="text-[11px] text-neutral-500 font-medium uppercase">Tax</div>
                        <div className="mt-1 text-[20px] font-bold text-neutral-900">
                          {loadingKpis ? <div className="h-5 w-20 bg-gray-200 rounded animate-pulse" /> : formatCurrency(kpiData.totalTax)}
                        </div>
                      </div>
                    </div>
                  </section> */}

                  {/* Revenue by method */}
                  {/* <section className="rounded-2xl ring-1 ring-neutral-200 bg-white p-4 md:rounded-xl md:border md:border-neutral-200 md:ring-0 md:p-4">
                    <header className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-base md:text-sm font-semibold text-gray-900 tracking-tight">Revenue by Payment Method</h4>
                      </div>
                      <div className="h-8 w-8 rounded-lg bg-[#601625]/10 flex items-center justify-center">
                        <CreditCard className="h-4 w-4 text-[#601625]" />
                      </div>
                    </header>

                    {loadingPaymentMethods ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} className="rounded-lg border border-neutral-200 p-3">
                            <div className="animate-pulse space-y-2">
                              <div className="h-3 bg-gray-200 rounded w-3/4" />
                              <div className="h-5 bg-gray-200 rounded w-1/2" />
                              <div className="h-2 bg-gray-200 rounded w-1/3" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : paymentMethodData.length ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                        {paymentMethodData.map((method, index) => (
                          <div key={method.method} className="rounded-lg border border-neutral-200 p-3 hover:shadow-sm transition-shadow">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-neutral-600 capitalize truncate">{method.method}</span>
                              <span
                                className={`w-2.5 h-2.5 rounded-full ${
                                  index === 0 ? "bg-green-500" : index === 1 ? "bg-blue-500" : index === 2 ? "bg-purple-500" : index === 3 ? "bg-orange-500" : "bg-gray-500"
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
                    ) : (
                      <div className="text-sm text-gray-500">No payment data for today</div>
                    )}
                  </section> */}
                {/* </div>
              </CardContent>
            </Card> */}
            {/* ===== End Overview ===== */}

            {/* ===== Filters Card ===== */}
            <Card className={`border-neutral-200 shadow-sm bg-white p-0 gap-0 ${mobileFiltersOpen ? '' : 'hidden md:block'}`}>
              <CardHeader className="pb-2 px-6 pt-4">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-[#601625] hidden md:inline-block" />
                  <h3 className="text-lg font-semibold text-gray-900 hidden md:inline-block">Filter By Staff/Service and Payment Type</h3>
                  <h3 className="text-base font-semibold text-gray-900 md:hidden">Filters</h3>
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-4">
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  {/* Search Bar */}
               
                  {/* Staff Dropdown (first) */}
                  <div className="min-w-[400px]">
                    <Select value={selectedStaff === "" ? "__all__" : selectedStaff} onValueChange={(v) => handleStaffFilter(v === "__all__" ? "" : v)}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="All staff" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All staff</SelectItem>
                        {staffOptions.map((name) => (
                          <SelectItem key={name} value={name}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Payment Method Dropdown (second) */}
                  <div className="min-w-[400px]">
                    <Select value={selectedMethod === "" ? "__all__" : selectedMethod} onValueChange={(v) => handleMethodFilter(v === "__all__" ? "" : v)}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="All methods" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All methods</SelectItem>
                        {PAYMENT_METHODS.map((m) => (
                          <SelectItem key={m.id} value={m.name.toLowerCase()}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="relative flex-1 min-w-[220px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                      <input
                        className="w-full h-10 pl-10 pr-4 rounded-lg border border-gray-300 bg-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#601625]/20 focus:border-[#601625]/30 transition-all duration-200"
                        placeholder="Search service names..."
                        value={searchQuery}
                        onChange={handleSearchInputChange}
                      />
                    </div>
                  </div>
                  {/* Filter Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0 md:ml-auto">
                    <Button
                      onClick={handleSearch}
                      disabled={searchLoading || (!searchQuery.trim() && !selectedStaff.trim() && !selectedMethod.trim())}
                      size="sm"
                      className="h-10 px-4 text-sm font-medium bg-[#601625] text-white hover:bg-[#751a29] focus:outline-none focus:ring-2 focus:ring-[#601625]/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Search className={`h-4 w-4 mr-2 ${searchLoading ? "animate-pulse" : ""}`} />
                      {searchLoading ? "Searching..." : "Search"}
                    </Button>
                    <Button
                      onClick={resetAndReload}
                      disabled={loading}
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 text-sm font-medium border-gray-300 text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-[#601625]/20 focus:border-[#601625]/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Reset filters"
                      title="Reset filters"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            {/* ===== End Filters Card ===== */}

            {/* ===== Payments list (separate card below) ===== */}
            <Card id="transactions-table" className="border-neutral-200 shadow-none p-0">
              <CardContent className="p-0">
                {loading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full rounded-xl" />
                    ))}
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl bg-white shadow-md">
                    {/* Transactions heading + pagination (mobile, flex in one row) */}
                    <div className="md:hidden px-4 pt-4 pb-2">
                      <div className="flex items-center justify-between">
                        <Button
                          onClick={() => goToPage(currentPage - 1)}
                          disabled={currentPage === 1}
                          size="icon"
                          className="h-9 w-9 bg-[#601625]/30 hover:bg-[#601625]/40 text-white disabled:opacity-50"
                          aria-label="Previous"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex flex-col items-center">
                          <h3 className="text-base md:text-sm font-semibold text-gray-900 sm:text-[25px]">
                            {isSearchMode ? "Search Results" : "Transactions"}
                          </h3>
                          {totalPages > 1 && !loading && (
                            <div className="text-xs text-gray-600 mt-1">
                              Page <span className="font-semibold text-gray-900">{currentPage}</span> / {totalPages}
                            </div>
                          )}
                          {isSearchMode && (
                            <div className="text-xs text-[#601625] mt-1 font-medium">
                              {totalCount} result{totalCount !== 1 ? 's' : ''} found
                            </div>
                          )}
                        </div>
                        <Button
                          onClick={() => goToPage(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          size="icon"
                          className="h-9 w-9 bg-[#601625] hover:bg-[#751a29] text-white disabled:opacity-50"
                          aria-label="Next"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {/* Header */}
                    <div className="hidden lg:grid grid-cols-12 px-6 py-4 bg-gray-100/70 border-b border-gray-200 rounded-t-2xl sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-gray-100/60">
                      <div className="col-span-3">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-[#601625] rounded-full" />
                          <span className="text-[13px] font-semibold text-neutral-700 uppercase tracking-wider">SERVICE</span>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[13px] font-semibold text-neutral-700 uppercase tracking-wider">STAFF</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[13px] font-semibold text-neutral-700 uppercase tracking-wider">CUSTOMER</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[13px] font-semibold text-neutral-700 uppercase tracking-wider">TIPS</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[13px] font-semibold text-neutral-700 uppercase tracking-wider">PAYMENT</span>
                      </div>
                      <div className="col-span-1 text-right">
                        <span className="text-[13px] font-semibold text-neutral-700 uppercase tracking-wider">ACTIONS</span>
                      </div>
                    </div>

                    {/* Mobile pagination moved into header above */}

                    <div className="md:divide-y md:divide-gray-100">
                      {filtered.map((r, index) => (
                        <div
                          key={r.id}
                          className={`hidden lg:grid grid-cols-12 items-center px-6 py-5 first:pt-0 hover:bg-gray-50/50 transition-all duration-200 group ${
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
                                <div className="text-xs text-gray-500 mt-1">Transaction #{r.id.slice(-8)}</div>
                              </div>
                            </div>
                          </div>

                          {/* Staff */}
                          <div className="col-span-2">
                            <div className="flex flex-col gap-2">
                              {r.items && r.items.length > 0 ? (
                                r.items.map((item, idx) => (
                                  <div key={idx} className="inline-flex items-center rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 w-fit">
                                    <span className="truncate">{item.staffName || "Staff Not Assigned"}</span>
                                  </div>
                                ))
                              ) : (
                                <div className="inline-flex items-center rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 w-fit">
                                  <span className="truncate">{getStaffName(r)}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Customer */}
                          <div className="col-span-2 min-w-0">
                            <div className="min-w-0 flex-1">
                              <div className="text-base font-semibold text-gray-900 truncate">
                                {getCustomerName(r)}
                                {loadingCustomers && getCustomerName(r) === "Loading..." && (
                                  <span className="ml-2 text-xs text-gray-500">⏳</span>
                                )}
                              </div>
                              <div className="mt-1">
                                <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-600/20">
                                  <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-1.5" />
                                  {getCustomerPhone(r)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Tips */}
                          <div className="col-span-2">
                            <div className="flex flex-col gap-1">
                              <div className="text-lg font-bold text-[#751a29]">{formatCurrency(r.tip)}</div>
                            </div>
                          </div>

                          {/* Payment */}
                          <div className="col-span-2">
                            <div className="flex flex-col gap-1">
                              <div className="text-2xl font-bold text-gray-900">{formatCurrency(r.totalPaid)}</div>
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5" />
                                  {r.method || "Unknown"}
                                </span>
                                <span className="text-xs text-gray-500 font-mono">{formatDate(r.paymentDate)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
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

                      {/* Mobile cards */}
                      {filtered.map((r) => (
                        <div key={`mobile-${r.id}`} className="lg:hidden p-3">
                          <div className="bg-white rounded-2xl ring-1 ring-neutral-200 p-4 space-y-4 shadow-xs">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-2 h-2 bg-[#601625] rounded-full" />
                                <div>
                                  <div className="text-[15px] font-semibold text-gray-900 leading-tight">{getServiceName(r)}</div>
                                  <div className="text-[11px] text-gray-500 mt-1">Transaction #{r.id.slice(-8)}</div>
                                  <div className="text-[11px] text-gray-500 mt-0.5 font-mono">{formatDate(r.paymentDate)}</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-[24px] font-bold text-gray-900">{formatCurrency(r.totalPaid)}</div>
                                <div className="flex items-center justify-end gap-2 mt-1">
                                  <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5" />
                                    {r.method || "Unknown"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                {(() => {
                                  const staffDisplay = r.items && r.items.length > 0
                                    ? r.items.map((item) => item.staffName || "Staff Not Assigned").join(", ")
                                    : getStaffName(r)
                                  return (
                                    <div className="text-[13px] text-gray-900">
                                      <span className="text-[12px] font-semibold text-gray-800 mr-1">Staff :</span>
                                      {staffDisplay}
                                    </div>
                                  )
                                })()}
                              </div>

                              <div>
                                <div className="text-[13px] font-semibold text-gray-900 break-words">
                                  <span className="font-semibold text-gray-800">Customer -</span>{" "}
                                  {getCustomerName(r)}
                                  {loadingCustomers && getCustomerName(r) === "Loading..." && (
                                    <span className="ml-1 text-[11px] text-gray-500">⏳</span>
                                  )}
                                </div>
                                <div className="text-[12px] text-neutral-600 mt-0.5 break-words">({getCustomerPhone(r)})</div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-2">
                              <div>
                                <div className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1">Tips</div>
                                <div className="text-[17px] font-bold text-[#751a29]">{formatCurrency(r.tip)}</div>
                              </div>
                              <div className="flex gap-2">
                                <Link
                                  href={`/payments/${encodeURIComponent(r.id)}`}
                                  className="inline-flex h-9 items-center rounded-lg border border-gray-300 bg-white px-3 text-[13px] font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-sm"
                                >
                                  <Eye className="h-4 w-4 mr-1.5" /> View
                                </Link>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-9 rounded-lg px-3 text-[13px] font-medium text-red-700 border-red-300 hover:bg-red-50 hover:border-red-400 transition-all duration-200 shadow-sm"
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

                      {totalPages > 1 && !loading && (
                        <div className="px-6 py-6 border-t border-gray-200 bg-gray-50/50">
                          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="text-sm text-gray-600 font-medium">
                              Showing{" "}
                              <span className="font-semibold text-gray-900">{(currentPage - 1) * itemsPerPage + 1}</span>{" "}
                              to{" "}
                              <span className="font-semibold text-gray-900">{Math.min(currentPage * itemsPerPage, totalCount)}</span>{" "}
                              of <span className="font-semibold text-gray-900">{totalCount.toLocaleString()}</span> transactions
                            </div>
                            <div className="flex items-center gap-2">
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

                              <div className="flex items-center gap-1">
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
            {/* ===== End Payments list ===== */}
          </div>
        </SidebarInset>
      </SidebarProvider>

      {/* Delete dialog (unchanged) */}
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
                  <span className="font-medium">{selectedTransaction.services || "—"}</span>
                </div>
                <div className="flex justify-between text-[14px]">
                  <span className="text-neutral-600">Total:</span>
                  <span className="font-bold text-green-600">{formatCurrency(selectedTransaction.totalPaid)}</span>
                </div>
                <div className="flex justify-between text-[14px]">
                  <span className="text-neutral-600">Staff:</span>
                  <span className="font-medium">{selectedTransaction.staff || "—"}</span>
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="text-[14px]">
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDelete} className="text-[14px] bg-red-600 hover:bg-red-700">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Transaction
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </RoleGuard>
  )
}