"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { RoleGuard } from "@/components/role-guard"

export default function LeavesPage() {
  return (
    <RoleGuard requiredRole="admin">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <h1 className="text-xl font-semibold">Leaves</h1>
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min">
              <div className="p-6">
                <h2 className="text-2xl font-semibold mb-4">Leave Management</h2>
                <p className="text-muted-foreground">
                  Manage staff leave requests, vacation days, sick leave, and time off. 
                  Approve or reject leave applications and track staff availability.
                </p>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </RoleGuard>
  )
}
