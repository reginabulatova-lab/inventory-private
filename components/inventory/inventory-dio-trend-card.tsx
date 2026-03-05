"use client"

import * as React from "react"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { WidgetCard } from "@/components/inventory/kpi-card"
import { BottomSheetModal } from "@/components/inventory/bottom-sheet-modal"
import { OpportunitiesTable } from "@/components/opportunities/opportunities-table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useInventoryData } from "@/components/inventory/inventory-data-provider"
import {
  buildProjectionOpps,
  buildProjectionSeries,
  type ProjectionPoint,
} from "@/components/inventory/projection-series"

type ViewMode = "quarter" | "month" | "week" | "day"
type ChartMode = "snapshot" | "projection"
type MetricType = "dio" | "gito" | "nito"

const METRIC_OPTIONS: { value: MetricType; label: string }[] = [
  { value: "dio", label: "DIO" },
  { value: "gito", label: "GITO" },
  { value: "nito", label: "NITO" },
]

const DIO_LINE_COLOR = "#19A7B0"
const TARGET_LINE_COLOR = "#F59E0B"
const PAST_DATA_OPACITY = 0.3
const LINE_WHITE_STROKE_OFFSET = 4

/** Template values for GITO (Gross Inventory Turnover) by month index - ratio e.g. turns per year */
const GITO_MONTH_TEMPLATE = [4.2, 3.8, 4.1, 4.5, 4.2, 5.8, 4.6, 5.0, 4.4, 5.0, 4.0, 4.2]
/** Template values for NITO (Net Inventory Turnover) by month index */
const NITO_MONTH_TEMPLATE = [3.2, 2.9, 3.1, 3.4, 3.2, 4.2, 3.5, 3.8, 3.3, 3.7, 3.0, 3.1]
const GITO_QUARTER_TEMPLATE = [4.0, 4.8, 4.6, 4.1]
const NITO_QUARTER_TEMPLATE = [3.0, 3.6, 3.5, 3.1]
/** Target GITO (slightly above projection) – bigger gap for demo */
const GITO_TARGET_MONTH = GITO_MONTH_TEMPLATE.map((v) => Math.min(8, v + 1.0))
const GITO_TARGET_QUARTER = GITO_QUARTER_TEMPLATE.map((v) => Math.min(8, v + 0.9))
const NITO_TARGET_MONTH = NITO_MONTH_TEMPLATE.map((v) => Math.min(6, v + 0.8))
const NITO_TARGET_QUARTER = NITO_QUARTER_TEMPLATE.map((v) => Math.min(6, v + 0.7))

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

