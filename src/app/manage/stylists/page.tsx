'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TimePicker } from '@/components/ui/time-picker'
import { Switch } from '@/components/ui/switch'
import { useUser } from '@/contexts/user-context'
import { useIsMobile } from '@/hooks/use-mobile'
import '@/lib/timeUtils'
import { Calendar, Clock, Plus, Settings, Trash2, User, Users } from 'lucide-react'

type StaffMember = {
  ghl_id: string
  first_name: string
  last_name: string
  email: string
  role: string
  phone?: string
  profilePhoto?: string
  [key: string]: unknown // Allow additional properties for working days
}

interface NewUser {
  firstName: string
  lastName: string
  email: string
  phone: string
  password: string
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function StylistsPage() {
  const isMobile = useIsMobile()
  
  // State for staff data and management
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // State for creating new users
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newUser, setNewUser] = useState<NewUser>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: ''
  })

  // Statistics calculated from staff data
  const totalStylists = staff.length
  const activeStylists = staff.filter(member => member.role === 'barber').length
  const adminStylists = staff.filter(member => member.role === 'admin').length

  // Fetch staff data
  const fetchStaff = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/getUsers', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        setStaff(data)
        if (data.length > 0 && !selectedStaff) {
          setSelectedStaff(data[0])
        }
      } else {
        console.error('Failed to fetch staff:', response.statusText)
      }
    } catch (error) {
      console.error('Error fetching staff:', error)
    } finally {
      setIsLoading(false)
    }
  }, [selectedStaff])

  useEffect(() => {
    fetchStaff()
  }, [fetchStaff])

  // Handle working hours updates using minutes-based system
  const handleWorkingHoursUpdate = async (day: string, field: 'is_working' | 'start_time' | 'end_time', value: boolean | number) => {
    if (!selectedStaff) return

    const updatedStaff = { ...selectedStaff }
    
      try {
        const updateData: Record<string, unknown> = { ghl_id: selectedStaff.ghl_id }
        
        if (field === 'is_working') {
        updateData[`${day}_is_working`] = value as boolean
        // If turning off working, set times to 0
        if (!(value as boolean)) {
          updateData[`${day}_start`] = 0
          updateData[`${day}_end`] = 0
        } else {
          // If turning on working, set default times
          updateData[`${day}_start`] = 540 // 9:00 AM
          updateData[`${day}_end`] = 1020 // 5:00 PM
        }
      } else if (field === 'start_time') {
        updateData[`${day}_start`] = value as number
      } else if (field === 'end_time') {
        updateData[`${day}_end`] = value as number
      }

      const response = await fetch('/api/barber-hours', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      })

      if (response.ok) {
        // Update local state
        if (field === 'is_working') {
          updatedStaff[`${day}_is_working`] = value as boolean
          if (!(value as boolean)) {
            updatedStaff[`${day}_start`] = 0
            updatedStaff[`${day}_end`] = 0
          } else {
            updatedStaff[`${day}_start`] = 540
            updatedStaff[`${day}_end`] = 1020
          }
        } else {
          updatedStaff[field === 'start_time' ? `${day}_start` : `${day}_end`] = value as number
        }
        
        setSelectedStaff(updatedStaff)
        setStaff(prevStaff => 
          prevStaff.map(s => s.ghl_id === selectedStaff.ghl_id ? updatedStaff : s)
        )
      }
    } catch (error) {
      console.error('Error updating working hours:', error)
    }
  }

  // Handle creating new user
  const handleCreateUser = async () => {
    try {
      const response = await fetch('/api/create-barber-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          email: newUser.email,
          phone: newUser.phone,
          password: newUser.password,
        }),
      })

      if (response.ok) {
        setNewUser({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          password: ''
        })
        setIsCreateDialogOpen(false)
        await fetchStaff() // Refresh the staff list
      } else {
        console.error('Failed to create user')
      }
    } catch (error) {
      console.error('Error creating user:', error)
    }
  }

  // Handle deleting user
  const handleDeleteUser = async (ghlId: string) => {
    if (confirm('Are you sure you want to delete this stylist?')) {
      try {
        const response = await fetch('/api/deleteUser', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ghl_id: ghlId }),
        })

        if (response.ok) {
          await fetchStaff()
          if (selectedStaff?.ghl_id === ghlId) {
            setSelectedStaff(staff.filter(s => s.ghl_id !== ghlId)[0] || null)
          }
        }
      } catch (error) {
        console.error('Error deleting user:', error)
      }
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Stylists</h1>
          <p className="text-muted-foreground">Manage your team and their schedules</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Stylist
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stylists</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStylists}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Stylists</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeStylists}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Administrators</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{adminStylists}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="schedules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
          <TabsTrigger value="directory">Directory</TabsTrigger>
        </TabsList>

        <TabsContent value="schedules" className="space-y-4">
          {/* Staff Selection Grid */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Select Stylist
              </CardTitle>
              <CardDescription>
                Choose a stylist to view and manage their schedule
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {staff.map((member) => (
                  <Card
                    key={member.ghl_id}
                    className={`cursor-pointer transition-colors hover:bg-accent ${
                      selectedStaff?.ghl_id === member.ghl_id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => setSelectedStaff(member)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium text-sm">{member.first_name} {member.last_name}</h3>
                          <Badge variant={member.role === 'admin' ? 'default' : 'secondary'} className="text-xs">
                            {member.role}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Selected Stylist Schedule */}
          {selectedStaff && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  {selectedStaff.first_name} {selectedStaff.last_name}&apos;s Schedule
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {DAYS.map((day, index) => {
                    const isWorking = Boolean(selectedStaff[`${day}_is_working`])
                    const startTime = Number(selectedStaff[`${day}_start`]) || 540 // 9:00 AM
                    const endTime = Number(selectedStaff[`${day}_end`]) || 1020 // 5:00 PM
                    
                    return (
                      <Card key={day} className="h-fit">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg">{DAY_LABELS[index]}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={isWorking}
                              onCheckedChange={(checked) => 
                                handleWorkingHoursUpdate(day, 'is_working', checked)
                              }
                            />
                            <Label className="text-sm">
                              {isWorking ? 'Working' : 'Not Working'}
                            </Label>
                          </div>
                          
                          {isWorking && (
                            <div className="space-y-3">
                              <div>
                                <Label className="text-xs text-muted-foreground">Start Time</Label>
                                <TimePicker
                                  value={startTime}
                                  onChange={(minutes) => handleWorkingHoursUpdate(day, 'start_time', minutes)}
                                  label=""
                                />
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">End Time</Label>
                                <TimePicker
                                  value={endTime}
                                  onChange={(minutes) => handleWorkingHoursUpdate(day, 'end_time', minutes)}
                                  label=""
                                />
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="directory" className="space-y-4">
          {/* Staff Directory */}
          <Card>
            <CardHeader>
              <CardTitle>Stylist Directory</CardTitle>
              <CardDescription>
                View all stylists and their information
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isMobile ? (
                // Mobile Card View
                <div className="space-y-4">
                  {staff.map((member) => (
                    <Card key={member.ghl_id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="font-medium">
                              {member.first_name} {member.last_name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {member.email}
                            </div>
                            {member.phone && (
                              <div className="text-sm text-muted-foreground">
                                {member.phone}
                              </div>
                            )}
                            <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                              {member.role}
                            </Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(member.ghl_id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                // Desktop Table View
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staff.map((member) => (
                      <TableRow key={member.ghl_id}>
                        <TableCell className="font-medium">
                          {member.first_name} {member.last_name}
                        </TableCell>
                        <TableCell>{member.email}</TableCell>
                        <TableCell>{member.phone || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                            {member.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(member.ghl_id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create User Dialog */}
      {isCreateDialogOpen && (
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Stylist</DialogTitle>
              <DialogDescription>
                Create a new stylist account with login credentials.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={newUser.firstName}
                    onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={newUser.lastName}
                    onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={newUser.phone}
                  onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateUser}>Create Stylist</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}