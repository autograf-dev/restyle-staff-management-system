"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CreditCard, DollarSign, Smartphone, Gift } from "lucide-react"

export type PaymentMethod = {
  name: string
  type: string
  revenue: number
  count: number
  percentage: number
  icon: React.ReactNode
}

interface PaymentMethodsSectionProps {
  data: PaymentMethod[]
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

export function PaymentMethodsSection({ data }: PaymentMethodsSectionProps) {

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-[#601625]">Payment Methods</h2>
        <Badge variant="outline" className="text-xs border-[#601625]/20 text-[#601625] px-3 py-1">
          {data.length} Methods
        </Badge>
      </div>


      {/* Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {data.map((method, index) => (
          <Card 
            key={method.type} 
            className="rounded-2xl border-neutral-200 shadow-sm hover:shadow-md transition-shadow"
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[12px] font-medium text-neutral-500 uppercase tracking-wide">
                    {method.name}
                  </div>
                  <div className="text-[24px] font-bold text-neutral-900 mt-1">
                    {formatCurrency(method.revenue)}
                  </div>
                </div>
                <div className="h-10 w-10 rounded-xl bg-[#601625]/10 flex items-center justify-center">
                  {method.icon}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

    </div>
  )
}
