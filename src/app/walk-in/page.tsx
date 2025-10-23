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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
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
  Minus,
  Search,
  UserPlus,
  Mail,
  User
} from "lucide-react"
import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface Customer {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  fullName: string
  dateAdded?: string
}

interface ContactResponse {
  id: string | number
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  contactName?: string
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

interface TipDistribution {
  staffName: string
  sharePercentage: number
  tipShare: number
  totalEarning: number
  totalServicePrice: number
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

interface AdditionalService {
  id: string
  name: string
  price: number
  duration: number
  staffIds: string[]
  staffNames: string[]
  priceDistribution: Array<{ staffId: string; staffName: string; amount: number }>
}

export default function WalkInPage() {
  const router = useRouter()
  
  // State
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
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
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [processingCheckout, setProcessingCheckout] = useState(false)
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  
  // Form state
  const [customerSearch, setCustomerSearch] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(true)
  const [tipPercentage, setTipPercentage] = useState(0)
  const [customTipAmount, setCustomTipAmount] = useState('')
  const [useCustomTip, setUseCustomTip] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('visa')
  const [addServiceDialogOpen, setAddServiceDialogOpen] = useState(false)
  const [selectedStaffId, setSelectedStaffId] = useState<string>('')
  const [showStaffSelection, setShowStaffSelection] = useState(false)
  
  // Enhanced state for multiple staff and split payments
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([])
  const [selectedStaffTab, setSelectedStaffTab] = useState<'all' | 'available'>('all')
  const [additionalServices, setAdditionalServices] = useState<AdditionalService[]>([])
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
  const [editingService, setEditingService] = useState<{ type: 'appointment' | 'additional', index: number } | null>(null)
  const [editPrice, setEditPrice] = useState<string>('')
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  // Calendar prefill state (when launched from Calendar selection quick action)
  const [calendarPrefill, setCalendarPrefill] = useState<{
    date: string
    startMinutes?: number
    endMinutes?: number
    staffId?: string
    staffName?: string
  } | null>(null)
  // Top-level appointment details (used for booking insertion); prefilled from calendar when present
  const [appointmentDetails, setAppointmentDetails] = useState<{
    date: string
    time: string // HH:mm 24h in local (Denver wall time)
    staffId?: string
  } | null>(null)

  const minutesToHHMM = (mins: number) => {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  const hhmmToMinutes = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number)
    if (isNaN(h) || isNaN(m)) return 0
    return h * 60 + m
  }
  
  // New customer dialog state
  const [newCustomerDialogOpen, setNewCustomerDialogOpen] = useState(false)
  const [newCustomerLoading, setNewCustomerLoading] = useState(false)
  const [newCustomerForm, setNewCustomerForm] = useState({
    firstName: '',
    lastName: '',
    phone: ''
  })
  
  // Guest checkout state
  const [guestDialogOpen, setGuestDialogOpen] = useState(false)
  const [guestForm, setGuestForm] = useState({
    name: '',
    phone: ''
  })
  const [isGuestCheckout, setIsGuestCheckout] = useState(false)
  
  // Product dialog state
  const [addProductSheetOpen, setAddProductSheetOpen] = useState(false)
  const [productName, setProductName] = useState('Product')
  const [productPrice, setProductPrice] = useState('')
  const [productStaffIds, setProductStaffIds] = useState<string[]>([])
  const [productStaffTab, setProductStaffTab] = useState<'all' | 'available'>('all')

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

  // Helper to get last 4 digits of a phone number safely
  const getPhoneLast4 = (phone?: string) => {
    const digits = (phone || '').replace(/\D/g, '')
    return digits.slice(-4)
  }

  // Customer search function
  const searchCustomers = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setCustomers([])
      return
    }
    
