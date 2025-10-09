"use client"

import * as React from "react"
import { Clock, UsersRound, Settings, LayoutDashboard as IconDashboard, Scissors, Calendar as CalendarIcon, CreditCard, BarChart3 } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { supabase } from "@/lib/supabase"
import { useTeam } from "@/contexts/team-context"
import { useUser } from "@/contexts/user-context"

// This is sample data.
const data = {
  user: {
    name: "Sutej",
    email: "sutej@autgraph.com",
    avatar: "/avatars/shadcn.jpg",
  },
  projects: [],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [authUser, setAuthUser] = React.useState<{ name: string; email: string; avatar: string }>(
    data.user
  )
  const { getTeamPrefix } = useTeam()
  const { user } = useUser()

  React.useEffect(() => {
    let isMounted = true
    supabase.auth.getUser().then(({ data: result }) => {
      const u = result.user
      if (!u || !isMounted) return
      const meta = (u.user_metadata || {}) as Record<string, unknown>
      const fullName = (meta.full_name as string) || (meta.name as string) || ""
      const derivedName = fullName || (u.email ? String(u.email).split("@")[0] : data.user.name)
      const avatarUrl =
        (meta.avatar_url as string) || (meta.picture as string) || data.user.avatar || ""
      setAuthUser({
        name: derivedName,
        email: u.email || data.user.email,
        avatar: avatarUrl,
      })
    })
    return () => {
      isMounted = false
    }
  }, [])

  // Generate navigation items based on current team
  const navMain = React.useMemo(() => {
    const prefix = getTeamPrefix()
    
    // Create base items array with proper typing
    const baseItems: {
      title: string
      url: string
      icon?: LucideIcon
      items?: { title: string; url: string }[]
      isSeparator?: boolean
    }[] = [
      // Primary navigation
      {
        title: "Calendar",
        url: `${prefix}/calendar`,
        icon: CalendarIcon,
      },
      {
        title: "Payments",
        url: `${prefix}/payments`,
        icon: CreditCard,
      },
      // Separator
      {
        title: "separator-1",
        url: "#",
        isSeparator: true,
      },
      // Secondary navigation
      {
        title: "Appointments",
        url: `${prefix}/appointments`,
        icon: Clock,
      },
    ]

    // Add customers for non-barbers
    if (user?.role !== 'barber') {
      baseItems.push({
        title: "Customers",
        url: `${prefix}/customers`,
        icon: UsersRound,
      })
    }

    baseItems.push({
      title: "Reports",
      url: `${prefix}/dashboard`,
      icon: IconDashboard,
    })

    // Add separator before Manage
    baseItems.push({
      title: "separator-2",
      url: "#",
      isSeparator: true,
    })

    // Add manage section based on role
    if (user?.role === 'barber') {
      const myHoursUrl = user?.ghlId ? `${prefix}/manage/staff-hours/${user.ghlId}` : `${prefix}/manage/staff-hours`
      baseItems.push({
        title: "Manage",
        url: "#",
        icon: Settings,
        items: [
          { title: "Hours", url: myHoursUrl },
          { title: "Holidays", url: `${prefix}/manage/leaves` },
          { title: "Breaks", url: `${prefix}/manage/breaks` },
        ],
      })
    } else {
      const manageItems = [
        { title: "Services", url: `${prefix}/manage/services` },
        { title: "Salon Hours", url: `${prefix}/manage/salon-hours` },
        { title: "Stylists", url: `${prefix}/manage/stylists` },
        { title: "Holidays", url: `${prefix}/manage/leaves` },
        { title: "Breaks", url: `${prefix}/manage/breaks` },
      ]
      
      if (user?.role === "admin") {
        manageItems.push({ title: "Admin", url: "/teams" })
      }
      
      baseItems.push({
        title: "Manage",
        url: "#",
        icon: Settings,
        items: manageItems,
      })
    }

    return baseItems
  }, [getTeamPrefix, user?.role, user?.ghlId])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={authUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
