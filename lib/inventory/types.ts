export type Plan = "ERP"

export type OpportunityStatus =
  | "Backlog"
  | "To Do"
  | "In Progress"
  | "Done"
  | "Canceled"
  | "Snoozed"
export type SuggestedAction = "Pull in" | "Cancel" | "Push Out" | "STO" | "Scrap/Sell"

/** All opportunity types in display order (filter + widgets). */
export const OPPORTUNITY_TYPE_OPTIONS: SuggestedAction[] = [
  "Push Out",
  "Cancel",
  "Pull in",
  "STO",
  "Scrap/Sell",
]

export type OpportunityPriority = "P1" | "P2" | "P3" | "P4"

/** Scrap/Sell pipeline status (used when suggestedAction === "Scrap/Sell"). */
export type ScrapSellStatus =
  | "New"
  | "Qualified"
  | "Proposed"
  | "Confirmed"
  | "Executed"
  | "Cancelled"

/**
 * Single source of truth for opportunities used across the app.
 * Keep it "UI-agnostic" so both tables + widgets can derive from it.
 */
export type Opportunity = {
  id: string
  plan: Plan

  // Opportunities page fields
  orderNumber: string
  objectId: string
  objectType: "PO" | "PR"
  needDate: string // ISO date (YYYY-MM-DD)
  leadTimeDays: number
  createdAt: string
  startedAt?: string | null
  completedAt?: string | null
  todoAt?: string | null
  inProgressAt?: string | null
  doneAt?: string | null
  statusHistory?: { status: OpportunityStatus; timestamp: string }[]
  partName: string
  partNumber: string
  suggestedAction: SuggestedAction
  suggestedDate: string // ISO date (YYYY-MM-DD)
  deliveryDate: string // ISO date (YYYY-MM-DD)
  status: OpportunityStatus
  assignee: string
  team: string
  priority?: OpportunityPriority

  // Extra fields used by Control Tower table / widgets later
  supplier: string
  customer: string
  escLevel: 1 | 2 | 3 | 4
  plant: string
  buyerCode: string
  mrpCode: string
  supplyType: "PO" | "PR"
  cashImpactEur: number // numeric so widgets can aggregate

  // STO-specific (for suggestedAction === "STO")
  currentStorageLocation?: string
  targetStorageLocation?: string

  // Scrap/Sell-specific (for suggestedAction === "Scrap/Sell")
  quantity?: number
  scrapSellStatus?: ScrapSellStatus

  snoozeRuleIds?: string[]
  prevStatus?: OpportunityStatus
}
