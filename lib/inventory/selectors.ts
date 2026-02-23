import type { Opportunity } from "@/lib/inventory/types"

export type OpportunitiesByStatus = Record<Opportunity["status"], number>
export type OpportunitiesByAction = Record<Opportunity["suggestedAction"], number>
export type OpportunityMode = "overstock" | "understock"
export type ConcentrationBucket = { bucket: string; ids: string[]; totalEur: number }

export function groupOpportunitiesByStatus(opps: Opportunity[]): OpportunitiesByStatus {
  return opps.reduce(
    (acc, o) => {
      acc[o.status] = (acc[o.status] ?? 0) + 1
      return acc
    },
    { "To Do": 0, "In Progress": 0, Done: 0, Snoozed: 0 } as OpportunitiesByStatus
  )
}

export function groupOpportunitiesByAction(opps: Opportunity[]): OpportunitiesByAction {
  return opps.reduce(
    (acc, o) => {
      acc[o.suggestedAction] = (acc[o.suggestedAction] ?? 0) + 1
      return acc
    },
    { "Pull in": 0, Cancel: 0, "Push Out": 0, STO: 0, "Scrap/Sell": 0 } as OpportunitiesByAction
  )
}

/**
 * "Smaller timeframe => smaller value" scaling.
 * We compute how many days are selected and scale relative to a reference window.
 */
export function timeframeScale(from?: Date, to?: Date, referenceDays = 90) {
  if (!from || !to) return 1
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1)
  return Math.min(1, days / referenceDays)
}

/**
 * Demo KPI: inventory from counts; overstock ~10%, understock less, dead stock ~5% of inventory.
 */
export function computeHealthRiskKPIs(opps: Opportunity[], from?: Date, to?: Date) {
  const scale = timeframeScale(from, to, 90)

  const total = opps.length
  const inProgress = opps.filter((o) => o.status === "In Progress").length
  const todo = opps.filter((o) => o.status === "To Do").length
  const uselessCount = opps.filter(
    (o) => o.status === "Canceled" || o.status === "Snoozed" || o.status === "Done"
  ).length

  // Inventory from opportunity count; others as % of inventory for demo
  const inventoryEur = Math.round((total * 95_000) * scale)
  const overstockEur = Math.round(inventoryEur * 0.1)
  const understockEur = Math.round(inventoryEur * 0.06)
  const uselessStockEur = Math.round(inventoryEur * 0.05)

  // "parts" numbers (proportional for display)
  const inventoryParts = Math.round((total * 120) * scale)
  const overstockParts = Math.max(1, Math.round((todo * 90) * scale))
  const understockParts = Math.max(1, Math.round((inProgress * 60) * scale))
  const uselessStockParts = Math.max(1, Math.round((uselessCount * 45) * scale))

  return {
    inventoryEur,
    overstockEur,
    understockEur,
    uselessStockEur,
    inventoryParts,
    overstockParts,
    understockParts,
    uselessStockParts,
  }
}

export function getOpportunityMode(overstockEur: number, understockEur: number): OpportunityMode {
  return overstockEur >= understockEur ? "overstock" : "understock"
}

export function filterOpportunitiesByMode(opps: Opportunity[], mode: OpportunityMode) {
  if (mode === "overstock") {
    return opps.filter((o) => o.suggestedAction !== "Pull in")
  }
  return opps.filter((o) => o.suggestedAction === "Pull in")
}

export function capOpportunitiesTotal(
  baseTotal: number,
  options: {
    inventoryEur: number
    overstockEur: number
    understockEur: number
    mode: OpportunityMode
  }
) {
  const { inventoryEur, overstockEur, understockEur, mode } = options
  const sumCap = Math.max(0, Math.min(inventoryEur, overstockEur + understockEur))
  let cap = sumCap
  if (mode === "overstock" && overstockEur > 0) {
    cap = Math.min(cap, Math.round(overstockEur * 0.9))
  }

  if (cap <= 0 || baseTotal <= 0) return 0

  const minTotal = Math.min(cap, 150_000)
  if (baseTotal < minTotal) return minTotal
  if (baseTotal > cap) return cap
  return baseTotal
}

export function getOpportunitiesScale(baseTotal: number, targetTotal: number) {
  if (baseTotal <= 0 || targetTotal <= 0) return 0
  return targetTotal / baseTotal
}

export function buildConcentrationBuckets(opps: Opportunity[]): ConcentrationBucket[] {
  const sorted = [...opps].sort((a, b) => b.cashImpactEur - a.cashImpactEur)
  const bucketCount = 10
  const bucketSize = Math.max(1, Math.ceil(sorted.length / bucketCount))

  return Array.from({ length: bucketCount }, (_, i) => {
    const start = i * bucketSize
    const end = start + bucketSize
    const slice = sorted.slice(start, end)
    const totalEur = slice.reduce((sum, opp) => sum + opp.cashImpactEur, 0)
    return {
      bucket: `${(i + 1) * 10}%`,
      ids: slice.map((opp) => opp.id),
      totalEur,
    }
  })
}
