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
import { Clock, RefreshCw, CheckCircle, XCircle } from "lucide-react"
import React, { useState, useEffect } from "react"
import { toast } from "sonner"
import { minutesToDisplayTime } from "@/lib/timeUtils"

type BusinessHour = {
  id: string
  day_of_week: number
  is_open: boolean
  Name: string
  open_time: number | null
  close_time: number | null
  created_at: string
  updated_at: string
}

export default function SalonHoursPage() {
  const [businessHours, setBusinessHours] = useState<BusinessHour[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  // Fetch business hours
  const fetchBusinessHours = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/business-hours')
      const result = await response.json()
      
      if (result.ok) {
        setBusinessHours(result.data)
      } else {
        toast.error('Failed to load business hours')
      }
    } catch {
      toast.error('Error loading business hours')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBusinessHours()
  }, [])

  // Update business hour
  const updateBusinessHour = async (id: string, updates: Partial<BusinessHour>) => {
    try {
      console.log('Updating business hour:', { id, updates })
      setSaving(true)
      
      const response = await fetch('/api/business-hours', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates })
      })
      
      const result = await response.json()
      console.log('API Response:', result)
      
      if (result.ok) {
        setBusinessHours(prev => 
          prev.map(hour => hour.id === id ? { ...hour, ...updates } : hour)
        )
        toast.success('Business hours updated successfully')
      } else {
        console.error('API Error:', result.error)
        toast.error(`Failed to update: ${result.error}`)
      }
    } catch (error) {
      console.error('Update error:', error)
      toast.error('Error updating business hours')
    } finally {
      setSaving(false)
    }
  }

  // Toggle day open/closed
  const toggleDay = (id: string, isOpen: boolean) => {
    if (isOpen) {
      // When turning ON, set default times if they don't exist
      const currentHour = businessHours.find(h => h.id === id)
      const defaultOpenTime = currentHour?.open_time || 540 // 9:00 AM
      const defaultCloseTime = currentHour?.close_time || 1020 // 5:00 PM
      
      updateBusinessHour(id, { 
        is_open: isOpen, 
        open_time: defaultOpenTime,
        close_time: defaultCloseTime
      })
    } else {
      // When turning OFF, just update is_open (API will handle clearing times)
      updateBusinessHour(id, { is_open: isOpen })
    }
  }

  // Update time with debouncing
  const updateTime = async (id: string, field: 'open_time' | 'close_time', minutes: number) => {
    console.log(`Updating ${field} for ${id} to ${minutes} minutes`)
    
    // Update local state immediately for better UX
    setBusinessHours(prev => 
      prev.map(hour => hour.id === id ? { ...hour, [field]: minutes } : hour)
    )
    
    // Get current hour data to send both times
    const currentHour = businessHours.find(h => h.id === id)
    
    // Debounce the API call
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(async () => {
      // Send both open_time and close_time to ensure both are updated
      const updateData: Partial<Pick<BusinessHour, 'open_time' | 'close_time'>> = {
        [field]: minutes
      }
      
      // If updating open_time, also send close_time (and vice versa)
      if (field === 'open_time' && currentHour?.close_time) {
        updateData.close_time = currentHour.close_time
      } else if (field === 'close_time' && currentHour?.open_time) {
        updateData.open_time = currentHour.open_time
      }
      
      await updateBusinessHour(id, updateData)
    }, 1000) // Wait 1 second after user stops changing time
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
                <h1 className="text-xl font-semibold">Salon Hours</h1>
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
              <h1 className="text-xl font-semibold">Salon Hours</h1>
            </div>
          </header>
          
          <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Business Hours Management</h2>
                <p className="text-muted-foreground">
                  Configure your salon&apos;s operating hours for each day of the week
                </p>
              </div>
              <Button 
                onClick={fetchBusinessHours} 
                variant="outline" 
                size="sm"
                disabled={loading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-2">
              {businessHours.map((hour) => (
                <Card key={hour.id} className="relative">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {hour.is_open ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        <div>
                          <CardTitle className="text-base">{hour.Name}</CardTitle>
                          {hour.is_open && hour.open_time && hour.close_time && (
                            <CardDescription className="text-sm">
                              {minutesToDisplayTime(hour.open_time)} - {minutesToDisplayTime(hour.close_time)}
                            </CardDescription>
                          )}
                        </div>
                      </div>
                      <Switch
                        checked={hour.is_open}
                        onCheckedChange={(checked) => toggleDay(hour.id, checked)}
                        disabled={saving}
                      />
                    </div>
                  </CardHeader>
                  
                  {hour.is_open && (
                    <CardContent className="pt-0 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <TimePicker
                          label="Opens"
                          value={hour.open_time || 540} // default 9:00 AM
                          onChange={(minutes) => updateTime(hour.id, 'open_time', minutes)}
                          disabled={saving}
                          placeholder="Set opening time"
                        />
                        
                        <TimePicker
                          label="Closes"
                          value={hour.close_time || 1020} // default 5:00 PM
                          onChange={(minutes) => updateTime(hour.id, 'close_time', minutes)}
                          disabled={saving}
                          placeholder="Set closing time"
                        />
                      </div>
                      
                      {hour.open_time && hour.close_time && (
                        <div className="p-3 bg-muted/30 rounded-md border">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">
                              {minutesToDisplayTime(hour.open_time)} - {minutesToDisplayTime(hour.close_time)}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {Math.round((hour.close_time - hour.open_time) / 60 * 10) / 10}h
                            </Badge>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  )}
                  
                  {!hour.is_open && (
                    <CardContent className="pt-0">
                      <div className="text-center py-4">
                        <Badge variant="secondary" className="bg-red-50 text-red-700 border-red-200">
                          Closed
                        </Badge>
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>

            {businessHours.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Business Hours Found</h3>
                  <p className="text-muted-foreground text-center">
                    Business hours data is not available. Please contact your system administrator.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </RoleGuard>
  )
}
