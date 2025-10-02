"use client"

import * as React from "react"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export type StaffPerformance = {
  staffId: string
  staffName: string
  totalRevenue: number
  totalServices: number
  totalHours: number
  avgRating: number
  efficiency: number
}

interface StaffPerformanceTableProps {
  data: StaffPerformance[]
  selectedStaff: string | null
  onStaffSelect: (staffId: string | null) => void
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

export function StaffPerformanceTable({ data, selectedStaff, onStaffSelect }: StaffPerformanceTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([])

  const columns: ColumnDef<StaffPerformance>[] = [
    {
      accessorKey: "staffName",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 lg:px-3"
          >
            Staff Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const staff = row.original
        return (
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-[#601625] flex items-center justify-center">
              <span className="text-white font-normal text-sm">
                {staff.staffName.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="font-normal text-slate-700">{staff.staffName}</span>
          </div>
        )
      },
    },
    {
      accessorKey: "totalRevenue",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 lg:px-3"
          >
            Revenue
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue("totalRevenue"))
        return <div className="text-right font-normal text-[#601625]">{formatCurrency(amount)}</div>
      },
    },
    {
      accessorKey: "totalServices",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 lg:px-3"
          >
            Services
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        return <div className="text-right font-normal text-slate-600">{Math.round(row.getValue("totalServices"))}</div>
      },
    },
    {
      accessorKey: "avgRating",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 lg:px-3"
          >
            Rating
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const rating = row.getValue("avgRating") as number
        return (
          <div className="text-right">
            <Badge 
              variant={rating >= 4.5 ? "default" : rating >= 4.0 ? "secondary" : "outline"}
              className="text-xs"
            >
              {rating.toFixed(1)}★
            </Badge>
          </div>
        )
      },
    },
    {
      accessorKey: "efficiency",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 lg:px-3"
          >
            Efficiency
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        return <div className="text-right font-normal text-slate-600">{row.getValue("efficiency")}%</div>
      },
    },
  ]

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  })

  return (
    <div className="w-full">
      <div className="overflow-hidden rounded-xl border border-neutral-200">
        <Table className="table-fixed w-full">
          <TableHeader className="bg-[#601625]/5">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header, index) => {
                  const widthClass = index === 0 ? "w-1/4" : index === 1 ? "w-1/6" : index === 2 ? "w-1/8" : index === 3 ? "w-1/8" : "w-1/6"
                  return (
                    <TableHead key={header.id} className={`text-[#601625] font-normal ${widthClass}`}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={`hover:bg-[#601625]/5 cursor-pointer transition-colors ${
                    selectedStaff === row.original.staffId ? 'bg-[#601625]/10' : ''
                  }`}
                  onClick={() => onStaffSelect(selectedStaff === row.original.staffId ? null : row.original.staffId)}
                >
                  {row.getVisibleCells().map((cell, index) => {
                    const widthClass = index === 0 ? "w-1/4" : index === 1 ? "w-1/6" : index === 2 ? "w-1/8" : index === 3 ? "w-1/8" : "w-1/6"
                    return (
                      <TableCell key={cell.id} className={`border-r border-[#601625]/10 last:border-r-0 ${widthClass}`}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No staff data available.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
