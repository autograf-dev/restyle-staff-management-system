"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { RoleGuard } from "@/components/role-guard"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { 
  CreditCard, 
  Save, 
  Trash2, 
  ArrowLeft, 
  Receipt, 
  Calendar as CalendarIcon, 
  User as UserIcon, 
  Phone,
  DollarSign,
  Edit3,
  X
} from "lucide-react"

interface TransactionData {
  id: string
  paymentDate: string | null
  method: string | null
  subtotal: number | null
  tax: number | null
  tip: number | null
  totalPaid: number | null
  bookingId: string | null
  customerPhone: string | null
  customerLookup: string | null
  customerName?: string | null
  // Remove concatenated fields - use items array for services and staff
  items: Array<{
    id: string
    paymentId: string
    serviceId: string | null
    serviceName: string | null
    price: number | null
    staffName: string | null
    staffTipSplit: number | null
    staffTipCollected: number | null
  }>
}

export default function PaymentDetailPage() {
  const params = useParams()
  const id = String(params?.id || "")
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<TransactionData | null>(null)
  
  // Edit dialog states
  const [editCustomerDialog, setEditCustomerDialog] = useState(false)
  const [editPhoneDialog, setEditPhoneDialog] = useState(false)
  const [editPricesDialog, setEditPricesDialog] = useState(false)
  const [editItemDialog, setEditItemDialog] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  
  // Form states
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [subtotal, setSubtotal] = useState(0)
  const [tax, setTax] = useState(0)
  const [tip, setTip] = useState(0)
  const [totalPaid, setTotalPaid] = useState(0)

  const formatCurrency = (n?: number | null) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Number(n || 0))

  // Function to fetch customer name from GHL contacts API (only when customerLookup is an ID)
  const fetchCustomerName = async (customerLookupId: string) => {
    // Check if customerLookupId looks like an ID (contains letters/numbers, not just a name)
    // If it's already a name like "John Doe" or "Guest", don't call the API
    const isLikelyId = /^[a-zA-Z0-9]{8,}$/.test(customerLookupId) && 
                      !customerLookupId.toLowerCase().includes('guest') &&
                      !customerLookupId.includes(' ')
    
    if (!isLikelyId) {
      // It's already a name, return as is
      return customerLookupId
    }
    
    try {
      const res = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/getContact?id=${encodeURIComponent(customerLookupId)}`)
      if (!res.ok) throw new Error(`Failed to fetch contact ${customerLookupId}`)
      const json = await res.json()
      
      if (json?.contact) {
        const contact = json.contact
        return contact.contactName || 
          contact.name || 
          `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 
          'Unknown Customer'
      }
      return 'Unknown Customer'
    } catch (error) {
      console.error(`Error fetching customer name for ID ${customerLookupId}:`, error)
      return 'Unknown Customer'
    }
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        console.log('Loading transaction with ID:', id)
        const res = await fetch(`/api/transactions/${encodeURIComponent(id)}`)
        console.log('Response status:', res.status)
        const json = await res.json()
        console.log('Response data:', json)
        if (!res.ok || !json.ok) throw new Error(json.error || 'Failed to load')
        
        const transactionData = json.data
        
        // Fetch customer name if customerLookup exists
        if (transactionData.customerLookup) {
          const customerName = await fetchCustomerName(transactionData.customerLookup)
          transactionData.customerName = customerName
        }
        
        setData(transactionData)
        
        // Initialize form states
        setCustomerName(transactionData.customerName || '')
        setCustomerPhone(transactionData.customerPhone || '')
        setSubtotal(Number(transactionData.subtotal) || 0)
        setTax(Number(transactionData.tax) || 0)
        setTip(Number(transactionData.tip) || 0)
        setTotalPaid(Number(transactionData.totalPaid) || 0)
      } catch (e: unknown) {
        console.error('Error loading transaction:', e)
        const errorMessage = e instanceof Error ? e.message : 'Unknown error'
        toast.error(`Failed to load transaction: ${errorMessage}`)
      } finally {
        setLoading(false)
      }
    }
    if (id) load()
  }, [id])

  const save = async () => {
    if (!data) return
    setSaving(true)
    try {
      // Only save basic transaction fields - service/staff data is in Transaction Items
      const payload = { method: data.method }
      const res = await fetch(`/api/transactions/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.ok === false) throw new Error(json.error || 'Save failed')
      toast.success('Saved')
    } catch (e: unknown) {
      console.error('Error saving changes:', e)
      toast.error('Could not save changes')
    } finally {
      setSaving(false)
    }
  }

  const del = async () => {
    try {
      const res = await fetch(`/api/transactions?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.ok === false) throw new Error(json.error || 'Delete failed')
      toast.success('Transaction deleted')
      router.push('/payments')
    } catch (e: unknown) {
      console.error('Error deleting transaction:', e)
      toast.error('Could not delete transaction')
    }
  }

  // Edit functions
  const saveCustomerName = async () => {
    if (!data) return
    setSaving(true)
    try {
      const res = await fetch(`/api/transactions/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName })
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.ok === false) throw new Error(json.error || 'Save failed')
      
      setData({ ...data, customerName })
      setEditCustomerDialog(false)
      toast.success('Customer name updated')
    } catch (e: unknown) {
      console.error('Error saving customer name:', e)
      toast.error('Could not save customer name')
    } finally {
      setSaving(false)
    }
  }

  const saveCustomerPhone = async () => {
    if (!data) return
    setSaving(true)
    try {
      const res = await fetch(`/api/transactions/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerPhone })
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.ok === false) throw new Error(json.error || 'Save failed')
      
      setData({ ...data, customerPhone })
      setEditPhoneDialog(false)
      toast.success('Customer phone updated')
    } catch (e: unknown) {
      console.error('Error saving customer phone:', e)
      toast.error('Could not save customer phone')
    } finally {
      setSaving(false)
    }
  }

  const savePrices = async () => {
    if (!data) return
    setSaving(true)
    try {
      // Update main transaction with current calculated values
      const res = await fetch(`/api/transactions/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          subtotal, 
          tax, 
          tip, 
          totalPaid 
        })
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.ok === false) throw new Error(json.error || 'Save failed')
      
      setData({ 
        ...data, 
        subtotal, 
        tax, 
        tip, 
        totalPaid
      })
      setEditPricesDialog(false)
      toast.success('Transaction totals updated')
    } catch (e: unknown) {
      console.error('Error saving prices:', e)
      toast.error('Could not save prices')
    } finally {
      setSaving(false)
    }
  }

  const saveItem = async () => {
    if (!editingItem) return
    setSaving(true)
    try {
      // Calculate tip for this item (15% of item price) and round to 2 decimal places
      const itemTip = Math.round((Number(editingItem.price) || 0) * 0.15 * 100) / 100
      editingItem.staffTipCollected = itemTip
      
      const res = await fetch(`/api/transaction-items/${encodeURIComponent(editingItem.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceName: editingItem.serviceName,
          price: editingItem.price,
          staffName: editingItem.staffName,
          staffTipCollected: itemTip
        })
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.ok === false) throw new Error(json.error || 'Save failed')
      
      // Update the item in the data
      const updatedItems = data?.items.map(item => 
        item.id === editingItem.id ? editingItem : item
      ) || []
      
      // Recalculate totals from all items
      const newSubtotal = updatedItems.reduce((sum, item) => sum + (Number(item.price) || 0), 0)
      const newTax = Math.round(newSubtotal * 0.13 * 100) / 100
      const newTip = Math.round(newSubtotal * 0.15 * 100) / 100
      const newTotal = newSubtotal + newTax + newTip
      
      // Update main transaction with new totals
      const transactionRes = await fetch(`/api/transactions/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subtotal: newSubtotal,
          tax: newTax,
          tip: newTip,
          totalPaid: newTotal
        })
      })
      
      if (!transactionRes.ok) {
        throw new Error('Failed to update transaction totals')
      }
      
      setData({ 
        ...data!, 
        items: updatedItems,
        subtotal: newSubtotal,
        tax: newTax,
        tip: newTip,
        totalPaid: newTotal
      })
      
      setEditItemDialog(false)
      setEditingItem(null)
      toast.success('Service item and totals updated')
    } catch (e: unknown) {
      console.error('Error saving item:', e)
      toast.error('Could not save service item')
    } finally {
      setSaving(false)
    }
  }

  const openEditItem = (item: any) => {
    setEditingItem({ ...item })
    setEditItemDialog(true)
  }

  // Auto-calculate tip when editing item price changes
  useEffect(() => {
    if (editingItem && editingItem.price !== undefined) {
      const itemTip = Math.round((Number(editingItem.price) || 0) * 0.15 * 100) / 100
      if (editingItem.staffTipCollected !== itemTip) {
        setEditingItem((prev: any) => ({ ...prev, staffTipCollected: itemTip }))
      }
    }
  }, [editingItem?.price])

  // Auto-calculate tax, tips, and total when subtotal or items change
  useEffect(() => {
    if (!data?.items) return
    
    // Calculate total from all service items
    const totalFromItems = data.items.reduce((sum, item) => sum + (Number(item.price) || 0), 0)
    
    // Calculate tax (13% HST for Canada) and round to 2 decimal places
    const calculatedTax = Math.round(totalFromItems * 0.13 * 100) / 100
    
    // Calculate tip (15% of subtotal) and round to 2 decimal places
    const calculatedTip = Math.round(totalFromItems * 0.15 * 100) / 100
    
    // Update tax and tip
    setTax(calculatedTax)
    setTip(calculatedTip)
    
    // Calculate total
    const calculatedTotal = totalFromItems + calculatedTax + calculatedTip
    setTotalPaid(calculatedTotal)
    setSubtotal(totalFromItems)
  }, [data?.items])

  if (loading) {
    return (
      <RoleGuard>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <div className="flex items-center justify-center min-h-screen">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p>Loading payment details...</p>
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </RoleGuard>
    )
  }

  if (!data) {
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
                <h2 className="text-xl font-semibold mb-2 text-red-600">Payment Not Found</h2>
                <p className="text-muted-foreground mb-4">The requested payment could not be found.</p>
                <Button onClick={() => router.push('/payments')}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Payments
                </Button>
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
        <SidebarInset className="font-sans">
          <header className="flex flex-col gap-2 px-4 py-4">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4" />
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-[#601625]" />
                  <h1 className="text-xl font-semibold">Payment Details</h1>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground ml-[4.5rem]">Complete transaction information and service details</p>
          </header>

          <div className="flex flex-1 flex-col gap-8 p-6 pt-0" style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
            
            {/* Transaction Overview Card */}
            <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/50">
              <CardContent className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-[#601625] rounded-full"></div>
                      <h2 className="text-3xl font-bold text-gray-900">Transaction #{data.id.slice(-8)}</h2>
                    </div>
                    <p className="text-sm text-gray-600 ml-6">
                      {data.paymentDate ? new Date(data.paymentDate).toLocaleDateString('en-CA', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : 'No date available'}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="text-4xl font-bold text-[#601625]">{formatCurrency(data.totalPaid)}</div>
                    <div className="text-sm font-medium text-gray-600">Total Amount</div>
                  </div>
                    </div>
                    
                {/* Payment Method and Status */}
                <div className="flex items-center gap-6 mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Payment Method</span>
                      </div>
                  <div className="inline-flex items-center rounded-full bg-green-50 border border-green-200 px-4 py-2 text-sm font-semibold text-green-800">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2.5"></div>
                    {data.method ? data.method.charAt(0).toUpperCase() + data.method.slice(1) : 'Unknown'}
                        </div>
                    </div>
                    
                {/* Financial Breakdown */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-6 bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-2xl border border-gray-200/50">
                  <div className="text-center relative group bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200">
                    <div className="text-xl font-bold text-gray-900 mb-1">{formatCurrency(data.subtotal)}</div>
                    <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">Subtotal</div>
                    <Dialog open={editPricesDialog} onOpenChange={setEditPricesDialog}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="absolute top-2 right-2 h-7 w-7 p-0 opacity-70 hover:opacity-100 transition-opacity hover:bg-gray-100 rounded-full">
                          <Edit3 className="h-3.5 w-3.5 text-gray-500" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                         <DialogHeader>
                           <DialogTitle>Edit Prices</DialogTitle>
                           <p className="text-sm text-gray-500 mt-2">
                             Subtotal is calculated from all service items. Tax (13%) and Tips (15%) are automatically calculated from subtotal.
                           </p>
                         </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="subtotal">Subtotal (Calculated from service items)</Label>
                            <Input
                              id="subtotal"
                              type="number"
                              step="0.01"
                              value={subtotal}
                              readOnly
                              className="bg-gray-50"
                              placeholder="0.00"
                            />
                          </div>
                           <div>
                             <Label htmlFor="tax">Tax (Auto-calculated 13%)</Label>
                             <Input
                               id="tax"
                               type="number"
                               step="0.01"
                               value={tax}
                               readOnly
                               className="bg-gray-50"
                               placeholder="0.00"
                             />
                           </div>
                           <div>
                             <Label htmlFor="tip">Tips (Auto-calculated 15%)</Label>
                             <Input
                               id="tip"
                               type="number"
                               step="0.01"
                               value={tip}
                               readOnly
                               className="bg-gray-50"
                               placeholder="0.00"
                             />
                           </div>
                          <div>
                            <Label htmlFor="totalPaid">Total (Auto-calculated)</Label>
                            <Input
                              id="totalPaid"
                              type="number"
                              step="0.01"
                              value={totalPaid}
                              readOnly
                              className="bg-gray-50"
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setEditPricesDialog(false)}>
                              Cancel
                            </Button>
                            <Button onClick={savePrices} disabled={saving}>
                              {saving ? 'Saving...' : 'Save'}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <div className="text-center relative group bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200">
                    <div className="text-xl font-bold text-gray-900 mb-1">{formatCurrency(data.tax)}</div>
                    <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">Tax</div>
                  </div>
                  <div className="text-center relative group bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200">
                    <div className="text-xl font-bold text-[#751a29] mb-1">{formatCurrency(data.tip)}</div>
                    <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">Tips</div>
                  </div>
                  <div className="text-center relative group bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200">
                    <div className="text-xl font-bold text-[#601625] mb-1">{formatCurrency(data.totalPaid)}</div>
                    <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">Total</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

            <div className="grid gap-8 lg:grid-cols-2">

              {/* Services and Staff */}
              <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/50">
                <CardHeader className="pb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-3 h-3 bg-[#601625] rounded-full"></div>
                    <div>
                      <CardTitle className="text-xl font-bold text-gray-900">Services & Staff</CardTitle>
                      <CardDescription className="text-sm text-gray-600 mt-1">
                        Items and staff members for this transaction
                  </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-6">
                  <div className="space-y-4">
                    {(data.items || []).map((item: Record<string, unknown>, index: number) => (
                      <div key={String(item.id)} className="bg-gradient-to-r from-white to-gray-50/50 rounded-xl border border-gray-200/50 p-5 hover:shadow-lg transition-all duration-200 group">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-2.5 h-2.5 bg-[#601625] rounded-full flex-shrink-0"></div>
                              <div className="text-lg font-bold text-gray-900 truncate">
                                {String(item.serviceName) || 'Service Not Specified'}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center rounded-lg bg-gray-100 border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 w-fit">
                                {String(item.staffName) || 'Staff Not Assigned'}
                            </span>
                          </div>
                        </div>
                          <div className="text-right ml-4 relative">
                            <div className="text-2xl font-bold text-gray-900 mb-1">{formatCurrency(Number(item.price))}</div>
                            {item.staffTipCollected != null && Number(item.staffTipCollected) > 0 && (
                              <div className="text-sm text-[#751a29] font-semibold">
                                Tip: {formatCurrency(Number(item.staffTipCollected))}
                              </div>
                            )}
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="absolute -top-2 -right-2 h-7 w-7 p-0 opacity-70 hover:opacity-100 transition-opacity hover:bg-gray-100 rounded-full"
                              onClick={() => openEditItem(item)}
                            >
                              <Edit3 className="h-3.5 w-3.5 text-gray-500" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {(!data.items || data.items.length === 0) && (
                      <div className="text-center py-8 text-gray-500">
                        <div className="text-sm">No services found for this transaction</div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Customer Information */}
              <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/50">
                <CardHeader className="pb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-3 h-3 bg-[#751a29] rounded-full"></div>
                    <div>
                      <CardTitle className="text-xl font-bold text-gray-900">Customer Details</CardTitle>
                      <CardDescription className="text-sm text-gray-600 mt-1">
                        Contact information for this transaction
                  </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-6">
                  <div className="space-y-5">
                    <div className="bg-gradient-to-r from-white to-gray-50/50 rounded-xl border border-gray-200/50 p-5 hover:shadow-lg transition-all duration-200">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-[#601625]/10 rounded-full flex items-center justify-center">
                      <UserIcon className="h-5 w-5 text-[#601625]" />
                        </div>
                        <div className="flex-1">
                          <div className="text-lg font-bold text-gray-900">
                            {data.customerName || 'Unknown Customer'}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">Customer Name</div>
                        </div>
                        <Dialog open={editCustomerDialog} onOpenChange={setEditCustomerDialog}>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-gray-100 rounded-full">
                              <Edit3 className="h-4 w-4 text-gray-500" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                              <DialogTitle>Edit Customer Name</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                      <div>
                                <Label htmlFor="customerName">Customer Name</Label>
                                <Input
                                  id="customerName"
                                  value={customerName}
                                  onChange={(e) => setCustomerName(e.target.value)}
                                  placeholder="Enter customer name"
                                />
                              </div>
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setEditCustomerDialog(false)}>
                                  Cancel
                                </Button>
                                <Button onClick={saveCustomerName} disabled={saving}>
                                  {saving ? 'Saving...' : 'Save'}
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                    
                    {data.customerPhone && (
                      <div className="bg-gradient-to-r from-white to-gray-50/50 rounded-xl border border-gray-200/50 p-5 hover:shadow-lg transition-all duration-200">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <Phone className="h-5 w-5 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <div className="text-lg font-bold text-gray-900">{data.customerPhone}</div>
                            <div className="text-sm text-gray-600 mt-1">Phone Number</div>
                          </div>
                          <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700">
                            <div className="w-2 h-2 bg-blue-600 rounded-full mr-2"></div>
                            Contact
                          </span>
                          <Dialog open={editPhoneDialog} onOpenChange={setEditPhoneDialog}>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-gray-100 rounded-full">
                                <Edit3 className="h-4 w-4 text-gray-500" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                              <DialogHeader>
                                <DialogTitle>Edit Phone Number</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                        <div>
                                  <Label htmlFor="customerPhone">Phone Number</Label>
                                  <Input
                                    id="customerPhone"
                                    value={customerPhone}
                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                    placeholder="Enter phone number"
                                  />
                                </div>
                                <div className="flex justify-end gap-2">
                                  <Button variant="outline" onClick={() => setEditPhoneDialog(false)}>
                                    Cancel
                                  </Button>
                                  <Button onClick={saveCustomerPhone} disabled={saving}>
                                    {saving ? 'Saving...' : 'Save'}
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    )}

                    {data.bookingId && (
                      <div className="bg-gradient-to-r from-white to-gray-50/50 rounded-xl border border-gray-200/50 p-5 hover:shadow-lg transition-all duration-200">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-[#601625]/10 rounded-full flex items-center justify-center">
                            <CalendarIcon className="h-5 w-5 text-[#601625]" />
                          </div>
                          <div className="flex-1">
                            <div className="text-lg font-bold text-gray-900 font-mono">
                              {data.bookingId}
                            </div>
                            <div className="text-sm text-gray-600 mt-1">Booking ID</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

              {/* Edit Section */}
            <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/50">
              <CardHeader className="pb-6">
                <div className="flex items-center gap-4">
                  <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                  <div>
                    <CardTitle className="text-xl font-bold text-gray-900">Edit Transaction</CardTitle>
                    <CardDescription className="text-sm text-gray-600 mt-1">
                      Modify payment method and other details
                  </CardDescription>
                  </div>
                </div>
                </CardHeader>
              <CardContent className="px-6">
                <div className="grid gap-8 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Payment Method</label>
                      <Select value={data.method || ''} onValueChange={(value) => setData({ ...data, method: value })}>
                      <SelectTrigger className="h-12 rounded-xl border-gray-300 focus:ring-[#601625]/20 focus:border-[#601625] bg-white shadow-sm">
                          <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="debit">Debit</SelectItem>
                          <SelectItem value="visa">Visa</SelectItem>
                          <SelectItem value="mastercard">Mastercard</SelectItem>
                        <SelectItem value="amex">American Express</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  <div className="flex items-end">
                    <div className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                      Changes will be saved to the database
                    </div>
                  </div>
                  </div>
                
                <div className="flex justify-end gap-4 pt-8 border-t border-gray-200 mt-8">
                  <Button 
                    variant="outline" 
                    className="h-12 px-8 text-sm font-semibold text-red-700 border-red-300 hover:bg-red-50 hover:border-red-400 transition-all duration-200 rounded-xl" 
                    onClick={del}
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> 
                    Delete Transaction
                    </Button>
                  <Button 
                    onClick={save} 
                    disabled={saving} 
                    className="h-12 px-8 text-sm font-semibold bg-[#601625] hover:bg-[#751a29] text-white transition-all duration-200 rounded-xl shadow-lg"
                  >
                    <Save className="h-4 w-4 mr-2" /> 
                    {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

            {/* Action Buttons */}
            <div className="flex justify-center items-center pt-8">
              <Button 
                onClick={() => router.push('/payments')} 
                size="lg"
                className="h-14 px-10 text-base font-semibold bg-[#601625] hover:bg-[#751a29] text-white transition-all duration-200 rounded-xl shadow-lg hover:shadow-xl"
              >
                <ArrowLeft className="h-5 w-5 mr-3" />
                Back to Payments
              </Button>
            </div>

            {/* Service Item Edit Dialog */}
            <Dialog open={editItemDialog} onOpenChange={setEditItemDialog}>
               <DialogContent className="sm:max-w-md">
                 <DialogHeader>
                   <DialogTitle>Edit Service Item</DialogTitle>
                   <p className="text-sm text-gray-500 mt-2">
                     Staff tip is automatically calculated as 15% of the service price.
                   </p>
                 </DialogHeader>
                {editingItem && (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="serviceName">Service Name</Label>
                      <Input
                        id="serviceName"
                        value={editingItem.serviceName || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, serviceName: e.target.value })}
                        placeholder="Enter service name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="servicePrice">Price</Label>
                      <Input
                        id="servicePrice"
                        type="number"
                        step="0.01"
                        value={editingItem.price || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, price: Number(e.target.value) })}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="staffName">Staff Name</Label>
                      <Input
                        id="staffName"
                        value={editingItem.staffName || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, staffName: e.target.value })}
                        placeholder="Enter staff name"
                      />
                    </div>
                     <div>
                       <Label htmlFor="staffTip">Staff Tip (Auto-calculated 15%)</Label>
                       <Input
                         id="staffTip"
                         type="number"
                         step="0.01"
                         value={editingItem.staffTipCollected || ''}
                         readOnly
                         className="bg-gray-50"
                         placeholder="0.00"
                       />
                     </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setEditItemDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={saveItem} disabled={saving}>
                        {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>

          </div>
        </SidebarInset>
      </SidebarProvider>
    </RoleGuard>
  )
}