function formatKeur(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(1)} M€`
  return `${Math.round(v)} K€`
}

function formatTurnover(v: number) {
  return `${Number(v).toFixed(1)}x`
}

function TrendTooltip({
  active,
  payload,
  label,
  metricType,
  metricLabel,
  formatValue,
}: {
  active?: boolean
  payload?: any[]
  label?: string
  metricType: MetricType
  metricLabel: string
  formatValue: (v: number) => string
}) {
  if (!active || !payload?.length) return null
  const metricPast = payload.find((p) => p.dataKey === "metricPast")?.value
  const metricFuture = payload.find((p) => p.dataKey === "metricFuture")?.value
  const metricSingle = payload.find((p) => p.dataKey === "metric")?.value
  const metricVal = metricPast ?? metricFuture ?? metricSingle
  const targetPast = payload.find((p) => p.dataKey === "targetPast")?.value
  const targetFuture = payload.find((p) => p.dataKey === "targetFuture")?.value
  const targetSingle = payload.find((p) => p.dataKey === "target")?.value
  const targetVal = targetPast ?? targetFuture ?? targetSingle
  if (metricVal == null && targetVal == null) return null
  return (
    <div className="relative z-10 rounded-xl border bg-white p-4 shadow-lg">
      <div className="text-base font-semibold text-foreground">{label}</div>
      <div className="mt-3 space-y-3">
        {metricVal != null && (
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-4"
                style={{
                  height: 0,
                  borderTop: `2px solid ${DIO_LINE_COLOR}`,
                  borderRadius: 999,
                }}
              />
              <span className="text-sm font-medium text-foreground">{metricLabel}</span>
            </div>
            <span className="text-sm font-semibold text-foreground">{formatValue(Number(metricVal))}</span>
          </div>
        )}
        {targetVal != null && (
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-4"
                style={{
                  height: 0,
                  borderTop: `2px dashed ${TARGET_LINE_COLOR}`,
                  borderRadius: 999,
                }}
              />
              <span className="text-sm font-medium text-foreground">Target</span>
            </div>
            <span className="text-sm font-semibold text-foreground">{formatValue(Number(targetVal))}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function InventoryDioTrendCard() {
  const [mode, setMode] = React.useState<ViewMode>("month")
  const [metricType, setMetricType] = React.useState<MetricType>("dio")
  const [modalOpen, setModalOpen] = React.useState(false)
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

  const chartData = React.useMemo(() => {
    const futureStartTime = rangeFrom.getTime()
    const useQuarter = mode === "quarter"
    return data.map((point, i) => {
      const isPast = point.date.getTime() < futureStartTime
      const isFirstFuturePoint = !isPast && (i === 0 || data[i - 1].date.getTime() < futureStartTime)
      const monthIndex = point.date.getMonth()
      const quarterIndex = Math.floor(monthIndex / 3)
      const gito =
        useQuarter
          ? GITO_QUARTER_TEMPLATE[quarterIndex % GITO_QUARTER_TEMPLATE.length]
          : GITO_MONTH_TEMPLATE[monthIndex % GITO_MONTH_TEMPLATE.length]
      const nito =
        useQuarter
          ? NITO_QUARTER_TEMPLATE[quarterIndex % NITO_QUARTER_TEMPLATE.length]
          : NITO_MONTH_TEMPLATE[monthIndex % NITO_MONTH_TEMPLATE.length]
      const gitoTarget =
        useQuarter
          ? GITO_TARGET_QUARTER[quarterIndex % GITO_TARGET_QUARTER.length]
          : GITO_TARGET_MONTH[monthIndex % GITO_TARGET_MONTH.length]
      const nitoTarget =
        useQuarter
          ? NITO_TARGET_QUARTER[quarterIndex % NITO_TARGET_QUARTER.length]
          : NITO_TARGET_MONTH[monthIndex % NITO_TARGET_MONTH.length]
      return {
        label: point.label,
        date: point.date,
        erpPast: isPast || isFirstFuturePoint ? point.erp : null,
        erpFuture: !isPast ? point.erp : null,
        erp: point.erp,
        gitoPast: isPast || isFirstFuturePoint ? gito : null,
        gitoFuture: !isPast ? gito : null,
        gito,
        nitoPast: isPast || isFirstFuturePoint ? nito : null,
        nitoFuture: !isPast ? nito : null,
        nito,
        targetDioPast: isPast || isFirstFuturePoint ? point.target : null,
        targetDioFuture: !isPast ? point.target : null,
        targetGitoPast: isPast || isFirstFuturePoint ? gitoTarget : null,
        targetGitoFuture: !isPast ? gitoTarget : null,
        targetNitoPast: isPast || isFirstFuturePoint ? nitoTarget : null,
        targetNitoFuture: !isPast ? nitoTarget : null,
        metricPast:
          metricType === "dio"
            ? isPast || isFirstFuturePoint
              ? point.erp
              : null
            : metricType === "gito"
              ? isPast || isFirstFuturePoint
                ? gito
                : null
              : isPast || isFirstFuturePoint
                ? nito
                : null,
        metricFuture:
          metricType === "dio"
            ? !isPast
              ? point.erp
              : null
            : metricType === "gito"
              ? !isPast
                ? gito
                : null
              : !isPast
                ? nito
                : null,
        targetPast:
          metricType === "dio"
            ? isPast || isFirstFuturePoint
              ? point.target
              : null
            : metricType === "gito"
              ? isPast || isFirstFuturePoint
                ? gitoTarget
                : null
              : isPast || isFirstFuturePoint
                ? nitoTarget
                : null,
        targetFuture:
          metricType === "dio"
            ? !isPast
              ? point.target
              : null
            : metricType === "gito"
              ? !isPast
                ? gitoTarget
                : null
              : !isPast
                ? nitoTarget
                : null,
        metric:
          metricType === "dio" ? point.erp : metricType === "gito" ? gito : nito,
        target:
          metricType === "dio" ? point.target : metricType === "gito" ? gitoTarget : nitoTarget,
      }
    })
  }, [data, rangeFrom, mode, metricType])

  const caption =
    chartMode === "snapshot"
      ? `${METRIC_OPTIONS.find((m) => m.value === metricType)?.label ?? "Metric"} as of today`
      : `Trend from ${formatCaptionDate(trendFrom)} to ${formatCaptionDate(rangeTo)}`

  const metricLabel =
    metricType === "dio"
      ? "Days Inventory Outstanding (DIO)"
      : metricType === "gito"
        ? "Gross Inventory Turnover (GITO)"
        : "Net Inventory Turnover (NITO)"
  const formatValue = metricType === "dio" ? formatKeur : formatTurnover
  const metricColor = DIO_LINE_COLOR
  const useTurnoverAxis = metricType === "gito" || metricType === "nito"

  const futureStartTime = rangeFrom.getTime()
  const handleChartClick = React.useCallback(
    (e: { activeLabel?: string; activePayload?: { payload: { label?: string; date?: Date | string } }[] }) => {
      if (chartMode === "snapshot") return
      const label = e?.activeLabel ?? e?.activePayload?.[0]?.payload?.label
      const point = chartData.find((p) => p.label === label)
      if (!point?.date) return
      const pointDate = point.date instanceof Date ? point.date : new Date(point.date)
      if (pointDate.getTime() < futureStartTime) return
      const effectiveMode = mode === "quarter" ? "quarter" : "month"
      if (effectiveMode === "month") {
        const from = new Date(pointDate.getFullYear(), pointDate.getMonth(), 1)
        const to = new Date(pointDate.getFullYear(), pointDate.getMonth() + 1, 0, 23, 59, 59, 999)
        setPeriodLabel(label ?? null)
        setPeriodRange({ from, to })
        setModalOpen(true)
        return
      }
      const quarterStart = new Date(
        pointDate.getFullYear(),
        Math.floor(pointDate.getMonth() / 3) * 3,
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
      setPeriodLabel(label ?? null)
      setPeriodRange({ from: quarterStart, to: quarterEnd })
      setModalOpen(true)
    },
    [chartMode, chartData, mode, futureStartTime]
  )

  return (
    <WidgetCard
      title="Inventory trend"
      tooltip={
        chartMode === "snapshot"
          ? "Select a metric (DIO, GITO, or NITO) to see its value and target as of today."
          : "Select a metric to see its trend and target. Past data is faded; timeline changes granularity."
      }
      subtitle={caption}
      size="m"
      className="h-full w-full flex-1 min-w-0"
      headerRight={
        <div className="flex items-center gap-2">
          <Select value={metricType} onValueChange={(v) => setMetricType(v as MetricType)}>
            <SelectTrigger size="sm" className="h-8 w-[6rem] text-xs">
              <SelectValue placeholder="Metric" />
            </SelectTrigger>
            <SelectContent align="end">
              {METRIC_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        </div>
      }
    >
      <div className="flex-1 min-h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
            onClick={handleChartClick}
            style={{ cursor: chartMode === "projection" ? "pointer" : "default" }}
          >
            <CartesianGrid vertical={false} horizontal strokeDasharray="0" opacity={0.25} />
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
              hide={useTurnoverAxis}
            />
            <YAxis
              yAxisId="turnover"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              width={44}
              tick={{ fontSize: 12, fill: "#9CA3AF" }}
              tickFormatter={(v) => formatTurnover(Number(v))}
              hide={!useTurnoverAxis}
            />
            <Tooltip
              content={
                <TrendTooltip
                  metricType={metricType}
                  metricLabel={metricLabel}
                  formatValue={formatValue}
                />
              }
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.35 }}
              wrapperStyle={{ outline: "none", zIndex: 10 }}
            />
            <Legend
              verticalAlign="bottom"
              align="center"
              wrapperStyle={{ paddingTop: 16 }}
              content={() => (
                <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-4"
                      style={{
                        height: 0,
                        borderTop: `2px solid ${metricColor}`,
                        borderRadius: 999,
                      }}
                    />
                    <span className="text-sm text-muted-foreground">{metricLabel}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-4"
                      style={{
                        height: 0,
                        borderTop: `2px dashed ${TARGET_LINE_COLOR}`,
                        borderRadius: 999,
                      }}
                    />
                    <span className="text-sm text-muted-foreground">Target</span>
                  </div>
                </div>
              )}
            />
            {/* White outline behind metric line */}
            <Line
              type="monotone"
              dataKey={chartMode === "projection" ? "metricPast" : "metric"}
              yAxisId={useTurnoverAxis ? "turnover" : undefined}
              stroke="#ffffff"
              strokeWidth={2.5 + LINE_WHITE_STROKE_OFFSET}
              dot={false}
              connectNulls={chartMode === "projection"}
              legendType="none"
              isAnimationActive={false}
              opacity={chartMode === "snapshot" ? 0.95 : PAST_DATA_OPACITY}
            />
            {chartMode === "projection" ? (
              <Line
                type="monotone"
                dataKey="metricFuture"
                yAxisId={useTurnoverAxis ? "turnover" : undefined}
                stroke="#ffffff"
                strokeWidth={2.5 + LINE_WHITE_STROKE_OFFSET}
                dot={false}
                connectNulls={false}
                legendType="none"
                isAnimationActive={false}
                opacity={1}
              />
            ) : null}
            <Line
              type="monotone"
              dataKey={chartMode === "projection" ? "metricPast" : "metric"}
              yAxisId={useTurnoverAxis ? "turnover" : undefined}
              stroke={metricColor}
              strokeWidth={2.5}
              dot={false}
              connectNulls={chartMode === "projection"}
              activeDot={{ r: 4, stroke: "#ffffff", strokeWidth: 2, fill: metricColor }}
              opacity={chartMode === "snapshot" ? 0.95 : PAST_DATA_OPACITY}
            />
            {chartMode === "projection" ? (
              <Line
                type="monotone"
                dataKey="metricFuture"
                yAxisId={useTurnoverAxis ? "turnover" : undefined}
                stroke={metricColor}
                strokeWidth={2.5}
                dot={false}
                connectNulls={false}
                activeDot={{ r: 4, stroke: "#ffffff", strokeWidth: 2, fill: metricColor }}
                opacity={1}
              />
            ) : null}
            {/* White outline behind target line */}
            <Line
              type="monotone"
              dataKey={chartMode === "projection" ? "targetPast" : "target"}
              yAxisId={useTurnoverAxis ? "turnover" : undefined}
              stroke="#ffffff"
              strokeWidth={2 + LINE_WHITE_STROKE_OFFSET}
              strokeDasharray="5 5"
              dot={false}
              connectNulls={chartMode === "projection"}
              legendType="none"
              isAnimationActive={false}
              opacity={chartMode === "snapshot" ? 0.9 : PAST_DATA_OPACITY}
            />
            {chartMode === "projection" ? (
              <Line
                type="monotone"
                dataKey="targetFuture"
                yAxisId={useTurnoverAxis ? "turnover" : undefined}
                stroke="#ffffff"
                strokeWidth={2 + LINE_WHITE_STROKE_OFFSET}
                strokeDasharray="5 5"
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
              yAxisId={useTurnoverAxis ? "turnover" : undefined}
              stroke={TARGET_LINE_COLOR}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              connectNulls={chartMode === "projection"}
              activeDot={{ r: 3, stroke: "#ffffff", strokeWidth: 1.5, fill: TARGET_LINE_COLOR }}
              opacity={chartMode === "snapshot" ? 0.9 : PAST_DATA_OPACITY}
            />
            {chartMode === "projection" ? (
              <Line
                type="monotone"
                dataKey="targetFuture"
                yAxisId={useTurnoverAxis ? "turnover" : undefined}
                stroke={TARGET_LINE_COLOR}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                connectNulls={false}
                activeDot={{ r: 3, stroke: "#ffffff", strokeWidth: 1.5, fill: TARGET_LINE_COLOR }}
                opacity={1}
              />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <BottomSheetModal
        open={modalOpen}
        title="Opportunities to reduce gap to target"
        subtitle={periodLabel ?? undefined}
        onClose={() => {
          setModalOpen(false)
          setPeriodLabel(null)
          setPeriodRange(null)
        }}
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
