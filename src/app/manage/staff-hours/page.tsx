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
  ExternalLink,
  CalendarPlus
} from "lucide-react"
import React, { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { minutesToDisplayTime } from "@/lib/timeUtils"
import { useRouter } from "next/navigation"
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

export default function StaffHoursPage() {
  const router = useRouter()
  const [barberHours, setBarberHours] = useState<BarberHour[]>([])
  const [selectedBarber, setSelectedBarber] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false)
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  // Fetch barber hours
  const fetchBarberHours = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/barber-hours')
      const result = await response.json()
      
      if (result.ok) {
        setBarberHours(result.data)
        
        // Only set first staff if no current selection
        if (result.data.length > 0 && selectedBarber === null) {
          setSelectedBarber(getRowId(result.data[0]))
        }
      } else {
        toast.error('Failed to load barber hours')
      }
    } catch {
      toast.error('Error loading barber hours')
    } finally {
      setLoading(false)
    }
  }, [selectedBarber])

  useEffect(() => {
    fetchBarberHours()
  }, [fetchBarberHours])

  // Update barber hour
  const updateBarberHour = async (id: string, updates: Partial<BarberHour>) => {
    try {
      console.log('Updating barber hour:', { id, updates })
      setSaving(true)
      
      const response = await fetch('/api/barber-hours', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates })
      })
      
      const result = await response.json()
      console.log('API Response:', result)
      
      if (result.ok) {
        setBarberHours(prev => 
          prev.map(barber => getRowId(barber) === id ? { ...barber, ...updates } : barber)
        )
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
  const toggleDay = (barberId: string, day: string, isOn: boolean) => {
    const startField = `${day}/Start Value` as keyof BarberHour
    const endField = `${day}/End Value` as keyof BarberHour
    const currentBarber = barberHours.find(b => getRowId(b) === barberId)
    
    if (isOn) {
      // Turn on - restore previous values or set default times
      const currentStart = currentBarber?.[startField]
      const currentEnd = currentBarber?.[endField]
      
      // Use previous values if they exist and aren't 0, otherwise use defaults
      const startTime = (currentStart && String(currentStart) !== '0') ? String(currentStart) : '600' // 10:00 AM
      const endTime = (currentEnd && String(currentEnd) !== '0') ? String(currentEnd) : '1080'   // 6:00 PM
      
      updateBarberHour(barberId, {
        [startField]: startTime,
        [endField]: endTime
      })
    } else {
      // Turn off - set to 0
      updateBarberHour(barberId, {
        [startField]: '0',
        [endField]: '0'
      })
    }
  }

  // Update time with debouncing
  const updateTime = async (barberId: string, field: keyof BarberHour, minutes: number) => {
    console.log(`Updating ${field} for ${barberId} to ${minutes} minutes`)
    
    // Update local state immediately
    setBarberHours(prev => 
      prev.map(barber => 
        getRowId(barber) === barberId 
          ? { ...barber, [field]: String(minutes) } 
          : barber
      )
    )
    
    // Debounce the API call
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(async () => {
      await updateBarberHour(barberId, { [field]: String(minutes) })
    }, 1000)
  }

  // Get selected barber data
  const selectedBarberData = barberHours.find(b => getRowId(b) === selectedBarber)

  // Check if day is working
  const isDayWorking = (barber: BarberHour, day: string): boolean => {
    const startValue = barber[`${day}/Start Value` as keyof BarberHour]
    const endValue = barber[`${day}/End Value` as keyof BarberHour]
    return String(startValue) !== '0' && String(endValue) !== '0' && startValue !== null && endValue !== null
  }

  // Get working hours for a day
  const getDayHours = (barber: BarberHour, day: string) => {
    const startValue = barber[`${day}/Start Value` as keyof BarberHour]
    const endValue = barber[`${day}/End Value` as keyof BarberHour]
    
    if (!isDayWorking(barber, day)) return null
    
    return {
      start: parseInt(String(startValue || '600')),
      end: parseInt(String(endValue || '1080'))
    }
  }

  // Navigate to individual staff page
  const openStaffPage = (ghlId: string) => {
    router.push(`/settings/staff-hours/${ghlId}`)
  }

  // Open leave dialog for selected staff
  const openLeaveDialog = () => {
    if (!selectedBarberData) {
      toast.error('Please select a staff member first')
      return
    }
    setLeaveDialogOpen(true)
  }

  // Handle leave dialog success
  const handleLeaveSuccess = () => {
    toast.success('Leave added successfully')
    // Optionally refresh data or navigate to leaves page
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
                <h1 className="text-xl font-semibold">Staff Hours</h1>
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
              <h1 className="text-xl font-semibold">Manage Staff Hours</h1>
              <span className="text-sm text-muted-foreground ml-2">Manage individual schedules and working hours for each barber</span>
            </div>
          </header>
          
          <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
            <div className="flex items-center justify-end">
              <div></div>
              <Button 
                onClick={fetchBarberHours} 
                variant="outline" 
                size="sm"
                disabled={loading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>

            <div className="space-y-6">
              {/* Barber Selection Grid */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Select Staff Member</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-3">
                  {barberHours.map((barber) => {
                    const workingDays = DAYS.filter(day => isDayWorking(barber, day)).length
                    const isSelected = getRowId(barber) === selectedBarber
                    return (
                      <div key={getRowId(barber)} className="relative">
                        <button
                          onClick={() => setSelectedBarber(getRowId(barber))}
                          className={`
                            w-full flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:shadow-md
                            ${isSelected 
                              ? 'border-primary bg-primary text-primary-foreground shadow-lg' 
                              : 'border-border bg-card hover:border-primary/50'
                            }
                          `}
                        >
                          <Avatar className="h-12 w-12">
                            <AvatarFallback className={`text-sm font-semibold ${
                              isSelected ? 'bg-primary-foreground text-primary' : 'bg-primary/10 text-primary'
                            }`}>
                              {barber["Barber/Name"].split(' ').map(n => n[0]).join('').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="text-center space-y-1">
                            <div className="font-medium text-sm leading-tight">
                              {barber["Barber/Name"]}
                            </div>
                            <Badge 
                              variant={isSelected ? "secondary" : "outline"} 
                              className={`text-xs ${
                                isSelected 
                                  ? 'bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30' 
                                  : ''
                              }`}
                            >
                              {workingDays} days
                            </Badge>
                          </div>
                        </button>
                        
                        {/* Quick link to individual page */}
                        <Button
                          size="sm"
                          variant="outline"
                          className="absolute -top-2 -right-2 h-6 w-6 p-0 bg-white border-primary/50 hover:bg-primary hover:text-primary-foreground"
                          onClick={() => openStaffPage(barber.ghl_id)}
                          title="Open in dedicated page"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Individual Barber Schedule */}
              {selectedBarberData && (
                <div className="space-y-6">
                  {/* Barber Info Card */}
                  <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <Avatar className="h-20 w-20 border-4 border-primary/20">
                            <AvatarFallback className="text-xl bg-primary/10 text-primary font-bold">
                              {selectedBarberData["Barber/Name"].split(' ').map(n => n[0]).join('').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-1">
                            <Scissors className="h-3 w-3 text-primary-foreground" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-2xl text-primary">{selectedBarberData["Barber/Name"]}</CardTitle>
                          <CardDescription className="text-lg mt-1">{selectedBarberData["Barber/Email"]}</CardDescription>
                          <div className="flex gap-3 mt-3">
                            <Badge variant="default" className="bg-primary/20 text-primary border-primary/30">
                              <Calendar className="h-3 w-3 mr-1" />
                              {DAYS.filter(day => isDayWorking(selectedBarberData, day)).length} Working Days
                            </Badge>
                            <Badge variant="outline" className="bg-white/50">
                              <User className="h-3 w-3 mr-1" />
                              Staff Member
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={openLeaveDialog}
                              className="mr-2"
                            >
                              <CalendarPlus className="h-4 w-4 mr-2" />
                              Add Leave
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openStaffPage(selectedBarberData.ghl_id)}
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Open Dedicated Page
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
                      const isWorking = isDayWorking(selectedBarberData, day)
                      const hours = getDayHours(selectedBarberData, day)
                      
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
                                onCheckedChange={(checked) => 
                                  toggleDay(getRowId(selectedBarberData), day, checked)
                                }
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
                                    updateTime(
                                      getRowId(selectedBarberData), 
                                      `${day}/Start Value` as keyof BarberHour, 
                                      minutes
                                    )
                                  }
                                  disabled={saving}
                                />
                                
                                <TimePicker
                                  label="End"
                                  value={hours.end}
                                  onChange={(minutes) => 
                                    updateTime(
                                      getRowId(selectedBarberData), 
                                      `${day}/End Value` as keyof BarberHour, 
                                      minutes
                                    )
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
              )}
            </div>

            {barberHours.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <User className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Staff Found</h3>
                  <p className="text-muted-foreground text-center">
                    No barber data is available. Please check your database.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>

      {/* Leave Dialog */}
      <LeaveDialog
        open={leaveDialogOpen}
        onOpenChange={setLeaveDialogOpen}
        staff={barberHours}
        preSelectedStaffId={selectedBarberData?.ghl_id}
        onSuccess={handleLeaveSuccess}
      />
    </RoleGuard>
  )
}
