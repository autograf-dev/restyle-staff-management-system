"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { RoleGuard } from "@/components/role-guard"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { CreditCard, Save, Trash2 } from "lucide-react"

export default function PaymentDetailPage() {
  const params = useParams()
  const id = String(params?.id || "")
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<any | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/transactions/${encodeURIComponent(id)}`)
        const json = await res.json()
        if (!res.ok || !json.ok) throw new Error(json.error || 'Failed to load')
        setData(json.data)
      } catch (e) {
        toast.error('Failed to load transaction')
      } finally {
        setLoading(false)
      }
    }
    if (id) load()
  }, [id])

  const save = async () => {
    setSaving(true)
    try {
      const payload = { method: data.method, staff: data.staff, services: data.services }
      const res = await fetch(`/api/transactions/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.ok === false) throw new Error(json.error || 'Save failed')
      toast.success('Saved')
    } catch (e) {
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
    } catch (e) {
      toast.error('Could not delete transaction')
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
                <h1 className="text-[15px] font-semibold tracking-tight">Payment Detail</h1>
              </div>
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-6 p-6 bg-neutral-50">
            <div className="mx-auto w-full max-w-4xl">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full rounded-xl" />
                  <Skeleton className="h-40 w-full rounded-xl" />
                </div>
              ) : data ? (
                <>
                  <Card className="rounded-2xl border-neutral-200 shadow-none">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-[16px] font-semibold">Overview</CardTitle>
                      <CardDescription className="text-[13px]">Edit basic transaction details</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-[12px] text-neutral-600 mb-1">Method</div>
                          <Input value={data.method || ''} onChange={(e) => setData({ ...data, method: e.target.value })} className="rounded-lg" />
                        </div>
                        <div>
                          <div className="text-[12px] text-neutral-600 mb-1">Staff</div>
                          <Input value={data.staff || ''} onChange={(e) => setData({ ...data, staff: e.target.value })} className="rounded-lg" />
                        </div>
                        <div className="col-span-2">
                          <div className="text-[12px] text-neutral-600 mb-1">Services</div>
                          <Input value={data.services || ''} onChange={(e) => setData({ ...data, services: e.target.value })} className="rounded-lg" />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" className="border-red-200 hover:bg-red-50 hover:text-red-600" onClick={del}>
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </Button>
                        <Button onClick={save} disabled={saving} className="bg-[#7b1d1d] hover:bg-[#6b1717] text-white">
                          <Save className="h-4 w-4 mr-2" /> Save Changes
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl border-neutral-200 shadow-none">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-[16px] font-semibold">Items</CardTitle>
                      <CardDescription className="text-[13px]">Services and assigned staff</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-hidden rounded-xl border border-neutral-200">
                        <div className="grid grid-cols-4 bg-neutral-50 px-4 py-2 text-[12px] font-medium text-neutral-600">
                          <div>Service</div>
                          <div>Staff</div>
                          <div>Price</div>
                          <div>Service ID</div>
                        </div>
                        <div className="divide-y">
                          {(data.items || []).map((it: any) => (
                            <div key={it.id} className="grid grid-cols-4 items-center px-4 py-2">
                              <div className="text-[13px]">{it.serviceName || 'Service'}</div>
                              <div>
                                <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700">
                                  {it.staffName || '—'}
                                </span>
                              </div>
                              <div className="text-[13px] font-medium">{new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Number(it.price || 0))}</div>
                              <div className="text-[12px] text-neutral-500">{it.serviceId || '—'}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="text-sm text-neutral-600">Not found</div>
              )}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </RoleGuard>
  )
}


