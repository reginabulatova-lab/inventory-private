"use client"

import * as React from "react"
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Label,
} from "recharts"
import { cn } from "@/lib/utils"

export type PieDatum = {
  name: string
  value: number
  displayValue?: string
  percent?: string
  color: string
}

function formatEurCompact(value: number) {
  const abs = Math.abs(value)

  if (abs >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `€${(value / 1_000).toFixed(0)}K`
  return `€${Math.round(value)}`
}

function formatPct(p: number) {
  return `${Math.round(p)}%`
}


type PieBreakdownProps = {
  totalLabel: string
  totalValue: string
  data: PieDatum[]
  selectedCategory?: string | null
  onSelectCategory: (categoryName: string) => void
}

function CenterLabel({
    totalLabel,
    totalValue,
  }: {
    totalLabel: string
    totalValue: string
  }) {
    return (
      <Label
        position="center"
        content={(props: any) => {
          // Recharts can pass different shapes depending on version/render pass
          const vb = props?.viewBox
          const cx =
            typeof vb?.cx === "number"
              ? vb.cx
              : typeof props?.cx === "number"
                ? props.cx
                : undefined
  
          const cy =
            typeof vb?.cy === "number"
              ? vb.cy
              : typeof props?.cy === "number"
                ? props.cy
                : undefined
  
                const w = typeof vb?.width === "number" ? vb.width : undefined
                const h = typeof vb?.height === "number" ? vb.height : undefined
                if ((cx == null || cy == null) && typeof w === "number" && typeof h === "number") {
                  // approximate center of the pie region
                  const fallbackCx = (vb.x ?? 0) + w / 2
                  const fallbackCy = (vb.y ?? 0) + h / 2
                  return (
                    <>
                      <text x={fallbackCx} y={fallbackCy - 6} textAnchor="middle" className="fill-muted-foreground" fontSize={12}>
                        {totalLabel}
                      </text>
                      <text x={fallbackCx} y={fallbackCy + 14} textAnchor="middle" className="fill-foreground" fontSize={16} fontWeight={600}>
                        {totalValue}
                      </text>
                    </>
                  )
                }
                
          // If we don't have valid numbers yet, render nothing (avoids NaN)
          if (typeof cx !== "number" || typeof cy !== "number") return null
  
          return (
            <>
              <text
                x={cx}
                y={cy - 6}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize={12}
              >
                {totalLabel}
              </text>
              <text
                x={cx}
                y={cy + 14}
                textAnchor="middle"
                className="fill-foreground"
                fontSize={16}
                fontWeight={600}
              >
                {totalValue}
              </text>
            </>
          )
        }}
      />
    )
  }  

export function PieBreakdown({
  totalLabel,
  totalValue,
  data,
  selectedCategory,
  onSelectCategory,
}: PieBreakdownProps) {
  const [hoveredCategory, setHoveredCategory] = React.useState<string | null>(null)

  // New behavior: hover dims others; selection also dims others.
  // Selection wins over hover when modal is open (selectedCategory set).
  const activeCategory = selectedCategory ?? hoveredCategory
  const hasEmphasis = Boolean(activeCategory)

  return (
    <div className="flex items-center gap-6">
      {/* chart */}
      <div className="h-[170px] w-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip contentStyle={{ borderRadius: 10 }} />

            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={75}
              paddingAngle={2}
              onClick={(payload) => {
                const name = payload?.name
                if (name) onSelectCategory(String(name))
              }}
              onMouseLeave={() => setHoveredCategory(null)}
              onMouseEnter={(payload) => {
                // payload is the slice datum
                const name = payload?.name
                if (name) setHoveredCategory(String(name))
              }}
            >
              <CenterLabel totalLabel={totalLabel} totalValue={totalValue} />

              {data.map((entry) => {
                const dim = hasEmphasis && activeCategory !== entry.name
                return (
                  <Cell
                    key={entry.name}
                    fill={entry.color}
                    fillOpacity={dim ? 0.3 : 1}
                    style={{ cursor: "pointer" }}
                  />
                )
              })}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* legend */}
      <div className="flex-1">
        <div className="space-y-2">
          {data.map((d) => {
            const dim = hasEmphasis && activeCategory !== d.name
            return (
              <button
                key={d.name}
                type="button"
                onClick={() => onSelectCategory(d.name)}
                onMouseEnter={() => setHoveredCategory(d.name)}
                onMouseLeave={() => setHoveredCategory(null)}
                className={cn("w-full rounded-lg px-2 py-1 text-left hover:bg-accent")}
                style={{ opacity: dim ? 0.3 : 1 }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: d.color }}
                    />
                    <span className="text-sm text-muted-foreground">{d.name}</span>
                  </div>

                  <div className="text-sm text-foreground">
                    {d.displayValue ?? d.value}
                    {d.percent ? (
                      <span className="text-muted-foreground"> ({d.percent})</span>
                    ) : null}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
