import * as React from "react"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export type WidgetSize = "s" | "m" | "l"

function SizeClass(size: WidgetSize) {
  return cn(
    size === "s" && "col-span-3",
    size === "m" && "col-span-6",
    size === "l" && "col-span-12"
  )
}

type WidgetCardProps = {
  title: string
  tooltip?: string
  icon?: React.ReactNode
  size?: WidgetSize
  className?: string
  headerRight?: React.ReactNode
  children: React.ReactNode
}

/**
 * General-purpose dashboard widget container.
 * Use this for charts (pie/bar/line), tables, and anything that lives inside a widget card.
 */
export function WidgetCard({
  title,
  tooltip,
  icon,
  size = "s",
  className,
  headerRight,
  children,
}: WidgetCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-white shadow-sm",
        "p-5",
        SizeClass(size),
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {icon ? <div className="text-muted-foreground">{icon}</div> : null}

          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold">{title}</div>

            {tooltip ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground hover:bg-accent"
                      aria-label="Info"
                    >
                      i
                    </button>
                  </TooltipTrigger>

                  <TooltipContent side="top">
                    <p>{tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
          </div>
        </div>

        {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
      </div>

      <div className="mt-4">{children}</div>
    </div>
  )
}

type KpiCardProps = {
  title: string
  value: string
  description?: React.ReactNode
  badge?: React.ReactNode
  tooltip?: string
  icon?: React.ReactNode
  size?: WidgetSize
  className?: string
}

/**
 * KPI-specific widget. Keeps your existing API (title/value/description).
 * Internally uses WidgetCard so KPI and charts share the same styling system.
 */
export function KpiCard({
  title,
  value,
  description,
  badge,
  tooltip,
  icon,
  size = "s",
  className,
}: KpiCardProps) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <WidgetCard
      title={title}
      tooltip={tooltip}
      icon={icon}
      size={size}
      className={className}
    >
      <div className="flex items-center gap-3">
        <div className="text-4xl font-medium tracking-tight">{value}</div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>

      {mounted && description ? (
        <div className="mt-1 text-sm text-muted-foreground">{description}</div>
      ) : null}
    </WidgetCard>
  )
}
