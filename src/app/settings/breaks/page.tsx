"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { RoleGuard } from "@/components/role-guard"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TimeBlockDialog } from "@/components/time-block-dialog"
import { useEffect, useState } from "react"
import { RefreshCw, Plus, Trash2, Edit } from "lucide-react"

export default function BreaksPage() {
  const [blocks, setBlocks] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchBlocks = async () => {
    const res = await fetch('/api/time-blocks')
    const r = await res.json()
    if (r.ok) setBlocks(r.data || [])
  }
  const fetchStaff = async () => {
    const res = await fetch('/api/barber-hours')
    const r = await res.json()
    if (r.ok) setStaff(r.data || [])
  }
  const refreshAll = async () => {
    setLoading(true)
    await Promise.all([fetchBlocks(), fetchStaff()])
    setLoading(false)
  }
  useEffect(() => { refreshAll() }, [])

  const deleteBlock = async (row: any) => {
    try {
      setSaving(true)
      const res = await fetch(`/api/time-blocks?id=${encodeURIComponent(row['🔒 Row ID'])}`, { method: 'DELETE' })
      const r = await res.json()
      if (r.ok) refreshAll()
    } finally {
      setSaving(false)
    }
  }

  return (
    <RoleGuard requiredRole="admin">
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
                    {blocks.map(b => {
                      const member = staff.find((s: any) => s.ghl_id === b.ghl_id)
                      return (
                        <TableRow key={b['🔒 Row ID']}>
                          <TableCell>{member?.['Barber/Name'] || b.ghl_id}</TableCell>
                          <TableCell>{b['Block/Name']}</TableCell>
                          <TableCell>{String(b['Block/Recurring']) === 'true' ? 'Yes' : 'No'}</TableCell>
                          <TableCell>{String(b['Block/Recurring']) === 'true' ? (b['Block/Recurring Day'] || '-') : (b['Block/Date'] || '-')}</TableCell>
                          <TableCell>{b['Block/Start']}</TableCell>
                          <TableCell>{b['Block/End']}</TableCell>
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
