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
    { "Pull in": 0, Cancel: 0 } as OpportunitiesByAction
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
 * Example KPI numbers derived from opportunities, without changing UI.
 * You can tune base multipliers later to feel realistic.
 */
export function computeHealthRiskKPIs(opps: Opportunity[], from?: Date, to?: Date) {
  const scale = timeframeScale(from, to, 90)

  // base numbers derived from count; tune multipliers to feel realistic
  const total = opps.length
  const inProgress = opps.filter((o) => o.status === "In Progress").length
  const todo = opps.filter((o) => o.status === "To Do").length

  // € values: scale + relate to counts
  const inventoryEur = Math.round((total * 42000) * scale)
  const overstockEur = Math.round((todo * 38000) * scale)
  const understockEur = Math.round((inProgress * 22000) * scale)

  // "parts" numbers
  const inventoryParts = Math.round((total * 120) * scale)
  const overstockParts = Math.round((todo * 90) * scale)
  const understockParts = Math.round((inProgress * 60) * scale)

  return {
    inventoryEur,
    overstockEur,
    understockEur,
    inventoryParts,
    overstockParts,
    understockParts,
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
