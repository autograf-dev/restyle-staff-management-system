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
  Percent,
  Phone,
} from "lucide-react"
import React, { useState, useEffect, Suspense } from "react"
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

function CheckoutContent() {
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
  
  // Form state (email now auto-filled from contact; kept in state for checkout requirement)
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
        let customerEmail = ''
        
        if (apt.contactId) {
          try {
            const contactRes = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/getContact?id=${apt.contactId}`)
            const contactData = await contactRes.json()
            if (contactData.contact) {
              customerName = `${contactData.contact.firstName || ''} ${contactData.contact.lastName || ''}`.trim()
              customerPhone = contactData.contact.phone || ''
              customerEmail = contactData.contact.email || contactData.contact.email_lower || contactData.contact.emailAddress || ''
            }
          } catch (error) {
            console.warn('Failed to fetch contact details:', error)
          }
        }

        // Fetch staff details (Assigned Staff)
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
        
        // Seed customer info (so checkout can proceed without a separate form)
        setCustomerInfo(prev => ({
          ...prev,
          name: customerName !== 'Unknown Customer' ? customerName : prev.name,
          phone: customerPhone || prev.phone,
          email: customerEmail || prev.email,
        }))
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
    if (appointmentDetails && (customerInfo.name || customerInfo.email)) {
      initializePayment()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipPercentage, customTipAmount, useCustomTip, appointmentDetails, customerInfo.email])

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
                <Button onClick={() => router.push('/calendar')} className="bg-[#7b1d1d] hover:bg-[#6b1717] text-white">
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

  const startLabel = appointmentDetails?.startTime ? formatTime(appointmentDetails.startTime) : ''
  const endLabel = appointmentDetails?.endTime ? formatTime(appointmentDetails.endTime) : ''
  const dateLabel = appointmentDetails?.startTime ? formatDate(appointmentDetails.startTime) : ''

  return (
    <RoleGuard>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          {/* Header with slimmer chrome */}
          <header className="flex h-14 items-center border-b bg-white/60 backdrop-blur px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mx-2 h-4" />
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-[#7b1d1d]" />
                <h1 className="text-[15px] font-semibold tracking-tight">Checkout</h1>
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
            {/* HERO CARD — now contains all appointment & customer info */}
            {appointmentDetails && (
              <div className="mx-auto w-full max-w-6xl rounded-2xl border border-neutral-200 bg-white px-6 py-5">
                <p className="text-[13px] font-medium text-neutral-500">Transaction In Progress</p>
                <h2 className="mt-1 text-[28px] font-semibold leading-tight text-neutral-900">{appointmentDetails.serviceName}</h2>
                <p className="mt-1 text-[14px] text-neutral-600">with {appointmentDetails.staffName}</p>
                <div className="mt-3 flex items-center gap-3 text-[14px] text-neutral-700">
                  <CalendarIcon className="h-4 w-4" />
                  <span className="font-medium">{startLabel}{endLabel ? ` - ${endLabel}` : ''}</span>
                  <span className="text-neutral-400">•</span>
                  <span>{dateLabel}</span>
                  {appointmentDetails.duration ? (
                    <>
                      <span className="text-neutral-400">•</span>
                      <span>Duration: {formatDuration(appointmentDetails.duration)}</span>
                    </>
                  ) : null}
                </div>

                {/* Customer + quick actions */}
                <div className="mt-5 rounded-xl border border-neutral-200 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Users className="h-4 w-4 text-neutral-400" />
                      <div>
                        <div className="text-[14px] font-semibold uppercase tracking-wide">{appointmentDetails.customerName}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-neutral-600">
                          {customerInfo.email && <span>{customerInfo.email}</span>}
                          {appointmentDetails.customerPhone && (
                            <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{appointmentDetails.customerPhone}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button variant="outline" className="h-8 rounded-lg border-neutral-200 text-[13px]">Booking Link</Button>
                      <Button variant="outline" className="h-8 rounded-lg border-neutral-200 text-[13px]">Club Card Link</Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {loading ? (
              <div className="mx-auto grid w-full max-w-6xl gap-6 md:grid-cols-1">
                <Skeleton className="h-96 rounded-2xl" />
              </div>
            ) : !appointmentDetails ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Appointment Not Found</h2>
                <p className="text-muted-foreground">Could not load appointment details</p>
              </div>
            ) : (
              <div className="mx-auto grid w-full max-w-6xl gap-6 md:grid-cols-1">
                {/* RIGHT COLUMN ONLY — Tip, Pricing, Distribution, Complete */}
                <div className="space-y-6">
                  <Card className="rounded-2xl border-neutral-200 shadow-none">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-[16px] font-semibold flex items-center gap-2">
                        <Percent className="h-5 w-5 text-[#7b1d1d]" />
                        Tip Amount
                      </CardTitle>
                      <CardDescription className="text-[13px]">Add a tip to show appreciation for great service</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-4 gap-2">
                        {[15, 18, 20, 25].map(percent => (
                          <Button
                            key={percent}
                            variant={!useCustomTip && tipPercentage === percent ? "default" : "outline"}
                            size="sm"
                            onClick={() => { setUseCustomTip(false); setTipPercentage(percent) }}
                            className={`h-9 rounded-lg text-[13px] ${(!useCustomTip && tipPercentage === percent) ? 'bg-[#7b1d1d] hover:bg-[#6b1717] text-white' : ''}`}
                          >
                            {percent}%
                          </Button>
                        ))}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[13px]">Custom Tip Amount</Label>
                        <div className="flex gap-2">
                          <Select value={useCustomTip ? "custom" : "percentage"} onValueChange={(v) => setUseCustomTip(v === "custom")}>
                            <SelectTrigger className="w-40 rounded-xl text-[14px]">
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
                              className="flex-1 rounded-xl"
                            />
                          ) : (
                            <Input
                              type="number"
                              min="0"
                              max="50"
                              value={tipPercentage}
                              onChange={(e) => setTipPercentage(Number(e.target.value))}
                              className="flex-1 rounded-xl"
                            />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {paymentSession && (
                    <Card className="rounded-2xl border-neutral-200 shadow-none">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-[16px] font-semibold flex items-center gap-2">
                          <DollarSign className="h-5 w-5 text-[#7b1d1d]" />
                          Pricing Summary
                        </CardTitle>
                        <CardDescription className="text-[13px]">Complete breakdown of charges and taxes</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="overflow-hidden rounded-xl border border-neutral-200">
                          <div className="divide-y">
                            {paymentSession.appointments.map((apt, index) => (
                              <div key={index} className="flex items-center justify-between px-4 py-3">
                                <div>
                                  <div className="text-[14px] font-medium text-neutral-900">{apt.serviceName}</div>
                                  <div className="text-[12px] text-neutral-500">{apt.duration} • {apt.staffName}</div>
                                </div>
                                <div className="text-[14px] font-medium text-neutral-900">{formatCurrency(apt.servicePrice, paymentSession.pricing.currency)}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-xl border border-neutral-200 p-4">
                          <Row label="Subtotal" value={formatCurrency(paymentSession.pricing.subtotal, paymentSession.pricing.currency)} />
                          {paymentSession.pricing.tipAmount > 0 && (
                            <Row label={`Tip (${useCustomTip ? 'Custom' : `${tipPercentage}%`})`} value={formatCurrency(paymentSession.pricing.tipAmount, paymentSession.pricing.currency)} />
                          )}
                          <div className="h-px my-2 bg-neutral-200" />
                          <Row small label={`GST (${paymentSession.pricing.taxes.gst.rate}%)`} value={formatCurrency(paymentSession.pricing.taxes.gst.amount, paymentSession.pricing.currency)} />
                          <Row small label={`PST (${paymentSession.pricing.taxes.pst.rate}%)`} value={formatCurrency(paymentSession.pricing.taxes.pst.amount, paymentSession.pricing.currency)} />
                          <div className="h-px my-2 bg-neutral-200" />
                          <Row strong label="Total Due" value={formatCurrency(paymentSession.pricing.totalAmount, paymentSession.pricing.currency)} />
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {paymentSession && paymentSession.tipDistribution.length > 0 && (
                    <Card className="rounded-2xl border-neutral-200 shadow-none">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-[16px] font-semibold flex items-center gap-2">
                          <Users className="h-5 w-5 text-[#7b1d1d]" />
                          Staff Tip Distribution
                        </CardTitle>
                        <CardDescription className="text-[13px]">How tips will be shared among staff members</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {paymentSession.tipDistribution.map((staff, index) => (
                            <div key={index} className="rounded-xl bg-neutral-50 p-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="text-[14px] font-medium text-neutral-900">{staff.staffName}</div>
                                  <div className="text-[12px] text-neutral-500">Service: {formatCurrency(staff.servicePrice, paymentSession.pricing.currency)} ({staff.sharePercentage.toFixed(1)}% share)</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[14px] font-semibold text-green-600">+{formatCurrency(staff.tipAmount, paymentSession.pricing.currency)}</div>
                                  <div className="text-[12px] text-neutral-500">Total: {formatCurrency(staff.totalEarning, paymentSession.pricing.currency)}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Card className="rounded-2xl border-neutral-200 shadow-none">
                    <CardContent className="pt-6">
                      <Button
                        size="lg"
                        className="w-full rounded-2xl bg-[#7b1d1d] text-white hover:bg-[#6b1717]"
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
                            Complete
                            {paymentSession && (
                              <span className="ml-2 font-bold">
                                {formatCurrency(paymentSession.pricing.totalAmount, paymentSession.pricing.currency)}
                              </span>
                            )}
                          </>
                        )}
                      </Button>
                      <p className="text-[12px] text-center text-neutral-500 mt-3">
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

function Row({ label, value, strong, small }: { label: string; value: string; strong?: boolean; small?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className={`${small ? 'text-[12px]' : 'text-[14px]'} ${strong ? 'font-semibold text-neutral-900' : 'text-neutral-700'}`}>{label}</span>
      <span className={`${small ? 'text-[12px]' : 'text-[14px]'} ${strong ? 'font-semibold text-neutral-900' : 'text-neutral-900'}`}>{value}</span>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <RoleGuard>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <div className="flex items-center justify-center min-h-screen">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7b1d1d] mx-auto mb-4"></div>
                <p>Loading checkout...</p>
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </RoleGuard>
    }>
      <CheckoutContent />
    </Suspense>
  )
}
