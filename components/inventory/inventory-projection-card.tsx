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
import { computeHealthRiskKPIs } from "@/lib/inventory/selectors"

type ViewMode = "quarter" | "month"

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

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

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

function buildMonthSeries(start: Date, opps: { suggestedDate: string; cashImpactEur: number }[]) {
  const startDate = startOfMonth(start)
  return Array.from({ length: 12 }, (_, i) => {
    const monthStart = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1)
    const monthEnd = new Date(startDate.getFullYear(), startDate.getMonth() + i + 1, 0, 23, 59, 59, 999)
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
    }
  })
}

function buildQuarterSeries(start: Date, opps: { suggestedDate: string; cashImpactEur: number }[]) {
  const startDate = startOfQuarter(start)
  return Array.from({ length: 4 }, (_, i) => {
    const quarterStart = new Date(startDate.getFullYear(), startDate.getMonth() + i * 3, 1)
    const quarterEnd = new Date(startDate.getFullYear(), startDate.getMonth() + i * 3 + 3, 0, 23, 59, 59, 999)
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
    }
  })
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
                borderTop: "3px solid #9CA3AF",
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
  const { opportunities, plan, filters } = useInventoryData()

  const opps = React.useMemo(() => {
    const base = opportunities.filter((o) => o.plan === plan && o.status !== "Snoozed")
    return applyOpportunityFilters(base, filters)
  }, [
    opportunities,
    plan,
    filters.partKeys,
    filters.suggestedActions,
    filters.customers,
    filters.escLevels,
    filters.statuses,
  ])

  const kpis = computeHealthRiskKPIs(opps)

  const start = new Date()
  const monthOpp = React.useMemo(() => buildMonthSeries(start, opps), [start, opps])
  const quarterOpp = React.useMemo(() => buildQuarterSeries(start, opps), [start, opps])

  const data = React.useMemo<Point[]>(() => {
    if (mode === "month") {
      const totalOpp = monthOpp.reduce((sum, row) => sum + row.oppEur, 0)
      const cap = Math.max(0, kpis.inventoryEur)
      const scale = totalOpp > cap && totalOpp > 0 ? cap / totalOpp : 1
      return monthOpp.map((row, i) => {
        const oppK = Math.round((row.oppEur * scale) / 1000)
        const erpBase = ERP_MONTH_TEMPLATE[i % ERP_MONTH_TEMPLATE.length]
        const hasOpp = row.oppEur > 0
        const erp = hasOpp ? Math.max(erpBase, Math.round(oppK * 1.25)) : erpBase
        return {
          label: row.label,
          opp: hasOpp ? oppK : erpBase,
          erp,
          target: row.targetK,
        }
      })
    }
    const totalOpp = quarterOpp.reduce((sum, row) => sum + row.oppEur, 0)
    const cap = Math.max(0, kpis.inventoryEur)
    const scale = totalOpp > cap && totalOpp > 0 ? cap / totalOpp : 1
    return quarterOpp.map((row, i) => {
      const oppK = Math.round((row.oppEur * scale) / 1000)
      const erpBase = ERP_QUARTER_TEMPLATE[i % ERP_QUARTER_TEMPLATE.length]
      const hasOpp = row.oppEur > 0
      const erp = hasOpp ? Math.max(erpBase, Math.round(oppK * 1.25)) : erpBase
      return {
        label: row.label,
        opp: hasOpp ? oppK : erpBase,
        erp,
        target: row.targetK,
      }
    })
  }, [mode, monthOpp, quarterOpp])

  const handleChartClick = React.useCallback(
    (e: any) => {
      const label = e?.activeLabel ?? e?.activePayload?.[0]?.payload?.label
      if (!label) return
      const range =
        mode === "month" ? rangeFromMonthLabel(label) : rangeFromQuarterLabel(label)
      if (!range) return
      setPeriodLabel(label)
      setPeriodRange(range)
      setOpen(true)
    },
    [mode]
  )

  return (
    <WidgetCard
      title="Projected Inventory"
      tooltip="Comparison between ERP plan and projected inventory if all not-snoozed opportunities are applied."
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
            style={{ cursor: "pointer" }}
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
                    ? "ERP plan"
                    : value === "opp"
                      ? "With Opportunities"
                      : value === "target"
                        ? "Target"
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

            {showTarget ? (
              <Line
                type="monotone"
                dataKey="target"
                stroke="#F59E0B"
                strokeWidth={2}
                dot={false}
                activeDot={false}
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
            overrideStatus="To Do"
            overrideDateRange={periodRange}
          />
        ) : null}
      </BottomSheetModal>
    </WidgetCard>
  )
}

