"use client"
import { AppSidebar } from "@/components/app-sidebar"
import { RoleGuard } from "@/components/role-guard"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useEffect, useMemo, useState } from "react"

// Local date parser to handle legacy formats
function parseMaybe(dateString: string | null | undefined): Date | null {
  if (!dateString) return null
  const d = new Date(dateString)
  return isNaN(d.getTime()) ? null : d
}

export default function Page() {
  const [loading, setLoading] = useState(true)
  type Staff = Record<string, unknown>
  type Leave = Record<string, unknown>
  type Block = Record<string, unknown>
  const [staff, setStaff] = useState<Staff[]>([])
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [blocks, setBlocks] = useState<Block[]>([])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [staffRes, leavesRes, blocksRes] = await Promise.all([
        fetch('/api/barber-hours'),
        fetch('/api/leaves'),
        fetch('/api/time-blocks')
      ])
      const [staffJson, leavesJson, blocksJson] = await Promise.all([
        staffRes.json(), leavesRes.json(), blocksRes.json()
      ])
      setStaff(staffJson?.data || [])
      setLeaves(leavesJson?.data || [])
      setBlocks(blocksJson?.data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const todayKey = useMemo(() => new Date().toDateString(), [])

  const kpis = useMemo(() => {
    const now = new Date()
    // Staff
    const totalStaff = staff.length

    // Working today: has non-zero start/end for today's weekday
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
    const dayName = days[new Date().getDay()]
    const workingToday = staff.filter((s) => {
      const start = String(s[`${dayName}/Start Value`] ?? '0')
      const end = String(s[`${dayName}/End Value`] ?? '0')
      return start !== '0' && end !== '0'
    }).length

    // Leaves
    const activeLeaves = leaves.filter((l) => {
      const startValue = l["Event/Start"]
      const endValue = l["Event/End"]
      const start = parseMaybe(typeof startValue === 'string' ? startValue : String(startValue || ''))
      const end = parseMaybe(typeof endValue === 'string' ? endValue : String(endValue || ''))
      return start && end && now >= start && now <= end
    }).length

    const upcomingLeaves7 = leaves.filter((l) => {
      const startValue = l["Event/Start"]
      const start = parseMaybe(typeof startValue === 'string' ? startValue : String(startValue || ''))
      if (!start) return false
      const diffDays = Math.floor((start.getTime() - now.getTime()) / (1000*60*60*24))
      return diffDays >= 0 && diffDays <= 7
    }).length

    // Breaks
    const recurringBlocks = blocks.filter((b) => String(b['Block/Recurring']) === 'true').length

    const todaysOneTimeBreaks = blocks.filter((b) => {
      if (String(b['Block/Recurring']) === 'true') return false
      const dateValue = b['Block/Date']
      const d = parseMaybe(typeof dateValue === 'string' ? dateValue : String(dateValue || ''))
      return d?.toDateString() === todayKey
    }).length

    return { totalStaff, workingToday, activeLeaves, upcomingLeaves7, recurringBlocks, todaysOneTimeBreaks }
  }, [staff, leaves, blocks, todayKey])

  return (
    <RoleGuard requiredTeamPrefix="">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <h1 className="text-xl font-semibold">Dashboard</h1>
          </div>
        </header>

          <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
            {/* KPI cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <Card>
                <CardHeader>
                  <CardTitle>Total Staff</CardTitle>
                  <CardDescription>All active staff</CardDescription>
                </CardHeader>
                <CardContent>{loading ? <Skeleton className="h-8 w-16"/> : <div className="text-2xl font-semibold">{kpis.totalStaff}</div>}</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Working Today</CardTitle>
                  <CardDescription>Scheduled with hours</CardDescription>
                </CardHeader>
                <CardContent>{loading ? <Skeleton className="h-8 w-16"/> : <div className="text-2xl font-semibold">{kpis.workingToday}</div>}</CardContent>
              </Card>
            <Card>
              <CardHeader>
                  <CardTitle>Active Leaves</CardTitle>
                  <CardDescription>Currently on leave</CardDescription>
              </CardHeader>
                <CardContent>{loading ? <Skeleton className="h-8 w-16"/> : <div className="text-2xl font-semibold">{kpis.activeLeaves}</div>}</CardContent>
            </Card>
            <Card>
              <CardHeader>
                  <CardTitle>Upcoming Leaves (7d)</CardTitle>
                  <CardDescription>Starting within a week</CardDescription>
              </CardHeader>
                <CardContent>{loading ? <Skeleton className="h-8 w-24"/> : <div className="text-2xl font-semibold">{kpis.upcomingLeaves7}</div>}</CardContent>
            </Card>
            <Card>
              <CardHeader>
                  <CardTitle>Recurring Breaks</CardTitle>
                  <CardDescription>Configured weekly blocks</CardDescription>
              </CardHeader>
                <CardContent>{loading ? <Skeleton className="h-8 w-20"/> : <div className="text-2xl font-semibold">{kpis.recurringBlocks}</div>}</CardContent>
            </Card>
            <Card>
              <CardHeader>
                  <CardTitle>Today’s One-time Breaks</CardTitle>
                  <CardDescription>Special day blocks</CardDescription>
              </CardHeader>
                <CardContent>{loading ? <Skeleton className="h-8 w-28"/> : <div className="text-2xl font-semibold">{kpis.todaysOneTimeBreaks}</div>}</CardContent>
            </Card>
          </div>

            {/* Empty content area for future widgets */}
            <Card>
              <CardHeader>
                <CardTitle>Overview</CardTitle>
                <CardDescription>KPIs based on staff hours, breaks, and leaves</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  This dashboard has been simplified to KPI cards. Add charts or tables here later as needed.
                </div>
              </CardContent>
            </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
    </RoleGuard>
  )
}
