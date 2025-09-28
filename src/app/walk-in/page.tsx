'use client'

import React, { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Search, User, DollarSign, Users } from "lucide-react"
import { useRouter } from 'next/navigation'

interface Service {
  id: string
  name: string
  description: string
  calendars: string[]
}

interface Customer {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
}

interface Staff {
  id: string
  name: string
  ghlId: string
}

interface SelectedService {
  service: Service
  price: number
}

export default function WalkInPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [tipPercentage, setTipPercentage] = useState(18)
  const [paymentMethod, setPaymentMethod] = useState('card')
  const router = useRouter()

  const extractPriceFromDescription = (description: string): number => {
    const priceMatch = description.match(/\$(\d+(?:\.\d{2})?)/);
    return priceMatch ? parseFloat(priceMatch[1]) : 0;
  };

  const searchCustomers = async (query: string) => {
    if (!query.trim()) {
      setCustomers([])
      return
    }

    setIsSearching(true)
    try {
      const response = await fetch(`/.netlify/functions/searchContacts?query=${encodeURIComponent(query)}`)
      const data = await response.json()
      
      if (data.contacts && Array.isArray(data.contacts)) {
        const formattedCustomers = data.contacts.map((contact: {
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
          phone: contact.phone || ''
        }))
        setCustomers(formattedCustomers)
      }
    } catch (error) {
      console.error('Error searching customers:', error)
      setCustomers([])
    } finally {
      setIsSearching(false)
    }
  }

  const fetchGroups = async () => {
    try {
      const response = await fetch('/.netlify/functions/getAllServices')
      const data = await response.json()
      
      if (data.services && Array.isArray(data.services)) {
        setServices(data.services)
      }
    } catch (error) {
      console.error('Error fetching services:', error)
    }
  }

  const fetchStaff = async () => {
    try {
      const response = await fetch('/.netlify/functions/barber-hours')
      const data = await response.json()
      
      if (data.staff && Array.isArray(data.staff)) {
        setStaff(data.staff)
      }
    } catch (error) {
      console.error('Error fetching staff:', error)
    }
  }

  useEffect(() => {
    fetchGroups()
    fetchStaff()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      searchCustomers(searchQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const handleServiceSelect = (service: Service) => {
    const price = extractPriceFromDescription(service.description)
    const selectedService = { service, price }
    
    const isAlreadySelected = selectedServices.some(s => s.service.id === service.id)
    
    if (isAlreadySelected) {
      setSelectedServices(selectedServices.filter(s => s.service.id !== service.id))
    } else {
      setSelectedServices([...selectedServices, selectedService])
    }
  }

  const getTotalAmount = () => {
    return selectedServices.reduce((total, item) => total + item.price, 0)
  }

  const getTipAmount = () => {
    return (getTotalAmount() * tipPercentage) / 100
  }

  const getFinalTotal = () => {
    return getTotalAmount() + getTipAmount()
  }

  const getStaffTipDistribution = () => {
    const totalTip = getTipAmount()
    const staffCount = selectedStaff ? 1 : 0
    
    if (staffCount === 0) return []
    
    return [{
      staff: selectedStaff!,
      tipAmount: totalTip
    }]
  }

  const processWalkIn = async () => {
    if (!selectedCustomer || selectedServices.length === 0 || !selectedStaff) {
      alert('Please select customer, services, and staff member')
      return
    }

    setIsProcessing(true)
    try {
      const transactionData = {
        appointmentId: `walkin_${Date.now()}`,
        customerId: selectedCustomer.id,
        customerLookup: selectedCustomer.id, // This ensures customer name appears in payments
        services: selectedServices.map(item => ({
          serviceId: item.service.id,
          serviceName: item.service.name,
          price: item.price
        })),
        staffId: selectedStaff.ghlId,
        staffName: selectedStaff.name,
        totalAmount: getTotalAmount(),
        tipAmount: getTipAmount(),
        finalTotal: getFinalTotal(),
        paymentMethod,
        tipPercentage,
        isWalkIn: true,
        createdAt: new Date().toISOString()
      }

      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transactionData)
      })

      if (response.ok) {
        router.push('/checkout/success')
      } else {
        alert('Error processing walk-in. Please try again.')
      }
    } catch (error) {
      console.error('Error processing walk-in:', error)
      alert('Error processing walk-in. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Walk-in Checkout</h1>
        <p className="text-gray-600 mt-2">Process walk-in customers quickly and efficiently</p>
      </div>

      <div className="space-y-6">
        {/* Customer Search */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <User className="w-5 h-5" />
              Customer Search
            </CardTitle>
            <CardDescription>Search and select a customer</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {selectedCustomer ? (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{selectedCustomer.firstName} {selectedCustomer.lastName}</p>
                    <p className="text-sm text-gray-600">{selectedCustomer.email}</p>
                    <p className="text-sm text-gray-600">{selectedCustomer.phone}</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedCustomer(null)}
                  >
                    Change
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {isSearching && (
                  <div className="text-center py-4 text-gray-500">
                    Searching...
                  </div>
                )}

                {customers.length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {customers.map((customer) => (
                      <div
                        key={customer.id}
                        className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => setSelectedCustomer(customer)}
                      >
                        <p className="font-medium">{customer.firstName} {customer.lastName}</p>
                        <p className="text-sm text-gray-600">{customer.email}</p>
                        <p className="text-sm text-gray-600">{customer.phone}</p>
                      </div>
                    ))}
                  </div>
                )}

                {searchQuery && !isSearching && customers.length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    No customers found. Try a different search term.
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Service Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Service Selection
            </CardTitle>
            <CardDescription>Choose services for this walk-in</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {services.map((service) => {
                const price = extractPriceFromDescription(service.description)
                const isSelected = selectedServices.some(s => s.service.id === service.id)
                
                return (
                  <div
                    key={service.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleServiceSelect(service)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium">{service.name}</h3>
                        <div 
                          className="text-sm text-gray-600 mt-1"
                          dangerouslySetInnerHTML={{ __html: service.description }}
                        />
                      </div>
                      <div className="ml-4 text-right">
                        {price > 0 ? (
                          <Badge variant="secondary">${price}</Badge>
                        ) : (
                          <Badge variant="outline">Price varies</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Staff Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Users className="w-5 h-5" />
              Staff Assignment
            </CardTitle>
            <CardDescription>Assign a staff member for this service</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {staff.map((member) => (
                <div
                  key={member.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedStaff?.id === member.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedStaff(member)}
                >
                  <p className="font-medium">{member.name}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedServices.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No services selected</p>
            ) : (
              <>
                <div className="space-y-3">
                  {selectedServices.map((item, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="font-medium">{item.service.name}</span>
                      <span>${item.price}</span>
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Subtotal</span>
                  <span>${getTotalAmount()}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Payment Method */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Payment Method</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {['card', 'cash'].map((method) => (
                <Button
                  key={method}
                  variant={paymentMethod === method ? "default" : "outline"}
                  onClick={() => setPaymentMethod(method)}
                  className="capitalize"
                >
                  {method}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tip Calculation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Tip & Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Tip Percentage</Label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {[15, 18, 20, 25].map((percentage) => (
                  <Button
                    key={percentage}
                    variant={tipPercentage === percentage ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTipPercentage(percentage)}
                  >
                    {percentage}%
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Tip Amount ({tipPercentage}%)</span>
                <span>${getTipAmount().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold">
                <span>Final Total</span>
                <span>${getFinalTotal().toFixed(2)}</span>
              </div>
            </div>

            {selectedStaff && getTipAmount() > 0 && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-2">Tip Distribution</h4>
                {getStaffTipDistribution().map((distribution, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span>{distribution.staff.name}</span>
                    <span>${distribution.tipAmount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Process Button */}
        <Button 
          onClick={processWalkIn}
          disabled={!selectedCustomer || selectedServices.length === 0 || !selectedStaff || isProcessing}
          className="w-full h-12 text-lg"
          style={{ backgroundColor: '#7b1d1d', color: 'white' }}
        >
          {isProcessing ? 'Processing...' : `Process Walk-in - $${getFinalTotal().toFixed(2)}`}
        </Button>
      </div>
    </div>
  )
}