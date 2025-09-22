"use client"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"
import { useState } from "react"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const email = String(formData.get("email") || "")
    const password = String(formData.get("password") || "")
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      alert(error.message)
      return
    }
    
    // set a lightweight auth cookie for middleware
    try {
      await fetch("/api/set-auth-cookie", { method: "POST" })
    } catch {}
    
    // Determine redirect based on user role
    let redirectUrl = "/dashboard" // Default for admin
    if (data.user) {
      const role = data.user.user_metadata?.role
      if (role === "legal") {
        redirectUrl = "/legal/dashboard"
      } else if (role === "labs") {
        redirectUrl = "/lab/dashboard"
      }
    }
    
    // Check if there's a specific redirect parameter
    const urlRedirect = new URLSearchParams(window.location.search).get("redirect")
    if (urlRedirect) {
      redirectUrl = urlRedirect
    }
    
    window.location.href = redirectUrl
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <div className="flex w-full items-center justify-center pb-4">
            <div className="rounded-md bg-transparent p-1">
              <Image
                src="/logo.png"
                alt="Lawyer Vantage"
                width={180}
                height={48}
                priority
              />
            </div>
          </div>
          <CardTitle>Login to your account</CardTitle>
          <CardDescription>
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-3">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                />
              </div>
              <div className="grid gap-3">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  <a
                    href="/forgot-password"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </a>
                </div>
                <Input id="password" name="password" type="password" required />
              </div>
              <div className="flex flex-col gap-3">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Logging in..." : "Login"}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
