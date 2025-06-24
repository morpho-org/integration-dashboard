import * as React from "react"
import { type LucideIcon } from "lucide-react"

import { cn } from "../../lib/utils"

export type ChartConfig = Record<
  string,
  {
    label: string
    color: string
    icon?: LucideIcon
  }
>

interface ChartContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  config: ChartConfig
}

export function ChartContainer({
  config,
  children,
  className,
  ...props
}: ChartContainerProps) {
  return (
    <div className={cn("space-y-4", className)} {...props}>
      <div className="flex items-center gap-4">
        {Object.entries(config).map(([key, item]) => {
          const Icon = item.icon
          return (
            <div key={key} className="flex items-center gap-2">
              {Icon && <Icon className="h-4 w-4" style={{ color: item.color }} />}
              <span className="text-sm font-medium">{item.label}</span>
            </div>
          )
        })}
      </div>
      {children}
    </div>
  )
}

interface ChartTooltipProps {
  children: React.ReactNode
  className?: string
}

export function ChartTooltip({ children, className }: ChartTooltipProps) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-background p-2 shadow-sm",
        className
      )}
    >
      {children}
    </div>
  )
}

interface ChartTooltipContentProps {
  label?: string
  value?: string
  color?: string
}

export function ChartTooltipContent({
  label,
  value,
  color,
}: ChartTooltipContentProps) {
  return (
    <div className="flex items-center gap-2">
      {color && (
        <div
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      {label && <span className="text-sm font-medium">{label}:</span>}
      {value && <span className="text-sm text-muted-foreground">{value}</span>}
    </div>
  )
} 