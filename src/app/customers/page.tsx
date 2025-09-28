"use client"
import * as React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { RoleGuard } from "@/components/role-guard"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, RefreshCw, X } from "lucide-react"
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table"
import { ArrowUpDown, Pencil, Trash2, Plus, Trash } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet"
import { Dialog as ConfirmDialog, DialogContent as ConfirmContent, DialogHeader as ConfirmHeader, DialogTitle as ConfirmTitle } from "@/components/ui/dialog"
import { toast } from "sonner"

type Contact = {
  id: string
  contactName: string
  firstName: string
  lastName: string
  phone: string | null
  dateAdded: string
}

type ContactBooking = {
  id: string
  serviceName: string
  startTime: string
  endTime: string
  status: string
  appointment_status: string
  assignedStaffFirstName?: string
  assignedStaffLastName?: string
  address: string
  createdAt: string
  updatedAt: string
}

type RawBooking = {
  id?: string | number
  calendar_id?: string
  contact_id?: string
  title?: string
  status?: string
  appointment_status?: string
  assigned_user_id?: string
  address?: string
  is_recurring?: boolean
  trace_id?: string
}

type RawContact = {
  id?: string | number
  contactName?: string
  firstName?: string
  lastName?: string
  phone?: string | null
  dateAdded?: string
}

