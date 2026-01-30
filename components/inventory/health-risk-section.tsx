"use client"

import * as React from "react"
import { KpiCard } from "@/components/inventory/kpi-card"
import { InventoryProjectionCard } from "@/components/inventory/inventory-projection-card"
import { BottomSheetModal } from "@/components/inventory/bottom-sheet-modal"
import { PartbookTable } from "@/components/inventory/partbook-table"
import {
  applyOpportunityFilters,
  useInventoryData,
} from "@/components/inventory/inventory-data-provider"
import {
  buildPartMetrics,
  buildPartSources,
  computeHealthRiskKpisFromParts,
  type HealthRiskKpis,
} from "@/lib/inventory/health-risk-kpis"
import {
  buildProjectionOpps,
  buildProjectionSeries,
  getSeriesValueAt,
} from "@/components/inventory/projection-series"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

function formatEurCompact(value: number) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `€${(value / 1_000).toFixed(0)}K`
  return `€${Math.round(value)}`
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function HealthRiskSection() {
  const [open, setOpen] = React.useState(false)
  const [activeKpi, setActiveKpi] = React.useState<string | null>(null)
  const {
    opportunities,
    plan,
    filters,
    escalationTickets,
    timeframePreset,
    dateRange,
    now,
  } = useInventoryData()

  const chartMode = timeframePreset === "current" ? "snapshot" : "projection"
  const todayStart = React.useMemo(() => startOfDay(now), [now])
  const rangeFrom = React.useMemo(() => todayStart, [todayStart])
  const rangeTo = React.useMemo(() => {
    if (chartMode === "snapshot") return todayStart
    if (dateRange.to) return startOfDay(dateRange.to)
    if (dateRange.from) return startOfDay(dateRange.from)
    return todayStart
  }, [chartMode, dateRange.from, dateRange.to, todayStart])

  const baseOpps = React.useMemo(() => {
    const eligible = opportunities.filter((o) => {
      if (o.plan !== plan) return false
      if (o.status === "Snoozed" || o.status === "Canceled") return false
      return true
    })
    return applyOpportunityFilters(eligible, filters, escalationTickets)
  }, [
    opportunities,
    plan,
    filters.partKeys,
    filters.suggestedActions,
    filters.customers,
    filters.escLevels,
    filters.statuses,
    filters.plants,
    filters.buyerCodes,
    filters.mrpCodes,
    escalationTickets,
  ])

  const parts = React.useMemo(() => {
    const sources = buildPartSources(baseOpps, plan)
    return buildPartMetrics(sources)
  }, [baseOpps, plan])

  const projectionOpps = React.useMemo(
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

  const projectionSeries = React.useMemo(
    () =>
      buildProjectionSeries({
        chartMode,
        viewMode: "month",
        opps: projectionOpps,
        rangeFrom,
        rangeTo,
      }),
    [chartMode, projectionOpps, rangeFrom, rangeTo]
  )

  const erpPoint = React.useMemo(() => getSeriesValueAt(projectionSeries, rangeTo), [
    projectionSeries,
    rangeTo,
  ])
  const inventoryOverrideEur = erpPoint ? erpPoint.erp * 1000 : undefined

  const kpis = React.useMemo<HealthRiskKpis>(
    () =>
      computeHealthRiskKpisFromParts({
        parts,
        mode: chartMode,
        rangeFrom,
        rangeTo,
        todayStart,
        inventoryOverrideEur,
      }),
    [parts, chartMode, rangeFrom, rangeTo, todayStart, inventoryOverrideEur]
  )

  React.useEffect(() => {
    if (process.env.NODE_ENV === "production") return
    if (!erpPoint) return
    if (erpPoint.erp * 1000 > 1_000_000 && kpis.inventoryEur < 100_000) {
      console.warn("Inventory KPI seems too low vs chart ERP plan.", {
        inventoryKpi: kpis.inventoryEur,
        erpPlanEur: erpPoint.erp * 1000,
        partsCount: parts.length,
        avgUnitValue:
          parts.length > 0
            ? Math.round(parts.reduce((sum, p) => sum + p.unitValueEur, 0) / parts.length)
            : 0,
      })
    }
  }, [erpPoint, kpis.inventoryEur, parts])

  const hideUnderstock = chartMode === "snapshot"

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
          value={formatEurCompact(kpis.inventoryEur)}
          valueNode={kpiValue(formatEurCompact(kpis.inventoryEur), "Inventory")}
        />

        <KpiCard
          title="Overstock"
          value={formatEurCompact(kpis.overstockEur)}
          description={`${kpis.overstockPartsCount} parts`}
          valueNode={kpiValue(formatEurCompact(kpis.overstockEur), "Overstock")}
        />

        <KpiCard
          title="Understock"
          value={hideUnderstock ? "—" : formatEurCompact(kpis.understockEur)}
          description={hideUnderstock ? "0 parts" : `${kpis.understockPartsCount} parts`}
          valueNode={kpiValue(
            hideUnderstock ? "—" : formatEurCompact(kpis.understockEur),
            "Understock"
          )}
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
        <PartbookTable
          filter={null}
          overrideParts={
            activeKpi === "Overstock"
              ? kpis.overstockParts
              : activeKpi === "Understock"
                ? kpis.understockParts
                : undefined
          }
          valueLabel={
            activeKpi === "Overstock"
              ? "Overstock value"
              : activeKpi === "Understock"
                ? "Understock value"
                : undefined
          }
        />
      </BottomSheetModal>
    </section>
  )
}

