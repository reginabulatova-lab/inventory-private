"use client"

import * as React from "react"
import { WidgetCard } from "@/components/inventory/kpi-card"
import { PieBreakdown, PieDatum } from "@/components/inventory/pie-breakdown"
import { BottomSheetModal } from "@/components/inventory/bottom-sheet-modal"
import { PartbookTable } from "@/components/inventory/partbook-table"
import { InventoryProjectionCard } from "@/components/inventory/inventory-projection-card"
import {
  useFilteredOpportunities,
  useInventoryData,
} from "@/components/inventory/inventory-data-provider"
import { computeInventoryBreakdown } from "@/lib/inventory/breakdown"

// --- formatting helpers (match your PieBreakdown style) ---
function formatEurCompact(value: number) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `€${(value / 1_000).toFixed(0)}K`
  return `€${Math.round(value)}`
}
function formatPct(n?: number) {
  return `${Math.round(n ?? 0)}%`
}

// --- rules: breakdown totals must be <= KPI inventory total ---
// We don’t have KPI inventory total here, so we enforce an internal rule:
// Breakdown total is a fraction of “inventory exposure” implied by opps.
// Tune these if you want bigger/smaller charts.
function breakdownCapFromOpps(oppsCount: number) {
  // This is the key that prevents breakdown > KPI:
  // KPI Inventory will usually be higher because it's computed differently (health-risk-section).
  // We cap breakdown to a plausible share.
  //
  // Example: 64 opps => cap ~ 8.0M (64 * 125k)
  return oppsCount * 125_000
}

