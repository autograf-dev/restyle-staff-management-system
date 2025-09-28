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
  CreditCard,
  ArrowLeft,
  AlertCircle,
  Loader2,
  Receipt,
  Users,
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

interface ContactResponse {
  id: string | number
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  contactName?: string
}

interface ServiceResponse {
  id: string
  name?: string
  title?: string
  description?: string
  category?: string
  servicePrice?: number
  price?: number
  durationMinutes?: number
  duration?: number
  teamMembers?: Array<{
    userId: string
    priority: number
    selected: boolean
  }>
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
  const [staffData, setStaffData] = useState<Array<{ ghl_id: string; name: string }>>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [groupServices, setGroupServices] = useState<GroupServices>({})
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  
  // Loading states
  const [loading, setLoading] = useState(true)
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [processingCheckout, setProcessingCheckout] = useState(false)
  
  // Form state
  const [tipPercentage, setTipPercentage] = useState(18)
  const [customTipAmount, setCustomTipAmount] = useState('')
  const [useCustomTip, setUseCustomTip] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('visa')
  const [customerSearch, setCustomerSearch] = useState('')

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

  // Fetch customers from the same endpoint as customer page
  const fetchCustomers = async () => {
    try {
      const res = await fetch('https://restyle-backend.netlify.app/.netlify/functions/getcontacts?page=1')
      if (!res.ok) throw new Error("Failed to fetch customers")
      const json = await res.json()
      
      const formattedCustomers = json.contacts?.map((contact: ContactResponse) => ({
        id: String(contact.id),
        firstName: contact.firstName || '',
        lastName: contact.lastName || '',
        email: contact.email || '',
        phone: contact.phone,
        fullName: contact.contactName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
      })) || []
      
      setCustomers(formattedCustomers)
    } catch (error) {
      console.error('Error fetching customers:', error)
      toast.error('Error loading customers')
    }
  }

  // Fetch staff data (same as checkout)
  const fetchStaffData = async () => {
    try {
      const response = await fetch('/api/barber-hours')
      if (!response.ok) throw new Error('Failed to fetch staff data')
      const result = await response.json()
      
      if (result.ok && result.data) {
        const staff = result.data.map((barber: { ghl_id: string; 'Barber/Name': string }) => ({
          ghl_id: barber['ghl_id'],
          name: barber['Barber/Name']
        }))
        setStaffData(staff)
      }
    } catch (error) {
      console.error('Error fetching staff data:', error)
      toast.error('Error loading staff')
    }
  }

  // Fetch services using the working Netlify function (same as services page)
  const fetchServices = async () => {
    try {
      setLoadingGroups(true)
      const response = await fetch('https://restyle-backend.netlify.app/.netlify/functions/getAllServices')
      if (!response.ok) throw new Error('Failed to fetch services')
      
      const result = await response.json()
      if (result.success && result.services) {
        // Group services by category/type for better organization
        const serviceGroups: { [key: string]: Service[] } = {}
        const groupNames: Group[] = []
        
        result.services.forEach((service: ServiceResponse) => {
          // Create a simple category grouping
          const category = service.category || 'General Services'
          if (!serviceGroups[category]) {
            serviceGroups[category] = []
            // Add to groups list if not already there
            if (!groupNames.find(g => g.name === category)) {
              groupNames.push({
                id: category.toLowerCase().replace(/\s+/g, '-'),
                name: category,
                description: `${category} services`,
                slug: category.toLowerCase().replace(/\s+/g, '-'),
                isActive: true
              })
            }
          }
          
          // Format service with required fields
          serviceGroups[category].push({
            id: service.id,
            name: service.name || service.title || 'Unknown Service',
            price: service.servicePrice || service.price || 0,
            duration: service.durationMinutes || service.duration || 30,
            description: service.description || '',
            teamMembers: service.teamMembers || []
          })
        })
        
        setGroups(groupNames)
        setGroupServices(serviceGroups)
        
        // Set first group as selected
        if (groupNames.length > 0) {
          setSelectedGroupId(groupNames[0].id)
        }
      }
    } catch (error) {
      console.error('Error fetching services:', error)
      toast.error('Error loading services')
    } finally {
      setLoadingGroups(false)
    }
  }

