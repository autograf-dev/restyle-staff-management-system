"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { RoleGuard } from "@/components/role-guard"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  CheckCircle, 
  Calendar as CalendarIcon, 
  ArrowLeft,
  Receipt,
  Clock,
  User as UserIcon,
  Mail,
  Phone
} from "lucide-react"
import React, { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { toast } from "sonner"

interface PaymentResult {
  success: boolean
  sessionId: string
  paymentId: string
  amount: number
  currency: string
  appointmentDetails: {
    id: string
    serviceName: string
    customerName: string
    staffName: string
    appointmentDate: string
    appointmentTime: string
    duration: string
  }
  customerInfo: {
    name: string
    email: string
    phone: string
  }
  receiptUrl?: string
}

function CheckoutSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Get URL parameters
  const sessionId = searchParams?.get('session_id')
  const paymentId = searchParams?.get('payment_id')

  // Fetch payment confirmation details
  const fetchPaymentDetails = async () => {
    if (!sessionId) {
      setError('No session ID provided')
      return
    }

    try {
      const response = await fetch('https://restyle-backend.netlify.app/.netlify/functions/confirmPayment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId,
          paymentId
        })
      })

      if (!response.ok) {
        throw new Error('Failed to confirm payment')
      }

      const result = await response.json()
      
      if (result.success && result.paymentDetails) {
        setPaymentResult(result.paymentDetails)
        toast.success('Payment completed successfully!')
      } else {
        setError(result.error || 'Payment confirmation failed')
      }
    } catch (error) {
      console.error('Error confirming payment:', error)
      setError('Failed to load payment confirmation')
      toast.error('Could not confirm payment status')
    }
  }

  // Format currency
  const formatCurrency = (amount: number, currency = 'CAD') => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: currency.replace('CA$', 'CAD').replace('US$', 'USD')
    }).format(amount)
  }

  // Format date and time
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return {
      date: date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    }
  }

  useEffect(() => {
    const confirmPayment = async () => {
      setLoading(true)
      await fetchPaymentDetails()
      setLoading(false)
    }
    
    confirmPayment()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, paymentId])

  if (loading) {
    return (
      <RoleGuard>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <div className="flex items-center justify-center min-h-screen">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <h2 className="text-xl font-semibold mb-2">Confirming Payment...</h2>
                <p className="text-muted-foreground">Please wait while we verify your payment</p>
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </RoleGuard>
    )
  }

  if (error) {
    return (
      <RoleGuard>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <div className="flex items-center justify-center min-h-screen">
              <div className="text-center max-w-md">
                <div className="text-red-500 mb-4">
                  <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold mb-2 text-red-600">Payment Verification Failed</h2>
                <p className="text-muted-foreground mb-4">{error}</p>
                <div className="space-y-2">
                  <Button onClick={() => router.push('/calendar')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Return to Calendar
                  </Button>
                </div>
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
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <h1 className="text-xl font-semibold">Payment Successful</h1>
                </div>
              </div>
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-6 p-4 pt-0 max-w-4xl mx-auto">
            
            {/* Success Header */}
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-green-600 mb-2">Payment Completed!</h1>
              <p className="text-muted-foreground">
                Thank you for your payment. Your appointment is confirmed and you should receive a confirmation email shortly.
              </p>
            </div>

            {paymentResult && (
              <div className="grid gap-6 md:grid-cols-2">
                
                {/* Payment Details */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Receipt className="h-5 w-5 text-primary" />
                      Payment Details
                    </CardTitle>
                    <CardDescription>
                      Transaction information and receipt
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Payment ID</span>
                        <span className="font-mono text-sm">{paymentResult.paymentId}</span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Session ID</span>
                        <span className="font-mono text-sm">{paymentResult.sessionId}</span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Amount Paid</span>
                        <span className="font-semibold text-lg text-green-600">
                          {formatCurrency(paymentResult.amount, paymentResult.currency)}
                        </span>
                      </div>
                      
                      {paymentResult.receiptUrl && (
                        <div className="pt-2">
                          <Button variant="outline" size="sm" asChild className="w-full">
                            <a href={paymentResult.receiptUrl} target="_blank" rel="noopener noreferrer">
                              <Receipt className="h-4 w-4 mr-2" />
                              View Receipt
                            </a>
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Appointment Details */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CalendarIcon className="h-5 w-5 text-primary" />
                      Appointment Confirmed
                    </CardTitle>
                    <CardDescription>
                      Your upcoming service appointment
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-primary/10 rounded-full">
                          <Receipt className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">{paymentResult.appointmentDetails.serviceName}</div>
                          <div className="text-sm text-muted-foreground">Service</div>
                        </div>
                      </div>

                      {paymentResult.appointmentDetails.appointmentDate && (
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-blue-100 rounded-full">
                            <Clock className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-medium">
                              {formatDateTime(paymentResult.appointmentDetails.appointmentDate).date}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {paymentResult.appointmentDetails.appointmentTime || formatDateTime(paymentResult.appointmentDetails.appointmentDate).time}
                            </div>
                            {paymentResult.appointmentDetails.duration && (
                              <div className="text-xs text-muted-foreground">
                                Duration: {paymentResult.appointmentDetails.duration}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-green-100 rounded-full">
                          <UserIcon className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <div className="font-medium">{paymentResult.appointmentDetails.staffName}</div>
                          <div className="text-sm text-muted-foreground">Your Stylist</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Customer Information */}
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserIcon className="h-5 w-5 text-primary" />
                      Confirmation Details
                    </CardTitle>
                    <CardDescription>
                      Where we&apos;ll send your appointment confirmation and reminders
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="flex items-center gap-3">
                        <UserIcon className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{paymentResult.customerInfo.name}</div>
                          <div className="text-sm text-muted-foreground">Customer</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Mail className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{paymentResult.customerInfo.email}</div>
                          <div className="text-sm text-muted-foreground">Email</div>
                        </div>
                      </div>
                      
                      {paymentResult.customerInfo.phone && (
                        <div className="flex items-center gap-3">
                          <Phone className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{paymentResult.customerInfo.phone}</div>
                            <div className="text-sm text-muted-foreground">Phone</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-6">
              <Button onClick={() => router.push('/calendar')} size="lg">
                <CalendarIcon className="h-5 w-5 mr-2" />
                Back to Calendar
              </Button>
              
              <Button variant="outline" onClick={() => router.push('/appointments')} size="lg">
                <Receipt className="h-5 w-5 mr-2" />
                View All Appointments
              </Button>
            </div>

            {/* Additional Information */}
            <Card className="bg-blue-50/50 border-blue-200">
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <h3 className="font-semibold text-blue-900">What happens next?</h3>
                  <p className="text-sm text-blue-700">
                    • A confirmation email will be sent to {paymentResult?.customerInfo.email}<br />
                    • You&apos;ll receive a reminder 24 hours before your appointment<br />
                    • If you need to reschedule, please contact us at least 24 hours in advance
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </RoleGuard>
  )
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <RoleGuard>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <div className="flex items-center justify-center min-h-screen">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p>Loading...</p>
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </RoleGuard>
    }>
      <CheckoutSuccessContent />
    </Suspense>
  )
}