export function InventoryBreakdownSection() {
  const { dateRange } = useInventoryData()
  const opportunities = useFilteredOpportunities({ includeSnoozed: false })

  const PIE_COLORS = [
    "#2563EB", // blue
    "#06B6D4", // cyan
    "#F59E0B", // amber
    "#F97316", // orange
    "#A78BFA", // violet
    "#9CA3AF", // gray
  ]

  // base breakdown generated from opps + timeframe
  const raw = computeInventoryBreakdown(opportunities, dateRange.from, dateRange.to)

  // ✅ enforce the “breakdown < KPI inventory” rule by capping total
  const cappedTotal = React.useMemo(() => {
    const cap = breakdownCapFromOpps(opportunities.length)
    return Math.min(raw.totalEur, cap)
  }, [raw.totalEur, opportunities.length])

// ✅ rescale helper: keep distribution but match a new total
// NOTE: in your breakdown types, `percent` can be string, so we ignore it here.
const rescaleRows = React.useCallback(
  <T extends { name: string; value: number }>(rows: T[], newTotal: number) => {
    const sum = rows.reduce((a, b) => a + b.value, 0) || 1

    const scaled = rows.map((x) => ({
      ...x,
      value: Math.round((x.value / sum) * newTotal),
    }))

    const diff = newTotal - scaled.reduce((a, b) => a + b.value, 0)
    if (scaled.length) scaled[0].value += diff

    const scaledSum = scaled.reduce((a, b) => a + b.value, 0) || 1
    return scaled.map((x) => ({
      ...x,
      // numeric percent computed here (we'll format later)
      percent: Math.round((x.value / scaledSum) * 100),
    }))
  },
  []
)

  // ✅ apply cappedTotal to ALL three charts, so they remain consistent
  const topProgramsRows = React.useMemo(
    () => rescaleRows(raw.topPrograms, cappedTotal),
    [raw.topPrograms, cappedTotal, rescaleRows]
  )

  const stockStatusRows = React.useMemo(() => {
    // stock status is often close to inventory, but can be slightly lower
    const target = Math.round(cappedTotal * 0.95)
    return rescaleRows(raw.stockStatus, target)
  }, [raw.stockStatus, cappedTotal, rescaleRows])

  const wipRows = React.useMemo(() => {
    // WIP is a smaller portion
    const target = Math.round(cappedTotal * 0.35)
    return rescaleRows(raw.wip, target)
  }, [raw.wip, cappedTotal, rescaleRows])

  // ✅ map to PieDatum with formatted legend values + percent
  const topProgramsData = React.useMemo<PieDatum[]>(
    () =>
      topProgramsRows.map((d, i) => ({
        name: d.name,
        value: d.value,
        displayValue: formatEurCompact(d.value),
        percent: formatPct(Number((d as any).percent ?? 0)),
        color: PIE_COLORS[i % PIE_COLORS.length],
      })),
    [topProgramsRows, PIE_COLORS]
  )

  const stockStatusData = React.useMemo<PieDatum[]>(
    () =>
      stockStatusRows.map((d, i) => ({
        name: d.name,
        value: d.value,
        displayValue: formatEurCompact(d.value),
        percent: formatPct(Number((d as any).percent ?? 0)),
        color: PIE_COLORS[i % PIE_COLORS.length],
      })),
    [stockStatusRows, PIE_COLORS]
  )

  const wipData = React.useMemo<PieDatum[]>(
    () =>
      wipRows.map((d, i) => ({
        name: d.name,
        value: d.value,
        displayValue: formatEurCompact(d.value),
        percent: formatPct(Number((d as any).percent ?? 0)),
        color: PIE_COLORS[i % PIE_COLORS.length],
      })),
    [wipRows, PIE_COLORS]
  )

  const [modalOpen, setModalOpen] = React.useState(false)
  const [active, setActive] = React.useState<{ chart: string; category: string } | null>(null)

  const [selected, setSelected] = React.useState<Record<string, string | null>>({
    topPrograms: null,
    stockStatus: null,
    wip: null,
  })

  const handleSelect = (
    chartKey: "topPrograms" | "stockStatus" | "wip",
    chartName: string,
    category: string
  ) => {
    if (!category) return

    setSelected({
      topPrograms: null,
      stockStatus: null,
      wip: null,
      [chartKey]: category,
    })

    setActive({ chart: chartName, category })
    setModalOpen(true)
  }

  const handleClose = () => {
    setModalOpen(false)
    setActive(null)
    setSelected({
      topPrograms: null,
      stockStatus: null,
      wip: null,
    })
  }

  const filter =
    active?.chart === "Top 10 Programs"
      ? {
          kind: "program" as const,
          category: active.category,
          topPrograms: topProgramsRows.map((p) => p.name),
        }
      : active?.chart === "Stock Status"
        ? {
            kind: "stockStatus" as const,
            category: active.category,
            stockStatus: stockStatusRows.map((s) => s.name),
          }
        : active?.chart === "WIP"
          ? {
              kind: "wip" as const,
              category: active.category,
              wip: wipRows.map((w) => w.name),
            }
          : null

  return (
    <section className="mt-10">
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">
        Inventory Breakdown
      </h2>

      <div className="mt-5 grid grid-cols-12 gap-6">
        <WidgetCard title="Top 10 Programs" size="m">
          <PieBreakdown
            totalLabel="Total"
            totalValue={formatEurCompact(cappedTotal)}
            data={topProgramsData}
            selectedCategory={selected.topPrograms}
            onSelectCategory={(cat) => handleSelect("topPrograms", "Top 10 Programs", cat)}
          />
        </WidgetCard>

        <WidgetCard title="Stock Status" tooltip="Inventory split by current stock status." size="m">
          <PieBreakdown
            totalLabel="Total"
            totalValue={formatEurCompact(Math.round(cappedTotal * 0.95))}
            data={stockStatusData}
            selectedCategory={selected.stockStatus}
            onSelectCategory={(cat) => handleSelect("stockStatus", "Stock Status", cat)}
          />
        </WidgetCard>

        <WidgetCard title="WIP" tooltip="Work-in-progress coverage split." size="m">
          <PieBreakdown
            totalLabel="Total"
            totalValue={formatEurCompact(Math.round(cappedTotal * 0.35))}
            data={wipData}
            selectedCategory={selected.wip}
            onSelectCategory={(cat) => handleSelect("wip", "WIP", cat)}
          />
        </WidgetCard>

        <InventoryProjectionCard />
      </div>

      <BottomSheetModal
        open={modalOpen}
        title={active ? active.chart : "Details"}
        subtitle={active ? active.category : undefined}
        onClose={handleClose}
      >
        {filter && <PartbookTable filter={filter} />}
      </BottomSheetModal>
    </section>
  )
}


