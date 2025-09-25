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
  Percent
} from "lucide-react"
import React, { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { toast } from "sonner"

interface AppointmentDetails {
  id: string
  serviceName: string
  startTime: string
  endTime: string
  customerName: string
  customerPhone?: string
  staffName: string
  address?: string
  duration?: number
  calendar_id: string
  assigned_user_id: string
}

interface PricingBreakdown {
  subtotal: number
  tipAmount: number
  taxes: {
    gst: { rate: number; amount: number }
    pst: { rate: number; amount: number }
    totalTax: number
  }
  totalAmount: number
  currency: string
}

interface TipDistribution {
  staffName: string
  servicePrice: number
  sharePercentage: number
  tipAmount: number
  totalEarning: number
}

interface PaymentSession {
  sessionId: string
  appointments: Array<{
    serviceName: string
    servicePrice: number
    staffName: string
    duration: string
  }>
  pricing: PricingBreakdown
  tipDistribution: TipDistribution[]
}

export default function CheckoutPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // URL Parameters
  const appointmentId = searchParams?.get('appointmentId')
  const calendarId = searchParams?.get('calendarId') 
  const staffId = searchParams?.get('staffId')
  
  // State
  const [appointmentDetails, setAppointmentDetails] = useState<AppointmentDetails | null>(null)
  const [paymentSession, setPaymentSession] = useState<PaymentSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [processingPayment, setProcessingPayment] = useState(false)
  
  // Form state
  const [customerInfo, setCustomerInfo] = useState({
    email: '',
    name: '',
    phone: ''
  })
  const [tipPercentage, setTipPercentage] = useState(18)
  const [customTipAmount, setCustomTipAmount] = useState('')
  const [useCustomTip, setUseCustomTip] = useState(false)

  // Fetch appointment details
  const fetchAppointmentDetails = async () => {
    if (!appointmentId) {
      toast.error('No appointment ID provided')
      router.push('/calendar')
      return
    }

    try {
      const response = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/getBooking?id=${appointmentId}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch appointment details')
      }

      const data = await response.json()
      
      if (data.appointment) {
        const apt = data.appointment
        
        // Fetch contact details
        let customerName = 'Unknown Customer'
        let customerPhone = ''
        
        if (apt.contactId) {
          try {
            const contactRes = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/getContact?id=${apt.contactId}`)
            const contactData = await contactRes.json()
            if (contactData.contact) {
              customerName = `${contactData.contact.firstName || ''} ${contactData.contact.lastName || ''}`.trim()
              customerPhone = contactData.contact.phone || ''
            }
          } catch (error) {
            console.warn('Failed to fetch contact details:', error)
          }
        }

        // Fetch staff details
        let staffName = 'Staff Member'
        if (apt.assignedUserId) {
          try {
            const staffRes = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/Staff?id=${apt.assignedUserId}`)
            const staffData = await staffRes.json()
            if (staffData.name) {
              staffName = staffData.name
            }
          } catch (error) {
            console.warn('Failed to fetch staff details:', error)
          }
        }

        const details: AppointmentDetails = {
          id: appointmentId,
          serviceName: apt.title || 'Service',
          startTime: apt.startTime || '',
          endTime: apt.endTime || '',
          customerName,
          customerPhone,
          staffName,
          address: apt.address,
          calendar_id: calendarId || apt.calendarId || '',
          assigned_user_id: staffId || apt.assignedUserId || ''
        }

        // Calculate duration
        if (apt.startTime && apt.endTime) {
          const start = new Date(apt.startTime)
          const end = new Date(apt.endTime)
          details.duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60))
        }

        setAppointmentDetails(details)
        
        // Set customer info if available
        if (customerName && customerName !== 'Unknown Customer') {
          setCustomerInfo(prev => ({
            ...prev,
            name: customerName,
            phone: customerPhone
          }))
        }
      }
    } catch (error) {
      console.error('Error fetching appointment details:', error)
      toast.error('Failed to load appointment details')
      router.push('/calendar')
    }
  }

  // Initialize payment session
  const initializePayment = async () => {
    if (!appointmentDetails) return

    try {
      const response = await fetch('https://restyle-backend.netlify.app/.netlify/functions/initializePayment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          appointmentData: [{
            calendarId: appointmentDetails.calendar_id,
            staffId: appointmentDetails.assigned_user_id,
            appointmentId: appointmentDetails.id
          }],
          customerInfo: {
            email: customerInfo.email,
            name: customerInfo.name || appointmentDetails.customerName,
            phone: customerInfo.phone || appointmentDetails.customerPhone || ''
          },
          tipPercentage: useCustomTip ? 0 : tipPercentage,
          customTipAmount: useCustomTip ? parseFloat(customTipAmount) || 0 : undefined,
          locationId: "7LYI93XFo8j4nZfswlaz" // Default location ID
        })
      })

      if (!response.ok) {
        throw new Error('Failed to initialize payment')
      }

      const result = await response.json()
      
      if (result.success && result.paymentSession) {
        setPaymentSession(result.paymentSession)
      } else {
        throw new Error(result.error || 'Payment initialization failed')
      }
    } catch (error) {
      console.error('Error initializing payment:', error)
      toast.error('Failed to calculate pricing')
    }
  }

  // Create checkout session and redirect to payment
  const proceedToCheckout = async () => {
    if (!paymentSession || !customerInfo.email) {
      toast.error('Please complete all required fields')
      return
    }

    setProcessingPayment(true)
    
    try {
      const response = await fetch('https://restyle-backend.netlify.app/.netlify/functions/createPaymentSession', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentSessionData: paymentSession,
          successUrl: `${window.location.origin}/checkout/success`,
          cancelUrl: `${window.location.origin}/checkout/cancel`,
          paymentMethods: ['card']
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create checkout session')
      }

      const result = await response.json()
      
      if (result.success && result.urls?.checkoutUrl) {
        // Redirect to LeadConnector checkout
        window.location.href = result.urls.checkoutUrl
      } else {
        throw new Error(result.error || 'Checkout creation failed')
      }
    } catch (error) {
      console.error('Error creating checkout:', error)
      toast.error('Failed to start checkout process')
    } finally {
      setProcessingPayment(false)
    }
  }

  // Format currency
  const formatCurrency = (amount: number, currency = 'CAD') => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: currency.replace('CA$', 'CAD').replace('US$', 'USD')
    }).format(amount)
  }

  // Format time
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  // Format duration
  const formatDuration = (minutes?: number) => {
    if (!minutes) return 'Not specified'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
    }
    return `${mins} mins`
  }

  // Update pricing when tip changes
  useEffect(() => {
    if (appointmentDetails && customerInfo.name) {
      initializePayment()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipPercentage, customTipAmount, useCustomTip, appointmentDetails, customerInfo])

  // Fetch data on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      await fetchAppointmentDetails()
      setLoading(false)
    }
    
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId, calendarId, staffId])

  if (!appointmentId || !calendarId) {
    return (
      <RoleGuard>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <div className="flex items-center justify-center min-h-screen">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h1 className="text-xl font-semibold mb-2">Invalid Checkout Link</h1>
                <p className="text-muted-foreground mb-4">Required appointment information is missing</p>
                <Button onClick={() => router.push('/calendar')}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Return to Calendar
                </Button>
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
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <div className="flex items-center justify-between w-full px-4">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4" />
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <h1 className="text-xl font-semibold">Checkout</h1>
                </div>
              </div>
              <Button variant="outline" onClick={() => router.push('/calendar')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Calendar
              </Button>
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
            {loading ? (
              <div className="grid gap-6 md:grid-cols-2">
                <Skeleton className="h-96" />
                <Skeleton className="h-96" />
              </div>
            ) : !appointmentDetails ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Appointment Not Found</h2>
                <p className="text-muted-foreground">Could not load appointment details</p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                
                {/* Left Column - Appointment Details */}
                <div className="space-y-6">
                  
                  {/* Appointment Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CalendarIcon className="h-5 w-5 text-primary" />
                        Appointment Details
                      </CardTitle>
                      <CardDescription>
                        Service and timing information
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-primary/10 rounded-full">
                            <Receipt className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium">{appointmentDetails.serviceName}</div>
                            <div className="text-sm text-muted-foreground">Service</div>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-blue-100 rounded-full">
                            <Clock className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-medium">
                              {appointmentDetails.startTime && formatTime(appointmentDetails.startTime)}
                              {appointmentDetails.endTime && ` - ${formatTime(appointmentDetails.endTime)}`}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {appointmentDetails.startTime && formatDate(appointmentDetails.startTime)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Duration: {formatDuration(appointmentDetails.duration)}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-green-100 rounded-full">
                            <UserIcon className="h-4 w-4 text-green-600" />
                          </div>
                          <div>
                            <div className="font-medium">{appointmentDetails.staffName}</div>
                            <div className="text-sm text-muted-foreground">Assigned Staff</div>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-purple-100 rounded-full">
                            <UserIcon className="h-4 w-4 text-purple-600" />
                          </div>
                          <div>
                            <div className="font-medium">{appointmentDetails.customerName}</div>
                            <div className="text-sm text-muted-foreground">
                              {appointmentDetails.customerPhone || 'Customer'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Customer Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <UserIcon className="h-5 w-5 text-primary" />
                        Customer Information
                      </CardTitle>
                      <CardDescription>
                        Contact details for receipt and confirmation
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="customer-name">Full Name *</Label>
                          <Input
                            id="customer-name"
                            type="text"
                            value={customerInfo.name}
                            onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Enter customer name"
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="customer-email">Email Address *</Label>
                          <Input
                            id="customer-email"
                            type="email"
                            value={customerInfo.email}
                            onChange={(e) => setCustomerInfo(prev => ({ ...prev, email: e.target.value }))}
                            placeholder="customer@example.com"
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="customer-phone">Phone Number</Label>
                          <Input
                            id="customer-phone"
                            type="tel"
                            value={customerInfo.phone}
                            onChange={(e) => setCustomerInfo(prev => ({ ...prev, phone: e.target.value }))}
                            placeholder="+1 (555) 123-4567"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Right Column - Pricing & Payment */}
                <div className="space-y-6">
                  
                  {/* Tip Selection */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Percent className="h-5 w-5 text-primary" />
                        Tip Amount
                      </CardTitle>
                      <CardDescription>
                        Add a tip to show appreciation for great service
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-4 gap-2">
                        {[15, 18, 20, 25].map(percent => (
                          <Button
                            key={percent}
                            variant={!useCustomTip && tipPercentage === percent ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              setUseCustomTip(false)
                              setTipPercentage(percent)
                            }}
                            className="text-xs"
                          >
                            {percent}%
                          </Button>
                        ))}
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Custom Tip Amount</Label>
                        <div className="flex gap-2">
                          <Select
                            value={useCustomTip ? "custom" : "percentage"}
                            onValueChange={(value) => setUseCustomTip(value === "custom")}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percentage">Percentage</SelectItem>
                              <SelectItem value="custom">Fixed Amount</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          {useCustomTip ? (
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={customTipAmount}
                              onChange={(e) => setCustomTipAmount(e.target.value)}
                              placeholder="0.00"
                              className="flex-1"
                            />
                          ) : (
                            <Input
                              type="number"
                              min="0"
                              max="50"
                              value={tipPercentage}
                              onChange={(e) => setTipPercentage(Number(e.target.value))}
                              className="flex-1"
                            />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Pricing Breakdown */}
                  {paymentSession && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <DollarSign className="h-5 w-5 text-primary" />
                          Pricing Summary
                        </CardTitle>
                        <CardDescription>
                          Complete breakdown of charges and taxes
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        
                        {/* Service Items */}
                        <div className="space-y-2">
                          {paymentSession.appointments.map((apt, index) => (
                            <div key={index} className="flex justify-between items-center py-2">
                              <div>
                                <div className="font-medium">{apt.serviceName}</div>
                                <div className="text-sm text-muted-foreground">
                                  {apt.duration} • {apt.staffName}
                                </div>
                              </div>
                              <div className="font-medium">
                                {formatCurrency(apt.servicePrice, paymentSession.pricing.currency)}
                              </div>
                            </div>
                          ))}
                        </div>

                        <UISeparator />

                        {/* Totals */}
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span>Subtotal</span>
                            <span>{formatCurrency(paymentSession.pricing.subtotal, paymentSession.pricing.currency)}</span>
                          </div>
                          
                          {paymentSession.pricing.tipAmount > 0 && (
                            <div className="flex justify-between">
                              <span>Tip ({useCustomTip ? 'Custom' : `${tipPercentage}%`})</span>
                              <span>{formatCurrency(paymentSession.pricing.tipAmount, paymentSession.pricing.currency)}</span>
                            </div>
                          )}
                          
                          <div className="flex justify-between text-sm">
                            <span>GST ({paymentSession.pricing.taxes.gst.rate}%)</span>
                            <span>{formatCurrency(paymentSession.pricing.taxes.gst.amount, paymentSession.pricing.currency)}</span>
                          </div>
                          
                          <div className="flex justify-between text-sm">
                            <span>PST ({paymentSession.pricing.taxes.pst.rate}%)</span>
                            <span>{formatCurrency(paymentSession.pricing.taxes.pst.amount, paymentSession.pricing.currency)}</span>
                          </div>

                          <UISeparator />
                          
                          <div className="flex justify-between text-lg font-bold">
                            <span>Total</span>
                            <span>{formatCurrency(paymentSession.pricing.totalAmount, paymentSession.pricing.currency)}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Staff Tip Distribution */}
                  {paymentSession && paymentSession.tipDistribution.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Users className="h-5 w-5 text-primary" />
                          Staff Tip Distribution
                        </CardTitle>
                        <CardDescription>
                          How tips will be shared among staff members
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {paymentSession.tipDistribution.map((staff, index) => (
                            <div key={index} className="p-3 bg-muted/30 rounded-lg">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-medium">{staff.staffName}</div>
                                  <div className="text-sm text-muted-foreground">
                                    Service: {formatCurrency(staff.servicePrice, paymentSession.pricing.currency)} ({staff.sharePercentage.toFixed(1)}% share)
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-medium text-green-600">
                                    +{formatCurrency(staff.tipAmount, paymentSession.pricing.currency)}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    Total: {formatCurrency(staff.totalEarning, paymentSession.pricing.currency)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Checkout Button */}
                  <Card>
                    <CardContent className="pt-6">
                      <Button
                        size="lg"
                        className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={proceedToCheckout}
                        disabled={processingPayment || !customerInfo.email || !customerInfo.name || !paymentSession}
                      >
                        {processingPayment ? (
                          <>
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <CreditCard className="h-5 w-5 mr-2" />
                            Proceed to Payment
                            {paymentSession && (
                              <span className="ml-2 font-bold">
                                {formatCurrency(paymentSession.pricing.totalAmount, paymentSession.pricing.currency)}
                              </span>
                            )}
                          </>
                        )}
                      </Button>
                      
                      <p className="text-xs text-center text-muted-foreground mt-3">
                        You will be redirected to our secure payment processor to complete your transaction
                      </p>
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