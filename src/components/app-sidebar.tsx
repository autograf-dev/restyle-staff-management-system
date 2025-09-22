"use client"

import * as React from "react"
import { Infinity, Clock, UsersRound, Settings, LayoutDashboard as IconDashboard, Users, Scissors } from "lucide-react"
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
    const items: {
      title: string
      url: string
      icon?: LucideIcon
      isActive?: boolean
      items?: { title: string; url: string }[]
    }[] = [
      {
        title: "Dashboard",
        url: `${prefix}/dashboard`,
        icon: IconDashboard,
        isActive: false,
      },
      {
        title: "Appointments",
        url: `${prefix}/appointments`,
        icon: Clock,
        isActive: false,
      },
      {
        title: "Customers",
        url: `${prefix}/customers`,
        icon: UsersRound,
        isActive: false,
      },
    ]

    // Add Teams menu item only for admin users (before Settings)
    if (user?.role === "admin") {
      items.push({
        title: "Teams",
        url: "/teams",
        icon: Scissors,
        isActive: false,
      })
    }

    // Add Settings as the last item with isActive: true to open by default
    items.push({
      title: "Settings",
      url: "#",
      icon: Settings,
      isActive: true,
      items: [
        {
          title: "Salon Hours",
          url: `${prefix}/settings/salon-hours`,
        },
        {
          title: "Salon Staff",
          url: `${prefix}/settings/salon-staff`,
        },
        {
          title: "Staff Hours",
          url: `${prefix}/settings/staff-hours`,
        },
        {
          title: "Leaves",
          url: `${prefix}/settings/leaves`,
        },
        {
          title: "Breaks",
          url: `${prefix}/settings/breaks`,
        },
      ],
    })

    return items
  }, [getTeamPrefix, user?.role])

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
