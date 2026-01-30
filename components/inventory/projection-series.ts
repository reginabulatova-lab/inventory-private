import { applyOpportunityFilters } from "@/components/inventory/inventory-data-provider"
import type { Opportunity } from "@/lib/inventory/types"

export type ProjectionViewMode = "month" | "quarter"
export type ProjectionChartMode = "snapshot" | "projection"

type OppInput = { suggestedDate: string; cashImpactEur: number }

type MonthOpp = {
  label: string
  date: Date
  oppEur: number
  targetK: number
  monthIndex: number
}

type QuarterOpp = {
  label: string
  date: Date
  oppEur: number
  targetK: number
  quarterIndex: number
}

export type ProjectionPoint = {
  label: string
  date: Date
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

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}

function startOfQuarter(d: Date) {
  const q = Math.floor(d.getMonth() / 3) * 3
  return new Date(d.getFullYear(), q, 1)
}

function endOfQuarter(d: Date) {
  const q = Math.floor(d.getMonth() / 3) * 3
  return new Date(d.getFullYear(), q + 3, 0, 23, 59, 59, 999)
}

function formatMonthLabel(d: Date) {
  return `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`
}

function buildMonthSeries(from: Date, to: Date, opps: OppInput[]): MonthOpp[] {
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
      date: monthStart,
      oppEur: totalEur,
      targetK: Math.round((TARGET_QUARTER_EUR * (monthDays / quarterDays)) / 1000),
      monthIndex: monthStart.getMonth(),
    }
  })
}

function buildQuarterSeries(from: Date, to: Date, opps: OppInput[]): QuarterOpp[] {
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
      date: quarterStart,
      oppEur: totalEur,
      targetK: Math.round(TARGET_QUARTER_EUR / 1000),
      quarterIndex: q - 1,
    }
  })
}

export function buildProjectionOpps(options: {
  opportunities: Opportunity[]
  plan: Opportunity["plan"]
  filters: Parameters<typeof applyOpportunityFilters>[1]
  escalationTickets: Parameters<typeof applyOpportunityFilters>[2]
  rangeFrom: Date
  rangeTo: Date
}) {
  const { opportunities, plan, filters, escalationTickets, rangeFrom, rangeTo } = options
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
}

export function buildProjectionSeries(options: {
  chartMode: ProjectionChartMode
  viewMode: ProjectionViewMode
  opps: OppInput[]
  rangeFrom: Date
  rangeTo: Date
}): ProjectionPoint[] {
  const { chartMode, viewMode, opps, rangeFrom, rangeTo } = options

  if (chartMode === "snapshot") {
    const oppK = Math.round(
      opps.reduce((sum, o) => sum + (Number.isFinite(o.cashImpactEur) ? o.cashImpactEur : 0), 0) /
        1000
    )
    const monthIndex = rangeFrom.getMonth()
    const quarterIndex = Math.floor(monthIndex / 3)
    const erpBase =
      viewMode === "month"
        ? ERP_MONTH_TEMPLATE[monthIndex % ERP_MONTH_TEMPLATE.length]
        : ERP_QUARTER_TEMPLATE[quarterIndex % ERP_QUARTER_TEMPLATE.length]
    const target = Math.max(Math.round(oppK * 1.08), oppK + 15)
    const erp = Math.max(erpBase, target + Math.max(25, Math.round(target * 0.12)))
    return [
      {
        label: "Today",
        date: rangeFrom,
        opp: oppK,
        erp,
        target,
      },
    ]
  }

  if (viewMode === "month") {
    const rows = buildMonthSeries(rangeFrom, rangeTo, opps)
    return rows.map((row) => {
      const oppK = Math.round(row.oppEur / 1000)
      const erpBase = ERP_MONTH_TEMPLATE[row.monthIndex % ERP_MONTH_TEMPLATE.length]
      const target = Math.max(Math.round(oppK * 1.08), oppK + 15)
      const erp = Math.max(erpBase, target + Math.max(25, Math.round(target * 0.12)))
      return {
        label: row.label,
        date: row.date,
        opp: oppK,
        erp,
        target,
      }
    })
  }

  const rows = buildQuarterSeries(rangeFrom, rangeTo, opps)
  return rows.map((row) => {
    const oppK = Math.round(row.oppEur / 1000)
    const erpBase = ERP_QUARTER_TEMPLATE[row.quarterIndex % ERP_QUARTER_TEMPLATE.length]
    const target = Math.max(Math.round(oppK * 1.08), oppK + 15)
    const erp = Math.max(erpBase, target + Math.max(25, Math.round(target * 0.12)))
    return {
      label: row.label,
      date: row.date,
      opp: oppK,
      erp,
      target,
    }
  })
}

export function getSeriesValueAt(points: ProjectionPoint[], date: Date) {
  if (points.length === 0) return null
  const target = date.getTime()
  const sorted = [...points].sort((a, b) => a.date.getTime() - b.date.getTime())
  let candidate = sorted[0]
  for (const point of sorted) {
    if (point.date.getTime() <= target) candidate = point
    else break
  }
  return candidate
}
