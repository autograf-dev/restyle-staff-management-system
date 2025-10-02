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

export type ServiceRevenue = {
  name: string
  revenue: number
  count: number
  avgPrice: number
}

interface ServicesRevenueTableProps {
  data: ServiceRevenue[]
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

export function ServicesRevenueTable({ data }: ServicesRevenueTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([])

  const columns: ColumnDef<ServiceRevenue>[] = React.useMemo(() => [
    {
      accessorKey: "name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 lg:px-3"
          >
            Service Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const service = row.original
        const index = data.findIndex(s => s.name === service.name)
        return (
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-[#601625] flex items-center justify-center">
              <span className="text-white font-normal text-sm">{index + 1}</span>
            </div>
            <span className="font-normal text-slate-700">{service.name}</span>
          </div>
        )
      },
    },
    {
      accessorKey: "count",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 lg:px-3"
          >
            Bookings
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        return <div className="text-right font-normal text-slate-600">{row.getValue("count")}</div>
      },
    },
    {
      accessorKey: "avgPrice",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 lg:px-3"
          >
            Price
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue("avgPrice"))
        return <div className="text-right font-normal text-slate-600">{formatCurrency(amount)}</div>
      },
    },
    {
      accessorKey: "revenue",
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
        const amount = parseFloat(row.getValue("revenue"))
        return <div className="text-right font-normal text-[#601625]">{formatCurrency(amount)}</div>
      },
    },
  ], [data])

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
                  const widthClass = index === 0 ? "w-2/5" : index === 1 ? "w-1/6" : "w-1/5"
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
                  className="hover:bg-[#601625]/5 transition-colors"
                >
                  {row.getVisibleCells().map((cell, index) => {
                    const widthClass = index === 0 ? "w-2/5" : index === 1 ? "w-1/6" : "w-1/5"
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
                  No service data available.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}