function useContacts() {
  const [data, setData] = React.useState<Contact[]>([])
  const [loading, setLoading] = React.useState<boolean>(true)
  const [currentPage, setCurrentPage] = React.useState<number>(1)
  const [totalPages, setTotalPages] = React.useState<number>(1)
  const [total, setTotal] = React.useState<number>(0)
  const isInitialMount = React.useRef(true)
  const isMounted = React.useRef(false)

  React.useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  const fetchContacts = React.useCallback(async (page: number = 1) => {
    if (!isMounted.current) return
    setLoading(true)
    const controller = new AbortController()
    const { signal } = controller
    try {
      // Fetch all contacts for the current page without limit
      const res = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/getcontacts?page=${page}` , { signal })
      if (!res.ok) throw new Error("Failed to fetch contacts")
      const json = await res.json()
      const arr = (
        Array.isArray(json?.contacts)
          ? (json?.contacts as RawContact[])
          : ((json?.contacts?.contacts || []) as RawContact[])
      )
      const mapped: Contact[] = arr.map((c) => ({
        id: String(c.id ?? ""),
        contactName: c.contactName || `${c.firstName || ""} ${c.lastName || ""}`.trim(),
        firstName: c.firstName || "",
        lastName: c.lastName || "",
        phone: c.phone ?? null,
        dateAdded: c.dateAdded || new Date().toISOString(),
      }))
      if (isMounted.current) {
        setData(mapped)
        setTotal(json.total || 0)
        // Calculate total pages based on API response
        const pageSize = Math.max(1, mapped.length)
        setTotalPages(Math.max(1, Math.ceil((json.total || pageSize) / pageSize)))
      }
    } catch {
      // Error handling removed - could add logging here if needed
    } finally {
      if (isMounted.current) setLoading(false)
    }
    return () => controller.abort()
  }, [])

  React.useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      fetchContacts(1)
    } else {
      fetchContacts(currentPage)
    }
  }, [currentPage, fetchContacts])

  return { data, loading, setData, currentPage, setCurrentPage, totalPages, total, fetchContacts }
}

// Supabase sync removed per request

export default function Page() {
  const { data, loading, setData, currentPage, setCurrentPage, totalPages, total, fetchContacts } = useContacts()
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  const [openAdd, setOpenAdd] = React.useState(false)
  const [detailsOpen, setDetailsOpen] = React.useState(false)
  const [selected, setSelected] = React.useState<Contact | null>(null)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [formFirst, setFormFirst] = React.useState("")
  const [formLast, setFormLast] = React.useState("")
  const [formPhone, setFormPhone] = React.useState("")
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null)
  const [addLoading, setAddLoading] = React.useState(false)
  const [contactBookings, setContactBookings] = React.useState<ContactBooking[]>([])
  const [contactBookingsLoading, setContactBookingsLoading] = React.useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false)
  const [bookingCancelOpen, setBookingCancelOpen] = React.useState(false)
  const [bookingToCancel, setBookingToCancel] = React.useState<ContactBooking | null>(null)
  const [bookingCancelLoading, setBookingCancelLoading] = React.useState(false)
  
  // Search state
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [apiQuery, setApiQuery] = React.useState("")
  const [apiLoading, setApiLoading] = React.useState(false)
  
  // Add isMounted ref for the main component to prevent state updates on unmounted components
  const isMounted = React.useRef(false)
  
  React.useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  // Helper function to check if booking is within 2 hours
  const isBookingWithinTwoHours = (startTime?: string) => {
    if (!startTime) return false
    const start = new Date(startTime)
    const now = new Date()
    return start.getTime() <= now.getTime() + 2 * 60 * 60 * 1000
  }

  // Cancel booking function for customer bookings
  const handleCancelCustomerBooking = async (booking: ContactBooking) => {
    if (isBookingWithinTwoHours(booking.startTime)) {
      toast.error("Cannot cancel - booking starts within 2 hours")
      return
    }
    setBookingToCancel(booking)
    setBookingCancelOpen(true)
  }

  const confirmCancelCustomerBooking = async () => {
    if (!bookingToCancel) return
    
    setBookingCancelLoading(true)
    try {
      const res = await fetch("https://restyle-api.netlify.app/.netlify/functions/cancelbooking", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bookingId: bookingToCancel.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Cancel failed")
      
      // Refresh customer bookings
      if (selected) {
        await fetchContactBookings(selected.id)
      }
      toast.success("Appointment cancelled successfully")
      setBookingCancelOpen(false)
      setBookingToCancel(null)
    } catch (error) {
      console.error(error)
      toast.error(`Cancellation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setBookingCancelLoading(false)
    }
  }


  const openDetails = React.useCallback((contact: Contact) => {
    setSelected(contact)
    setDetailsOpen(true)
    fetchContactBookings(contact.id)
  }, [])

  const openEdit = React.useCallback((contact?: Contact) => {
    if (contact) {
      setEditingId(contact.id)
      setFormFirst(contact.firstName || "")
      setFormLast(contact.lastName || "")
      setFormPhone(contact.phone || "")
    } else {
      setEditingId(null)
      setFormFirst("")
      setFormLast("")
      setFormPhone("")
    }
    setOpenAdd(true)
  }, [])

  async function fetchContactBookings(contactId: string) {
    // Only set loading if still mounted (prevent state updates on unmounted components)
    if (isMounted.current) {
    setContactBookingsLoading(true)
    }
    
    const controller = new AbortController()
    const { signal } = controller
    
    try {
      // Fetch bookings for this contact using the bookings API endpoint
      const res = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/bookings?contactId=${encodeURIComponent(contactId)}`, { signal })
      if (!res.ok) throw new Error("Failed to fetch bookings")
      const json = await res.json()
      const bookings = (json?.bookings || []) as RawBooking[]
      
      // Helper function to delay execution with abort check
      const delay = (ms: number) => new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (signal.aborted) {
            reject(new Error('Aborted'))
          } else {
            resolve(undefined)
          }
        }, ms)
        
        if (signal.aborted) {
          clearTimeout(timeout)
          reject(new Error('Aborted'))
        }
      })
      
      // Process bookings in smaller batches to avoid overwhelming the server
      const enrichedBookings = []
      const batchSize = 5 // Smaller batch for customer page since it's usually fewer bookings
      
      for (let i = 0; i < bookings.length; i += batchSize) {
        // Check if aborted before processing each batch
        if (signal.aborted) {
          throw new Error('Aborted')
        }
        
        const batch = bookings.slice(i, i + batchSize)
        const batchResults = await Promise.all(
          batch.map(async (booking) => {
            // Check abort status before processing each booking
            if (signal.aborted) {
              throw new Error('Aborted')
            }

            const details: ContactBooking = {
              id: String(booking.id || ""),
              serviceName: booking.title || 'Untitled Service',
              startTime: "",
              endTime: "",
              status: booking.status || "",
              appointment_status: booking.appointment_status || "",
              address: booking.address || "",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }

            // Fetch appointment details for times (with abort check)
            if (!signal.aborted) {
              try {
                const apptRes = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/getBooking?id=${booking.id}`, { signal })
                if (apptRes.ok && !signal.aborted) {
                  const apptData = await apptRes.json()
                  if (apptData.appointment) {
                    details.startTime = apptData.appointment.startTime || ""
                    details.endTime = apptData.appointment.endTime || ""
                    details.appointment_status = apptData.appointment.appointmentStatus || details.appointment_status
                  }
                }
              } catch (error) {
                if (!signal.aborted) {
                  console.warn(`Failed to fetch booking details for ${booking.id}:`, error)
                }
              }
            }

            // Fetch staff details (with abort check)
            if (booking.assigned_user_id && !signal.aborted) {
              try {
                const staffRes = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/Staff?id=${booking.assigned_user_id}`, { signal })
                if (staffRes.ok && !signal.aborted) {
                  const staffData = await staffRes.json()
                  if (staffData.firstName) {
                    details.assignedStaffFirstName = staffData.firstName
                    details.assignedStaffLastName = staffData.lastName
                  }
                }
              } catch (error) {
                if (!signal.aborted) {
                  console.warn(`Failed to fetch staff details for ${booking.assigned_user_id}:`, error)
                }
              }
            }

            return details
          })
        )
        
        enrichedBookings.push(...batchResults)
        
        // Small delay between batches with abort check
        if (i + batchSize < bookings.length && !signal.aborted) {
          await delay(50)
        }
      }
      
      // Only update state if component is still mounted and request wasn't aborted
      if (isMounted.current && !signal.aborted) {
        setContactBookings(enrichedBookings)
      }
    } catch (error) {
      if (!(error instanceof Error && error.message === 'Aborted')) {
        console.warn('Failed to fetch contact bookings:', error)
        if (isMounted.current) {
      setContactBookings([])
        }
      }
    } finally {
      // Only update loading state if component is still mounted
      if (isMounted.current) {
      setContactBookingsLoading(false)
      }
    }

    // Return cleanup function to abort requests
    return () => {
      controller.abort()
    }
  }

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault()
    const firstName = formFirst.trim()
    const lastName = formLast.trim()
    const phone = formPhone.trim()
    const name = [firstName, lastName].filter(Boolean).join(" ")
    if (!firstName) {
      toast.error("First name is required")
      return
    }

    // EDIT FLOW
    if (editingId) {
      const payload = {
        firstName,
        lastName,
        name,
        phone,
        optionalFields: {
          tags: ["customer"],
        },
      }
      const previous = data.find((c) => c.id === editingId) || null
      const optimisticUpdated: Contact = {
        id: editingId,
        contactName: name || previous?.contactName || "",
        firstName,
        lastName,
        phone,
        dateAdded: previous?.dateAdded || new Date().toISOString(),
      }
      // optimistic update in table and selected sheet
      setData((prev) => prev.map((c) => (c.id === editingId ? optimisticUpdated : c)))
      if (selected?.id === editingId) setSelected(optimisticUpdated)
      setOpenAdd(false)
      setAddLoading(true)
      toast.loading("Updating customer…", { id: "edit-contact" })
      try {
        // First, update in external API
        const res = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/updateContact?id=${encodeURIComponent(editingId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error("Failed to update contact")
        
        const json = await res.json().catch(() => null)
          const raw = (json && (json.contact || json.data || json.result || json)) || null
          const server = raw && (raw.contact ? raw.contact : raw)
        
        let finalContact = optimisticUpdated
          if (server) {
            const mapped: Partial<Contact> = {
              id: String(server.id ?? server.contactId ?? editingId),
              contactName:
                server.contactName ||
                server.name ||
                [server.firstName || "", server.lastName || ""].filter(Boolean).join(" ") ||
                optimisticUpdated.contactName,
              firstName: server.firstName ?? optimisticUpdated.firstName,
              lastName: server.lastName ?? optimisticUpdated.lastName,
              phone: server.phone ?? optimisticUpdated.phone,
              dateAdded: server.dateAdded ?? optimisticUpdated.dateAdded,
            }
            setData((prev) => prev.map((c) => (c.id === editingId ? ({ ...c, ...mapped } as Contact) : c)))
            if (selected?.id === editingId) setSelected((prevSel) => (prevSel ? ({ ...prevSel, ...mapped } as Contact) : prevSel))
          finalContact = { ...optimisticUpdated, ...mapped } as Contact
        }
        
        // Supabase sync removed
        
        toast.success("Customer updated", { id: "edit-contact" })
      } catch {
        // revert optimistic edit
        if (previous) {
          setData((prev) => prev.map((c) => (c.id === editingId ? previous : c)))
          if (selected?.id === editingId) setSelected(previous)
        }
        toast.error("Failed to update customer", { id: "edit-contact" })
      } finally {
        setAddLoading(false)
        setEditingId(null)
      }
      return
    }

    // CREATE FLOW
    const payload = {
      firstName,
      lastName,
      name,
      phone,
      optionalFields: {
        tags: ["customer"],
      },
    }
    // optimistic add
    const tempId = `temp-${Date.now()}`
    const optimistic: Contact = {
      id: tempId,
      contactName: name,
      firstName,
      lastName,
      phone,
      dateAdded: new Date().toISOString(),
    }
    setData((prev) => [optimistic, ...prev])
    setOpenAdd(false)
    setAddLoading(true)
    toast.loading("Creating customer…", { id: "add-contact" })
    try {
      // First, create in external API
      const res = await fetch("https://restyle-backend.netlify.app/.netlify/functions/addContact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Failed to create contact")
      
      // Get the created contact data
      const json = await res.json().catch(() => null)
        const raw = (json && (json.contact || json.data || json.result || json)) || null
        const server = raw && (raw.contact ? raw.contact : raw)
      
      let finalContact = optimistic
        if (server) {
          const mapped = {
            id: String(server.id ?? server.contactId ?? server._id ?? server.uuid ?? tempId),
            contactName:
              server.contactName ||
              server.name ||
              [server.firstName || "", server.lastName || ""].filter(Boolean).join(" ") ||
              optimistic.contactName,
            firstName: server.firstName ?? optimistic.firstName,
            lastName: server.lastName ?? optimistic.lastName,
            phone: server.phone ?? optimistic.phone,
            dateAdded: server.dateAdded ?? optimistic.dateAdded,
        } as Contact
        
        setData((prev) => prev.map((c) => (c.id === tempId ? mapped : c)))
        finalContact = mapped
      }
      
      // Supabase sync removed
      
      toast.success("Customer created", { id: "add-contact" })
    } catch {
      // revert optimistic add
      setData((prev) => prev.filter((c) => c.id !== tempId))
      toast.error("Failed to create customer", { id: "add-contact" })
    } finally {
      setAddLoading(false)
    }
  }

  function confirmDelete(id: string) {
    setPendingDeleteId(id)
    setConfirmOpen(true)
  }

  async function handleDeleteConfirmed() {
    const id = pendingDeleteId
    if (!id) return
    setConfirmOpen(false)
    // optimistic UI: remove immediately
    const prevSelected = selected
    if (prevSelected?.id === id) {
      setDetailsOpen(false)
      setSelected(null)
    }
    const previousData = data
    setData((prev) => prev.filter((c) => c.id !== id))
    toast.loading("Deleting customer…", { id: `del-${id}` })
    try {
      // First, delete from external API
      const res = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/deleteContact?id=${encodeURIComponent(id)}`)
      if (!res.ok) throw new Error("Failed to delete contact")
      
      // Supabase sync removed
      
      toast.success("Customer deleted", { id: `del-${id}` })
    } catch {
      // revert optimistic removal
      setData(previousData)
      toast.error("Failed to delete customer", { id: `del-${id}` })
    } finally {
      setPendingDeleteId(null)
    }
  }

  async function handleBulkDelete() {
    const selectedRows = table.getFilteredSelectedRowModel().rows
    if (selectedRows.length === 0) return
    
    setBulkDeleteOpen(false)
    const selectedIds = selectedRows.map(row => row.original.id)
    const previousData = data
    
    // optimistic UI: remove immediately
    setData((prev) => prev.filter((c) => !selectedIds.includes(c.id)))
    setRowSelection({})
    
    toast.loading(`Deleting ${selectedIds.length} customers…`, { id: "bulk-delete" })
    
    try {
      // Delete customers one by one from external API
      const deletePromises = selectedIds.map(async (id) => {
        const res = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/deleteContact?id=${encodeURIComponent(id)}`)
        // Supabase sync removed
        return res
      })
      
      const results = await Promise.allSettled(deletePromises)
      const failed = results.filter(result => result.status === 'rejected' || !result.value?.ok)
      
      if (failed.length === 0) {
        toast.success(`${selectedIds.length} customers deleted`, { id: "bulk-delete" })
      } else {
        toast.error(`${failed.length} customers failed to delete`, { id: "bulk-delete" })
        // revert optimistic removal for failed deletions
        setData(previousData)
      }
    } catch {
      // revert optimistic removal
      setData(previousData)
      toast.error("Failed to delete customers", { id: "bulk-delete" })
    }
  }

  const columns = React.useMemo<ColumnDef<Contact>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            className="h-3.5 w-3.5"
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
            onCheckedChange={(value: boolean | "indeterminate") => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            className="h-3.5 w-3.5"
            checked={row.getIsSelected()}
            onCheckedChange={(value: boolean | "indeterminate") => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
        size: 40,
      },
      {
        accessorKey: "contactName",
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Name
            <ArrowUpDown />
          </Button>
        ),
        cell: ({ row }) => (
          <button
            className="font-medium capitalize hover:underline"
            onClick={() => openDetails(row.original)}
          >
            {String(row.getValue("contactName") || "").toLowerCase()}
          </button>
        ),
      },
      { accessorKey: "phone", header: "Phone", cell: ({ row }) => <div>{row.getValue("phone") || "-"}</div> },
      { accessorKey: "dateAdded", header: "Added", cell: ({ row }) => <div>{new Date(row.getValue("dateAdded")).toLocaleString()}</div> },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex items-center gap-1 justify-end">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
              aria-label="Edit"
              onClick={() => openEdit(row.original)}
            >
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-red-500/70 hover:text-red-600"
              aria-label="Delete"
              onClick={() => confirmDelete(row.original.id)}
            >
              <Trash2 />
            </Button>
          </div>
        ),
        enableHiding: false,
      },
    ],
    [openDetails, openEdit]
  )

  const table = useReactTable({
    data,
    columns,
    state: { 
      sorting, 
      columnFilters, 
      columnVisibility, 
      rowSelection,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: "includesString",
    manualPagination: true, // Use server-side pagination
    pageCount: 1, // Only one page
  })

  return (
    <RoleGuard requiredTeamPrefix="/legal">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
        <header className="flex flex-col gap-2 px-4 py-4">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
              <h1 className="text-xl font-semibold">Customers</h1>
            </div>
            <Button onClick={() => openEdit()} className="h-9">
              <Plus className="mr-2 h-4 w-4" /> Add customer
            </Button>
          </div>
          <p className="text-sm text-muted-foreground ml-8">Create, update, and edit your customers from here</p>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {table.getFilteredSelectedRowModel().rows.length > 0 && (
            <div className="flex items-center justify-end">
              <Button 
                variant="destructive" 
                onClick={() => setBulkDeleteOpen(true)}
                className="h-9"
              >
                <Trash className="mr-2 h-4 w-4" />
                Delete ({table.getFilteredSelectedRowModel().rows.length})
              </Button>
            </div>
          )}

          <div className="w-full space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Search by name or phone (server)"
                  value={apiQuery}
                  onChange={(e) => setApiQuery(e.target.value)}
                  className="w-[320px] h-9"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={async () => {
                    const q = apiQuery.trim()
                    if (!q) return
                    try {
                      setApiLoading(true)
                      const url = `https://restyle-backend.netlify.app/.netlify/functions/searchContacts?s=${encodeURIComponent(q)}&page=1&limit=20`
                      const res = await fetch(url)
                      const json = await res.json().catch(() => ({}))
                      const arr = Array.isArray(json.results) ? json.results : []
                      const mapped: Contact[] = arr.map((r: {
                        id?: string
                        contactId?: string
                        uuid?: string
                        contactName?: string
                        firstName?: string
                        lastName?: string
                        phone?: string
                        dateAdded?: string
                      }) => ({
                        id: String(r.id || r.contactId || r.uuid || ""),
                        contactName: r.contactName || r.firstName && r.lastName ? `${r.firstName} ${r.lastName}`.trim() : `${r.firstName || ""} ${r.lastName || ""}`.trim(),
                        firstName: r.firstName || "",
                        lastName: r.lastName || "",
                        phone: r.phone || null,
                        dateAdded: r.dateAdded || new Date().toISOString(),
                      }))
                      setData(mapped)
                    } catch {
                      toast.error("Search failed")
                    } finally {
                      setApiLoading(false)
                    }
                  }}
                  disabled={apiLoading}
                  title="Search"
                >
                  {apiLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3"
                  disabled={apiLoading}
                  onClick={async () => {
                    try {
                      setApiLoading(true)
                      setApiQuery("")
                      setGlobalFilter("")
                      await fetchContacts(1)
                    } finally {
                      setApiLoading(false)
                    }
                  }}
                  title="Reset filters"
                >
                  <X className="h-4 w-4 mr-1" /> Reset
                </Button>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Input
                  placeholder="Filter current page…"
                  value={globalFilter ?? ""}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  className="w-[240px] h-9"
                />
              </div>
            </div>

            <div className="rounded-md border overflow-hidden">
              <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header, idx) => {
                      const isFirst = header.column.id === "select"
                      const isLast = idx === headerGroup.headers.length - 1
                      const cls = isFirst ? "w-[36px]" : isLast ? "w-[84px] text-right" : undefined
                      return (
                        <TableHead key={header.id} className={cls}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={`s-${i}`}>
                      {table.getAllLeafColumns().map((col, j) => (
                        <TableCell key={`${col.id}-${j}`}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              </Table>
            </div>

            {/* Simplified Pagination Controls - Show all entries on current page with prev/next only */}
            <div className="flex items-center justify-between py-4">
              <div className="text-muted-foreground text-sm">
                Page {currentPage} of {totalPages} - Showing all {data.length} entries on this page ({total} total)
                {globalFilter && " (search applied to current page only)"}
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage <= 1}
                  className="h-8 px-3"
                >
                  Previous
                </Button>
                
                <span className="text-sm text-muted-foreground mx-2">
                  Page {currentPage}
                </span>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage >= totalPages}
                  className="h-8 px-3"
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </div>

        <Dialog open={openAdd} onOpenChange={setOpenAdd}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit customer" : "Add customer"}</DialogTitle>
            </DialogHeader>
            <form className="grid gap-3" onSubmit={handleCreateSubmit}>
              <div className="grid gap-2">
                <label className="text-sm">First name</label>
                <Input name="firstName" required value={formFirst} onChange={(e) => setFormFirst(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <label className="text-sm">Last name</label>
                <Input name="lastName" value={formLast} onChange={(e) => setFormLast(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <label className="text-sm">Phone</label>
                <Input name="phone" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpenAdd(false)}>Cancel</Button>
                <Button type="submit" disabled={addLoading}>
                  {addLoading ? "Saving…" : "Save"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
          <SheetContent side="right" className="w-full sm:max-w-md">
            <SheetHeader>
          <SheetTitle className="capitalize">{(selected?.contactName || "").toLowerCase() || "Customer"}</SheetTitle>
          <SheetDescription>
            Customer Details
          </SheetDescription>
            </SheetHeader>
        <div className="px-4 space-y-3">
          <div className="text-sm"><span className="text-muted-foreground">Phone:</span> {selected?.phone || "-"}</div>
          <div className="text-sm"><span className="text-muted-foreground">Added:</span> {selected ? new Date(selected.dateAdded).toLocaleString() : "-"}</div>

          <div className="pt-2">
            <div className="text-sm font-medium">Bookings {contactBookingsLoading ? "(loading…)" : `(${contactBookings.length})`}</div>
            <div className="mt-2 rounded-md border">
              {contactBookingsLoading ? (
                <div className="p-3 text-sm text-muted-foreground">Loading…</div>
              ) : contactBookings.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">No bookings</div>
              ) : (
                <ul className="divide-y">
                  {contactBookings.map((b) => {
                    const isCancelled = b.appointment_status === 'cancelled'
                    const isPast = b.startTime ? new Date(b.startTime) < new Date() : false
                    const withinTwoHours = isBookingWithinTwoHours(b.startTime)
                    
                    return (
                      <li key={b.id} className="p-3">
                        <div className="space-y-2">
                          <div className="text-sm font-medium">{b.serviceName || 'Untitled Service'}</div>
                          
                          {/* Action buttons under service name */}
                          {!isCancelled && !isPast && (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={withinTwoHours}
                                title={withinTwoHours ? "Cannot reschedule - booking starts within 2 hours" : "Reschedule appointment"}
                              onClick={() => {
                                // TODO: Implement reschedule functionality - redirect to appointments page
                                toast.info("Please use the Appointments page to reschedule bookings")
                              }}
                                className="text-xs h-6 px-2"
                              >
                                Reschedule
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={withinTwoHours}
                                title={withinTwoHours ? "Cannot cancel - booking starts within 2 hours" : "Cancel appointment"}
                                onClick={() => handleCancelCustomerBooking(b)}
                                className="text-xs h-6 px-2"
                              >
                                Cancel
                              </Button>
                            </div>
                          )}
                          
                        <div className="text-xs text-muted-foreground">
                            {b.startTime ? new Date(b.startTime).toLocaleString('en-US', {
                              timeZone: 'America/Edmonton',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              timeZoneName: 'short'
                            }) : 'Time not set'}
                        </div>
                          <div className="text-xs text-muted-foreground">
                            {b.startTime && b.endTime ? (() => {
                              const mins = Math.max(0, Math.round((new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 60000))
                              const h = Math.floor(mins / 60)
                              const m = mins % 60
                              if (h && m) return `Duration: ${h}h ${m}m`
                              if (h) return `Duration: ${h}h`
                              return `Duration: ${m} mins`
                            })() : 'Duration unknown'}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                              b.appointment_status === 'confirmed' ? 'bg-green-100 text-green-800 border-green-200' :
                              b.appointment_status === 'cancelled' ? 'bg-red-100 text-red-800 border-red-200' :
                              'bg-gray-100 text-gray-800 border-gray-200'
                            }`}>
                              {b.appointment_status || b.status || 'Unknown'}
                            </span>
                            {(b.assignedStaffFirstName || b.assignedStaffLastName) && (
                              <span className="text-xs text-muted-foreground">
                                Staff: {`${b.assignedStaffFirstName || ''} ${b.assignedStaffLastName || ''}`.trim()}
                              </span>
                            )}
                          </div>
                          {b.address && b.address !== 'Zoom' && (
                            <div className="text-xs text-muted-foreground mt-1">Location: {b.address}</div>
                        )}
                      </div>
                    </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
            <SheetFooter>
              <div className="flex w-full items-center justify-end gap-2">
                <Button variant="ghost" onClick={() => selected && openEdit(selected)}>
                  <Pencil className="mr-2" /> Edit
                </Button>
                <Button variant="ghost" className="text-red-500/70 hover:text-red-600" onClick={() => selected && confirmDelete(selected.id)}>
                  <Trash2 className="mr-2" /> Delete
                </Button>
              </div>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <ConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <ConfirmContent>
            <ConfirmHeader>
              <ConfirmTitle>Delete customer?</ConfirmTitle>
            </ConfirmHeader>
            <div className="px-1 text-sm text-muted-foreground">This action cannot be undone.</div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteConfirmed}>Delete</Button>
            </div>
          </ConfirmContent>
        </ConfirmDialog>

        <ConfirmDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
          <ConfirmContent>
            <ConfirmHeader>
              <ConfirmTitle>Delete {table.getFilteredSelectedRowModel().rows.length} customers?</ConfirmTitle>
            </ConfirmHeader>
            <div className="px-1 text-sm text-muted-foreground">This action cannot be undone. All selected customers will be permanently deleted.</div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleBulkDelete}>Delete All</Button>
            </div>
          </ConfirmContent>
        </ConfirmDialog>

        {/* Booking Cancel Confirmation Dialog */}
        <ConfirmDialog open={bookingCancelOpen} onOpenChange={setBookingCancelOpen}>
          <ConfirmContent>
            <ConfirmHeader>
              <ConfirmTitle>Cancel Appointment</ConfirmTitle>
            </ConfirmHeader>
            <div className="py-4">
              <p>Are you sure you want to cancel this appointment?</p>
              {bookingToCancel && (
                <div className="mt-2 p-3 bg-muted rounded-md">
                  <p className="font-medium">{bookingToCancel.serviceName}</p>
                  <p className="text-sm text-muted-foreground">
                    {bookingToCancel.startTime ? new Date(bookingToCancel.startTime).toLocaleString('en-US', {
                      timeZone: 'America/Edmonton',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZoneName: 'short'
                    }) : 'Time not set'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Customer: {selected?.contactName || 'Unknown'}
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setBookingCancelOpen(false)}
                disabled={bookingCancelLoading}
              >
                Keep Appointment
              </Button>
              <Button
                variant="destructive"
                onClick={confirmCancelCustomerBooking}
                disabled={bookingCancelLoading}
              >
                {bookingCancelLoading ? "Cancelling..." : "Cancel Appointment"}
              </Button>
            </div>
          </ConfirmContent>
        </ConfirmDialog>
      </SidebarInset>
    </SidebarProvider>
    </RoleGuard>
  )
}
