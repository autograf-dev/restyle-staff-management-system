"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Clock,
  UsersRound,
  Settings,
  LayoutDashboard as IconDashboard,
  Calendar as CalendarIcon,
  CreditCard,
  ChevronDown,
  ChevronRight,
  Scissors,
  CalendarDays,
  AlarmClock,
  Coffee,
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

const ACCENT = "#601625"

type Item = { title: string; url: string; icon: LucideIcon }
type ManageItem = { title: string; url: string; icon: LucideIcon }

/* ---------------- Section heading with a line through the middle --------------- */
function SectionHeading({
  children,
  action,
}: {
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="px-3 pt-5">
      <div className="flex items-center gap-2">
        {/* The label + the line that continues from its RIGHT, aligned to center */}
        <span className="relative inline-flex items-center text-[12px] font-semibold text-black tracking-wide">
          <span className="relative">
            {children}
            {/* extend line from the middle-right of the word */}
            <span className="absolute left-full top-1/2 ml-2 h-px w-[9999px] -translate-y-1/2 bg-neutral-200" />
          </span>
        </span>
        {action ? <div className="ml-auto">{action}</div> : null}
      </div>
    </div>
  )
}

/* --------------------------- Main link (with icon) ---------------------------- */
function NavLink({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string
  icon: LucideIcon
  label: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={[
        "mx-2 my-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors",
        active
          ? "bg-[#601625]/10 text-black ring-1 ring-[#601625]/20"
          : "text-neutral-800 hover:bg-neutral-100/90",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-8 w-8 items-center justify-center rounded-lg",
          active ? "bg-[#601625]/15" : "bg-neutral-100",
        ].join(" ")}
        style={{ color: ACCENT }}
      >
        <Icon size={16} />
      </span>
      <span className="truncate">{label}</span>
      {active && <span className="ml-auto h-2 w-2 rounded-full" style={{ background: ACCENT }} />}
    </Link>
  )
}

/* ------------------------- Manage sublink (with icon) ------------------------- */
function SubNavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string
  label: string
  icon: LucideIcon
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={[
        "mx-3 my-1.5 flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition-colors",
        active
          ? "bg-[#601625]/10 text-black ring-1 ring-[#601625]/15"
          : "text-neutral-800 hover:bg-neutral-100/70",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-7 w-7 items-center justify-center rounded-md",
          active ? "bg-[#601625]/15" : "bg-neutral-100",
        ].join(" ")}
        style={{ color: ACCENT }}
      >
        <Icon size={15} />
      </span>
      <span className="truncate">{label}</span>
    </Link>
  )
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const [authUser, setAuthUser] = React.useState<{ name: string; email: string; avatar: string }>({
    name: "Sutej",
    email: "sutej@autgraph.com",
    avatar: "/avatars/shadcn.jpg",
  })

  const { getTeamPrefix } = useTeam()
  const { user } = useUser()
  const [manageOpen, setManageOpen] = React.useState(true)

  /* -------------------------- unchanged auth logic -------------------------- */
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
  /* ------------------------------------------------------------------------- */

  const prefix = getTeamPrefix()
  const isActive = (url: string) =>
    url === "/" ? pathname === "/" : pathname === url || pathname.startsWith(url + "/")

  // Today
  const todayItems: Item[] = [
    { title: "Calendar", url: `${prefix}/calendar`, icon: CalendarIcon },
    { title: "Overview", url: `${prefix}/today/dashboard`, icon: IconDashboard },
  ]

  // View
  const viewItems: Item[] = [
    { title: "Payments", url: `${prefix}/payments`, icon: CreditCard },
    { title: "Appointments", url: `${prefix}/appointments`, icon: Clock },
    ...(user?.role !== "barber" ? [{ title: "Customers", url: `${prefix}/customers`, icon: UsersRound }] : []),
    { title: "Reports", url: `${prefix}/dashboard`, icon: IconDashboard },
  ]

  // Manage (same routing logic, now with icons)
  const manageItems: ManageItem[] =
    user?.role === "barber"
      ? [
          {
            title: "Hours",
            url: user?.ghlId ? `${prefix}/manage/staff-hours/${user.ghlId}` : `${prefix}/manage/staff-hours`,
            icon: AlarmClock,
          },
          { title: "Holidays", url: `${prefix}/manage/leaves`, icon: CalendarDays },
          { title: "Breaks", url: `${prefix}/manage/breaks`, icon: Coffee },
        ]
      : [
          { title: "Services", url: `${prefix}/manage/services`, icon: Scissors },
          { title: "Salon Hours", url: `${prefix}/manage/salon-hours`, icon: AlarmClock },
          { title: "Stylists", url: `${prefix}/manage/stylists`, icon: UsersRound },
          { title: "Holidays", url: `${prefix}/manage/leaves`, icon: CalendarDays },
          { title: "Breaks", url: `${prefix}/manage/breaks`, icon: Coffee },
          ...(user?.role === "admin" ? [{ title: "Admin", url: "/teams", icon: Settings }] : []),
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
        <SectionHeading>Today's</SectionHeading>
        <nav className="mt-1">
          {todayItems.map((it) => (
            <NavLink key={it.title} href={it.url} icon={it.icon} label={it.title} active={isActive(it.url)} />
          ))}
        </nav>

        {/* VIEW */}
        <SectionHeading>View</SectionHeading>
        <nav className="mt-1">
          {viewItems.map((it) => (
            <NavLink key={it.title} href={it.url} icon={it.icon} label={it.title} active={isActive(it.url)} />
          ))}
        </nav>

        {/* MANAGE (header contains the collapse control, no duplicate title below) */}
        <SectionHeading
          action={
            <button
              onClick={() => setManageOpen((v) => !v)}
              className="group inline-flex h-6 w-6 items-center justify-center rounded-md hover:bg-neutral-100"
              aria-label={manageOpen ? "Collapse Manage" : "Expand Manage"}
              title={manageOpen ? "Collapse" : "Expand"}
            >
              {manageOpen ? (
                <ChevronDown size={16} className="text-neutral-600 group-hover:text-black" />
              ) : (
                <ChevronRight size={16} className="text-neutral-600 group-hover:text-black" />
              )}
            </button>
          }
        >
          Manage
        </SectionHeading>

        {manageOpen && (
          <div className="mt-2">
            {manageItems.map((it) => (
              <SubNavLink
                key={it.title}
                href={it.url}
                label={it.title}
                icon={it.icon}
                active={isActive(it.url)}
              />
            ))}
          </div>
        )}
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