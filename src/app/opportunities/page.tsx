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
import { ArrowUpDown, Pencil, Trash2, Plus } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet"
import { Dialog as ConfirmDialog, DialogContent as ConfirmContent, DialogHeader as ConfirmHeader, DialogTitle as ConfirmTitle } from "@/components/ui/dialog"
import { toast } from "sonner"

// Badge component for status display
function StatusBadge({ status }: { status: string }) {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'closed':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'won':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'lost':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'abandoned':
        return 'bg-amber-100 text-amber-900 border-amber-200'
      case 'all':
        return 'bg-purple-100 text-purple-900 border-purple-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(status)}`}>
      {status}
    </span>
  )
}

type OpportunityContact = {
  id: string
  name: string
  companyName?: string | null
  email?: string | null
  phone?: string | null
  tags: string[]
  notes: string[]
  tasks: string[]
  calendarEvents: string[]
  customFields: unknown[]
  followers: unknown[]
}

type Opportunity = {
  id: string
  name: string
  monetaryValue: number
  pipelineId: string
  pipelineStageId: string
  pipelineStageUId?: string
  assignedTo: string | null
  status: string
  source: string
  lastStatusChangeAt?: string
  lastStageChangeAt?: string
  lastActionDate?: string
  indexVersion?: number
  createdAt: string
  updatedAt: string
  contactId: string
  locationId?: string
  lostReasonId?: string | null
  relations?: unknown[]
  contact: OpportunityContact
}

type RawOpportunity = {
  id?: string | number
  name?: string
  monetaryValue?: number | string
  pipelineId?: string
  pipelineStageId?: string
  pipelineStageUId?: string
  assignedTo?: string | null
  status?: string
  source?: string
  lastStatusChangeAt?: string
  lastStageChangeAt?: string
  lastActionDate?: string
  indexVersion?: number | string
  createdAt?: string
  updatedAt?: string
  contactId?: string | number
  locationId?: string | number
  lostReasonId?: string | null
  relations?: { objectKey?: string; fullName?: string }[]
  contact?: {
    id?: string | number
    name?: string
    companyName?: string | null
    email?: string | null
    phone?: string | null
    tags?: string[]
  } | null
}

