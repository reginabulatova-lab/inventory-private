"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const FILTER_KINDS = ["type", "status", "concentration"] as const
type FilterKind = (typeof FILTER_KINDS)[number]

export type OpportunityTypeView = "standard" | "sto" | "scrap-sell"

const OPPORTUNITY_TYPE_TABS: { value: OpportunityTypeView; label: string }[] = [
  { value: "standard", label: "Pull in, Push out & Cancel" },
  { value: "sto", label: "STO" },
  { value: "scrap-sell", label: "Scrap/Sell" },
]

export function OpportunitiesPageContent() {
  const { dateRange } = useInventoryData()
  const baseOpportunities = useFilteredOpportunities({ includeSnoozed: false })
  const allOpportunities = useFilteredOpportunities({ includeSnoozed: true })
  const searchParams = useSearchParams()
  const filterKind = searchParams.get("oppFilterKind")
  const filterCategory = searchParams.get("oppFilter")
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

  return (
    <div className="space-y-6">
      <Tabs defaultValue="standard" className="w-full">
        <TabsList className="mb-4">
          {OPPORTUNITY_TYPE_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {OPPORTUNITY_TYPE_TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-0">
            <OpportunitiesTable
              filter={filter}
              showToolbar
              showSummary={false}
              useRawInventoryValue
              opportunityTypeView={tab.value}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

function formatEurCompact(value: number) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `€${(value / 1_000).toFixed(0)}K`
  return `€${Math.round(value)}`
}
