"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { RoleGuard } from "@/components/role-guard"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  Users, 
  RefreshCw, 
  Calendar,
  Clock,
  Mail,
  Scissors,
  Settings
} from "lucide-react"
import React, { useState, useEffect } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

type BarberStaff = {
  "🔒 Row ID"?: string
  "ð Row ID"?: string // Handle encoding issue
  "Barber/Name": string
  "ghl_id": string
  "Barber/Email": string
  "Monday/Start Value": string | number | null
  "Monday/End Value": string | number | null
  "Tuesday/Start Value": string | number | null
  "Tuesday/End Value": string | number | null
  "Wednesday/Start Value": string | number | null
  "Wednesday/End Value": string | number | null
  "Thursday/Start Value": string | number | null
  "Thursday/End Value": string | number | null
  "Friday/Start Value": string | number | null
  "Friday/End Value": string | number | null
  "Saturday/Start Value": string | number | null
  "Saturday/End Value": string | number | null
  "Sunday/Start Value": string | number | null
  "Sunday/End Value": string | number | null
}

// Helper function to get the row ID
const getRowId = (staff: BarberStaff): string => {
  return staff["🔒 Row ID"] || staff["ð Row ID"] || ""
}

const DAYS = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 
  'Friday', 'Saturday', 'Sunday'
]

