"use client"
import { AppSidebar } from "@/components/app-sidebar"
import { RoleGuard } from "@/components/role-guard"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import { TrendingUp } from "lucide-react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart"

type Contact = {
  id: string
  contactName: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  dateAdded: string
}

function useContacts() {
  const [data, setData] = useState<Contact[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchContacts = async () => {
    setLoading(true)
    try {
      const res = await fetch("https://lawyervantage-legallab.netlify.app/.netlify/functions/getContacts")
      if (!res.ok) throw new Error("Failed to fetch contacts")
      const json = await res.json()
      const arr = (json?.contacts?.contacts || []) as Array<Partial<Contact>>
      const mapped: Contact[] = arr.map((c) => ({
        id: String(c?.id ?? ""),
        contactName: (c?.contactName as string) || `${(c?.firstName as string) || ""} ${(c?.lastName as string) || ""}`.trim(),
        firstName: (c?.firstName as string) || "",
        lastName: (c?.lastName as string) || "",
        email: (c?.email as string) || null,
        phone: (c?.phone as string) || null,
        dateAdded: (c?.dateAdded as string) || new Date().toISOString(),
      }))
      setData(mapped)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchContacts()
  }, [])

  return { data, loading, error }
}

type Opportunity = {
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
}

function useOpportunities() {
  const [data, setData] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOps = async () => {
    setLoading(true)
    try {
      const res = await fetch("https://lawyervantage.netlify.app/.netlify/functions/getOpportunities")
      if (!res.ok) throw new Error("Failed to fetch opportunities")
      const json = await res.json()
      const arr = (json?.opportunities?.opportunities || []) as RawOpportunity[]
      const mapped: Opportunity[] = arr.map((o) => ({
        id: String(o.id ?? ""),
        name: String(o.name ?? ""),
        monetaryValue: Number(o.monetaryValue ?? 0),
        status: String(o.status ?? "open"),
        createdAt: String(o.createdAt ?? new Date().toISOString()),
        updatedAt: String(o.updatedAt ?? new Date().toISOString()),
      }))
      setData(mapped)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOps()
  }, [])

  return { data, loading, error }
}

export default function Page() {
  const { data: contacts, loading: loadingContacts } = useContacts()
  const { data: opportunities, loading: loadingOpps } = useOpportunities()
  const loading = loadingContacts || loadingOpps

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user
      if (!u) {
        window.location.href = "/login"
        return
      }
    })
  }, [])

  const kpis = useMemo(() => {
    const totalContacts = contacts.length
    const totalOpps = opportunities.length
    const openOpps = opportunities.filter((o) => o.status.toLowerCase() === "open").length
    const wonOpps = opportunities.filter((o) => o.status.toLowerCase() === "won").length
    const totalOppsValue = opportunities.reduce((sum, o) => sum + (Number.isFinite(o.monetaryValue) ? o.monetaryValue : 0), 0)
    const recentOpps = [...opportunities]
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
      .slice(0, 5)
    return { totalContacts, totalOpps, openOpps, wonOpps, totalOppsValue, recentOpps }
  }, [contacts, opportunities])

  // Build last 14 days series for Contacts created and Opportunities created
  const chartSeries = useMemo(() => {
    const makeDays = (n: number) => {
      const out: { key: string; label: string }[] = []
      const date = new Date()
      for (let i = n - 1; i >= 0; i--) {
        const d = new Date(date.getTime() - i * 24 * 60 * 60 * 1000)
        const key = d.toISOString().slice(0, 10)
        const label = d.toLocaleString(undefined, { month: "short", day: "numeric" })
        out.push({ key, label })
      }
      return out
    }
    const days = makeDays(14)
    const contactCounts = days.map((d) => contacts.filter((c) => (c.dateAdded || "").slice(0, 10) === d.key).length)
    const oppCounts = days.map((d) => opportunities.filter((o) => (o.createdAt || "").slice(0, 10) === d.key).length)
    return {
      labels: days.map((d) => d.label),
      keys: days.map((d) => d.key),
      contacts: contactCounts,
      opportunities: oppCounts,
    }
  }, [contacts, opportunities])

  const chartData = useMemo(() => {
    const data = chartSeries.labels.map((label, i) => ({
      day: label,
      contacts: chartSeries.contacts[i] || 0,
      opportunities: chartSeries.opportunities[i] || 0,
    }))
    
    console.log('Chart data:', data) // Debug log
    return data
  }, [chartSeries])

  const chartConfig: ChartConfig = {
    contacts: { label: "Contacts", color: "#3b82f6" },
    opportunities: { label: "Opportunities", color: "#10b981" },
  }
  return (
    <RoleGuard requiredTeamPrefix="/lab">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle>Total contacts</CardTitle>
                <CardDescription>All contacts</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-semibold">{kpis.totalContacts.toLocaleString()}</div>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Total opportunities</CardTitle>
                <CardDescription>All opportunities</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-semibold">{kpis.totalOpps.toLocaleString()}</div>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Open</CardTitle>
                <CardDescription>Currently active</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-semibold">{kpis.openOpps}</div>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Won</CardTitle>
                <CardDescription>Closed won</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-semibold">{kpis.wonOpps}</div>}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Contacts vs Opportunities (last 14 days)</CardTitle>
                <CardDescription>Daily activity over the past two weeks</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <div className="h-[400px] w-full">
                    <ChartContainer config={chartConfig} className="h-full w-full">
                      <LineChart 
                        data={chartData} 
                        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                        width={500}
                        height={400}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis 
                          dataKey="day" 
                          tick={{ fontSize: 10, fill: "#666" }}
                          interval={0}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis 
                          tick={{ fontSize: 10, fill: "#666" }}
                          axisLine={false}
                          tickLine={false}
                          tickCount={6}
                        />
                        <ChartTooltip 
                          content={<ChartTooltipContent />}
                        />
                        <Line
                          type="monotone"
                          dataKey="contacts"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 6, stroke: "#3b82f6", strokeWidth: 2 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="opportunities"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={{ fill: "#10b981", strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 6, stroke: "#10b981", strokeWidth: 2 }}
                        />
                      </LineChart>
                    </ChartContainer>
                  </div>
                )}
                <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
                  Daily activity <TrendingUp className="h-3.5 w-3.5" />
                </div>
              </CardContent>
            </Card>

            <div className="col-span-1 space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Recent contacts</CardTitle>
                    <CardDescription>Newest 3 contacts</CardDescription>
                  </div>
                  <Link href="/lab/contacts" className="text-sm font-medium underline underline-offset-4">View all</Link>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Added</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          Array.from({ length: 3 }).map((_, i) => (
                            <TableRow key={i}>
                              <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                              <TableCell><Skeleton className="h-4 w-52" /></TableCell>
                              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                            </TableRow>
                          ))
                        ) : contacts.length ? (
                          [...contacts]
                            .sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime())
                            .slice(0, 3)
                            .map((c) => (
                              <TableRow key={c.id}>
                                <TableCell className="capitalize">{(c.contactName || `${c.firstName} ${c.lastName}`).toLowerCase()}</TableCell>
                                <TableCell className="lowercase">{c.email || "-"}</TableCell>
                                <TableCell>{new Date(c.dateAdded).toLocaleString()}</TableCell>
                              </TableRow>
                            ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center">No contacts found.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Recent opportunities</CardTitle>
                    <CardDescription>Newest 3 opportunities</CardDescription>
                  </div>
                  <Link href="/lab/opportunities" className="text-sm font-medium underline underline-offset-4">View all</Link>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Updated</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          Array.from({ length: 3 }).map((_, i) => (
                            <TableRow key={i}>
                              <TableCell><Skeleton className="h-4 w-52" /></TableCell>
                              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                            </TableRow>
                          ))
                        ) : kpis.recentOpps.length ? (
                          kpis.recentOpps.slice(0, 3).map((o) => (
                            <TableRow key={o.id}>
                              <TableCell>{o.name}</TableCell>
                              <TableCell className="capitalize">{o.status}</TableCell>
                              <TableCell>{new Date(o.updatedAt || o.createdAt).toLocaleString()}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center">No opportunities found.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
    </RoleGuard>
  )
}
