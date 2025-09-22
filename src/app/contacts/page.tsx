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

type Contact = {
  id: string
  contactName: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  dateAdded: string
}

type ContactOpportunity = {
  id: string
  name: string
  monetaryValue: number
  status: string
  createdAt: string
  updatedAt: string
}

type RawOpportunity = {
  id?: string | number
  name?: string
  monetaryValue?: number | string
  status?: string
  createdAt?: string
  updatedAt?: string
  contactId?: string | number
  contact?: { id?: string | number } | null
}

type RawContact = {
  id?: string | number
  contactName?: string
  firstName?: string
  lastName?: string
  email?: string | null
  phone?: string | null
  dateAdded?: string
}

function useContacts() {
  const [data, setData] = React.useState<Contact[]>([])
  const [loading, setLoading] = React.useState<boolean>(true)

  const fetchContacts = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("https://lawyervantage.netlify.app/.netlify/functions/getContacts")
      if (!res.ok) throw new Error("Failed to fetch contacts")
      const json = await res.json()
      const arr = (json?.contacts?.contacts || []) as RawContact[]
      const mapped: Contact[] = arr.map((c) => ({
        id: String(c.id ?? ""),
        contactName: c.contactName || `${c.firstName || ""} ${c.lastName || ""}`.trim(),
        firstName: c.firstName || "",
        lastName: c.lastName || "",
        email: c.email ?? null,
        phone: c.phone ?? null,
        dateAdded: c.dateAdded || new Date().toISOString(),
      }))
      setData(mapped)
    } catch {
      // Error handling removed - could add logging here if needed
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

  return { data, loading, setData }
}

