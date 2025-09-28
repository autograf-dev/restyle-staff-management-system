"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { RoleGuard } from "@/components/role-guard"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { 
  Plus, 
  RefreshCw, 
  Edit, 
  Trash2, 
  DollarSign, 
  Clock, 
  Users, 
  Settings as SettingsIcon,
  AlertTriangle,
  CheckCircle,
  Star,
  Sparkles
} from "lucide-react"
import React, { useState, useEffect } from "react"
import { toast } from "sonner"
import { useIsMobile } from "@/hooks/use-mobile"

interface Service {
  id: string
  name: string
  description?: string
  slotDuration?: number
  slotDurationUnit?: 'mins' | 'hours'
  duration?: number // computed from slotDuration + unit
  teamMembers?: { userId: string; name?: string }[]
}

interface StaffOption {
  value: string
  label: string
  id: string
  name: string
  email: string
}

type ServiceFormData = {
  name: string
  description: string
  duration: number
  durationUnit: 'mins' | 'hours'
  price: string
  currency: string
  selectedStaff: string[]
  autoConfirm: boolean
  allowReschedule: boolean
  allowCancellation: boolean
  slotInterval: number
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [staffDialogOpen, setStaffDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [assigningStaff, setAssigningStaff] = useState(false)
  const isMobile = useIsMobile()

  // Form states - matching GoHighLevel service creation
  const [formData, setFormData] = useState<ServiceFormData>({
    name: '',
    description: '',
    duration: 60,
    durationUnit: 'mins',
    price: '0.00',
    currency: 'CA$',
    selectedStaff: [],
    autoConfirm: true,
    allowReschedule: true,
    allowCancellation: true,
    slotInterval: 15
  })

  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([])

  // Fetch available staff for dropdown using new getAvailableStaff endpoint
  const fetchAvailableStaff = async () => {
    try {
      const response = await fetch('https://restyle-backend.netlify.app/.netlify/functions/getAvailableStaff')
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      const result = await response.json()
      
      if (result.success && result.dropdownOptions) {
        setStaffOptions(result.dropdownOptions)
        toast.success(`Loaded ${result.totalStaff} staff members`)
      }
    } catch (error) {
      console.error('Error fetching available staff:', error)
      toast.error('Failed to load staff options')
    }
  }

  // Fetch services data using getAllServices endpoint
  const fetchServices = async () => {
    try {
      setLoading(true)
      const response = await fetch('https://restyle-backend.netlify.app/.netlify/functions/getAllServices')
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const result = await response.json()
      
      if (result.success) {
        const servicesData = result.calendars || []
        
        // Transform the data to include computed duration
        const transformedServices = servicesData.map((service: Record<string, unknown>) => ({
          ...service,
          duration: service.slotDuration ? (() => {
            const duration = Number(service.slotDuration)
            const unit = service.slotDurationUnit as string
            return unit === 'hours' ? duration * 60 : duration
          })() : 60
        }))
        
        setServices(transformedServices)
        toast.success(`Loaded ${transformedServices.length} services`)
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

  // Create new service using createFullService endpoint
  const createService = async () => {
    if (!formData.name.trim()) {
      toast.error('Service name is required')
      return
    }

    if (formData.selectedStaff.length === 0) {
      toast.error('Please select at least one staff member')
      return
    }

    setCreating(true)
    try {
      const response = await fetch('https://restyle-backend.netlify.app/.netlify/functions/createFullService', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          duration: formData.duration,
          durationUnit: formData.durationUnit,
          price: formData.price,
          currency: formData.currency,
          selectedStaff: formData.selectedStaff,
          slotInterval: formData.slotInterval,
          autoConfirm: formData.autoConfirm,
          allowReschedule: formData.allowReschedule,
          allowCancellation: formData.allowCancellation
        })
      })

      const result = await response.json()

      if (result.success) {
        toast.success('✅ Service created successfully!')
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

  // Update service using updateFullService endpoint
  const updateService = async () => {
    if (!selectedService || !formData.name.trim()) {
      toast.error('Service name is required')
      return
    }

    setUpdating(true)
    try {
      const response = await fetch('https://restyle-backend.netlify.app/.netlify/functions/updateFullService', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceId: selectedService.id,
          name: formData.name.trim(),
          description: formData.description.trim(),
          duration: formData.duration,
          durationUnit: formData.durationUnit,
          price: formData.price,
          selectedStaff: formData.selectedStaff
        })
      })

      const result = await response.json()

      if (result.success) {
        toast.success('✅ Service updated successfully!')
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

  // Delete service using deleteFullService endpoint
  const deleteService = async () => {
    if (!selectedService) return

    setDeleting(true)
    try {
      const response = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/deleteFullService?serviceId=${selectedService.id}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        toast.success('✅ Service deleted successfully!')
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

  // Assign/remove staff using manageServiceStaff endpoint
  const manageStaff = async (action: 'assign' | 'remove' | 'replace') => {
    if (!selectedService) return

    setAssigningStaff(true)
    try {
      const response = await fetch('https://restyle-backend.netlify.app/.netlify/functions/manageServiceStaff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceId: selectedService.id,
          action,
          staffIds: selectedStaffIds
        })
      })

      const result = await response.json()

      if (result.success) {
        toast.success(`✅ Staff ${action}ed successfully!`)
        setStaffDialogOpen(false)
        setSelectedStaffIds([])
        await fetchServices()
      } else {
        throw new Error(result.error || `Failed to ${action} staff`)
      }
    } catch (error) {
      console.error(`Error ${action}ing staff:`, error)
      toast.error(`Failed to ${action} staff`)
    } finally {
      setAssigningStaff(false)
    }
  }

  // Helper functions
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      duration: 60,
      durationUnit: 'mins',
      price: '0.00',
      currency: 'CA$',
      selectedStaff: [],
      autoConfirm: true,
      allowReschedule: true,
      allowCancellation: true,
      slotInterval: 15
    })
    setSelectedService(null)
  }

  const openEditDialog = (service: Service) => {
    setSelectedService(service)
    
    // Parse existing price from description or use default
    const priceMatch = service.description?.match(/CA\$(\d+(?:\.\d{2})?)/);
    const existingPrice = priceMatch ? priceMatch[1] : '0.00';
    
    // Get assigned staff IDs
    const assignedStaffIds = service.teamMembers?.map(member => member.userId) || [];
    
    setFormData({
      name: service.name,
      description: service.description || '',
      duration: service.duration || 60,
      durationUnit: service.slotDurationUnit || 'mins',
      price: existingPrice,
      currency: 'CA$',
      selectedStaff: assignedStaffIds,
      autoConfirm: true,
      allowReschedule: true,
      allowCancellation: true,
      slotInterval: 15
    })
    setEditDialogOpen(true)
  }

  const openStaffDialog = (service: Service) => {
    setSelectedService(service)
    const assignedStaffIds = service.teamMembers?.map(member => member.userId) || [];
    setSelectedStaffIds(assignedStaffIds)
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

  const handleStaffSelection = (staffId: string, checked: boolean) => {
    if (checked) {
      setSelectedStaffIds(prev => [...prev, staffId])
    } else {
      setSelectedStaffIds(prev => prev.filter(id => id !== staffId))
    }
  }

  const handleFormStaffSelection = (staffId: string, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({ ...prev, selectedStaff: [...prev.selectedStaff, staffId] }))
    } else {
      setFormData(prev => ({ ...prev, selectedStaff: prev.selectedStaff.filter(id => id !== staffId) }))
    }
  }

  const getStaffNameById = (userId: string) => {
    const staff = staffOptions.find(s => s.value === userId);
    return staff ? staff.name : 'Unknown';
  }

  useEffect(() => {
    fetchServices()
    fetchAvailableStaff()
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
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h1 className="text-xl font-semibold">Services Management</h1>
                </div>
              </div>
              <Button onClick={() => setCreateDialogOpen(true)} className="bg-primary text-primary-foreground">
                <Plus className="h-4 w-4 mr-2" />
                Create Service
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
                  <p className="text-xs text-muted-foreground">
                    All salon services
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Available Staff</CardTitle>
                  <Users className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{staffOptions.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Ready to assign
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
                  <Clock className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    {services.length > 0 
                      ? (() => {
                          const validDurations = services.filter(s => s.duration && s.duration > 0)
                          return validDurations.length > 0
                            ? formatDuration(Math.round(validDurations.reduce((sum, s) => sum + (s.duration as number), 0) / validDurations.length))
                            : '0m'
                        })()
                      : '0m'
                    }
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Service duration
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Staff Assignments</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {services.reduce((total, service) => total + (service.teamMembers?.length || 0), 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Total assignments
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Services List */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-500" />
                    Services Overview
                  </CardTitle>
                  <CardDescription>
                    GoHighLevel-style service management with comprehensive staff assignments
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
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-8 w-8 animate-spin mr-3 text-primary" />
                    <div>
                      <p className="font-medium">Loading services...</p>
                      <p className="text-sm text-muted-foreground">Fetching from API</p>
                    </div>
                  </div>
                ) : (
                  isMobile ? (
                    <div className="grid gap-3">
                      {services.length === 0 ? (
                        <Card>
                          <CardContent className="p-6 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <div className="p-4 rounded-full bg-muted">
                                <SettingsIcon className="h-8 w-8 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="font-medium">No services found</p>
                                <p className="text-sm text-muted-foreground">Create your first service to get started!</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ) : (
                        services.map((service) => (
                          <Card key={service.id}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="font-medium leading-tight flex items-center gap-2">
                                    {service.name}
                                    <Badge variant="outline" className="text-[10px]">Service</Badge>
                                  </div>
                                  {service.description && (
                                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                      {service.description.replace(/<[^>]*>/g, '')}
                                    </div>
                                  )}
                                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                      {service.duration && service.duration > 0 ? formatDuration(service.duration) : 'Not set'}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                      {service.teamMembers?.length || 0} staff
                                    </span>
                                    <span className="flex items-center gap-1 text-green-700">
                                      <DollarSign className="h-3.5 w-3.5" />
                                      {(() => {
                                        const priceMatch = service.description?.match(/CA\$(\d+(?:\.\d{2})?)/)
                                        return priceMatch ? `CA$${priceMatch[1]}` : 'Not set'
                                      })()}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => openStaffDialog(service)}
                                    className="h-8 w-8"
                                  >
                                    <Users className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => openEditDialog(service)}
                                    className="h-8 w-8"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => openDeleteDialog(service)}
                                    className="h-8 w-8 hover:bg-destructive hover:text-destructive-foreground"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[300px]">Service Details</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Assigned Staff</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {services.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="h-32 text-center">
                                <div className="flex flex-col items-center gap-3">
                                  <div className="p-4 rounded-full bg-muted">
                                    <SettingsIcon className="h-8 w-8 text-muted-foreground" />
                                  </div>
                                  <div>
                                    <p className="font-medium">No services found</p>
                                    <p className="text-sm text-muted-foreground">Create your first service to get started!</p>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : (
                            services.map((service) => (
                              <TableRow key={service.id} className="hover:bg-muted/50">
                                <TableCell>
                                  <div className="space-y-1">
                                    <div className="font-medium flex items-center gap-2">
                                      {service.name}
                                      <Badge variant="outline" className="text-xs">Service</Badge>
                                    </div>
                                    {service.description && (
                                      <div className="text-sm text-muted-foreground max-w-xs line-clamp-2">
                                        {service.description.replace(/<[^>]*>/g, '').substring(0, 120)}
                                        {service.description.length > 120 ? '...' : ''}
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">
                                      {service.duration && service.duration > 0
                                        ? formatDuration(service.duration)
                                        : <span className="text-muted-foreground italic">Not set</span>
                                      }
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <Users className="h-4 w-4 text-muted-foreground" />
                                      <span className="font-medium">{service.teamMembers?.length || 0} staff</span>
                                    </div>
                                    {service.teamMembers && service.teamMembers.length > 0 ? (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="text-xs text-blue-600 cursor-pointer hover:underline">
                                            {service.teamMembers.slice(0, 2).map(member => 
                                              getStaffNameById(member.userId)
                                            ).join(', ')}
                                            {service.teamMembers.length > 2 && ` +${service.teamMembers.length - 2} more`}
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-xs">
                                          <div className="space-y-1">
                                            <div className="font-medium text-sm">All Assigned Staff:</div>
                                            <div className="text-xs">
                                              {service.teamMembers.map(member => 
                                                getStaffNameById(member.userId)
                                              ).join(', ')}
                                            </div>
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    ) : (
                                      <div className="text-xs text-muted-foreground italic">
                                        No staff assigned
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <DollarSign className="h-4 w-4 text-green-600" />
                                    <span className="font-medium text-green-600">
                                      {(() => {
                                        const priceMatch = service.description?.match(/CA\$(\d+(?:\.\d{2})?)/);
                                        return priceMatch ? `CA$${priceMatch[1]}` : 'Not set';
                                      })()}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => openStaffDialog(service)}
                                          className="h-8 w-8 p-0"
                                        >
                                          <Users className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Manage Staff</TooltipContent>
                                    </Tooltip>
                                    
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => openEditDialog(service)}
                                          className="h-8 w-8 p-0"
                                        >
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Edit Service</TooltipContent>
                                    </Tooltip>
                                    
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => openDeleteDialog(service)}
                                          className="h-8 w-8 p-0 hover:bg-destructive hover:text-destructive-foreground"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Delete Service</TooltipContent>
                                    </Tooltip>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )
                )}
              </CardContent>
            </Card>
          </div>

          {/* Create Service Dialog - GoHighLevel Style */}
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Create New Service
                </DialogTitle>
                <DialogDescription>
                  Create a professional service with pricing, duration, and staff assignments
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                {/* Basic Information */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <SettingsIcon className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium">Basic Information</h3>
                  </div>
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Service Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g., Premium Haircut, Hair Coloring, Facial Treatment"
                        className="text-base"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="description">Service Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Describe what this service includes, benefits, and any special features..."
                        rows={4}
                        className="text-base"
                      />
                    </div>
                  </div>
                </div>

                {/* Duration & Pricing */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium">Duration & Pricing</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="duration">Service Duration *</Label>
                      <div className="flex gap-2">
                        <Input
                          id="duration"
                          type="number"
                          min="5"
                          max="480"
                          value={formData.duration}
                          onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) || 60 }))}
                          className="flex-1"
                          placeholder="60"
                        />
                        <Select 
                          value={formData.durationUnit} 
                          onValueChange={(value) => setFormData(prev => ({ ...prev, durationUnit: value as 'mins' | 'hours' }))}
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mins">Minutes</SelectItem>
                            <SelectItem value="hours">Hours</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="price">Service Price</Label>
                      <div className="flex gap-2">
                        <Select 
                          value={formData.currency} 
                          onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
                        >
                          <SelectTrigger className="w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CA$">CA$</SelectItem>
                            <SelectItem value="US$">US$</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          id="price"
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.price}
                          onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                          placeholder="85.00"
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Staff Assignment */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium">Staff Assignment</h3>
                  </div>
                  <div className="border rounded-lg p-4 max-h-60 overflow-y-auto bg-muted/30">
                    {staffOptions.length === 0 ? (
                      <div className="text-center py-6">
                        <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-muted-foreground">No staff members available</p>
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {staffOptions.map((staff) => (
                          <div key={staff.value} className="flex items-center space-x-3 p-2 rounded border bg-background hover:bg-muted/50">
                            <Checkbox
                              id={`create-staff-${staff.value}`}
                              checked={formData.selectedStaff.includes(staff.value)}
                              onCheckedChange={(checked) => 
                                handleFormStaffSelection(staff.value, checked as boolean)
                              }
                            />
                            <div className="flex-1 grid gap-1">
                              <label htmlFor={`create-staff-${staff.value}`} className="text-sm font-medium cursor-pointer">
                                {staff.name}
                              </label>
                              <p className="text-xs text-muted-foreground">{staff.email}</p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              Available
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    💡 Select staff members who can provide this service. At least one is required.
                  </p>
                </div>

                {/* Service Settings */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium">Service Settings</h3>
                  </div>
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="slotInterval">Appointment Time Slots</Label>
                      <Select 
                        value={formData.slotInterval.toString()} 
                        onValueChange={(value) => setFormData(prev => ({ ...prev, slotInterval: parseInt(value) }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">Every 15 minutes</SelectItem>
                          <SelectItem value="30">Every 30 minutes</SelectItem>
                          <SelectItem value="60">Every hour</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="autoConfirm"
                          checked={formData.autoConfirm}
                          onCheckedChange={(checked) => 
                            setFormData(prev => ({ ...prev, autoConfirm: checked as boolean }))
                          }
                        />
                        <Label htmlFor="autoConfirm" className="text-sm">Auto-confirm appointments</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="allowReschedule"
                          checked={formData.allowReschedule}
                          onCheckedChange={(checked) => 
                            setFormData(prev => ({ ...prev, allowReschedule: checked as boolean }))
                          }
                        />
                        <Label htmlFor="allowReschedule" className="text-sm">Allow rescheduling</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="allowCancellation"
                          checked={formData.allowCancellation}
                          onCheckedChange={(checked) => 
                            setFormData(prev => ({ ...prev, allowCancellation: checked as boolean }))
                          }
                        />
                        <Label htmlFor="allowCancellation" className="text-sm">Allow cancellation</Label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createService} disabled={creating} className="bg-primary">
                  {creating ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Creating Service...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Service
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Edit Service Sidebar */}
          <Sheet open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <SheetContent side="right" className="w-[600px] sm:w-[700px]">
              <SheetHeader className="pb-6">
                <SheetTitle className="flex items-center gap-3 text-xl">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                    <Edit className="h-5 w-5 text-primary" />
                  </div>
                  Edit Service
                </SheetTitle>
                <SheetDescription className="text-base text-muted-foreground">
                  Update details for <span className="font-semibold text-foreground">{selectedService?.name}</span>
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-col h-full">
                <div className="flex-1 space-y-8 overflow-y-auto pr-2">
                  
                  {/* Service Basic Information */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <SettingsIcon className="h-5 w-5 text-primary" />
                      <h3 className="text-lg font-semibold">Service Information</h3>
                    </div>
                    
                    <div className="space-y-5">
                      <div className="space-y-3">
                        <Label htmlFor="edit-name" className="text-base font-medium">Service Name *</Label>
                        <Input
                          id="edit-name"
                          value={formData.name}
                          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                          className="text-base h-11"
                          placeholder="Enter service name..."
                        />
                      </div>

                      <div className="space-y-3">
                        <Label htmlFor="edit-description" className="text-base font-medium">Service Description</Label>
                        <Textarea
                          id="edit-description"
                          value={formData.description}
                          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Describe what this service includes..."
                          className="min-h-[120px] resize-none text-base"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Pricing & Duration */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <DollarSign className="h-5 w-5 text-primary" />
                      <h3 className="text-lg font-semibold">Pricing & Duration</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <Label htmlFor="edit-duration" className="text-base font-medium">Service Duration *</Label>
                        <div className="flex gap-3">
                          <Input
                            id="edit-duration"
                            type="number"
                            min="5"
                            max="480"
                            value={formData.duration}
                            onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) || 60 }))}
                            className="flex-1 h-11 text-base"
                            placeholder="60"
                          />
                          <Select 
                            value={formData.durationUnit} 
                            onValueChange={(value) => setFormData(prev => ({ ...prev, durationUnit: value as 'mins' | 'hours' }))}
                          >
                            <SelectTrigger className="w-32 h-11">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="mins">Minutes</SelectItem>
                              <SelectItem value="hours">Hours</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label htmlFor="edit-price" className="text-base font-medium">Service Price *</Label>
                        <div className="flex gap-3">
                          <Select 
                            value={formData.currency} 
                            onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
                          >
                            <SelectTrigger className="w-24 h-11">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CA$">CA$</SelectItem>
                              <SelectItem value="US$">US$</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            id="edit-price"
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.price}
                            onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                            className="flex-1 h-11 text-base"
                            placeholder="85.00"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Staff Assignment */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <Users className="h-5 w-5 text-primary" />
                      <h3 className="text-lg font-semibold">Staff Assignment</h3>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-medium">Assigned Staff Members</Label>
                        <Badge variant="secondary" className="text-sm">
                          {formData.selectedStaff.length} selected
                        </Badge>
                      </div>
                      
                      <div className="border rounded-xl p-4 max-h-64 overflow-y-auto bg-muted/30">
                        {staffOptions.length === 0 ? (
                          <div className="text-center py-8">
                            <Users className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
                            <p className="text-muted-foreground font-medium">No staff members available</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {staffOptions.map((staff) => (
                              <div key={staff.value} className="flex items-center space-x-4 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors">
                                <Checkbox
                                  id={`edit-staff-${staff.value}`}
                                  checked={formData.selectedStaff.includes(staff.value)}
                                  onCheckedChange={(checked) => 
                                    handleFormStaffSelection(staff.value, checked as boolean)
                                  }
                                  className="w-5 h-5"
                                />
                                <div className="flex-1">
                                  <label htmlFor={`edit-staff-${staff.value}`} className="text-base font-medium cursor-pointer block">
                                    {staff.name}
                                  </label>
                                  <p className="text-sm text-muted-foreground">{staff.email}</p>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  Available
                                </Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex gap-3">
                          <div className="flex-shrink-0">
                            <Users className="h-5 w-5 text-amber-600" />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-amber-900">Staff Assignment Required</h4>
                            <p className="text-sm text-amber-700 mt-1">
                              At least one staff member must be assigned to provide this service. Select qualified team members.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="border-t pt-6 mt-6">
                  <div className="flex justify-between gap-4">
                    <Button 
                      variant="outline" 
                      onClick={() => setEditDialogOpen(false)}
                      className="px-6 h-11 text-base"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={updateService} 
                      disabled={updating}
                      className="bg-[#601625] hover:bg-[#751a29] px-8 h-11 text-base font-semibold"
                    >
                      {updating ? (
                        <>
                          <RefreshCw className="h-5 w-5 mr-3 animate-spin" />
                          Updating Service...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-5 w-5 mr-3" />
                          Update Service
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* Advanced Staff Management Sidebar */}
          <Sheet open={staffDialogOpen} onOpenChange={setStaffDialogOpen}>
            <SheetContent side="right" className="w-[480px] sm:w-[540px]">
              <SheetHeader className="pb-6">
                <SheetTitle className="flex items-center gap-3 text-xl">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  Staff Management
                </SheetTitle>
                <SheetDescription className="text-base text-muted-foreground">
                  Manage staff assignment for <span className="font-semibold text-foreground">{selectedService?.name}</span>
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-col h-full">
                <div className="flex-1 space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">Available Staff Members</Label>
                      <Badge variant="secondary" className="text-sm">
                        {selectedStaffIds.length} selected
                      </Badge>
                    </div>
                    
                    <div className="border rounded-xl p-4 max-h-[calc(100vh-280px)] overflow-y-auto bg-muted/30">
                      {staffOptions.length === 0 ? (
                        <div className="text-center py-12">
                          <Users className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                          <p className="text-muted-foreground text-base font-medium">No staff members available</p>
                          <p className="text-sm text-muted-foreground mt-2">Add staff members to assign them to services</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {staffOptions.map((staff) => {
                            const isCurrentlyAssigned = selectedService?.teamMembers?.some(member => member.userId === staff.value);
                            return (
                              <div key={staff.value} className="flex items-center space-x-4 p-4 rounded-lg border-2 bg-background hover:bg-muted/50 transition-colors duration-200">
                                <Checkbox
                                  id={`staff-manage-${staff.value}`}
                                  checked={selectedStaffIds.includes(staff.value)}
                                  onCheckedChange={(checked) => 
                                    handleStaffSelection(staff.value, checked as boolean)
                                  }
                                  className="w-5 h-5"
                                />
                                <div className="flex-1 space-y-1">
                                  <label htmlFor={`staff-manage-${staff.value}`} className="text-base font-semibold cursor-pointer block">
                                    {staff.name}
                                  </label>
                                  <p className="text-sm text-muted-foreground">{staff.email}</p>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  {isCurrentlyAssigned && (
                                    <Badge variant="default" className="text-xs font-medium">
                                      Currently Assigned
                                    </Badge>
                                  )}
                                  <Badge variant="outline" className="text-xs">
                                    Available
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex gap-3">
                        <div className="flex-shrink-0">
                          <Users className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-blue-900">Staff Assignment Tips</h4>
                          <p className="text-sm text-blue-700 mt-1">
                            Select staff members who are qualified to provide this service. You can assign multiple staff members to increase availability.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="border-t pt-6 mt-6">
                  <div className="flex justify-between gap-4">
                    <Button 
                      variant="outline" 
                      onClick={() => setStaffDialogOpen(false)}
                      className="px-6 h-11 text-base"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => manageStaff('replace')} 
                      disabled={assigningStaff}
                      className="bg-[#601625] hover:bg-[#751a29] px-8 h-11 text-base font-semibold"
                    >
                      {assigningStaff ? (
                        <>
                          <RefreshCw className="h-5 w-5 mr-3 animate-spin" />
                          Updating Assignment...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-5 w-5 mr-3" />
                          Update Assignment
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* Delete Confirmation Dialog */}
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Delete Service
                </DialogTitle>
                <DialogDescription>
                  Are you sure you want to permanently delete this service? This action cannot be undone and will remove all associated appointments and staff assignments.
                </DialogDescription>
              </DialogHeader>
              {selectedService && (
                <div className="py-4">
                  <div className="p-4 border rounded-lg bg-destructive/10 border-destructive/20">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                      <div className="space-y-2">
                        <h4 className="font-medium text-destructive">{selectedService.name}</h4>
                        {selectedService.description && (
                          <p className="text-sm text-muted-foreground">
                            {selectedService.description.replace(/<[^>]*>/g, '')}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {selectedService.duration ? formatDuration(selectedService.duration) : 'Duration not set'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {selectedService.teamMembers?.length || 0} staff assigned
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-4 border-t">
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
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Service
                    </>
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