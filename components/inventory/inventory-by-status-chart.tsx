"use client"

import * as React from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { WidgetCard } from "@/components/inventory/kpi-card"
import { useInventoryData } from "@/components/inventory/inventory-data-provider"
import {
  buildProjectionOpps,
  buildProjectionSeries,
} from "@/components/inventory/projection-series"
import { buildProjectedBreakdownSeries } from "@/lib/inventory/projected-breakdown"
import {
  GROUP_BY_OPTIONS,
  STACK_BY_OPTIONS,
  getSegmentOptions,
  PLANTS,
  WAREHOUSES,
  STATUS_OPTIONS,
  CUSTOM_FIELD_OPTIONS,
  type GroupByKey,
  type StackByKey,
} from "@/lib/inventory/chart-group-options"
import { cn } from "@/lib/utils"
import { STACKED_BAR_TEAL } from "@/lib/charts/colors"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Layers } from "lucide-react"
import { BottomSheetModal } from "@/components/inventory/bottom-sheet-modal"
import { PartbookTable } from "@/components/inventory/partbook-table"

const TEAL_SHADES = [
  STACKED_BAR_TEAL.raw_material,
  STACKED_BAR_TEAL.wip,
  STACKED_BAR_TEAL.rotables,
  STACKED_BAR_TEAL.finished_goods,
] as const
const BAR_SEPARATOR_STROKE = "rgba(255,255,255,0.55)"

function splitBySeed(totalK: number, seedKey: string, count: number): number[] {
  let hash = 0
  for (let i = 0; i < seedKey.length; i++) hash = (hash * 31 + seedKey.charCodeAt(i)) | 0
  const rand = () => {
    hash = (hash * 1103515245 + 12345) >>> 0
    return (hash >>> 16) / 65536
  }
  const ratios: number[] = []
  for (let i = 0; i < count; i++) {
    ratios.push(0.15 + rand() * 0.25)
  }
  const sum = ratios.reduce((a, b) => a + b, 0)
  const out = ratios.map((r) => Math.round((totalK * r) / sum))
  const diff = totalK - out.reduce((a, b) => a + b, 0)
  if (diff !== 0) out[0] = Math.max(0, (out[0] ?? 0) + diff)
  return out
}

function formatKeur(v: number) {
  if (v >= 1000) return `€${(v / 1000).toFixed(1)}M`
  return `€${Math.round(v)}K`
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

const BAR_FILL = STACKED_BAR_TEAL.raw_material

type ChartRow = { name: string; value?: number; [key: string]: string | number | undefined }

function InventoryByGroupTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { dataKey: string; value?: number; name?: string; color?: string }[]
  label?: string
}) {
  if (!active || !payload?.length || label == null) return null
  const barEntries = payload.filter(
    (p) => p?.dataKey !== "name" && p?.dataKey !== "value" && p?.value != null && p.value > 0
  )
  const singleValue = payload.find((p) => p.dataKey === "value")?.value
  const showStacked = barEntries.length > 0
  return (
    <div className="relative z-10 rounded-xl border bg-white p-4 shadow-lg">
      <div className="text-base font-semibold text-foreground">{label}</div>
      {showStacked ? (
        <div className="mt-3 space-y-2">
          {barEntries.map((entry) => (
            <div key={entry.dataKey} className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: entry.color ?? "var(--muted)" }}
                />
                <span className="text-sm font-medium text-foreground">
                  {entry.name ?? entry.dataKey}
                </span>
              </div>
              <span className="text-sm font-semibold text-foreground">
                {formatKeur(entry.value!)}
              </span>
            </div>
          ))}
        </div>
      ) : singleValue != null ? (
        <div className="mt-2 text-sm font-semibold text-foreground">{formatKeur(singleValue)}</div>
      ) : null}
    </div>
  )
}

/** Legend below chart – same style as projected inventory widget. */
function ChartLegend({ payload }: { payload?: { dataKey?: string; value?: string; color?: string }[] }) {
  if (!payload?.length) return null
  const items = payload
    .filter((e) => e.dataKey !== "name" && e.dataKey !== "value")
    .map((entry) => (
      <div key={String(entry.dataKey)} className="flex items-center gap-2" style={{ marginRight: 12 }}>
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: entry.color }}
        />
        <span className="text-sm text-muted-foreground">{entry.value ?? entry.dataKey}</span>
      </div>
    ))
  if (!items.length) return null
  const last = items.length - 1
  const itemsWithMargin = items.map((item, i) =>
    i === last ? React.cloneElement(item, { style: { marginRight: 0 } }) : item
  )
  return (
    <div className="flex flex-wrap items-center justify-center gap-y-2 pt-2">
      {itemsWithMargin}
    </div>
  )
}

