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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  DollarSign, 
  Clock, 
  User as UserIcon, 
  Calendar as CalendarIcon,
  CreditCard,
  ArrowLeft,
  AlertCircle,
  Loader2,
  Receipt,
  Users,
  Percent,
  Phone,
  Wallet,
  Plus,
  Scissors,
  Sparkles,
  Heart,
  Crown,
  Zap,
  Flame,
  Star,
  Gem,
  CheckCircle2,
  Edit3,
  X,
} from "lucide-react"
import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useUser } from "@/contexts/user-context"

interface Customer {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  fullName: string
}

interface Staff {
  ghl_id: string
  name: string
  email: string
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

interface PricingBreakdown {
  subtotal: number
  tipAmount: number
  taxes: {
    gst: { rate: number; amount: number }
    totalTax: number
  }
  totalAmount: number
  currency: string
}

export default function WalkInPage() {
  const router = useRouter()
  const { user } = useUser()
  
  // State
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedServices, setSelectedServices] = useState<Array<{
    service: Service
    staff: Staff
    id: string
  }>>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [staffMembers, setStaffMembers] = useState<Staff[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [groupServices, setGroupServices] = useState<GroupServices>({})
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  
  // Loading states
  const [loading, setLoading] = useState(true)
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [loadingStaff, setLoadingStaff] = useState(false)
  const [loadingServices, setLoadingServices] = useState(false)
  const [processingCheckout, setProcessingCheckout] = useState(false)
  
  // Form state
  const [tipPercentage, setTipPercentage] = useState(18)
  const [customTipAmount, setCustomTipAmount] = useState('')
  const [useCustomTip, setUseCustomTip] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('visa')

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

  // Fetch customers
  const fetchCustomers = async () => {
    try {
      setLoadingCustomers(true)
      const response = await fetch('/api/getUsers?role=customer')
      const result = await response.json()
      
      if (result.ok && result.customers) {
        setCustomers(result.customers)
      } else {
        toast.error('Failed to load customers')
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
      toast.error('Error loading customers')
    } finally {
      setLoadingCustomers(false)
    }
  }

  // Fetch staff members
  const fetchStaff = async () => {
    try {
      setLoadingStaff(true)
      const response = await fetch('/api/barber-hours')
      const result = await response.json()
      
      if (result.ok) {
        const staffData = result.data.map((staff: Record<string, unknown>) => ({
          ghl_id: staff.ghl_id,
          name: staff["Barber/Name"],
          email: staff["Barber/Email"]
        }))
        setStaffMembers(staffData)
      } else {
        toast.error('Failed to load staff members')
      }
    } catch (error) {
      console.error('Error fetching staff:', error)
      toast.error('Error loading staff members')
    } finally {
      setLoadingStaff(false)
    }
  }

  // Fetch services
  const fetchServices = async () => {
    try {
      setLoadingServices(true)
      
      // First fetch groups
      const groupsResponse = await fetch('/api/groups')
      const groupsResult = await groupsResponse.json()
      
      if (groupsResult.success) {
        setGroups(groupsResult.groups)
        
        // Fetch services for each group
        const servicesData: GroupServices = {}
        for (const group of groupsResult.groups) {
          const servicesResponse = await fetch(`/api/services?groupId=${group.id}`)
          const servicesResult = await servicesResponse.json()
          
          if (servicesResult.success) {
            servicesData[group.id] = servicesResult.services.filter((service: Service) => 
              service.price && service.price > 0
            )
          }
        }
        setGroupServices(servicesData)
        
        // Set first group as default
        if (groupsResult.groups.length > 0) {
          setSelectedGroupId(groupsResult.groups[0].id)
        }
      } else {
        toast.error('Failed to load services')
      }
    } catch (error) {
      console.error('Error fetching services:', error)
      toast.error('Error loading services')
    } finally {
      setLoadingServices(false)
    }
  }

  // Initialize data
  useEffect(() => {
    const initializeData = async () => {
      setLoading(true)
      await Promise.all([
        fetchCustomers(),
        fetchStaff(),
        fetchServices()
      ])
      setLoading(false)
    }
    
    initializeData()
  }, [])

  // Add service to the list
  const addServiceToList = () => {
    if (!selectedService || !selectedStaff) {
      toast.error('Please select both service and staff')
      return
    }

    const serviceId = `service_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const newServiceItem = {
      service: selectedService,
      staff: selectedStaff,
      id: serviceId
    }

    setSelectedServices(prev => [...prev, newServiceItem])
    setSelectedService(null)
    setSelectedStaff(null)
    setSelectedGroupId('')
    toast.success('Service added to checkout')
  }

  // Remove service from list
  const removeService = (serviceId: string) => {
    setSelectedServices(prev => prev.filter(s => s.id !== serviceId))
    toast.success('Service removed from checkout')
  }

  // Calculate pricing
  const calculatePricing = (): PricingBreakdown | null => {
    if (selectedServices.length === 0) return null
    
    const subtotal = selectedServices.reduce((total, item) => total + item.service.price, 0)
    const tipAmount = useCustomTip 
      ? parseFloat(customTipAmount) || 0 
      : (subtotal * tipPercentage) / 100
    
    const gstRate = 0.05 // 5% GST
    const gstAmount = subtotal * gstRate
    const totalTax = gstAmount
    const totalAmount = subtotal + tipAmount + totalTax
    
    return {
      subtotal,
      tipAmount,
      taxes: {
        gst: { rate: gstRate, amount: gstAmount },
        totalTax
      },
      totalAmount,
      currency: 'CAD'
    }
  }

  const pricing = calculatePricing()

  // Handle checkout
  const handleCheckout = async () => {
    if (!selectedCustomer || selectedServices.length === 0 || !pricing) {
      toast.error('Please select customer and at least one service')
      return
    }

    try {
      setProcessingCheckout(true)
      
      // Generate unique IDs
      const transactionId = `walkin_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      
      // Calculate tip distribution across staff members
      const staffTipDistribution = calculateTipDistribution()
      
      // Prepare service names and IDs
      const serviceNames = selectedServices.map(s => s.service.name).join(', ')
      const serviceIds = selectedServices.map(s => s.service.id).join(', ')
      const staffNames = Array.from(new Set(selectedServices.map(s => s.staff.name))).join(', ')
      
      // Prepare transaction data
      const transactionPayload = {
        transaction: {
          id: transactionId,
          bookingId: null, // No appointment ID for walk-ins
          bookingServiceLookup: serviceNames,
          bookingBookedRate: pricing.subtotal,
          bookingCustomerPhone: selectedCustomer.phone || null,
          bookingType: "Walk-in",
          customerPhone: selectedCustomer.phone || null,
          customerLookup: selectedCustomer.fullName,
          paymentDate: new Date().toISOString(),
          method: selectedPaymentMethod === 'visa' ? 'Card' : 'Cash',
          paymentSort: new Date().getTime(),
          paymentStaff: staffNames,
          subtotal: pricing.subtotal,
          status: "Paid",
          transactionServices: pricing.subtotal,
          transactionServicesTotal: pricing.subtotal,
          tax: pricing.taxes.totalTax,
          totalPaid: pricing.totalAmount,
          serviceNamesJoined: serviceNames,
          serviceAcuityIds: serviceIds,
          tip: pricing.tipAmount,
          walkInCustomerId: selectedCustomer.id,
          walkInPhone: selectedCustomer.phone || null,
          transactionPaid: "Yes",
        },
        items: selectedServices.map((serviceItem) => {
          const itemId = `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
          const staffTip = staffTipDistribution.find(dist => dist.staffName === serviceItem.staff.name)
          
          return {
            id: itemId,
            paymentId: transactionId,
            staffName: serviceItem.staff.name,
            staffTipSplit: staffTip?.tipAmount || 0,
            staffTipCollected: staffTip?.tipAmount || 0,
            serviceId: serviceItem.service.id,
            serviceName: serviceItem.service.name,
            price: serviceItem.service.price,
          }
        })
      }

      // Save transaction to Supabase
      const persistRes = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transactionPayload),
      })

      if (!persistRes.ok) {
        const err = await persistRes.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to save transaction')
      }

      // Cache for success page fallback
      try {
        sessionStorage.setItem(`tx:${transactionId}`, JSON.stringify(transactionPayload))
      } catch {}

      toast.success(`Walk-in transaction completed successfully! Total: $${pricing.totalAmount.toFixed(2)}`)
      
      // Redirect to success page
      router.push(`/checkout/success?id=${transactionId}`)
      
    } catch (error) {
      console.error('Error processing walk-in checkout:', error)
      toast.error('Failed to process walk-in checkout')
    } finally {
      setProcessingCheckout(false)
    }
  }

  // Calculate tip distribution across staff members
  const calculateTipDistribution = () => {
    if (selectedServices.length === 0 || !pricing) return []

    // Group services by staff
    const servicesByStaff = selectedServices.reduce((acc, serviceItem) => {
      const staffName = serviceItem.staff.name
      if (!acc[staffName]) {
        acc[staffName] = {
          staffName,
          services: [],
          totalServicePrice: 0
        }
      }
      acc[staffName].services.push(serviceItem)
      acc[staffName].totalServicePrice += serviceItem.service.price
      return acc
    }, {} as Record<string, { staffName: string; services: Array<{service: Service; staff: Staff; id: string}>; totalServicePrice: number }>)

    // Calculate tip distribution based on service price percentage
    return Object.values(servicesByStaff).map(staffGroup => {
      const sharePercentage = staffGroup.totalServicePrice / pricing.subtotal
      const tipAmount = pricing.tipAmount * sharePercentage
      
      return {
        staffName: staffGroup.staffName,
        servicePrice: staffGroup.totalServicePrice,
        sharePercentage: sharePercentage * 100,
        tipAmount: tipAmount,
        totalEarning: staffGroup.totalServicePrice + tipAmount
      }
    })
  }

  if (loading) {
    return (
      <RoleGuard>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="flex h-14 items-center border-b bg-white/60 backdrop-blur px-4">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mx-2 h-4" />
                <div className="flex items-center gap-2">
                  <UserIcon className="h-5 w-5 text-[#7b1d1d]" />
                  <h1 className="text-[15px] font-semibold tracking-tight">Walk-in</h1>
                </div>
              </div>
              <div className="ml-auto">
                <Button variant="outline" onClick={() => router.push('/calendar')} className="rounded-lg">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Calendar
                </Button>
              </div>
            </header>
            <div className="flex flex-1 flex-col gap-6 p-6 bg-neutral-50">
              <div className="mx-auto w-full max-w-6xl">
                <Skeleton className="h-96 rounded-2xl" />
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </RoleGuard>
    )
  }

  return (
    <RoleGuard>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          {/* Header */}
          <header className="flex h-14 items-center border-b bg-white/60 backdrop-blur px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mx-2 h-4" />
              <div className="flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-[#7b1d1d]" />
                <h1 className="text-[15px] font-semibold tracking-tight">Walk-in</h1>
              </div>
            </div>
            <div className="ml-auto">
              <Button variant="outline" onClick={() => router.push('/calendar')} className="rounded-lg">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Calendar
              </Button>
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-6 p-6 bg-neutral-50">
            {/* Selection Cards */}
            <div className="mx-auto w-full max-w-6xl grid gap-4 md:grid-cols-3">
              {/* Customer Selection */}
              <Card className="rounded-2xl border border-neutral-200 bg-white">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Users className="h-5 w-5 text-[#601625]" />
                    Customer
                  </CardTitle>
                  <CardDescription>Select a customer for this walk-in</CardDescription>
                </CardHeader>
                <CardContent>
                  <Select
                    value={selectedCustomer?.id || ''}
                    onValueChange={(value) => {
                      const customer = customers.find(c => c.id === value)
                      setSelectedCustomer(customer || null)
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose customer..." />
                    </SelectTrigger>
                    <SelectContent>
                      {loadingCustomers ? (
                        <SelectItem value="loading" disabled>Loading customers...</SelectItem>
                      ) : customers.length > 0 ? (
                        customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{customer.fullName}</span>
                              <span className="text-xs text-muted-foreground">{customer.email}</span>
                            </div>
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>No customers found</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  
                  {selectedCustomer && (
                    <div className="mt-3 p-3 bg-[#601625]/5 rounded-lg border border-[#601625]/20">
                      <div className="text-sm font-medium">{selectedCustomer.fullName}</div>
                      <div className="text-xs text-muted-foreground">{selectedCustomer.email}</div>
                      {selectedCustomer.phone && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Phone className="h-3 w-3" />
                          {selectedCustomer.phone}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Staff Selection */}
              <Card className="rounded-2xl border border-neutral-200 bg-white">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Scissors className="h-5 w-5 text-[#601625]" />
                    Stylist
                  </CardTitle>
                  <CardDescription>Select a stylist for this service</CardDescription>
                </CardHeader>
                <CardContent>
                  <Select
                    value={selectedStaff?.ghl_id || ''}
                    onValueChange={(value) => {
                      const staff = staffMembers.find(s => s.ghl_id === value)
                      setSelectedStaff(staff || null)
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose stylist..." />
                    </SelectTrigger>
                    <SelectContent>
                      {loadingStaff ? (
                        <SelectItem value="loading" disabled>Loading staff...</SelectItem>
                      ) : staffMembers.length > 0 ? (
                        staffMembers.map((staff) => (
                          <SelectItem key={staff.ghl_id} value={staff.ghl_id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{staff.name}</span>
                              <span className="text-xs text-muted-foreground">{staff.email}</span>
                            </div>
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>No staff found</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  
                  {selectedStaff && (
                    <div className="mt-3 p-3 bg-[#601625]/5 rounded-lg border border-[#601625]/20">
                      <div className="text-sm font-medium">{selectedStaff.name}</div>
                      <div className="text-xs text-muted-foreground">{selectedStaff.email}</div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Service Selection */}
              <Card className="rounded-2xl border border-neutral-200 bg-white">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-[#601625]" />
                    Service
                  </CardTitle>
                  <CardDescription>Select a service to perform</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Group Selection */}
                  <Select
                    value={selectedGroupId}
                    onValueChange={setSelectedGroupId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose service category..." />
                    </SelectTrigger>
                    <SelectContent>
                      {loadingServices ? (
                        <SelectItem value="loading" disabled>Loading categories...</SelectItem>
                      ) : groups.length > 0 ? (
                        groups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>No categories found</SelectItem>
                      )}
                    </SelectContent>
                  </Select>

                  {/* Service Selection */}
                  <Select
                    value={selectedService?.id || ''}
                    onValueChange={(value) => {
                      const services = selectedGroupId ? groupServices[selectedGroupId] || [] : []
                      const service = services.find(s => s.id === value)
                      setSelectedService(service || null)
                    }}
                    disabled={!selectedGroupId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose service..." />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedGroupId && groupServices[selectedGroupId] ? (
                        groupServices[selectedGroupId].length > 0 ? (
                          groupServices[selectedGroupId].map((service) => (
                            <SelectItem key={service.id} value={service.id}>
                              <div className="flex flex-col">
                                <span className="font-medium">{service.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  ${service.price} • {service.duration}min
                                </span>
                              </div>
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="none" disabled>No services in this category</SelectItem>
                        )
                      ) : (
                        <SelectItem value="none" disabled>Select a category first</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  
                  {selectedService && selectedStaff && (
                    <div className="mt-3 space-y-2">
                      <div className="p-3 bg-[#601625]/5 rounded-lg border border-[#601625]/20">
                        <div className="text-sm font-medium">{selectedService.name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span>${selectedService.price}</span>
                          <span>•</span>
                          <Clock className="h-3 w-3" />
                          <span>{selectedService.duration} minutes</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Staff: {selectedStaff.name}
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        onClick={addServiceToList}
                        className="w-full bg-[#601625] hover:bg-[#751a29]"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add to Checkout
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Selected Services List */}
            {selectedServices.length > 0 && (
              <div className="mx-auto w-full max-w-6xl">
                <Card className="rounded-2xl border border-neutral-200 bg-white">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <Receipt className="h-5 w-5 text-[#601625]" />
                      Selected Services ({selectedServices.length})
                    </CardTitle>
                    <CardDescription>Services added to this walk-in checkout</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedServices.map((serviceItem) => (
                      <div key={serviceItem.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{serviceItem.service.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                            <span>${serviceItem.service.price}</span>
                            <span>•</span>
                            <Clock className="h-3 w-3" />
                            <span>{serviceItem.service.duration}min</span>
                            <span>•</span>
                            <Scissors className="h-3 w-3" />
                            <span>{serviceItem.staff.name}</span>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeService(serviceItem.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Pricing and Checkout Section */}
            {selectedCustomer && selectedServices.length > 0 && pricing && (
              <div className="mx-auto w-full max-w-6xl">
                <div className="grid gap-6 md:grid-cols-1">
                  {/* Pricing Card */}
                  <Card className="rounded-2xl border border-neutral-200 bg-white">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-[#601625]" />
                        Pricing & Payment
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Tip Selection */}
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Tip Amount</Label>
                        <Tabs value={useCustomTip ? "custom" : "percentage"} onValueChange={(value) => setUseCustomTip(value === "custom")}>
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="percentage">Percentage</TabsTrigger>
                            <TabsTrigger value="custom">Custom Amount</TabsTrigger>
                          </TabsList>
                          <TabsContent value="percentage" className="space-y-3">
                            <div className="flex gap-2">
                              {[15, 18, 20, 25].map((percent) => (
                                <Button
                                  key={percent}
                                  variant={tipPercentage === percent ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setTipPercentage(percent)}
                                  className="flex-1"
                                >
                                  {percent}%
                                </Button>
                              ))}
                            </div>
                          </TabsContent>
                          <TabsContent value="custom" className="space-y-3">
                            <div className="relative">
                              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                type="number"
                                placeholder="0.00"
                                value={customTipAmount}
                                onChange={(e) => setCustomTipAmount(e.target.value)}
                                className="pl-10"
                              />
                            </div>
                          </TabsContent>
                        </Tabs>
                      </div>

                      {/* Pricing Breakdown */}
                      <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                        <div className="flex justify-between text-sm">
                          <span>Service Price</span>
                          <span>${pricing.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Tip ({useCustomTip ? 'Custom' : `${tipPercentage}%`})</span>
                          <span>${pricing.tipAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>GST ({(pricing.taxes.gst.rate * 100).toFixed(1)}%)</span>
                          <span>${pricing.taxes.gst.amount.toFixed(2)}</span>
                        </div>
                        <UISeparator />
                        <div className="flex justify-between font-semibold">
                          <span>Total</span>
                          <span>${pricing.totalAmount.toFixed(2)} {pricing.currency}</span>
                        </div>
                      </div>

                      {/* Payment Method */}
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Payment Method</Label>
                        <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment method" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="visa">
                              <div className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4" />
                                Visa/Mastercard
                              </div>
                            </SelectItem>
                            <SelectItem value="cash">
                              <div className="flex items-center gap-2">
                                <Wallet className="h-4 w-4" />
                                Cash
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Checkout Button */}
                      <Button 
                        size="lg" 
                        className="w-full bg-[#601625] hover:bg-[#751a29]"
                        onClick={handleCheckout}
                        disabled={processingCheckout}
                      >
                        {processingCheckout ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Receipt className="h-4 w-4 mr-2" />
                            Complete Walk-in (${pricing.totalAmount.toFixed(2)})
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </RoleGuard>
  )
}