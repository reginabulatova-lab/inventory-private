"use client"

import * as React from "react"
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { WidgetCard } from "@/components/inventory/kpi-card"
import { BottomSheetModal } from "@/components/inventory/bottom-sheet-modal"
import { PartbookTable } from "@/components/inventory/partbook-table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, Layers } from "lucide-react"
import { useInventoryData } from "@/components/inventory/inventory-data-provider"
import {
  buildProjectionOpps,
  buildProjectionSeries,
  type ProjectionPoint,
} from "@/components/inventory/projection-series"
import { buildProjectedBreakdownSeries } from "@/lib/inventory/projected-breakdown"
import {
  STACK_BY_OPTIONS,
  PLANTS,
  WAREHOUSES,
  WAREHOUSE_KEYS,
  STATUS_OPTIONS,
  CUSTOM_FIELD_OPTIONS,
  getSegmentOptions,
  type StackByKey,
} from "@/lib/inventory/chart-group-options"
import { cn } from "@/lib/utils"
import { STACKED_BAR_TEAL } from "@/lib/charts/colors"

type ViewMode = "quarter" | "month" | "week" | "day"
type ChartMode = "snapshot" | "projection"

/** Stack-by options for projection card: None + shared options. Default is Type. */
const PROJECTION_STACK_BY_OPTIONS = [
  { key: "none" as const, label: "None" },
  ...STACK_BY_OPTIONS,
]
type ProjectionStackByKey = (typeof PROJECTION_STACK_BY_OPTIONS)[number]["key"]

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

/** Single teal hue, differentiated by lightness (same palette for Type, Storage location, Status). */
const STAGE_COLORS = STACKED_BAR_TEAL
const TEAL_SHADES = [
  STACKED_BAR_TEAL.raw_material,
  STACKED_BAR_TEAL.wip,
  STACKED_BAR_TEAL.rotables,
  STACKED_BAR_TEAL.finished_goods,
] as const
/** Colors for warehouse (storage location) bars – same teal palette as Type. */
const WAREHOUSE_COLORS: Record<string, string> = Object.fromEntries(
  WAREHOUSE_KEYS.map((key, i) => [key, TEAL_SHADES[i % TEAL_SHADES.length]])
)
/** Colors for plant bars – same teal palette as Type. */
const PLANT_COLORS: Record<string, string> = Object.fromEntries(
  PLANTS.map((p, i) => [`plant_${p}K`, TEAL_SHADES[i % TEAL_SHADES.length]])
)
/** Colors for status bars – same teal palette as Type. */
const STATUS_BAR_COLORS: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((opt, i) => [opt.key, TEAL_SHADES[i % TEAL_SHADES.length]])
)
/** Colors for custom field bars. */
const CUSTOM_FIELD_COLORS: Record<string, string> = Object.fromEntries(
  CUSTOM_FIELD_OPTIONS.map((opt, i) => [opt.key, TEAL_SHADES[i % TEAL_SHADES.length]])
)
/** 1px separator between stacked segments (white at low opacity). */
const BAR_SEPARATOR_STROKE = "rgba(255,255,255,0.55)"
const PAST_DATA_OPACITY = 0.3

const LINE_COLORS = {
  erp: "#19A7B0",
  opp: "#F59E0B",
  target: "#19A7B0",
}
const LINE_WHITE_STROKE_OFFSET = 4

