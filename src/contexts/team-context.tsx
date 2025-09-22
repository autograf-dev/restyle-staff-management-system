"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Scale, FlaskConical, Building2 } from "lucide-react"
import { useUser } from "./user-context"

type Team = {
  name: string
  logo: React.ElementType
  plan: string
  prefix: string
}

type TeamContextType = {
  currentTeam: Team
  setCurrentTeam: (team: Team) => void
  getTeamPrefix: () => string
  getTeamDashboardUrl: () => string
  availableTeams: Team[]
  hasAccessToTeam: (teamPrefix: string) => boolean
}

const TeamContext = createContext<TeamContextType | undefined>(undefined)

const teams: Team[] = [
  {
    name: "Lawyer Vantage",
    logo: Scale,
    plan: "LawFirm",
    prefix: ""
  },
  {
    name: "Lawyer Vantage Legal Lab",
    logo: FlaskConical,
    plan: "Legal Lab",
    prefix: "/lab"
  },
  {
    name: "Lawyer Vantage Tc Legal",
    logo: Building2,
    plan: "Tc Legal",
    prefix: "/legal"
  }
]

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const [currentTeam, setCurrentTeam] = useState<Team>(teams[0])
  const router = useRouter()
  const pathname = usePathname()
  const { user, hasAccessToTeam: userHasAccessToTeam } = useUser()

  // Filter teams based on user role
  const availableTeams = teams.filter(team => userHasAccessToTeam(team.prefix))

  // Initialize team based on current path and user access
  useEffect(() => {
    if (!user) return

    let targetTeam: Team | null = null

    // Admin-only pages that don't need team context
    const adminOnlyPages = ["/teams", "/profile"]
    if (user.role === "admin" && adminOnlyPages.some(page => pathname.startsWith(page))) {
      // For admin-only pages, set the main team but don't redirect
      targetTeam = teams[0]
      setCurrentTeam(targetTeam)
      return
    }

    if (pathname.startsWith("/lab") && userHasAccessToTeam("/lab")) {
      targetTeam = teams[1]
    } else if (pathname.startsWith("/legal") && userHasAccessToTeam("/legal")) {
      targetTeam = teams[2]
    } else if ((pathname === "/" || pathname.startsWith("/dashboard") || pathname.startsWith("/contacts") || pathname.startsWith("/opportunities")) && userHasAccessToTeam("")) {
      targetTeam = teams[0]
    }

    // If no valid team found, redirect based on user role
    if (!targetTeam && availableTeams.length > 0) {
      if (user.role === "legal") {
        // Legal users go to legal dashboard
        targetTeam = teams[2]
        router.push("/legal/dashboard")
      } else if (user.role === "labs") {
        // Labs users go to labs dashboard
        targetTeam = teams[1]
        router.push("/lab/dashboard")
      } else {
        // Admin users go to main dashboard
        targetTeam = teams[0]
        router.push("/dashboard")
      }
    }

    if (targetTeam) {
      setCurrentTeam(targetTeam)
    }
  }, [pathname, user, availableTeams, userHasAccessToTeam, router])

  const getTeamPrefix = () => currentTeam.prefix

  const getTeamDashboardUrl = () => {
    return currentTeam.prefix + "/dashboard"
  }

  const handleSetCurrentTeam = (team: Team) => {
    if (!userHasAccessToTeam(team.prefix)) {
      console.warn("User does not have access to this team")
      return
    }
    setCurrentTeam(team)
    // Navigate to the team's dashboard
    const dashboardUrl = team.prefix + "/dashboard"
    router.push(dashboardUrl)
  }

  return (
    <TeamContext.Provider
      value={{
        currentTeam,
        setCurrentTeam: handleSetCurrentTeam,
        getTeamPrefix,
        getTeamDashboardUrl,
        availableTeams,
        hasAccessToTeam: userHasAccessToTeam,
      }}
    >
      {children}
    </TeamContext.Provider>
  )
}

export function useTeam() {
  const context = useContext(TeamContext)
  if (context === undefined) {
    throw new Error("useTeam must be used within a TeamProvider")
  }
  return context
}

export { teams }
