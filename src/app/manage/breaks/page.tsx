"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { RoleGuard } from "@/components/role-guard"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { minutesToDisplayTime } from "@/lib/timeUtils"
import { TimeBlockDialog } from "@/components/time-block-dialog"
import { useUser } from "@/contexts/user-context"
import { useEffect, useState, useCallback } from "react"
import { RefreshCw, Plus, Trash2, Edit } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"

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
  const isMobile = useIsMobile()

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
          <header className="flex flex-col gap-2 px-4 py-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <h1 className="text-xl font-semibold">Manage Breaks</h1>
            </div>
            <p className="text-sm text-muted-foreground ml-8">Create recurring or one-time breaks for staff</p>
          </header>
          <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
            <div className="flex items-center justify-end">
              <div></div>
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
                {loading ? (
                  <div className="flex items-center justify-center h-48">
                    <RefreshCw className="h-6 w-6 animate-spin" />
                  </div>
                ) : blocks.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="mb-2">No breaks have been configured yet.</p>
                    <p className="text-sm">Use “Add Break” to create your first time block.</p>
                  </div>
                ) : (
                isMobile ? (
                  <div className="grid gap-2">
                    {blocks.map((b) => {
                      const member = staff.find((s) => s.ghl_id === String(b['ghl_id'] as string))
                      const staffName = String(member?.['Barber/Name'] || String(b['ghl_id'] as string))
                      const staffEmail = String(member?.['Barber/Email'] || '')
                      const startDisp = minutesToDisplayTime(Number(b['Block/Start'] || 0))
                      const endDisp = minutesToDisplayTime(Number(b['Block/End'] || 0))
                      const isRecurring = String(b['Block/Recurring']) === 'true'
                      return (
                        <Card key={String(b['🔒 Row ID'])}>
                          <CardContent className="p-3">
                            {/* Row 1: Avatar + identity */}
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                  {staffName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="font-medium leading-tight truncate">{staffName}</div>
                                {staffEmail && (
                                  <div className="text-xs text-muted-foreground truncate">{staffEmail}</div>
                                )}
                              </div>
                            </div>

                            {/* Row 2: chips + actions */}
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1 text-xs">
                                <Badge variant={isRecurring ? 'secondary' : 'outline'} className="text-[10px]">{isRecurring ? 'Recurring' : 'One-time'}</Badge>
                                {isRecurring ? (
                                  String(b['Block/Recurring Day'] || '')
                                    .split(',')
                                    .filter(Boolean)
                                    .map((d) => (
                                      <Badge key={d} variant="outline" className="text-[10px]">{d}</Badge>
                                    ))
                                ) : (
                                  <Badge variant="outline" className="text-[10px]">
                                    {(() => {
                                      const raw = String(b['Block/Date'] || '-')
                                      if (!raw || raw === '-') return '-'
                                      const tryDate = new Date(raw)
                                      if (!isNaN(tryDate.getTime())) return tryDate.toLocaleDateString('en-US')
                                      if (raw.includes(',')) return raw.split(',')[0]
                                      if (raw.includes('T')) return raw.split('T')[0]
                                      return raw
                                    })()}
                                  </Badge>
                                )}
                                <Badge variant="outline" className="text-[10px]">{startDisp}</Badge>
                                <span className="text-muted-foreground text-[10px]">to</span>
                                <Badge variant="outline" className="text-[10px]">{endDisp}</Badge>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Button size="icon" variant="outline" onClick={() => { setEditing(b); setOpen(true) }} disabled={saving} className="h-8 w-8"><Edit className="h-4 w-4"/></Button>
                                <Button size="icon" variant="outline" onClick={() => deleteBlock(b)} disabled={saving} className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4"/></Button>
                              </div>
                            </div>

                            {String(b['Block/Name'] || '') && (
                              <div className="mt-1 text-xs text-muted-foreground">{String(b['Block/Name'] || '')}</div>
                            )}
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Staff</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Recurring</TableHead>
                        <TableHead>Schedule</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {blocks.map((b) => {
                        const member = staff.find((s) => s.ghl_id === String(b['ghl_id'] as string))
                        const staffName = String(member?.['Barber/Name'] || String(b['ghl_id'] as string))
                        const staffEmail = String(member?.['Barber/Email'] || '')
                        const startDisp = minutesToDisplayTime(Number(b['Block/Start'] || 0))
                        const endDisp = minutesToDisplayTime(Number(b['Block/End'] || 0))
                        return (
                          <TableRow key={String(b['🔒 Row ID'])}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                    {staffName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium">{staffName}</div>
                                  {staffEmail && (
                                    <div className="text-xs text-muted-foreground">{staffEmail}</div>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{String(b['Block/Name'] || '')}</TableCell>
                            <TableCell>
                              <Badge variant={String(b['Block/Recurring']) === 'true' ? 'secondary' : 'outline'} className="text-[11px]">
                                {String(b['Block/Recurring']) === 'true' ? 'Yes' : 'No'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {String(b['Block/Recurring']) === 'true' ? (
                                  <div className="flex flex-wrap gap-1">
                                    {String(b['Block/Recurring Day'] || '')
                                      .split(',')
                                      .filter(Boolean)
                                      .map((d) => (
                                        <Badge key={d} variant="secondary" className="text-[11px]">
                                          {d}
                                        </Badge>
                                      ))}
                                  </div>
                                ) : (
                                  <Badge variant="outline" className="w-fit text-[11px]">
                                    {(() => {
                                      const raw = String(b['Block/Date'] || '-')
                                      if (!raw || raw === '-') return '-'
                                      const tryDate = new Date(raw)
                                      if (!isNaN(tryDate.getTime())) {
                                        return tryDate.toLocaleDateString('en-US')
                                      }
                                      // Fallbacks for non-ISO strings
                                      if (raw.includes(',')) return raw.split(',')[0]
                                      if (raw.includes('T')) return raw.split('T')[0]
                                      return raw
                                    })()}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[11px]">
                                  {startDisp}
                                </Badge>
                                <span className="text-muted-foreground text-xs">to</span>
                                <Badge variant="outline" className="text-[11px]">
                                  {endDisp}
                                </Badge>
                              </div>
                            </TableCell>
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
                )
                )}
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>

      <TimeBlockDialog open={open} onOpenChange={setOpen} staff={staff} editingBlock={editing} onSuccess={fetchBlocks} />
    </RoleGuard>
  )
}
