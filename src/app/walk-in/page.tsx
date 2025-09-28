"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { RoleGuard } from "@/components/role-guard"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { 
  Users, 
  Plus, 
  DollarSign, 
  Clock, 
  CreditCard,
  CheckCircle2,
  User,
  Trash2,
  RefreshCw
} from "lucide-react"
import React, { useState, useEffect } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

// Interfaces matching the services tab exactly
interface Customer {
  id: string
  firstName: string
  lastName: string
  email?: string
  phone?: string
  fullName?: string
}

interface Service {
  id: string
  name: string
  description?: string
  slotDuration?: number
  slotDurationUnit?: 'mins' | 'hours'
  duration?: number
  teamMembers?: { userId: string; name?: string }[]
}

interface ServiceResponse {
  success: boolean
  calendars: Service[]
}

interface Staff {
  value: string
  label: string
  id: string
  name: string
  email: string
}

interface SelectedService {
  service: Service
  staff: Staff
  price: number
}

export default function WalkInPage() {
  const router = useRouter()

  // Customer search and selection
  const [customerSearch, setCustomerSearch] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [loadingCustomers, setLoadingCustomers] = useState(false)

  // Services - using exact same approach as services tab
  const [services, setServices] = useState<Service[]>([])
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([])
  const [loadingServices, setLoadingServices] = useState(true)

  // Staff - using exact same approach as services tab
  const [availableStaff, setAvailableStaff] = useState<Staff[]>([])

  // Service selection dialog
  const [showServiceDialog, setShowServiceDialog] = useState(false)
  const [tempSelectedService, setTempSelectedService] = useState<Service | null>(null)
  const [tempSelectedStaff, setTempSelectedStaff] = useState<Staff | null>(null)

  // Tip and pricing
  const [tipPercentage, setTipPercentage] = useState(18)
  const [useCustomTip, setUseCustomTip] = useState(false)
  const [customTipAmount, setCustomTipAmount] = useState('')

  // Processing
  const [processing, setProcessing] = useState(false)

  // Fetch services using EXACT same approach as services tab
  const fetchServices = async () => {
    try {
      setLoadingServices(true)
      const response = await fetch('https://restyle-backend.netlify.app/.netlify/functions/getAllServices')
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const result: ServiceResponse = await response.json()
      
      if (result.success) {
        const servicesData = result.calendars || []
        
        // Transform the data exactly like services tab
        const transformedServices = servicesData.map((service) => ({
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
        throw new Error('Failed to fetch services')
      }
    } catch (error) {
      console.error('Error fetching services:', error)
      toast.error('Failed to load services')
      setServices([])
    } finally {
      setLoadingServices(false)
    }
  }

  // Fetch staff using EXACT same approach as services tab
  const fetchAvailableStaff = async () => {
    try {
      const response = await fetch('https://restyle-backend.netlify.app/.netlify/functions/getAvailableStaff')
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      const result = await response.json()
      
      if (result.success && result.dropdownOptions) {
        setAvailableStaff(result.dropdownOptions)
        toast.success(`Loaded ${result.totalStaff} staff members`)
      }
    } catch (error) {
      console.error('Error fetching available staff:', error)
      toast.error('Failed to load staff options')
    }
  }

  // Extract price from service description exactly like services tab
  const getServicePrice = (service: Service): number => {
    if (!service.description) return 0
    const priceMatch = service.description.match(/CA\$(\d+(?:\.\d{2})?)/)
    return priceMatch ? parseFloat(priceMatch[1]) : 0
  }

  // Format duration exactly like services tab
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
    }
    return `${mins}m`
  }

  // Customer search
  const searchCustomers = async (query: string) => {
    if (!query.trim()) {
      setCustomers([])
      return
    }

    setLoadingCustomers(true)
    try {
      const response = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/searchContacts?query=${encodeURIComponent(query)}&limit=20`)
      if (!response.ok) throw new Error('Failed to search customers')
      
      const data = await response.json()
      const contacts = data.contacts || []
      
      const customerData = contacts.map((contact: {
        id: string
        firstName?: string
        lastName?: string
        email?: string
        phone?: string
      }) => ({
        id: contact.id,
        firstName: contact.firstName || '',
        lastName: contact.lastName || '',
        email: contact.email || '',
        phone: contact.phone || '',
        fullName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
      }))
      
      setCustomers(customerData)
    } catch (error) {
      console.error('Error searching customers:', error)
      toast.error('Failed to search customers')
    } finally {
      setLoadingCustomers(false)
    }
  }

  // Handle service selection
  const handleAddService = () => {
    if (!tempSelectedService || !tempSelectedStaff) {
      toast.error('Please select both a service and staff member')
      return
    }

    const price = getServicePrice(tempSelectedService)
    
    setSelectedServices(prev => [...prev, {
      service: tempSelectedService,
      staff: tempSelectedStaff,
      price
    }])
    
    setTempSelectedService(null)
    setTempSelectedStaff(null)
    setShowServiceDialog(false)
    toast.success('Service added successfully')
  }

  // Remove service
  const removeService = (index: number) => {
    setSelectedServices(prev => prev.filter((_, i) => i !== index))
    toast.success('Service removed')
  }

  // Calculate pricing
  const subtotal = selectedServices.reduce((sum, item) => sum + item.price, 0)
  const tipAmount = useCustomTip 
    ? parseFloat(customTipAmount) || 0 
    : (subtotal * tipPercentage) / 100
  const gst = subtotal * 0.05 // 5% GST
  const total = subtotal + tipAmount + gst

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

    setProcessing(true)
    try {
      const transactionId = crypto.randomUUID()
      
      const items = selectedServices.map((item) => ({
        id: crypto.randomUUID(),
        serviceId: item.service.id,
        serviceName: item.service.name,
        price: item.price,
        staffName: item.staff.name,
        paymentId: transactionId
      }))

      const payload = {
        transaction: {
          id: transactionId,
          paymentDate: new Date().toISOString(),
          method: 'cash', // Default for walk-in
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
          customerName: selectedCustomer.fullName || `${selectedCustomer.firstName} ${selectedCustomer.lastName}`,
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
      setProcessing(false)
    }
  }

  useEffect(() => {
    fetchServices()
    fetchAvailableStaff()
  }, [])

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
          {/* Header */}
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[data-collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex items-center justify-between gap-2 px-4 w-full">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4" />
                <h1 className="text-xl font-semibold">Walk-in Checkout</h1>
              </div>
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <div className="space-y-6">
              
              {/* Customer Selection */}
              <Card className="border-neutral-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-[#7b1d1d]" />
                    Customer Selection
                  </CardTitle>
                  <CardDescription>Search and select a customer for this walk-in service</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Search Customer</Label>
                    <Input
                      placeholder="Search by name, email, or phone..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  
                  {loadingCustomers && (
                    <div className="text-center py-4">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                      <p>Searching customers...</p>
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
                          <div className="font-medium">{customer.fullName || `${customer.firstName} ${customer.lastName}`}</div>
                          <div className="text-sm text-neutral-600 space-x-3">
                            {customer.email && <span>{customer.email}</span>}
                            {customer.phone && <span>{customer.phone}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {selectedCustomer && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 text-green-800">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="font-medium">Selected Customer:</span>
                        <span>{selectedCustomer.fullName || `${selectedCustomer.firstName} ${selectedCustomer.lastName}`}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Service Selection */}
              <Card className="border-neutral-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-[#7b1d1d]" />
                    Services
                  </CardTitle>
                  <CardDescription>Add services for this walk-in appointment</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button 
                    onClick={() => setShowServiceDialog(true)}
                    className="bg-[#7b1d1d] hover:bg-[#6b1717]"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Service
                  </Button>

                  {selectedServices.length > 0 && (
                    <div className="space-y-3">
                      {selectedServices.map((item, index) => (
                        <div key={index} className="p-4 border border-neutral-200 rounded-lg bg-white">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <div className="font-medium">{item.service.name}</div>
                              <div className="text-sm text-neutral-600">
                                with {item.staff.name} • {formatDuration(item.service.duration || 60)} • CA${item.price.toFixed(2)}
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
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Pricing Summary */}
              {selectedServices.length > 0 && (
                <Card className="border-neutral-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-[#7b1d1d]" />
                      Pricing Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>CA${subtotal.toFixed(2)}</span>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label>Tip:</Label>
                          <Select value={useCustomTip ? 'custom' : tipPercentage.toString()} onValueChange={(value) => {
                            if (value === 'custom') {
                              setUseCustomTip(true)
                            } else {
                              setUseCustomTip(false)
                              setTipPercentage(parseInt(value))
                            }
                          }}>
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="15">15%</SelectItem>
                              <SelectItem value="18">18%</SelectItem>
                              <SelectItem value="20">20%</SelectItem>
                              <SelectItem value="25">25%</SelectItem>
                              <SelectItem value="custom">Custom</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {useCustomTip && (
                          <Input
                            type="number"
                            placeholder="Enter custom tip amount"
                            value={customTipAmount}
                            onChange={(e) => setCustomTipAmount(e.target.value)}
                            className="w-48"
                          />
                        )}
                        
                        <div className="flex justify-between">
                          <span>Tip Amount:</span>
                          <span>CA${tipAmount.toFixed(2)}</span>
                        </div>
                      </div>
                      
                      <div className="flex justify-between">
                        <span>GST (5%):</span>
                        <span>CA${gst.toFixed(2)}</span>
                      </div>
                      
                      <Separator />
                      
                      <div className="flex justify-between text-lg font-semibold">
                        <span>Total:</span>
                        <span>CA${total.toFixed(2)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Process Button */}
              {selectedCustomer && selectedServices.length > 0 && (
                <div className="flex justify-end">
                  <Button
                    onClick={processWalkIn}
                    disabled={processing}
                    className="bg-green-600 hover:bg-green-700 px-8 py-3 text-lg"
                  >
                    {processing ? (
                      <>
                        <RefreshCw className="h-5 w-5 mr-3 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-5 w-5 mr-3" />
                        Process Walk-in (CA${total.toFixed(2)})
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Service Selection Dialog */}
          <Dialog open={showServiceDialog} onOpenChange={setShowServiceDialog}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Service</DialogTitle>
                <DialogDescription>Select a service and assign a staff member</DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label>Select Service</Label>
                    {loadingServices ? (
                      <div className="text-center py-8">
                        <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                        <p>Loading services...</p>
                      </div>
                    ) : (
                      <div className="grid gap-3 max-h-60 overflow-y-auto mt-2">
                        {services.map((service) => {
                          const price = getServicePrice(service)
                          return (
                            <div
                              key={service.id}
                              onClick={() => setTempSelectedService(service)}
                              className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                                tempSelectedService?.id === service.id
                                  ? 'bg-[#7b1d1d]/10 border-[#7b1d1d]'
                                  : 'border-neutral-200 hover:bg-neutral-50'
                              }`}
                            >
                              <div className="font-medium">{service.name}</div>
                              <div className="text-sm text-neutral-600">
                                {formatDuration(service.duration || 60)} • CA${price.toFixed(2)}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div>
                    <Label>Select Staff Member</Label>
                    <div className="grid gap-3 max-h-60 overflow-y-auto mt-2">
                      {availableStaff.map((staff) => (
                        <div
                          key={staff.value}
                          onClick={() => setTempSelectedStaff(staff)}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            tempSelectedStaff?.value === staff.value
                              ? 'bg-[#7b1d1d]/10 border-[#7b1d1d]'
                              : 'border-neutral-200 hover:bg-neutral-50'
                          }`}
                        >
                          <div className="font-medium">{staff.name}</div>
                          <div className="text-sm text-neutral-600">{staff.email}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setShowServiceDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleAddService}
                    disabled={!tempSelectedService || !tempSelectedStaff}
                    className="bg-[#7b1d1d] hover:bg-[#6b1717]"
                  >
                    Add Service
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