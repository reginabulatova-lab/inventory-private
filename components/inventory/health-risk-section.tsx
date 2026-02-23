"use client"

import * as React from "react"
import { WidgetCard } from "@/components/inventory/kpi-card"
import { InventoryProjectionCard } from "@/components/inventory/inventory-projection-card"
import { BottomSheetModal } from "@/components/inventory/bottom-sheet-modal"
import { PartbookTable } from "@/components/inventory/partbook-table"
import {
  applyOpportunityFilters,
  useFilteredOpportunities,
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronRight, Lightbulb } from "lucide-react"
import { cn } from "@/lib/utils"
import { OptimizationOpportunitiesSection } from "@/components/inventory/optimization-opportunities-section"
import { computeInventoryBreakdown } from "@/lib/inventory/breakdown"
import { computeHealthRiskKPIs } from "@/lib/inventory/selectors"
import { InventoryByStatusChart } from "@/components/inventory/inventory-by-status-chart"

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

function formatPct(n?: number) {
  return `${Math.round(n ?? 0)}%`
}

export function HealthRiskSection() {
  const [open, setOpen] = React.useState(false)
  const [activeKpi, setActiveKpi] = React.useState<string | null>(null)
  const [breakdownModalOpen, setBreakdownModalOpen] = React.useState(false)
  const [breakdownActive, setBreakdownActive] = React.useState<{
    chart: string
    category: string
  } | null>(null)
  const [breakdownSelected, setBreakdownSelected] = React.useState<Record<string, string | null>>({
    topPrograms: null,
    wip: null,
  })
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

  // Inventory Health widget always shows current (snapshot) values, independent of Current/Projected selection
  const inventoryHealthWidgetKpis = React.useMemo<HealthRiskKpis>(
    () =>
      computeHealthRiskKpisFromParts({
        parts,
        mode: "snapshot",
        rangeFrom: todayStart,
        rangeTo: todayStart,
        todayStart,
        inventoryOverrideEur: undefined,
      }),
    [parts, todayStart]
  )

  const breakdownOpportunities = useFilteredOpportunities({ includeSnoozed: false })
  const breakdownKpis = computeHealthRiskKPIs(
    breakdownOpportunities,
    dateRange.from,
    dateRange.to
  )
  const breakdownKpisWidget = computeHealthRiskKPIs(
    breakdownOpportunities,
    todayStart,
    todayStart
  )
  const breakdownInventoryTotal = Math.max(0, breakdownKpis.inventoryEur)
  const rawBreakdown = React.useMemo(
    () =>
      computeInventoryBreakdown(
        breakdownOpportunities,
        dateRange.from,
        dateRange.to
      ),
    [breakdownOpportunities, dateRange.from, dateRange.to]
  )
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
        percent: Math.round((x.value / scaledSum) * 100),
      }))
    },
    []
  )
  const breakdownTopTotal = breakdownInventoryTotal
  const breakdownWipTotal = Math.round(breakdownInventoryTotal * 0.35)
  const breakdownTopRows = React.useMemo(
    () => rescaleRows(rawBreakdown.topPrograms, breakdownTopTotal),
    [rawBreakdown.topPrograms, breakdownTopTotal, rescaleRows]
  )
  const breakdownWipRows = React.useMemo(
    () => rescaleRows(rawBreakdown.wip, breakdownWipTotal),
    [rawBreakdown.wip, breakdownWipTotal, rescaleRows]
  )
  const wipAtRisk = React.useMemo(() => {
    const atRisk = breakdownWipRows.filter(
      (r) => r.name === "Blocked" || r.name === "Conditionally covered"
    )
    const value = atRisk.reduce((sum, r) => sum + r.value, 0)
    const partCount = Math.max(1, Math.round(value / 8000))
    return { value, partCount }
  }, [breakdownWipRows])
  const wipAtRiskPct =
    breakdownWipTotal > 0 ? Math.round((wipAtRisk.value / breakdownWipTotal) * 100) : 0
  const showRecapWipWarning = wipAtRiskPct >= 40
  const handleBreakdownSelect = React.useCallback(
    (chartKey: "topPrograms" | "wip", chartName: string, category: string) => {
      if (!category) return
      setBreakdownSelected({
        topPrograms: null,
        wip: null,
        [chartKey]: category,
      })
      setBreakdownActive({ chart: chartName, category })
      setBreakdownModalOpen(true)
    },
    []
  )
  const handleBreakdownClose = React.useCallback(() => {
    setBreakdownModalOpen(false)
    setBreakdownActive(null)
    setBreakdownSelected({
      topPrograms: null,
      wip: null,
    })
  }, [])
  const breakdownFilter =
    breakdownActive?.chart === "WIP Status" && breakdownActive.category !== "All"
      ? { kind: "wip" as const, category: breakdownActive.category }
      : null
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

  const kpiBadgeClass = React.useCallback((tone: "up" | "down" | "flat") => {
    // For Health & Risk a decrease is good (green) and an increase is bad (red). No container.
    if (tone === "down") return "border-0 bg-transparent text-emerald-700"
    if (tone === "up") return "border-0 bg-transparent text-rose-700"
    return "border-0 bg-transparent text-muted-foreground"
  }, [])

  const formatDelta = React.useCallback(
    (
      current: number | null,
      previous: number | null,
      fallback: { percent: number; direction: "up" | "down" }
    ): { label: string; tone: "up" | "down" | "flat" } => {
      if (current == null || previous == null || previous === 0) {
        const arrow = fallback.direction === "up" ? "↑" : "↓"
        return { label: `${arrow} ${fallback.percent}%`, tone: fallback.direction }
      }
      const raw = ((current - previous) / previous) * 100
      const pct = Math.max(2, Math.min(15, Math.round(Math.abs(raw))))
      const tone = raw >= 0 ? ("up" as const) : ("down" as const)
      const arrow = raw >= 0 ? "↑" : "↓"
      return { label: `${arrow} ${pct}%`, tone }
    },
    []
  )

  const targetFallback = React.useMemo(() => {
    const map: Record<
      string,
      {
        inventory: { percent: number; direction: "up" | "down" }
        overstock: { percent: number; direction: "up" | "down" }
        understock: { percent: number; direction: "up" | "down" }
        uselessStock: { percent: number; direction: "up" | "down" }
      }
    > = {
      today: {
        inventory: { percent: 6, direction: "down" },
        overstock: { percent: 8, direction: "down" },
        understock: { percent: 5, direction: "down" },
        uselessStock: { percent: 7, direction: "down" },
      },
      tomorrow: {
        inventory: { percent: 5, direction: "down" },
        overstock: { percent: 7, direction: "down" },
        understock: { percent: 4, direction: "down" },
        uselessStock: { percent: 6, direction: "down" },
      },
      current: {
        inventory: { percent: 9, direction: "down" },
        overstock: { percent: 10, direction: "down" },
        understock: { percent: 6, direction: "down" },
        uselessStock: { percent: 8, direction: "down" },
      },
      eom: {
        inventory: { percent: 7, direction: "down" },
        overstock: { percent: 9, direction: "down" },
        understock: { percent: 6, direction: "down" },
        uselessStock: { percent: 7, direction: "down" },
      },
      eoq: {
        inventory: { percent: 10, direction: "down" },
        overstock: { percent: 12, direction: "down" },
        understock: { percent: 8, direction: "down" },
        uselessStock: { percent: 9, direction: "down" },
      },
      eoy: {
        inventory: { percent: 12, direction: "down" },
        overstock: { percent: 14, direction: "down" },
        understock: { percent: 9, direction: "down" },
        uselessStock: { percent: 11, direction: "down" },
      },
      custom: {
        inventory: { percent: 6, direction: "down" },
        overstock: { percent: 8, direction: "down" },
        understock: { percent: 5, direction: "down" },
        uselessStock: { percent: 7, direction: "down" },
      },
    }
    return map[timeframePreset] ?? map.current
  }, [timeframePreset])

  // Widget always uses "current" target fallback (Inventory Health is not responsive to segment)
  const targetFallbackWidget = React.useMemo(
    () =>
      ({
        inventory: { percent: 9, direction: "down" as const },
        overstock: { percent: 10, direction: "down" as const },
        understock: { percent: 6, direction: "down" as const },
        uselessStock: { percent: 8, direction: "down" as const },
      }),
    []
  )

  const inventoryTarget =
    kpis.inventoryEur * (1 + targetFallback.inventory.percent / 100)
  const overstockTarget =
    kpis.overstockEur * (1 + targetFallback.overstock.percent / 100)
  const understockTarget =
    kpis.understockEur * (1 + targetFallback.understock.percent / 100)
  const uselessStockEur = breakdownKpis.uselessStockEur
  const uselessStockTarget =
    uselessStockEur * (1 + targetFallback.uselessStock.percent / 100)

  const inventoryDeltaComputed = formatDelta(
    kpis.inventoryEur,
    inventoryTarget,
    targetFallback.inventory
  )
  const overstockDeltaComputed = formatDelta(
    kpis.overstockEur,
    overstockTarget,
    targetFallback.overstock
  )
  const understockDelta = formatDelta(
    kpis.understockEur,
    understockTarget,
    targetFallback.understock
  )
  const uselessStockDelta = formatDelta(
    uselessStockEur,
    uselessStockTarget,
    targetFallback.uselessStock
  )

  // Demo overrides: show smaller differences and mark overstock as increasing.
  // Keep underlying computed values available if needed.
  const inventoryDelta = { ...inventoryDeltaComputed, label: "↓ 3%", tone: "down" as const }
  const overstockDelta = { ...overstockDeltaComputed, label: "↑ 3%", tone: "up" as const }

  // Inventory Health widget: use opportunity-based KPIs (demo 10% / 6% / 5% of inventory)
  const widgetInventoryEur = breakdownKpisWidget.inventoryEur
  const widgetOverstockEur = breakdownKpisWidget.overstockEur
  const widgetUnderstockEur = breakdownKpisWidget.understockEur
  const widgetUselessStockEur = breakdownKpisWidget.uselessStockEur
  const widgetInventoryTarget =
    widgetInventoryEur * (1 + targetFallbackWidget.inventory.percent / 100)
  const widgetOverstockTarget =
    widgetOverstockEur * (1 + targetFallbackWidget.overstock.percent / 100)
  const widgetUnderstockTarget =
    widgetUnderstockEur * (1 + targetFallbackWidget.understock.percent / 100)
  const widgetUselessStockTarget =
    widgetUselessStockEur * (1 + targetFallbackWidget.uselessStock.percent / 100)

  const widgetInventoryDelta = formatDelta(
    widgetInventoryEur,
    widgetInventoryTarget,
    targetFallbackWidget.inventory
  )
  const widgetOverstockDelta = formatDelta(
    widgetOverstockEur,
    widgetOverstockTarget,
    targetFallbackWidget.overstock
  )
  const widgetUnderstockDelta = formatDelta(
    widgetUnderstockEur,
    widgetUnderstockTarget,
    targetFallbackWidget.understock
  )
  const widgetUselessStockDelta = formatDelta(
    widgetUselessStockEur,
    widgetUselessStockTarget,
    targetFallbackWidget.uselessStock
  )
  const hideUnderstockWidget = false

  const openDetails = React.useCallback((title: string) => {
    setActiveKpi(title)
    setOpen(true)
  }, [])

  const kpiRows = [
    {
      title: "Inventory",
      value: formatEurCompact(kpis.inventoryEur),
      key: "Inventory" as const,
      badge: inventoryDelta,
    },
    {
      title: "Overstock",
      value: formatEurCompact(kpis.overstockEur),
      key: "Overstock" as const,
      badge: overstockDelta,
    },
    {
      title: "Understock",
      value: hideUnderstock ? "—" : formatEurCompact(kpis.understockEur),
      key: "Understock" as const,
      badge: understockDelta,
    },
    {
      title: "Dead stock",
      value: formatEurCompact(uselessStockEur),
      key: "Dead stock" as const,
      badge: uselessStockDelta,
    },
  ]

  const widgetKpiRows = [
    {
      title: "Inventory",
      value: formatEurCompact(widgetInventoryEur),
      key: "Inventory" as const,
      badge: widgetInventoryDelta,
    },
    {
      title: "Overstock",
      value: formatEurCompact(widgetOverstockEur),
      key: "Overstock" as const,
      badge: widgetOverstockDelta,
    },
    {
      title: "Understock",
      value: hideUnderstockWidget ? "—" : formatEurCompact(widgetUnderstockEur),
      key: "Understock" as const,
      badge: widgetUnderstockDelta,
    },
    {
      title: "Dead stock",
      value: formatEurCompact(widgetUselessStockEur),
      key: "Dead stock" as const,
      badge: widgetUselessStockDelta,
    },
  ]

  const tones = [inventoryDelta.tone, overstockDelta.tone, understockDelta.tone, uselessStockDelta.tone]
  const widgetTones = [widgetInventoryDelta.tone, widgetOverstockDelta.tone, widgetUnderstockDelta.tone, widgetUselessStockDelta.tone]
  const upCount = tones.filter((t) => t === "up").length
  const downCount = tones.filter((t) => t === "down").length
  const recapStatus: "good" | "bad" | "mixed" =
    upCount === 0 ? "good" : downCount === 0 ? "bad" : "mixed"
  const widgetUpCount = widgetTones.filter((t) => t === "up").length
  const widgetDownCount = widgetTones.filter((t) => t === "down").length
  const recapStatusWidget: "good" | "bad" | "mixed" =
    widgetUpCount === 0 ? "good" : widgetDownCount === 0 ? "bad" : "mixed"

  const recapSummary = React.useMemo(() => {
    const base =
      "Inventory & understock improving — prioritize overstock to accelerate working capital gains"
    if (showRecapWipWarning) return `${base} High WIP at risk (${wipAtRiskPct}%).`
    return base
  }, [showRecapWipWarning, wipAtRiskPct])

  const recapBoxStyles =
    "border border-cyan-200/60 bg-cyan-50/70 dark:border-cyan-800/50 dark:bg-cyan-950/25"
  const recapTitleStyles = {
    good: "text-foreground",
    bad: "text-foreground",
    mixed: "text-foreground",
  }
  const recapTextStyles = {
    good: "text-muted-foreground",
    bad: "text-muted-foreground",
    mixed: "text-muted-foreground",
  }

  return (
    <section className="mt-4">
      <h2 className="text-2xl font-semibold tracking-tight text-foreground mb-4">
        Current inventory
      </h2>
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-3">
          <WidgetCard
            title="Inventory health"
            tooltip="Inventory, overstock, understock and dead stock values."
            size="s"
            className="h-full"
          >
            <div className="flex flex-col gap-4">
              <div
                className={cn("rounded-lg px-4 py-3", recapBoxStyles)}
                aria-label="Overstock health recap"
              >
                <p
                  className={cn(
                    "flex items-center gap-2 text-xs font-medium",
                    recapTitleStyles[recapStatusWidget]
                  )}
                >
                  <Lightbulb className="h-3.5 w-3.5 shrink-0 text-cyan-600 dark:text-cyan-400" />
                  Overstock health recap
                </p>
                <p
                  className={cn("mt-1 text-xs", recapTextStyles[recapStatusWidget])}
                >
                  {recapSummary}
                </p>
              </div>

              {widgetKpiRows.map((row) => (
                <div key={row.key} className="flex flex-col gap-1">
                  <span className="text-sm text-muted-foreground">{row.title}</span>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-medium tracking-tight">{row.value}</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              className={cn("shadow-none px-0", kpiBadgeClass(row.badge.tone))}
                              variant="outline"
                            >
                              {row.badge.label}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>Compared to target for selected timeframe</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                            onClick={() => openDetails(row.key)}
                            disabled={row.key === "Understock" && hideUnderstockWidget}
                            aria-label="See details"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p>Open table with details</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              ))}
            </div>
          </WidgetCard>
        </div>

        <div className="col-span-9 flex">
          <InventoryByStatusChart />
        </div>
      </div>

      <h2 className="text-2xl font-semibold tracking-tight text-foreground mt-10 mb-4">
        Projected inventory
      </h2>
      <div className="grid grid-cols-12 gap-6 items-stretch">
        <div className="col-span-12 flex">
          <InventoryProjectionCard />
        </div>
      </div>

      <h2 className="text-2xl font-semibold tracking-tight text-foreground mt-10 mb-4">
        Opportunities
      </h2>
      <OptimizationOpportunitiesSection embedded />

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
              ? inventoryHealthWidgetKpis.overstockParts
              : activeKpi === "Understock"
                ? inventoryHealthWidgetKpis.understockParts
                : undefined
          }
          valueLabel={
            activeKpi === "Overstock"
              ? "Overstock value"
              : activeKpi === "Understock"
                ? "Understock value"
                : activeKpi === "Dead stock"
                  ? "Dead stock value"
                  : undefined
          }
        />
      </BottomSheetModal>

      <BottomSheetModal
        open={breakdownModalOpen}
        title={breakdownActive?.chart ?? "Details"}
        subtitle={breakdownActive?.category}
        onClose={handleBreakdownClose}
        seeAllHref="/inventory/analytics"
      >
        {(breakdownFilter != null || breakdownActive?.chart === "WIP Status") && (
          <PartbookTable filter={breakdownFilter ?? null} />
        )}
      </BottomSheetModal>
    </section>
  )
}

