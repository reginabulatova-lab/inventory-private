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
import {
  applyOpportunityFilters,
  useInventoryData,
} from "@/components/inventory/inventory-data-provider"

type ViewMode = "quarter" | "month"
type ChartMode = "snapshot" | "projection"

type Point = {
  label: string
  erp: number // in K€
  opp: number // in K€
  target: number // in K€
}

const ERP_MONTH_TEMPLATE = [
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
].map((d) => d.erp)

const ERP_QUARTER_TEMPLATE = [
  { label: "Q1 2025", erp: 880, opp: 157 },
  { label: "Q2 2025", erp: 600, opp: 68 },
  { label: "Q3 2025", erp: 543, opp: 62 },
  { label: "Q4 2025", erp: 613, opp: 125 },
].map((d) => d.erp)

const TARGET_QUARTER_EUR = 2_400_000

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

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function startOfQuarter(d: Date) {
  const q = Math.floor(d.getMonth() / 3) * 3
  return new Date(d.getFullYear(), q, 1)
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}

function endOfQuarter(d: Date) {
  const q = Math.floor(d.getMonth() / 3) * 3
  return new Date(d.getFullYear(), q + 3, 0, 23, 59, 59, 999)
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

function formatMonthLabel(d: Date) {
  return `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`
}

function rangeFromMonthLabel(label: string) {
  const [mon, year] = label.split(" ")
  const monthIndex = MONTH_LABELS.indexOf(mon)
  if (monthIndex < 0) return null
  const y = Number(year)
  if (!Number.isFinite(y)) return null
  const from = new Date(y, monthIndex, 1)
  const to = endOfMonth(from)
  return { from, to }
}

function rangeFromQuarterLabel(label: string) {
  const match = /^Q([1-4])\s+(\d{4})$/.exec(label)
  if (!match) return null
  const q = Number(match[1])
  const y = Number(match[2])
  if (!Number.isFinite(q) || !Number.isFinite(y)) return null
  const from = new Date(y, (q - 1) * 3, 1)
  const to = endOfQuarter(from)
  return { from, to }
}

function buildMonthSeries(
  from: Date,
  to: Date,
  opps: { suggestedDate: string; cashImpactEur: number }[]
) {
  const start = startOfMonth(from)
  const end = endOfMonth(to)
  const months: Date[] = []
  let cursor = new Date(start)
  while (cursor <= end) {
    months.push(new Date(cursor))
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
  }

  return months.map((monthStart) => {
    const monthEnd = endOfMonth(monthStart)
    const quarterStart = startOfQuarter(monthStart)
    const quarterEnd = endOfQuarter(monthStart)
    const quarterDays =
      Math.round((quarterEnd.getTime() - quarterStart.getTime()) / 86400000) + 1
    const monthDays = Math.round((monthEnd.getTime() - monthStart.getTime()) / 86400000) + 1
    const totalEur = opps.reduce((sum, o) => {
      const t = new Date(o.suggestedDate).getTime()
      if (!Number.isFinite(t)) return sum
      if (t >= monthStart.getTime() && t <= monthEnd.getTime()) return sum + o.cashImpactEur
      return sum
    }, 0)
    return {
      label: formatMonthLabel(monthStart),
      oppEur: totalEur,
      targetK: Math.round((TARGET_QUARTER_EUR * (monthDays / quarterDays)) / 1000),
      monthIndex: monthStart.getMonth(),
      year: monthStart.getFullYear(),
    }
  })
}

function buildQuarterSeries(
  from: Date,
  to: Date,
  opps: { suggestedDate: string; cashImpactEur: number }[]
) {
  const start = startOfQuarter(from)
  const end = endOfQuarter(to)
  const quarters: Date[] = []
  let cursor = new Date(start)
  while (cursor <= end) {
    quarters.push(new Date(cursor))
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 3, 1)
  }

  return quarters.map((quarterStart) => {
    const quarterEnd = endOfQuarter(quarterStart)
    const totalEur = opps.reduce((sum, o) => {
      const t = new Date(o.suggestedDate).getTime()
      if (!Number.isFinite(t)) return sum
      if (t >= quarterStart.getTime() && t <= quarterEnd.getTime()) return sum + o.cashImpactEur
      return sum
    }, 0)
    const q = Math.floor(quarterStart.getMonth() / 3) + 1
    return {
      label: `Q${q} ${quarterStart.getFullYear()}`,
      oppEur: totalEur,
      targetK: Math.round(TARGET_QUARTER_EUR / 1000),
      quarterIndex: q - 1,
      year: quarterStart.getFullYear(),
    }
  })
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

  const opps = React.useMemo(() => {
    const from = rangeFrom.getTime()
    const to = rangeTo.getTime()
    const base = opportunities.filter((o) => {
      if (o.plan !== plan) return false
      if (o.status === "Snoozed" || o.status === "Canceled") return false
      const t = new Date(o.suggestedDate).getTime()
      if (!Number.isFinite(t)) return false
      return t >= from && t <= to
    })
    return applyOpportunityFilters(base, filters, escalationTickets)
  }, [
    opportunities,
    plan,
    rangeFrom,
    rangeTo,
    filters.partKeys,
    filters.suggestedActions,
    filters.customers,
    filters.escLevels,
    filters.statuses,
    escalationTickets,
  ])

  const monthOpp = React.useMemo(
    () => buildMonthSeries(rangeFrom, rangeTo, opps),
    [rangeFrom, rangeTo, opps]
  )
  const quarterOpp = React.useMemo(
    () => buildQuarterSeries(rangeFrom, rangeTo, opps),
    [rangeFrom, rangeTo, opps]
  )

  const data = React.useMemo<Point[]>(() => {
    if (chartMode === "snapshot") {
      const oppK = Math.round(
        opps.reduce((sum, o) => sum + (Number.isFinite(o.cashImpactEur) ? o.cashImpactEur : 0), 0) /
          1000
      )
      const monthIndex = rangeFrom.getMonth()
      const quarterIndex = Math.floor(monthIndex / 3)
      const erpBase =
        mode === "month"
          ? ERP_MONTH_TEMPLATE[monthIndex % ERP_MONTH_TEMPLATE.length]
          : ERP_QUARTER_TEMPLATE[quarterIndex % ERP_QUARTER_TEMPLATE.length]
      const target = Math.max(Math.round(oppK * 1.08), oppK + 15)
      const erp = Math.max(erpBase, target + Math.max(25, Math.round(target * 0.12)))
      return [
        {
          label: "Today",
          opp: oppK,
          erp,
          target,
        },
      ]
    }

    if (mode === "month") {
      return monthOpp.map((row, i) => {
        const oppK = Math.round(row.oppEur / 1000)
        const erpBase = ERP_MONTH_TEMPLATE[row.monthIndex % ERP_MONTH_TEMPLATE.length]
        const target = Math.max(Math.round(oppK * 1.08), oppK + 15)
        const erp = Math.max(erpBase, target + Math.max(25, Math.round(target * 0.12)))
        return {
          label: row.label,
          opp: oppK,
          erp,
          target,
        }
      })
    }
    return quarterOpp.map((row, i) => {
      const oppK = Math.round(row.oppEur / 1000)
      const erpBase = ERP_QUARTER_TEMPLATE[row.quarterIndex % ERP_QUARTER_TEMPLATE.length]
      const target = Math.max(Math.round(oppK * 1.08), oppK + 15)
      const erp = Math.max(erpBase, target + Math.max(25, Math.round(target * 0.12)))
      return {
        label: row.label,
        opp: oppK,
        erp,
        target,
      }
    })
  }, [chartMode, mode, monthOpp, quarterOpp, opps, rangeFrom])

  const caption =
    chartMode === "snapshot"
      ? "Inventory as of today"
      : `Projected from ${formatCaptionDate(rangeFrom)} to ${formatCaptionDate(rangeTo)}`

  const handleChartClick = React.useCallback(
    (e: any) => {
      if (chartMode === "snapshot") return
      const label = e?.activeLabel ?? e?.activePayload?.[0]?.payload?.label
      if (!label) return
      const range =
        mode === "month" ? rangeFromMonthLabel(label) : rangeFromQuarterLabel(label)
      if (!range) return
      setPeriodLabel(label)
      setPeriodRange(range)
      setOpen(true)
    },
    [chartMode, mode]
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