/** Bar shape that applies 30% opacity to past data in projection mode. */
function barShapeWithPastOpacity(props: {
  x?: number
  y?: number
  width?: number
  height?: number
  fill?: string
  stroke?: string
  strokeWidth?: number
  radius?: number[]
  payload?: { isPast?: boolean }
}) {
  const { x = 0, y = 0, width = 0, height = 0, fill, stroke, strokeWidth, radius, payload } = props
  const opacity = payload?.isPast ? PAST_DATA_OPACITY : 1
  const [r0, r1, r2, r3] = radius ?? [0, 0, 0, 0]
  const rx = width > 0 ? Math.min(r0 ?? 0, width / 2) : 0
  const ry = height > 0 ? Math.min(r1 ?? 0, height / 2) : 0
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill={fill}
      fillOpacity={opacity}
      stroke={stroke}
      strokeWidth={strokeWidth}
      rx={rx}
      ry={ry}
    />
  )
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
  const target = byKey.get("target") ?? byKey.get("targetPast") ?? byKey.get("targetFuture")
  const lineKeys = new Set([
    "erp",
    "erpPast",
    "erpFuture",
    "opp",
    "target",
    "targetPast",
    "targetFuture",
  ])
  const barEntries = payload.filter(
    (p): p is { dataKey: string; value?: number; name?: string; color?: string } =>
      p?.dataKey != null && !lineKeys.has(String(p.dataKey))
  )
  const hasBreakdown = barEntries.length > 0

  return (
    <div className="relative z-10 rounded-xl border bg-white p-4 shadow-lg">
      <div className="text-base font-semibold text-foreground">{label}</div>

      <div className="mt-3 space-y-3">
        {opp != null ? (
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-4"
                style={{
                  height: 0,
                  borderTop: `2px dashed ${LINE_COLORS.opp}`,
                  borderRadius: 999,
                }}
              />
              <span className="text-sm font-medium text-foreground">
                With Opportunities
              </span>
            </div>
            <span className="text-sm font-semibold text-foreground">
              {tooltipValueFormatter(opp)}
            </span>
          </div>
        ) : null}

        {target != null ? (
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-4"
                style={{
                  height: 0,
                  borderTop: `2px solid ${LINE_COLORS.target}`,
                  borderRadius: 999,
                }}
              />
              <span className="text-sm font-medium text-foreground">
                Projected stock
              </span>
            </div>
            <span className="text-sm font-semibold text-foreground">
              {tooltipValueFormatter(target)}
            </span>
          </div>
        ) : null}
      </div>

      {hasBreakdown ? (
        <div className="mt-4 border-t pt-4">
          <div className="space-y-3">
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
                  {entry.value != null ? tooltipValueFormatter(entry.value) : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function InventoryProjectionCard() {
  const [mode, setMode] = React.useState<ViewMode>("month")
  const [showTarget, setShowTarget] = React.useState(true)
  const [showOpp, setShowOpp] = React.useState(true)
  const [stackBy, setStackBy] = React.useState<ProjectionStackByKey>("type")
  const [stackByOpen, setStackByOpen] = React.useState(false)
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
  const viewOptions = React.useMemo(() => {
    if (timeframePreset === "eom") {
      return [
        { value: "week" as const, label: "Week" },
        { value: "day" as const, label: "Day" },
      ]
    }
    if (timeframePreset === "eoq") {
      return [
        { value: "month" as const, label: "Month" },
        { value: "week" as const, label: "Week" },
      ]
    }
    if (timeframePreset === "eoy") {
      return [
        { value: "quarter" as const, label: "Quarter" },
        { value: "month" as const, label: "Month" },
      ]
    }
    return [
      { value: "quarter" as const, label: "Quarter" },
      { value: "month" as const, label: "Month" },
    ]
  }, [timeframePreset])

  React.useEffect(() => {
    if (!viewOptions.some((option) => option.value === mode)) {
      setMode(viewOptions[0]?.value ?? "month")
    }
  }, [viewOptions, mode])

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

  const trendFrom = React.useMemo(() => {
    if (chartMode === "snapshot") return rangeFrom
    return startOfDay(new Date(2026, 0, 1))
  }, [chartMode, rangeFrom])

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
        trendFrom: chartMode === "projection" ? trendFrom : undefined,
        futureStart: rangeFrom,
      }),
    [chartMode, mode, opps, rangeFrom, rangeTo, trendFrom]
  )

  const breakdownSeries = React.useMemo(() => buildProjectedBreakdownSeries(data), [data])

  const chartData = React.useMemo(() => {
    const futureStartTime = rangeFrom.getTime()
    const base = data.map((point, index) => ({
      ...point,
      ...(breakdownSeries[index] ?? {}),
      isPast: point.date.getTime() < futureStartTime,
    }))
    return base.map((point, i) => {
      const totalK = point.erp ?? 0
      const seed = point.label ?? ""
      const warehouseValues = splitBySeed(totalK, `${seed}-warehouse`, WAREHOUSES.length)
      const plantValues = splitBySeed(totalK, `${seed}-plant`, PLANTS.length)
      const statusValues = splitBySeed(totalK, `${seed}-status`, STATUS_OPTIONS.length)
      const customFieldValues = splitBySeed(totalK, `${seed}-customField`, CUSTOM_FIELD_OPTIONS.length)
      const warehouseEntries: Record<string, number> = {}
      WAREHOUSE_KEYS.forEach((key, i) => {
        warehouseEntries[key] = warehouseValues[i] ?? 0
      })
      const plantEntries: Record<string, number> = {}
      PLANTS.forEach((plant, i) => {
        plantEntries[`plant_${plant}K`] = plantValues[i] ?? 0
      })
      const statusEntries: Record<string, number> = {}
      STATUS_OPTIONS.forEach((opt, i) => {
        statusEntries[opt.key] = statusValues[i] ?? 0
      })
      const customFieldEntries: Record<string, number> = {}
      CUSTOM_FIELD_OPTIONS.forEach((opt, i) => {
        customFieldEntries[opt.key] = customFieldValues[i] ?? 0
      })
      const isPast = point.date.getTime() < futureStartTime
      const isFirstFuturePoint = !isPast && (i === 0 || base[i - 1].date.getTime() < futureStartTime)
      return {
        ...point,
        ...warehouseEntries,
        ...plantEntries,
        ...statusEntries,
        ...customFieldEntries,
        isPast,
        erpPast: isPast ? point.erp : null,
        erpFuture: !isPast ? point.erp : null,
        targetPast: isPast || isFirstFuturePoint ? point.target : null,
        targetFuture: !isPast ? point.target : null,
      }
    })
  }, [data, breakdownSeries, rangeFrom])

  const caption =
    chartMode === "snapshot"
      ? "Inventory as of today"
      : `Trend from ${formatCaptionDate(trendFrom)} to ${formatCaptionDate(rangeTo)}`

  const handleChartClick = React.useCallback(
    (e: any) => {
      if (chartMode === "snapshot") return
      const label = e?.activeLabel ?? e?.activePayload?.[0]?.payload?.label
      const point = data.find((p) => p.label === label)
      if (!point) return

      const effectiveMode = mode === "quarter" ? "quarter" : "month"

      if (effectiveMode === "month") {
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
      title={chartMode === "snapshot" ? "Current Inventory Position" : "Inventory breakdown"}
      tooltip={
        chartMode === "snapshot"
          ? "Inventory position as of today (snapshot)."
          : "Stacked inventory value. With opportunities applies only from today onward. For DIO trend see the Inventory trend widget."
      }
      subtitle={caption}
      size="l"
      className="h-full w-full flex-1 min-w-0"
      headerRight={
        <div className="flex items-center gap-2">
          <Select value={mode} onValueChange={(v) => setMode(v as ViewMode)}>
            <SelectTrigger size="sm" className="h-8 w-[7rem] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {viewOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Popover open={stackByOpen} onOpenChange={setStackByOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <Layers className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 truncate">
                  Stack by: {PROJECTION_STACK_BY_OPTIONS.find((o) => o.key === stackBy)?.label ?? "Type"}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52 p-3">
              <div className="text-xs font-medium text-muted-foreground mb-2">Stack by</div>
              <div className="space-y-1">
                {PROJECTION_STACK_BY_OPTIONS.map(({ key, label }) => (
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
                        setStackBy(key as ProjectionStackByKey)
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowOpp((prev) => !prev)}>
                <span
                  className="mr-2 inline-block w-4"
                  style={{ height: 0, borderTop: `2px dashed ${LINE_COLORS.opp}` }}
                />
                {showOpp ? "Hide opportunities line" : "Show opportunities line"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowTarget((prev) => !prev)}>
                <span
                  className="mr-2 inline-block w-4"
                  style={{ height: 0, borderTop: `2px solid ${LINE_COLORS.target}` }}
                />
                {showTarget ? "Hide Projected stock" : "Show Projected stock"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    >
      <div className="flex-1 min-h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
            barSize={48}
            onClick={handleChartClick}
            style={{ cursor: chartMode === "snapshot" ? "default" : "pointer" }}
          >
            <CartesianGrid vertical={false} horizontal={true} strokeDasharray="0" opacity={0.25} />

            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              interval="preserveStartEnd"
              minTickGap={18}
              tick={{ fontSize: 12, fill: "#9CA3AF" }}
            />

            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              width={58}
              tick={{ fontSize: 12, fill: "#9CA3AF" }}
              tickFormatter={(v) => formatKeur(Number(v))}
            />

            <Tooltip
              content={<InventoryProjectionTooltip />}
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.35 }}
              wrapperStyle={{ outline: "none", zIndex: 10 }}
            />

            <Legend
              verticalAlign="bottom"
              align="center"
              wrapperStyle={{ paddingTop: 24 }}
              content={({ payload }) => {
                if (!payload?.length) return null
                const lineKeysToMerge = ["targetPast", "targetFuture"]
                const lineKeysToExclude = ["erpPast", "erpFuture"]
                const seen = new Set<string>()
                const merged = payload.filter((entry) => {
                  const key = String(entry.dataKey)
                  if (lineKeysToMerge.includes(key) || lineKeysToExclude.includes(key)) return false
                  if (seen.has(key)) return false
                  seen.add(key)
                  return true
                })
                const targetEntry = payload.find(
                  (e) => e.dataKey === "targetPast" || e.dataKey === "targetFuture"
                )
                if (targetEntry) {
                  merged.push({ ...targetEntry, dataKey: "target", value: "target" })
                }
                const items = merged.map((entry) => {
                      const key = String(entry.dataKey)
                      const label =
                        key === "opp"
                          ? chartMode === "snapshot"
                            ? "Opportunities (potential)"
                            : "With Opportunities"
                          : key === "target"
                            ? chartMode === "snapshot"
                              ? "Projected stock (today)"
                              : "Projected stock"
                            : entry.value ?? key

                      const isLine = key === "opp" || key === "target"
                      return (
                        <div
                          key={key}
                          className="flex items-center gap-2"
                          style={{ marginRight: 12 }}
                        >
                          {isLine ? (
                            <span
                              className="inline-block w-5"
                              style={{
                                height: 0,
                                borderTopWidth: 2,
                                borderTopStyle: key === "opp" ? "dashed" : "solid",
                                borderTopColor:
                                  key === "opp" ? LINE_COLORS.opp : LINE_COLORS.target,
                                borderRadius: 999,
                              }}
                            />
                          ) : (
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: entry.color }}
                            />
                          )}
                          <span className="text-sm text-muted-foreground">{label}</span>
                        </div>
                      )
                    })

                if (!items.length) return null
                const last = items.length - 1
                items[last] = React.cloneElement(items[last], { style: { marginRight: 0 } })

                return (
                  <div className="flex flex-wrap items-center justify-center gap-y-2">
                    {items}
                  </div>
                )
              }}
            />

            {stackBy === "none" && (
                <Bar
                  dataKey="totalK"
                  name="Inventory"
                  fill={STAGE_COLORS.finished_goods}
                  radius={[4, 4, 0, 0]}
                  stroke={BAR_SEPARATOR_STROKE}
                  strokeWidth={1}
                  maxBarSize={48}
                  shape={barShapeWithPastOpacity}
                />
              )}
            {stackBy === "type" && (
                  <>
                    <Bar
                      dataKey="rawMaterialK"
                      name="Raw Material"
                      stackId="inventory"
                      fill={STACKED_BAR_TEAL.raw_material}
                      stroke={BAR_SEPARATOR_STROKE}
                      strokeWidth={1}
                      maxBarSize={48}
                      shape={barShapeWithPastOpacity}
                    />
                    <Bar
                      dataKey="wipK"
                      name="WIP"
                      stackId="inventory"
                      fill={STACKED_BAR_TEAL.wip}
                      stroke={BAR_SEPARATOR_STROKE}
                      strokeWidth={1}
                      maxBarSize={48}
                      shape={barShapeWithPastOpacity}
                    />
                    <Bar
                      dataKey="finishedGoodsK"
                      name="Finished Goods"
                      stackId="inventory"
                      fill={STAGE_COLORS.finished_goods}
                      radius={[4, 4, 0, 0]}
                      stroke={BAR_SEPARATOR_STROKE}
                      strokeWidth={1}
                      maxBarSize={48}
                      shape={barShapeWithPastOpacity}
                    />
                  </>
                )}
                {stackBy === "rotables" && (
                  <Bar
                    dataKey="rotablesK"
                    name="Rotables"
                    stackId="inventory"
                    fill={STAGE_COLORS.rotables}
                    radius={[4, 4, 0, 0]}
                    stroke={BAR_SEPARATOR_STROKE}
                    strokeWidth={1}
                    maxBarSize={48}
                    shape={barShapeWithPastOpacity}
                  />
                )}
                {stackBy === "storageLocation" &&
                  getSegmentOptions("storageLocation").map((seg, i) => (
                    <Bar
                      key={seg.key}
                      dataKey={seg.key}
                      name={seg.label}
                      stackId="inventory"
                      fill={WAREHOUSE_COLORS[seg.key]}
                      stroke={BAR_SEPARATOR_STROKE}
                      strokeWidth={1}
                      maxBarSize={48}
                      radius={i === WAREHOUSE_KEYS.length - 1 ? [4, 4, 0, 0] : undefined}
                      shape={barShapeWithPastOpacity}
                    />
                  ))}
                {stackBy === "plant" &&
                  PLANTS.map((plant, i) => (
                    <Bar
                      key={plant}
                      dataKey={`plant_${plant}K`}
                      name={plant}
                      stackId="inventory"
                      fill={PLANT_COLORS[`plant_${plant}K`]}
                      stroke={BAR_SEPARATOR_STROKE}
                      strokeWidth={1}
                      maxBarSize={48}
                      radius={i === PLANTS.length - 1 ? [4, 4, 0, 0] : undefined}
                      shape={barShapeWithPastOpacity}
                    />
                  ))}
                {stackBy === "status" &&
                  STATUS_OPTIONS.map((opt, i) => (
                    <Bar
                      key={opt.key}
                      dataKey={opt.key}
                      name={opt.label}
                      stackId="inventory"
                      fill={STATUS_BAR_COLORS[opt.key]}
                      stroke={BAR_SEPARATOR_STROKE}
                      strokeWidth={1}
                      maxBarSize={48}
                      radius={i === STATUS_OPTIONS.length - 1 ? [4, 4, 0, 0] : undefined}
                      shape={barShapeWithPastOpacity}
                    />
                  ))}
                {stackBy === "customField" &&
                  CUSTOM_FIELD_OPTIONS.map((opt, i) => (
                    <Bar
                      key={opt.key}
                      dataKey={opt.key}
                      name={opt.label}
                      stackId="inventory"
                      fill={CUSTOM_FIELD_COLORS[opt.key]}
                      stroke={BAR_SEPARATOR_STROKE}
                      strokeWidth={1}
                      maxBarSize={48}
                      radius={i === CUSTOM_FIELD_OPTIONS.length - 1 ? [4, 4, 0, 0] : undefined}
                      shape={barShapeWithPastOpacity}
                    />
                  ))}

            {showOpp ? (
              <>
                <Line
                  type="monotone"
                  dataKey="opp"
                  stroke="#ffffff"
                  strokeWidth={2.5 + LINE_WHITE_STROKE_OFFSET}
                  strokeDasharray="5 5"
                  dot={false}
                  connectNulls={false}
                  legendType="none"
                  isAnimationActive={false}
                  opacity={chartMode === "snapshot" ? 0.45 : 1}
                />
                <Line
                  type="monotone"
                  dataKey="opp"
                  stroke={LINE_COLORS.opp}
                  strokeWidth={2.5}
                  strokeDasharray="5 5"
                  dot={false}
                  connectNulls={false}
                  activeDot={{
                    r: 4,
                    stroke: "#ffffff",
                    strokeWidth: 2,
                    strokeDasharray: "0",
                    fill: LINE_COLORS.opp,
                  }}
                  opacity={chartMode === "snapshot" ? 0.45 : 1}
                />
              </>
            ) : null}

            {showTarget ? (
              <>
                <Line
                  type="monotone"
                  dataKey={chartMode === "projection" ? "targetPast" : "target"}
                  stroke="#ffffff"
                  strokeWidth={2 + LINE_WHITE_STROKE_OFFSET}
                  dot={false}
                  connectNulls={chartMode === "projection"}
                  legendType="none"
                  isAnimationActive={false}
                  opacity={chartMode === "snapshot" ? 0.7 : PAST_DATA_OPACITY}
                />
                {chartMode === "projection" ? (
                  <Line
                    type="monotone"
                    dataKey="targetFuture"
                    stroke="#ffffff"
                    strokeWidth={2 + LINE_WHITE_STROKE_OFFSET}
                    dot={false}
                    connectNulls={false}
                    legendType="none"
                    isAnimationActive={false}
                    opacity={1}
                  />
                ) : null}
                <Line
                  type="monotone"
                  dataKey={chartMode === "projection" ? "targetPast" : "target"}
                  stroke={LINE_COLORS.target}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={chartMode === "projection"}
                  activeDot={{ r: 4, stroke: "#ffffff", strokeWidth: 2, fill: LINE_COLORS.target }}
                  opacity={chartMode === "snapshot" ? 0.7 : PAST_DATA_OPACITY}
                />
                {chartMode === "projection" ? (
                  <Line
                    type="monotone"
                    dataKey="targetFuture"
                    stroke={LINE_COLORS.target}
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                    activeDot={{ r: 4, stroke: "#ffffff", strokeWidth: 2, fill: LINE_COLORS.target }}
                    opacity={1}
                  />
                ) : null}
              </>
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <BottomSheetModal
        open={open}
        title="Part book"
        subtitle={periodLabel ?? undefined}
        onClose={() => setOpen(false)}
      >
        {periodRange ? (
          <PartbookTable filter={null} />
        ) : null}
      </BottomSheetModal>
    </WidgetCard>
  )
}