  // Initialize data
  useEffect(() => {
    const initializeData = async () => {
      setLoading(true)
      try {
        await Promise.all([
          fetchCustomers(),
          fetchStaffData(),
          fetchServices()
        ])
      } catch (error) {
        console.error('Error initializing data:', error)
        toast.error('Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    
    initializeData()
  }, [])  // Fetch services for a group (same as checkout)


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

  // Filter customers based on search
  const filteredCustomers = customers.filter(customer =>
    customer.fullName.toLowerCase().includes(customerSearch.toLowerCase()) ||
    customer.email.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (customer.phone && customer.phone.includes(customerSearch))
  )

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
              <div className="mx-auto grid w-full max-w-6xl gap-6 md:grid-cols-1">
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
          <div className="flex h-16 shrink-0 items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-4 p-4">
            <div className="mx-auto w-full max-w-6xl">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Walk-in Processing</h1>
                <p className="text-gray-600">Process walk-in customers quickly and efficiently</p>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                {/* Customer Selection */}
                <Card className="rounded-2xl border-neutral-200 shadow-none">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-[16px] font-semibold flex items-center gap-2">
                      <Users className="h-5 w-5 text-[#7b1d1d]" />
                      Select Customer
                    </CardTitle>
                    <CardDescription className="text-[13px]">Choose existing customer</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                          <Skeleton key={i} className="h-12 w-full" />
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="relative">
                          <Input
                            placeholder="Search customers..."
                            value={customerSearch}
                            onChange={(e) => setCustomerSearch(e.target.value)}
                            className="pl-4"
                          />
                        </div>
                        
                        <div className="max-h-60 overflow-y-auto space-y-2">
                          {filteredCustomers.map((customer) => (
                            <div
                              key={customer.id}
                              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                selectedCustomer?.id === customer.id
                                  ? 'border-[#7b1d1d] bg-[#7b1d1d]/10 shadow-sm'
                                  : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                              }`}
                              onClick={() => setSelectedCustomer(customer)}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-sm">{customer.fullName}</p>
                                  <p className="text-xs text-gray-500">{customer.email}</p>
                                  {customer.phone && (
                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      {customer.phone}
                                    </p>
                                  )}
                                </div>
                                {selectedCustomer?.id === customer.id && (
                                  <div className="h-4 w-4 rounded-full bg-[#7b1d1d] flex items-center justify-center">
                                    <div className="h-2 w-2 rounded-full bg-white" />
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Services Selection */}
                <Card className="rounded-2xl border-neutral-200 shadow-none">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-[16px] font-semibold flex items-center gap-2">
                      <Scissors className="h-5 w-5 text-[#7b1d1d]" />
                      Add Services
                    </CardTitle>
                    <CardDescription className="text-[13px]">Select services and assign staff</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                          <Skeleton key={i} className="h-12 w-full" />
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Service Group Selection */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Service Category</Label>
                          <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select service category" />
                            </SelectTrigger>
                            <SelectContent>
                              {groups.map((group) => (
                                <SelectItem key={group.id} value={group.id}>
                                  {group.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Service Selection */}
                        {selectedGroupId && (
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Service</Label>
                            <Select 
                              value={selectedService?.id || ''} 
                              onValueChange={(value) => {
                                const service = groupServices[selectedGroupId]?.find(s => s.id === value)
                                setSelectedService(service || null)
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select service" />
                              </SelectTrigger>
                              <SelectContent>
                                {(groupServices[selectedGroupId] || []).map((service) => (
                                  <SelectItem key={service.id} value={service.id}>
                                    <div className="flex items-center justify-between w-full">
                                      <span>{service.name}</span>
                                      <span className="ml-2 text-sm text-gray-500">${service.price}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {/* Staff Selection */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Assigned Staff</Label>
                          <Select 
                            value={selectedStaff?.ghl_id || ''} 
                            onValueChange={(value) => {
                              const staff = staffData.find(s => s.ghl_id === value)
                              setSelectedStaff(staff ? { ...staff, email: undefined } : null)
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select staff member" />
                            </SelectTrigger>
                            <SelectContent>
                              {staffData.map((staff) => (
                                <SelectItem key={staff.ghl_id} value={staff.ghl_id}>
                                  {staff.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Add Service Button */}
                        <Button 
                          onClick={addServiceToList}
                          disabled={!selectedService || !selectedStaff}
                          className="w-full bg-[#7b1d1d] hover:bg-[#601625]"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Service
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Selected Services */}
                {selectedServices.length > 0 && (
                  <Card className="rounded-2xl border-neutral-200 shadow-none lg:col-span-2">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-[16px] font-semibold flex items-center gap-2">
                        <Clock className="h-5 w-5 text-[#7b1d1d]" />
                        Selected Services
                      </CardTitle>
                      <CardDescription className="text-[13px]">Review and modify selected services</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {selectedServices.map((item, index) => (
                          <div key={item.id} className="flex items-center justify-between p-4 bg-neutral-50 rounded-xl">
                            <div className="flex items-center gap-4">
                              <div className="flex-1">
                                <h4 className="font-medium text-sm">{item.service.name}</h4>
                                <p className="text-xs text-gray-500">
                                  {item.staff?.name} • {item.service.duration} min • ${item.service.price}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeService(item.id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Pricing and Checkout Section */}
                {selectedCustomer && selectedServices.length > 0 && pricing && (
                  <Card className="rounded-2xl border-neutral-200 shadow-none lg:col-span-2">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-[16px] font-semibold flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-[#7b1d1d]" />
                        Pricing Summary
                      </CardTitle>
                      <CardDescription className="text-[13px]">Complete breakdown of charges and taxes</CardDescription>
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
                        className="w-full bg-[#7b1d1d] hover:bg-[#601625]"
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
                )}
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </RoleGuard>
  )
}
