import type { Opportunity } from "@/lib/inventory/types"
import { timeframeScale } from "@/lib/inventory/selectors"

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function clampMin(n: number, min: number) {
  return n < min ? min : n
}

function formatEurCompact(value: number) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `€${(value / 1_000).toFixed(0)}K`
  return `€${Math.round(value)}`
}

function pct(value: number, total: number) {
  if (!total) return "0%"
  return `${Math.round((value / total) * 100)}%`
}

type ProgramRow = { name: string; value: number; displayValue: string; percent: string; color: string }
type StockRow = { name: string; value: number; displayValue: string; percent: string; color: string }
type WipRow = { name: string; value: number; displayValue: string; percent: string; color: string }

const PROGRAMS = ["Airbus A350", "Boeing 787", "Boeing 737", "ATR 72", "Rafale Marine", "Other"]
const STOCK = ["Quality Inspection", "At Vendor", "Excluded", "Blocked"]
const WIP = ["Blocked", "Conditionally covered", "Covered"]

const PROGRAM_COLORS = ["#2563EB", "#06B6D4", "#F59E0B", "#F97316", "#8B5CF6", "#9CA3AF"]
const STOCK_COLORS = ["#2563EB", "#06B6D4", "#F59E0B", "#F97316"]
const WIP_COLORS = ["#EF4444", "#F59E0B", "#22C55E"]

export function computeInventoryBreakdown(
  opps: Opportunity[],
  from?: Date,
  to?: Date
): {
  kpiTotalEur: number
  totalEur: number
  topPrograms: ProgramRow[]
  stockStatus: StockRow[]
  wip: WipRow[]
} {
  const scale = timeframeScale(from, to, 90)

  // KPI total (overall inventory) - big enough for demo
  const perOpp = 180_000
  const rawKpiTotal = Math.round(opps.length * perOpp * scale)
  const kpiTotalEur = opps.length > 0 ? clampMin(rawKpiTotal, 900_000) : 0

  // Breakdown total is ALWAYS smaller than KPI
  const seed0 = opps.reduce((acc, o) => acc + o.id.length + o.orderNumber.length, 0) + kpiTotalEur
  const r0 = mulberry32(seed0)
  const breakdownShare = 0.45 + r0() * 0.20 // 45%..65%
  const rawBreakdownTotal = Math.round(kpiTotalEur * breakdownShare)

  // Avoid showing 0 when timeframe is tiny but opps exists
  const safeTotal = opps.length > 0 ? clampMin(rawBreakdownTotal, 250_000) : 0

  // Seed random based on content (stable)
  const seed = opps.reduce((acc, o) => acc + o.id.length + o.orderNumber.length, 0) + safeTotal
  const r = mulberry32(seed)

  // Split total into buckets deterministically
  function split(total: number, labels: string[]) {
    const weights = labels.map(() => 0.6 + r() * 1.8)
    const sum = weights.reduce((a, b) => a + b, 0) || 1
    return labels.map((name, i) => {
      const value = Math.round((weights[i] / sum) * total)
      return { name, value }
    })
  }

  // Re-scale rows to match a newTotal while preserving shape
  function rescale<T extends { name: string; value: number }>(rows: T[], newTotal: number) {
    const sum = rows.reduce((a, b) => a + b.value, 0) || 1
    const scaled = rows.map((x) => ({ ...x, value: Math.round((x.value / sum) * newTotal) }))
    const diff = newTotal - scaled.reduce((a, b) => a + b.value, 0)
    if (scaled.length) scaled[0].value += diff
    return scaled
  }

  // Add display value, percent, and color (what PieBreakdown expects)
  function withDisplay<T extends { name: string; value: number }>(rows: T[], colors: string[]) {
    const sum = rows.reduce((a, b) => a + b.value, 0) || 1
    return rows.map((x, i) => ({
      name: x.name,
      value: x.value,
      color: colors[i % colors.length],
      displayValue: formatEurCompact(x.value),
      percent: pct(x.value, sum),
    }))
  }

  // Programs: keep 6 as your UI shows
  let topPrograms = split(safeTotal, PROGRAMS)

  // Ensure "Other" is not dominant; nudge if needed (keeps UI stable)
  const otherIdx = topPrograms.findIndex((x) => x.name === "Other")
  if (otherIdx >= 0) {
    topPrograms[otherIdx].value = Math.round(topPrograms[otherIdx].value * 0.55)
    const restTotal = topPrograms.reduce((a, b) => a + b.value, 0)
    const missing = safeTotal - restTotal
    if (topPrograms.length) topPrograms[0].value += missing
  }

  // These are subsets of the breakdown total (ALWAYS <= safeTotal)
  const stockTotal = Math.round(safeTotal * (0.70 + r() * 0.15)) // 70%..85%
  const wipTotal = Math.round(safeTotal * (0.30 + r() * 0.15)) // 30%..45%

  // Split each subset, then keep shapes stable (optional but helpful)
  const stockStatus = rescale(split(stockTotal, STOCK), stockTotal)
  const wip = rescale(split(wipTotal, WIP), wipTotal)

  return {
    kpiTotalEur,
    totalEur: safeTotal,
    topPrograms: withDisplay(topPrograms, PROGRAM_COLORS),
    stockStatus: withDisplay(stockStatus, STOCK_COLORS),
    wip: withDisplay(wip, WIP_COLORS),
  }
}

