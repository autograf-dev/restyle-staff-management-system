"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { RoleGuard } from "@/components/role-guard"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TimeBlockDialog } from "@/components/time-block-dialog"
import { useUser } from "@/contexts/user-context"
import { useEffect, useState, useCallback } from "react"
import { RefreshCw, Plus, Trash2, Edit } from "lucide-react"

type Staff = { ghl_id: string; "Barber/Name"?: string; "Barber/Email"?: string; [key: string]: unknown }
type Block = Record<string, unknown>

export default function BreaksPage() {
  const { user } = useUser()
  const [blocks, setBlocks] = useState<Block[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Block | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchBlocks = useCallback(async () => {
    const res = await fetch('/api/time-blocks')
    const r = await res.json()
    if (r.ok) {
      const all = r.data || []
      if (user?.role === 'barber' && user.ghlId) {
        setBlocks(all.filter((b: { ghl_id?: string }) => String(b.ghl_id || '') === user.ghlId))
      } else {
        setBlocks(all)
      }
    }
  }, [user?.role, user?.ghlId])
  
  const fetchStaff = useCallback(async () => {
    const res = await fetch('/api/barber-hours')
    const r = await res.json()
    if (r.ok) {
      const list = r.data || []
      if (user?.role === 'barber' && user.ghlId) {
        setStaff(list.filter((s: Staff) => s.ghl_id === user.ghlId))
      } else {
        setStaff(list)
      }
    }
  }, [user?.role, user?.ghlId])
  
  const refreshAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchBlocks(), fetchStaff()])
    setLoading(false)
  }, [fetchBlocks, fetchStaff])
  
  useEffect(() => { refreshAll() }, [refreshAll])

  const deleteBlock = async (row: Block) => {
    try {
      setSaving(true)
      const res = await fetch(`/api/time-blocks?id=${encodeURIComponent(String(row['🔒 Row ID']))}`, { method: 'DELETE' })
      const r = await res.json()
      if (r.ok) refreshAll()
    } finally {
      setSaving(false)
    }
  }

  return (
    <RoleGuard requiredRole={user?.role === 'barber' ? undefined : 'admin'}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <h1 className="text-xl font-semibold">Breaks</h1>
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Break Management</h2>
                <p className="text-muted-foreground">Create recurring or one-time breaks for staff</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={refreshAll} variant="outline" size="sm" disabled={loading}><RefreshCw className="h-4 w-4 mr-2"/>Refresh</Button>
                <Button onClick={() => { setEditing(null); setOpen(true) }} className="bg-primary hover:bg-primary/90"><Plus className="h-4 w-4 mr-2"/>Add Break</Button>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>All Breaks</CardTitle>
                <CardDescription>Configured time blocks</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Recurring</TableHead>
                      <TableHead>Days/Date</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>End</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {blocks.map((b) => {
                      const member = staff.find((s) => s.ghl_id === String(b['ghl_id'] as string))
                      return (
                        <TableRow key={String(b['🔒 Row ID'])}>
                          <TableCell>{String(member?.['Barber/Name'] || String(b['ghl_id'] as string))}</TableCell>
                          <TableCell>{String(b['Block/Name'] || '')}</TableCell>
                          <TableCell>{String(b['Block/Recurring']) === 'true' ? 'Yes' : 'No'}</TableCell>
                          <TableCell>{String(b['Block/Recurring']) === 'true' ? String(b['Block/Recurring Day'] || '-') : String(b['Block/Date'] || '-')}</TableCell>
                          <TableCell>{String(b['Block/Start'] || '')}</TableCell>
                          <TableCell>{String(b['Block/End'] || '')}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="outline" onClick={() => { setEditing(b); setOpen(true) }} disabled={saving}><Edit className="h-4 w-4"/></Button>
                              <Button size="sm" variant="outline" onClick={() => deleteBlock(b)} disabled={saving} className="text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4"/></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>

      <TimeBlockDialog open={open} onOpenChange={setOpen} staff={staff} editingBlock={editing} onSuccess={fetchBlocks} />
    </RoleGuard>
  )
}