    try {
      setLoadingCustomers(true)
      const onlyDigits = searchTerm.replace(/\D/g, '')
      const isLast4Search = /^\d{4}$/.test(onlyDigits)

      if (isLast4Search) {
        // Use internal API to reliably find matches by last 4 digits
        const url = `/api/customers/search-last4?digits=${onlyDigits}&t=${Date.now()}`
        const tryFetch = async () => {
          const res = await fetch(url)
          if (!res.ok) throw new Error('Failed to search by last 4 digits')
          const apiJson = await res.json().catch(() => ({ ok: false, results: [] as unknown[] }))
          const results = Array.isArray(apiJson.results) ? apiJson.results as Array<{
            id?: string | number
            contactName?: string
            firstName?: string
            lastName?: string
            phone?: string | null
            dateAdded?: string
          }> : []
          const mapped: Customer[] = results.map((c) => ({
            id: String(c.id || ''),
            firstName: c.firstName || '',
            lastName: c.lastName || '',
            email: '',
            phone: c.phone || '',
            fullName: c.contactName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unknown',
            dateAdded: c.dateAdded || new Date().toISOString(),
          }))
          return mapped
        }

        let mapped: Customer[] = []
        try {
          mapped = await tryFetch()
        } catch (e) {
          // One quick retry to handle transient network errors
          try {
            mapped = await tryFetch()
          } catch (e2) {
            // Fallback to external search (may return empty for pure 4-digit input)
            console.warn('Last-4 internal API failed twice, falling back to external searchContacts:', e2)
            const response = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/searchContacts?s=${encodeURIComponent(searchTerm)}&page=1&limit=20`)
            if (response.ok) {
              const json = await response.json()
              const fallback: Customer[] = (json.results?.map((contact: ContactResponse) => ({
                id: contact.id.toString(),
                firstName: contact.firstName || '',
                lastName: contact.lastName || '',
                email: contact.email || '',
                phone: contact.phone || '',
                fullName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.contactName || 'Unknown'
              })) || []) as Customer[]
              // Client-side last-4 filter as a final fallback
              const last4 = onlyDigits
              mapped = fallback.filter(c => (c.phone || '').replace(/\D/g, '').slice(-4) === last4)
            }
          }
        }
        setCustomers(mapped)
      } else {
        // Default path: use existing backend search
        const response = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/searchContacts?s=${encodeURIComponent(searchTerm)}&page=1&limit=20`)
        if (!response.ok) throw new Error('Failed to search contacts')
        const json = await response.json()
        const formattedCustomers: Customer[] = (json.results?.map((contact: ContactResponse) => ({
          id: contact.id.toString(),
          firstName: contact.firstName || '',
          lastName: contact.lastName || '',
          email: contact.email || '',
          phone: contact.phone || '',
          fullName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.contactName || 'Unknown'
        })) || []) as Customer[]
        setCustomers(formattedCustomers)
      }
    } catch (error) {
      console.error('Error searching customers:', error)
      toast.error('Failed to search customers')
    } finally {
      setLoadingCustomers(false)
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

  // Fetch groups from Supabase (matching checkout page)
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

  // Fetch services for a specific group (matching checkout page)
  const fetchServicesForGroup = async (groupId: string) => {
    try {
      const response = await fetch(`/api/services?groupId=${groupId}`)
      if (!response.ok) throw new Error('Failed to fetch services')
      const data = await response.json()
      
      // Transform the services data to match our interface
      const transformedServices = (data.services || []).map((service: {
        id?: string;
        name?: string;
        description?: string;
        slotDuration?: number;
        duration?: number;
        slotDurationUnit?: string;
        durationUnit?: string;
        teamMembers?: Array<{ userId: string; priority: number; selected: boolean }>
      }) => {
        const price = extractPriceFromDescription(service.description || '')
        // Compute duration in minutes using slotDuration and slotDurationUnit when available
        const rawDuration = Number(service.slotDuration) || Number(service.duration) || 0
        const unit = (service.slotDurationUnit || service.durationUnit || '').toString().toLowerCase()
        const durationMinutes = rawDuration > 0
          ? (unit === 'hours' || unit === 'hour')
            ? rawDuration * 60
            : rawDuration // assume minutes
          : 0
        console.log(`Service: ${service.name}, Price: ${price}, Duration: ${rawDuration} ${unit || '(mins assumed)'} => ${durationMinutes} mins`)
        return {
          id: service.id,
          name: service.name,
          price: price,
          duration: durationMinutes,
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

  // Get staff name by userId
  const getStaffName = (userId: string) => {
    const staff = staffData.find(s => s.ghl_id === userId)
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

  // Calculate additional services total
  const getAdditionalServicesTotal = () => {
    return additionalServices.reduce((total, service) => total + service.price, 0)
  }

  // Calculate current total subtotal (appointment services + additional services)
  const getCurrentSubtotal = () => {
    const appointmentTotal = selectedServices.reduce((sum, item) => sum + item.service.price, 0)
    const additionalTotal = getAdditionalServicesTotal()
    return appointmentTotal + additionalTotal
  }

  // Effective tip amount including added services when using percentage-based tips
  const getEffectiveTipAmount = () => {
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

  // Handle service click
  const handleServiceClick = (service: Service) => {
    // If appointment staff is set (prefilled or chosen), add directly without redundant staff selection
    if (appointmentDetails?.staffId) {
      const staffId = appointmentDetails.staffId
      const staffName = getStaffName(staffId)
      setSelectedServices(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          service,
          staff: { ghl_id: staffId, name: staffName },
        },
      ])
      toast.success(`${service.name} added for ${staffName}`)
      setAddServiceDialogOpen(false)
      return
    }
    // Fallback to existing staff selection flow when no appointment staff chosen
    setSelectedService(service)
    setShowStaffSelection(true)
    setSelectedStaffIds([]) // No default selection
    setSelectedStaffTab('all') // Default to all staff tab
  }

  // Handle add service with multiple staff support
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

  // Handle add product with multiple staff support
  const handleAddProduct = () => {
    if (!productPrice || parseFloat(productPrice) <= 0) {
      toast.error('Please enter a valid price for the product')
      return
    }
    // If appointment staff is set, use it implicitly; otherwise require selection
    const effectiveStaffIds = (productStaffIds.length > 0
      ? productStaffIds
      : (appointmentDetails?.staffId ? [appointmentDetails.staffId] : []))
    if (effectiveStaffIds.length === 0) {
      toast.error('Please select a staff member (or set appointment staff)')
      return
    }
    
    const price = parseFloat(productPrice)
  const staffNames = effectiveStaffIds.map(id => getStaffName(id))
  const pricePerStaff = calculatePriceDistribution(price, effectiveStaffIds.length)
    
    // Create price distribution for each staff member
    const priceDistribution = effectiveStaffIds.map((staffId, index) => ({
      staffId,
      staffName: getStaffName(staffId),
      amount: pricePerStaff[index]
    }))
    
    // Add product as a service to additional services
    const newProduct = {
      id: `product-${Date.now()}`, // Generate unique ID for product
      name: productName || 'Product',
      price: price,
      duration: 0, // Products don't have duration
      staffIds: effectiveStaffIds,
      staffNames: staffNames,
      priceDistribution: priceDistribution
    }
    
    setAdditionalServices(prev => [...prev, newProduct])
    
    console.log('Adding product:', productName, 'with staff:', staffNames.join(', '), 'price:', price)
  toast.success(`${productName || 'Product'} added with ${effectiveStaffIds.length} staff member${effectiveStaffIds.length > 1 ? 's' : ''}`)
    
    // Reset states and close sheet
    setProductName('Product')
    setProductPrice('')
    setProductStaffIds([])
    setAddProductSheetOpen(false)
  }

  // Remove service
  const removeService = (index: number) => {
    setSelectedServices(prev => prev.filter((_, i) => i !== index))
    toast.success('Service removed')
  }

  // Calculate staff tip distribution with multiple staff support
  const getStaffTipDistribution = (): TipDistribution[] => {
    if (getEffectiveTipAmount() <= 0) return []
    
    const allServices = [
      ...selectedServices.map(item => ({
          staffId: item.staff.ghl_id,
        staffName: item.staff.name,
        servicePrice: item.service.price
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
        staffName: staff.staffName,
        sharePercentage,
        tipShare,
        totalEarning,
        totalServicePrice: staff.totalServicePrice
      }
    }).sort((a, b) => b.totalServicePrice - a.totalServicePrice)
  }

  // Format duration
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
    }
    return `${mins}m`
  }

  // Price editing functions
  const handleEditPrice = (type: 'appointment' | 'additional', index: number) => {
    setEditingService({ type, index })
    if (type === 'appointment') {
      setEditPrice(selectedServices[index].service.price.toString())
    } else if (type === 'additional') {
      setEditPrice(additionalServices[index].price.toString())
    }
    setIsEditDialogOpen(true)
  }

  const handleSavePrice = () => {
    if (!editingService) return

    const newPrice = parseFloat(editPrice)
    if (isNaN(newPrice) || newPrice < 0) {
      toast.error('Please enter a valid price')
      return
    }

    if (editingService.type === 'appointment') {
      // Update appointment service price
      const updatedServices = [...selectedServices]
      updatedServices[editingService.index] = {
        ...updatedServices[editingService.index],
        service: {
          ...updatedServices[editingService.index].service,
          price: newPrice
        }
      }
      setSelectedServices(updatedServices)
      toast.success(`Price updated to ${formatCurrency(newPrice)}`)
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
        
        toast.success(`Price updated to ${formatCurrency(newPrice)} and redistributed among ${serviceToUpdate.priceDistribution.length} staff`)
      } else {
        // Single staff service - simple price update
        updatedAdditionalServices[editingService.index] = {
          ...serviceToUpdate,
          price: newPrice
        }
        
        toast.success(`Price updated to ${formatCurrency(newPrice)}`)
      }
      
      setAdditionalServices(updatedAdditionalServices)
    }

    setIsEditDialogOpen(false)
    setEditingService(null)
    setEditPrice('')
  }

  // Formatters
  const formatCurrency = (amount: number, currency = 'CAD') => new Intl.NumberFormat('en-CA', { style: 'currency', currency: currency.replace('CA$', 'CAD').replace('US$', 'USD') }).format(amount || 0)

  // Handle new customer creation (same as customer page)
  const handleCreateNewCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    const firstName = newCustomerForm.firstName.trim()
    const lastName = newCustomerForm.lastName.trim()
    const phone = newCustomerForm.phone.trim()
    const name = [firstName, lastName].filter(Boolean).join(" ")
    
    if (!firstName) {
      toast.error("First name is required")
      return
    }

    setNewCustomerLoading(true)
    toast.loading("Creating customer…", { id: "add-contact" })
    
    try {
      const payload = {
        firstName,
        lastName,
        name,
        phone,
        optionalFields: {
          tags: ["customer"],
        },
      }

      const res = await fetch("https://restyle-backend.netlify.app/.netlify/functions/addContact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      
      if (!res.ok) throw new Error("Failed to create contact")
      
      const json = await res.json().catch(() => null)
      const raw = (json && (json.contact || json.data || json.result || json)) || null
      const server = raw && (raw.contact ? raw.contact : raw)
      
      const newCustomer: Customer = {
        id: String(server?.id ?? server?.contactId ?? server?._id ?? server?.uuid ?? Date.now()),
        fullName: name,
        firstName,
        lastName,
        phone,
        email: server?.email || '',
        dateAdded: server?.dateAdded || new Date().toISOString(),
      }
      
      // Add to customers list and select
      setCustomers(prev => [newCustomer, ...prev])
      setSelectedCustomer(newCustomer)
      setShowSuggestions(false)
      
      // Reset form and close dialog
      setNewCustomerForm({ firstName: '', lastName: '', phone: '' })
      setNewCustomerDialogOpen(false)
      
      toast.success("Customer created and selected", { id: "add-contact" })
    } catch (error) {
      console.error('Error creating customer:', error)
      toast.error("Failed to create customer", { id: "add-contact" })
    } finally {
      setNewCustomerLoading(false)
    }
  }

  // Handle guest checkout setup
  const handleGuestCheckout = (e: React.FormEvent) => {
    e.preventDefault()
    const name = guestForm.name.trim()
    const phone = guestForm.phone.trim()
    
    if (!name) {
      toast.error("Guest name is required")
      return
    }

    // Create temporary guest customer object for UI consistency
    const guestCustomer: Customer = {
      id: 'guest-' + Date.now(),
      fullName: name,
      firstName: name.split(' ')[0] || name,
      lastName: name.split(' ').slice(1).join(' ') || '',
      phone,
      email: '',
      dateAdded: new Date().toISOString(),
    }
    
    setSelectedCustomer(guestCustomer)
    setIsGuestCheckout(true)
    setShowSuggestions(false)
    setGuestDialogOpen(false)
    
    toast.success(`Guest checkout set up for ${name}`)
  }

  // Process walk-in checkout
  const processWalkIn = async () => {
    // Use default guest customer if none selected (calendar + payments)
    const effectiveCustomer = selectedCustomer || {
      id: null,
      fullName: 'Guest',
      firstName: 'Guest',
      lastName: '',
      phone: '5879681213', // requested default guest phone
      email: null
    }
    
    // Set guest checkout flag if no customer was selected
    const effectiveIsGuestCheckout = !selectedCustomer || isGuestCheckout

    if (selectedServices.length === 0 && additionalServices.length === 0) {
      toast.error('Please add at least one service')
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

    setProcessingCheckout(true)
    try {
      const transactionId = crypto.randomUUID()
      
      // Use consistent subtotal calculation
      const subtotal = getCurrentSubtotal()
      const gst = getCurrentGST()
      const tip = getEffectiveTipAmount()
      const totalPaid = subtotal + gst + tip

      const baseItems = selectedServices.map((item) => ({
          id: crypto.randomUUID(),
          serviceId: item.service.id,
          serviceName: item.service.name,
          price: item.service.price,
          staffName: item.staff.name,
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

      const distribution = getStaffTipDistribution()
      const itemsWithTip = items.map((it) => {
        const share = distribution.find((d) => d.staffName === it.staffName)
        return {
          ...it,
          staffTipSplit: share ? Number(share.sharePercentage.toFixed(2)) : null,
          staffTipCollected: share ? Number(share.tipShare.toFixed(2)) : null,
        }
      })

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
          serviceAcuityIds: items
            .map((i) => i.serviceId)
            .filter((v) => Boolean(v))
            .join(', ') || null,
          bookingServiceLookup: items
            .map((i) => i.serviceId)
            .filter((v) => Boolean(v))
            .join(', ') || null,
          bookingBookedRate: totalPaid,
          bookingCustomerPhone: effectiveCustomer.phone || null,
          bookingType: effectiveIsGuestCheckout ? 'Walk-in Guest' : 'Walk-in',
          customerLookup: effectiveIsGuestCheckout ? null : effectiveCustomer.id,
          customerPhone: effectiveCustomer.phone || null,
          paymentStaff: items.map((i) => i.staffName).filter((name) => Boolean(name)).join(', ') || null,
          status: 'Paid',
          // Guest-specific fields
          guestCustomerName: effectiveIsGuestCheckout ? effectiveCustomer.fullName : null,
          guestCustomerPhone: effectiveIsGuestCheckout ? effectiveCustomer.phone : null,
          isGuestCheckout: effectiveIsGuestCheckout,
        },
        items: itemsWithTip.map((i) => ({ ...i, paymentId: transactionId })),
        meta: {
          customerFirstName: effectiveCustomer.firstName,
          customerName: effectiveCustomer.fullName,
          isGuestCheckout: effectiveIsGuestCheckout,
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

      // Create a booking row using the appointment details (no slot fetch)
      try {
        if (appointmentDetails?.date && appointmentDetails.time) {
          // Helpers to convert Denver wall time to UTC ISO (copy of calendar logic)
          const getTimeZoneOffsetInMs = (timeZone: string, date: Date) => {
            const parts = new Intl.DateTimeFormat('en-US', {
              timeZone,
              year: 'numeric', month: '2-digit', day: '2-digit',
              hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
            }).formatToParts(date)
            const map = Object.fromEntries(parts.map(p => [p.type, p.value])) as Record<string, string>
            const tzDate = new Date(`${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}Z`)
            return tzDate.getTime() - date.getTime()
          }
          const denverWallTimeToUtcIso = (year: number, month: number, day: number, hour: number, minute: number) => {
            const baseUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0))
            const offset = getTimeZoneOffsetInMs('America/Denver', baseUtc)
            return new Date(baseUtc.getTime() - offset).toISOString()
          }

          const [y, m, d] = appointmentDetails.date.split('-').map(n => parseInt(n, 10))
          const startMins = hhmmToMinutes(appointmentDetails.time)
          const sh = Math.floor(startMins / 60)
          const sm = startMins % 60
          const start_time = denverWallTimeToUtcIso(y, m, d, sh, sm)

          // Calculate duration from selected services (fallback to 30 if none)
          const serviceDurationTotal =
            selectedServices.reduce((sum, item) => sum + (item.service.duration || 0), 0) +
            additionalServices.reduce((sum, s) => sum + (s.duration || 0), 0)

          const booking_duration = Math.max(0, serviceDurationTotal || 30) // minutes

          // Compute end time by adding duration minutes to start wall-time
          const endTotalMinutes = startMins + booking_duration
          const eh = Math.floor(endTotalMinutes / 60)
          const em = endTotalMinutes % 60
          const end_time = denverWallTimeToUtcIso(y, m, d, eh, em)

          // Build descriptive fields from the walk-in payload
          const allServiceNames = [
            ...selectedServices.map(s => s.service.name),
            ...additionalServices.map(s => s.name),
          ].filter(Boolean)
          const service_name = allServiceNames.length > 0 ? allServiceNames.join(', ') : 'Walk-in'
          // Resolve effective staff id and name with robust fallbacks
          const fallbackStaffFromServices = selectedServices[0]?.staff?.ghl_id || additionalServices[0]?.staffIds?.[0]
          const effectiveStaffId = appointmentDetails.staffId || fallbackStaffFromServices || undefined
          const assigned_barber_name = effectiveStaffId ? getStaffName(effectiveStaffId) : ''
          const booking_price = subtotal
          const customer_name_ = (selectedCustomer?.fullName || (effectiveIsGuestCheckout ? effectiveCustomer.fullName : '')) || 'Walk-in Customer'

          const payment_method = isSplitPayment ? 'split_payment' : (isServiceSplit ? 'service_split' : selectedPaymentMethod)
          const payment_date = new Date().toISOString()

          // Optional identifiers: prefer a valid calendar/service id if we have one
          const assigned_user_id = effectiveStaffId || undefined
          const primaryServiceId = (selectedServices[0]?.service?.id) || (additionalServices.find(s => (s.id && !String(s.id).startsWith('product-')))?.id)
          const calendar_id = primaryServiceId || undefined
          const contact_id = effectiveIsGuestCheckout ? undefined : (selectedCustomer?.id || undefined)

          const createRes = await fetch('/api/bookings/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              start_time,
              end_time,
              booking_duration,
              service_name,
              title: service_name || 'Walk-in',
              booking_price,
              customer_name_,
              assigned_barber_name,
              payment_status: 'paid',
              appointment_status: 'confirmed',
              assigned_user_id,
              calendar_id,
              contact_id,
            }),
          })
          if (!createRes.ok) {
            let errMsg = ''
            try {
              const maybeJson = await createRes.json()
              errMsg = maybeJson?.error || maybeJson?.message || ''
            } catch {
              const errText = await createRes.text().catch(() => '')
              errMsg = errText
            }
            console.warn('Failed to create walk-in booking record:', errMsg || createRes.statusText)
            toast.error(`Saved payment, but adding to calendar failed${errMsg ? `: ${errMsg}` : ''}`)
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : ''
        console.warn('Walk-in calendar booking creation skipped/failed:', e)
        toast.error(`Saved payment, but adding to calendar failed${msg ? `: ${msg}` : ''}`)
      }

      // Redirect to success page (same as checkout page)
      window.location.href = `/checkout/success?id=${transactionId}`
      
    } catch (error) {
      console.error('Error processing walk-in:', error)
      toast.error('Failed to process walk-in')
      
      // Redirect to cancel page on error (same as checkout page)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      window.location.href = `/checkout/cancel?reason=${encodeURIComponent(errorMessage)}&type=walk-in`
    } finally {
      setProcessingCheckout(false)
    }
  }

  // Initialize data
  useEffect(() => {
    fetchGroups()
    fetchStaffData()
  }, [])

  // Parse calendar prefill from query string if present
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const prefill = params.get('prefill')
      if (prefill === 'calendar') {
        const date = params.get('date') || ''
        const startMinutes = params.get('startMinutes')
        const endMinutes = params.get('endMinutes')
        const staffId = params.get('staffId') || undefined
        const staffName = params.get('staffName') || undefined
        if (date) {
          setCalendarPrefill({
            date,
            startMinutes: startMinutes ? Number(startMinutes) : undefined,
            endMinutes: endMinutes ? Number(endMinutes) : undefined,
            staffId,
            staffName,
          })
          setAppointmentDetails({
            date,
            time: minutesToHHMM(startMinutes ? Number(startMinutes) : 0),
            staffId,
          })
        }
      }
    } catch {}
  }, [])

  useEffect(() => { // fetch services when groups are loaded
    if (groups.length > 0) {
      void fetchAllServices()
    }
  }, [groups])

  // Handle customer search
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
          <header className="flex h-14 items-center border-b bg-white/60 backdrop-blur px-4">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mx-2 h-4" />
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-[#7b1d1d]" />
                <h1 className="text-[15px] font-semibold tracking-tight">Walk-in Checkout</h1>
                </div>
              </div>
            <div className="ml-auto">
              <Button variant="outline" onClick={() => router.push('/dashboard')} className="rounded-lg">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-6 p-6 bg-neutral-50">
            {/* Appointment Details (prefilled when launched from Calendar) */}
            <div className="mx-auto w-full max-w-6xl rounded-2xl border border-neutral-200 bg-white px-6 py-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[13px] font-medium text-neutral-500">Appointment Details</p>
                  <h2 className="mt-1 text-[18px] font-semibold leading-tight text-neutral-900">
                    {appointmentDetails ? 'Set staff and time for this walk-in' : 'Select staff and time'}
                  </h2>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Date (readable) */}
                <div>
                  <Label className="text-[13px]">Date</Label>
                  <Input
                    type="date"
                    value={appointmentDetails?.date || ''}
                    onChange={(e) => setAppointmentDetails(prev => ({
                      ...(prev || { date: e.target.value, time: '09:00' }),
                      date: e.target.value,
                    }))}
                    className="rounded-xl"
                  />
                </div>
                {/* Time (editable) */}
                <div>
                  <Label className="text-[13px]">Start Time</Label>
                  <Input
                    type="time"
                    value={appointmentDetails?.time || ''}
                    onChange={(e) => setAppointmentDetails(prev => ({
                      ...(prev || { date: new Date().toISOString().slice(0,10), time: e.target.value }),
                      time: e.target.value,
                    }))}
                    className="rounded-xl"
                  />
                </div>
                {/* Staff */}
                <div>
                  <Label className="text-[13px]">Staff</Label>
                  <Select
                    value={appointmentDetails?.staffId || ''}
                    onValueChange={(v) => setAppointmentDetails(prev => ({
                      ...(prev || { date: new Date().toISOString().slice(0,10), time: '09:00' }),
                      staffId: v,
                    }))}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Select staff" />
                    </SelectTrigger>
                    <SelectContent>
                      {staffData.map(s => (
                        <SelectItem key={s.ghl_id} value={s.ghl_id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {calendarPrefill && (
                <div className="mt-3 text-xs text-neutral-500">
                  Prefilled from calendar selection. You can adjust time or staff here.
                </div>
              )}
            </div>

            {/* HERO CARD — Customer Selection */}
            <div className="mx-auto w-full max-w-6xl rounded-2xl border border-neutral-200 bg-white px-6 py-5">
              <p className="text-[13px] font-medium text-neutral-500">Walk-in Customer</p>
              <h2 className="mt-1 text-[28px] font-semibold leading-tight text-neutral-900">
                {selectedCustomer?.fullName || 'Select Customer'}
              </h2>
              {selectedCustomer && (
                <p className="mt-1 text-[14px] text-neutral-600">
                  {selectedCustomer.email} {selectedCustomer.phone && `• ${selectedCustomer.phone}`}
                </p>
              )}
              
              {/* Enhanced Customer Search */}
              <div className="mt-5 rounded-xl border border-neutral-200 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Search className="h-4 w-4 text-neutral-400" />
                  <div>
                      <div className="text-[14px] font-semibold uppercase tracking-wide">Customer Search</div>
                      <div className="mt-0.5 text-[12px] text-neutral-600">
                        Search by name, email, phone number, or the last 4 digits of a phone
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setGuestDialogOpen(true)}
                      className="rounded-lg border-neutral-300 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-all"
                    >
                      <User className="h-4 w-4 mr-2" />
                      Guest Checkout
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setNewCustomerDialogOpen(true)}
                      className="rounded-lg border-[#7b1d1d] text-[#7b1d1d] hover:bg-[#7b1d1d] hover:text-white transition-all"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      New Customer
                    </Button>
                  </div>
                </div>
                
                <div className="mt-4 space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <Input
                      placeholder="Search customers..."
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value)
                        if (e.target.value.trim() && !showSuggestions) {
                          setShowSuggestions(true)
                        }
                      }}
                      className="pl-10 rounded-xl border-neutral-200 focus:border-[#7b1d1d] focus:ring-[#7b1d1d]"
                    />
                  </div>
                  
                  {/* Selected Customer Display (when suggestions are hidden) */}
                  {selectedCustomer && !showSuggestions && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-neutral-700">Selected Customer</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowSuggestions(true)}
                          className="rounded-lg border-neutral-300 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-all"
                        >
                          <Search className="h-4 w-4 mr-2" />
                          Show Suggestions
                        </Button>
                      </div>
                      
                      <div className="p-4 rounded-xl border-2 border-[#7b1d1d] bg-gradient-to-r from-[#7b1d1d]/8 to-[#7b1d1d]/4 shadow-sm">
                        <div className="flex items-center gap-4">
                          {/* Selected Customer Avatar */}
                          <div className="w-12 h-12 rounded-xl bg-[#7b1d1d] flex items-center justify-center font-semibold text-white shadow-lg">
                            {(selectedCustomer.firstName?.[0] || '') + (selectedCustomer.lastName?.[0] || '') || selectedCustomer.fullName?.[0]?.toUpperCase() || 'C'}
                          </div>
                          
                          {/* Selected Customer Info */}
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-lg text-[#7b1d1d]">
                              {selectedCustomer.fullName}
                            </div>
                            
                            <div className="flex flex-col gap-1.5 mt-2">
                              {selectedCustomer.email && (
                                <div className="flex items-center gap-2 text-sm text-neutral-600">
                                  <div className="p-1 rounded-md bg-[#7b1d1d]/10">
                                    <Mail className="h-3.5 w-3.5 text-[#7b1d1d]" />
                                  </div>
                                  <span className="font-medium">{selectedCustomer.email}</span>
                                </div>
                              )}
                              
                              {selectedCustomer.phone && (
                                <div className="flex items-center gap-2 text-sm text-neutral-600">
                                  <div className="p-1 rounded-md bg-[#7b1d1d]/10">
                                    <Phone className="h-3.5 w-3.5 text-[#7b1d1d]" />
                                  </div>
                                  <span className="font-medium">{selectedCustomer.phone}</span>
                                </div>
                              )}
                              
                              {!selectedCustomer.email && !selectedCustomer.phone && (
                                <div className="flex items-center gap-2 text-sm text-neutral-500">
                                  <div className="p-1 rounded-md bg-neutral-100">
                                    <UserIcon className="h-3.5 w-3.5 text-neutral-400" />
                                  </div>
                                  <span className="italic">No contact information</span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Selection Badge */}
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shadow-lg">
                              <CheckCircle2 className="h-5 w-5 text-white" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Loading State */}
                  {loadingCustomers && showSuggestions && (
                    <div className="flex flex-col items-center justify-center py-12 px-4">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full border-4 border-neutral-200 border-t-[#7b1d1d] animate-spin"></div>
                        <div className="absolute inset-0 w-12 h-12 rounded-full border-4 border-transparent border-t-[#7b1d1d]/30 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                      </div>
                      <div className="mt-4 text-center">
                        <p className="text-base font-medium text-neutral-700">Searching customers</p>
                        <p className="text-sm text-neutral-500 mt-1">Please wait while we find matching customers...</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Customer Results (when showing suggestions) */}
                  {customers.length > 0 && !loadingCustomers && showSuggestions && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium text-neutral-700">
                          {customers.length} customer{customers.length !== 1 ? 's' : ''} found
                        </p>
                        {customers.length > 5 && (
                          <p className="text-xs text-neutral-500">Scroll to see more</p>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-neutral-300 scrollbar-track-transparent">
                        {customers.map((customer, index) => {
                          const isSelected = selectedCustomer?.id === customer.id
                          const initials = (customer.firstName?.[0] || '') + (customer.lastName?.[0] || '') || customer.fullName?.[0]?.toUpperCase() || 'C'
                          
                          return (
                        <div
                          key={customer.id}
                          onClick={() => {
                            setSelectedCustomer(customer)
                            setShowSuggestions(false)
                          }}
                              className={`group relative p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                                isSelected
                                  ? 'bg-[#7b1d1d]/5 border border-[#7b1d1d] shadow-sm'
                                  : 'bg-white border border-neutral-200 hover:border-[#7b1d1d]/30 hover:shadow-md'
                              }`}
                              style={{
                                animationDelay: `${index * 50}ms`,
                                animation: 'fadeInUp 0.4s ease-out forwards'
                              }}
                            >
                              {/* Selection Indicator */}
                              {isSelected && (
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#7b1d1d] rounded-full flex items-center justify-center shadow-sm">
                                  <CheckCircle2 className="h-3 w-3 text-white" />
                                </div>
                              )}
                              
                              <div className="flex items-center gap-3">
                                {/* Cleaner Avatar */}
                                <div className="relative">
                                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-medium text-sm transition-all duration-200 ${
                                    isSelected
                                      ? 'bg-[#7b1d1d] text-white'
                                      : 'bg-neutral-200 text-neutral-600 group-hover:bg-[#7b1d1d] group-hover:text-white'
                                  }`}>
                                    {initials}
                                  </div>
                                </div>
                                
                                {/* Customer Info */}
                                <div className="flex-1 min-w-0">
                                  <div className={`font-medium text-sm transition-colors duration-200 ${
                                    isSelected
                                      ? 'text-[#7b1d1d]'
                                      : 'text-neutral-700 group-hover:text-[#7b1d1d]'
                                  }`}>
                                    {customer.fullName}
                                  </div>
                                  
                                  {/* Contact Details */}
                                  <div className="flex flex-col gap-1 mt-1">
                                    {customer.email && (
                                      <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                                        <Mail className="h-3 w-3 flex-shrink-0" />
                                        <span className="truncate">{customer.email}</span>
                                      </div>
                                    )}
                                    
                                    {customer.phone && (
                                      <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                                        <Phone className="h-3 w-3 flex-shrink-0" />
                                        <span className="truncate">{customer.phone}</span>
                                      </div>
                                    )}
                                    
                                    {!customer.email && !customer.phone && (
                                      <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                                        <UserIcon className="h-3 w-3 flex-shrink-0" />
                                        <span className="italic">No contact info</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Enhanced Empty State */}
                  {customerSearch && customers.length === 0 && !loadingCustomers && showSuggestions && (
                    <div className="text-center py-12 px-4">
                      <div className="relative mb-6">
                        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-neutral-100 to-neutral-200 mx-auto flex items-center justify-center shadow-inner">
                          <Search className="h-10 w-10 text-neutral-400" />
                        </div>
                        <div className="absolute -top-2 -right-2 w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                          <AlertCircle className="h-5 w-5 text-amber-600" />
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <h3 className="text-xl font-bold text-neutral-800">No customers found</h3>
                        <p className="text-neutral-600 max-w-sm mx-auto leading-relaxed">
                          We couldn&apos;t find any customers matching <span className="font-semibold text-neutral-800">&quot;{customerSearch}&quot;</span>
                        </p>
                        
                        <div className="pt-4 space-y-3">
                          <p className="text-sm font-medium text-neutral-700">What would you like to do?</p>
                          <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setNewCustomerDialogOpen(true)}
                              className="rounded-xl border-[#7b1d1d] text-[#7b1d1d] hover:bg-[#7b1d1d] hover:text-white transition-all"
                            >
                              <UserPlus className="h-4 w-4 mr-2" />
                              Create New Customer
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setGuestDialogOpen(true)}
                              className="rounded-xl border-neutral-300 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-all"
                            >
                              <User className="h-4 w-4 mr-2" />
                              Continue as Guest
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mx-auto grid w-full max-w-6xl gap-6 md:grid-cols-1">
              <div className="space-y-6">

                {/* Services Card */}
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
                      <div className="flex gap-2">
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
                                                          {formatDuration(serviceDuration)}
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
                                        <p className="text-sm text-neutral-600">Select staff members for {selectedService?.name}</p>
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
                                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold mb-2">No service categories found</h3>
                                <p className="text-neutral-500">Unable to load service categories.</p>
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                      
                      <Sheet open={addProductSheetOpen} onOpenChange={setAddProductSheetOpen}>
                        <SheetTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="rounded-lg border-[#7b1d1d] text-[#7b1d1d] hover:bg-[#7b1d1d] hover:text-white transition-all"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Product
                          </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="w-[600px] sm:w-[700px] overflow-y-auto p-0">
                          <div className="h-full flex flex-col">
                            <SheetHeader className="px-8 pt-8 pb-6 border-b border-neutral-200 bg-gradient-to-r from-[#7b1d1d]/5 to-[#7b1d1d]/10">
                              <SheetTitle className="text-3xl font-bold text-[#7b1d1d] flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-[#7b1d1d]/10">
                                  <Plus className="h-6 w-6 text-[#7b1d1d]" />
                                </div>
                                Add Product
                              </SheetTitle>
                              <SheetDescription className="text-base text-neutral-600 mt-2">
                                Add a product to this transaction with optional name, price, and staff assignment.
                              </SheetDescription>
                            </SheetHeader>
                            
                            <div className="flex-1 overflow-y-auto px-8 py-6">
                              <div className="space-y-8">
                              {/* Product Name */}
                              <div className="space-y-3">
                                <Label htmlFor="productName" className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-[#7b1d1d]" />
                                  Product Name (Optional)
                                </Label>
                                <Input
                                  id="productName"
                                  value={productName}
                                  onChange={(e) => setProductName(e.target.value || 'Product')}
                                  placeholder="e.g., Hair Gel, Pomade, Shampoo..."
                                  className="rounded-xl h-12 text-base border-2 border-neutral-200 focus:border-[#7b1d1d] transition-colors"
                                />
                                <p className="text-sm text-neutral-500 flex items-center gap-2">
                                  <span className="text-[#7b1d1d]">💡</span>
                                  Leave empty to use default name &quot;Product&quot;
                                </p>
                              </div>
                              
                              {/* Product Price */}
                              <div className="space-y-3">
                                <Label htmlFor="productPrice" className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-[#7b1d1d]" />
                                  Price <span className="text-red-500">*</span>
                                </Label>
                                <div className="relative">
                                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600 font-semibold text-base">CA$</span>
                                  <Input
                                    id="productPrice"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={productPrice}
                                    onChange={(e) => setProductPrice(e.target.value)}
                                    placeholder="0.00"
                                    className="rounded-xl h-12 text-base pl-14 pr-4 border-2 border-neutral-200 focus:border-[#7b1d1d] transition-colors font-medium"
                                  />
                                </div>
                              </div>
                            
                              {/* Staff Selection */}
                              <div className="space-y-4">
                                <Label className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-[#7b1d1d]" />
                                  Select Staff Members <span className="text-red-500">*</span>
                                </Label>
                                <Tabs value={productStaffTab} onValueChange={(v) => setProductStaffTab(v as 'all' | 'available')} className="w-full">
                                  <TabsList className="grid w-full grid-cols-2 h-11 bg-neutral-100 p-1 rounded-xl">
                                    <TabsTrigger value="all" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">All Staff</TabsTrigger>
                                    <TabsTrigger value="available" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Available</TabsTrigger>
                                  </TabsList>
                                </Tabs>
                                
                                {productStaffIds.length > 0 && (
                                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#7b1d1d]/10 border border-[#7b1d1d]/20">
                                    <CheckCircle2 className="h-4 w-4 text-[#7b1d1d]" />
                                    <span className="text-sm font-medium text-[#7b1d1d]">
                                      {productStaffIds.length} staff member{productStaffIds.length > 1 ? 's' : ''} selected
                                    </span>
                                  </div>
                                )}
                                
                                {staffData.length === 0 ? (
                                  <div className="flex items-center justify-center py-12 rounded-xl border-2 border-dashed border-neutral-200">
                                    <div className="text-center">
                                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-[#7b1d1d]" />
                                      <span className="text-sm text-neutral-600">Loading staff data...</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-3 gap-3">
                                    {staffData.map((staff) => (
                                      <button
                                        key={staff.ghl_id}
                                        onClick={() => {
                                          if (productStaffIds.includes(staff.ghl_id)) {
                                            setProductStaffIds(prev => prev.filter(id => id !== staff.ghl_id))
                                          } else {
                                            setProductStaffIds(prev => [...prev, staff.ghl_id])
                                          }
                                        }}
                                        className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all relative hover:scale-105 ${
                                          productStaffIds.includes(staff.ghl_id)
                                            ? 'border-[#7b1d1d] bg-gradient-to-br from-[#7b1d1d]/10 to-[#7b1d1d]/5 shadow-md'
                                            : 'border-neutral-200 bg-white hover:border-[#7b1d1d]/40 hover:shadow-sm'
                                        }`}
                                      >
                                        {productStaffIds.includes(staff.ghl_id) && (
                                          <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-br from-[#7b1d1d] to-[#a02929] rounded-full flex items-center justify-center shadow-lg">
                                            <CheckCircle2 className="h-4 w-4 text-white" />
                                          </div>
                                        )}
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md ${
                                          productStaffIds.includes(staff.ghl_id) 
                                            ? 'bg-gradient-to-br from-[#7b1d1d] to-[#a02929]' 
                                            : 'bg-gradient-to-br from-neutral-400 to-neutral-500'
                                        }`}>
                                          {staff.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                        </div>
                                        <p className="text-xs font-semibold text-center leading-tight">{staff.name}</p>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                              </div>
                            </div>
                            
                            {/* Action Buttons - Fixed position at bottom */}
                            <div className="border-t border-neutral-200 px-8 py-6 bg-neutral-50">
                              <div className="flex gap-4">
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setProductName('Product')
                                    setProductPrice('')
                                    setProductStaffIds([])
                                    setAddProductSheetOpen(false)
                                  }}
                                  className="flex-1 rounded-xl h-12 text-base border-2 hover:bg-neutral-100"
                                >
                                  Cancel
                                </Button>
                                <Button 
                                  onClick={handleAddProduct}
                                  disabled={!productPrice || parseFloat(productPrice) <= 0 || productStaffIds.length === 0}
                                  className="flex-1 rounded-xl h-12 text-base bg-gradient-to-r from-[#7b1d1d] to-[#a02929] hover:from-[#6b1717] hover:to-[#8f2424] text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <Plus className="h-5 w-5 mr-2" />
                                  Add Product {productStaffIds.length > 0 && `(${productStaffIds.length} staff)`}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </SheetContent>
                      </Sheet>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Service Items */}
                    <div className="overflow-hidden rounded-xl border border-neutral-200">
                      <div className="divide-y">
                        {selectedServices.map((item, index) => (
                          <div key={item.id} className="flex items-center justify-between px-4 py-3">
                            <div>
                              <div className="text-[14px] font-medium text-neutral-900">{item.service.name}</div>
                              <div className="text-[12px] text-neutral-500">{formatDuration(item.service.duration)} • {item.staff.name}</div>
                              </div>
                            <div className="flex items-center gap-2">
                              <div className="text-[14px] font-medium text-neutral-900">{formatCurrency(item.service.price)}</div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditPrice('appointment', index)}
                                className="h-6 w-6 p-0 hover:bg-neutral-100"
                              >
                                <Edit3 className="h-3 w-3 text-neutral-500" />
                              </Button>
                              <Button
                                variant="ghost"
                              size="sm"
                              onClick={() => removeService(index)}
                                className="h-6 w-6 p-0 hover:bg-red-50 text-red-600"
                            >
                                <X className="h-3 w-3" />
                            </Button>
                            </div>
                          </div>
                        ))}
                        {additionalServices.map((service, index) => (
                          <div key={`additional-${index}`} className="flex items-center justify-between px-4 py-3">
                            <div>
                              <div className="text-[14px] font-medium text-neutral-900">{service.name}</div>
                              <div className="text-[12px] text-neutral-500">{formatDuration(service.duration)} • {service.staffNames?.join(', ') || 'Multiple staff'}</div>
                      </div>
                            <div className="flex items-center gap-2">
                              <div className="text-[14px] font-medium text-neutral-900">{formatCurrency(service.price)}</div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditPrice('additional', index)}
                                className="h-6 w-6 p-0 hover:bg-neutral-100"
                              >
                                <Edit3 className="h-3 w-3 text-neutral-500" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setAdditionalServices(prev => prev.filter((_, i) => i !== index))}
                                className="h-6 w-6 p-0 hover:bg-red-50 text-red-600"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        {selectedServices.length === 0 && additionalServices.length === 0 && (
                      <div className="text-center py-8 text-neutral-500">
                        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No services added yet</p>
                        <p className="text-sm">Click &quot;Add Service&quot; to get started</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Totals */}
                    {(selectedServices.length > 0 || additionalServices.length > 0) && (
                      <div className="rounded-xl border border-neutral-200 p-4">
                        <Row label="Subtotal" value={formatCurrency(getCurrentSubtotal())} />
                        {getEffectiveTipAmount() > 0 && (
                          <Row label={`Tip (${useCustomTip ? 'Custom' : `${tipPercentage}%`})`} value={formatCurrency(getEffectiveTipAmount())} />
                        )}
                        <div className="h-px my-2 bg-neutral-200" />
                        <Row small label={`GST (5%)`} value={formatCurrency(getCurrentGST())} />
                        <div className="h-px my-2 bg-neutral-200" />
                        <Row strong label="Total Due" value={formatCurrency(getCurrentSubtotal() + getEffectiveTipAmount() + getCurrentGST())} />
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Staff Tip Distribution Card */}
                {(selectedServices.length > 0 || additionalServices.length > 0) && getEffectiveTipAmount() > 0 && (
                  <Card className="rounded-2xl border-neutral-200 shadow-none">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-[16px] font-semibold flex items-center gap-2">
                        <Users className="h-5 w-5 text-[#7b1d1d]" />
                        Staff Tip Distribution
                      </CardTitle>
                      <CardDescription className="text-[13px]">
                        How the {formatCurrency(getEffectiveTipAmount())} tip is distributed among staff
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
                                    {formatCurrency(staff.totalServicePrice)} services • {staff.sharePercentage.toFixed(1)}%
                        </div>
                        </div>
                              </div>
                              <div className="text-right">
                                <div className="text-[14px] font-semibold text-green-600">
                                  {formatCurrency(staff.tipShare)}
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
                                      {formatCurrency(service.price)}
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
                                      {formatCurrency(dist.amount)}
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
                {(selectedServices.length > 0 || additionalServices.length > 0) && (
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
                            
                            <div className="bg-white rounded-lg p-3 border border-neutral-200">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-neutral-600">Total Due:</span>
                                <span className="font-semibold text-neutral-900">
                                  {formatCurrency(getTotalAmount())}
                                </span>
                              </div>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-neutral-600">Split Total:</span>
                                <span className={`font-semibold ${
                                  Math.abs(getSplitPaymentTotal() - getTotalAmount()) < 0.01 
                                    ? 'text-green-600' 
                                    : 'text-red-600'
                                }`}>
                                  {formatCurrency(getSplitPaymentTotal())}
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
                                  {formatCurrency(getRemainingAmount())}
                                </span>
                              </div>
                            </div>
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
                )}

                {/* Complete Checkout Button */}
                {(selectedServices.length > 0 || additionalServices.length > 0) && (
                  <Card className="rounded-2xl border-neutral-200 shadow-none">
                    <CardContent className="pt-6">
                        <Button
                        size="lg"
                        className={`w-full rounded-2xl ${
                          isSplitPayment && Math.abs(getRemainingAmount()) > 0.01
                            ? 'bg-neutral-400 text-white cursor-not-allowed'
                            : 'bg-[#7b1d1d] text-white hover:bg-[#6b1717]'
                        }`}
                          onClick={processWalkIn}
                        disabled={processingCheckout || (isSplitPayment && Math.abs(getRemainingAmount()) > 0.01)}
                        >
                          {processingCheckout ? (
                            <>
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                              Processing...
                            </>
                        ) : isSplitPayment && Math.abs(getRemainingAmount()) > 0.01 ? (
                          <>
                            <AlertCircle className="h-5 w-5 mr-2" />
                            Split amounts must total {formatCurrency(getTotalAmount())}
                            </>
                          ) : (
                            <>
                            {isSplitPayment ? (
                              <Split className="h-5 w-5 mr-2" />
                            ) : (
                              <CreditCard className="h-5 w-5 mr-2" />
                            )}
                            Complete {isSplitPayment ? 'Split ' : ''}Payment
                            <span className="ml-2 font-bold">
                              {formatCurrency(getCurrentSubtotal() + getEffectiveTipAmount() + getCurrentGST())}
                            </span>
                            </>
                          )}
                        </Button>
                      <p className="text-[12px] text-center text-neutral-500 mt-3">
                        Walk-in transaction will be processed and saved to the system
                      </p>
                    </CardContent>
                  </Card>
                )}

              </div>
            </div>
          </div>

          {/* Price Edit Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Service Price</DialogTitle>
                <DialogDescription>
                  Update the price for {editingService?.type === 'appointment' 
                    ? selectedServices[editingService.index]?.service.name 
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
                {splitMode === 'payment' && (
                  <div className="space-y-4">
                    <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                      <h4 className="font-semibold text-neutral-900 mb-3">Payment Method Split</h4>
                      <p className="text-sm text-neutral-600 mb-4">
                        Divide the total amount across multiple payment methods. For example: $100 cash + $50 card.
                      </p>
                      
                      <div className="bg-white rounded-lg p-3 border border-neutral-200 mb-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-neutral-700">Total Amount:</span>
                          <span className="text-lg font-bold text-[#7b1d1d]">
                            {formatCurrency(getTotalAmount())}
                          </span>
                        </div>
                      </div>

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

                      <div className="mt-4 p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div className="text-center">
                            <div className="text-neutral-600">Total Due</div>
                            <div className="font-semibold text-neutral-900">
                              {formatCurrency(getTotalAmount())}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-neutral-600">Split Total</div>
                            <div className={`font-semibold ${
                              Math.abs(getSplitPaymentTotal() - getTotalAmount()) < 0.01 
                                ? 'text-green-600' 
                                : 'text-red-600'
                            }`}>
                              {formatCurrency(getSplitPaymentTotal())}
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
                              {formatCurrency(getRemainingAmount())}
                            </div>
                          </div>
                        </div>
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

          {/* New Customer Dialog */}
          <Dialog open={newCustomerDialogOpen} onOpenChange={setNewCustomerDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-[#7b1d1d]" />
                  Add New Customer
                </DialogTitle>
                <DialogDescription>
                  Create a new customer account that will be saved to your customer database.
                </DialogDescription>
              </DialogHeader>
              
              <form className="space-y-4" onSubmit={handleCreateNewCustomer}>
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-sm font-medium">
                    First Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    required
                    value={newCustomerForm.firstName}
                    onChange={(e) => setNewCustomerForm(prev => ({ ...prev, firstName: e.target.value }))}
                    className="rounded-lg border-neutral-200 focus:border-[#7b1d1d] focus:ring-[#7b1d1d]"
                    placeholder="Enter first name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-sm font-medium">
                    Last Name
                  </Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    value={newCustomerForm.lastName}
                    onChange={(e) => setNewCustomerForm(prev => ({ ...prev, lastName: e.target.value }))}
                    className="rounded-lg border-neutral-200 focus:border-[#7b1d1d] focus:ring-[#7b1d1d]"
                    placeholder="Enter last name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium">
                    Phone Number
                  </Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={newCustomerForm.phone}
                    onChange={(e) => setNewCustomerForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="rounded-lg border-neutral-200 focus:border-[#7b1d1d] focus:ring-[#7b1d1d]"
                    placeholder="Enter phone number"
                  />
                </div>
                
                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setNewCustomerDialogOpen(false)
                      setNewCustomerForm({ firstName: '', lastName: '', phone: '' })
                    }}
                    disabled={newCustomerLoading}
                    className="rounded-lg"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={newCustomerLoading}
                    className="rounded-lg bg-[#7b1d1d] hover:bg-[#6b1717] text-white"
                  >
                    {newCustomerLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Create Customer
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Guest Checkout Dialog */}
          <Dialog open={guestDialogOpen} onOpenChange={setGuestDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                  <User className="h-5 w-5 text-neutral-600" />
                  Guest Checkout
                </DialogTitle>
                <DialogDescription>
                  Process a one-time transaction without creating a customer account. Guest information will only be stored with this transaction.
                </DialogDescription>
              </DialogHeader>
              
              <form className="space-y-4" onSubmit={handleGuestCheckout}>
                <div className="space-y-2">
                  <Label htmlFor="guestName" className="text-sm font-medium">
                    Guest Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="guestName"
                    name="guestName"
                    required
                    value={guestForm.name}
                    onChange={(e) => setGuestForm(prev => ({ ...prev, name: e.target.value }))}
                    className="rounded-lg border-neutral-200 focus:border-neutral-400 focus:ring-neutral-400"
                    placeholder="Enter guest name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="guestPhone" className="text-sm font-medium">
                    Phone Number
                  </Label>
                  <Input
                    id="guestPhone"
                    name="guestPhone"
                    type="tel"
                    value={guestForm.phone}
                    onChange={(e) => setGuestForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="rounded-lg border-neutral-200 focus:border-neutral-400 focus:ring-neutral-400"
                    placeholder="Enter phone number (optional)"
                  />
                </div>
                
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-amber-800">
                      <p className="font-medium">Guest Checkout Notice</p>
                      <p className="mt-1">This information will only be stored with the transaction record and won&apos;t create a permanent customer account.</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setGuestDialogOpen(false)
                      setGuestForm({ name: '', phone: '' })
                    }}
                    className="rounded-lg"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="rounded-lg bg-neutral-600 hover:bg-neutral-700 text-white"
                  >
                    <User className="h-4 w-4 mr-2" />
                    Continue as Guest
                  </Button>
                </div>
              </form>
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