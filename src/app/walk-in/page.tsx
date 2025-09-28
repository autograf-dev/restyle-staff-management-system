"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { RoleGuard } from "@/components/role-guard"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator as UISeparator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { 
  DollarSign, 
  Clock, 
  User as UserIcon, 
  CreditCard,
  ArrowLeft,
  AlertCircle,
  Loader2,
  Receipt,
  Users,
  Plus,
  Scissors,
  Sparkles,
  Heart,
  Crown,
  Zap,
  Flame,
  Star,
  Gem,
  CheckCircle,
  Trash2
} from "lucide-react"
import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface Customer {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  fullName: string
}

interface ContactResponse {
  id: string | number
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  contactName?: string
}

interface Staff {
  ghl_id: string
  name: string
  email?: string
}

interface Service {
  id: string
  name: string
  price: number
  duration: number
  description?: string
  title?: string
  servicePrice?: number
  durationMinutes?: number
  teamMembers?: Array<{
    userId: string
    priority: number
    selected: boolean
  }>
}

interface Group {
  id: string
  name: string
  description: string
  slug: string
  isActive: boolean
}

interface GroupServices {
  [groupId: string]: Service[]
}

interface TipDistribution {
  staffName: string
  sharePercentage: number
  tipShare: number
  totalEarning: number
  totalServicePrice: number
}

