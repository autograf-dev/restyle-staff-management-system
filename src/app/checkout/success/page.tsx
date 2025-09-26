"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { RoleGuard } from "@/components/role-guard"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  CheckCircle, 
  Calendar as CalendarIcon, 
  ArrowLeft,
  Receipt,
  User as UserIcon,
  Phone,
  Edit3
} from "lucide-react"
import React, { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { useUser } from "@/contexts/user-context"

interface TxItem {
  id: string
  serviceId: string | null
  serviceName: string | null
  price: number | null
  staffName: string | null
  staffTipSplit: number | null
  staffTipCollected: number | null
}

interface TxRow {
  id: string
  paymentDate: string | null
  method: string | null
  subtotal: number | null
  tax: number | null
  tip: number | null
  totalPaid: number | null
  serviceNamesJoined: string | null
  serviceAcuityIds: string | null
  bookingId: string | null
  paymentStaff: string | null
  customerPhone: string | null
  customerFirstName?: string | null
  items?: TxItem[]
}

function CheckoutSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useUser()
  
  const [tx, setTx] = useState<TxRow | null>(null)
  const [items, setItems] = useState<TxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<TxItem | null>(null)
  const [editPrice, setEditPrice] = useState<string>('')
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  // Get URL parameters
  const id = searchParams?.get('id')

  // Fetch transaction details (prefer local cache from previous page)
  const fetchTransaction = async () => {
    if (!id) {
      setError('No transaction ID provided')
      return
    }

    try {
      const cached = typeof window !== 'undefined' ? sessionStorage.getItem(`tx:${id}`) : null
      if (cached) {
        const cachedJson = JSON.parse(cached)
        const t = cachedJson.transaction || {}
        const mapped: TxRow = {
          id: String(t.id || id),
          paymentDate: t.paymentDate || null,
          method: t.method || null,
          subtotal: t.subtotal ?? null,
          tax: t.tax ?? null,
          tip: t.tip ?? null,
          totalPaid: t.totalPaid ?? null,
          serviceNamesJoined: t.serviceNamesJoined || null,
          serviceAcuityIds: t.serviceAcuityIds || null,
          bookingId: t.bookingId || null,
          paymentStaff: t.paymentStaff || null,
          customerPhone: (t.customerPhone || null),
          customerFirstName: (cachedJson.meta && (cachedJson.meta.customerFirstName || cachedJson.meta.customerName)) || null,
        }
        const mappedItems = (cachedJson.items || []).map((i: { id: string; serviceId?: string; serviceName?: string; price?: number; staffName?: string; staffTipSplit?: number; staffTipCollected?: number }) => ({
          id: i.id,
          serviceId: i.serviceId ?? null,
          serviceName: i.serviceName ?? null,
          price: i.price ?? null,
          staffName: i.staffName ?? null,
          staffTipSplit: i.staffTipSplit ?? null,
          staffTipCollected: i.staffTipCollected ?? null,
        }))
        mapped.items = mappedItems
        setTx(mapped)
        setItems(mappedItems)
        return
      }

      // If no cached payload, optionally try a minimal fetch of latest row as a fallback
      const { data: latest, error: latestErr } = await supabase
        .from('Transactions')
        .select('*')
        .order('Payment/Date', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latestErr || !latest) {
        setError('Transaction not found')
        return
      }

      const mappedLatest: TxRow = {
        id: latest['🔒 Row ID'] || String(id),
        paymentDate: latest['Payment/Date'] || null,
        method: latest['Payment/Method'] || null,
        subtotal: latest['Payment/Subtotal'] || null,
        tax: latest['Transaction/Tax'] || null,
        tip: latest['Transaction/Tip'] || null,
        totalPaid: latest['Transaction/Total Paid'] || null,
        serviceNamesJoined: latest['Service/Joined List'] || null,
        serviceAcuityIds: latest['Service/Acuity IDs'] || null,
        bookingId: latest['Booking/ID'] || null,
        paymentStaff: latest['Payment/Staff'] || null,
        customerPhone: latest['Customer/Phone'] || null,
      }
      setTx(mappedLatest)
    } catch (e: unknown) {
      console.error('Error loading transaction:', e)
      setError('Failed to load transaction')
      toast.error('Could not load transaction')
    }
  }

  // Format currency
  const formatCurrency = (amount: number, currency = 'CAD') => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: currency.replace('CA$', 'CAD').replace('US$', 'USD')
    }).format(amount)
  }


  // Calculate tip distribution based on service prices
  const calculateTipDistribution = (items: TxItem[], totalTip: number) => {
    const totalServicePrice = items.reduce((sum, item) => sum + (item.price || 0), 0)
    if (totalServicePrice === 0) return items

    return items.map(item => {
      const servicePrice = item.price || 0
      const tipPercentage = totalServicePrice > 0 ? servicePrice / totalServicePrice : 0
      const tipAmount = totalTip * tipPercentage
      
      return {
        ...item,
        staffTipSplit: tipPercentage,
        staffTipCollected: tipAmount
      }
    })
  }

  // Recalculate totals after price change
  const recalculateTotals = (updatedItems: TxItem[]) => {
    if (!tx) return

    const newSubtotal = updatedItems.reduce((sum, item) => sum + (item.price || 0), 0)
    const tipPercentage = 0.18 // 18% tip
    const newTip = newSubtotal * tipPercentage
    const gstRate = 0.05 // 5% GST
    const pstRate = 0.07 // 7% PST
    const newGst = newSubtotal * gstRate
    const newPst = newSubtotal * pstRate
    const newTotal = newSubtotal + newTip + newGst + newPst

    // Update tip distribution
    const itemsWithUpdatedTips = calculateTipDistribution(updatedItems, newTip)

    setTx(prev => prev ? {
      ...prev,
      subtotal: newSubtotal,
      tip: newTip,
      tax: newGst + newPst,
      totalPaid: newTotal,
      items: itemsWithUpdatedTips
    } : null)

    setItems(itemsWithUpdatedTips)
  }

  // Handle price edit
  const handleEditPrice = (item: TxItem) => {
    setEditingItem(item)
    setEditPrice(item.price?.toString() || '0')
    setIsEditDialogOpen(true)
  }

  // Save price changes
  const handleSavePrice = () => {
    if (!editingItem || !tx) return

    const newPrice = parseFloat(editPrice)
    if (isNaN(newPrice) || newPrice < 0) {
      toast.error('Please enter a valid price')
      return
    }

    const updatedItems = items.map(item => 
      item.id === editingItem.id 
        ? { ...item, price: newPrice }
        : item
    )

    recalculateTotals(updatedItems)
    setIsEditDialogOpen(false)
    setEditingItem(null)
    setEditPrice('')
    toast.success('Price updated successfully')
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await fetchTransaction()
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (loading) {
    return (
      <RoleGuard>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <div className="flex items-center justify-center min-h-screen">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <h2 className="text-xl font-semibold mb-2">Confirming Payment...</h2>
                <p className="text-muted-foreground">Please wait while we verify your payment</p>
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </RoleGuard>
    )
  }

  if (error) {
    return (
      <RoleGuard>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <div className="flex items-center justify-center min-h-screen">
              <div className="text-center max-w-md">
                <div className="text-red-500 mb-4">
                  <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold mb-2 text-red-600">Payment Verification Failed</h2>
                <p className="text-muted-foreground mb-4">{error}</p>
                <div className="space-y-2">
                  <Button onClick={() => router.push('/calendar')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Return to Calendar
                  </Button>
                </div>
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </RoleGuard>
    )
  }

  return (
    <RoleGuard>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
                <div className="flex items-center justify-between w-full px-4">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4" />
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                      <h1 className="text-xl font-semibold">Transaction Complete</h1>
                </div>
              </div>
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-6 p-4 pt-0 max-w-4xl mx-auto">
            
            {/* Success Header */}
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-green-600 mb-1">Thank you{tx?.customerFirstName ? `, ${tx.customerFirstName}` : ''}! Your order is confirmed.</h1>
              <p className="text-muted-foreground">
                Your transaction has been saved. Below are the details of your purchase.
              </p>
            </div>

            {tx && (
              <div className="grid gap-6 md:grid-cols-2">
                
                {/* Payment Details */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Receipt className="h-5 w-5 text-primary" />
                      Transaction Summary
                    </CardTitle>
                    <CardDescription>
                      Saved transaction information
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Transaction ID</span>
                        <span className="font-mono text-sm">{tx.id}</span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Amount Paid</span>
                        <span className="font-semibold text-lg text-green-600">{formatCurrency(tx.totalPaid || 0, 'CAD')}</span>
                      </div>
                      
                      <div className="space-y-2 pt-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span className="font-medium">{formatCurrency(tx.subtotal || 0, 'CAD')}</span>
                        </div>
                        {typeof tx.tip === 'number' && tx.tip > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Tip (18%)</span>
                            <span className="font-medium">{formatCurrency(tx.tip || 0, 'CAD')}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">GST (5%)</span>
                          <span className="font-medium">{formatCurrency((tx.subtotal || 0) * 0.05, 'CAD')}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">PST (7%)</span>
                          <span className="font-medium">{formatCurrency((tx.subtotal || 0) * 0.07, 'CAD')}</span>
                        </div>
                        <div className="border-t pt-2 flex justify-between text-sm font-semibold">
                          <span>Total Due</span>
                          <span className="text-green-600">{formatCurrency(tx.totalPaid || 0, 'CAD')}</span>
                        </div>
                        {tx.method && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Method</span>
                            <span className="font-medium capitalize">{tx.method}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Services and Staff */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CalendarIcon className="h-5 w-5 text-primary" />
                      Services
                    </CardTitle>
                    <CardDescription>
                      Items in this transaction
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      {(tx.items && tx.items.length > 0 ? tx.items : items).map((it) => (
                        <div key={it.id} className="flex items-center justify-between rounded-xl border border-neutral-200 p-3">
                          <div className="min-w-0">
                            <div className="font-medium text-neutral-900 truncate">{it.serviceName || 'Service'}</div>
                            <div className="mt-1 flex items-center gap-2 text-xs text-neutral-600">
                              <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 font-medium text-neutral-700 border border-neutral-200">
                                {it.staffName || tx.paymentStaff || 'Staff'}
                              </span>
                              {it.serviceId && (
                                <span className="text-[11px] text-neutral-400">ID: {it.serviceId}</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-2">
                            <div className="font-semibold text-neutral-900">{formatCurrency(it.price || 0, 'CAD')}</div>
                            {user?.role === 'admin' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditPrice(it)}
                                className="h-6 w-6 p-0 hover:bg-neutral-100"
                              >
                                <Edit3 className="h-3 w-3 text-neutral-500" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Staff Tip Distribution */}
                {tx && (tx.items && tx.items.length > 0 ? tx.items : items).length > 0 && (
                  <Card className="md:col-span-2">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <UserIcon className="h-5 w-5 text-primary" />
                        Staff Tip Distribution
                      </CardTitle>
                      <CardDescription>
                        How tips will be shared among staff members
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {(tx.items && tx.items.length > 0 ? tx.items : items).map((item) => {
                          const totalServicePrice = (tx.items && tx.items.length > 0 ? tx.items : items).reduce((sum, i) => sum + (i.price || 0), 0)
                          const tipPercentage = totalServicePrice > 0 ? ((item.price || 0) / totalServicePrice) * 100 : 0
                          const tipAmount = item.staffTipCollected || 0
                          const totalAmount = (item.price || 0) + tipAmount
                          const staffInitials = (item.staffName || tx.paymentStaff || 'Staff').split(' ').map(n => n[0]).join('').toUpperCase()

                          return (
                            <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-red-800 flex items-center justify-center text-white text-sm font-medium">
                                  {staffInitials}
                                </div>
                                <div>
                                  <div className="font-medium">{item.staffName || tx.paymentStaff || 'Staff'}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {formatCurrency(item.price || 0, 'CAD')} ({tipPercentage.toFixed(1)}% of service subtotal)
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm text-green-600">+{formatCurrency(tipAmount, 'CAD')}</div>
                                <div className="font-semibold">{formatCurrency(totalAmount, 'CAD')}</div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Customer Information */}
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserIcon className="h-5 w-5 text-primary" />
                      Customer Details
                    </CardTitle>
                    <CardDescription>
                      Contact details associated with this transaction
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="flex items-center gap-3">
                        <UserIcon className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{tx.customerFirstName || 'Customer'}</div>
                          <div className="text-sm text-muted-foreground">Name</div>
                        </div>
                      </div>
                      
                      {tx.customerPhone && (
                        <div className="flex items-center gap-3">
                          <Phone className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{tx.customerPhone}</div>
                            <div className="text-sm text-muted-foreground">Phone</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-6">
              <Button onClick={() => router.push('/calendar')} size="lg">
                <CalendarIcon className="h-5 w-5 mr-2" />
                Back to Calendar
              </Button>
              
              <Button variant="outline" onClick={() => router.push('/appointments')} size="lg">
                <Receipt className="h-5 w-5 mr-2" />
                View All Appointments
              </Button>
            </div>

            {/* Additional Information */}
              <Card className="bg-blue-50/50 border-blue-200">
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <h3 className="font-semibold text-blue-900">What happens next?</h3>
                  <p className="text-sm text-blue-700">
                    • A confirmation SMS will be sent if a phone was provided<br />
                    • You&apos;ll receive a reminder 24 hours before your appointment<br />
                    • If you need to reschedule, please contact us at least 24 hours in advance
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Price Edit Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Service Price</DialogTitle>
                <DialogDescription>
                  Update the price for {editingItem?.serviceName || 'this service'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price (CAD)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSavePrice}>
                    Save Changes
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </SidebarInset>
      </SidebarProvider>
    </RoleGuard>
  )
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <RoleGuard>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <div className="flex items-center justify-center min-h-screen">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p>Loading...</p>
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </RoleGuard>
    }>
      <CheckoutSuccessContent />
    </Suspense>
  )
}