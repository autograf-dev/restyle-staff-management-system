"use client"

import * as React from "react"
import Link from "next/link"
import {
  Clock,
  UsersRound,
  Settings,
  LayoutDashboard as IconDashboard,
  Calendar as CalendarIcon,
  CreditCard,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

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

// Accent used in the rest of your app
const ACCENT = "#601625"

type Item = {
  title: string
  url: string
  icon?: LucideIcon
}

type ManageItem = { title: string; url: string }

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-6 pb-2 text-[12px] font-semibold tracking-wide text-neutral-500 select-none">
      {children}
      <div className="mt-2 h-px w-full bg-neutral-200/70" />
    </div>
  )
}

function NavLink({ href, icon: Icon, children }: { href: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="mx-2 my-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium text-neutral-800 hover:bg-neutral-100/90 transition-colors"
    >
      <span
        className="flex h-8 w-8 items-center justify-center rounded-lg"
        style={{ backgroundColor: "rgba(96, 22, 37, 0.08)", color: ACCENT }}
      >
        <Icon size={16} />
      </span>
      <span className="truncate">{children}</span>
    </Link>
  )
}

function SubNavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="mx-4 my-1.5 block rounded-lg px-3 py-2 text-[14px] text-neutral-800 hover:bg-neutral-100/70 transition-colors"
    >
      {children}
    </Link>
  )
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const [authUser, setAuthUser] = React.useState<{ name: string; email: string; avatar: string }>({
    name: "Sutej",
    email: "sutej@autgraph.com",
    avatar: "/avatars/shadcn.jpg",
  })

  const { getTeamPrefix } = useTeam()
  const { user } = useUser()
  const [manageOpen, setManageOpen] = React.useState(true)

  // ---- unchanged auth logic ----
  React.useEffect(() => {
    let isMounted = true
    supabase.auth.getUser().then(({ data: result }) => {
      const u = result.user
      if (!u || !isMounted) return
      const meta = (u.user_metadata || {}) as Record<string, unknown>
      const fullName = (meta.full_name as string) || (meta.name as string) || ""
      const derivedName = fullName || (u.email ? String(u.email).split("@")[0] : "Sutej")
      const avatarUrl = (meta.avatar_url as string) || (meta.picture as string) || "/avatars/shadcn.jpg"
      setAuthUser({ name: derivedName, email: u.email || "sutej@autgraph.com", avatar: avatarUrl })
    })
    return () => {
      isMounted = false
    }
  }, [])
  // --------------------------------

  // Build URLs (unchanged logic)
  const prefix = getTeamPrefix()

  // Today
  const todayItems: Item[] = [
    { title: "Calendar", url: `${prefix}/calendar`, icon: CalendarIcon },
    { title: "Payments", url: `${prefix}/payments`, icon: CreditCard },
  ]

  // View
  const viewItems: Item[] = [
    { title: "Appointments", url: `${prefix}/appointments`, icon: Clock },
    ...(user?.role !== "barber" ? [{ title: "Customers", url: `${prefix}/customers`, icon: UsersRound }] : []),
    { title: "Reports", url: `${prefix}/dashboard`, icon: IconDashboard },
  ]

  // Manage
  const manageItems: ManageItem[] =
    user?.role === "barber"
      ? [
          { title: "Hours", url: user?.ghlId ? `${prefix}/manage/staff-hours/${user.ghlId}` : `${prefix}/manage/staff-hours` },
          { title: "Holidays", url: `${prefix}/manage/leaves` },
          { title: "Breaks", url: `${prefix}/manage/breaks` },
        ]
      : [
          { title: "Services", url: `${prefix}/manage/services` },
          { title: "Salon Hours", url: `${prefix}/manage/salon-hours` },
          { title: "Stylists", url: `${prefix}/manage/stylists` },
          { title: "Holidays", url: `${prefix}/manage/leaves` },
          { title: "Breaks", url: `${prefix}/manage/breaks` },
          ...(user?.role === "admin" ? [{ title: "Admin", url: "/teams" }] : []),
        ]

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="pb-3">
        <div className="px-2 pt-3">
          <TeamSwitcher />
        </div>
      </SidebarHeader>

      <SidebarContent className="pb-2">
        {/* TODAY */}
        <SectionLabel>Today</SectionLabel>
        <nav className="mt-1">
          {todayItems.map((it) => (
            <NavLink key={it.title} href={it.url} icon={it.icon!}>
              {it.title}
            </NavLink>
          ))}
        </nav>

        {/* VIEW */}
        <SectionLabel>View</SectionLabel>
        <nav className="mt-1">
          {viewItems.map((it) => (
            <NavLink key={it.title} href={it.url} icon={it.icon!}>
              {it.title}
            </NavLink>
          ))}
        </nav>

        {/* MANAGE */}
        <SectionLabel>Manage</SectionLabel>
        <div className="mx-2 mt-1 rounded-xl border border-neutral-200/70 bg-white/70">
          <button
            onClick={() => setManageOpen((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2.5 text-[14px] font-semibold text-neutral-800"
          >
            <span className="inline-flex items-center gap-3">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ backgroundColor: "rgba(96, 22, 37, 0.08)", color: ACCENT }}
              >
                <Settings size={16} />
              </span>
              Manage
            </span>
            {manageOpen ? <ChevronDown size={16} className="text-neutral-500" /> : <ChevronRight size={16} className="text-neutral-500" />}
          </button>

          {manageOpen && (
            <div className="pb-2">
              {manageItems.map((it) => (
                <SubNavLink key={it.title} href={it.url}>
                  {it.title}
                </SubNavLink>
              ))}
            </div>
          )}
        </div>
      </SidebarContent>

      <SidebarFooter className="border-t border-neutral-200/70 pt-3">
        <div className="px-2">
          <NavUser user={authUser} />
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}