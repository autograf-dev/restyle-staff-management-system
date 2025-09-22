"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { RoleGuard } from "@/components/role-guard"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { 
  Calendar,
  Plus,
  RefreshCw,
  Trash2,
  Edit,
  CalendarDays,
  Clock,
  AlertCircle
} from "lucide-react"
import React, { useState, useEffect } from "react"
import { toast } from "sonner"
import { format, parseISO, isAfter, isBefore, isValid, parse } from "date-fns"
import { LeaveDialog } from "@/components/leave-dialog"

type Leave = {
  "🔒 Row ID": string
  "ghl_id": string
  "Event/Name": string
  "Event/Start": string
  "Event/End": string
}

type Staff = {
  "🔒 Row ID"?: string
  "ð Row ID"?: string
  "Barber/Name": string
  "ghl_id": string
  "Barber/Email": string
}

// Helper function to safely parse dates from various formats
const safeParseDateString = (dateString: string): Date | null => {
  if (!dateString) return null
  
  try {
    // First try ISO parsing
    let date = parseISO(dateString)
    if (isValid(date)) return date
    
    // Try parsing common formats like "9/19/2025, 12:00:00 AM"
    date = parse(dateString, 'M/d/yyyy, h:mm:ss a', new Date())
    if (isValid(date)) return date
    
    // Try parsing without time
    date = parse(dateString, 'M/d/yyyy', new Date())
    if (isValid(date)) return date
    
    // Try standard date parsing
    date = new Date(dateString)
    if (isValid(date)) return date
    
    return null
  } catch (error) {
    console.error('Error parsing date:', dateString, error)
    return null
  }
}

// Note: getRowId helper available if needed for staff operations

