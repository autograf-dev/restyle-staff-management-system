"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { RoleGuard } from "@/components/role-guard"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { TimePicker } from "@/components/ui/time-picker"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { 
  RefreshCw, 
  User, 
  Calendar,
  CheckCircle2,
  XCircle,
  Scissors,
  ArrowLeft,
  CalendarPlus
} from "lucide-react"
import React, { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { minutesToDisplayTime } from "@/lib/timeUtils"
import { useParams, useRouter } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import { LeaveDialog } from "@/components/leave-dialog"

type BarberHour = {
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
  "Lunch/Start": string | number | null
  "Lunch/End": string | number | null
}

// Helper function to get the row ID
const getRowId = (barber: BarberHour): string => {
  return barber["🔒 Row ID"] || barber["ð Row ID"] || ""
}

const DAYS = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 
  'Friday', 'Saturday', 'Sunday'
]

export default function StaffHoursDetailPage() {
  const { user } = useUser()
  const params = useParams()
  const router = useRouter()
  const ghlId = params.ghl_id as string
  
  const [staffData, setStaffData] = useState<BarberHour | null>(null)
  const [allStaff, setAllStaff] = useState<BarberHour[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false)
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  // Fetch specific staff data by ghl_id
  const fetchStaffData = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/barber-hours')
      const result = await response.json()
      
      if (result.ok) {
        setAllStaff(result.data)
        const staff = result.data.find((barber: BarberHour) => barber.ghl_id === ghlId)
        if (staff) {
          setStaffData(staff)
        } else {
          toast.error('Staff member not found')
          router.push('/settings/salon-staff')
        }
      } else {
        toast.error('Failed to load staff data')
      }
    } catch {
      toast.error('Error loading staff data')
    } finally {
      setLoading(false)
    }
  }, [ghlId, router])

  useEffect(() => {
    if (ghlId) {
      fetchStaffData()
    }
  }, [ghlId, fetchStaffData])

  // Update barber hour
  const updateBarberHour = async (updates: Partial<BarberHour>) => {
    if (!staffData) return
    
    try {
      console.log('Updating barber hour:', { id: getRowId(staffData), updates })
      setSaving(true)
      
      const response = await fetch('/api/barber-hours', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: getRowId(staffData), ...updates })
      })
      
      const result = await response.json()
      console.log('API Response:', result)
      
      if (result.ok) {
        setStaffData(prev => prev ? { ...prev, ...updates } : null)
        toast.success('Staff hours updated successfully')
      } else {
        console.error('API Error:', result.error)
        toast.error(`Failed to update: ${result.error}`)
      }
    } catch (error) {
      console.error('Update error:', error)
      toast.error('Error updating staff hours')
    } finally {
      setSaving(false)
    }
  }

  // Toggle day on/off
  const toggleDay = (day: string, isOn: boolean) => {
    if (!staffData) return
    
    const startField = `${day}/Start Value` as keyof BarberHour
    const endField = `${day}/End Value` as keyof BarberHour
    
    if (isOn) {
      // Turn on - restore previous values or set default times
      const currentStart = staffData[startField]
      const currentEnd = staffData[endField]
      
      // Use previous values if they exist and aren't 0, otherwise use defaults
      const startTime = (currentStart && String(currentStart) !== '0') ? String(currentStart) : '600' // 10:00 AM
      const endTime = (currentEnd && String(currentEnd) !== '0') ? String(currentEnd) : '1080'   // 6:00 PM
      
      updateBarberHour({
        [startField]: startTime,
        [endField]: endTime
      })
    } else {
      // Turn off - set to 0
      updateBarberHour({
        [startField]: '0',
        [endField]: '0'
      })
    }
  }

  // Update time with debouncing
  const updateTime = async (field: keyof BarberHour, minutes: number) => {
    if (!staffData) return
    
    console.log(`Updating ${field} for ${staffData.ghl_id} to ${minutes} minutes`)
    
    // Update local state immediately
    setStaffData(prev => prev ? { ...prev, [field]: String(minutes) } : null)
    
    // Debounce the API call
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(async () => {
      await updateBarberHour({ [field]: String(minutes) })
    }, 1000)
  }

  // Check if day is working
  const isDayWorking = (day: string): boolean => {
    if (!staffData) return false
    const startValue = staffData[`${day}/Start Value` as keyof BarberHour]
    const endValue = staffData[`${day}/End Value` as keyof BarberHour]
    return String(startValue) !== '0' && String(endValue) !== '0' && startValue !== null && endValue !== null
  }

  // Get working hours for a day
  const getDayHours = (day: string) => {
    if (!staffData || !isDayWorking(day)) return null
    
    const startValue = staffData[`${day}/Start Value` as keyof BarberHour]
    const endValue = staffData[`${day}/End Value` as keyof BarberHour]
    
    return {
      start: parseInt(String(startValue || '600')),
      end: parseInt(String(endValue || '1080'))
    }
  }

  // Open leave dialog for current staff
  const openLeaveDialog = () => {
    setLeaveDialogOpen(true)
  }

  // Handle leave dialog success
  const handleLeaveSuccess = () => {
    toast.success('Leave added successfully')
    // Optionally refresh data or navigate to leaves page
  }

  if (loading) {
    return (
      <RoleGuard requiredRole={user?.role === 'barber' ? undefined : 'manager'}>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="flex flex-col gap-2 px-4 py-4">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4" />
                <h1 className="text-xl font-semibold">Manage Hours</h1>
              </div>
              <p className="text-sm text-muted-foreground ml-8">Configure working hours and availability</p>
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

  if (!staffData) {
    return (
      <RoleGuard requiredRole={user?.role === 'barber' ? undefined : 'manager'}>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="flex flex-col gap-2 px-4 py-4">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4" />
                <h1 className="text-xl font-semibold">Manage Hours</h1>
              </div>
              <p className="text-sm text-muted-foreground ml-8">Configure working hours and availability</p>
            </header>
            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <User className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Staff Not Found</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    The requested staff member could not be found.
                  </p>
                  <Button onClick={() => router.push('/settings/salon-staff')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Staff List
                  </Button>
                </CardContent>
              </Card>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </RoleGuard>
    )
  }

  // If barber tries to access someone else's page, redirect to own
  if (user?.role === 'barber' && user.ghlId && user.ghlId !== ghlId) {
    router.push(`/settings/staff-hours/${user.ghlId}`)
  }
  return (
    <RoleGuard requiredRole={user?.role === 'barber' ? undefined : 'manager'}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex flex-col gap-2 px-4 py-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <h1 className="text-xl font-semibold">Manage Hours</h1>
            </div>
            <p className="text-sm text-muted-foreground ml-8">Configure working hours and availability</p>
          </header>
          
          <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => router.push('/settings/salon-staff')}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Staff
                  </Button>
                </div>
                <h2 className="text-2xl font-semibold">Staff Working Hours</h2>
                <p className="text-muted-foreground">
                  Manage schedule and working hours for {staffData["Barber/Name"]}
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

            <div className="space-y-6">
              {/* Staff Info Card */}
              <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Avatar className="h-20 w-20 border-4 border-primary/20">
                        <AvatarFallback className="text-xl bg-primary/10 text-primary font-bold">
                          {staffData["Barber/Name"].split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-1">
                        <Scissors className="h-3 w-3 text-primary-foreground" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-2xl text-primary">{staffData["Barber/Name"]}</CardTitle>
                      <CardDescription className="text-lg mt-1">{staffData["Barber/Email"]}</CardDescription>
                      <div className="flex gap-3 mt-3">
                        <Badge variant="default" className="bg-primary/20 text-primary border-primary/30">
                          <Calendar className="h-3 w-3 mr-1" />
                          {DAYS.filter(day => isDayWorking(day)).length} Working Days
                        </Badge>
                        <Badge variant="outline" className="bg-white/50">
                          <User className="h-3 w-3 mr-1" />
                          Staff Member
                        </Badge>
                        <Badge variant="outline" className="bg-white/50 font-mono text-xs">
                          ID: {staffData.ghl_id}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={openLeaveDialog}
                          className="ml-auto"
                        >
                          <CalendarPlus className="h-4 w-4 mr-2" />
                          Add Leave
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Weekly Schedule */}
              <div>
                <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Weekly Schedule
                </h4>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {DAYS.map((day) => {
                  const isWorking = isDayWorking(day)
                  const hours = getDayHours(day)
                  
                  return (
                    <Card key={day} className={`relative transition-all hover:shadow-md ${
                      isWorking ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/30'
                    }`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {isWorking ? (
                              <div className="bg-green-100 p-1 rounded-full">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              </div>
                            ) : (
                              <div className="bg-red-100 p-1 rounded-full">
                                <XCircle className="h-4 w-4 text-red-500" />
                              </div>
                            )}
                            <div>
                              <CardTitle className="text-base">{day}</CardTitle>
                              {isWorking && hours && (
                                <CardDescription className="text-sm font-medium text-green-700">
                                  {minutesToDisplayTime(hours.start)} - {minutesToDisplayTime(hours.end)}
                                </CardDescription>
                              )}
                              {!isWorking && (
                                <CardDescription className="text-sm text-red-600">
                                  Day Off
                                </CardDescription>
                              )}
                            </div>
                          </div>
                          <Switch
                            checked={isWorking}
                            onCheckedChange={(checked) => toggleDay(day, checked)}
                            disabled={saving}
                          />
                        </div>
                      </CardHeader>
                      
                      {isWorking && hours && (
                        <CardContent className="pt-0 space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <TimePicker
                              label="Start"
                              value={hours.start}
                              onChange={(minutes) => 
                                updateTime(`${day}/Start Value` as keyof BarberHour, minutes)
                              }
                              disabled={saving}
                            />
                            
                            <TimePicker
                              label="End"
                              value={hours.end}
                              onChange={(minutes) => 
                                updateTime(`${day}/End Value` as keyof BarberHour, minutes)
                              }
                              disabled={saving}
                            />
                          </div>
                          
                          <div className="p-3 bg-muted/30 rounded-md border">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium">
                                {minutesToDisplayTime(hours.start)} - {minutesToDisplayTime(hours.end)}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {Math.round((hours.end - hours.start) / 60 * 10) / 10}h
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      )}
                      
                      {!isWorking && (
                        <CardContent className="pt-0">
                          <div className="text-center py-2">
                            <p className="text-sm text-muted-foreground">No working hours set</p>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  )
                })}
                </div>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>

      {/* Leave Dialog */}
      <LeaveDialog
        open={leaveDialogOpen}
        onOpenChange={setLeaveDialogOpen}
        staff={allStaff}
        preSelectedStaffId={staffData?.ghl_id}
        onSuccess={handleLeaveSuccess}
      />
    </RoleGuard>
  )
}
