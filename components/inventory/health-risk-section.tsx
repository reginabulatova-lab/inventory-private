"use client"

import { KpiCard } from "@/components/inventory/kpi-card"
import { Box, TrendingUp, TrendingDown } from "lucide-react"
import { useFilteredOpportunities, useInventoryData } from "@/components/inventory/inventory-data-provider"
import { computeHealthRiskKPIs } from "@/lib/inventory/selectors"
import { computeInventoryBreakdown } from "@/lib/inventory/breakdown"


export function HealthRiskSection() {
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
  return (
    <section className="mt-8">
      <h2 className="text-2xl font-semibold tracking-tight">
        Health &amp; Risk
      </h2>

      <div className="mt-5 grid grid-cols-12 gap-6">
        <KpiCard
          title="Inventory"
          value={`${(kpis.inventoryEur / 1_000_000).toFixed(1)} M€`}
        />

        <KpiCard
          title="Overstock"
          value={`${(kpis.overstockEur / 1_000_000).toFixed(1)} M€`}
          description={`${kpis.overstockParts} parts`}
        />

        <KpiCard
          title="Understock"
          value={`${(kpis.understockEur / 1_000_000).toFixed(1)} M€`}
          description={`${kpis.understockParts} parts`}
        />

      </div>
    </section>
  )
}

