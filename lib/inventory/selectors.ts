import type { Opportunity } from "@/lib/inventory/types"

export type OpportunitiesByStatus = Record<Opportunity["status"], number>
export type OpportunitiesByAction = Record<Opportunity["suggestedAction"], number>

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
