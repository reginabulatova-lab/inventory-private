"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { PieBreakdown, PieDatum } from "@/components/inventory/pie-breakdown"
import { WidgetCard } from "@/components/inventory/kpi-card"
import {
  OpportunitiesTable,
  type OpportunitiesTableFilter,
} from "@/components/opportunities/opportunities-table"
import {
  useFilteredOpportunities,
  useInventoryData,
} from "@/components/inventory/inventory-data-provider"
import {
  computeHealthRiskKPIs,
  filterOpportunitiesByMode,
  getOpportunityMode,
} from "@/lib/inventory/selectors"
import type { Opportunity } from "@/lib/inventory/types"

const FILTER_KINDS = ["type", "status", "concentration"] as const
type FilterKind = (typeof FILTER_KINDS)[number]

export function OpportunitiesPageContent() {
  const { dateRange } = useInventoryData()
  const baseOpportunities = useFilteredOpportunities({ includeSnoozed: false })
  const allOpportunities = useFilteredOpportunities({ includeSnoozed: true })
  const searchParams = useSearchParams()
  const filterKind = searchParams.get("oppFilterKind")
  const filterCategory = searchParams.get("oppFilter")
  const [statusFilter, setStatusFilter] = React.useState<Opportunity["status"] | null>(null)
  const [teamFilter, setTeamFilter] = React.useState<string | null>(null)

  const filter = React.useMemo<OpportunitiesTableFilter | undefined>(() => {
    if (!filterKind || !filterCategory) return undefined
    if (!FILTER_KINDS.includes(filterKind as FilterKind)) return undefined
    return { kind: filterKind as FilterKind, category: filterCategory }
  }, [filterKind, filterCategory])

  const kpis = computeHealthRiskKPIs(baseOpportunities, dateRange.from, dateRange.to)
  const mode = getOpportunityMode(kpis.overstockEur, kpis.understockEur)
  const scopedBase = React.useMemo(
    () => filterOpportunitiesByMode(baseOpportunities, mode),
    [baseOpportunities, mode]
  )
  const scopedAll = React.useMemo(
    () => filterOpportunitiesByMode(allOpportunities, mode),
    [allOpportunities, mode]
  )
  const rows = React.useMemo(
    () =>
      scopedAll.map((row) => ({
        ...row,
        inventoryValueEur: row.cashImpactEur,
      })),
    [scopedAll]
  )

  const statusData = React.useMemo<PieDatum[]>(() => {
    const totals = rows.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + r.inventoryValueEur
      return acc
    }, {} as Record<string, number>)
    const statuses: Opportunity["status"][] = [
      "Backlog",
      "To Do",
      "In Progress",
      "Done",
      "Canceled",
      "Snoozed",
    ]
    const colors = ["#2563EB", "#06B6D4", "#F59E0B", "#22C55E", "#EF4444", "#9CA3AF"]
    return statuses.map((status, idx) => ({
      name: status,
      value: totals[status] ?? 0,
      displayValue: formatEurCompact(totals[status] ?? 0),
      color: colors[idx % colors.length],
    }))
  }, [rows])

  const teamData = React.useMemo<PieDatum[]>(() => {
    const totals = rows.reduce((acc, r) => {
      const team = r.team || "Unassigned"
      acc[team] = (acc[team] ?? 0) + r.inventoryValueEur
      return acc
    }, {} as Record<string, number>)
    const teams = Object.keys(totals).sort()
    const colors = ["#2563EB", "#06B6D4", "#F59E0B", "#22C55E", "#A855F7"]
    return teams.map((team, idx) => ({
      name: team,
      value: totals[team] ?? 0,
      displayValue: formatEurCompact(totals[team] ?? 0),
      color: colors[idx % colors.length],
    }))
  }, [rows])

  const statusTotal = formatEurCompact(statusData.reduce((sum, r) => sum + r.value, 0))
  const teamTotal = formatEurCompact(teamData.reduce((sum, r) => sum + r.value, 0))
  const statusSelected = statusFilter ?? (teamFilter ? "__external__" : null)
  const teamSelected = teamFilter ?? (statusFilter ? "__external__" : null)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-12 gap-6">
        <WidgetCard title="Status distribution" size="m" className="col-span-12 lg:col-span-6">
          <PieBreakdown
            totalLabel="Total"
            totalValue={statusTotal}
            data={statusData}
            selectedCategory={statusSelected}
            onSelectCategory={(category) => {
              setStatusFilter((prev) =>
                prev === category ? null : (category as Opportunity["status"])
              )
              setTeamFilter(null)
            }}
          />
        </WidgetCard>
        <WidgetCard title="Team distribution" size="m" className="col-span-12 lg:col-span-6">
          <PieBreakdown
            totalLabel="Total"
            totalValue={teamTotal}
            data={teamData}
            selectedCategory={teamSelected}
            onSelectCategory={(category) => {
              setTeamFilter((prev) => (prev === category ? null : category))
              setStatusFilter(null)
            }}
          />
        </WidgetCard>
      </div>

      <OpportunitiesTable
        filter={filter}
        showToolbar
        showSummary={false}
        statusFilter={statusFilter}
        teamFilter={teamFilter === "Unassigned" ? "" : teamFilter}
        useRawInventoryValue
      />
    </div>
  )
}

function formatEurCompact(value: number) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `€${(value / 1_000).toFixed(0)}K`
  return `€${Math.round(value)}`
}
