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
import { BottomSheetModal } from "@/components/inventory/bottom-sheet-modal"
import { OpportunitiesTable } from "@/components/opportunities/opportunities-table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { MoreHorizontal } from "lucide-react"
import { useInventoryData } from "@/components/inventory/inventory-data-provider"
import {
  buildProjectionOpps,
  buildProjectionSeries,
  type ProjectionPoint,
} from "@/components/inventory/projection-series"

type ViewMode = "quarter" | "month"
type ChartMode = "snapshot" | "projection"

function formatKeur(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(1)} M€`
  return `${Math.round(v)} K€`
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

function formatCaptionDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
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
  const target = byKey.get("target")

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

        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-7"
              style={{
                height: 0,
                borderTop: "3px solid #F59E0B",
                borderRadius: 999,
              }}
            />
            <span className="text-sm font-medium text-foreground">
              Target
            </span>
          </div>
          <span className="text-sm font-semibold text-foreground">
            {target != null ? tooltipValueFormatter(target) : "—"}
          </span>
        </div>
      </div>
    </div>
  )
}

export function InventoryProjectionCard() {
  const [mode, setMode] = React.useState<ViewMode>("month")
  const [showTarget, setShowTarget] = React.useState(true)
  const [open, setOpen] = React.useState(false)
  const [periodLabel, setPeriodLabel] = React.useState<string | null>(null)
  const [periodRange, setPeriodRange] = React.useState<{ from: Date; to: Date } | null>(null)
  const {
    opportunities,
    plan,
    filters,
    dateRange,
    escalationTickets,
    timeframePreset,
    now,
  } = useInventoryData()

  const chartMode: ChartMode = timeframePreset === "current" ? "snapshot" : "projection"

  const rangeFrom = React.useMemo(() => {
    if (chartMode === "snapshot") return startOfDay(now)
    if (dateRange.from) return startOfDay(dateRange.from)
    return startOfDay(now)
  }, [chartMode, dateRange.from, now])

  const rangeTo = React.useMemo(() => {
    if (chartMode === "snapshot") return endOfDay(now)
    if (dateRange.to) return endOfDay(dateRange.to)
    if (dateRange.from) return endOfDay(dateRange.from)
    return endOfDay(now)
  }, [chartMode, dateRange.from, dateRange.to, now])

  const opps = React.useMemo(
    () =>
      buildProjectionOpps({
        opportunities,
        plan,
        filters,
        escalationTickets,
        rangeFrom,
        rangeTo,
      }),
    [
      opportunities,
      plan,
      filters,
      escalationTickets,
      rangeFrom,
      rangeTo,
      filters.partKeys,
      filters.suggestedActions,
      filters.customers,
      filters.escLevels,
      filters.statuses,
    ]
  )

  const data = React.useMemo<ProjectionPoint[]>(
    () =>
      buildProjectionSeries({
        chartMode,
        viewMode: mode,
        opps,
        rangeFrom,
        rangeTo,
      }),
    [chartMode, mode, opps, rangeFrom, rangeTo]
  )

  const caption =
    chartMode === "snapshot"
      ? "Inventory as of today"
      : `Projected from ${formatCaptionDate(rangeFrom)} to ${formatCaptionDate(rangeTo)}`

  const handleChartClick = React.useCallback(
    (e: any) => {
      if (chartMode === "snapshot") return
      const label = e?.activeLabel ?? e?.activePayload?.[0]?.payload?.label
      const point = data.find((p) => p.label === label)
      if (!point) return

      if (mode === "month") {
        const from = new Date(point.date.getFullYear(), point.date.getMonth(), 1)
        const to = new Date(point.date.getFullYear(), point.date.getMonth() + 1, 0, 23, 59, 59, 999)
        setPeriodLabel(label)
        setPeriodRange({ from, to })
        setOpen(true)
        return
      }

      const quarterStart = new Date(
        point.date.getFullYear(),
        Math.floor(point.date.getMonth() / 3) * 3,
        1
      )
      const quarterEnd = new Date(
        quarterStart.getFullYear(),
        quarterStart.getMonth() + 3,
        0,
        23,
        59,
        59,
        999
      )
      setPeriodLabel(label)
      setPeriodRange({ from: quarterStart, to: quarterEnd })
      setOpen(true)
    },
    [chartMode, data, mode]
  )

  return (
    <WidgetCard
      title={chartMode === "snapshot" ? "Current Inventory Position" : "Projected Inventory"}
      tooltip={
        chartMode === "snapshot"
          ? "Inventory position as of today (snapshot)."
          : "Comparison between ERP plan and projected inventory if all not-snoozed opportunities are applied."
      }
      subtitle={caption}
      size="l"
      headerRight={
        <div className="flex items-center gap-2">
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowTarget((prev) => !prev)}>
                {showTarget ? "Hide the target" : "Show the target"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    >
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
            onClick={handleChartClick}
            style={{ cursor: chartMode === "snapshot" ? "default" : "pointer" }}
          >
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
                  value === "erp"
                    ? chartMode === "snapshot"
                      ? "ERP plan (today)"
                      : "ERP plan"
                    : value === "opp"
                      ? chartMode === "snapshot"
                        ? "Opportunities (potential)"
                        : "With Opportunities"
                      : value === "target"
                        ? chartMode === "snapshot"
                          ? "Target (today)"
                          : "Target"
                        : String(value)

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
              opacity={chartMode === "snapshot" ? 0.95 : 1}
            />

            <Line
              type="monotone"
              dataKey="opp"
              stroke="#19A7B0"
              strokeWidth={2.5}
              strokeDasharray="5 5"
              dot={{ r: 4, stroke: "#ffffff", strokeWidth: 2, fill: "#19A7B0" }}
              activeDot={{ r: 5, stroke: "#ffffff", strokeWidth: 4, fill: "#19A7B0" }}
              opacity={chartMode === "snapshot" ? 0.45 : 1}
            />

            {showTarget ? (
              <Line
                type="monotone"
                dataKey="target"
                stroke="#F59E0B"
                strokeWidth={2}
                dot={false}
                activeDot={false}
                opacity={chartMode === "snapshot" ? 0.7 : 1}
              />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <BottomSheetModal
        open={open}
        title="Opportunities"
        subtitle={periodLabel ?? undefined}
        onClose={() => setOpen(false)}
      >
        {periodRange ? (
          <OpportunitiesTable
            showToolbar
            includeSnoozed={false}
            excludeStatuses={["Canceled"]}
            overrideDateRange={periodRange}
            useRawInventoryValue
            disableModeFilter
          />
        ) : null}
      </BottomSheetModal>
    </WidgetCard>
  )
}