export default function Page() {
  const { data, loading, setData } = useContacts()
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
  const [formEmail, setFormEmail] = React.useState("")
  const [formPhone, setFormPhone] = React.useState("")
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null)
  const [addLoading, setAddLoading] = React.useState(false)
  const [contactOpps, setContactOpps] = React.useState<ContactOpportunity[]>([])
  const [contactOppsLoading, setContactOppsLoading] = React.useState(false)

  const openDetails = React.useCallback((contact: Contact) => {
    setSelected(contact)
    setDetailsOpen(true)
    fetchContactOpportunities(contact.id)
  }, [])

  const openEdit = React.useCallback((contact?: Contact) => {
    if (contact) {
      setEditingId(contact.id)
      setFormFirst(contact.firstName || "")
      setFormLast(contact.lastName || "")
      setFormEmail(contact.email || "")
      setFormPhone(contact.phone || "")
    } else {
      setEditingId(null)
      setFormFirst("")
      setFormLast("")
      setFormEmail("")
      setFormPhone("")
    }
    setOpenAdd(true)
  }, [])

  async function fetchContactOpportunities(contactId: string) {
    setContactOppsLoading(true)
    try {
      const res = await fetch("https://lawyervantage.netlify.app/.netlify/functions/getOpportunities")
      if (!res.ok) throw new Error("Failed to fetch opportunities")
      const json = await res.json()
      const arr = (json?.opportunities?.opportunities || []) as RawOpportunity[]
      const filtered = arr.filter((o) => String(o.contactId || o.contact?.id || "") === String(contactId))
      const mapped: ContactOpportunity[] = filtered.map((o) => ({
        id: String(o.id ?? ""),
        name: String(o.name ?? ""),
        monetaryValue: Number(o.monetaryValue ?? 0),
        status: String(o.status ?? "open"),
        createdAt: String(o.createdAt ?? new Date().toISOString()),
        updatedAt: String(o.updatedAt ?? new Date().toISOString()),
      }))
      setContactOpps(mapped)
    } catch {
      setContactOpps([])
    } finally {
      setContactOppsLoading(false)
    }
  }

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault()
    const firstName = formFirst.trim()
    const lastName = formLast.trim()
    const email = formEmail.trim()
    const phone = formPhone.trim()
    const name = [firstName, lastName].filter(Boolean).join(" ")
    if (!firstName || !email) {
      toast.error("First name and email are required")
      return
    }

    // EDIT FLOW
    if (editingId) {
      const payload = { firstName, lastName, name, email, phone }
      const previous = data.find((c) => c.id === editingId) || null
      const optimisticUpdated: Contact = {
        id: editingId,
        contactName: name || previous?.contactName || "",
        firstName,
        lastName,
        email,
        phone,
        dateAdded: previous?.dateAdded || new Date().toISOString(),
      }
      // optimistic update in table and selected sheet
      setData((prev) => prev.map((c) => (c.id === editingId ? optimisticUpdated : c)))
      if (selected?.id === editingId) setSelected(optimisticUpdated)
      setOpenAdd(false)
      setAddLoading(true)
      toast.loading("Updating contact…", { id: "edit-contact" })
      try {
        const res = await fetch(`https://lawyervantage.netlify.app/.netlify/functions/updateCustomer?id=${encodeURIComponent(editingId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error("Failed to update contact")
        const json = await res.json().catch(() => null)
        try {
          const raw = (json && (json.contact || json.data || json.result || json)) || null
          const server = raw && (raw.contact ? raw.contact : raw)
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
              email: server.email ?? optimisticUpdated.email,
              phone: server.phone ?? optimisticUpdated.phone,
              dateAdded: server.dateAdded ?? optimisticUpdated.dateAdded,
            }
            setData((prev) => prev.map((c) => (c.id === editingId ? ({ ...c, ...mapped } as Contact) : c)))
            if (selected?.id === editingId) setSelected((prevSel) => (prevSel ? ({ ...prevSel, ...mapped } as Contact) : prevSel))
          }
        } catch {}
        toast.success("Contact updated", { id: "edit-contact" })
      } catch {
        // revert optimistic edit
        if (previous) {
          setData((prev) => prev.map((c) => (c.id === editingId ? previous : c)))
          if (selected?.id === editingId) setSelected(previous)
        }
        toast.error("Failed to update contact", { id: "edit-contact" })
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
      email,
      phone,
      optionalFields: {
        companyName: "Lawyer Vantage",
        tags: ["new", "lead"],
      },
    }
    // optimistic add
    const tempId = `temp-${Date.now()}`
    const optimistic: Contact = {
      id: tempId,
      contactName: name,
      firstName,
      lastName,
      email,
      phone,
      dateAdded: new Date().toISOString(),
    }
    setData((prev) => [optimistic, ...prev])
    setOpenAdd(false)
    setAddLoading(true)
    toast.loading("Creating contact…", { id: "add-contact" })
    try {
      const res = await fetch("https://lawyervantage.netlify.app/.netlify/functions/addContact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Failed to create contact")
      // Try to update the optimistic row with server data (id, etc.) without refetching
      const json = await res.json().catch(() => null)
      try {
        const raw = (json && (json.contact || json.data || json.result || json)) || null
        const server = raw && (raw.contact ? raw.contact : raw)
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
            email: server.email ?? optimistic.email,
            phone: server.phone ?? optimistic.phone,
            dateAdded: server.dateAdded ?? optimistic.dateAdded,
          } as Partial<Contact>
          setData((prev) => prev.map((c) => (c.id === tempId ? ({ ...c, ...mapped } as Contact) : c)))
        }
      } catch {}
      toast.success("Contact created", { id: "add-contact" })
    } catch {
      // revert optimistic add
      setData((prev) => prev.filter((c) => c.id !== tempId))
      toast.error("Failed to create contact", { id: "add-contact" })
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
    toast.loading("Deleting…", { id: `del-${id}` })
    try {
      const res = await fetch(`https://lawyervantage.netlify.app/.netlify/functions/deleteContact?id=${encodeURIComponent(id)}`)
      if (!res.ok) throw new Error("Failed to delete contact")
      toast.success("Contact deleted", { id: `del-${id}` })
    } catch {
      // revert optimistic removal
      setData(previousData)
      toast.error("Failed to delete contact", { id: `del-${id}` })
    } finally {
      setPendingDeleteId(null)
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
      { accessorKey: "email", header: "Email", cell: ({ row }) => <div className="lowercase">{row.getValue("email") || "-"}</div> },
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
              <h1 className="text-[1.4rem] font-semibold leading-none">Contacts</h1>
              <p className="text-muted-foreground">Create, update, and edit your contacts from here.</p>
            </div>
            <div>
              <Button onClick={() => openEdit()} className="h-9">
                <Plus className="mr-2 h-4 w-4" /> Add contact
              </Button>
            </div>
          </div>

          <div className="w-full space-y-3">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search contacts..."
                value={(table.getColumn("contactName")?.getFilterValue() as string) ?? ""}
                onChange={(e) => table.getColumn("contactName")?.setFilterValue(e.target.value)}
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
              <DialogTitle>{editingId ? "Edit contact" : "Add contact"}</DialogTitle>
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
                <label className="text-sm">Email</label>
                <Input type="email" name="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
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
          <SheetTitle className="capitalize">{(selected?.contactName || "").toLowerCase() || "Contact"}</SheetTitle>
          <SheetDescription>
            {selected?.email || "No email"}
          </SheetDescription>
            </SheetHeader>
        <div className="px-4 space-y-3">
          <div className="text-sm"><span className="text-muted-foreground">Phone:</span> {selected?.phone || "-"}</div>
          <div className="text-sm"><span className="text-muted-foreground">Added:</span> {selected ? new Date(selected.dateAdded).toLocaleString() : "-"}</div>

          <div className="pt-2">
            <div className="text-sm font-medium">Opportunities {contactOppsLoading ? "(loading…)" : `(${contactOpps.length})`}</div>
            <div className="mt-2 rounded-md border">
              {contactOppsLoading ? (
                <div className="p-3 text-sm text-muted-foreground">Loading…</div>
              ) : contactOpps.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">No opportunities</div>
              ) : (
                <ul className="divide-y">
                  {contactOpps.map((o) => (
                    <li key={o.id} className="p-3 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium">{o.name}</div>
                        <div className="text-xs text-muted-foreground">{o.status} · {new Date(o.updatedAt || o.createdAt).toLocaleDateString()}</div>
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
              <ConfirmTitle>Delete contact?</ConfirmTitle>
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


