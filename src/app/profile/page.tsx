"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"

export default function Page() {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phone, setPhone] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const u = data.user
      if (!u) {
        window.location.href = "/login?redirect=/profile"
        return
      }
      const full = (u.user_metadata?.full_name as string) || ""
      const parts = full.split(" ")
      setFirstName(parts[0] || "")
      setLastName(parts.slice(1).join(" ") || "")
      setPhone((u.user_metadata?.phone as string) || "")
      setLoading(false)
    })
  }, [])

  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    const full_name = [firstName, lastName].filter(Boolean).join(" ")
    const { error } = await supabase.auth.updateUser({
      data: { full_name, phone },
    })
    if (error) {
      alert(error.message)
      return
    }
    alert("Profile updated")
  }

  if (loading) return null

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="w-full max-w-md">
            <h1 className="mb-4 text-2xl font-semibold">Profile</h1>
            <form onSubmit={onSave} className="grid gap-4">
              <label className="grid gap-2 text-sm">
                <span>First name</span>
                <input
                  className="border-input bg-background text-foreground ring-ring h-9 w-full rounded-md border px-3 text-sm"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </label>
              <label className="grid gap-2 text-sm">
                <span>Last name</span>
                <input
                  className="border-input bg-background text-foreground ring-ring h-9 w-full rounded-md border px-3 text-sm"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </label>
              <label className="grid gap-2 text-sm">
                <span>Phone</span>
                <input
                  className="border-input bg-background text-foreground ring-ring h-9 w-full rounded-md border px-3 text-sm"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>
              <button
                type="submit"
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium"
              >
                Save
              </button>
            </form>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}


