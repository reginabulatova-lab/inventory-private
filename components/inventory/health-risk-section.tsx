"use client"

import * as React from "react"
import { KpiCard } from "@/components/inventory/kpi-card"
import { InventoryProjectionCard } from "@/components/inventory/inventory-projection-card"
import { BottomSheetModal } from "@/components/inventory/bottom-sheet-modal"
import { PartbookTable } from "@/components/inventory/partbook-table"
import { useFilteredOpportunities, useInventoryData } from "@/components/inventory/inventory-data-provider"
import { computeHealthRiskKPIs, timeframeScale } from "@/lib/inventory/selectors"
import { computeInventoryBreakdown } from "@/lib/inventory/breakdown"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

function formatEurCompact(value: number) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `€${(value / 1_000).toFixed(0)}K`
  return `€${Math.round(value)}`
}

export function HealthRiskSection() {
  const [open, setOpen] = React.useState(false)
  const [activeKpi, setActiveKpi] = React.useState<string | null>(null)
  const { dateRange } = useInventoryData()

  // All opportunities for current plan + timeframe
  // Snoozed should NOT appear in Control Tower
  const opportunities = useFilteredOpportunities({ includeSnoozed: false })

  const breakdown = computeInventoryBreakdown(opportunities, dateRange.from, dateRange.to)
  const inventoryEur = breakdown.kpiTotalEur

  // Compute realistic KPI values from opportunities + timeframe
  const kpis = computeHealthRiskKPIs(
    opportunities,
    dateRange.from,
    dateRange.to
  )
  const TARGET_QUARTER_EUR = 2_400_000
  const TARGET_OVERSTOCK_EUR = 900_000
  const TARGET_UNDERSTOCK_EUR = 700_000
  const scale = timeframeScale(dateRange.from, dateRange.to, 90)
  const targetInventory = Math.round(TARGET_QUARTER_EUR * scale)
  const targetOverstock = Math.round(TARGET_OVERSTOCK_EUR * scale)
  const targetUnderstock = Math.round(TARGET_UNDERSTOCK_EUR * scale)

  const kpiValue = React.useCallback(
    (value: string, title: string) => (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="cursor-pointer transition-colors hover:text-teal-600"
              onClick={() => {
                setActiveKpi(title)
                setOpen(true)
              }}
            >
              {value}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>See details</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ),
    []
  )
  return (
    <section className="mt-8">
      <h2 className="text-2xl font-semibold tracking-tight">
        Health &amp; Risk
      </h2>

      <div className="mt-5 grid grid-cols-12 gap-6">
        <KpiCard
          title="Inventory"
          value={`${(kpis.inventoryEur / 1_000_000).toFixed(1)} M€`}
          valueNode={kpiValue(`${(kpis.inventoryEur / 1_000_000).toFixed(1)} M€`, "Inventory")}
        />

        <KpiCard
          title="Overstock"
          value={`${(kpis.overstockEur / 1_000_000).toFixed(1)} M€`}
          description={`${kpis.overstockParts} parts`}
          valueNode={kpiValue(`${(kpis.overstockEur / 1_000_000).toFixed(1)} M€`, "Overstock")}
        />

        <KpiCard
          title="Understock"
          value={`${(kpis.understockEur / 1_000_000).toFixed(1)} M€`}
          description={`${kpis.understockParts} parts`}
          valueNode={kpiValue(`${(kpis.understockEur / 1_000_000).toFixed(1)} M€`, "Understock")}
        />

      </div>

      <div className="mt-6">
        <InventoryProjectionCard />
      </div>

      <BottomSheetModal
        open={open}
        title={activeKpi ?? "Details"}
        onClose={() => setOpen(false)}
        seeAllHref="/inventory/analytics"
      >
        <PartbookTable filter={null} />
      </BottomSheetModal>
    </section>
  )
}

