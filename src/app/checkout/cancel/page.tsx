"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { RoleGuard } from "@/components/role-guard"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  XCircle, 
  Calendar as CalendarIcon, 
  ArrowLeft,
  CreditCard,
  AlertTriangle,
  RefreshCw,
  HelpCircle,
  Phone,
  Mail
} from "lucide-react"
import React, { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { toast } from "sonner"

interface CancelledSession {
  sessionId: string
  appointmentId?: string
  customerInfo?: {
    name: string
    email: string
  }
  appointmentDetails?: {
    serviceName: string
    staffName: string
    appointmentDate: string
    appointmentTime: string
  }
  reason?: string
}

export default function CheckoutCancelPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [cancelledSession, setCancelledSession] = useState<CancelledSession | null>(null)
  const [loading, setLoading] = useState(true)

  // Get URL parameters
  const sessionId = searchParams?.get('session_id')
  const reason = searchParams?.get('reason')

  // Fetch cancelled session details
  const fetchCancelledSessionDetails = async () => {
    if (!sessionId) {
      setLoading(false)
      return
    }

    try {
      const response = await fetch('https://restyle-backend.netlify.app/.netlify/functions/getCancelledSession', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId
        })
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success && result.sessionDetails) {
          setCancelledSession(result.sessionDetails)
        }
      }
    } catch (error) {
      console.error('Error fetching cancelled session:', error)
    }
  }

  // Retry checkout with same session
  const retryCheckout = () => {
    if (cancelledSession?.appointmentId) {
      // Navigate back to checkout with same parameters
      const params = new URLSearchParams()
      params.set('appointmentId', cancelledSession.appointmentId)
      if (cancelledSession.sessionId) {
        params.set('sessionId', cancelledSession.sessionId)
      }
      
      router.push(`/checkout?${params.toString()}`)
    } else {
      // Go back to calendar
      router.push('/calendar')
    }
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
    const loadCancelledSession = async () => {
      setLoading(true)
      await fetchCancelledSessionDetails()
      setLoading(false)
      
      // Show toast message
      if (reason) {
        toast.error(`Payment cancelled: ${reason}`)
      } else {
        toast.error('Payment was cancelled')
      }
    }
    
    loadCancelledSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, reason])

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
                  <XCircle className="h-5 w-5 text-red-500" />
                  <h1 className="text-xl font-semibold">Payment Cancelled</h1>
                </div>
              </div>
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-6 p-4 pt-0 max-w-4xl mx-auto">
            
            {/* Cancelled Header */}
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
              <h1 className="text-2xl font-bold text-red-600 mb-2">Payment Cancelled</h1>
              <p className="text-muted-foreground max-w-md mx-auto">
                Your payment was cancelled and no charges were made to your account. 
                {cancelledSession?.reason && ` Reason: ${cancelledSession.reason}`}
              </p>
            </div>

            {loading ? (
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p>Loading session details...</p>
              </div>
            ) : (
              <>
                {/* Session Details */}
                {cancelledSession && (
                  <div className="grid gap-6 md:grid-cols-2">
                    
                    {/* Appointment Information */}
                    {cancelledSession.appointmentDetails && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <CalendarIcon className="h-5 w-5 text-primary" />
                            Appointment Details
                          </CardTitle>
                          <CardDescription>
                            The appointment you were trying to pay for
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid gap-3">
                            <div>
                              <div className="font-medium">{cancelledSession.appointmentDetails.serviceName}</div>
                              <div className="text-sm text-muted-foreground">Service</div>
                            </div>

                            {cancelledSession.appointmentDetails.appointmentDate && (
                              <div>
                                <div className="font-medium">
                                  {formatDateTime(cancelledSession.appointmentDetails.appointmentDate).date}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {cancelledSession.appointmentDetails.appointmentTime || formatDateTime(cancelledSession.appointmentDetails.appointmentDate).time}
                                </div>
                              </div>
                            )}

                            <div>
                              <div className="font-medium">{cancelledSession.appointmentDetails.staffName}</div>
                              <div className="text-sm text-muted-foreground">Staff Member</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Customer Information */}
                    {cancelledSession.customerInfo && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            Session Information
                          </CardTitle>
                          <CardDescription>
                            Your cancelled payment session
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid gap-3">
                            <div>
                              <div className="font-medium">{cancelledSession.customerInfo.name}</div>
                              <div className="text-sm text-muted-foreground">Customer Name</div>
                            </div>

                            <div>
                              <div className="font-medium">{cancelledSession.customerInfo.email}</div>
                              <div className="text-sm text-muted-foreground">Email Address</div>
                            </div>

                            <div>
                              <div className="font-mono text-sm">{cancelledSession.sessionId}</div>
                              <div className="text-sm text-muted-foreground">Session ID</div>
                            </div>

                            {cancelledSession.reason && (
                              <div>
                                <div className="font-medium text-red-600">{cancelledSession.reason}</div>
                                <div className="text-sm text-muted-foreground">Cancellation Reason</div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Single column if no appointment details */}
                    {!cancelledSession.appointmentDetails && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            Session Cancelled
                          </CardTitle>
                          <CardDescription>
                            Payment session was cancelled before completion
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="text-center py-4">
                            <p className="text-muted-foreground">
                              Session ID: <span className="font-mono">{cancelledSession.sessionId}</span>
                            </p>
                            {cancelledSession.reason && (
                              <p className="text-red-600 mt-2">
                                Reason: {cancelledSession.reason}
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-6">
                  <Button onClick={retryCheckout} size="lg">
                    <RefreshCw className="h-5 w-5 mr-2" />
                    Try Payment Again
                  </Button>
                  
                  <Button variant="outline" onClick={() => router.push('/calendar')} size="lg">
                    <ArrowLeft className="h-5 w-5 mr-2" />
                    Back to Calendar
                  </Button>
                </div>

                {/* Help Section */}
                <Card className="bg-amber-50/50 border-amber-200">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <HelpCircle className="h-6 w-6 text-amber-600 mt-1 flex-shrink-0" />
                      <div>
                        <h3 className="font-semibold text-amber-900 mb-2">Need Help?</h3>
                        <p className="text-sm text-amber-800 mb-3">
                          If you&apos;re experiencing issues with payment or have questions about your appointment, 
                          we&apos;re here to help.
                        </p>
                        
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-4 w-4 text-amber-600" />
                            <span className="text-amber-800">Call: (555) 123-4567</span>
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-4 w-4 text-amber-600" />
                            <span className="text-amber-800">Email: support@restyle.com</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Common Reasons */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-primary" />
                      Common Reasons for Cancellation
                    </CardTitle>
                    <CardDescription>
                      Here are some reasons why payments might be cancelled
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-muted-foreground">•</span>
                        <span>Payment method declined by your bank</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-muted-foreground">•</span>
                        <span>Insufficient funds in your account</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-muted-foreground">•</span>
                        <span>Payment session expired due to inactivity</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-muted-foreground">•</span>
                        <span>You chose to cancel during the payment process</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-muted-foreground">•</span>
                        <span>Technical issues with the payment processor</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </RoleGuard>
  )
}