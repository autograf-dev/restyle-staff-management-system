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
  Split,
  X,
  Calculator,
  Target,
  Banknote,
  Minus
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
  const [bookingPrice, setBookingPrice] = useState<number>(0)
  
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
  const [isSplitPayment, setIsSplitPayment] = useState(false)
  const [splitPayments, setSplitPayments] = useState<Array<{
    id: string
    method: string
    amount: string
    percentage: number
  }>>([
    { id: '1', method: 'visa', amount: '', percentage: 100 }
  ])
  const [splitMode, setSplitMode] = useState<'payment' | 'service'>('payment')
  const [showSplitDialog, setShowSplitDialog] = useState(false)
  const [serviceSplits, setServiceSplits] = useState<Array<{
    id: string
    serviceId: string
    serviceName: string
    servicePrice: number
    paymentMethod: string
    staffNames: string[]
  }>>([])
  const [isServiceSplit, setIsServiceSplit] = useState(false)
  const [addServiceDialogOpen, setAddServiceDialogOpen] = useState(false)
  const [groups, setGroups] = useState<Group[]>([])
  const [groupServices, setGroupServices] = useState<GroupServices>({})
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([])
  const [showStaffSelection, setShowStaffSelection] = useState(false)
  const [staffData, setStaffData] = useState<Array<{ ghl_id: string; name: string; userId: string }>>([])
  const [selectedStaffTab, setSelectedStaffTab] = useState<'all' | 'available'>('all')
  const [additionalServices, setAdditionalServices] = useState<Array<{
    id: string
    name: string
    price: number
    duration: number
    staffIds: string[]
    staffNames: string[]
    priceDistribution: Array<{ staffId: string; staffName: string; amount: number }>
  }>>([])
  const [editingService, setEditingService] = useState<{ type: 'appointment' | 'additional', index: number } | null>(null)
  const [editPrice, setEditPrice] = useState<string>('')
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  // Utility functions for price and tip distribution
  const calculatePriceDistribution = (totalPrice: number, staffCount: number) => {
    const baseAmount = Math.floor((totalPrice / staffCount) * 100) / 100
    const remainder = Math.round((totalPrice - (baseAmount * staffCount)) * 100) / 100
    
    const distribution = Array(staffCount).fill(baseAmount)
    if (remainder > 0) {
      distribution[0] += remainder
    }
    
    return distribution
  }

  const calculateTipDistribution = (totalTip: number, staffCount: number) => {
    return calculatePriceDistribution(totalTip, staffCount)
  }

  const toggleStaffSelection = (staffId: string) => {
    setSelectedStaffIds(prev => {
      if (prev.includes(staffId)) {
        return prev.filter(id => id !== staffId)
      } else {
        return [...prev, staffId]
      }
    })
  }

  // Split payment utility functions
  const getTotalAmount = () => {
    if (!paymentSession) return 0
    return getCurrentSubtotal() + getEffectiveTipAmount() + getCurrentGST()
  }

  const addSplitPayment = () => {
    if (splitPayments.length >= 3) return
    
    const newId = (splitPayments.length + 1).toString()
    setSplitPayments(prev => [...prev, {
      id: newId,
      method: 'visa',
      amount: '',
      percentage: 0
    }])
  }

  const removeSplitPayment = (id: string) => {
    if (splitPayments.length <= 1) return
    setSplitPayments(prev => prev.filter(payment => payment.id !== id))
  }

  const updateSplitPayment = (id: string, field: 'method' | 'amount', value: string) => {
    setSplitPayments(prev => prev.map(payment => {
      if (payment.id === id) {
        if (field === 'amount') {
          const amount = parseFloat(value) || 0
          const totalAmount = getTotalAmount()
          const percentage = totalAmount > 0 ? (amount / totalAmount) * 100 : 0
          return { ...payment, amount: value, percentage }
        } else {
          return { ...payment, [field]: value }
        }
      }
      return payment
    }))
  }

  const getSplitPaymentTotal = () => {
    return splitPayments.reduce((total, payment) => {
      return total + (parseFloat(payment.amount) || 0)
    }, 0)
  }

  const getRemainingAmount = () => {
    return getTotalAmount() - getSplitPaymentTotal()
  }

  const autoDistributeRemaining = () => {
    const remaining = getRemainingAmount()
    const emptyPayments = splitPayments.filter(p => !p.amount || parseFloat(p.amount) === 0)
    
    if (emptyPayments.length > 0 && remaining > 0) {
      const amountPerPayment = remaining / emptyPayments.length
      setSplitPayments(prev => prev.map(payment => {
        if (emptyPayments.some(ep => ep.id === payment.id)) {
          const totalAmount = getTotalAmount()
          const percentage = totalAmount > 0 ? (amountPerPayment / totalAmount) * 100 : 0
          return { ...payment, amount: amountPerPayment.toFixed(2), percentage }
        }
        return payment
      }))
    }
  }

  // Service splitting utility functions
  const initializeServiceSplits = () => {
    const allServices: Array<{
      id: string
      serviceId: string
      serviceName: string
      servicePrice: number
      paymentMethod: string
      staffNames: string[]
    }> = []
    
    // Add appointment services
    if (paymentSession?.appointments) {
      paymentSession.appointments.forEach((appointment, index) => {
        allServices.push({
          id: `appointment-${index}`,
          serviceId: appointment.serviceName,
          serviceName: appointment.serviceName,
          servicePrice: appointment.servicePrice,
          paymentMethod: 'visa',
          staffNames: [appointment.staffName]
        })
      })
    }
    
    // Add additional services
    additionalServices.forEach((service, index) => {
      allServices.push({
        id: `additional-${index}`,
        serviceId: service.id,
        serviceName: service.name,
        servicePrice: service.price,
        paymentMethod: 'visa',
        staffNames: service.staffNames || []
      })
    })
    
    setServiceSplits(allServices)
  }

  const updateServicePaymentMethod = (serviceId: string, method: string) => {
    setServiceSplits(prev => prev.map(service => 
      service.id === serviceId ? { ...service, paymentMethod: method } : service
    ))
  }

  const autoDistributeServicePayments = () => {
    const paymentMethods = ['visa', 'mastercard', 'cash']
    setServiceSplits(prev => prev.map((service, index) => ({
      ...service,
      paymentMethod: paymentMethods[index % paymentMethods.length]
    })))
  }

  const getServiceSplitTotal = () => {
    return serviceSplits.reduce((total, service) => total + service.servicePrice, 0)
  }

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
    setSelectedStaffIds([]) // No default selection
    setSelectedStaffTab('all') // Default to all staff tab
  }

  // Handle add service with multiple staff
  const handleAddService = () => {
    if (selectedService && selectedStaffIds.length > 0) {
      const staffNames = selectedStaffIds.map(id => getStaffName(id))
      const pricePerStaff = calculatePriceDistribution(selectedService.price, selectedStaffIds.length)
      
      // Create price distribution for each staff member
      const priceDistribution = selectedStaffIds.map((staffId, index) => ({
        staffId,
        staffName: getStaffName(staffId),
        amount: pricePerStaff[index]
      }))
      
      // Add service to additional services
      const newService = {
        id: selectedService.id,
        name: selectedService.name,
        price: selectedService.price,
        duration: selectedService.duration,
        staffIds: selectedStaffIds,
        staffNames: staffNames,
        priceDistribution: priceDistribution
      }
      
      setAdditionalServices(prev => [...prev, newService])
      
      console.log('Adding service:', selectedService.name, 'with staff:', staffNames.join(', '))
      toast.success(`${selectedService.name} added with ${selectedStaffIds.length} staff member${selectedStaffIds.length > 1 ? 's' : ''}`)
      
      // Reset states and close dialog
      setSelectedService(null)
      setSelectedStaffIds([])
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
          name: barber['Barber/Name'],
          userId: barber['ghl_id'] // Use ghl_id as userId for consistency
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
      // First, try to fetch the specific booking by ID using the new API parameter
      console.log('🔍 Fetching appointment details for ID:', appointmentId)
      
      const response = await fetch(`/api/bookings?id=${appointmentId}&pageSize=1`)
      if (!response.ok) throw new Error('Failed to fetch booking details')
      const data = await response.json()
      
      console.log('📊 API Response for specific booking:', data)
      
      // Check if we found the booking
      const booking = data.bookings?.[0]
      if (!booking) {
        console.error('❌ Appointment not found with ID:', appointmentId)
        throw new Error(`Appointment not found with ID: ${appointmentId}`)
      }
      
      console.log('✅ Found booking:', booking)
      console.log('💰 Booking price from API:', booking.price)
      
      let customerName = booking.contactName || 'Unknown Customer'
      let customerPhone = ''
      let customerEmail = ''
      
      // Get staff name from booking data or fetch from staff API
      let staffName = booking.assignedStaffFirstName && booking.assignedStaffLastName 
        ? `${booking.assignedStaffFirstName} ${booking.assignedStaffLastName}`.trim()
        : 'Staff Member'
      
      const assignedId = staffIdParam || booking.assigned_user_id || ''
      if (assignedId && staffName === 'Staff Member') {
        try {
          const staffRes = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/Staff?id=${assignedId}`)
          const staffData = await staffRes.json()
          const sname = staffData.name || staffData.user?.name || staffData.staff?.name
          if (sname) staffName = sname
        } catch (error) {
          console.warn('Failed to fetch staff details:', error)
        }
      }
      
      // Get contact details if contact_id is available
      if (booking.contact_id) {
        try {
          console.log('🔍 Fetching contact details for contact_id:', booking.contact_id)
          const contactRes = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/getContact?id=${booking.contact_id}`)
          const contactData = await contactRes.json()
          console.log('📞 Contact API Response:', contactData)
          const c = contactData.contact || contactData || {}
          console.log('📞 Parsed contact object:', c)
          if (c) {
            const oldCustomerName = customerName
            const oldCustomerPhone = customerPhone
            const oldCustomerEmail = customerEmail
            
            customerName = `${c.firstName || ''} ${c.lastName || ''}`.trim() || customerName
            customerPhone = c.phone || c.phone_e164 || customerPhone
            customerEmail = c.email || c.email_lower || c.emailAddress || customerEmail
            
            console.log('📞 Contact details update:')
            console.log('  Name:', oldCustomerName, '->', customerName)
            console.log('  Phone:', oldCustomerPhone, '->', customerPhone)
            console.log('  Email:', oldCustomerEmail, '->', customerEmail)
          }
        } catch (error) {
          console.warn('❌ Failed to fetch contact details:', error)
        }
      } else {
        console.log('⚠️ No contact_id available in booking:', booking.contact_id)
      }
      
      const details: AppointmentDetails = {
        id: appointmentId,
        serviceName: booking.serviceName || booking.title || 'Service',
        startTime: booking.startTime || '',
        endTime: booking.endTime || '',
        customerName,
        customerFirstName: (customerName.split(' ')[0] || '').trim() || undefined,
        customerPhone,
        staffName,
        address: booking.address,
        calendar_id: calendarId || booking.calendar_id || '',
        assigned_user_id: assignedId,
        contact_id: booking.contact_id || undefined
      }
      
      if (booking.durationMinutes) {
        details.duration = booking.durationMinutes
      }
      
      setAppointmentDetails(details)
      setCustomerInfo(prev => ({
        ...prev,
        name: customerName !== 'Unknown Customer' ? customerName : prev.name,
        phone: customerPhone || prev.phone,
        email: customerEmail || prev.email,
      }))
      
      // Store the price from Supabase for the payment session
      const price = booking.price || 0 // Use actual price from booking_price field, including 0 for free services
      console.log('✅ Setting booking price from Supabase:', price)
      setBookingPrice(price)
      
    } catch (error) {
      console.error('Error fetching appointment details:', error)
      toast.error('Failed to load appointment details')
      router.push('/calendar')
    }
  }

  // Initialize / refresh pricing using Supabase booking price
  const initializePayment = async () => {
    if (!appointmentDetails) return
    
    try {
      console.log('💰 Initializing payment with booking price:', bookingPrice)
      
      // Create payment session using actual Supabase price (including 0 for free services)
      const servicePrice = bookingPrice
      const tipAmount = useCustomTip ? parseFloat(customTipAmount) || 0 : (servicePrice * tipPercentage) / 100
      const gstAmount = servicePrice * 0.05 // 5% GST
      const totalAmount = servicePrice + tipAmount + gstAmount
      
      const paymentSession: PaymentSession = {
        sessionId: `checkout_${appointmentDetails.id}_${Date.now()}`,
        appointments: [{
          serviceName: appointmentDetails.serviceName,
          servicePrice: servicePrice,
          staffName: appointmentDetails.staffName,
          duration: appointmentDetails.duration ? `${appointmentDetails.duration}m` : '60m'
        }],
        pricing: {
          subtotal: servicePrice,
          tipAmount: tipAmount,
          taxes: {
            gst: { rate: 5, amount: gstAmount },
            totalTax: gstAmount
          },
          totalAmount: totalAmount,
          currency: 'CAD'
        },
        tipDistribution: [{
          staffName: appointmentDetails.staffName,
          servicePrice: servicePrice,
          sharePercentage: 100,
          tipAmount: tipAmount,
          totalEarning: servicePrice + tipAmount
        }]
      }
      
      setPaymentSession(paymentSession)
      console.log('✅ Payment session created with Supabase pricing:', paymentSession)
      
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
    if (!paymentSession || !customerInfo.name) {
      toast.error('Please complete all required fields')
      return
    }
    
    // Validate split payments if enabled
    if (isSplitPayment) {
      const totalAmount = getTotalAmount()
      const splitTotal = getSplitPaymentTotal()
      if (Math.abs(totalAmount - splitTotal) > 0.01) {
        toast.error('Split payment amounts must equal the total amount')
        return
      }
      if (splitPayments.some(p => !p.amount || parseFloat(p.amount) <= 0)) {
        toast.error('All payment methods must have valid amounts')
        return
      }
    }

    // Validate service splits if enabled
    if (isServiceSplit && serviceSplits.length === 0) {
      toast.error('Please configure service split payments')
      return
    }
    
    setProcessingPayment(true)
    try {
      // 1) Persist to Supabase first - Use consistent subtotal calculation
      const subtotal = getCurrentSubtotal()  // Use same calculation as tip and UI
      const gst = getCurrentGST()           // Use same GST calculation as UI
      const tip = getEffectiveTipAmount()
      const totalPaid = subtotal + gst + tip

      const baseItems = paymentSession.appointments.map((a) => ({
        id: crypto.randomUUID(),
        // Prefer provided serviceId; fallback to appointment/calendar id from URL for default item
        serviceId: (a as { serviceId?: string; id?: string }).serviceId ?? (a as { serviceId?: string; id?: string }).id ?? appointmentDetails?.calendar_id ?? calendarId ?? null,
        serviceName: a.serviceName,
        price: a.servicePrice,
        staffName: a.staffName,
      }))
      const addItems = additionalServices.flatMap((s) => {
        // Handle multi-staff services with price distribution
        if (s.priceDistribution && s.priceDistribution.length > 0) {
          return s.priceDistribution.map((dist) => ({
            id: crypto.randomUUID(),
            serviceId: s.id,
            serviceName: s.name,
            price: dist.amount,
            staffName: dist.staffName,
            staffId: dist.staffId,
            isMultiStaffPortion: true,
            originalServicePrice: s.price,
            staffCount: s.priceDistribution.length
          }))
        } else {
          // Fallback for old single-staff services
          return [{
            id: crypto.randomUUID(),
            serviceId: s.id,
            serviceName: s.name,
            price: s.price,
            staffName: s.staffNames?.[0] || '',
            staffId: s.staffIds?.[0] || '',
            isMultiStaffPortion: false
          }]
        }
      })
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
      
      // Handle split payment data
      const splitPaymentData = isSplitPayment ? {
        isSplitPayment: true,
        isServiceSplit: false,
        splitPayments: splitPayments.map(p => ({
          method: p.method,
          amount: parseFloat(p.amount) || 0,
          percentage: p.percentage
        })),
        splitCount: splitPayments.length,
        serviceSplits: []
      } : isServiceSplit ? {
        isSplitPayment: false,
        isServiceSplit: true,
        splitPayments: [],
        splitCount: serviceSplits.length,
        serviceSplits: serviceSplits.map(s => ({
          serviceId: s.serviceId,
          serviceName: s.serviceName,
          servicePrice: s.servicePrice,
          paymentMethod: s.paymentMethod,
          staffNames: s.staffNames
        }))
      } : {
        isSplitPayment: false,
        isServiceSplit: false,
        splitPayments: [],
        splitCount: 1,
        serviceSplits: []
      }
      
      const payload = {
        transaction: {
          id: transactionId,
          paymentDate: new Date().toISOString(),
          method: isSplitPayment ? 'split_payment' : isServiceSplit ? 'service_split' : selectedPaymentMethod,
          subtotal,
          tax: gst,
          tip,
          totalPaid,
          ...splitPaymentData,
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
          bookingId: (() => {
            // For "add service" case, ensure we link to the original appointment from the calendar
            // If paymentSession has appointments, use the first one as it's likely the original
            if (paymentSession?.appointments && paymentSession.appointments.length > 0) {
              const firstAppt = paymentSession.appointments[0] as { id?: string }
              return firstAppt?.id ?? appointmentDetails?.id ?? null
            }
            return appointmentDetails?.id ?? null
          })(),
          paymentStaff: items.map((i) => i.staffName).filter((name) => Boolean(name)).join(', ') || null,
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

  // Calculate current total subtotal (appointment services + additional services)
  const getCurrentSubtotal = () => {
    if (!paymentSession) return 0
    const appointmentTotal = paymentSession.appointments.reduce((sum, apt) => sum + apt.servicePrice, 0)
    const additionalTotal = getAdditionalServicesTotal()
    return appointmentTotal + additionalTotal
  }

  // Effective tip amount including added services when using percentage-based tips
  const getEffectiveTipAmount = () => {
    if (!paymentSession) return 0
    if (useCustomTip) return parseFloat(customTipAmount) || 0
    const base = getCurrentSubtotal()
    const tip = (base * tipPercentage) / 100
    return Number(tip.toFixed(2))
  }

  // Calculate correct GST based on current subtotal (including additional services)
  const getCurrentGST = () => {
    const subtotal = getCurrentSubtotal()
    return Number((subtotal * 0.05).toFixed(2))  // 5% GST
  }

  // Calculate staff tip distribution with multiple staff support
  const getStaffTipDistribution = () => {
    if (!paymentSession || getEffectiveTipAmount() <= 0) return []
    
    const allServices = [
      ...paymentSession.appointments.map(apt => ({
        staffId: apt.staffName, // Using staffName as ID for now
        staffName: apt.staffName,
        servicePrice: apt.servicePrice
      })),
      // Handle multiple staff services with price distribution
      ...additionalServices.flatMap(service => 
        service.priceDistribution ? 
          service.priceDistribution.map(dist => ({
            staffId: dist.staffId,
            staffName: dist.staffName,
            servicePrice: dist.amount
          })) :
          // Fallback for old single-staff services
          [{
            staffId: service.staffIds?.[0] || '',
            staffName: service.staffNames?.[0] || '',
            servicePrice: service.price
          }]
      )
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
      const sharePercentage = totalServicePrice > 0 ? (staff.totalServicePrice / totalServicePrice) * 100 : 0
      const tipShare = totalServicePrice > 0 ? (staff.totalServicePrice / totalServicePrice) * tipAmount : 0
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
      
      // Recalculate pricing
      const newSubtotal = updatedAppointments.reduce((sum, apt) => sum + apt.servicePrice, 0) + getAdditionalServicesTotal()
      const newTipAmount = useCustomTip ? parseFloat(customTipAmount) || 0 : (newSubtotal * tipPercentage) / 100
      const newGst = newSubtotal * 0.05 // 5% GST
      const newTotal = newSubtotal + newTipAmount + newGst
      
      setPaymentSession(prev => prev ? {
        ...prev,
        appointments: updatedAppointments,
        pricing: {
          ...prev.pricing,
          subtotal: newSubtotal,
          tipAmount: newTipAmount,
          taxes: {
            gst: { rate: 5, amount: newGst },
            totalTax: newGst
          },
          totalAmount: newTotal
        }
      } : null)
    } else if (editingService.type === 'additional') {
      // Update additional service price and recalculate price distribution for multiple staff
      const updatedAdditionalServices = [...additionalServices]
      const serviceToUpdate = updatedAdditionalServices[editingService.index]
      
      // If this service has multiple staff, recalculate price distribution
      if (serviceToUpdate.priceDistribution && serviceToUpdate.priceDistribution.length > 0) {
        const newPriceDistribution = calculatePriceDistribution(newPrice, serviceToUpdate.priceDistribution.length)
        
        // Update price distribution with new amounts
        const updatedPriceDistribution = serviceToUpdate.priceDistribution.map((dist, index) => ({
          ...dist,
          amount: newPriceDistribution[index]
        }))
        
        updatedAdditionalServices[editingService.index] = {
          ...serviceToUpdate,
          price: newPrice,
          priceDistribution: updatedPriceDistribution
        }
        
        console.log('Updated price distribution for service:', serviceToUpdate.name, {
          oldPrice: serviceToUpdate.price,
          newPrice: newPrice,
          staffCount: serviceToUpdate.priceDistribution.length,
          newDistribution: updatedPriceDistribution
        })
        
        toast.success(`Price updated to ${formatCurrency(newPrice, paymentSession.pricing.currency)} and redistributed among ${serviceToUpdate.priceDistribution.length} staff`)
      } else {
        // Single staff service - simple price update
        updatedAdditionalServices[editingService.index] = {
          ...serviceToUpdate,
          price: newPrice
        }
        
        toast.success(`Price updated to ${formatCurrency(newPrice, paymentSession.pricing.currency)}`)
      }
      
      setAdditionalServices(updatedAdditionalServices)
      
      // Recalculate pricing for additional services
      const newSubtotal = paymentSession.appointments.reduce((sum, apt) => sum + apt.servicePrice, 0) + updatedAdditionalServices.reduce((sum, service) => sum + service.price, 0)
      const newTipAmount = useCustomTip ? parseFloat(customTipAmount) || 0 : (newSubtotal * tipPercentage) / 100
      const newGst = newSubtotal * 0.05 // 5% GST
      const newTotal = newSubtotal + newTipAmount + newGst
      
      setPaymentSession(prev => prev ? {
        ...prev,
        pricing: {
          ...prev.pricing,
          subtotal: newSubtotal,
          tipAmount: newTipAmount,
          taxes: {
            gst: { rate: 5, amount: newGst },
            totalTax: newGst
          },
          totalAmount: newTotal
        }
      } : null)
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

  useEffect(() => { // Initialize payment session when appointment details are loaded
    console.log('🔍 Payment session check:', {
      hasAppointmentDetails: !!appointmentDetails,
      bookingPrice,
      hasPaymentSession: !!paymentSession,
      tipPercentage,
      customTipAmount,
      useCustomTip
    })
    
    // Initialize payment session when we have appointment details and haven't created a session yet
    // Allow any price including 0 for free services
    if (appointmentDetails && bookingPrice >= 0 && !paymentSession) { 
      console.log('💰 Initializing payment session with price:', bookingPrice)
      void initializePayment() 
    } else if (paymentSession && (tipPercentage || customTipAmount || useCustomTip)) {
      // Only recalculate tip and totals, don't reset service prices
      const currentSubtotal = getCurrentSubtotal()
      const newTipAmount = useCustomTip ? parseFloat(customTipAmount) || 0 : (currentSubtotal * tipPercentage) / 100
      const newGst = currentSubtotal * 0.05 // 5% GST
      const newTotal = currentSubtotal + newTipAmount + newGst
      
      setPaymentSession(prev => prev ? {
        ...prev,
        pricing: {
          ...prev.pricing,
          subtotal: currentSubtotal,
          tipAmount: newTipAmount,
          taxes: {
            gst: { rate: 5, amount: newGst },
            totalTax: newGst
          },
          totalAmount: newTotal
        }
      } : null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentDetails, bookingPrice, tipPercentage, customTipAmount, useCustomTip])

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

  // Debug useEffect to monitor checkout button state
  useEffect(() => {
    const isButtonDisabled = processingPayment || !customerInfo.name || !paymentSession || (isSplitPayment && Math.abs(getRemainingAmount()) > 0.01)
    
    // Individual condition checks (email removed - phone is sufficient)
    const conditions = {
      processingPayment: processingPayment,
      noName: !customerInfo.name,
      noPaymentSession: !paymentSession,
      splitPaymentIssue: isSplitPayment && Math.abs(getRemainingAmount()) > 0.01
    }
    
    const failingConditions = Object.entries(conditions).filter(([key, value]) => value).map(([key]) => key)
    
    console.log('🔘 Complete Payment Button Debug:', {
      isDisabled: isButtonDisabled,
      failingConditions,
      customerInfo: {
        name: customerInfo.name || 'MISSING',
        phone: customerInfo.phone || 'MISSING'
      },
      paymentSession: paymentSession ? {
        sessionId: paymentSession.sessionId,
        appointmentsCount: paymentSession.appointments?.length,
        totalAmount: paymentSession.pricing?.totalAmount,
        currency: paymentSession.pricing?.currency
      } : 'MISSING PAYMENT SESSION',
      processingPayment,
      isSplitPayment,
      remainingAmount: isSplitPayment ? Math.abs(getRemainingAmount()) : 'N/A',
      bookingPrice,
      appointmentDetails: appointmentDetails ? {
        id: appointmentDetails.id,
        serviceName: appointmentDetails.serviceName,
        staffName: appointmentDetails.staffName,
        customerName: appointmentDetails.customerName
      } : 'MISSING APPOINTMENT DETAILS'
    })
    
    // If the button is disabled, let's identify exactly why
    if (isButtonDisabled) {
      console.error('❌ Complete Payment Button DISABLED due to:', failingConditions.join(', '))
    } else {
      console.log('✅ Complete Payment Button should be ENABLED')
    }
  }, [processingPayment, customerInfo.email, customerInfo.name, paymentSession, isSplitPayment, bookingPrice, appointmentDetails])

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
                      {/* Buttons removed as requested */}
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
                                                onClick={() => toggleStaffSelection(staff.userId)}
                                                className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all relative ${
                                                  selectedStaffIds.includes(staff.userId)
                                                    ? 'border-[#7b1d1d] bg-[#7b1d1d]/5'
                                                    : 'border-neutral-200 bg-white hover:border-[#7b1d1d]/30 hover:bg-neutral-50'
                                                }`}
                                              >
                                                {selectedStaffIds.includes(staff.userId) && (
                                                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-[#7b1d1d] rounded-full flex items-center justify-center">
                                                    <CheckCircle2 className="h-4 w-4 text-white" />
                                                  </div>
                                                )}
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg ${
                                                  selectedStaffIds.includes(staff.userId)
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
                                            disabled={selectedStaffIds.length === 0}
                                            className="flex-1 rounded-xl bg-[#7b1d1d] hover:bg-[#6b1717] text-white"
                                          >
                                            <Plus className="h-4 w-4 mr-2" />
                                            Add Service {selectedStaffIds.length > 0 && `(${selectedStaffIds.length} staff)`}
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
                                  <div className="text-[12px] text-neutral-500">{service.duration} min • {service.staffNames?.join(', ') || 'Multiple staff'}</div>
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
                          <Row label="Subtotal" value={formatCurrency(getCurrentSubtotal(), paymentSession.pricing.currency)} />
                          {getEffectiveTipAmount() > 0 && (
                            <Row label={`Tip (${useCustomTip ? 'Custom' : `${tipPercentage}%`})`} value={formatCurrency(getEffectiveTipAmount(), paymentSession.pricing.currency)} />
                          )}
                          <div className="h-px my-2 bg-neutral-200" />
                          <Row small label={`GST (5%)`} value={formatCurrency(getCurrentGST(), paymentSession.pricing.currency)} />
                          <div className="h-px my-2 bg-neutral-200" />
                          <Row strong label="Total Due" value={formatCurrency(getCurrentSubtotal() + getEffectiveTipAmount() + getCurrentGST(), paymentSession.pricing.currency)} />
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Staff Tip Distribution Card */}
                  {paymentSession && getEffectiveTipAmount() > 0 && (
                    <Card className="rounded-2xl border-neutral-200 shadow-none">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-[16px] font-semibold flex items-center gap-2">
                          <Users className="h-5 w-5 text-[#7b1d1d]" />
                          Staff Tip Distribution
                        </CardTitle>
                        <CardDescription className="text-[13px]">
                          How the {formatCurrency(getEffectiveTipAmount(), paymentSession.pricing.currency)} tip is distributed among staff
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-hidden rounded-xl border border-neutral-200">
                          <div className="divide-y">
                            {getStaffTipDistribution().map((staff, index) => (
                              <div key={index} className="flex items-center justify-between px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#7b1d1d] to-[#a02929] flex items-center justify-center">
                                    <span className="text-white text-sm font-semibold">
                                      {staff.staffName.split(' ').map(n => n[0]).join('').toUpperCase()}
                                    </span>
                                  </div>
                                  <div>
                                    <div className="text-[14px] font-medium text-neutral-900">{staff.staffName}</div>
                                    <div className="text-[12px] text-neutral-500">
                                      {formatCurrency(staff.totalServicePrice, paymentSession.pricing.currency)} services • {staff.sharePercentage.toFixed(1)}%
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[14px] font-semibold text-green-600">
                                    {formatCurrency(staff.tipShare, paymentSession.pricing.currency)}
                                  </div>
                                  <div className="text-[12px] text-neutral-500">tip share</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Service Price Distribution Card - Full Width */}
                  {additionalServices.some(service => service.priceDistribution && service.priceDistribution.length > 1) && (
                    <Card className="rounded-2xl border-neutral-200 shadow-none">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-[16px] font-semibold flex items-center gap-2">
                          <Users className="h-5 w-5 text-[#7b1d1d]" />
                          Service Price Distribution
                        </CardTitle>
                        <CardDescription className="text-[13px]">How service prices are distributed among multiple staff members</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {additionalServices
                            .filter(service => service.priceDistribution && service.priceDistribution.length > 1)
                            .map((service, serviceIndex) => (
                              <div key={serviceIndex} className="rounded-xl border border-neutral-200 p-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <h4 className="font-medium text-neutral-900">{service.name}</h4>
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg font-semibold text-[#7b1d1d]">
                                        {formatCurrency(service.price, paymentSession?.pricing.currency || 'CAD')}
                                      </span>
                                      <span className="text-xs text-neutral-500 bg-neutral-100 px-2 py-1 rounded-full">
                                        {service.priceDistribution.length} staff
                                      </span>
                                    </div>
                                  </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                  {service.priceDistribution.map((dist, distIndex) => (
                                    <div key={distIndex} className="flex items-center justify-between py-3 px-4 bg-neutral-50 rounded-lg border border-neutral-100">
                                      <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#7b1d1d] to-[#a02929] flex items-center justify-center">
                                          <span className="text-white text-sm font-semibold">
                                            {dist.staffName.split(' ').map(n => n[0]).join('').toUpperCase()}
                                          </span>
                                        </div>
                                        <span className="text-sm font-medium text-neutral-900">{dist.staffName}</span>
                                      </div>
                                      <span className="text-lg font-semibold text-[#7b1d1d]">
                                        {formatCurrency(dist.amount, paymentSession?.pricing.currency || 'CAD')}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Bottom Section: Payment Method + Tip Selection in Two Columns */}
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Payment Method Card */}
                    <Card className="rounded-2xl border-neutral-200 shadow-none">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-[16px] font-semibold flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Wallet className="h-5 w-5 text-[#7b1d1d]" />
                            Payment Method
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowSplitDialog(true)}
                            className="h-8 px-3 text-[#7b1d1d] hover:bg-[#7b1d1d]/10"
                          >
                            <Split className="h-4 w-4 mr-1" />
                            Split
                          </Button>
                        </CardTitle>
        <CardDescription className="text-[13px]">
          {isSplitPayment ? 'Multiple payment methods selected' : isServiceSplit ? 'Service split enabled - each service paid separately' : 'Choose your preferred payment method'}
        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {!isSplitPayment ? (
                          <div className="grid grid-cols-2 gap-2 md:grid-cols-1 lg:grid-cols-2">
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
                                  className={`flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-2 transition-all hover:border-[#7b1d1d]/30 cursor-pointer ${
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
                        ) : (
                          <div className="space-y-3">
                            {splitPayments.map((payment, index) => {
                              const paymentMethods = [
                                { id: 'visa', name: 'Visa', icon: CreditCard },
                                { id: 'mastercard', name: 'Mastercard', icon: CreditCard },
                                { id: 'amex', name: 'Amex', icon: CreditCard },
                                { id: 'debit', name: 'Debit', icon: CreditCard },
                                { id: 'cash', name: 'Cash', icon: DollarSign }
                              ]
                              const selectedMethod = paymentMethods.find(m => m.id === payment.method)
                              const IconComponent = selectedMethod?.icon || CreditCard
                              
                              return (
                                <div key={payment.id} className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                                  <div className="flex items-center gap-2 flex-1">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <Select value={payment.method} onValueChange={(value) => updateSplitPayment(payment.id, 'method', value)}>
                                        <SelectTrigger className="w-[120px] h-8 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {paymentMethods.map((method) => {
                                            const MethodIcon = method.icon
                                            return (
                                              <SelectItem key={method.id} value={method.id}>
                                                <div className="flex items-center gap-2">
                                                  <MethodIcon className="h-3 w-3" />
                                                  <span>{method.name}</span>
                                                </div>
                                              </SelectItem>
                                            )
                                          })}
                                        </SelectContent>
                                      </Select>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={payment.amount}
                                        onChange={(e) => updateSplitPayment(payment.id, 'amount', e.target.value)}
                                        placeholder="0.00"
                                        className="h-8 text-xs flex-1"
                                      />
                                      <span className="text-xs text-neutral-500 min-w-[40px]">
                                        {payment.percentage.toFixed(1)}%
                                      </span>
                                    </div>
                                  </div>
                                  {splitPayments.length > 1 && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeSplitPayment(payment.id)}
                                      className="h-8 w-8 p-0 text-neutral-500 hover:text-red-600"
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              )
                            })}
                            
                            <div className="flex items-center justify-between pt-2 border-t border-neutral-200">
                              <div className="flex gap-2">
                                {splitPayments.length < 3 && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={addSplitPayment}
                                    className="h-8 px-3 text-xs"
                                  >
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add Method
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={autoDistributeRemaining}
                                  className="h-8 px-3 text-xs text-[#7b1d1d]"
                                >
                                  <Calculator className="h-3 w-3 mr-1" />
                                  Auto Split
                                </Button>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setIsSplitPayment(false)
                                  setSplitPayments([{ id: '1', method: 'visa', amount: '', percentage: 100 }])
                                }}
                                className="h-8 px-3 text-xs text-neutral-600"
                              >
                                <X className="h-3 w-3 mr-1" />
                                Cancel Split
                              </Button>
                            </div>
                            
                            {paymentSession && (
                              <div className="bg-white rounded-lg p-3 border border-neutral-200">
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-neutral-600">Total Due:</span>
                                  <span className="font-semibold text-neutral-900">
                                    {formatCurrency(getTotalAmount(), paymentSession.pricing.currency)}
                                  </span>
                                </div>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-neutral-600">Split Total:</span>
                                  <span className={`font-semibold ${
                                    Math.abs(getSplitPaymentTotal() - getTotalAmount()) < 0.01 
                                      ? 'text-green-600' 
                                      : 'text-red-600'
                                  }`}>
                                    {formatCurrency(getSplitPaymentTotal(), paymentSession.pricing.currency)}
                                  </span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-neutral-600">Remaining:</span>
                                  <span className={`font-semibold ${
                                    Math.abs(getRemainingAmount()) < 0.01 
                                      ? 'text-green-600' 
                                      : getRemainingAmount() > 0 
                                        ? 'text-orange-600' 
                                        : 'text-red-600'
                                  }`}>
                                    {formatCurrency(getRemainingAmount(), paymentSession.pricing.currency)}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>


                    {/* Tip Selection Card */}
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
                              <SelectTrigger className="w-24 rounded-xl text-[14px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="percentage">%</SelectItem>
                                <SelectItem value="custom">$</SelectItem>
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
                  </div>

                  {/* Complete Checkout Button */}
                  <Card className="rounded-2xl border-neutral-200 shadow-none">
                    <CardContent className="pt-6">
                      <Button
                        size="lg"
                        className={`w-full rounded-2xl ${
                          isSplitPayment && Math.abs(getRemainingAmount()) > 0.01
                            ? 'bg-neutral-400 text-white cursor-not-allowed'
                            : 'bg-[#7b1d1d] text-white hover:bg-[#6b1717]'
                        }`}
                        onClick={() => {
                          // Debug log before checkout
                          console.log('🔘 Checkout button clicked:', {
                            processingPayment,
                            customerEmail: customerInfo.email,
                            customerName: customerInfo.name,
                            hasPaymentSession: !!paymentSession,
                            isSplitPayment,
                            remainingAmount: isSplitPayment ? Math.abs(getRemainingAmount()) : 0
                          })
                          proceedToCheckout()
                        }}
                        disabled={processingPayment || !customerInfo.name || !paymentSession || (isSplitPayment && Math.abs(getRemainingAmount()) > 0.01)}
                      >
                        {processingPayment ? (
                          <>
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : isSplitPayment && Math.abs(getRemainingAmount()) > 0.01 ? (
                          <>
                            <AlertCircle className="h-5 w-5 mr-2" />
                            Split amounts must total {paymentSession && formatCurrency(getTotalAmount(), paymentSession.pricing.currency)}
                          </>
                        ) : (
                          <>
                            {isSplitPayment ? (
                              <Split className="h-5 w-5 mr-2" />
                            ) : (
                              <CreditCard className="h-5 w-5 mr-2" />
                            )}
                            Complete {isSplitPayment ? 'Split ' : ''}Payment
                            {paymentSession && (
                              <span className="ml-2 font-bold">
                                {formatCurrency(getCurrentSubtotal() + getEffectiveTipAmount() + getCurrentGST(), paymentSession.pricing.currency)}
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

          {/* Split Payment Dialog */}
          <Dialog open={showSplitDialog} onOpenChange={setShowSplitDialog}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                  <Split className="h-5 w-5 text-[#7b1d1d]" />
                  Split Payment Options
                </DialogTitle>
                <DialogDescription>
                  Choose how you&apos;d like to split this transaction - by payment method or by service.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* Split Mode Selection */}
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setSplitMode('payment')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      splitMode === 'payment'
                        ? 'border-[#7b1d1d] bg-[#7b1d1d]/5'
                        : 'border-neutral-200 hover:border-[#7b1d1d]/30'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className={`p-3 rounded-full ${
                        splitMode === 'payment' ? 'bg-[#7b1d1d] text-white' : 'bg-neutral-100 text-neutral-600'
                      }`}>
                        <CreditCard className="h-6 w-6" />
                      </div>
                      <div className="text-center">
                        <h3 className="font-semibold text-neutral-900">Split by Payment</h3>
                        <p className="text-sm text-neutral-600 mt-1">Use multiple payment methods for the total amount</p>
                      </div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => setSplitMode('service')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      splitMode === 'service'
                        ? 'border-[#7b1d1d] bg-[#7b1d1d]/5'
                        : 'border-neutral-200 hover:border-[#7b1d1d]/30'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className={`p-3 rounded-full ${
                        splitMode === 'service' ? 'bg-[#7b1d1d] text-white' : 'bg-neutral-100 text-neutral-600'
                      }`}>
                        <Receipt className="h-6 w-6" />
                      </div>
                      <div className="text-center">
                        <h3 className="font-semibold text-neutral-900">Split by Service</h3>
                        <p className="text-sm text-neutral-600 mt-1">Separate payment for each service item</p>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Split Content */}
                {splitMode === 'payment' ? (
                  <div className="space-y-4">
                    <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                      <h4 className="font-semibold text-neutral-900 mb-3">Payment Method Split</h4>
                      <p className="text-sm text-neutral-600 mb-4">
                        Divide the total amount across multiple payment methods. For example: $100 cash + $50 card.
                      </p>
                      
                      {paymentSession && (
                        <div className="bg-white rounded-lg p-3 border border-neutral-200 mb-4">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-neutral-700">Total Amount:</span>
                            <span className="text-lg font-bold text-[#7b1d1d]">
                              {formatCurrency(getTotalAmount(), paymentSession.pricing.currency)}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Payment Methods (up to 3)</Label>
                        {splitPayments.map((payment, index) => {
                          const paymentMethods = [
                            { id: 'visa', name: 'Visa', icon: CreditCard },
                            { id: 'mastercard', name: 'Mastercard', icon: CreditCard },
                            { id: 'amex', name: 'Amex', icon: CreditCard },
                            { id: 'debit', name: 'Debit', icon: CreditCard },
                            { id: 'cash', name: 'Cash', icon: DollarSign }
                          ]
                          const selectedMethod = paymentMethods.find(m => m.id === payment.method)
                          const IconComponent = selectedMethod?.icon || CreditCard
                          
                          return (
                            <div key={payment.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-neutral-200">
                              <span className="text-sm font-medium text-neutral-600 min-w-[20px]">#{index + 1}</span>
                              <Select value={payment.method} onValueChange={(value) => updateSplitPayment(payment.id, 'method', value)}>
                                <SelectTrigger className="w-[140px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {paymentMethods.map((method) => {
                                    const MethodIcon = method.icon
                                    return (
                                      <SelectItem key={method.id} value={method.id}>
                                        <div className="flex items-center gap-2">
                                          <MethodIcon className="h-4 w-4" />
                                          <span>{method.name}</span>
                                        </div>
                                      </SelectItem>
                                    )
                                  })}
                                </SelectContent>
                              </Select>
                              <div className="flex-1">
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={payment.amount}
                                  onChange={(e) => updateSplitPayment(payment.id, 'amount', e.target.value)}
                                  placeholder="0.00"
                                  className="w-full"
                                />
                              </div>
                              <div className="text-sm text-neutral-500 min-w-[60px] text-right">
                                {payment.percentage.toFixed(1)}%
                              </div>
                              {splitPayments.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeSplitPayment(payment.id)}
                                  className="text-neutral-500 hover:text-red-600"
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          )
                        })}
                        
                        <div className="flex gap-2">
                          {splitPayments.length < 3 && (
                            <Button
                              variant="outline"
                              onClick={addSplitPayment}
                              className="flex-1"
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Payment Method
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            onClick={autoDistributeRemaining}
                            className="flex-1 text-[#7b1d1d]"
                          >
                            <Calculator className="h-4 w-4 mr-2" />
                            Auto Distribute
                          </Button>
                        </div>
                      </div>

                      {paymentSession && (
                        <div className="mt-4 p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div className="text-center">
                              <div className="text-neutral-600">Total Due</div>
                              <div className="font-semibold text-neutral-900">
                                {formatCurrency(getTotalAmount(), paymentSession.pricing.currency)}
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-neutral-600">Split Total</div>
                              <div className={`font-semibold ${
                                Math.abs(getSplitPaymentTotal() - getTotalAmount()) < 0.01 
                                  ? 'text-green-600' 
                                  : 'text-red-600'
                              }`}>
                                {formatCurrency(getSplitPaymentTotal(), paymentSession.pricing.currency)}
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-neutral-600">Remaining</div>
                              <div className={`font-semibold ${
                                Math.abs(getRemainingAmount()) < 0.01 
                                  ? 'text-green-600' 
                                  : getRemainingAmount() > 0 
                                    ? 'text-orange-600' 
                                    : 'text-red-600'
                              }`}>
                                {formatCurrency(getRemainingAmount(), paymentSession.pricing.currency)}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                      <h4 className="font-semibold text-neutral-900 mb-3">Service Split</h4>
                      <p className="text-sm text-neutral-600 mb-4">
                        Pay for each service separately with different payment methods.
                      </p>
                      
                      {paymentSession && (
                        <div className="bg-white rounded-lg p-3 border border-neutral-200 mb-4">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-neutral-700">Total Services:</span>
                            <span className="text-lg font-bold text-[#7b1d1d]">
                              {serviceSplits.length > 0 ? formatCurrency(getServiceSplitTotal(), paymentSession.pricing.currency) : formatCurrency(getTotalAmount(), paymentSession.pricing.currency)}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Service Payment Methods</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              initializeServiceSplits()
                              autoDistributeServicePayments()
                            }}
                            className="h-8 px-3 text-xs text-[#7b1d1d]"
                          >
                            <Calculator className="h-3 w-3 mr-1" />
                            Auto Distribute
                          </Button>
                        </div>
                        
                        {serviceSplits.length === 0 ? (
                          <>
                            {paymentSession && paymentSession.appointments.map((appointment, index) => (
                              <div key={index} className="bg-white rounded-lg p-4 border border-neutral-200">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex-1">
                                    <h5 className="font-medium text-neutral-900">{appointment.serviceName}</h5>
                                    <p className="text-sm text-neutral-600">{appointment.staffName}</p>
                                  </div>
                                  <div className="text-lg font-semibold text-[#7b1d1d]">
                                    {formatCurrency(appointment.servicePrice, paymentSession.pricing.currency)}
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Label className="text-sm text-neutral-600 min-w-[80px]">Pay with:</Label>
                                  <Select value="visa" onValueChange={() => initializeServiceSplits()}>
                                    <SelectTrigger className="flex-1">
                                      <SelectValue placeholder="Select payment method" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="visa">
                                        <div className="flex items-center gap-2">
                                          <CreditCard className="h-4 w-4" />
                                          <span>Visa</span>
                                        </div>
                                      </SelectItem>
                                      <SelectItem value="mastercard">
                                        <div className="flex items-center gap-2">
                                          <CreditCard className="h-4 w-4" />
                                          <span>Mastercard</span>
                                        </div>
                                      </SelectItem>
                                      <SelectItem value="cash">
                                        <div className="flex items-center gap-2">
                                          <DollarSign className="h-4 w-4" />
                                          <span>Cash</span>
                                        </div>
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            ))}
                            
                            {additionalServices.map((service, index) => (
                              <div key={`additional-${index}`} className="bg-white rounded-lg p-4 border border-neutral-200">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex-1">
                                    <h5 className="font-medium text-neutral-900">{service.name}</h5>
                                    <p className="text-sm text-neutral-600">{service.staffNames?.join(', ') || 'Multiple staff'}</p>
                                  </div>
                                  <div className="text-lg font-semibold text-[#7b1d1d]">
                                    {formatCurrency(service.price, paymentSession?.pricing.currency || 'CAD')}
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Label className="text-sm text-neutral-600 min-w-[80px]">Pay with:</Label>
                                  <Select value="visa" onValueChange={() => initializeServiceSplits()}>
                                    <SelectTrigger className="flex-1">
                                      <SelectValue placeholder="Select payment method" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="visa">
                                        <div className="flex items-center gap-2">
                                          <CreditCard className="h-4 w-4" />
                                          <span>Visa</span>
                                        </div>
                                      </SelectItem>
                                      <SelectItem value="mastercard">
                                        <div className="flex items-center gap-2">
                                          <CreditCard className="h-4 w-4" />
                                          <span>Mastercard</span>
                                        </div>
                                      </SelectItem>
                                      <SelectItem value="cash">
                                        <div className="flex items-center gap-2">
                                          <DollarSign className="h-4 w-4" />
                                          <span>Cash</span>
                                        </div>
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            ))}
                          </>
                        ) : (
                          serviceSplits.map((service, index) => {
                            const paymentMethods = [
                              { id: 'visa', name: 'Visa', icon: CreditCard },
                              { id: 'mastercard', name: 'Mastercard', icon: CreditCard },
                              { id: 'amex', name: 'Amex', icon: CreditCard },
                              { id: 'debit', name: 'Debit', icon: CreditCard },
                              { id: 'cash', name: 'Cash', icon: DollarSign }
                            ]
                            const selectedMethod = paymentMethods.find(m => m.id === service.paymentMethod)
                            const IconComponent = selectedMethod?.icon || CreditCard
                            
                            return (
                              <div key={service.id} className="bg-white rounded-lg p-4 border border-neutral-200">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex-1">
                                    <h5 className="font-medium text-neutral-900">{service.serviceName}</h5>
                                    <p className="text-sm text-neutral-600">{service.staffNames.join(', ') || 'Staff member'}</p>
                                  </div>
                                  <div className="text-lg font-semibold text-[#7b1d1d]">
                                    {formatCurrency(service.servicePrice, paymentSession?.pricing.currency || 'CAD')}
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Label className="text-sm text-neutral-600 min-w-[80px]">Pay with:</Label>
                                  <Select value={service.paymentMethod} onValueChange={(value) => updateServicePaymentMethod(service.id, value)}>
                                    <SelectTrigger className="flex-1">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {paymentMethods.map((method) => {
                                        const MethodIcon = method.icon
                                        return (
                                          <SelectItem key={method.id} value={method.id}>
                                            <div className="flex items-center gap-2">
                                              <MethodIcon className="h-4 w-4" />
                                              <span>{method.name}</span>
                                            </div>
                                          </SelectItem>
                                        )
                                      })}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            )
                          })
                        )}
                        
                        {serviceSplits.length > 0 && (
                          <div className="mt-4 p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div className="text-center">
                                <div className="text-neutral-600">Total Services</div>
                                <div className="font-semibold text-neutral-900">
                                  {serviceSplits.length}
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="text-neutral-600">Payment Methods</div>
                                <div className="font-semibold text-[#7b1d1d]">
                                  {new Set(serviceSplits.map(s => s.paymentMethod)).size}
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="text-neutral-600">Total Amount</div>
                                <div className="font-semibold text-green-600">
                                  {formatCurrency(getServiceSplitTotal(), paymentSession?.pricing.currency || 'CAD')}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Dialog Actions */}
                <div className="flex justify-between pt-4 border-t border-neutral-200">
                  <Button
                    variant="outline"
                    onClick={() => setShowSplitDialog(false)}
                  >
                    Cancel
                  </Button>
                  <div className="flex gap-2">
                    {splitMode === 'payment' && (
                      <Button
                        onClick={() => {
                          setIsSplitPayment(true)
                          setShowSplitDialog(false)
                          toast.success('Split payment enabled')
                        }}
                        disabled={Math.abs(getRemainingAmount()) > 0.01}
                        className="bg-[#7b1d1d] hover:bg-[#6b1717] text-white"
                      >
                        Apply Split Payment
                      </Button>
                    )}
                    {splitMode === 'service' && (
                      <Button
                        onClick={() => {
                          if (serviceSplits.length === 0) {
                            initializeServiceSplits()
                          }
                          setIsServiceSplit(true)
                          setShowSplitDialog(false)
                          toast.success('Service split enabled - each service can be paid separately')
                        }}
                        className="bg-[#7b1d1d] hover:bg-[#6b1717] text-white"
                      >
                        Apply Service Split
                      </Button>
                    )}
                  </div>
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
