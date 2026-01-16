"use client"

import * as React from "react"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useFilteredOpportunities, useInventoryData } from "@/components/inventory/inventory-data-provider"
import {
  buildConcentrationBuckets,
  capOpportunitiesTotal,
  computeHealthRiskKPIs,
  filterOpportunitiesByMode,
  getOpportunitiesScale,
  getOpportunityMode,
} from "@/lib/inventory/selectors"

type Filter =
  | { kind: "type"; category: string }
  | { kind: "status"; category: string }
  | { kind: "concentration"; category: string }
  | null

function formatEurCompact(value: number) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `€${(value / 1_000).toFixed(0)}K`
  return `€${Math.round(value)}`
}

function StatusPill({ v }: { v: string }) {
  const variant =
    v === "In Progress"
      ? "secondary"
      : v === "To Do"
        ? "outline"
        : v === "Done"
          ? "secondary"
          : v === "Snoozed"
            ? "secondary"
            : "outline"
  return <Badge variant={variant}>{v}</Badge>
}

function EscLevelTag({ level }: { level: 1 | 2 | 3 | 4 }) {
  const styles =
    level === 1
      ? "bg-[#D7F3F5] text-[#0F6E74]"
      : level === 2
        ? "bg-[#FEF3C7] text-[#B45309]"
        : level === 3
          ? "bg-[#FDE2E2] text-[#B91C1C]"
          : "bg-[#E5E7EB] text-[#374151]"

  return (
    <span
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
        styles
      )}
    >
      {level}
    </span>
  )
}

export function OpportunitiesTable({ filter }: { filter: Filter }) {
  const { dateRange } = useInventoryData()
  const opportunities = useFilteredOpportunities({ includeSnoozed: false })
  const kpis = computeHealthRiskKPIs(opportunities, dateRange.from, dateRange.to)
  const mode = getOpportunityMode(kpis.overstockEur, kpis.understockEur)
  const scopedOpportunities = React.useMemo(
    () => filterOpportunitiesByMode(opportunities, mode),
    [opportunities, mode]
  )
  const baseTotal = React.useMemo(
    () => scopedOpportunities.reduce((sum, opp) => sum + opp.cashImpactEur, 0),
    [scopedOpportunities]
  )
  const targetTotal = React.useMemo(
    () =>
      capOpportunitiesTotal(baseTotal, {
        inventoryEur: kpis.inventoryEur,
        overstockEur: kpis.overstockEur,
        understockEur: kpis.understockEur,
        mode,
      }),
    [baseTotal, kpis.inventoryEur, kpis.overstockEur, kpis.understockEur, mode]
  )
  const scale = React.useMemo(
    () => getOpportunitiesScale(baseTotal, targetTotal),
    [baseTotal, targetTotal]
  )

  const rows = React.useMemo(() => {
    let res = scopedOpportunities
    if (filter?.kind === "type") {
      res = res.filter((o) => o.suggestedAction === filter.category)
    }
    if (filter?.kind === "status") {
      res = res.filter((o) => o.status === filter.category)
    }
    if (filter?.kind === "concentration") {
      const buckets = buildConcentrationBuckets(scopedOpportunities)
      const match = buckets.find((b) => b.bucket === filter.category)
      const ids = new Set(match?.ids ?? [])
      res = res.filter((o) => ids.has(o.id))
    }
    return res
  }, [scopedOpportunities, filter])

  // later you’ll filter rows based on filter.kind/category; for now keep mock
  return (
    <div className="rounded-xl bg-white">
      <Table>
        <TableHeader>
          {/* GROUP HEADER ROW */}
          <TableRow className="bg-muted/30 text-xs font-medium text-muted-foreground">
            <TableHead className="w-10 border-b border-border" rowSpan={2}>
              <Checkbox />
            </TableHead>

            <TableHead className="border-b border-border border-l" colSpan={4}>
              Supply Event
            </TableHead>
            <TableHead className="border-b border-border border-l" colSpan={6}>
              Part
            </TableHead>

            <TableHead className="border-b border-border border-l" rowSpan={2}>
              Cash impact
            </TableHead>
          </TableRow>

          {/* COLUMN HEADER ROW */}
          <TableRow className="bg-muted/30 text-xs font-medium text-muted-foreground">
            <TableHead className="border-l border-border">Type</TableHead>
            <TableHead className="border-l border-border">Event</TableHead>
            <TableHead className="border-l border-border">Supplier</TableHead>

            <TableHead className="border-l border-border">Status</TableHead>

            <TableHead className="border-l border-border">Esc. level</TableHead>
            <TableHead className="border-l border-border">Part Number and Name</TableHead>
            <TableHead className="border-l border-border">Plant</TableHead>
            <TableHead className="border-l border-border">Buyer code</TableHead>
            <TableHead className="border-l border-border">MRP code</TableHead>
            <TableHead className="border-l border-border">Sug. Action</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} className={r.status === "Snoozed" ? "opacity-60" : ""}>
              <TableCell>
                <Checkbox />
              </TableCell>

              <TableCell className="border-l border-border font-medium text-muted-foreground">
                {r.supplyType}
              </TableCell>
              <TableCell className="border-l border-border text-blue-600 underline underline-offset-2">
                {r.orderNumber}
              </TableCell>
              <TableCell className="border-l border-border text-muted-foreground">
                {r.supplier}
              </TableCell>

              <TableCell className="border-l border-border">
                <StatusPill v={r.status} />
              </TableCell>

              <TableCell className="border-l border-border text-muted-foreground">
                <EscLevelTag level={r.escLevel} />
              </TableCell>
              <TableCell className="border-l border-border text-blue-600 underline underline-offset-2">
                {r.partNumber} - {r.partName}
              </TableCell>
              <TableCell className="border-l border-border text-muted-foreground">
                {r.plant}
              </TableCell>
              <TableCell className="border-l border-border text-muted-foreground">
                {r.buyerCode}
              </TableCell>
              <TableCell className="border-l border-border text-muted-foreground">
                {r.mrpCode}
              </TableCell>
              <TableCell className="border-l border-border">
                <span className="inline-flex items-center rounded-md bg-[#E6F7F8] px-2 py-1 text-sm font-semibold text-[#0F6E74]">
                  {r.suggestedAction}
                </span>
              </TableCell>

              <TableCell className="border-l border-border text-muted-foreground">
                {formatEurCompact(Math.round(r.cashImpactEur * scale))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

