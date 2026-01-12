"use client"

import * as React from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts"
import { WidgetCard } from "@/components/inventory/kpi-card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

type ViewMode = "quarter" | "month"

type Point = {
  label: string
  erp: number // in K€
  opp: number // in K€
}

const MONTH_DATA: Point[] = [
  { label: "Jan 2025", erp: 820, opp: 190 },
  { label: "Feb 2025", erp: 960, opp: 210 },
  { label: "Mar 2025", erp: 860, opp: 70 },
  { label: "Apr 2025", erp: 700, opp: 60 },
  { label: "May 2025", erp: 750, opp: 80 },
  { label: "June 2025", erp: 350, opp: 65 },
  { label: "July 2025", erp: 560, opp: 40 },
  { label: "Aug 2025", erp: 490, opp: 90 },
  { label: "Sept 2025", erp: 580, opp: 55 },
  { label: "Oct 2025", erp: 490, opp: 135 },
  { label: "Nov 2025", erp: 730, opp: 120 },
  { label: "Dec 2025", erp: 620, opp: 120 },
]

const QUARTER_DATA: Point[] = [
  { label: "Q1 2025", erp: 880, opp: 157 },
  { label: "Q2 2025", erp: 600, opp: 68 },
  { label: "Q3 2025", erp: 543, opp: 62 },
  { label: "Q4 2025", erp: 613, opp: 125 },
]

function formatKeur(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(1)} M€`
  return `${Math.round(v)} K€`
}

function tooltipValueFormatter(value: any) {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return String(value)
  return formatKeur(n)
}

function InventoryProjectionTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: any[]
  label?: string
}) {
  if (!active || !payload?.length) return null

  const byKey = new Map<string, number>()
  for (const p of payload) {
    if (p?.dataKey) byKey.set(p.dataKey, p.value)
  }

  const erp = byKey.get("erp")
  const opp = byKey.get("opp")

  return (
    <div className="rounded-xl border bg-white p-4 shadow-lg">
      <div className="text-base font-semibold text-foreground">{label}</div>

      <div className="mt-3 space-y-3">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-7"
              style={{
                height: 0,
                borderTop: "3px solid #19A7B0",
                borderRadius: 999,
              }}
            />
            <span className="text-sm font-medium text-foreground">
              ERP plan
            </span>
          </div>
          <span className="text-sm font-semibold text-foreground">
            {erp != null ? tooltipValueFormatter(erp) : "—"}
          </span>
        </div>

        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-7"
              style={{
                height: 0,
                borderTop: "3px dashed #19A7B0",
                borderRadius: 999,
              }}
            />
            <span className="text-sm font-medium text-foreground">
              With Opportunities
            </span>
          </div>
          <span className="text-sm font-semibold text-foreground">
            {opp != null ? tooltipValueFormatter(opp) : "—"}
          </span>
        </div>
      </div>
    </div>
  )
}

export function InventoryProjectionCard() {
  const [mode, setMode] = React.useState<ViewMode>("month")

  const data = mode === "month" ? MONTH_DATA : QUARTER_DATA

  return (
    <WidgetCard
      title="Projected Inventory"
      tooltip="Comparison between ERP plan and projected inventory if all not-snoozed opportunities are applied."
      size="l"
      headerRight={
        <Tabs value={mode} onValueChange={(v) => setMode(v as ViewMode)}>
          <TabsList className="h-8">
            <TabsTrigger value="quarter" className="px-3 text-xs">
              Quarter
            </TabsTrigger>
            <TabsTrigger value="month" className="px-3 text-xs">
              Month
            </TabsTrigger>
          </TabsList>
        </Tabs>
      }
    >
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <CartesianGrid vertical={true} horizontal={true} strokeDasharray="0" opacity={0.25} />

            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              interval="preserveStartEnd"
              minTickGap={18}
              tick={{ fontSize: 12 }}
            />

            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              width={50}
              tick={{ fontSize: 12 }}
              tickFormatter={(v) => formatKeur(Number(v))}
            />

            <Tooltip
              content={<InventoryProjectionTooltip />}
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.35 }}
              wrapperStyle={{ outline: "none" }}
            />

            <Legend
              verticalAlign="bottom"
              align="center"
              wrapperStyle={{ paddingTop: 8 }}
              iconType="plainline"
              formatter={(value) => {
                const label =
                  value === "erp" ? "ERP plan" : value === "opp" ? "With Opportunities" : String(value)

                return <span className="text-sm text-muted-foreground">{label}</span>
              }}
            />

            <Line
              type="monotone"
              dataKey="erp"
              stroke="#19A7B0"
              strokeWidth={2.5}
              dot={{ r: 4, stroke: "#ffffff", strokeWidth: 2, fill: "#19A7B0" }}
              activeDot={{ r: 5, stroke: "#ffffff", strokeWidth: 4, fill: "#19A7B0" }}
            />

            <Line
              type="monotone"
              dataKey="opp"
              stroke="#19A7B0"
              strokeWidth={2.5}
              strokeDasharray="5 5"
              dot={{ r: 4, stroke: "#ffffff", strokeWidth: 2, fill: "#19A7B0" }}
              activeDot={{ r: 5, stroke: "#ffffff", strokeWidth: 4, fill: "#19A7B0" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </WidgetCard>
  )
}

