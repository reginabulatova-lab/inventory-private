"use client"

import * as React from "react"
import { Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

function formatEurCompact(value: number) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `€${(value / 1_000).toFixed(0)}K`
  return `€${Math.round(value)}`
}

type CardHealth = "green" | "yellow" | "red"

function cardBorderClass(health: CardHealth): string {
  switch (health) {
    case "red":
      return "border-l-rose-400 dark:border-l-rose-600"
    case "yellow":
      return "border-l-amber-400 dark:border-l-amber-600"
    default:
      return "border-l-emerald-400 dark:border-l-emerald-600"
  }
}

export type ProductionFlowCard = "totalWip" | "atRisk" | "excessWip"

type ProductionFlowHealthProps = {
  totalWipEur: number
  totalWipTrend: "up" | "down" | "flat"
  totalWipTrendPct: number
  atRiskEur: number
  atRiskPartCount: number
  /** Excess WIP: cancelled orders, low-priority programs, or qty > planned demand. Placeholder until real data is plugged in. */
  excessWipEur: number
  /** Percentage of total WIP that is excess (0–100). */
  excessWipPct: number
  excessWipPartCount: number
  onCardClick?: (card: ProductionFlowCard) => void
}

const AT_RISK_TOOLTIP =
  "Parts that are blocked, conditionally covered, or have late / missing components."

const EXCESS_WIP_TOOLTIP =
  "WIP for cancelled orders, low-priority programs, or quantities exceeding planned demand."

export function ProductionFlowHealth({
  totalWipEur,
  totalWipTrend,
  totalWipTrendPct,
  atRiskEur,
  atRiskPartCount,
  excessWipEur,
  excessWipPct,
  excessWipPartCount,
  onCardClick,
}: ProductionFlowHealthProps) {
  const atRiskPct = totalWipEur > 0 ? Math.round((atRiskEur / totalWipEur) * 100) : 0
  const atRiskHealth: CardHealth = atRiskPct <= 10 ? "green" : atRiskPct <= 25 ? "yellow" : "red"
  const totalHealth: CardHealth = totalWipTrend === "down" ? "green" : totalWipTrend === "up" ? "yellow" : "green"
  const excessWipHealth: CardHealth = "yellow"

  const trendSymbol = totalWipTrend === "up" ? "↑" : totalWipTrend === "down" ? "↓" : "→"
  const trendColorClass =
    totalWipTrend === "down"
      ? "text-emerald-700 dark:text-emerald-400"
      : totalWipTrend === "up"
        ? "text-rose-700 dark:text-rose-400"
        : "text-muted-foreground"

  const cardClass = cn(
    "rounded-lg border border-border bg-card p-4 border-l-4 min-h-[72px] transition-colors flex-1 flex flex-col justify-center",
    onCardClick ? "cursor-pointer hover:bg-accent/50" : "cursor-default"
  )

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-3 h-full">
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              role={onCardClick ? "button" : undefined}
              tabIndex={onCardClick ? 0 : undefined}
              onClick={() => onCardClick?.("totalWip")}
              onKeyDown={(e) => onCardClick && (e.key === "Enter" || e.key === " ") && onCardClick("totalWip")}
              className={cn(cardClass, cardBorderClass(totalHealth))}
            >
              <p className="text-xs font-medium text-muted-foreground">Total WIP</p>
              <p className="text-xl font-semibold tracking-tight mt-1 flex items-center gap-2 flex-wrap">
                <span>{formatEurCompact(totalWipEur)}</span>
                <span className={cn("text-sm font-medium", trendColorClass)} aria-hidden>
                  {trendSymbol} {totalWipTrendPct}%
                </span>
              </p>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Total work-in-progress inventory value. Trend vs previous period. Click to drill into WIP details.</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div
              role={onCardClick ? "button" : undefined}
              tabIndex={onCardClick ? 0 : undefined}
              onClick={() => onCardClick?.("atRisk")}
              onKeyDown={(e) => onCardClick && (e.key === "Enter" || e.key === " ") && onCardClick("atRisk")}
              className={cn(cardClass, cardBorderClass(atRiskHealth))}
            >
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-medium text-muted-foreground">At Risk</p>
                <Info className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
              </div>
              <p className="text-xl font-semibold tracking-tight mt-1">{formatEurCompact(atRiskEur)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {atRiskPct}% of total · {atRiskPartCount} parts
              </p>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[220px]">
            <p>{AT_RISK_TOOLTIP}</p>
            <p className="mt-1 text-muted-foreground">Click to see at-risk parts.</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div
              role={onCardClick ? "button" : undefined}
              tabIndex={onCardClick ? 0 : undefined}
              onClick={() => onCardClick?.("excessWip")}
              onKeyDown={(e) => onCardClick && (e.key === "Enter" || e.key === " ") && onCardClick("excessWip")}
              className={cn(cardClass, cardBorderClass(excessWipHealth))}
            >
              <p className="text-xs font-medium text-muted-foreground">Excess WIP</p>
              <p className="text-xl font-semibold tracking-tight mt-1">{formatEurCompact(excessWipEur)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {excessWipPct}% of total · {excessWipPartCount} parts
              </p>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[260px]">
            <p>{EXCESS_WIP_TOOLTIP}</p>
            <p className="mt-1 text-muted-foreground">Click to see excess WIP parts.</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
