"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import NextImage from "next/image"
import { useUser } from "./user-context"

const LogoComponent = () => (
  <NextImage src="/logo.png" alt="Restyle" width={120} height={40} className="h-6 w-auto" />
)

type Team = {
  name: string
  logo: React.ComponentType
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
    name: "Restyle",
    logo: LogoComponent,
    plan: "",
    prefix: ""
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

    // Always use the main team since there's only one
    setCurrentTeam(teams[0])

    // Redirect to dashboard if user doesn't have access to current page
    if (!userHasAccessToTeam("")) {
      router.push("/login")
    }
  }, [pathname, user, userHasAccessToTeam, router])

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