export default function SalonStaffPage() {
  const [staffData, setStaffData] = useState<BarberStaff[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [selectedGhlId, setSelectedGhlId] = useState<string>("")
  const [password, setPassword] = useState<string>("")
  const router = useRouter()

  // Fetch staff data
  const fetchStaffData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/barber-hours')
      const result = await response.json()
      
      if (result.ok) {
        setStaffData(result.data)
      } else {
        toast.error('Failed to load staff data')
      }
    } catch {
      toast.error('Error loading staff data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStaffData()
  }, [])

  // Check if day is working
  const isDayWorking = (staff: BarberStaff, day: string): boolean => {
    const startValue = staff[`${day}/Start Value` as keyof BarberStaff]
    const endValue = staff[`${day}/End Value` as keyof BarberStaff]
    return String(startValue) !== '0' && String(endValue) !== '0' && startValue !== null && endValue !== null
  }

  // Get working days count
  const getWorkingDaysCount = (staff: BarberStaff): number => {
    return DAYS.filter(day => isDayWorking(staff, day)).length
  }

  // Navigate to staff hours management
  const manageAvailability = (staff: BarberStaff) => {
    // Navigate directly to the staff-specific URL using ghl_id
    router.push(`/settings/staff-hours/${staff.ghl_id}`)
  }

  if (loading) {
    return (
      <RoleGuard requiredRole="manager">
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
              <div className="flex items-center gap-2 px-4">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4" />
                <h1 className="text-xl font-semibold">Stylists</h1>
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
    <RoleGuard requiredRole="manager">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <h1 className="text-xl font-semibold">Stylists</h1>
            </div>
          </header>
          
          <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Stylist Management</h2>
                <p className="text-muted-foreground">
                  Manage your stylists and their availability
                </p>
              </div>
              <Button 
                onClick={fetchStaffData} 
                variant="outline" 
                size="sm"
                disabled={loading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>

            <div>
              <Button className="bg-primary" onClick={() => setCreateDialogOpen(true)}>
                <Scissors className="h-4 w-4 mr-2" />
                Add Stylists
              </Button>
            </div>

            {/* Staff Overview Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Stylists</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{staffData.length}</div>
                  <p className="text-xs text-muted-foreground">Active staff members</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Working Today</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {staffData.filter(staff => {
                      const today = new Date().toLocaleDateString('en-US', { weekday: 'long' })
                      return isDayWorking(staff, today)
                    }).length}
                  </div>
                  <p className="text-xs text-muted-foreground">Staff scheduled today</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Full Time</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {staffData.filter(staff => getWorkingDaysCount(staff) >= 5).length}
                  </div>
                  <p className="text-xs text-muted-foreground">5+ working days</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Part Time</CardTitle>
                  <Scissors className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {staffData.filter(staff => getWorkingDaysCount(staff) < 5 && getWorkingDaysCount(staff) > 0).length}
                  </div>
                  <p className="text-xs text-muted-foreground">Less than 5 days</p>
                </CardContent>
              </Card>
            </div>

            {/* Staff Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Staff Directory
                </CardTitle>
                <CardDescription>
                  Complete list of stylists with their availability information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff Member</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Working Days</TableHead>
                      <TableHead>Schedule Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staffData.map((staff) => {
                      const workingDays = getWorkingDaysCount(staff)
                      const scheduleType = workingDays >= 5 ? 'Full Time' : workingDays > 0 ? 'Part Time' : 'Inactive'
                      const today = new Date().toLocaleDateString('en-US', { weekday: 'long' })
                      const workingToday = isDayWorking(staff, today)
                      
                      return (
                        <TableRow key={getRowId(staff)}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                  {staff["Barber/Name"].split(' ').map(n => n[0]).join('').toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{staff["Barber/Name"]}</div>
                                <div className="text-sm text-muted-foreground hidden">
                                  ID: {staff["ghl_id"]}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              {staff["Barber/Email"]}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                              {workingDays} {workingDays === 1 ? 'day' : 'days'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={scheduleType === 'Full Time' ? 'default' : scheduleType === 'Part Time' ? 'secondary' : 'outline'}
                              className={
                                scheduleType === 'Full Time' 
                                  ? 'bg-green-100 text-green-800 border-green-300' 
                                  : scheduleType === 'Part Time'
                                  ? 'bg-blue-100 text-blue-800 border-blue-300'
                                  : 'bg-red-100 text-red-800 border-red-300'
                              }
                            >
                              {scheduleType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={workingToday ? 'default' : 'secondary'}
                              className={
                                workingToday 
                                  ? 'bg-green-100 text-green-800 border-green-300' 
                                  : 'bg-gray-100 text-gray-800 border-gray-300'
                              }
                            >
                              {workingToday ? 'Working Today' : 'Off Today'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => manageAvailability(staff)}
                              className="bg-primary hover:bg-primary/90"
                            >
                              <Settings className="h-4 w-4 mr-2" />
                              Manage Availability
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {staffData.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Staff Found</h3>
                  <p className="text-muted-foreground text-center">
                    No staff data is available. Please check your database configuration.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Stylist</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Select staff</div>
                  <Select value={selectedGhlId} onValueChange={setSelectedGhlId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Choose staff" />
                    </SelectTrigger>
                    <SelectContent>
                      {staffData.map((s) => (
                        <SelectItem key={getRowId(s)} value={s.ghl_id}>
                          {s["Barber/Name"]} — {s["Barber/Email"]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">Password</div>
                  <Input
                    type="password"
                    placeholder="Min 8 characters"
                    className="h-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="pt-2">
                  <Button
                    className="w-full"
                    disabled={creating || !selectedGhlId || password.length < 8}
                    onClick={async () => {
                      const staff = staffData.find((x) => x.ghl_id === selectedGhlId)
                      if (!staff) return
                      setCreating(true)
                      try {
                        const res = await fetch('/api/create-barber-user', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            email: staff["Barber/Email"],
                            full_name: staff["Barber/Name"],
                            ghl_id: staff.ghl_id,
                            role: 'barber',
                            password,
                          }),
                        })
                        const out = await res.json()
                        if (!res.ok || !out.ok) throw new Error(out.error || 'Failed')
                        toast.success(`User created for ${staff["Barber/Name"]}`)
                        setSelectedGhlId("")
                        setPassword("")
                        setCreateDialogOpen(false)
                      } catch {
                        toast.error('Failed to create user')
                      } finally {
                        setCreating(false)
                      }
                    }}
                  >
                    {creating ? 'Adding…' : 'Add Stylist'}
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
