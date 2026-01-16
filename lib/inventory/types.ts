export type Plan = "ERP" | "ALT"

export type OpportunityStatus = "To Do" | "In Progress" | "Done" | "Snoozed"
export type SuggestedAction = "Pull in" | "Cancel" | "Push Out"

/**
 * Single source of truth for opportunities used across the app.
 * Keep it "UI-agnostic" so both tables + widgets can derive from it.
 */
export type Opportunity = {
  id: string
  plan: Plan

  // Opportunities page fields
  orderNumber: string
  partName: string
  partNumber: string
  suggestedAction: SuggestedAction
  suggestedDate: string // ISO date (YYYY-MM-DD)
  status: OpportunityStatus
  assignee: string

  // Extra fields used by Control Tower table / widgets later
  supplier: string
  customer: string
  escLevel: 1 | 2 | 3 | 4
  plant: string
  buyerCode: string
  mrpCode: string
  supplyType: "PO" | "PR"
  cashImpactEur: number // numeric so widgets can aggregate

  snoozeRuleIds?: string[]
  prevStatus?: OpportunityStatus
}
