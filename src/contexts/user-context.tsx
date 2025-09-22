"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

export type UserRole = "admin" | "legal" | "labs"

export type User = {
  id: string
  email: string
  name: string
  avatar: string
  role: UserRole
}

type UserContextType = {
  user: User | null
  loading: boolean
  hasAccessToTeam: (teamPrefix: string) => boolean
  hasRole: (role: UserRole) => boolean
  logout: () => Promise<void>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    // Get initial user
    supabase.auth.getUser().then(({ data: result }) => {
      if (!isMounted) return
      
      const u = result.user
      if (!u) {
        setUser(null)
        setLoading(false)
        return
      }

      const meta = (u.user_metadata || {}) as Record<string, unknown>
      const fullName = (meta.full_name as string) || (meta.name as string) || ""
      const derivedName = fullName || (u.email ? String(u.email).split("@")[0] : "User")
      const avatarUrl = (meta.avatar_url as string) || (meta.picture as string) || ""
      const role = (meta.role as UserRole) || "admin" // Default to admin for existing users

      setUser({
        id: u.id,
        email: u.email || "",
        name: derivedName,
        avatar: avatarUrl,
        role: role,
      })
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return

      if (event === 'SIGNED_OUT' || !session) {
        setUser(null)
        setLoading(false)
        return
      }

      if (event === 'SIGNED_IN' && session.user) {
        const meta = (session.user.user_metadata || {}) as Record<string, unknown>
        const fullName = (meta.full_name as string) || (meta.name as string) || ""
        const derivedName = fullName || (session.user.email ? String(session.user.email).split("@")[0] : "User")
        const avatarUrl = (meta.avatar_url as string) || (meta.picture as string) || ""
        const role = (meta.role as UserRole) || "admin"

        setUser({
          id: session.user.id,
          email: session.user.email || "",
          name: derivedName,
          avatar: avatarUrl,
          role: role,
        })
        setLoading(false)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const hasAccessToTeam = (teamPrefix: string): boolean => {
    if (!user) return false
    
    switch (user.role) {
      case "admin":
        return true // Admin has access to all teams
      case "legal":
        return teamPrefix === "/legal" // Legal only has access to legal team
      case "labs":
        return teamPrefix === "/lab" // Labs only has access to labs team
      default:
        return false
    }
  }

  const hasRole = (role: UserRole): boolean => {
    return user?.role === role
  }

  const logout = async (): Promise<void> => {
    await supabase.auth.signOut()
    // Clear auth cookie
    try {
      await fetch("/api/clear-auth-cookie", { method: "POST" })
    } catch {}
    setUser(null)
  }

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        hasAccessToTeam,
        hasRole,
        logout,
      }}
    >
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider")
  }
  return context
}