export function InventoryByStatusChart() {
  const [groupBy, setGroupBy] = React.useState<GroupByKey>("type")
  const [groupByOpen, setGroupByOpen] = React.useState(false)
  const [stackBy, setStackBy] = React.useState<StackByKey | null>("status")
  const [stackByOpen, setStackByOpen] = React.useState(false)
  const [partBookOpen, setPartBookOpen] = React.useState(false)
  const {
    opportunities,
    plan,
    filters,
    escalationTickets,
    timeframePreset,
    dateRange,
    now,
  } = useInventoryData()

  const chartMode = timeframePreset === "current" ? "snapshot" : "projection"
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

  const seriesData = React.useMemo(
    () =>
      buildProjectionSeries({
        chartMode,
        viewMode: "month",
        opps,
        rangeFrom,
        rangeTo,
      }),
    [chartMode, opps, rangeFrom, rangeTo]
  )

  const breakdownSeries = React.useMemo(
    () => buildProjectedBreakdownSeries(seriesData),
    [seriesData]
  )

  const totalK = React.useMemo(() => {
    if (!seriesData.length) return 0
    return seriesData[0]?.erp ?? 0
  }, [seriesData])

  const firstBreakdown = breakdownSeries[0]

  const groupRows = React.useMemo<{ name: string; totalK: number }[]>(() => {
    if (!firstBreakdown) return []
    switch (groupBy) {
      case "type":
        return [
          { name: "Raw Material", totalK: firstBreakdown.rawMaterialK },
          { name: "WIP", totalK: firstBreakdown.wipK },
          { name: "Finished Goods", totalK: firstBreakdown.finishedGoodsK },
        ]
      case "rotables":
        return [{ name: "Rotables", totalK: firstBreakdown.rotablesK }]
      case "storageLocation": {
        const warehouseTotals = splitBySeed(totalK, "inventory-by-storage", WAREHOUSES.length)
        return WAREHOUSES.map((wh, i) => ({
          name: wh,
          totalK: warehouseTotals[i] ?? 0,
        }))
      }
      case "plant": {
        const plantTotals = splitBySeed(totalK, "inventory-by-plant", PLANTS.length)
        return PLANTS.map((plant, i) => ({
          name: plant,
          totalK: plantTotals[i] ?? 0,
        }))
      }
      case "status": {
        const statusTotals = splitBySeed(totalK, "inventory-by-status", STATUS_OPTIONS.length)
        return STATUS_OPTIONS.map((opt, i) => ({
          name: opt.label,
          totalK: statusTotals[i] ?? 0,
        }))
      }
      case "customField": {
        const cfTotals = splitBySeed(totalK, "inventory-customField", CUSTOM_FIELD_OPTIONS.length)
        return CUSTOM_FIELD_OPTIONS.map((opt, i) => ({
          name: opt.label,
          totalK: cfTotals[i] ?? 0,
        }))
      }
      default:
        return []
    }
  }, [groupBy, totalK, firstBreakdown])

  const stackSegments = React.useMemo(
    () => (stackBy ? getSegmentOptions(stackBy) : []),
    [stackBy]
  )

  const chartData = React.useMemo<ChartRow[]>(() => {
    if (!stackBy || stackSegments.length === 0) {
      return groupRows.map((r) => ({ name: r.name, value: r.totalK }))
    }
    return groupRows.map((row) => {
      const segmentValues = splitBySeed(row.totalK, `stack-${row.name}-${stackBy}`, stackSegments.length)
      const out: ChartRow = { name: row.name }
      stackSegments.forEach((seg, i) => {
        out[seg.key] = segmentValues[i] ?? 0
      })
      return out
    })
  }, [groupRows, stackBy, stackSegments])

  const groupLabel = GROUP_BY_OPTIONS.find((o) => o.key === groupBy)?.label ?? "Type"
  const stackLabel = stackBy ? STACK_BY_OPTIONS.find((o) => o.key === stackBy)?.label ?? "Status" : null

  return (
    <WidgetCard
      title={`Inventory by ${groupLabel}`}
      size="l"
      className="h-full w-full"
      headerRight={
        <div className="flex items-center gap-2">
          <Popover open={groupByOpen} onOpenChange={setGroupByOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <span className="min-w-0 truncate">X-axis: {groupLabel}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52 p-3">
              <div className="text-xs font-medium text-muted-foreground mb-2">X-axis</div>
              <div className="space-y-1">
                {GROUP_BY_OPTIONS.map(({ key, label }) => (
                  <label
                    key={key}
                    className={cn(
                      "flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5 hover:bg-muted/60",
                      groupBy === key && "bg-muted/60"
                    )}
                  >
                    <input
                      type="radio"
                      name="groupBy"
                      checked={groupBy === key}
                      onChange={() => {
                        setGroupBy(key)
                        setGroupByOpen(false)
                      }}
                      className="h-3.5 w-3.5 accent-foreground"
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Popover open={stackByOpen} onOpenChange={setStackByOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <Layers className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 truncate">
                  Stack by: {stackLabel ?? "None"}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52 p-3">
              <div className="text-xs font-medium text-muted-foreground mb-2">Stack by</div>
              <div className="space-y-1">
                <label
                  className={cn(
                    "flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5 hover:bg-muted/60",
                    stackBy === null && "bg-muted/60"
                  )}
                >
                  <input
                    type="radio"
                    name="stackBy"
                    checked={stackBy === null}
                    onChange={() => {
                      setStackBy(null)
                      setStackByOpen(false)
                    }}
                    className="h-3.5 w-3.5 accent-foreground"
                  />
                  <span className="text-sm">None</span>
                </label>
                {STACK_BY_OPTIONS.filter((o) => o.key !== "rotables").map(({ key, label }) => (
                  <label
                    key={key}
                    className={cn(
                      "flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5 hover:bg-muted/60",
                      stackBy === key && "bg-muted/60"
                    )}
                  >
                    <input
                      type="radio"
                      name="stackBy"
                      checked={stackBy === key}
                      onChange={() => {
                        setStackBy(key)
                        setStackByOpen(false)
                      }}
                      className="h-3.5 w-3.5 accent-foreground"
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      }
    >
      <div
        className="flex-1 min-h-0 flex flex-col pt-2 w-full cursor-pointer [&_*]:!cursor-pointer"
        onClick={() => setPartBookOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            setPartBookOpen(true)
          }
        }}
        aria-label="Open part book"
      >
        <ResponsiveContainer width="100%" height="100%" className="!cursor-pointer">
          <BarChart
            data={chartData}
            margin={{ top: 8, right: 8, left: 8, bottom: 4 }}
            onClick={() => setPartBookOpen(true)}
          >
            <CartesianGrid vertical={false} horizontal={true} strokeDasharray="0" opacity={0.25} />
            <XAxis
              dataKey="name"
              type="category"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              interval={0}
              minTickGap={8}
              tick={{ fontSize: 12, fill: "#9CA3AF" }}
            />
            <YAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={50}
              tick={{ fontSize: 12, fill: "#9CA3AF" }}
              tickFormatter={(v) => formatKeur(Number(v))}
            />
            <Tooltip
              content={<InventoryByGroupTooltip />}
              cursor={{ fill: "rgba(0, 0, 0, 0.06)", stroke: "transparent" }}
              wrapperStyle={{ outline: "none", zIndex: 10, cursor: "pointer" }}
            />
            <Legend
              verticalAlign="bottom"
              align="center"
              wrapperStyle={{ paddingTop: 8 }}
              content={({ payload }) => <ChartLegend payload={payload} />}
            />
            {stackBy && stackSegments.length > 0 ? (
              stackSegments.map((seg, i) => (
                <Bar
                  key={seg.key}
                  dataKey={seg.key}
                  name={seg.label}
                  stackId="stack"
                  fill={TEAL_SHADES[i % TEAL_SHADES.length]}
                  stroke={BAR_SEPARATOR_STROKE}
                  strokeWidth={1}
                  maxBarSize={48}
                  barCategoryGap="20%"
                  radius={i === stackSegments.length - 1 ? [4, 4, 0, 0] : undefined}
                />
              ))
            ) : (
              <Bar
                dataKey="value"
                fill={BAR_FILL}
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
                barCategoryGap="20%"
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <BottomSheetModal
        open={partBookOpen}
        title="Part book"
        onClose={() => setPartBookOpen(false)}
        seeAllHref="/inventory/analytics"
      >
        <PartbookTable filter={null} />
      </BottomSheetModal>
    </WidgetCard>
  )
}
