"use client"
import { AppSidebar } from "@/components/app-sidebar"
import { RoleGuard } from "@/components/role-guard"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Lock, Eye, EyeOff, ArrowLeft } from "lucide-react"
import { useUser } from "@/contexts/user-context"

export default function DashboardPage() {
  const { user } = useUser()
  const router = useRouter()
  
  // PIN Protection State
  const [isPinVerified, setIsPinVerified] = useState(false)
  const [pinInput, setPinInput] = useState("")
  const [showPin, setShowPin] = useState(false)
  const [pinError, setPinError] = useState("")
  const [attempts, setAttempts] = useState(0)
  
  // Dashboard PIN - you can change this to any 4-6 digit PIN
  const DASHBOARD_PIN = "57216"
  const MAX_ATTEMPTS = 10

  // Handle PIN verification
  const handlePinSubmit = () => {
    if (pinInput === DASHBOARD_PIN) {
      setIsPinVerified(true)
      setPinError("")
      setPinInput("")
      setAttempts(0)
    } else {
      const newAttempts = attempts + 1
      setAttempts(newAttempts)
      setPinError(`Incorrect PIN. ${MAX_ATTEMPTS - newAttempts} attempts remaining.`)
      setPinInput("")
      
      if (newAttempts >= MAX_ATTEMPTS) {
        setPinError("Too many failed attempts. Please contact administrator.")
      }
    }
  }

  const handlePinKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && pinInput.length >= 4 && attempts < MAX_ATTEMPTS) {
      handlePinSubmit()
    }
  }

  const handleGoBack = () => {
    router.push('/appointments')
  }

  // Check if user has access to dashboard
  useEffect(() => {
    // Reset PIN verification when user changes
    setIsPinVerified(false)
    setPinInput("")
    setPinError("")
    setAttempts(0)
  }, [user])

  // If PIN not verified, show PIN entry dialog
  if (!isPinVerified) {
    return (
      <RoleGuard requiredTeamPrefix="">
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 border-b border-[#601625]/20">
              <div className="flex items-center gap-2 px-4">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4 bg-[#601625]/30" />
                <h1 className="font-semibold text-[#601625]">Dashboard</h1>
              </div>
            </header>

            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
              <Dialog open={true}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader className="text-center">
                    <DialogTitle className="flex items-center justify-center gap-2 text-xl text-[#601625]">
                      <Lock className="h-6 w-6 text-[#601625]" />
                      Admin Access Only
                    </DialogTitle>
                    <DialogDescription className="mt-2 text-[#751a29]/80">
                      Please enter PIN:
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 pt-4">
                    <div className="relative">
                      <Input
                        type={showPin ? "text" : "password"}
                        placeholder="Enter PIN"
                        value={pinInput}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                          setPinInput(value)
                          setPinError("")
                        }}
                        onKeyPress={handlePinKeyPress}
                        className="pr-10 text-center text-lg tracking-widest border-[#601625]/30 focus:border-[#601625] focus:ring-[#601625]/20"
                        maxLength={6}
                        disabled={attempts >= MAX_ATTEMPTS}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-[#601625]/10"
                        onClick={() => setShowPin(!showPin)}
                        disabled={attempts >= MAX_ATTEMPTS}
                      >
                        {showPin ? (
                          <EyeOff className="h-4 w-4 text-[#601625]/70" />
                        ) : (
                          <Eye className="h-4 w-4 text-[#601625]/70" />
                        )}
                      </Button>
                    </div>
                    
                    {pinError && (
                      <div className="text-sm text-red-700 text-center bg-red-50 border border-red-200 p-3 rounded-md">
                        {pinError}
                      </div>
                    )}
                    
                    <div className="flex gap-3">
                      <Button 
                        variant="outline"
                        onClick={handleGoBack}
                        className="flex-1 border-[#601625]/30 text-[#601625] hover:bg-[#601625]/10 hover:border-[#601625]/50"
                      >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Go Back
                      </Button>
                      <Button 
                        onClick={handlePinSubmit}
                        disabled={pinInput.length < 4 || attempts >= MAX_ATTEMPTS}
                        className="flex-1 bg-[#601625] hover:bg-[#751a29] text-white transition-colors duration-200"
                      >
                        {attempts >= MAX_ATTEMPTS ? "Access Locked" : "Verify PIN"}
                      </Button>
                    </div>
                    
                    <div className="text-xs text-[#751a29]/60 text-center">
                      PIN must be 4-6 digits
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </RoleGuard>
    )
  }

  return (
    <RoleGuard requiredTeamPrefix="">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <h1 className="text-xl font-semibold">Dashboard</h1>
              <Badge variant="secondary" className="ml-2">Analytics</Badge>
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
            {/* Blank dashboard content - ready for your new design */}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </RoleGuard>
  )
}

