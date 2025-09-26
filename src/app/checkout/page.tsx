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
} from "lucide-react"
import React, { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { useUser } from "@/contexts/user-context"

interface AppointmentDetails {
  id: string
  serviceName: string
  startTime: string
  endTime: string
  customerName: string
  customerFirstName?: string
  customerPhone?: string
  staffName: string
  address?: string
  duration?: number
  calendar_id: string
  assigned_user_id: string
  contact_id?: string
}

interface PricingBreakdown {
  subtotal: number
  tipAmount: number
  taxes: {
    gst: { rate: number; amount: number }
    pst?: { rate: number; amount: number }
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

interface Group {
  id: string
  name: string
  description: string
  slug: string
  isActive: boolean
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

interface GroupServices {
  [groupId: string]: Service[]
}

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useUser()
  
  // URL Parameters
  const appointmentId = searchParams?.get('appointmentId')
  const calendarId = searchParams?.get('calendarId') 
  const staffIdParam = searchParams?.get('staffId')
  
  // State
  const [appointmentDetails, setAppointmentDetails] = useState<AppointmentDetails | null>(null)
  const [paymentSession, setPaymentSession] = useState<PaymentSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [processingPayment, setProcessingPayment] = useState(false)
  
  // Form state (email auto-filled from contact so checkout can proceed)
  const [customerInfo, setCustomerInfo] = useState({
    email: '',
    name: '',
    phone: ''
  })
  const [tipPercentage, setTipPercentage] = useState(18)
  const [customTipAmount, setCustomTipAmount] = useState('')
  const [useCustomTip, setUseCustomTip] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('visa')
  const [addServiceDialogOpen, setAddServiceDialogOpen] = useState(false)
  const [groups, setGroups] = useState<Group[]>([])
  const [groupServices, setGroupServices] = useState<GroupServices>({})
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedStaffId, setSelectedStaffId] = useState<string>('')
  const [showStaffSelection, setShowStaffSelection] = useState(false)
  const [staffData, setStaffData] = useState<Array<{ ghl_id: string; name: string }>>([])
  const [selectedStaffTab, setSelectedStaffTab] = useState<'all' | 'available'>('all')
  const [additionalServices, setAdditionalServices] = useState<Array<{
    id: string
    name: string
    price: number
    duration: number
    staffId: string
    staffName: string
  }>>([])
  const [editingService, setEditingService] = useState<{ type: 'appointment' | 'additional', index: number } | null>(null)
  const [editPrice, setEditPrice] = useState<string>('')
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

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

  // Handle service selection
  const handleServiceClick = (service: Service) => {
    setSelectedService(service)
    setShowStaffSelection(true)
    setSelectedStaffId('') // No default selection
    setSelectedStaffTab('all') // Default to all staff tab
  }

  // Handle add service
  const handleAddService = () => {
    if (selectedService && selectedStaffId) {
      const staffName = getStaffName(selectedStaffId)
      
      // Add service to additional services
      const newService = {
        id: selectedService.id,
        name: selectedService.name,
        price: selectedService.price,
        duration: selectedService.duration,
        staffId: selectedStaffId,
        staffName: staffName
      }
      
      setAdditionalServices(prev => [...prev, newService])
      
      console.log('Adding service:', selectedService.name, 'with staff:', staffName)
      toast.success(`${selectedService.name} added to appointment`)
      
      // Reset states and close dialog
      setSelectedService(null)
      setSelectedStaffId('')
      setShowStaffSelection(false)
      setAddServiceDialogOpen(false)
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

  // Get staff name by userId
  const getStaffName = (userId: string) => {
    console.log('Looking for staff with userId:', userId)
    console.log('Available staff data:', staffData)
    const staff = staffData.find(s => s.ghl_id === userId)
    console.log('Found staff:', staff)
    return staff ? staff.name : `Staff ${userId.substring(0, 4)}`
  }

  // Get staff initials
  const getStaffInitials = (userId: string) => {
    const staffName = getStaffName(userId)
    if (staffName.includes('Staff')) {
      return userId.substring(0, 2).toUpperCase()
    }
    // Extract initials from name
    const words = staffName.split(' ')
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase()
    }
    return staffName.substring(0, 2).toUpperCase()
  }

  // Get filtered staff based on selected tab
  const getFilteredStaff = () => {
    if (!selectedService?.teamMembers) return []
    
    if (selectedStaffTab === 'all') {
      // Show all staff from staffData
      return staffData.map(staff => ({
        userId: staff.ghl_id,
        name: staff.name
      }))
    } else {
      // Show only available staff (from service teamMembers)
      return selectedService.teamMembers.map(member => ({
        userId: member.userId,
        name: getStaffName(member.userId)
      }))
    }
  }

  // Fetch appointment details
  const fetchAppointmentDetails = async () => {
    if (!appointmentId) {
      toast.error('No appointment ID provided')
      router.push('/calendar')
      return
    }

    try {
      const response = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/getBooking?id=${appointmentId}`)
      if (!response.ok) throw new Error('Failed to fetch appointment details')
      const data = await response.json()
      if (data.appointment) {
        const apt = data.appointment
        // Contact details
        let customerName = 'Unknown Customer'
        let customerPhone = ''
        let customerEmail = ''
        if (apt.contactId) {
          try {
            const contactRes = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/getContact?id=${apt.contactId}`)
            const contactData = await contactRes.json()
            const c = contactData.contact || contactData || {}
            if (c) {
              customerName = `${c.firstName || ''} ${c.lastName || ''}`.trim() || customerName
              customerPhone = c.phone || c.phone_e164 || customerPhone
              customerEmail = c.email || c.email_lower || c.emailAddress || customerEmail
            }
          } catch (error) {
            console.warn('Failed to fetch contact details:', error)
          }
        }
        // Staff details — use staffId param fallback
        let staffName = 'Staff Member'
        const assignedId = staffIdParam || apt.assignedUserId || ''
        if (assignedId) {
          try {
            const staffRes = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/Staff?id=${assignedId}`)
            const staffData = await staffRes.json()
            const sname = staffData.name || staffData.user?.name || staffData.staff?.name
            if (sname) staffName = sname
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
          customerFirstName: (customerName.split(' ')[0] || '').trim() || undefined,
          customerPhone,
          staffName,
          address: apt.address,
          calendar_id: calendarId || apt.calendarId || '',
          assigned_user_id: assignedId,
          contact_id: apt.contactId || undefined
        }
        if (apt.startTime && apt.endTime) {
          const start = new Date(apt.startTime)
          const end = new Date(apt.endTime)
          details.duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60))
        }
        setAppointmentDetails(details)
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

  // Initialize / refresh pricing (no dependency on email; backend can price without it)
  const initializePayment = async () => {
    if (!appointmentDetails) return
    try {
      const response = await fetch('https://restyle-backend.netlify.app/.netlify/functions/initializePayment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentData: [{
            calendarId: appointmentDetails.calendar_id,
            staffId: appointmentDetails.assigned_user_id,
            appointmentId: appointmentDetails.id
          }],
          customerInfo: {
            email: customerInfo.email || '',
            name: customerInfo.name || appointmentDetails.customerName,
            phone: customerInfo.phone || appointmentDetails.customerPhone || ''
          },
          tipPercentage: useCustomTip ? 0 : tipPercentage,
          customTipAmount: useCustomTip ? parseFloat(customTipAmount) || 0 : undefined,
          locationId: "7LYI93XFo8j4nZfswlaz"
        })
      })
      if (!response.ok) throw new Error('Failed to initialize payment')
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

  // Fetch groups from Supabase
  const fetchGroups = async () => {
    try {
      setLoadingGroups(true)
      const response = await fetch('/api/groups')
      if (!response.ok) throw new Error('Failed to fetch groups')
      const data = await response.json()
      setGroups(data.groups || [])
      
      // Set first group as selected if available
      if (data.groups && data.groups.length > 0) {
        setSelectedGroupId(data.groups[0].id)
      }
    } catch (error) {
      console.error('Error fetching groups:', error)
      toast.error('Failed to load service categories')
    } finally {
      setLoadingGroups(false)
    }
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

  // Fetch services for a specific group
  const fetchServicesForGroup = async (groupId: string) => {
    try {
      const response = await fetch(`/api/services?groupId=${groupId}`)
      if (!response.ok) throw new Error('Failed to fetch services')
      const data = await response.json()
      
      // Transform the services data to match our interface
      const transformedServices = (data.services || []).map((service: { id: string; name: string; description?: string; slotDuration?: number; teamMembers?: Array<{ userId: string; priority: number; selected: boolean }> }) => {
        const price = extractPriceFromDescription(service.description || '')
        console.log(`Service: ${service.name}, Price: ${price}, Duration: ${service.slotDuration}`)
        return {
          id: service.id,
          name: service.name,
          price: price,
          duration: service.slotDuration || 0,
          description: service.description,
          teamMembers: service.teamMembers || []
        }
      })
      
      setGroupServices(prev => ({
        ...prev,
        [groupId]: transformedServices
      }))
    } catch (error) {
      console.error(`Error fetching services for group ${groupId}:`, error)
      // Don't show toast for background fetches
    }
  }

  // Fetch all services for all groups
  const fetchAllServices = async () => {
    if (groups.length === 0) return
    
    // Fetch services for all groups in parallel
    const promises = groups.map(group => fetchServicesForGroup(group.id))
    await Promise.all(promises)
  }

  // Create checkout session and redirect
  const proceedToCheckout = async () => {
    if (!paymentSession || !customerInfo.email) {
      toast.error('Please complete all required fields')
      return
    }
    setProcessingPayment(true)
    try {
      // 1) Persist to Supabase first
      const addedTotal = getAdditionalServicesTotal()
      const subtotal = paymentSession.pricing.subtotal + addedTotal
      const gst = paymentSession.pricing.taxes.gst.amount
      const pst = paymentSession.pricing.taxes.pst?.amount || 0
      const tip = getEffectiveTipAmount()
      const totalPaid = subtotal + gst + pst + tip

      const baseItems = paymentSession.appointments.map((a) => ({
        id: crypto.randomUUID(),
        // Prefer provided serviceId; fallback to appointment/calendar id from URL for default item
        serviceId: (a as { serviceId?: string; id?: string }).serviceId ?? (a as { serviceId?: string; id?: string }).id ?? appointmentDetails?.calendar_id ?? calendarId ?? null,
        serviceName: a.serviceName,
        price: a.servicePrice,
        staffName: a.staffName,
      }))
      const addItems = additionalServices.map((s) => ({
        id: crypto.randomUUID(),
        serviceId: s.id,
        serviceName: s.name,
        price: s.price,
        staffName: s.staffName,
      }))
      const items = [...baseItems, ...addItems]

      const distribution = getStaffTipDistribution() // per-staff tip shares
      const itemsWithTip = items.map((it) => {
        const share = distribution.find((d: { staffName: string; sharePercentage: number; tipShare: number }) => d.staffName === it.staffName)
        return {
          ...it,
          staffTipSplit: share ? Number(share.sharePercentage.toFixed(2)) : null,
          staffTipCollected: share ? Number(share.tipShare.toFixed(2)) : null,
        }
      })

      const transactionId = crypto.randomUUID()
      const payload = {
        transaction: {
          id: transactionId,
          paymentDate: new Date().toISOString(),
          method: selectedPaymentMethod,
          subtotal,
          tax: gst + pst,
          tip,
          totalPaid,
          serviceNamesJoined: items.map((i) => i.serviceName).join(', '),
          // Provide all known service IDs for reporting/relations on Supabase
          serviceAcuityIds: items
            .map((i) => i.serviceId)
            .filter((v) => Boolean(v))
            .join(', ') || null,
          // Populate transaction table booking fields
          bookingServiceLookup: items
            .map((i) => i.serviceId)
            .filter((v) => Boolean(v))
            .join(', ') || null,
          bookingBookedRate: totalPaid,
          bookingCustomerPhone: appointmentDetails?.customerPhone || customerInfo.phone || null,
          bookingType: 'Booking',
          customerLookup: appointmentDetails?.contact_id || null,
          customerPhone: appointmentDetails?.customerPhone ?? null,
          bookingId: appointmentDetails?.id ?? null,
          paymentStaff: appointmentDetails?.staffName ?? null,
          status: 'Paid',
        },
        items: itemsWithTip.map((i) => ({ ...i, paymentId: transactionId })),
        meta: {
          customerFirstName: appointmentDetails?.customerFirstName || (customerInfo.name.split(' ')[0] || ''),
          customerName: appointmentDetails?.customerName || customerInfo.name || '',
        }
      }

      const persistRes = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!persistRes.ok) {
        const err = await persistRes.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to persist transaction')
      }

      // Cache for success page fallback (in case Supabase read is blocked)
      try {
        sessionStorage.setItem(`tx:${transactionId}`, JSON.stringify(payload))
      } catch {}

      // 2) Skip external payment; redirect to local success page
      window.location.href = `/checkout/success?id=${transactionId}`
    } catch (error) {
      console.error('Error creating checkout:', error)
      toast.error('Failed to start checkout process')
    } finally {
      setProcessingPayment(false)
    }
  }

  // Calculate additional services total
  const getAdditionalServicesTotal = () => {
    return additionalServices.reduce((total, service) => total + service.price, 0)
  }

  // Effective tip amount including added services when using percentage-based tips
  const getEffectiveTipAmount = () => {
    if (!paymentSession) return 0
    if (useCustomTip) return paymentSession.pricing.tipAmount
    const base = paymentSession.pricing.subtotal + getAdditionalServicesTotal()
    const tip = (base * tipPercentage) / 100
    return Number(tip.toFixed(2))
  }

  // Calculate staff tip distribution
  const getStaffTipDistribution = () => {
    if (!paymentSession || getEffectiveTipAmount() <= 0) return []
    
    const allServices = [
      ...paymentSession.appointments.map(apt => ({
        staffId: apt.staffName, // Using staffName as ID for now
        staffName: apt.staffName,
        servicePrice: apt.servicePrice
      })),
      ...additionalServices.map(service => ({
        staffId: service.staffId,
        staffName: service.staffName,
        servicePrice: service.price
      }))
    ]
    
    // Group by staff member
    const staffTotals = allServices.reduce((acc, service) => {
      if (!acc[service.staffId]) {
        acc[service.staffId] = {
          staffId: service.staffId,
          staffName: service.staffName,
          totalServicePrice: 0,
          services: []
        }
      }
      acc[service.staffId].totalServicePrice += service.servicePrice
      acc[service.staffId].services.push(service)
      return acc
    }, {} as Record<string, { staffId: string; staffName: string; totalServicePrice: number; services: Array<{ staffId: string; staffName: string; servicePrice: number }> }>)
    
    const totalServicePrice = Object.values(staffTotals).reduce((sum, staff) => sum + staff.totalServicePrice, 0)
    const tipAmount = getEffectiveTipAmount()
    
    return Object.values(staffTotals).map(staff => {
      const sharePercentage = (staff.totalServicePrice / totalServicePrice) * 100
      const tipShare = (staff.totalServicePrice / totalServicePrice) * tipAmount
      const totalEarning = staff.totalServicePrice + tipShare
      
      return {
        ...staff,
        sharePercentage,
        tipShare,
        totalEarning
      }
    }).sort((a, b) => b.totalServicePrice - a.totalServicePrice)
  }

  // Price editing functions
  const handleEditPrice = (type: 'appointment' | 'additional', index: number) => {
    setEditingService({ type, index })
    if (type === 'appointment' && paymentSession) {
      setEditPrice(paymentSession.appointments[index].servicePrice.toString())
    } else if (type === 'additional') {
      setEditPrice(additionalServices[index].price.toString())
    }
    setIsEditDialogOpen(true)
  }

  const handleSavePrice = () => {
    if (!editingService || !paymentSession) return

    const newPrice = parseFloat(editPrice)
    if (isNaN(newPrice) || newPrice < 0) {
      toast.error('Please enter a valid price')
      return
    }

    if (editingService.type === 'appointment') {
      // Update appointment service price
      const updatedAppointments = [...paymentSession.appointments]
      updatedAppointments[editingService.index] = {
        ...updatedAppointments[editingService.index],
        servicePrice: newPrice
      }
      
      setPaymentSession(prev => prev ? {
        ...prev,
        appointments: updatedAppointments
      } : null)
    } else if (editingService.type === 'additional') {
      // Update additional service price
      const updatedAdditionalServices = [...additionalServices]
      updatedAdditionalServices[editingService.index] = {
        ...updatedAdditionalServices[editingService.index],
        price: newPrice
      }
      setAdditionalServices(updatedAdditionalServices)
    }

    setIsEditDialogOpen(false)
    setEditingService(null)
    setEditPrice('')
    toast.success('Price updated successfully')
  }

  // Formatters
  const formatCurrency = (amount: number, currency = 'CAD') => new Intl.NumberFormat('en-CA', { style: 'currency', currency: currency.replace('CA$', 'CAD').replace('US$', 'USD') }).format(amount || 0)
  const formatTime = (dateString: string) => new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const formatDuration = (minutes?: number) => {
    if (!minutes) return 'Not specified'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? (mins > 0 ? `${hours}h ${mins}m` : `${hours}h`) : `${mins} mins`
  }

  // Effects
  useEffect(() => { // initial fetch
    const run = async () => { setLoading(true); await fetchAppointmentDetails(); setLoading(false) }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId, calendarId, staffIdParam])

  useEffect(() => { // price whenever dependencies change
    if (appointmentDetails) { void initializePayment() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentDetails, tipPercentage, customTipAmount, useCustomTip])

  useEffect(() => { // fetch groups and staff data on page load
    void fetchGroups()
    void fetchStaffData()
  }, [])

  useEffect(() => { // fetch services when groups are loaded
    if (groups.length > 0) {
      void fetchAllServices()
    }
  }, [groups])

  useEffect(() => { // fetch staff data when dialog opens
    if (addServiceDialogOpen && staffData.length === 0) {
      void fetchStaffData()
    }
  }, [addServiceDialogOpen, staffData.length])

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
          {/* Header */}
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
            {/* HERO CARD — all details consolidated */}
            {appointmentDetails && (
              <div className="mx-auto w-full max-w-6xl rounded-2xl border border-neutral-200 bg-white px-6 py-5">
                <p className="text-[13px] font-medium text-neutral-500">Transaction In Progress</p>
                <h2 className="mt-1 text-[28px] font-semibold leading-tight text-neutral-900">{appointmentDetails.serviceName}</h2>
                <p className="mt-1 text-[14px] text-neutral-600">with {appointmentDetails.staffName}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[14px] text-neutral-700">
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
                {/* Right column stack: Tip, Pricing, Distribution, Complete */}
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
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-[16px] font-semibold flex items-center gap-2">
                              <DollarSign className="h-5 w-5 text-[#7b1d1d]" />
                              Pricing Summary
                            </CardTitle>
                            <CardDescription className="text-[13px]">Complete breakdown of charges and taxes</CardDescription>
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
                                  Select a service category and choose an additional service to add to this appointment.
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
                                                      key={index} 
                                                      onClick={() => handleServiceClick(service)}
                                                      className="group p-6 border-2 border-neutral-200 rounded-2xl hover:border-[#7b1d1d]/30 hover:bg-[#7b1d1d]/5 cursor-pointer transition-all"
                                                    >
                                                      <div className="flex items-start gap-4">
                                                        <div className={`p-3 rounded-xl ${
                                                          selectedGroupId === group.id
                                                            ? 'bg-[#7b1d1d]/10'
                                                            : 'bg-neutral-100'
                                                        }`}>
                                                          <ServiceIcon className={`h-6 w-6 ${
                                                            selectedGroupId === group.id
                                                              ? 'text-[#7b1d1d]'
                                                              : 'text-neutral-600'
                                                          }`} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                          <h4 className="font-semibold text-base text-neutral-900 group-hover:text-[#7b1d1d] transition-colors">
                                                            {serviceName}
                                                          </h4>
                                                          <div className="flex items-center gap-2 mt-2">
                                                            <Clock className="h-4 w-4 text-neutral-500" />
                                                            <span className="text-sm text-neutral-600">
                                                              {serviceDuration} min
                                                            </span>
                                                            <span className="text-neutral-300">•</span>
                                                            <span className="text-sm font-semibold text-[#7b1d1d]">
                                                              CA${servicePrice.toFixed(2)}
                                                            </span>
                                                          </div>
                                                          {service.teamMembers && service.teamMembers.length > 0 && (
                                                            <div className="flex items-center gap-1 mt-2">
                                                              <Users className="h-3 w-3 text-neutral-400" />
                                                              <span className="text-xs text-neutral-500">
                                                                {service.teamMembers.length} staff available
                                                              </span>
                                                            </div>
                                                          )}
                                                        </div>
                                                      </div>
                                                    </div>
                                                  )
                                                })}
                                              </div>
                                            ) : (
                                              <div className="text-center py-12">
                                                <div className="p-4 rounded-full bg-neutral-100 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                                                  <AlertCircle className="h-8 w-8 text-neutral-400" />
                                                </div>
                                                <p className="text-lg text-neutral-600">No services available in this category</p>
                                                <p className="text-sm text-neutral-500 mt-1">Try selecting a different category</p>
                                              </div>
                                            )
                                          ) : (
                                            <div className="flex items-center justify-center py-12">
                                              <Loader2 className="h-6 w-6 animate-spin mr-3" />
                                              <span className="text-lg">Loading services...</span>
                                            </div>
                                          )}
                                        </div>
                                      </TabsContent>
                                    ))}
                                      </Tabs>
                                    ) : (
                                      // Staff Selection UI
                                      <div className="w-full">
                                        <div className="flex items-center gap-3 mb-6">
                                          <button
                                            onClick={() => setShowStaffSelection(false)}
                                            className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
                                          >
                                            <ArrowLeft className="h-5 w-5 text-neutral-600" />
                                          </button>
                                          <div>
                                            <h3 className="text-lg font-semibold text-neutral-900">Choose Staff</h3>
                                            <p className="text-sm text-neutral-600">Select a staff member for {selectedService?.name}</p>
                                          </div>
                                        </div>
                                        
                                        {/* Staff Tabs */}
                                        <div className="flex gap-2 mb-6">
                                          <button
                                            onClick={() => setSelectedStaffTab('all')}
                                            className={`flex items-center gap-2 rounded-xl border-2 px-4 py-3 text-left transition-all hover:border-[#7b1d1d]/30 ${
                                              selectedStaffTab === 'all'
                                                ? 'border-[#7b1d1d] bg-[#7b1d1d]'
                                                : 'border-neutral-200 bg-white hover:bg-neutral-50'
                                            }`}
                                          >
                                            <Users className={`h-4 w-4 ${
                                              selectedStaffTab === 'all'
                                                ? 'text-white'
                                                : 'text-neutral-600'
                                            }`} />
                                            <span className={`text-sm font-medium ${
                                              selectedStaffTab === 'all'
                                                ? 'text-white'
                                                : 'text-neutral-900'
                                            }`}>All Staff</span>
                                          </button>
                                          <button
                                            onClick={() => setSelectedStaffTab('available')}
                                            className={`flex items-center gap-2 rounded-xl border-2 px-4 py-3 text-left transition-all hover:border-[#7b1d1d]/30 ${
                                              selectedStaffTab === 'available'
                                                ? 'border-[#7b1d1d] bg-[#7b1d1d]'
                                                : 'border-neutral-200 bg-white hover:bg-neutral-50'
                                            }`}
                                          >
                                            <CheckCircle2 className={`h-4 w-4 ${
                                              selectedStaffTab === 'available'
                                                ? 'text-white'
                                                : 'text-neutral-600'
                                            }`} />
                                            <span className={`text-sm font-medium ${
                                              selectedStaffTab === 'available'
                                                ? 'text-white'
                                                : 'text-neutral-900'
                                            }`}>Available Staff</span>
                                          </button>
                                        </div>
                                        
                                        {staffData.length === 0 ? (
                                          <div className="flex items-center justify-center py-12">
                                            <Loader2 className="h-6 w-6 animate-spin mr-3" />
                                            <span className="text-lg">Loading staff data...</span>
                                          </div>
                                        ) : (
                                          <div className="grid grid-cols-5 gap-4">
                                            {getFilteredStaff().map((staff, index) => (
                                              <button
                                                key={staff.userId}
                                                onClick={() => setSelectedStaffId(staff.userId)}
                                                className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                                                  selectedStaffId === staff.userId
                                                    ? 'border-[#7b1d1d] bg-[#7b1d1d]/5'
                                                    : 'border-neutral-200 bg-white hover:border-[#7b1d1d]/30 hover:bg-neutral-50'
                                                }`}
                                              >
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg ${
                                                  selectedStaffId === staff.userId
                                                    ? 'bg-[#7b1d1d]'
                                                    : 'bg-neutral-400'
                                                }`}>
                                                  {getStaffInitials(staff.userId)}
                                                </div>
                                                <div className="text-center">
                                                  <p className="text-sm font-medium text-neutral-900">
                                                    {staff.name}
                                                  </p>
                                                </div>
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                        
                                        <div className="flex gap-3 mt-8">
                                          <Button
                                            variant="outline"
                                            onClick={() => setShowStaffSelection(false)}
                                            className="flex-1 rounded-xl"
                                          >
                                            Back
                                          </Button>
                                          <Button
                                            onClick={handleAddService}
                                            disabled={!selectedStaffId}
                                            className="flex-1 rounded-xl bg-[#7b1d1d] hover:bg-[#6b1717] text-white"
                                          >
                                            <Plus className="h-4 w-4 mr-2" />
                                            Add Service
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-center py-12">
                                    <div className="p-4 rounded-full bg-neutral-100 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                                      <AlertCircle className="h-8 w-8 text-neutral-400" />
                                    </div>
                                    <p className="text-lg text-neutral-600">No service categories available</p>
                                    <p className="text-sm text-neutral-500 mt-1">Please try again later</p>
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Service Items */}
                        <div className="overflow-hidden rounded-xl border border-neutral-200">
                          <div className="divide-y">
                            {paymentSession.appointments.map((apt, index) => (
                              <div key={index} className="flex items-center justify-between px-4 py-3">
                                <div>
                                  <div className="text-[14px] font-medium text-neutral-900">{apt.serviceName}</div>
                                  <div className="text-[12px] text-neutral-500">{apt.duration} • {apt.staffName}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="text-[14px] font-medium text-neutral-900">{formatCurrency(apt.servicePrice, paymentSession.pricing.currency)}</div>
                                  {user?.role === 'admin' && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEditPrice('appointment', index)}
                                      className="h-6 w-6 p-0 hover:bg-neutral-100"
                                    >
                                      <Edit3 className="h-3 w-3 text-neutral-500" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                            {additionalServices.map((service, index) => (
                              <div key={`additional-${index}`} className="flex items-center justify-between px-4 py-3">
                                <div>
                                  <div className="text-[14px] font-medium text-neutral-900">{service.name}</div>
                                  <div className="text-[12px] text-neutral-500">{service.duration} min • {service.staffName}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="text-[14px] font-medium text-neutral-900">{formatCurrency(service.price, paymentSession.pricing.currency)}</div>
                                  {user?.role === 'admin' && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEditPrice('additional', index)}
                                      className="h-6 w-6 p-0 hover:bg-neutral-100"
                                    >
                                      <Edit3 className="h-3 w-3 text-neutral-500" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Totals */}
                        <div className="rounded-xl border border-neutral-200 p-4">
                          <Row label="Subtotal" value={formatCurrency(paymentSession.pricing.subtotal + getAdditionalServicesTotal(), paymentSession.pricing.currency)} />
                          {getEffectiveTipAmount() > 0 && (
                            <Row label={`Tip (${useCustomTip ? 'Custom' : `${tipPercentage}%`})`} value={formatCurrency(getEffectiveTipAmount(), paymentSession.pricing.currency)} />
                          )}
                          <div className="h-px my-2 bg-neutral-200" />
                          <Row small label={`GST (${paymentSession.pricing.taxes.gst.rate}%)`} value={formatCurrency(paymentSession.pricing.taxes.gst.amount, paymentSession.pricing.currency)} />
                          {/* Hide PST row entirely if amount is 0 or missing */}
                          {paymentSession.pricing.taxes.pst && paymentSession.pricing.taxes.pst.amount > 0 ? (
                            <Row small label={`PST (${paymentSession.pricing.taxes.pst.rate}%)`} value={formatCurrency(paymentSession.pricing.taxes.pst.amount, paymentSession.pricing.currency)} />
                          ) : null}
                          <div className="h-px my-2 bg-neutral-200" />
                          <Row strong label="Total Due" value={formatCurrency((paymentSession.pricing.subtotal + getAdditionalServicesTotal()) + (getEffectiveTipAmount()) + paymentSession.pricing.taxes.gst.amount + (paymentSession.pricing.taxes.pst?.amount || 0), paymentSession.pricing.currency)} />
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {paymentSession && paymentSession.pricing.tipAmount > 0 && getStaffTipDistribution().length > 0 && (
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
                          {getStaffTipDistribution().map((staff, index) => (
                            <div key={staff.staffId} className="rounded-xl bg-neutral-50 p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-[#7b1d1d] flex items-center justify-center text-white font-semibold text-sm">
                                    {staff.staffName.split(' ').map(n => n[0]).join('').toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="text-[14px] font-medium text-neutral-900">{staff.staffName}</div>
                                    <div className="text-[12px] text-neutral-500">
                                      {formatCurrency(staff.totalServicePrice, paymentSession.pricing.currency)} ({staff.sharePercentage.toFixed(1)}% share)
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[14px] font-semibold text-green-600 mb-1">
                                    +{formatCurrency(staff.tipShare, paymentSession.pricing.currency)}
                                  </div>
                                  <div className="text-[12px] font-medium text-neutral-900">
                                    {formatCurrency(staff.totalEarning, paymentSession.pricing.currency)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Card className="rounded-2xl border-neutral-200 shadow-none">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-[16px] font-semibold flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-[#7b1d1d]" />
                        Payment Method
                      </CardTitle>
                      <CardDescription className="text-[13px]">Choose your preferred payment method</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        {[
                          { id: 'visa', name: 'Visa', icon: CreditCard },
                          { id: 'mastercard', name: 'Mastercard', icon: CreditCard },
                          { id: 'amex', name: 'Amex', icon: CreditCard },
                          { id: 'debit', name: 'Debit', icon: CreditCard },
                          { id: 'cash', name: 'Cash', icon: DollarSign }
                        ].map((method) => {
                          const IconComponent = method.icon
                          return (
                            <button
                              key={method.id}
                              onClick={() => setSelectedPaymentMethod(method.id)}
                              className={`flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-2 transition-all hover:border-[#7b1d1d]/30 flex-1 cursor-pointer ${
                                selectedPaymentMethod === method.id
                                  ? 'border-[#7b1d1d] bg-[#7b1d1d]'
                                  : 'border-neutral-200 bg-white hover:bg-neutral-50'
                              }`}
                            >
                              <IconComponent className={`h-4 w-4 ${
                                selectedPaymentMethod === method.id
                                  ? 'text-white'
                                  : 'text-neutral-600'
                              }`} />
                              <span className={`text-[12px] font-medium ${
                                selectedPaymentMethod === method.id
                                  ? 'text-white'
                                  : 'text-neutral-900'
                              }`}>{method.name}</span>
                            </button>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>

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
                                {formatCurrency((paymentSession.pricing.subtotal + getAdditionalServicesTotal()) + getEffectiveTipAmount() + paymentSession.pricing.taxes.gst.amount + (paymentSession.pricing.taxes.pst?.amount || 0), paymentSession.pricing.currency)}
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

          {/* Price Edit Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Service Price</DialogTitle>
                <DialogDescription>
                  Update the price for {editingService?.type === 'appointment' 
                    ? paymentSession?.appointments[editingService.index]?.serviceName 
                    : additionalServices[editingService?.index || 0]?.name || 'this service'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price (CAD)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSavePrice}>
                    Save Changes
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