function useOpportunities() {
  const [data, setData] = React.useState<Opportunity[]>([])
  const [loading, setLoading] = React.useState<boolean>(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let isMounted = true
    async function fetchOpportunities() {
      setLoading(true)
      try {
        const res = await fetch("https://lawyervantage.netlify.app/.netlify/functions/getOpportunities")
        if (!res.ok) throw new Error("Failed to fetch opportunities")
        const json = await res.json().catch(() => null)
        const arr = ((json && json.opportunities && json.opportunities.opportunities) || []) as RawOpportunity[]
        const mapped: Opportunity[] = arr.map((o) => ({
          id: String(o.id ?? ""),
          name: String(o.name ?? ""),
          monetaryValue: Number(o.monetaryValue ?? 0),
          pipelineId: String(o.pipelineId ?? ""),
          pipelineStageId: String(o.pipelineStageId ?? ""),
          pipelineStageUId: o.pipelineStageUId ?? undefined,
          assignedTo: o.assignedTo ?? null,
          status: String(o.status ?? "open"),
          source: String(o.source ?? "Lawyer Vantage"),
          lastStatusChangeAt: o.lastStatusChangeAt ?? undefined,
          lastStageChangeAt: o.lastStageChangeAt ?? undefined,
          lastActionDate: o.lastActionDate ?? undefined,
          indexVersion: typeof o.indexVersion === "number" ? o.indexVersion : Number(o.indexVersion ?? undefined),
          createdAt: String(o.createdAt ?? new Date().toISOString()),
          updatedAt: String(o.updatedAt ?? new Date().toISOString()),
          contactId: String(o.contactId ?? o.contact?.id ?? ""),
          locationId: o.locationId ? String(o.locationId) : undefined,
          lostReasonId: (o.lostReasonId ?? null) as string | null,
          relations: o.relations ?? [],
          contact: {
            id: String(o.contact?.id ?? o.contactId ?? ""),
            name: String(o.contact?.name ?? (o.relations || []).find((r) => r.objectKey === "contact")?.fullName ?? ""),
            companyName: o.contact?.companyName ?? null,
            email: o.contact?.email ?? null,
            phone: o.contact?.phone ?? null,
            tags: Array.isArray(o.contact?.tags) ? o.contact.tags : [],
            notes: [],
            tasks: [],
            calendarEvents: [],
            customFields: [],
            followers: [],
          },
        }))
        if (isMounted) setData(mapped)
      } catch (e: unknown) {
        if (isMounted) setError(e instanceof Error ? e.message : "Unknown error")
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    fetchOpportunities()
    return () => {
      isMounted = false
    }
  }, [])

  return { data, loading, setData, error }
}

export default function Page() {
  const { data, loading, setData } = useOpportunities()
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  const [openAdd, setOpenAdd] = React.useState(false)
  const [detailsOpen, setDetailsOpen] = React.useState(false)
  const [selected, setSelected] = React.useState<Opportunity | null>(null)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [formName, setFormName] = React.useState("")
  const [formValue, setFormValue] = React.useState<string>("")
  const [selectedContactId, setSelectedContactId] = React.useState<string>("")
  const [formStatus, setFormStatus] = React.useState<string>("open")
  const [contacts, setContacts] = React.useState<{ id: string; name: string }[]>([])
  const [contactsLoading, setContactsLoading] = React.useState<boolean>(false)
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null)
  const [addLoading, setAddLoading] = React.useState(false)
  const [relatedForContact, setRelatedForContact] = React.useState<Opportunity[]>([])
  const [relatedLoading, setRelatedLoading] = React.useState(false)

  const openDetails = React.useCallback((opp: Opportunity) => {
    setSelected(opp)
    setDetailsOpen(true)
    fetchRelatedForContact(opp.contactId)
  }, [])

  const openEdit = React.useCallback((opp?: Opportunity) => {
    if (opp) {
      setEditingId(opp.id)
      setFormName(opp.name || "")
      setFormValue(String(opp.monetaryValue ?? ""))
      setSelectedContactId(opp.contactId || "")
      setFormStatus(opp.status || "open")
    } else {
      setEditingId(null)
      setFormName("")
      setFormValue("")
      setSelectedContactId(contacts[0]?.id || "")
      setFormStatus("open")
    }
    setOpenAdd(true)
  }, [contacts])

  React.useEffect(() => {
    let isMounted = true
    async function fetchContacts() {
      setContactsLoading(true)
      try {
        const res = await fetch("https://lawyervantage.netlify.app/.netlify/functions/getContacts")
        if (!res.ok) throw new Error("Failed to fetch contacts")
        const json = await res.json().catch(() => null)
        const arr = ((json && json.contacts && json.contacts.contacts) || []) as Array<{
          id?: string | number
          contactName?: string
          firstName?: string
          lastName?: string
        }>
        const mapped = arr.map((c) => ({
          id: String(c.id ?? ""),
          name: c.contactName || `${c.firstName || ""} ${c.lastName || ""}`.trim(),
        }))
        if (isMounted) {
          setContacts(mapped)
          // default selection if none
          setSelectedContactId((prev) => prev || (mapped[0]?.id || ""))
        }
      } catch {
        if (isMounted) setContacts([])
      } finally {
        if (isMounted) setContactsLoading(false)
      }
    }
    fetchContacts()
    return () => {
      isMounted = false
    }
  }, [])
  async function fetchRelatedForContact(contactId: string) {
    setRelatedLoading(true)
    try {
      const res = await fetch("https://lawyervantage.netlify.app/.netlify/functions/getOpportunities")
      if (!res.ok) throw new Error("Failed to fetch opportunities")
      const json = await res.json().catch(() => null)
      const arr = ((json && json.opportunities && json.opportunities.opportunities) || []) as RawOpportunity[]
      const filtered = arr.filter((o) => String(o.contactId || o.contact?.id || "") === String(contactId))
      const mapped: Opportunity[] = filtered.map((o) => ({
        id: String(o.id ?? ""),
        name: String(o.name ?? ""),
        monetaryValue: Number(o.monetaryValue ?? 0),
        pipelineId: String(o.pipelineId ?? ""),
        pipelineStageId: String(o.pipelineStageId ?? ""),
        pipelineStageUId: o.pipelineStageUId ?? undefined,
        assignedTo: o.assignedTo ?? null,
        status: String(o.status ?? "open"),
        source: String(o.source ?? "Lawyer Vantage"),
        lastStatusChangeAt: o.lastStatusChangeAt ?? undefined,
        lastStageChangeAt: o.lastStageChangeAt ?? undefined,
        lastActionDate: o.lastActionDate ?? undefined,
        indexVersion: typeof o.indexVersion === "number" ? o.indexVersion : Number(o.indexVersion ?? undefined),
        createdAt: String(o.createdAt ?? new Date().toISOString()),
        updatedAt: String(o.updatedAt ?? new Date().toISOString()),
        contactId: String(o.contactId ?? o.contact?.id ?? ""),
        locationId: o.locationId ? String(o.locationId) : undefined,
        lostReasonId: (o.lostReasonId ?? null) as string | null,
        relations: o.relations ?? [],
        contact: {
          id: String(o.contact?.id ?? o.contactId ?? ""),
          name: String(o.contact?.name ?? (o.relations || []).find((r) => r.objectKey === "contact")?.fullName ?? ""),
          companyName: o.contact?.companyName ?? null,
          email: o.contact?.email ?? null,
          phone: o.contact?.phone ?? null,
          tags: Array.isArray(o.contact?.tags) ? o.contact.tags : [],
          notes: [],
          tasks: [],
          calendarEvents: [],
          customFields: [],
          followers: [],
        },
      }))
      setRelatedForContact(mapped)
    } catch {
      setRelatedForContact([])
    } finally {
      setRelatedLoading(false)
    }
  }

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault()
    const name = formName.trim()
    const monetaryValue = Number(formValue)
    const contactId = selectedContactId
    const status = formStatus
    if (!name || Number.isNaN(monetaryValue) || !contactId) {
      toast.error("Name, value, and contact are required")
      return
    }

    // EDIT FLOW
    if (editingId) {
      const previous = data.find((c) => c.id === editingId) || null
      const now = new Date().toISOString()
      const optimisticUpdated: Opportunity = {
        ...(previous as Opportunity),
        id: editingId,
        name,
        monetaryValue,
        contactId,
        status,
        source: previous?.source || "Lawyer Vantage",
        updatedAt: now,
        contact: {
          ...(previous?.contact || ({} as OpportunityContact)),
          id: contactId,
          name: contacts.find((c) => c.id === contactId)?.name || (previous?.contact?.name || ""),
        },
      }
      setData((prev) => prev.map((c) => (c.id === editingId ? optimisticUpdated : c)))
      if (selected?.id === editingId) setSelected(optimisticUpdated)
      setOpenAdd(false)
      setAddLoading(true)
      toast.loading("Updating opportunity…", { id: "edit-opportunity" })
      try {
        const payload: { id: string; name: string; status: string; monetaryValue: number; source: string; contactId?: string } = { id: editingId, name, status, monetaryValue, source: "Lawyer Vantage" }
        if (contactId && contactId !== previous?.contactId) payload.contactId = contactId
        const res = await fetch("https://lawyervantage.netlify.app/.netlify/functions/updateOpportunity", {
          method: "PUT",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error("Failed to update opportunity")
        const json = await res.json().catch(() => null)
        try {
          const raw = (json && (json.opportunity || json.data || json.result || json)) || null
          const server = raw && (raw.opportunity ? raw.opportunity : raw)
          if (server) {
            const mapped: Partial<Opportunity> = {
              id: String(server.id ?? server.opportunityId ?? editingId),
              name: String(server.name ?? optimisticUpdated.name),
              monetaryValue: Number(server.monetaryValue ?? optimisticUpdated.monetaryValue),
              contactId: String(server.contactId ?? optimisticUpdated.contactId),
              status: String(server.status ?? optimisticUpdated.status),
              source: server.source ?? optimisticUpdated.source,
              updatedAt: server.updatedAt ?? optimisticUpdated.updatedAt,
              createdAt: server.createdAt ?? optimisticUpdated.createdAt,
            }
            const newContactName = contacts.find((c) => c.id === (mapped.contactId || optimisticUpdated.contactId))?.name
            setData((prev) => prev.map((o) => (
              o.id === editingId
                ? ({
                    ...o,
                    ...mapped,
                    contact: {
                      ...o.contact,
                      id: String(mapped.contactId || o.contact.id),
                      name: newContactName || o.contact.name,
                    },
                  } as Opportunity)
                : o
            )))
            if (selected?.id === editingId) setSelected((prevSel) => (
              prevSel
                ? ({
                    ...prevSel,
                    ...mapped,
                    contact: {
                      ...prevSel.contact,
                      id: String(mapped.contactId || prevSel.contact.id),
                      name: newContactName || prevSel.contact.name,
                    },
                  } as Opportunity)
                : prevSel
            ))
          }
        } catch {}
        toast.success("Opportunity updated", { id: "edit-opportunity" })
      } catch {
        // revert optimistic edit
        if (previous) {
          setData((prev) => prev.map((c) => (c.id === editingId ? (previous as Opportunity) : c)))
          if (selected?.id === editingId) setSelected(previous)
        }
        toast.error("Failed to update opportunity", { id: "edit-opportunity" })
      } finally {
        setAddLoading(false)
        setEditingId(null)
      }
      return
    }

    // CREATE FLOW
    const mkId = () => Math.random().toString(36).slice(2, 10)
    const tempId = `temp-${Date.now()}`
    const now = new Date().toISOString()
    const contactName = contacts.find((c) => c.id === contactId)?.name || ""
    const optimistic: Opportunity = {
      id: tempId,
      name,
      monetaryValue,
      pipelineId: mkId(),
      pipelineStageId: mkId(),
      assignedTo: mkId(),
      status,
      source: "Lawyer Vantage",
      lastStatusChangeAt: now,
      lastStageChangeAt: now,
      lastActionDate: now,
      indexVersion: 1,
      createdAt: now,
      updatedAt: now,
      contactId,
      locationId: mkId(),
      contact: {
        id: contactId,
        name: contactName,
        companyName: null,
        email: null,
        phone: null,
        tags: [],
        notes: [],
        tasks: [],
        calendarEvents: [],
        customFields: [],
        followers: [],
      },
    }
    setData((prev) => [optimistic, ...prev])
    setOpenAdd(false)
    setAddLoading(true)
    toast.loading("Creating opportunity…", { id: "add-opportunity" })
    try {
      const res = await fetch("https://lawyervantage.netlify.app/.netlify/functions/addOpportunity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, contactId, monetaryValue, status, source: "Lawyer Vantage" }),
      })
      if (!res.ok) throw new Error("Failed to create opportunity")
      const json = await res.json().catch(() => null)
      try {
        const raw = (json && (json.opportunity || json.data || json.result || json)) || null
        const server = raw && (raw.opportunity ? raw.opportunity : raw)
        if (server) {
          const mapped = {
            id: String(server.id ?? server.opportunityId ?? server._id ?? server.uuid ?? tempId),
            name: String(server.name ?? name),
            monetaryValue: Number(server.monetaryValue ?? monetaryValue),
            contactId: String(server.contactId ?? contactId),
            updatedAt: server.updatedAt ?? now,
            createdAt: server.createdAt ?? now,
            status: String(server.status ?? "open"),
            source: String(server.source ?? ""),
          } as Partial<Opportunity>
          setData((prev) => prev.map((o) => (o.id === tempId ? ({ ...o, ...mapped } as Opportunity) : o)))
        }
      } catch {}
      toast.success("Opportunity created", { id: "add-opportunity" })
    } catch {
      setData((prev) => prev.filter((o) => o.id !== tempId))
      toast.error("Failed to create opportunity", { id: "add-opportunity" })
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
    const prevSelected = selected
    if (prevSelected?.id === id) {
      setDetailsOpen(false)
      setSelected(null)
    }
    const previousData = data
    setData((prev) => prev.filter((c) => c.id !== id))
    toast.loading("Deleting…", { id: `del-${id}` })
    try {
      const res = await fetch("https://lawyervantage.netlify.app/.netlify/functions/deleteOpportunity", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId: id }),
      })
      if (!res.ok) throw new Error("Failed to delete opportunity")
      toast.success("Opportunity deleted", { id: `del-${id}` })
    } catch {
      setData(previousData)
      toast.error("Failed to delete opportunity", { id: `del-${id}` })
    } finally {
      setPendingDeleteId(null)
    }
  }

  const columns = React.useMemo<ColumnDef<Opportunity>[]>(
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
        accessorKey: "name",
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Opportunity
            <ArrowUpDown />
          </Button>
        ),
        cell: ({ row }) => (
          <button
            className="font-medium hover:underline"
            onClick={() => openDetails(row.original)}
          >
            {String(row.getValue("name") || "")}
          </button>
        ),
      },
      { id: "contact", header: "Contact", cell: ({ row }) => <div>{row.original.contact?.name || "-"}</div> },
      { accessorKey: "monetaryValue", header: "Value", cell: ({ row }) => <div>${Number(row.getValue("monetaryValue") || 0).toLocaleString()}</div> },
      { 
        accessorKey: "status", 
        header: "Status",
        cell: ({ row }) => <StatusBadge status={String(row.getValue("status") || "")} />
      },
      { accessorKey: "source", header: "Source" },
      { accessorKey: "createdAt", header: "Created", cell: ({ row }) => <div>{new Date(row.getValue("createdAt")).toLocaleString()}</div> },
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
    state: { sorting, columnFilters, columnVisibility, rowSelection },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <RoleGuard requiredTeamPrefix="">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[1.4rem] font-semibold leading-none">Opportunities</h1>
              <p className="text-muted-foreground">Create, update, and edit your opportunities from here.</p>
            </div>
            <div>
              <Button onClick={() => openEdit()} className="h-9">
                <Plus className="mr-2 h-4 w-4" /> Add opportunity
              </Button>
            </div>
          </div>

          <div className="w-full space-y-3">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search opportunities..."
                value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
                onChange={(e) => table.getColumn("name")?.setFilterValue(e.target.value)}
                className="w-[280px] h-9"
              />
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

            <div className="flex items-center justify-between py-2">
              <div className="text-muted-foreground text-sm">
                {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s) selected.
              </div>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" className="h-8" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" className="h-8" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                  Next
                </Button>
              </div>
            </div>
          </div>
        </div>

        <Dialog open={openAdd} onOpenChange={setOpenAdd}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit opportunity" : "Add opportunity"}</DialogTitle>
            </DialogHeader>
            <form className="grid gap-3" onSubmit={handleCreateSubmit}>
              <div className="grid gap-2">
                <label className="text-sm">Opportunity name</label>
                <Input name="name" required value={formName} onChange={(e) => setFormName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <label className="text-sm">Monetary value</label>
                <Input name="value" type="number" required value={formValue} onChange={(e) => setFormValue(e.target.value)} />
              </div>
              {!editingId && (
                <div className="grid gap-2">
                  <label className="text-sm">Contact</label>
                  <select
                    name="contactId"
                    value={selectedContactId}
                    onChange={(e) => setSelectedContactId(e.target.value)}
                    className="h-9 rounded-md border px-3 text-sm"
                    disabled={contactsLoading || contacts.length === 0}
                  >
                    {contactsLoading ? (
                      <option value="">Loading…</option>
                    ) : contacts.length === 0 ? (
                      <option value="">No contacts</option>
                    ) : (
                      contacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}
              <div className="grid gap-2">
                <label className="text-sm">Status</label>
                <select
                  name="status"
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="h-9 rounded-md border px-3 text-sm"
                >
                  <option value="open">Open</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                  <option value="abandoned">Abandoned</option>
                  <option value="all">All</option>
                </select>
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
              <SheetTitle className="capitalize">{selected?.name || "Opportunity"}</SheetTitle>
              <SheetDescription>
                {selected?.contact?.email || "No email"}
              </SheetDescription>
            </SheetHeader>
          <div className="px-4 space-y-3">
              <div className="text-sm"><span className="text-muted-foreground">Contact:</span> {selected?.contact?.name || "-"}</div>
              <div className="text-sm"><span className="text-muted-foreground">Phone:</span> {selected?.contact?.phone || "-"}</div>
              <div className="text-sm"><span className="text-muted-foreground">Value:</span> ${selected ? selected.monetaryValue.toLocaleString() : 0}</div>
              <div className="text-sm"><span className="text-muted-foreground">Status:</span> {selected?.status ? <StatusBadge status={selected.status} /> : "-"}</div>
              <div className="text-sm"><span className="text-muted-foreground">Source:</span> {selected?.source || "-"}</div>
              <div className="text-sm"><span className="text-muted-foreground">Created:</span> {selected ? new Date(selected.createdAt).toLocaleString() : "-"}</div>
              <div className="text-sm"><span className="text-muted-foreground">Updated:</span> {selected ? new Date(selected.updatedAt).toLocaleString() : "-"}</div>

            <div className="pt-2">
              <div className="text-sm font-medium">Contact&apos;s opportunities {relatedLoading ? "(loading…)" : `(${relatedForContact.length})`}</div>
              <div className="mt-2 rounded-md border">
                {relatedLoading ? (
                  <div className="p-3 text-sm text-muted-foreground">Loading…</div>
                ) : relatedForContact.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">No opportunities</div>
                ) : (
                  <ul className="divide-y">
                    {relatedForContact.map((o) => (
                      <li key={o.id} className="p-3 flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium">{o.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <StatusBadge status={o.status} />
                            <span>· {new Date(o.updatedAt || o.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="text-sm font-medium">${o.monetaryValue.toLocaleString()}</div>
                      </li>
                    ))}
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
              <ConfirmTitle>Delete opportunity?</ConfirmTitle>
            </ConfirmHeader>
            <div className="px-1 text-sm text-muted-foreground">This action cannot be undone.</div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteConfirmed}>Delete</Button>
            </div>
          </ConfirmContent>
        </ConfirmDialog>
      </SidebarInset>
    </SidebarProvider>
    </RoleGuard>
  )
}


