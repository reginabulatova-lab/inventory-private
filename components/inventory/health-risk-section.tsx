"use client"

import { KpiCard } from "@/components/inventory/kpi-card"
import { TrendingUp, TrendingDown } from "lucide-react"
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

function TargetBadge({ diff }: { diff: number }) {
  const isAbove = diff >= 0
  const label = `${formatEurCompact(Math.abs(diff))}`
  const tone = isAbove ? "bg-[#FEF3F2] text-[#B42318]" : "bg-[#ECFDF3] text-[#027A48]"
  const Icon = isAbove ? TrendingUp : TrendingDown

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>
            <Icon className="h-3.5 w-3.5" />
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>Comparing to the target.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

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
  const TARGET_QUARTER_EUR = 2_400_000
  const TARGET_OVERSTOCK_EUR = 900_000
  const TARGET_UNDERSTOCK_EUR = 700_000
  const scale = timeframeScale(dateRange.from, dateRange.to, 90)
  const targetInventory = Math.round(TARGET_QUARTER_EUR * scale)
  const targetOverstock = Math.round(TARGET_OVERSTOCK_EUR * scale)
  const targetUnderstock = Math.round(TARGET_UNDERSTOCK_EUR * scale)
  const diffInventory = kpis.inventoryEur - targetInventory
  const diffOverstock = kpis.overstockEur - targetOverstock
  const diffUnderstock = kpis.understockEur - targetUnderstock
  return (
    <section className="mt-8">
      <h2 className="text-2xl font-semibold tracking-tight">
        Health &amp; Risk
      </h2>

      <div className="mt-5 grid grid-cols-12 gap-6">
        <KpiCard
          title="Inventory"
          value={`${(kpis.inventoryEur / 1_000_000).toFixed(1)} M€`}
          badge={<TargetBadge diff={diffInventory} />}
        />

        <KpiCard
          title="Overstock"
          value={`${(kpis.overstockEur / 1_000_000).toFixed(1)} M€`}
          description={`${kpis.overstockParts} parts`}
          badge={<TargetBadge diff={diffOverstock} />}
        />

        <KpiCard
          title="Understock"
          value={`${(kpis.understockEur / 1_000_000).toFixed(1)} M€`}
          description={`${kpis.understockParts} parts`}
          badge={<TargetBadge diff={diffUnderstock} />}
        />

      </div>
    </section>
  )
}

