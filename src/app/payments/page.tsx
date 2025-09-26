"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { RoleGuard } from "@/components/role-guard"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Trash2, Pencil, Search, Eye, DollarSign, TrendingUp, Users, Calendar } from "lucide-react"
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
  const formatDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString('en-CA') : "—")

  const kpis = useMemo(() => {
    const count = filtered.length
    const revenue = filtered.reduce((sum, r) => sum + Number(r.totalPaid || 0), 0)
    const tips = filtered.reduce((sum, r) => sum + Number(r.tip || 0), 0)
    const avg = count > 0 ? revenue / count : 0
    
    // Calculate unique staff count
    const uniqueStaff = new Set(filtered.map(r => r.staff).filter(Boolean)).size
    
    // Calculate total tip splits (sum of all staff tip splits)
    const totalTipSplits = filtered.reduce((sum, r) => {
      if (r.items) {
        return sum + r.items.reduce((itemSum, item) => itemSum + Number(item.staffTipSplit || 0), 0)
      }
      return sum
    }, 0)
    
    return { count, revenue, tips, avg, uniqueStaff, totalTipSplits }
  }, [filtered])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/transactions?limit=100`)
        const json = await res.json()
        if (!res.ok || !json.ok) throw new Error(json.error || 'Failed to load')
        setRows(json.data || [])
      } catch (e: any) {
        console.error('Error loading payments:', e)
        toast.error('Failed to load payments: ' + e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleDeleteClick = (transaction: TxRow) => {
    setSelectedTransaction(transaction)
    setDeleteDialogOpen(true)
  }

  const onDelete = async () => {
    if (!selectedTransaction) return
    
    const prev = rows
    setRows(p => p.filter(r => r.id !== selectedTransaction.id))
    setDeleteDialogOpen(false)
    
    try {
      const res = await fetch(`/api/transactions?id=${encodeURIComponent(selectedTransaction.id)}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.ok === false) throw new Error(json.error || 'Delete failed')
      toast.success('Transaction deleted')
    } catch (e) {
      setRows(prev)
      toast.error('Could not delete transaction')
    } finally {
      setSelectedTransaction(null)
    }
  }

  return (
    <RoleGuard>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-14 items-center border-b bg-white/60 backdrop-blur px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mx-2 h-4" />
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-[#7b1d1d]" />
                <h1 className="text-[15px] font-semibold tracking-tight">Payments</h1>
              </div>
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-6 p-4 pt-0 bg-neutral-50">
            <div className="w-full">
              <Card className="rounded-2xl border-neutral-200 shadow-none">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-[16px] font-semibold">Payments</CardTitle>
                      <CardDescription className="text-[13px]">Transactions synced from checkout</CardDescription>
                    </div>
                    <div className="relative">
                      <input
                        className="h-9 w-64 rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-[13px] outline-none focus:ring-2 focus:ring-[#7b1d1d]/20"
                        placeholder="Search services, staff, phone, ID"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Enhanced KPI Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                    <Card className="rounded-2xl border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-[12px] font-medium text-neutral-500 uppercase tracking-wide">Total Revenue</div>
                            <div className="text-[24px] font-bold text-neutral-900 mt-1">{formatCurrency(kpis.revenue)}</div>
                          </div>
                          <div className="h-10 w-10 rounded-xl bg-green-100 flex items-center justify-center">
                            <DollarSign className="h-5 w-5 text-green-600" />
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
                          <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
                            <TrendingUp className="h-5 w-5 text-blue-600" />
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
                          <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center">
                            <CreditCard className="h-5 w-5 text-purple-600" />
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
                          <div className="h-10 w-10 rounded-xl bg-orange-100 flex items-center justify-center">
                            <Users className="h-5 w-5 text-orange-600" />
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
                          <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                            <Calendar className="h-5 w-5 text-indigo-600" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  {loading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full rounded-xl" />
                      ))}
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-neutral-200 shadow-sm">
                      {/* Desktop Table Header */}
                      <div className="hidden lg:grid grid-cols-12 bg-gradient-to-r from-neutral-50 to-neutral-100 px-6 py-4 text-[12px] font-semibold text-neutral-700 uppercase tracking-wide">
                        <div className="col-span-3">Service & ID</div>
                        <div className="col-span-2">Staff Name</div>
                        <div className="col-span-2">Customer</div>
                        <div className="col-span-2">Transaction Tips</div>
                        <div className="col-span-2">Total & Method</div>
                        <div className="col-span-1 text-right">Actions</div>
                      </div>
                      <div className="divide-y divide-neutral-100">
                        {filtered.map((r) => (
                          <div key={r.id} className="hidden lg:grid grid-cols-12 items-center px-6 py-4 hover:bg-neutral-50/50 transition-colors">
                            <div className="col-span-3 min-w-0">
                              <div className="truncate text-[14px] font-semibold text-neutral-900">{r.services || '—'}</div>
                              <div className="mt-1 text-[11px] text-neutral-500 font-mono bg-neutral-100 px-2 py-0.5 rounded-md inline-block">
                                {r.serviceIds || r.id}
                              </div>
                            </div>
                            <div className="col-span-2">
                              <div className="flex flex-col gap-1">
                                {r.items && r.items.length > 0 ? (
                                  r.items.map((item, idx) => (
                                    <span key={idx} className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1 text-[12px] font-medium text-neutral-700 shadow-sm">
                                      {item.staffName || '—'}
                                    </span>
                                  ))
                                ) : (
                                  <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1 text-[12px] font-medium text-neutral-700 shadow-sm">
                                    {r.staff || '—'}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="col-span-2 min-w-0">
                              <div className="text-[14px] font-medium text-neutral-900 truncate">{r.customerPhone || '—'}</div>
                              <div className="text-[11px] text-neutral-500 truncate">{r.customerLookup || ''}</div>
                            </div>
                            <div className="col-span-2">
                              <div className="flex flex-col gap-1">
                                <div className="text-[14px] font-bold text-green-600">{formatCurrency(r.tip)}</div>
                                {r.items && r.items.length > 0 && (
                                  <div className="text-[11px] text-neutral-500">
                                    {r.items.map((item, idx) => (
                                      <div key={idx} className="flex justify-between">
                                        <span>{item.staffName}:</span>
                                        <span className="font-medium">{formatCurrency(item.staffTipSplit)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="col-span-2">
                              <div className="text-[16px] font-bold text-neutral-900">{formatCurrency(r.totalPaid)}</div>
                              <div className="text-[12px] text-neutral-500 capitalize">{r.method || '—'}</div>
                              <div className="text-[11px] text-neutral-400">{formatDate(r.paymentDate)}</div>
                            </div>
                            <div className="col-span-1 flex justify-end gap-2">
                              <Link href={`/payments/${encodeURIComponent(r.id)}`} className="inline-flex h-9 items-center rounded-lg border border-neutral-200 bg-white px-3 text-[12px] font-medium hover:bg-neutral-50 hover:border-neutral-300 transition-colors">
                                <Eye className="h-4 w-4 mr-1.5" /> View
                              </Link>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-9 rounded-lg px-3 text-[12px] font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors" 
                                onClick={() => handleDeleteClick(r)}
                              >
                                <Trash2 className="h-4 w-4 mr-1.5" /> Delete
                              </Button>
                            </div>
                          </div>
                        ))}
                        
                        {/* Mobile Card Layout */}
                        {filtered.map((r) => (
                          <div key={`mobile-${r.id}`} className="lg:hidden p-4 border-b border-neutral-100 last:border-b-0">
                            <div className="bg-white rounded-xl border border-neutral-200 p-4 space-y-3">
                              <div className="flex justify-between items-start">
                                <div className="flex-1 min-w-0">
                                  <div className="text-[14px] font-semibold text-neutral-900 truncate">{r.services || '—'}</div>
                                  <div className="text-[11px] text-neutral-500 font-mono bg-neutral-100 px-2 py-0.5 rounded-md inline-block mt-1">
                                    {r.serviceIds || r.id}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[16px] font-bold text-neutral-900">{formatCurrency(r.totalPaid)}</div>
                                  <div className="text-[12px] text-neutral-500 capitalize">{r.method || '—'}</div>
                                </div>
                              </div>
                              
                              <div className="flex flex-wrap gap-2">
                                {r.items && r.items.length > 0 ? (
                                  r.items.map((item, idx) => (
                                    <span key={idx} className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-2 py-1 text-[11px] font-medium text-neutral-700">
                                      {item.staffName || '—'}
                                    </span>
                                  ))
                                ) : (
                                  <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-2 py-1 text-[11px] font-medium text-neutral-700">
                                    {r.staff || '—'}
                                  </span>
                                )}
                              </div>
                              
                              <div className="flex justify-between items-center">
                                <div>
                                  <div className="text-[12px] text-neutral-600">Customer</div>
                                  <div className="text-[13px] font-medium text-neutral-900">{r.customerPhone || '—'}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[12px] text-neutral-600">Tips</div>
                                  <div className="text-[14px] font-bold text-green-600">{formatCurrency(r.tip)}</div>
                                </div>
                              </div>
                              
                              {r.items && r.items.length > 0 && (
                                <div className="bg-neutral-50 rounded-lg p-3">
                                  <div className="text-[11px] font-medium text-neutral-600 mb-2">Staff Tip Splits:</div>
                                  <div className="space-y-1">
                                    {r.items.map((item, idx) => (
                                      <div key={idx} className="flex justify-between text-[11px]">
                                        <span className="text-neutral-600">{item.staffName}:</span>
                                        <span className="font-medium text-neutral-900">{formatCurrency(item.staffTipSplit)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              <div className="flex justify-end gap-2 pt-2">
                                <Link href={`/payments/${encodeURIComponent(r.id)}`} className="inline-flex h-8 items-center rounded-lg border border-neutral-200 bg-white px-3 text-[12px] font-medium hover:bg-neutral-50 hover:border-neutral-300 transition-colors">
                                  <Eye className="h-3.5 w-3.5 mr-1.5" /> View
                                </Link>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-8 rounded-lg px-3 text-[12px] font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors" 
                                  onClick={() => handleDeleteClick(r)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {filtered.length === 0 && (
                          <div className="p-12 text-center">
                            <div className="text-[16px] font-medium text-neutral-500 mb-2">No transactions found</div>
                            <div className="text-[14px] text-neutral-400">Try adjusting your search criteria</div>
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


