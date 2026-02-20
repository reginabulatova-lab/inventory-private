"use client"

import * as React from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { ProgramMatrixRow } from "@/lib/inventory/breakdown"

function formatEurCompact(value: number) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `€${(value / 1_000).toFixed(0)}K`
  return `€${Math.round(value)}`
}

function trendSymbol(trend: "up" | "down" | "flat") {
  return trend === "up" ? "↑" : trend === "down" ? "↓" : "→"
}

type HealthState = "overstock" | "healthy" | "understock"

function cellSeverity(
  state: HealthState,
  value: number,
  programTotal: number,
  isHighValueProgram: boolean
): "red" | "green" | "orange" | "yellow" {
  const share = programTotal > 0 ? value / programTotal : 0
  if (state === "healthy") {
    if (share >= 0.4) return "green"
    if (share >= 0.2) return "yellow"
    return "orange"
  }
  if (state === "overstock") {
    if (isHighValueProgram && share > 0.3) return "red"
    if (share > 0.25) return "orange"
    return "yellow"
  }
  if (state === "understock") {
    if (isHighValueProgram && share > 0.2) return "red"
    if (share > 0.15) return "orange"
    return "yellow"
  }
  return "yellow"
}

function cellBgClass(severity: "red" | "green" | "orange" | "yellow"): string {
  switch (severity) {
    case "red":
      return "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800"
    case "green":
      return "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800"
    case "orange":
      return "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800"
    default:
      return "bg-amber-50/70 dark:bg-amber-950/30 border-amber-200/70 dark:border-amber-800/50"
  }
}

const COLUMNS: { key: HealthState; label: string }[] = [
  { key: "overstock", label: "Overstock" },
  { key: "healthy", label: "Healthy" },
  { key: "understock", label: "Understock" },
]

type ProgramHealthMatrixProps = {
  rows: ProgramMatrixRow[]
  onCellClick?: (program: string, state: HealthState) => void
}

export function ProgramHealthMatrix({ rows, onCellClick }: ProgramHealthMatrixProps) {
  const maxProgramValue = Math.max(...rows.map((r) => r.totalValue), 1)
  const highValueThreshold = maxProgramValue * 0.2

  const topPriorityCell = React.useMemo(() => {
    let maxOverstock = 0
    let rowIndex = 0
    rows.forEach((row, i) => {
      if (row.overstock.value > maxOverstock) {
        maxOverstock = row.overstock.value
        rowIndex = i
      }
    })
    return maxOverstock > 0 ? { rowIndex, col: "overstock" as const } : null
  }, [rows])

  return (
    <TooltipProvider>
      <div className="min-w-0 overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="text-left font-medium text-muted-foreground py-2 pr-3">Program</th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="text-center font-medium text-muted-foreground py-2 px-2 min-w-[88px]"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              const isHighValue = row.totalValue >= highValueThreshold
              return (
                <tr key={row.program} className="border-t border-border/60">
                  <td className="py-1.5 pr-3 font-medium text-foreground truncate max-w-[120px]">
                    {row.program}
                  </td>
                  {COLUMNS.map((col) => {
                    const cell = row[col.key]
                    const severity = cellSeverity(
                      col.key,
                      cell.value,
                      row.totalValue,
                      isHighValue
                    )
                    const bgClass = cellBgClass(severity)
                    const isTopPriority =
                      topPriorityCell &&
                      topPriorityCell.rowIndex === rowIndex &&
                      topPriorityCell.col === col.key
                    return (
                      <td key={col.key} className="p-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => onCellClick?.(row.program, col.key)}
                              className={cn(
                                "relative w-full cursor-pointer rounded-lg border px-2 py-1.5 text-left transition-colors hover:opacity-90 hover:ring-1 hover:ring-border",
                                bgClass
                              )}
                            >
                              <div className="font-medium text-foreground flex items-center gap-1.5 flex-wrap">
                                <span>{formatEurCompact(cell.value)}</span>
                                {isTopPriority ? (
                                  <span
                                    className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 shrink-0"
                                    aria-label="Top priority"
                                  >
                                    Priority
                                  </span>
                                ) : null}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5 text-muted-foreground">
                                <span aria-hidden>{trendSymbol(cell.trend)}</span>
                                <span>{cell.partCount} parts</span>
                              </div>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[220px]">
                            <p className="font-medium">{row.program} — {col.label}</p>
                            {isTopPriority ? (
                              <p className="text-amber-700 dark:text-amber-300 text-xs font-medium mt-1">
                                Top priority — biggest overstock issue
                              </p>
                            ) : null}
                            <p className="text-muted-foreground mt-1">
                              Value: {formatEurCompact(cell.value)} · {cell.partCount} parts · Trend:{" "}
                              {cell.trend === "up" ? "up" : cell.trend === "down" ? "down" : "flat"}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </TooltipProvider>
  )
}
