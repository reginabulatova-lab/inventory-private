import type { Opportunity, OpportunityPriority } from "@/lib/inventory/types"

export const PRIORITY_ORDER: OpportunityPriority[] = ["P1", "P2", "P3", "P4"]

export function calcTimeToActDays(needDate: string, leadTimeDays: number, today: Date) {
  const needTime = Date.parse(needDate)
  if (!Number.isFinite(needTime)) return null
  const dayMs = 86400000
  const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const raw = Math.round((needTime - leadTimeDays * dayMs - todayMs) / dayMs)
  return raw
}

export function computeOpportunityPriority(
  timeToActDays: number | null,
  inventoryValueEur: number
): OpportunityPriority {
  if (timeToActDays != null && timeToActDays <= 0) return "P1"

  const urgent = timeToActDays != null && timeToActDays <= 3
  const soon = timeToActDays != null && timeToActDays <= 7
  const mid = timeToActDays != null && timeToActDays <= 14

  const highValue = inventoryValueEur >= 200_000
  const medValue = inventoryValueEur >= 100_000
  const lowValue = inventoryValueEur >= 50_000

  if (urgent && highValue) return "P1"
  if ((soon && highValue) || (urgent && medValue)) return "P2"
  if ((mid && medValue) || (soon && lowValue)) return "P3"
  return "P4"
}

export function resolveOpportunityPriority(opportunity: Opportunity, today: Date): OpportunityPriority {
  if (opportunity.priority) return opportunity.priority
  const timeToActDays = calcTimeToActDays(opportunity.needDate, opportunity.leadTimeDays, today)
  return computeOpportunityPriority(timeToActDays, opportunity.cashImpactEur)
}
