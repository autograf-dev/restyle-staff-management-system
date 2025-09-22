"use client"
import * as React from "react"

export type ChartConfig = Record<string, { label?: string; color?: string }>

type ContainerProps = React.HTMLAttributes<HTMLDivElement> & {
  config: ChartConfig
}

export function ChartContainer({ className, style, children, ...rest }: ContainerProps) {
  return (
    <div className={className} style={style} {...rest}>
      {children}
    </div>
  )
}

type TooltipContentProps = React.HTMLAttributes<HTMLDivElement> & {
  nameKey?: string
  labelFormatter?: (value: string | number) => React.ReactNode
}

export function ChartTooltipContent({ className, nameKey, labelFormatter }: TooltipContentProps) {
  // Recharts will inject payload/label via context through content component props
  return (
    <div className={className + " rounded-md border bg-background p-2 shadow-sm"}>
      {/* @ts-expect-error - properties provided by Recharts at runtime */}
      {({ payload, label }: { payload?: Array<{ dataKey: string; name?: string; value: string | number; color?: string }>; label?: string }) => (
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">
            {labelFormatter ? labelFormatter(label || '') : String(label || '')}
          </div>
          <div className="space-y-0.5">
            {Array.isArray(payload)
              ? payload.map((p) => (
                  <div key={p.dataKey} className="flex items-center justify-between gap-4 text-sm">
                    <span className="capitalize">{(nameKey && p[nameKey as keyof typeof p]) || p.name || p.dataKey}</span>
                    <span className="font-medium">{p.value}</span>
                  </div>
                ))
              : null}
          </div>
        </div>
      )}
    </div>
  )
}

export function ChartTooltip(props: Record<string, unknown>) {
  // This component simply forwards props to Recharts Tooltip
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Tooltip } = require("recharts")
  return <Tooltip {...props} />
}


