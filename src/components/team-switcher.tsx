"use client"

import * as React from "react"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useTeam } from "@/contexts/team-context"

export function TeamSwitcher() {
  const { currentTeam } = useTeam()

  if (!currentTeam) {
    return null
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          className="hover:bg-transparent cursor-default"
        >
          <div className="flex items-center justify-center w-full">
            <Image 
              src="/logo.png" 
              alt="Restyle" 
              width={160}
              height={53}
              className="h-10 w-auto"
            />
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
