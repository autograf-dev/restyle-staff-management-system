"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { RoleGuard } from "@/components/role-guard"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { 
  Plus, 
  RefreshCw, 
  Edit, 
  Trash2, 
  MoreHorizontal, 
  Clock, 
  Users, 
  Settings as SettingsIcon,
  Eye,
  EyeOff 
} from "lucide-react"
import React, { useState, useEffect } from "react"
import { toast } from "sonner"

interface Service {
  id: string
  name: string
  description?: string
  duration: number
  price: number
  category?: string
  isActive?: boolean
  groupId?: string
  bufferTimeBefore?: number
  bufferTimeAfter?: number
  maxBookingsPerDay?: number
  createdAt?: string
  updatedAt?: string
  assignedUserIds?: string[]
  assignedStaff?: { id: string; name: string; email: string }[]
  teamMembers?: { userId: string; name: string }[]
  departmentName?: string
}

type Staff = {
  ghl_id: string
  name: string
  email: string
  isActive: boolean
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [staffDialogOpen, setStaffDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    duration: 60,
    price: 0,
    groupId: '',
    bufferTimeBefore: 0,
    bufferTimeAfter: 0,
    maxBookingsPerDay: 0,
    isActive: true
  })

  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([])
  const [allStaff, setAllStaff] = useState<{ [key: string]: { id: string; name: string; email: string } }>({})

  // Fetch all staff to map IDs to names
  const fetchAllStaff = async () => {
    try {
      const response = await fetch('https://restyle-backend.netlify.app/.netlify/functions/Staff')
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      const result = await response.json()
      
      if (result.success) {
        // Create a lookup map: staffId -> staff details
        const staffMap: { [key: string]: { id: string; name: string; email: string } } = {}
        result.staff?.forEach((staff: Record<string, unknown>) => {
          staffMap[staff.id as string] = {
            id: staff.id as string,
            name: (staff.name as string) || `${staff.firstName as string} ${staff.lastName as string}`.trim(),
            email: (staff.email as string) || ''
          }
        })
        setAllStaff(staffMap)
      }
    } catch (error) {
      console.error('Error fetching staff:', error)
    }
  }

  // Fetch services data
  const fetchServices = async () => {
    try {
      setLoading(true)
      const response = await fetch('https://restyle-backend.netlify.app/.netlify/functions/getAllServices')
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const result = await response.json()
      
      if (result.success) {
        // The getAllServices endpoint returns services in the 'calendars' array
        const servicesData = result.calendars || result.services || result.data || []
        
        // Transform the data to include assignedUserIds from teamMembers
        const transformedServices = servicesData.map((service: Record<string, unknown>) => {
          // Debug: log the service object to see available fields
          console.log('Service data:', service)
          
          return {
            ...service,
            // Use the correct duration field from API: slotDuration (in minutes)
            duration: service.slotDuration ? Number(service.slotDuration) : null,
            assignedUserIds: service.teamMembers && Array.isArray(service.teamMembers) 
              ? service.teamMembers.map((member: Record<string, unknown>) => member.userId as string)
              : []
          }
        })
        
        setServices(transformedServices)
      } else {
        throw new Error(result.error || 'Failed to fetch services')
      }
    } catch (error) {
      console.error('Error fetching services:', error)
      toast.error('Failed to load services')
      setServices([])
    } finally {
      setLoading(false)
    }
  }

  // Fetch staff data for assignments using your existing working endpoint
  const fetchStaff = async () => {
    try {
      const response = await fetch('https://restyle-backend.netlify.app/.netlify/functions/Staff')
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const result = await response.json()
      
      // Adapt to your existing Staff endpoint response format
      if (result.success) {
        const staffData = result.staff || result.data || []
        // Transform data to match our expected format
        const formattedStaff = staffData.map((member: Record<string, string | number>) => ({
          id: member.ghl_id || member.id,
          ghl_id: member.ghl_id || member.id,
          name: member["Barber/Name"] || member.name,
          email: member["Barber/Email"] || member.email,
          role: member.role || 'barber'
        }))
        setStaff(formattedStaff)
      } else {
        throw new Error(result.error || 'Failed to fetch staff')
      }
    } catch (error) {
      console.error('Error fetching staff:', error)
      toast.error('Failed to load staff')
    }
  }

  // Create new service
  const createService = async () => {
    if (!formData.name.trim()) {
      toast.error('Service name is required')
      return
    }

    setCreating(true)
    try {
      const response = await fetch('https://restyle-backend.netlify.app/.netlify/functions/createService', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          duration: formData.duration,
          price: formData.price,
          groupId: formData.groupId.trim(),
          bufferTimeBefore: formData.bufferTimeBefore,
          bufferTimeAfter: formData.bufferTimeAfter,
          maxBookingsPerDay: formData.maxBookingsPerDay || undefined,
          isActive: formData.isActive
        })
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Service created successfully!')
        setCreateDialogOpen(false)
        resetForm()
        await fetchServices()
      } else {
        throw new Error(result.error || 'Failed to create service')
      }
    } catch (error) {
      console.error('Error creating service:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create service')
    } finally {
      setCreating(false)
    }
  }

  // Update service
  const updateService = async () => {
    if (!selectedService || !formData.name.trim()) {
      toast.error('Service name is required')
      return
    }

    setUpdating(true)
    try {
      const response = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/updateService?id=${selectedService.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          duration: formData.duration,
          price: formData.price,
          groupId: formData.groupId.trim(),
          bufferTimeBefore: formData.bufferTimeBefore,
          bufferTimeAfter: formData.bufferTimeAfter,
          maxBookingsPerDay: formData.maxBookingsPerDay || undefined,
          isActive: formData.isActive
        })
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Service updated successfully!')
        setEditDialogOpen(false)
        resetForm()
        await fetchServices()
      } else {
        throw new Error(result.error || 'Failed to update service')
      }
    } catch (error) {
      console.error('Error updating service:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update service')
    } finally {
      setUpdating(false)
    }
  }

  // Delete service
  const deleteService = async () => {
    if (!selectedService) return

    setDeleting(true)
    try {
      const response = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/deleteService?id=${selectedService.id}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Service deleted successfully!')
        setDeleteDialogOpen(false)
        setSelectedService(null)
        await fetchServices()
      } else {
        throw new Error(result.error || 'Failed to delete service')
      }
    } catch (error) {
      console.error('Error deleting service:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete service')
    } finally {
      setDeleting(false)
    }
  }

  // Toggle service active status
  const toggleServiceStatus = async (service: Service) => {
    try {
      const response = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/updateService?id=${service.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: !service.isActive
        })
      })

      const result = await response.json()

      if (result.success) {
        toast.success(`Service ${!service.isActive ? 'enabled' : 'disabled'} successfully!`)
        await fetchServices()
      } else {
        throw new Error(result.error || 'Failed to update service status')
      }
    } catch (error) {
      console.error('Error updating service status:', error)
      toast.error('Failed to update service status')
    }
  }

  // Assign staff to service - DISABLED (using your existing staff system)
  const assignStaffToService = async () => {
    toast.info('Staff assignment feature coming soon! Currently using your existing staff system.')
    // TODO: Integrate with your existing staff assignment system when ready
    setStaffDialogOpen(false)
    setSelectedStaffIds([])
  }

  // Helper functions
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      duration: 60,
      price: 0,
      groupId: '',
      bufferTimeBefore: 0,
      bufferTimeAfter: 0,
      maxBookingsPerDay: 0,
      isActive: true
    })
    setSelectedService(null)
  }

  const openEditDialog = (service: Service) => {
    setSelectedService(service)
    setFormData({
      name: service.name,
      description: service.description || '',
      duration: service.duration,
      price: service.price || 0,
      groupId: service.groupId || '',
      bufferTimeBefore: service.bufferTimeBefore || 0,
      bufferTimeAfter: service.bufferTimeAfter || 0,
      maxBookingsPerDay: service.maxBookingsPerDay || 0,
      isActive: service.isActive ?? true
    })
    setEditDialogOpen(true)
  }

  const openStaffDialog = (service: Service) => {
    setSelectedService(service)
    setSelectedStaffIds(service.assignedUserIds || [])
    setStaffDialogOpen(true)
  }

  const openDeleteDialog = (service: Service) => {
    setSelectedService(service)
    setDeleteDialogOpen(true)
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
    }
    return `${mins}m`
  }

  useEffect(() => {
    fetchServices()
    fetchStaff()
    fetchAllStaff()
  }, [])

  return (
    <RoleGuard>
      <TooltipProvider>
        <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <div className="flex items-center justify-between w-full px-4">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4" />
                <h1 className="text-xl font-semibold">Services</h1>
              </div>
              <Button onClick={() => setCreateDialogOpen(true)} className="bg-primary text-primary-foreground">
                <Plus className="h-4 w-4 mr-2" />
                Add Service
              </Button>
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Services</CardTitle>
                  <SettingsIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{services.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Services</CardTitle>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{services.filter(s => s.isActive).length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Inactive Services</CardTitle>
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{services.filter(s => !s.isActive).length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average Duration</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {services.length > 0 
                      ? (() => {
                          const validDurations = services.filter(s => s.duration && typeof s.duration === 'number' && s.duration > 0)
                          return validDurations.length > 0
                            ? formatDuration(Math.round(validDurations.reduce((sum: number, s) => sum + (s.duration as number), 0) / validDurations.length))
                            : 'Not set'
                        })()
                      : '0m'
                    }
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Services Table */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Services Management</CardTitle>
                  <CardDescription>
                    Manage your salon services, pricing, and staff assignments
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  onClick={fetchServices} 
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                    Loading services...
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Service</TableHead>
                          <TableHead>Duration</TableHead>
                          <TableHead>Staff</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {services.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center">
                              No services found. Create your first service!
                            </TableCell>
                          </TableRow>
                        ) : (
                          services.map((service) => (
                            <TableRow key={service.id}>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{service.name}</div>
                                  {service.description && (
                                    <div className="text-sm text-muted-foreground">
                                      {service.description.replace(/<[^>]*>/g, '')}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                  {service.duration && typeof service.duration === 'number' && service.duration > 0
                                    ? formatDuration(service.duration)
                                    : <span className="text-muted-foreground">Not set</span>
                                  }
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Users className="h-4 w-4 text-muted-foreground" />
                                  <span>{service.assignedUserIds?.length || 0} assigned</span>
                                </div>
                                {service.assignedUserIds && service.assignedUserIds.length > 0 ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="text-xs text-muted-foreground mt-1 cursor-pointer hover:text-foreground transition-colors">
                                        {service.assignedUserIds.slice(0, 2).map(userId => allStaff[userId]?.name || userId).join(', ')}
                                        {service.assignedUserIds.length > 2 && ` +${service.assignedUserIds.length - 2} more`}
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs">
                                      <div className="space-y-1">
                                        <div className="font-medium text-sm">All Assigned Staff:</div>
                                        <div className="text-xs">
                                          {service.assignedUserIds.map(userId => allStaff[userId]?.name || userId).join(', ')}
                                        </div>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    No staff assigned
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={service.isActive}
                                    onCheckedChange={() => toggleServiceStatus(service)}
                                  />
                                  <Badge variant={service.isActive ? "default" : "secondary"}>
                                    {service.isActive ? "Active" : "Inactive"}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openStaffDialog(service)}
                                  >
                                    <Users className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openEditDialog(service)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openDeleteDialog(service)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Create Service Dialog */}
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Service</DialogTitle>
                <DialogDescription>
                  Add a new service to your salon offerings
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Service Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Hair Cut, Hair Color, Styling"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of the service..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="duration">Duration (minutes) *</Label>
                    <Input
                      id="duration"
                      type="number"
                      min="1"
                      max="480"
                      value={formData.duration}
                      onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) || 60 }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="price">Price (CAD)</Label>
                    <Input
                      id="price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="groupId">Group ID (optional)</Label>
                  <Input
                    id="groupId"
                    value={formData.groupId}
                    onChange={(e) => setFormData(prev => ({ ...prev, groupId: e.target.value }))}
                    placeholder="Service group identifier"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="bufferBefore">Buffer Before (min)</Label>
                    <Input
                      id="bufferBefore"
                      type="number"
                      min="0"
                      max="60"
                      value={formData.bufferTimeBefore}
                      onChange={(e) => setFormData(prev => ({ ...prev, bufferTimeBefore: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="bufferAfter">Buffer After (min)</Label>
                    <Input
                      id="bufferAfter"
                      type="number"
                      min="0"
                      max="60"
                      value={formData.bufferTimeAfter}
                      onChange={(e) => setFormData(prev => ({ ...prev, bufferTimeAfter: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="maxBookings">Max Bookings/Day</Label>
                    <Input
                      id="maxBookings"
                      type="number"
                      min="0"
                      value={formData.maxBookingsPerDay}
                      onChange={(e) => setFormData(prev => ({ ...prev, maxBookingsPerDay: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="active"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                  />
                  <Label htmlFor="active">Active service</Label>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createService} disabled={creating}>
                  {creating ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Service'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Edit Service Dialog */}
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit Service</DialogTitle>
                <DialogDescription>
                  Update service details and configuration
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">Service Name *</Label>
                  <Input
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Hair Cut, Hair Color, Styling"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={formData.description}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of the service..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-duration">Duration (minutes) *</Label>
                    <Input
                      id="edit-duration"
                      type="number"
                      min="1"
                      max="480"
                      value={formData.duration}
                      onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) || 60 }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-price">Price (CAD)</Label>
                    <Input
                      id="edit-price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-groupId">Group ID (optional)</Label>
                  <Input
                    id="edit-groupId"
                    value={formData.groupId}
                    onChange={(e) => setFormData(prev => ({ ...prev, groupId: e.target.value }))}
                    placeholder="Service group identifier"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-bufferBefore">Buffer Before (min)</Label>
                    <Input
                      id="edit-bufferBefore"
                      type="number"
                      min="0"
                      max="60"
                      value={formData.bufferTimeBefore}
                      onChange={(e) => setFormData(prev => ({ ...prev, bufferTimeBefore: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-bufferAfter">Buffer After (min)</Label>
                    <Input
                      id="edit-bufferAfter"
                      type="number"
                      min="0"
                      max="60"
                      value={formData.bufferTimeAfter}
                      onChange={(e) => setFormData(prev => ({ ...prev, bufferTimeAfter: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-maxBookings">Max Bookings/Day</Label>
                    <Input
                      id="edit-maxBookings"
                      type="number"
                      min="0"
                      value={formData.maxBookingsPerDay}
                      onChange={(e) => setFormData(prev => ({ ...prev, maxBookingsPerDay: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="edit-active"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                  />
                  <Label htmlFor="edit-active">Active service</Label>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={updateService} disabled={updating}>
                  {updating ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update Service'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Staff Assignment Dialog */}
          <Dialog open={staffDialogOpen} onOpenChange={setStaffDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Assign Staff</DialogTitle>
                <DialogDescription>
                  Select staff members who can provide this service
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  {staff.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      No staff members found
                    </p>
                  ) : (
                    staff.map((member) => (
                      <div key={member.ghl_id} className="flex items-center gap-3 p-2 border rounded">
                        <input
                          type="checkbox"
                          id={`staff-${member.ghl_id}`}
                          checked={selectedStaffIds.includes(member.ghl_id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStaffIds(prev => [...prev, member.ghl_id])
                            } else {
                              setSelectedStaffIds(prev => prev.filter(id => id !== member.ghl_id))
                            }
                          }}
                        />
                        <label htmlFor={`staff-${member.ghl_id}`} className="flex-1 cursor-pointer">
                          <div className="font-medium">{member.name}</div>
                          <div className="text-sm text-muted-foreground">{member.email}</div>
                        </label>
                        <Badge variant={member.isActive ? "default" : "secondary"}>
                          {member.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setStaffDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={assignStaffToService} disabled={selectedStaffIds.length === 0}>
                  Assign Selected Staff
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Service</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete this service? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              {selectedService && (
                <div className="py-4">
                  <div className="p-4 border rounded-lg bg-destructive/10">
                    <h4 className="font-medium text-destructive">{selectedService.name}</h4>
                    {selectedService.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedService.description}
                      </p>
                    )}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={deleteService} disabled={deleting}>
                  {deleting ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete Service'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </SidebarInset>
      </SidebarProvider>
      </TooltipProvider>
    </RoleGuard>
  )
}