export default function LeavesPage() {
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingLeave, setEditingLeave] = useState<Leave | null>(null)
  const [deletingLeave, setDeletingLeave] = useState<Leave | null>(null)

  // Fetch leaves data
  const fetchLeaves = async () => {
    try {
      const response = await fetch('/api/leaves')
      const result = await response.json()
      
      if (result.ok) {
        setLeaves(result.data || [])
      } else {
        toast.error('Failed to load leaves data')
      }
    } catch (error) {
      toast.error('Error loading leaves data')
    }
  }

  // Fetch staff data
  const fetchStaff = async () => {
    try {
      const response = await fetch('/api/barber-hours')
      const result = await response.json()
      
      if (result.ok) {
        setStaff(result.data || [])
      } else {
        toast.error('Failed to load staff data')
      }
    } catch (error) {
      toast.error('Error loading staff data')
    }
  }

  // Fetch all data
  const fetchAllData = async () => {
    setLoading(true)
    await Promise.all([fetchLeaves(), fetchStaff()])
    setLoading(false)
  }

  useEffect(() => {
    fetchAllData()
  }, [])

  // Get staff member by ghl_id
  const getStaffByGhlId = (ghlId: string): Staff | undefined => {
    return staff.find(s => s.ghl_id === ghlId)
  }

  // Open dialog for adding new leave
  const openAddDialog = () => {
    setEditingLeave(null)
    setDialogOpen(true)
  }

  // Open dialog for editing leave
  const openEditDialog = (leave: Leave) => {
    setEditingLeave(leave)
    setDialogOpen(true)
  }

  // Handle leave dialog success
  const handleLeaveSuccess = () => {
    fetchLeaves()
    setDialogOpen(false)
    setEditingLeave(null)
  }

  // Open delete confirmation dialog
  const openDeleteDialog = (leave: Leave) => {
    setDeletingLeave(leave)
    setDeleteDialogOpen(true)
  }

  // Delete leave
  const deleteLeave = async () => {
    if (!deletingLeave) return

    try {
      setSaving(true)
      
      const response = await fetch(`/api/leaves?id=${deletingLeave["🔒 Row ID"]}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.ok) {
        toast.success('Leave deleted successfully')
        setDeleteDialogOpen(false)
        setDeletingLeave(null)
        fetchLeaves()
      } else {
        toast.error(`Failed to delete leave: ${result.error}`)
      }
    } catch (error) {
      toast.error('Error deleting leave')
    } finally {
      setSaving(false)
    }
  }

  // Get leave status
  const getLeaveStatus = (leave: Leave) => {
    const now = new Date()
    const start = safeParseDateString(leave["Event/Start"])
    const end = safeParseDateString(leave["Event/End"])
    
    if (!start || !end) return 'unknown'
    
    if (isAfter(now, end)) return 'completed'
    if (isBefore(now, start)) return 'upcoming'
    return 'active'
  }

  // Get status badge color
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-red-100 text-red-800 border-red-300">Active</Badge>
      case 'upcoming':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300">Upcoming</Badge>
      case 'completed':
        return <Badge className="bg-gray-100 text-gray-800 border-gray-300">Completed</Badge>
      case 'unknown':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Invalid Date</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  // Calculate statistics
  const stats = {
    total: leaves.length,
    active: leaves.filter(l => getLeaveStatus(l) === 'active').length,
    upcoming: leaves.filter(l => getLeaveStatus(l) === 'upcoming').length,
    thisMonth: leaves.filter(l => {
      const start = safeParseDateString(l["Event/Start"])
      if (!start) return false
      const now = new Date()
      return start.getMonth() === now.getMonth() && start.getFullYear() === now.getFullYear()
    }).length
  }

  if (loading) {
    return (
      <RoleGuard requiredRole="admin">
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
              <div className="flex items-center gap-2 px-4">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4" />
                <h1 className="text-xl font-semibold">Leaves</h1>
              </div>
            </header>
            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="h-8 w-8 animate-spin" />
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </RoleGuard>
    )
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
              <h1 className="text-xl font-semibold">Leaves</h1>
            </div>
          </header>
          
          <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Leave Management</h2>
                <p className="text-muted-foreground">
                  Manage staff leaves and time-off requests
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={fetchAllData} 
                  variant="outline" 
                  size="sm"
                  disabled={loading}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button onClick={openAddDialog} className="bg-primary hover:bg-primary/90">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Leave
                </Button>
              </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Leaves</CardTitle>
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <p className="text-xs text-muted-foreground">All time leaves</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Leaves</CardTitle>
                  <AlertCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{stats.active}</div>
                  <p className="text-xs text-muted-foreground">Currently on leave</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
                  <Clock className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{stats.upcoming}</div>
                  <p className="text-xs text-muted-foreground">Scheduled leaves</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">This Month</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.thisMonth}</div>
                  <p className="text-xs text-muted-foreground">Leaves this month</p>
                </CardContent>
              </Card>
            </div>

            {/* Leaves Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  All Leaves
                </CardTitle>
                <CardDescription>
                  Complete list of staff leaves and time-off requests
                </CardDescription>
              </CardHeader>
              <CardContent>
                {leaves.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Leaves Found</h3>
                    <p className="text-muted-foreground mb-4">
                      No leave records are available. Add a new leave to get started.
                    </p>
                    <Button onClick={openAddDialog} className="bg-primary hover:bg-primary/90">
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Leave
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Staff Member</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaves.map((leave) => {
                        const staffMember = getStaffByGhlId(leave.ghl_id)
                        const status = getLeaveStatus(leave)
                        const startDate = safeParseDateString(leave["Event/Start"])
                        const endDate = safeParseDateString(leave["Event/End"])
                        
                        // Calculate duration safely (difference in days)
                        let duration = 0
                        if (startDate && endDate) {
                          // Reset time to midnight for accurate day calculation
                          const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
                          const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
                          const timeDiff = end.getTime() - start.getTime()
                          duration = Math.floor(timeDiff / (1000 * 60 * 60 * 24))
                          // If same day (0 difference), show as 1 day minimum
                          if (duration === 0) {
                            duration = 1
                          }
                        }
                        
                        return (
                          <TableRow key={leave["🔒 Row ID"]}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                    {staffMember?.["Barber/Name"].split(' ').map(n => n[0]).join('').toUpperCase() || 'UK'}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium">
                                    {staffMember?.["Barber/Name"] || 'Unknown Staff'}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {staffMember?.["Barber/Email"]}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {leave["Event/Name"]}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {startDate ? format(startDate, 'MMM dd, yyyy') : 'Invalid Date'}
                            </TableCell>
                            <TableCell>
                              {endDate ? format(endDate, 'MMM dd, yyyy') : 'Invalid Date'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {duration > 0 ? `${duration} ${duration === 1 ? 'day' : 'days'}` : 'Invalid'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(status)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openEditDialog(leave)}
                                  disabled={saving}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openDeleteDialog(leave)}
                                  disabled={saving}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Leave</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this leave? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          {deletingLeave && (
            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Staff:</span>
                <span>{getStaffByGhlId(deletingLeave.ghl_id)?.["Barber/Name"] || 'Unknown'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Reason:</span>
                <span className="capitalize">{deletingLeave["Event/Name"]}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Duration:</span>
                <span>
                  {(() => {
                    const startDate = safeParseDateString(deletingLeave["Event/Start"])
                    const endDate = safeParseDateString(deletingLeave["Event/End"])
                    if (startDate && endDate) {
                      // Reset time to midnight for accurate day calculation
                      const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
                      const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
                      const timeDiff = end.getTime() - start.getTime()
                      let duration = Math.floor(timeDiff / (1000 * 60 * 60 * 24))
                      // If same day (0 difference), show as 1 day minimum
                      if (duration === 0) {
                        duration = 1
                      }
                      return `${duration} ${duration === 1 ? 'day' : 'days'}`
                    }
                    return 'Invalid'
                  })()}
                </span>
              </div>
            </div>
          )}
          
          <div className="flex justify-end gap-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => setDeleteDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={deleteLeave}
              disabled={saving}
            >
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Leave
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Leave Add/Edit Dialog */}
      <LeaveDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        staff={staff}
        editingLeave={editingLeave}
        onSuccess={handleLeaveSuccess}
      />
    </RoleGuard>
  )
}