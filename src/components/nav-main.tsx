"use client"

import React from "react"
import { ChevronRight, type LucideIcon } from "lucide-react"
import { usePathname, useSearchParams } from "next/navigation"
import Link from "next/link"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

export const NavMain = React.memo(function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: LucideIcon
    items?: {
      title: string
      url: string
    }[]
  }[]
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentWithQuery = React.useMemo(() => {
    const qs = searchParams?.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }, [pathname, searchParams])

  // Memoize the active calculations to prevent infinite loops
  const activeStatesMap = React.useMemo(() => {
    const map = new Map()
    
    // Only process if we have items
    if (!items || items.length === 0) {
      return map
    }
    
    items.forEach((item) => {
      const subItems = item.items || []
      
      // Calculate parent active state for collapsible items
      const parentActive = subItems.some((s) =>
        pathname === s.url || currentWithQuery === s.url || pathname.startsWith(`${s.url}/`)
      )
      map.set(`${item.title}-parent`, parentActive)
      
      // Calculate direct link active state for non-collapsible items
      if (subItems.length === 0) {
        const isActive = pathname === item.url || currentWithQuery === item.url || pathname.startsWith(`${item.url}/`)
        map.set(`${item.title}-direct`, isActive)
      }
      
      // Calculate active state for sub-items
      subItems.forEach((subItem) => {
        const isActive = pathname === subItem.url || currentWithQuery === subItem.url || pathname.startsWith(`${subItem.url}/`)
        map.set(`${item.title}-${subItem.title}`, isActive)
      })
    })
    return map
  }, [items, pathname, currentWithQuery])

  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map((item) => {
          const subItems = item.items || []
          const parentActive = activeStatesMap.get(`${item.title}-parent`) || false
          
          // If no sub-items, render as a direct link item
          if (subItems.length === 0) {
            const isActive = activeStatesMap.get(`${item.title}-direct`) || false
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild tooltip={item.title} isActive={isActive}>
                  <Link href={item.url}>
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          }
          return (
          <Collapsible
            key={item.title}
            asChild
            defaultOpen={parentActive || item.title === "Manage"}
            className="group/collapsible"
          >
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip={item.title} isActive={parentActive}>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                  <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {subItems.map((subItem) => {
                    const isActive = activeStatesMap.get(`${item.title}-${subItem.title}`) || false
                    return (
                    <SidebarMenuSubItem key={subItem.title}>
                      <SidebarMenuSubButton asChild isActive={isActive}>
                        <Link href={subItem.url}>
                          <span>{subItem.title}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  )})}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        )})}
      </SidebarMenu>
    </SidebarGroup>
  )
}, (prevProps, nextProps) => {
  // Custom comparison function to prevent unnecessary re-renders
  if (prevProps.items.length !== nextProps.items.length) {
    return false
  }
  
  return prevProps.items.every((item, index) => {
    const nextItem = nextProps.items[index]
    return (
      item.title === nextItem.title &&
      item.url === nextItem.url &&
      item.icon === nextItem.icon &&
      JSON.stringify(item.items) === JSON.stringify(nextItem.items)
    )
  })
})
