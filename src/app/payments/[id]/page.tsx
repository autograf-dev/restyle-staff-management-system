"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { RoleGuard } from "@/components/role-guard"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  CheckCircle
} from "lucide-react"

interface TransactionData {
  id: string
  paymentDate: string | null
  method: string | null
  subtotal: number | null
  tax: number | null
  tip: number | null
  totalPaid: number | null
  services: string | null
  serviceIds: string | null
  bookingId: string | null
  staff: string | null
  customerPhone: string | null
  customerLookup: string | null
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

  const formatCurrency = (n?: number | null) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Number(n || 0))

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
        setData(json.data)
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
      const payload = { method: data.method, staff: data.staff, services: data.services }
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
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <div className="flex items-center justify-between w-full px-4">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4" />
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-[#7b1d1d]" />
                  <h1 className="text-xl font-semibold">Payment Information</h1>
                </div>
              </div>
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-6 p-4 pt-0 max-w-4xl mx-auto">
            
            {/* Header */}
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
                <CreditCard className="h-8 w-8 text-blue-600" />
              </div>
              <h1 className="text-2xl font-bold text-blue-600 mb-1">Payment Details</h1>
              <p className="text-muted-foreground">
                Complete transaction information and service details.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              
              {/* Payment Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-primary" />
                    Transaction Summary
                  </CardTitle>
                  <CardDescription>
                    Payment and transaction information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Transaction ID</span>
                      <span className="font-mono text-sm">{data.id}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Amount Paid</span>
                      <span className="font-semibold text-lg text-green-600">{formatCurrency(data.totalPaid)}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <div className="text-sm">
                        <div className="text-muted-foreground">Subtotal</div>
                        <div className="font-medium">{formatCurrency(data.subtotal)}</div>
                      </div>
                      <div className="text-sm">
                        <div className="text-muted-foreground">Tax</div>
                        <div className="font-medium">{formatCurrency(data.tax)}</div>
                      </div>
                      {typeof data.tip === 'number' && data.tip > 0 && (
                        <div className="text-sm">
                          <div className="text-muted-foreground">Tip</div>
                          <div className="font-medium">{formatCurrency(data.tip)}</div>
                        </div>
                      )}
                      {data.method && (
                        <div className="text-sm">
                          <div className="text-muted-foreground">Method</div>
                          <div className="font-medium capitalize">{data.method}</div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-sm text-muted-foreground">Date</span>
                      <span className="font-medium">{data.paymentDate ? new Date(data.paymentDate).toLocaleDateString('en-CA') : '—'}</span>
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
                    {(data.items || []).map((it: Record<string, unknown>) => (
                      <div key={String(it.id)} className="flex items-center justify-between rounded-xl border border-neutral-200 p-3">
                        <div className="min-w-0">
                          <div className="font-medium text-neutral-900 truncate">{String(it.serviceName) || 'Service'}</div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-neutral-600">
                            <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 font-medium text-neutral-700 border border-neutral-200">
                              {String(it.staffName) || data.staff || 'Staff'}
                            </span>
                            {it.serviceId != null && it.serviceId !== '' && (
                              <span className="text-[11px] text-neutral-400">ID: {String(it.serviceId)}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-neutral-900">{formatCurrency(Number(it.price))}</div>
                          {it.staffTipSplit != null && it.staffTipSplit !== 0 && (
                            <div className="text-xs text-green-600">Tip: {formatCurrency(Number(it.staffTipSplit))}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

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
                        <div className="font-medium">Customer</div>
                        <div className="text-sm text-muted-foreground">Name</div>
                      </div>
                    </div>
                    
                    {data.customerPhone && (
                      <div className="flex items-center gap-3">
                        <Phone className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{data.customerPhone}</div>
                          <div className="text-sm text-muted-foreground">Phone</div>
                        </div>
                      </div>
                    )}
                    
                    {data.customerLookup && (
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="font-medium font-mono text-sm">{data.customerLookup}</div>
                          <div className="text-sm text-muted-foreground">Lookup ID</div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Edit Section */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Save className="h-5 w-5 text-primary" />
                    Edit Transaction
                  </CardTitle>
                  <CardDescription>
                    Modify transaction details
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Payment Method</div>
                      <Input value={data.method || ''} onChange={(e) => setData({ ...data, method: e.target.value })} className="rounded-lg" />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Staff</div>
                      <Input value={data.staff || ''} onChange={(e) => setData({ ...data, staff: e.target.value })} className="rounded-lg" />
                    </div>
                    <div className="col-span-2">
                      <div className="text-sm text-muted-foreground mb-1">Services</div>
                      <Input value={data.services || ''} onChange={(e) => setData({ ...data, services: e.target.value })} className="rounded-lg" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" className="border-red-200 hover:bg-red-50 hover:text-red-600" onClick={del}>
                      <Trash2 className="h-4 w-4 mr-2" /> Delete Transaction
                    </Button>
                    <Button onClick={save} disabled={saving} className="bg-[#7b1d1d] hover:bg-[#6b1717] text-white">
                      <Save className="h-4 w-4 mr-2" /> Save Changes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-6">
              <Button onClick={() => router.push('/payments')} size="lg">
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back to Payments
              </Button>
              
              <Button variant="outline" onClick={() => router.push('/dashboard')} size="lg">
                <DollarSign className="h-5 w-5 mr-2" />
                View Dashboard
              </Button>
            </div>

            {/* Additional Information */}
            <Card className="bg-blue-50/50 border-blue-200">
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <h3 className="font-semibold text-blue-900">Transaction Management</h3>
                  <p className="text-sm text-blue-700">
                    • All changes are saved automatically to the database<br />
                    • Deleted transactions cannot be recovered<br />
                    • Staff tip splits are calculated based on service assignments
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </RoleGuard>
  )
}