export default function WalkInPage() {
  const router = useRouter()
  
  // State
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedServices, setSelectedServices] = useState<Array<{
    service: Service
    staff: Staff
    id: string
  }>>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [staffData, setStaffData] = useState<Array<{ ghl_id: string; name: string }>>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [groupServices, setGroupServices] = useState<GroupServices>({})
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  
  // Loading states
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [processingCheckout, setProcessingCheckout] = useState(false)
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  
  // Form state
  const [customerSearch, setCustomerSearch] = useState('')
  const [tipPercentage, setTipPercentage] = useState(18)
  const [customTipAmount, setCustomTipAmount] = useState('')
  const [useCustomTip, setUseCustomTip] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('visa')
  const [addServiceDialogOpen, setAddServiceDialogOpen] = useState(false)
  const [selectedStaffId, setSelectedStaffId] = useState<string>('')
  const [showStaffSelection, setShowStaffSelection] = useState(false)

  // Get icon for group
  const getGroupIcon = (groupName: string) => {
    const name = groupName.toLowerCase()
    if (name.includes('bridal')) return Crown
    if (name.includes('facial')) return Sparkles
    if (name.includes('gents')) return UserIcon
    if (name.includes('ladies')) return Heart
    if (name.includes('laser')) return Zap
    if (name.includes('threading')) return Scissors
    if (name.includes('waxing')) return Flame
    return Star
  }

  // Get icon for service
  const getServiceIcon = (serviceName: string) => {
    const name = serviceName.toLowerCase()
    if (name.includes('makeup')) return Sparkles
    if (name.includes('hair')) return Scissors
    if (name.includes('facial')) return Heart
    if (name.includes('massage')) return Gem
    if (name.includes('nail')) return Star
    return Crown
  }

  // Extract price from HTML description
  const extractPriceFromDescription = (description: string): number => {
    try {
      // Look for CA$XX.XX pattern in the HTML
      const priceMatch = description.match(/CA\$(\d+\.?\d*)/)
      return priceMatch ? parseFloat(priceMatch[1]) : 0
    } catch {
      return 0
    }
  }

  // Customer search function
  const searchCustomers = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setCustomers([])
      return
    }
    
    try {
      setLoadingCustomers(true)
      const response = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/searchContacts?s=${encodeURIComponent(searchTerm)}&page=1&limit=20`)
      
      if (!response.ok) throw new Error('Failed to search contacts')
      
      const json = await response.json()
      const formattedCustomers = json.results?.map((contact: ContactResponse) => ({
        id: contact.id.toString(),
        firstName: contact.firstName || '',
        lastName: contact.lastName || '',
        email: contact.email || '',
        phone: contact.phone || '',
        fullName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.contactName || 'Unknown'
      })) || []
      
      setCustomers(formattedCustomers)
    } catch (error) {
      console.error('Error searching customers:', error)
      toast.error('Failed to search customers')
    } finally {
      setLoadingCustomers(false)
    }
  }

  // Fetch staff data
  const fetchStaffData = async () => {
    try {
      const response = await fetch('/api/barber-hours')
      if (!response.ok) throw new Error('Failed to fetch staff data')
      const result = await response.json()
      
      console.log('Staff API response:', result)
      
      if (result.ok && result.data) {
        const staff = result.data.map((barber: { ghl_id: string; 'Barber/Name': string }) => ({
          ghl_id: barber['ghl_id'],
          name: barber['Barber/Name']
        }))
        console.log('Mapped staff data:', staff)
        setStaffData(staff)
      }
    } catch (error) {
      console.error('Error fetching staff data:', error)
    }
  }

  // Fetch groups
  const fetchGroups = async () => {
    try {
      setLoadingGroups(true)
      const response = await fetch('https://restyle-backend.netlify.app/.netlify/functions/getAllServices')
      if (!response.ok) throw new Error('Failed to fetch groups')
      
      const result = await response.json()
      if (result.success) {
        const services = result.calendars || []
        
        // Group services by category
        const groupNames: Group[] = []
        const servicesByCategory: GroupServices = {}
        
        services.forEach((service: { 
          id: string;
          name?: string;
          title?: string;
          category?: string;
          price?: number;
          servicePrice?: number;
          duration?: number;
          durationMinutes?: number;
          description?: string;
          teamMembers?: Array<{ userId: string; priority: number; selected: boolean }>;
        }) => {
          const category = service.category || 'General Services'
          
          if (!servicesByCategory[category]) {
            servicesByCategory[category] = []
            if (!groupNames.find(g => g.name === category)) {
              groupNames.push({
                id: category,
                name: category,
                description: `${category} services`,
                slug: category.toLowerCase().replace(/\s+/g, '-'),
                isActive: true
              })
            }
          }
          
          const price = extractPriceFromDescription(service.description || '')
          console.log(`Service: ${service.name || service.title}, Price from description: ${price}, Original price: ${service.servicePrice || service.price}`)
          servicesByCategory[category].push({
            id: service.id,
            name: service.name || service.title || 'Service',
            price: price || service.servicePrice || service.price || 0,
            duration: service.durationMinutes || service.duration || 60,
            description: service.description || '',
            title: service.title,
            servicePrice: price || service.servicePrice || service.price,
            durationMinutes: service.durationMinutes || service.duration,
            teamMembers: service.teamMembers || []
          })
        })
        
        setGroups(groupNames)
        setGroupServices(servicesByCategory)
        if (groupNames.length > 0) {
          setSelectedGroupId(groupNames[0].id)
        }
      }
    } catch (error) {
      console.error('Error fetching groups:', error)
    } finally {
      setLoadingGroups(false)
    }
  }

  // Handle service click
  const handleServiceClick = (service: Service) => {
    setSelectedService(service)
    setShowStaffSelection(true)
    setSelectedStaffId('')
  }

  // Handle add service
  const handleAddService = () => {
    if (selectedService && selectedStaffId) {
      const staff = staffData.find(s => s.ghl_id === selectedStaffId)
      if (!staff) {
        toast.error('Please select a staff member')
        return
      }
      
      const newService = {
        service: selectedService,
        staff: staff,
        id: crypto.randomUUID()
      }
      
      setSelectedServices(prev => [...prev, newService])
      
      toast.success(`${selectedService.name} added with ${staff.name}`)
      
      // Reset states
      setSelectedService(null)
      setSelectedStaffId('')
      setShowStaffSelection(false)
      setAddServiceDialogOpen(false)
    }
  }

  // Remove service
  const removeService = (index: number) => {
    setSelectedServices(prev => prev.filter((_, i) => i !== index))
    toast.success('Service removed')
  }

  // Calculate pricing
  const subtotal = selectedServices.reduce((sum, item) => sum + item.service.price, 0)
  const tipAmount = useCustomTip 
    ? parseFloat(customTipAmount) || 0 
    : (subtotal * tipPercentage) / 100
  const gst = subtotal * 0.05 // 5% GST
  const total = subtotal + tipAmount + gst

  // Get staff tip distribution (matching checkout page)
  const getStaffTipDistribution = (): TipDistribution[] => {
    const staffTotals = selectedServices.reduce((acc, item) => {
      const staffName = item.staff.name
      if (!acc[staffName]) {
        acc[staffName] = {
          staffId: item.staff.ghl_id,
          staffName,
          totalServicePrice: 0,
          services: []
        }
      }
      acc[staffName].totalServicePrice += item.service.price
      acc[staffName].services.push({
        staffId: item.staff.ghl_id,
        staffName,
        servicePrice: item.service.price
      })
      return acc
    }, {} as Record<string, { staffId: string; staffName: string; totalServicePrice: number; services: Array<{ staffId: string; staffName: string; servicePrice: number }> }>)
    
    const totalServicePrice = Object.values(staffTotals).reduce((sum, staff) => sum + staff.totalServicePrice, 0)
    
    return Object.values(staffTotals).map(staff => {
      const sharePercentage = totalServicePrice > 0 ? (staff.totalServicePrice / totalServicePrice) * 100 : 0
      const tipShare = totalServicePrice > 0 ? (staff.totalServicePrice / totalServicePrice) * tipAmount : 0
      const totalEarning = staff.totalServicePrice + tipShare
      
      return {
        staffName: staff.staffName,
        sharePercentage,
        tipShare,
        totalEarning,
        totalServicePrice: staff.totalServicePrice
      }
    }).sort((a, b) => b.totalServicePrice - a.totalServicePrice)
  }

  // Format duration
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
    }
    return `${mins}m`
  }

  // Process walk-in checkout
  const processWalkIn = async () => {
    if (!selectedCustomer) {
      toast.error('Please select a customer')
      return
    }

    if (selectedServices.length === 0) {
      toast.error('Please add at least one service')
      return
    }

    setProcessingCheckout(true)
    try {
      const transactionId = crypto.randomUUID()
      
      const distribution = getStaffTipDistribution()
      const items = selectedServices.map((item) => {
        const share = distribution.find(d => d.staffName === item.staff.name)
        return {
          id: crypto.randomUUID(),
          serviceId: item.service.id,
          serviceName: item.service.name,
          price: item.service.price,
          staffName: item.staff.name,
          paymentId: transactionId,
          staffTipSplit: share ? Number(share.sharePercentage.toFixed(2)) : null,
          staffTipCollected: share ? Number(share.tipShare.toFixed(2)) : null,
        }
      })

      const payload = {
        transaction: {
          id: transactionId,
          paymentDate: new Date().toISOString(),
          method: selectedPaymentMethod,
          subtotal,
          tax: gst,
          tip: tipAmount,
          totalPaid: total,
          serviceNamesJoined: selectedServices.map(s => s.service.name).join(', '),
          serviceAcuityIds: selectedServices.map(s => s.service.id).join(', '),
          customerPhone: selectedCustomer.phone || null,
          bookingType: 'Walk-in',
          paymentStaff: selectedServices.map(s => s.staff.name).join(', '),
          status: 'Paid',
        },
        items,
        meta: {
          customerFirstName: selectedCustomer.firstName,
          customerName: selectedCustomer.fullName,
        }
      }

      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) throw new Error('Failed to process transaction')

      toast.success('Walk-in processed successfully!')
      router.push('/dashboard')
      
    } catch (error) {
      console.error('Error processing walk-in:', error)
      toast.error('Failed to process walk-in')
    } finally {
      setProcessingCheckout(false)
    }
  }

  // Initialize data
  useEffect(() => {
    fetchGroups()
    fetchStaffData()
  }, [])

  // Handle customer search
  useEffect(() => {
    if (customerSearch) {
      const timer = setTimeout(() => searchCustomers(customerSearch), 300)
      return () => clearTimeout(timer)
    } else {
      setCustomers([])
    }
  }, [customerSearch])

  return (
    <RoleGuard>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          {/* Header - matching checkout page exactly */}
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[data-collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex items-center justify-between gap-2 px-4 w-full">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4" />
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-[#7b1d1d]" />
                  <h1 className="text-xl font-semibold">Walk-in Checkout</h1>
                </div>
              </div>
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-6 p-6 bg-neutral-50">
            {/* Hero Card - Customer Selection (matching checkout style) */}
            <div className="mx-auto w-full max-w-6xl rounded-2xl border border-neutral-200 bg-white px-6 py-5">
              <p className="text-[13px] font-medium text-neutral-500">Walk-in Customer</p>
              <h2 className="mt-1 text-[28px] font-semibold leading-tight text-neutral-900">
                {selectedCustomer?.fullName || 'Select Customer'}
              </h2>
              {selectedCustomer && (
                <p className="mt-1 text-[14px] text-neutral-600">
                  {selectedCustomer.email} {selectedCustomer.phone && `• ${selectedCustomer.phone}`}
                </p>
              )}
              
              {/* Customer Search */}
              <div className="mt-5 rounded-xl border border-neutral-200 p-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="customer-search" className="text-sm font-medium">Search Customer</Label>
                    <Input
                      id="customer-search"
                      placeholder="Search by name, email, or phone..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                  
                  {loadingCustomers && (
                    <div className="text-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      <p className="text-sm text-neutral-600">Searching customers...</p>
                    </div>
                  )}
                  
                  {customers.length > 0 && (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {customers.map((customer) => (
                        <div
                          key={customer.id}
                          onClick={() => setSelectedCustomer(customer)}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedCustomer?.id === customer.id
                              ? 'bg-[#7b1d1d]/10 border-[#7b1d1d] shadow-sm'
                              : 'border-neutral-200 hover:bg-neutral-50'
                          }`}
                        >
                          <div className="font-medium">{customer.fullName}</div>
                          <div className="text-sm text-neutral-600 space-x-3">
                            {customer.email && <span>{customer.email}</span>}
                            {customer.phone && <span>{customer.phone}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mx-auto grid w-full max-w-6xl gap-6 md:grid-cols-1">
              <div className="space-y-6">

                {/* Services Card */}
                <Card className="rounded-2xl border-neutral-200 shadow-none">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-[16px] font-semibold flex items-center gap-2">
                          <Clock className="h-5 w-5 text-[#7b1d1d]" />
                          Selected Services
                        </CardTitle>
                        <CardDescription className="text-[13px]">Services for this walk-in appointment</CardDescription>
                      </div>
                      <Dialog open={addServiceDialogOpen} onOpenChange={setAddServiceDialogOpen}>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="rounded-lg border-[#7b1d1d] text-[#7b1d1d] hover:bg-[#7b1d1d] hover:text-white transition-all"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Service
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-hidden">
                          <DialogHeader className="pb-6">
                            <DialogTitle className="text-2xl font-semibold">Add Service</DialogTitle>
                            <DialogDescription className="text-base">
                              Select a service category and choose a service to add to this walk-in appointment.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-6 overflow-hidden">
                            {loadingGroups ? (
                              <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin mr-3" />
                                <span className="text-lg">Loading service categories...</span>
                              </div>
                            ) : groups.length > 0 ? (
                              <div className="w-full">
                                {!showStaffSelection ? (
                                  <Tabs value={selectedGroupId} onValueChange={setSelectedGroupId} className="w-full">
                                    <div className="flex gap-2 overflow-x-auto pb-2">
                                      {groups.map((group) => {
                                        const IconComponent = getGroupIcon(group.name)
                                        return (
                                          <button
                                            key={group.id}
                                            onClick={() => setSelectedGroupId(group.id)}
                                            className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all hover:border-[#7b1d1d]/30 flex-shrink-0 ${
                                              selectedGroupId === group.id
                                                ? 'border-[#7b1d1d] bg-[#7b1d1d]'
                                                : 'border-neutral-200 bg-white hover:bg-neutral-50'
                                            }`}
                                          >
                                            <IconComponent className={`h-5 w-5 ${
                                              selectedGroupId === group.id
                                                ? 'text-white'
                                                : 'text-neutral-600'
                                            }`} />
                                            <span className={`text-sm font-medium whitespace-nowrap ${
                                              selectedGroupId === group.id
                                                ? 'text-white'
                                                : 'text-neutral-900'
                                            }`}>{group.name}</span>
                                          </button>
                                        )
                                      })}
                                    </div>
                                {groups.map((group) => (
                                  <TabsContent key={group.id} value={group.id} className="mt-6">
                                    <div className="max-h-[60vh] overflow-y-auto">
                                      {groupServices[group.id] ? (
                                        groupServices[group.id].length > 0 ? (
                                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {groupServices[group.id].map((service, index) => {
                                              const ServiceIcon = getServiceIcon(service.name || '')
                                              const serviceName = service.name || 'Service'
                                              const servicePrice = service.price || 0
                                              const serviceDuration = service.duration || 0
                                              
                                              return (
                                                <div
                                                  key={`${service.id}-${index}`}
                                                  onClick={() => handleServiceClick(service)}
                                                  className="group relative cursor-pointer rounded-xl border-2 border-neutral-200 bg-white p-4 transition-all hover:border-[#7b1d1d]/30 hover:shadow-md"
                                                >
                                                  <div className="flex items-start justify-between">
                                                    <div className="flex items-center gap-3">
                                                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 group-hover:bg-[#7b1d1d] group-hover:text-white transition-all">
                                                        <ServiceIcon className="h-5 w-5" />
                                                      </div>
                                                      <div>
                                                        <h3 className="font-medium text-neutral-900 group-hover:text-[#7b1d1d] transition-colors">
                                                          {serviceName}
                                                        </h3>
                                                        <div className="flex items-center gap-2 text-sm text-neutral-600 mt-1">
                                                          <Clock className="h-3 w-3" />
                                                          <span>{formatDuration(serviceDuration)}</span>
                                                          <span>•</span>
                                                          <span className="font-medium">CA${servicePrice.toFixed(2)}</span>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>
                                              )
                                            })}
                                          </div>
                                        ) : (
                                          <div className="text-center py-12">
                                            <AlertCircle className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
                                            <h3 className="text-lg font-semibold text-neutral-700 mb-2">No services found</h3>
                                            <p className="text-neutral-500">This category doesn&apos;t have any services yet.</p>
                                          </div>
                                        )
                                      ) : (
                                        <div className="text-center py-12">
                                          <Skeleton className="h-32 w-full" />
                                        </div>
                                      )}
                                    </div>
                                  </TabsContent>
                                ))}
                                </Tabs>
                                ) : (
                                  <div className="space-y-6">
                                    <div className="flex items-center gap-4">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setShowStaffSelection(false)
                                          setSelectedService(null)
                                          setSelectedStaffId('')
                                        }}
                                      >
                                        <ArrowLeft className="h-4 w-4 mr-2" />
                                        Back to Services
                                      </Button>
                                      {selectedService && (
                                        <div>
                                          <h3 className="text-lg font-semibold">{selectedService.name}</h3>
                                          <p className="text-sm text-neutral-600">
                                            {formatDuration(selectedService.duration)} • CA${selectedService.price.toFixed(2)}
                                          </p>
                                        </div>
                                      )}
                                    </div>

                                    <div>
                                      <h4 className="text-base font-medium mb-4">Select Staff Member</h4>
                                      <div className="grid gap-3 max-h-60 overflow-y-auto">
                                        {staffData.length > 0 ? staffData.map((staff) => (
                                          <div
                                            key={staff.ghl_id}
                                            onClick={() => setSelectedStaffId(staff.ghl_id)}
                                            className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                                              selectedStaffId === staff.ghl_id
                                                ? 'bg-[#7b1d1d]/10 border-[#7b1d1d]'
                                                : 'border-neutral-200 hover:bg-neutral-50'
                                            }`}
                                          >
                                            <div className="font-medium">{staff.name}</div>
                                          </div>
                                        )) : (
                                          <div className="text-center py-8">
                                            <UserIcon className="h-8 w-8 text-neutral-400 mx-auto mb-2" />
                                            <p className="text-neutral-500">No staff members available</p>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex justify-end gap-3 pt-4 border-t">
                                      <Button variant="outline" onClick={() => setAddServiceDialogOpen(false)}>
                                        Cancel
                                      </Button>
                                      <Button 
                                        onClick={handleAddService}
                                        disabled={!selectedService || !selectedStaffId}
                                        className="bg-[#7b1d1d] hover:bg-[#6b1717]"
                                      >
                                        Add Service
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-center py-12">
                                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold mb-2">No service categories found</h3>
                                <p className="text-neutral-500">Unable to load service categories.</p>
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {selectedServices.length > 0 ? (
                      <div className="space-y-3">
                        {selectedServices.map((item, index) => (
                          <div key={item.id} className="flex items-center justify-between p-3 border border-neutral-200 rounded-lg bg-neutral-50">
                            <div className="space-y-1">
                              <div className="font-medium">{item.service.name}</div>
                              <div className="text-sm text-neutral-600">
                                with {item.staff.name} • {formatDuration(item.service.duration)} • CA${item.service.price.toFixed(2)}
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removeService(index)}
                              className="text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-neutral-500">
                        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No services added yet</p>
                                                      <p className="text-sm">Click &quot;Add Service&quot; to get started</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Pricing Summary */}
                {selectedServices.length > 0 && (
                  <Card className="rounded-2xl border-neutral-200 shadow-none">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-[16px] font-semibold flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-[#7b1d1d]" />
                        Pricing Summary
                      </CardTitle>
                      <CardDescription className="text-[13px]">Complete breakdown of charges and taxes</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex justify-between text-base">
                          <span>Subtotal:</span>
                          <span>CA${subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-base">
                          <span>Tip ({useCustomTip ? 'Custom' : `${tipPercentage}%`}):</span>
                          <span>CA${tipAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-base">
                          <span>GST (5%):</span>
                          <span>CA${gst.toFixed(2)}</span>
                        </div>
                        <UISeparator />
                        <div className="flex justify-between text-xl font-semibold">
                          <span>Total:</span>
                          <span>CA${total.toFixed(2)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Staff Tip Distribution - matching checkout page */}
                {selectedServices.length > 0 && getStaffTipDistribution().length > 0 && (
                  <Card className="rounded-2xl border-neutral-200 shadow-none">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-[16px] font-semibold flex items-center gap-2">
                        <Users className="h-5 w-5 text-[#7b1d1d]" />
                        Staff Tip Distribution
                      </CardTitle>
                      <CardDescription className="text-[13px]">How tips are distributed among staff members</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {getStaffTipDistribution().map((staff, index) => (
                          <div key={index} className="flex items-center justify-between p-3 border border-neutral-200 rounded-lg bg-neutral-50">
                            <div className="space-y-1">
                              <div className="font-medium">{staff.staffName}</div>
                              <div className="text-sm text-neutral-600">
                                {staff.sharePercentage.toFixed(1)}% share • CA${staff.totalServicePrice.toFixed(2)} services
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium">CA${staff.totalEarning.toFixed(2)}</div>
                              <div className="text-sm text-neutral-600">+CA${staff.tipShare.toFixed(2)} tip</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Payment Method & Tip Selection */}
                {selectedServices.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Payment Method Card */}
                    <Card className="rounded-2xl border-neutral-200 shadow-none">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-[16px] font-semibold flex items-center gap-2">
                          <CreditCard className="h-5 w-5 text-[#7b1d1d]" />
                          Payment Method
                        </CardTitle>
                        <CardDescription className="text-[13px]">Choose your preferred payment method</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="visa">💳 Visa</SelectItem>
                            <SelectItem value="mastercard">💳 Mastercard</SelectItem>
                            <SelectItem value="amex">💳 American Express</SelectItem>
                            <SelectItem value="debit">💳 Debit Card</SelectItem>
                            <SelectItem value="cash">💵 Cash</SelectItem>
                            <SelectItem value="interac">💳 Interac</SelectItem>
                          </SelectContent>
                        </Select>
                      </CardContent>
                    </Card>

                    {/* Tip Selection Card */}
                    <Card className="rounded-2xl border-neutral-200 shadow-none">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-[16px] font-semibold flex items-center gap-2">
                          <Receipt className="h-5 w-5 text-[#7b1d1d]" />
                          Tip Amount
                        </CardTitle>
                        <CardDescription className="text-[13px]">Customize the tip for this service</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Label>Tip Percentage:</Label>
                            <Select 
                              value={useCustomTip ? 'custom' : tipPercentage.toString()} 
                              onValueChange={(value) => {
                                if (value === 'custom') {
                                  setUseCustomTip(true)
                                } else {
                                  setUseCustomTip(false)
                                  setTipPercentage(parseInt(value))
                                }
                              }}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0">0%</SelectItem>
                                <SelectItem value="15">15%</SelectItem>
                                <SelectItem value="18">18%</SelectItem>
                                <SelectItem value="20">20%</SelectItem>
                                <SelectItem value="25">25%</SelectItem>
                                <SelectItem value="custom">Custom</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {useCustomTip && (
                            <div>
                              <Label htmlFor="custom-tip">Custom Tip Amount (CA$)</Label>
                              <Input
                                id="custom-tip"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={customTipAmount}
                                onChange={(e) => setCustomTipAmount(e.target.value)}
                                className="mt-2"
                              />
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Complete Checkout Button */}
                {selectedCustomer && selectedServices.length > 0 && (
                  <Card className="rounded-2xl border-green-200 bg-green-50 shadow-none">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-green-800">Ready to Process</h3>
                          <p className="text-green-700 text-sm">
                            {selectedServices.length} service{selectedServices.length !== 1 ? 's' : ''} • {selectedCustomer.fullName} • CA${total.toFixed(2)}
                          </p>
                        </div>
                        <Button
                          onClick={processWalkIn}
                          disabled={processingCheckout}
                          className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg"
                        >
                          {processingCheckout ? (
                            <>
                              <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-5 w-5 mr-3" />
                              Complete Walk-in (CA${total.toFixed(2)})
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

              </div>
            </div>
          </div>

        </SidebarInset>
      </SidebarProvider>
    </RoleGuard>
  )
}