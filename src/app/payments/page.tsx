"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { RoleGuard } from "@/components/role-guard"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Trash2, Search, Eye, DollarSign, TrendingUp, Users, Calendar, RefreshCw, ChevronLeft, ChevronRight, CreditCard } from "lucide-react"
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
  const [kpiData, setKpiData] = useState({ totalRevenue: 0, totalTips: 0, transactionsCount: 0, activeStaff: 0, totalTax: 0 })
  const [loadingKpis, setLoadingKpis] = useState(false)
  const [paymentMethodData, setPaymentMethodData] = useState<Array<{ method: string; totalRevenue: number; transactionCount: number }>>([])
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
      return date.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' })
    } catch { return "—" }
  }

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
    } catch { return null }
  }

  const fetchCustomerNames = async (transactions: TxRow[]) => {
    const ids = transactions.map(tx => tx.customerLookup).filter(id => id && id.trim() !== "" && !customerNames[id!]) as string[]
    if (!ids.length) return
    const nameMap: Record<string, string> = {}
    await Promise.allSettled(ids.map(async id => {
      const name = await fetchCustomerFromAPI(id)
      if (name) nameMap[id] = name
    }))
    if (Object.keys(nameMap).length) setCustomerNames(prev => ({ ...prev, ...nameMap }))
  }

  const getCustomerName = (t: TxRow) => {
    if (t.customerLookup && t.customerLookup.trim() !== "") {
      const id = t.customerLookup.trim()
      if (customerNames[id]) return customerNames[id]
      if (id.length > 10 && !id.includes(" ")) {
        fetchCustomerFromAPI(id).then(name => name && setCustomerNames(p => ({ ...p, [id]: name })))
        return "Loading..."
      }
      return id
    }
    if (t.customerPhone) return `Guest (${t.customerPhone})`
    return "Walk-in Guest"
  }

  const getServiceName = (t: TxRow) => {
    if (t.services && t.services.trim() !== "") return t.services.trim()
    if (t.items?.length) {
      const names = t.items.map(i => i.serviceName).filter(Boolean).join(", ")
      if (names) return names
    }
    return "Service Not Specified"
  }

  const getStaffName = (t: TxRow) => {
    if (t.items?.length) {
      const names = t.items.map(i => i.staffName).filter(Boolean).join(", ")
      if (names) return names
    }
    if (t.staff && t.staff.trim() !== "") return t.staff.trim()
    return "Staff Not Assigned"
  }

  const getCustomerPhone = (t: TxRow) => (t.customerPhone && t.customerPhone.trim() !== "" ? t.customerPhone.trim() : "No Phone Provided")

  const kpis = useMemo(() => {
    const count = filtered.length
    const revenue = filtered.reduce((s, r) => s + Number(r.totalPaid || 0), 0)
    const tips = filtered.reduce((s, r) => s + Number(r.tip || 0), 0)
    const avg = count ? revenue / count : 0
    const uniqueStaff = new Set(
      filtered.map(r => r.staff).filter(Boolean).flatMap(s => s!.split(",").map(n => n.trim())).filter(n => n.length > 0)
    ).size
    const totalTipSplits = filtered.reduce((sum, r) => r.items ? sum + r.items.reduce((ss, i) => ss + Number(i.staffTipSplit || 0), 0) : sum, 0)
    return { count, revenue, tips, avg, uniqueStaff, totalTipSplits }
  }, [filtered])

  const loadKpiData = async () => {
    setLoadingKpis(true)
    try {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const end = new Date(new Date(start).getTime() + 86400000).toISOString()
      const q = `&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
      const [a, b, c, d, e] = await Promise.all([
        fetch(`/api/kpi/total-revenue?filter=today${q}`),
        fetch(`/api/kpi/total-tips?filter=today${q}`),
        fetch(`/api/kpi/transactions-count?filter=today${q}`),
        fetch(`/api/kpi/active-staff?filter=today${q}`),
        fetch(`/api/kpi/total-tax?filter=today${q}`)
      ])
      const [ra, rb, rc, rd, re] = await Promise.all([a.json(), b.json(), c.json(), d.json(), e.json()])
      if (ra.ok && rb.ok && rc.ok && rd.ok && re.ok) {
        setKpiData({ totalRevenue: ra.data.totalRevenue, totalTips: rb.data.totalTips, transactionsCount: rc.data.transactionsCount, activeStaff: rd.data.activeStaff, totalTax: re.data.totalTax })
      }
    } finally { setLoadingKpis(false) }
  }

  const loadPaymentMethodData = async () => {
    setLoadingPaymentMethods(true)
    try {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const end = new Date(new Date(start).getTime() + 86400000).toISOString()
      const res = await fetch(`/api/kpi/revenue-by-payment-method?filter=today&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`)
      const data = await res.json()
      if (data.ok) setPaymentMethodData(data.data.paymentMethods)
    } finally { setLoadingPaymentMethods(false) }
  }

  const itemsPerPage = 50
  const loadTransactions = async (page: number = 1) => {
    setLoading(true)
    try {
      const offset = (page - 1) * itemsPerPage
      const res = await fetch(`/api/transactions?limit=${itemsPerPage}&offset=${offset}`)
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to load")
      const txs = json.data || []
      const total = json.total || txs.length
      setRows(txs)
      setTotalCount(total)
      setTotalPages(Math.ceil(total / itemsPerPage))
      setCurrentPage(page)
      await fetchCustomerNames(txs)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      toast.error("Failed to load payments: " + msg)
    } finally { setLoading(false) }
  }

  useEffect(() => {
    loadTransactions(1)
    loadKpiData()
    loadPaymentMethodData()
  }, [])

  const goToPage = (p: number) => { if (p >= 1 && p <= totalPages && p !== currentPage) loadTransactions(p) }
  const resetAndReload = () => { setCurrentPage(1); setQuery(""); loadTransactions(1) }
  const handleDeleteClick = (t: TxRow) => { setSelectedTransaction(t); setDeleteDialogOpen(true) }

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
      const msg = e instanceof Error ? e.message : "Unknown error"
      toast.error(`Could not delete transaction: ${msg}`)
    } finally { setSelectedTransaction(null) }
  }

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
            {/* ========= OVERVIEW (single, flat card — minimal padding/borders) ========= */}
            <Card className="border-neutral-200 shadow-none">
              <CardHeader className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#601625] rounded-full" />
                  <h3 className="text-sm font-semibold text-gray-900">Overview</h3>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {/* Two horizontal panels inside ONE card */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* KPIs panel */}
                  <section className="rounded-xl border border-neutral-200 bg-white p-3 lg:p-4">
                    <header className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">Key Performance</h4>
                        <p className="text-xs text-gray-500">Today</p>
                      </div>
                      <div className="h-8 w-8 rounded-lg bg-[#601625]/10 flex items-center justify-center">
                        <TrendingUp className="h-4 w-4 text-[#601625]" />
                      </div>
                    </header>
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                      <div className="rounded-lg border border-neutral-200 p-3">
                        <div className="text-[11px] text-neutral-500 font-medium uppercase">Revenue</div>
                        <div className="mt-1 text-[20px] font-bold text-neutral-900">
                          {loadingKpis ? <div className="h-5 w-20 bg-gray-200 rounded animate-pulse" /> : formatCurrency(kpiData.totalRevenue)}
                        </div>
                        <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-neutral-600">
                          <DollarSign className="h-3 w-3 text-[#601625]" /> Today
                        </div>
                      </div>
                      <div className="rounded-lg border border-neutral-200 p-3">
                        <div className="text-[11px] text-neutral-500 font-medium uppercase">Tips</div>
                        <div className="mt-1 text-[20px] font-bold text-neutral-900">
                          {loadingKpis ? <div className="h-5 w-16 bg-gray-200 rounded animate-pulse" /> : formatCurrency(kpiData.totalTips)}
                        </div>
                        <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-neutral-600">
                          <TrendingUp className="h-3 w-3 text-[#751a29]" /> Today
                        </div>
                      </div>
                      <div className="rounded-lg border border-neutral-200 p-3">
                        <div className="text-[11px] text-neutral-500 font-medium uppercase">Transactions</div>
                        <div className="mt-1 text-[20px] font-bold text-neutral-900">
                          {loadingKpis ? <div className="h-5 w-12 bg-gray-200 rounded animate-pulse" /> : kpiData.transactionsCount}
                        </div>
                        <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-neutral-600">
                          <CreditCard className="h-3 w-3 text-[#601625]" /> Today
                        </div>
                      </div>
                      <div className="rounded-lg border border-neutral-200 p-3">
                        <div className="text-[11px] text-neutral-500 font-medium uppercase">Active Staff</div>
                        <div className="mt-1 text-[20px] font-bold text-neutral-900">
                          {loadingKpis ? <div className="h-5 w-10 bg-gray-200 rounded animate-pulse" /> : kpiData.activeStaff}
                        </div>
                        <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-neutral-600">
                          <Users className="h-3 w-3 text-[#751a29]" /> Today
                        </div>
                      </div>
                      <div className="rounded-lg border border-neutral-200 p-3">
                        <div className="text-[11px] text-neutral-500 font-medium uppercase">Tax</div>
                        <div className="mt-1 text-[20px] font-bold text-neutral-900">
                          {loadingKpis ? <div className="h-5 w-20 bg-gray-200 rounded animate-pulse" /> : formatCurrency(kpiData.totalTax)}
                        </div>
                        <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-neutral-600">
                          <Calendar className="h-3 w-3 text-[#601625]" /> Today
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Revenue-by-method panel */}
                  <section className="rounded-xl border border-neutral-200 bg-white p-3 lg:p-4">
                    <header className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">Revenue by Payment Method</h4>
                        <p className="text-xs text-gray-500">Today</p>
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
                        {paymentMethodData.map((m, i) => (
                          <div key={m.method} className="rounded-lg border border-neutral-200 p-3 hover:shadow-sm transition-shadow">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-neutral-600 capitalize truncate">{m.method}</span>
                              <span className={`w-2.5 h-2.5 rounded-full ${i===0?'bg-green-500':i===1?'bg-blue-500':i===2?'bg-purple-500':i===3?'bg-orange-500':'bg-gray-500'}`} />
                            </div>
                            <div className="text-lg font-bold text-neutral-900">{formatCurrency(m.totalRevenue)}</div>
                            <div className="text-[11px] text-neutral-500 mt-0.5">
                              {m.transactionCount} transaction{m.transactionCount !== 1 ? "s" : ""}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">No payment data for today</div>
                    )}
                  </section>
                </div>
              </CardContent>
            </Card>
            {/* ========= END OVERVIEW ========= */}

            {/* ========= PAYMENTS LIST (separate card below) ========= */}
            <Card className="border-neutral-200 shadow-none">
              <CardContent className="pt-4">
                {loading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-gray-200 shadow-lg bg-white">
                    {/* Table header */}
                    <div className="hidden lg:grid grid-cols-12 bg-white border-b-2 border-gray-100 px-6 py-4">
                      <div className="col-span-3">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-[#601625] rounded-full" />
                          <span className="text-sm font-semibold text-gray-700 tracking-wide">SERVICE</span>
                        </div>
                      </div>
                      <div className="col-span-2"><span className="text-sm font-semibold text-gray-700 tracking-wide">STAFF</span></div>
                      <div className="col-span-2"><span className="text-sm font-semibold text-gray-700 tracking-wide">CUSTOMER</span></div>
                      <div className="col-span-2"><span className="text-sm font-semibold text-gray-700 tracking-wide">TIPS</span></div>
                      <div className="col-span-2"><span className="text-sm font-semibold text-gray-700 tracking-wide">PAYMENT</span></div>
                      <div className="col-span-1 text-right"><span className="text-sm font-semibold text-gray-700 tracking-wide">ACTIONS</span></div>
                    </div>

                    <div className="divide-y divide-gray-100">
                      {filtered.map((r, index) => (
                        <div key={r.id} className={`hidden lg:grid grid-cols-12 items-center px-6 py-6 hover:bg-gray-50/50 transition-all duration-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                          {/* Service */}
                          <div className="col-span-3 min-w-0">
                            <div className="flex items-center gap-4">
                              <div className="w-2 h-2 bg-[#601625] rounded-full flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="text-base font-semibold text-gray-900 truncate leading-tight">{getServiceName(r)}</div>
                                <div className="text-xs text-gray-500 mt-1">Transaction #{r.id.slice(-8)}</div>
                              </div>
                            </div>
                          </div>
                          {/* Staff */}
                          <div className="col-span-2">
                            <div className="flex flex-col gap-2">
                              {r.items?.length ? r.items.map((item, i) => (
                                <div key={i} className="inline-flex items-center rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 w-fit">
                                  <span className="truncate">{item.staffName || "Staff Not Assigned"}</span>
                                </div>
                              )) : (
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
                                {loadingCustomers && getCustomerName(r) === "Loading..." && <span className="ml-2 text-xs text-gray-500">⏳</span>}
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
                          {/* Actions */}
                          <div className="col-span-1 flex justify-end gap-2">
                            <Link href={`/payments/${encodeURIComponent(r.id)}`} className="inline-flex h-9 items-center rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-sm">
                              <Eye className="h-4 w-4 mr-1.5" /> View
                            </Link>
                            <Button variant="outline" size="sm" className="h-9 rounded-lg px-3 text-sm font-medium text-red-700 border-red-300 hover:bg-red-50 hover:border-red-400 transition-all duration-200 shadow-sm" onClick={() => handleDeleteClick(r)}>
                              <Trash2 className="h-4 w-4 mr-1.5" /> Delete
                            </Button>
                          </div>
                        </div>
                      ))}

                      {/* Mobile cards */}
                      {filtered.map(r => (
                        <div key={`m-${r.id}`} className="lg:hidden p-4 border-b border-gray-100 last:border-b-0">
                          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4 shadow-sm">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-2 h-2 bg-[#601625] rounded-full" />
                                <div>
                                  <div className="text-base font-semibold text-gray-900">{getServiceName(r)}</div>
                                  <div className="text-xs text-gray-500 mt-1">Transaction #{r.id.slice(-8)}</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xl font-bold text-gray-900">{formatCurrency(r.totalPaid)}</div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5" />
                                    {r.method || "Unknown"}
                                  </span>
                                  <span className="text-xs text-gray-500 font-mono">{formatDate(r.paymentDate)}</span>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Staff</div>
                                {r.items?.length ? (
                                  <div className="space-y-2">
                                    {r.items.map((it, i) => (
                                      <div key={i} className="inline-flex items-center rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 w-fit">
                                        <span className="truncate">{it.staffName || "Staff Not Assigned"}</span>
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
                                  {loadingCustomers && getCustomerName(r) === "Loading..." && <span className="ml-2 text-xs text-gray-500">⏳</span>}
                                </div>
                                <div className="mt-2">
                                  <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-600/20">
                                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-1.5" />
                                    {getCustomerPhone(r)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                              <div>
                                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Tips</div>
                                <div className="text-lg font-bold text-[#751a29]">{formatCurrency(r.tip)}</div>
                              </div>
                              <div className="flex gap-2">
                                <Link href={`/payments/${encodeURIComponent(r.id)}`} className="inline-flex h-9 items-center rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-sm">
                                  <Eye className="h-4 w-4 mr-1.5" /> View
                                </Link>
                                <Button variant="outline" size="sm" className="h-9 rounded-lg px-3 text-sm font-medium text-red-700 border-red-300 hover:bg-red-50 hover:border-red-400 transition-all duration-200 shadow-sm" onClick={() => handleDeleteClick(r)}>
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
                              Showing <span className="font-semibold text-gray-900">{((currentPage - 1) * itemsPerPage) + 1}</span> to <span className="font-semibold text-gray-900">{Math.min(currentPage * itemsPerPage, totalCount)}</span> of <span className="font-semibold text-gray-900">{totalCount.toLocaleString()}</span> transactions
                            </div>
                            <div className="flex items-center gap-2">
                              <Button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} variant="outline" size="sm" className="h-10 px-4 text-sm font-medium border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed">
                                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                              </Button>
                              <div className="flex items-center gap-1">
                                {currentPage > 3 && (
                                  <>
                                    <Button onClick={() => goToPage(1)} variant="outline" size="sm" className="h-10 w-10 text-sm font-semibold border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400">1</Button>
                                    {currentPage > 4 && <span className="text-gray-400 px-2">...</span>}
                                  </>
                                )}
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                  const startPage = Math.max(1, currentPage - 2)
                                  const page = startPage + i
                                  if (page > totalPages) return null
                                  return (
                                    <Button key={page} onClick={() => goToPage(page)} variant={page === currentPage ? "default" : "outline"} size="sm" className={`h-10 w-10 text-sm font-semibold transition-all duration-200 ${page === currentPage ? "bg-[#601625] text-white hover:bg-[#751a29] shadow-sm" : "border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"}`}>
                                      {page}
                                    </Button>
                                  )
                                })}
                                {currentPage < totalPages - 2 && (
                                  <>
                                    {currentPage < totalPages - 3 && <span className="text-gray-400 px-2">...</span>}
                                    <Button onClick={() => goToPage(totalPages)} variant="outline" size="sm" className="h-10 w-10 text-sm font-semibold border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400">
                                      {totalPages}
                                    </Button>
                                  </>
                                )}
                              </div>
                              <Button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} variant="outline" size="sm" className="h-10 px-4 text-sm font-medium border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed">
                                Next <ChevronRight className="h-4 w-4 ml-1" />
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
            {/* ========= END PAYMENTS LIST ========= */}
          </div>
        </SidebarInset>
      </SidebarProvider>

      {/* Delete dialog (unchanged) */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[18px] font-semibold">Delete Transaction</DialogTitle>
            <DialogDescription className="text-[14px] text-neutral-600">Are you sure you want to delete this transaction? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <div className="py-4">
              <div className="bg-neutral-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-[14px]"><span className="text-neutral-600">Transaction ID:</span><span className="font-mono text-[12px]">{selectedTransaction.id}</span></div>
                <div className="flex justify-between text-[14px]"><span className="text-neutral-600">Services:</span><span className="font-medium">{selectedTransaction.services || "—"}</span></div>
                <div className="flex justify-between text-[14px]"><span className="text-neutral-600">Total:</span><span className="font-bold text-green-600">{formatCurrency(selectedTransaction.totalPaid)}</span></div>
                <div className="flex justify-between text-[14px]"><span className="text-neutral-600">Staff:</span><span className="font-medium">{selectedTransaction.staff || "—"}</span></div>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="text-[14px]">Cancel</Button>
            <Button variant="destructive" onClick={onDelete} className="text-[14px] bg-red-600 hover:bg-red-700">
              <Trash2 className="h-4 w-4 mr-2" /> Delete Transaction
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </RoleGuard>
  )
}