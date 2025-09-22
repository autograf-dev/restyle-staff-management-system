"use client"

import { useUser } from "@/contexts/user-context"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

interface RoleGuardProps {
  children: React.ReactNode
  requiredRole?: "admin" | "legal" | "labs"
  requiredTeamPrefix?: string
  fallbackUrl?: string
}

export function RoleGuard({ 
  children, 
  requiredRole, 
  requiredTeamPrefix, 
  fallbackUrl = "/login" 
}: RoleGuardProps) {
  const { user, loading, hasAccessToTeam } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (loading) return

    if (!user) {
      router.push(fallbackUrl)
      return
    }

    // Check role-based access
    if (requiredRole && user.role !== requiredRole && user.role !== "admin") {
      router.push(fallbackUrl)
      return
    }

    // Check team-based access
    if (requiredTeamPrefix && !hasAccessToTeam(requiredTeamPrefix)) {
      router.push(fallbackUrl)
      return
    }
  }, [user, loading, requiredRole, requiredTeamPrefix, fallbackUrl, router, hasAccessToTeam])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  // Check role-based access
  if (requiredRole && user.role !== requiredRole && user.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don&apos;t have permission to access this page.</p>
        </div>
      </div>
    )
  }

  // Check team-based access
  if (requiredTeamPrefix && !hasAccessToTeam(requiredTeamPrefix)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don&apos;t have permission to access this team.</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
