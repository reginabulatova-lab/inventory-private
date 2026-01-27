"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import type { Opportunity, Plan } from "@/lib/inventory/types"
import {
  computeHealthRiskKPIs,
  filterOpportunitiesByMode,
  getOpportunityMode,
} from "@/lib/inventory/selectors"
import { seedOpportunities } from "@/lib/inventory/seed"

export type PresetKey = "current" | "today" | "tomorrow" | "eom" | "eoq" | "eoy" | "custom"
export type DateRange = { from?: Date; to?: Date }
export type OpportunityFilters = {
  partKeys: string[]
  suggestedActions: Opportunity["suggestedAction"][]
  customers: string[]
  escLevels: Opportunity["escLevel"][]
  statuses: Opportunity["status"][]
  plants: string[]
  buyerCodes: string[]
  mrpCodes: string[]
}

export type SnoozeRule = {
  id: string
  kind: "customer" | "part"
  value: string
}

const FALLBACK_BUYER_CODES = ["AV67", "TY82", "BN29"]
const FALLBACK_MRP_CODES = ["XJ45", "WM22", "QR98", "ZL16"]
const FALLBACK_TEAMS = ["Supply", "Production", "Customer Support"]

function pickFallback(list: string[], key: string) {
  if (list.length === 0) return ""
  let hash = 0
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0
  }
  const idx = Math.abs(hash) % list.length
  return list[idx]
}

// ---------- Preset helpers (exported so Subnav can reuse) ----------
function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
function endOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}
function endOfQuarter(d: Date) {
  const q = Math.floor(d.getMonth() / 3)
  const endMonth = q * 3 + 2
  return new Date(d.getFullYear(), endMonth + 1, 0)
}
function endOfYear(d: Date) {
  return new Date(d.getFullYear(), 11, 31)
}

/**
 * IMPORTANT:
 * Pass a stable "baseNow" so SSR pre-render + hydration don't disagree.
 */
export function rangeFromPreset(key: PresetKey, baseNow?: Date): DateRange {
  const now = baseNow ?? new Date()

  if (key === "current") {
    // Current month (include remaining days so seeded future data appears)
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    return { from: startOfDay(from), to: endOfDay(endOfMonth(now)) }
  }

  if (key === "today") {
    // rolling window so it never goes empty
    const from = startOfDay(now)
    const to = new Date(now)
    to.setDate(to.getDate() + 7)
    return { from, to: endOfDay(to) }
  }

  if (key === "tomorrow") {
    // rolling window from tomorrow
    const fromDate = new Date(now)
    fromDate.setDate(fromDate.getDate() + 1)

    const to = new Date(fromDate)
    to.setDate(to.getDate() + 7)

    return { from: startOfDay(fromDate), to: endOfDay(to) }
  }

  if (key === "eom") return { from: startOfDay(now), to: endOfDay(endOfMonth(now)) }
  if (key === "eoq") return { from: startOfDay(now), to: endOfDay(endOfQuarter(now)) }

  if (key === "custom") return { from: undefined, to: undefined }

  // eoy
  return { from: startOfDay(now), to: endOfDay(endOfYear(now)) }
}

// ---------- Context ----------
type InventoryDataContextValue = {
  plan: Plan

  dateRange: DateRange
  setDateRange: (r: DateRange) => void

  timeframePreset: PresetKey
  setTimeframePreset: (p: PresetKey) => void

  opportunities: Opportunity[]
  updateStatusByIds: (ids: string[], status: Opportunity["status"]) => void
  snoozeByIds: (ids: string[]) => void
  unsnoozeByIds: (ids: string[]) => void
  setStatusByIds: (ids: string[], status: Opportunity["status"]) => void
  setAssigneeByIds: (ids: string[], assignee: Opportunity["assignee"]) => void
  setTeamByIds: (ids: string[], team: Opportunity["team"]) => void

  /**
   * Expose a stable "now" so other computations can be consistent too if needed.
   * (Optional but useful.)
   */
  now: Date

  filters: OpportunityFilters
  setFilters: React.Dispatch<React.SetStateAction<OpportunityFilters>>
  clearFilters: () => void

  snoozeRules: SnoozeRule[]
  addSnoozeRule: (rule: Omit<SnoozeRule, "id">) => void
  removeSnoozeRule: (id: string) => void
}

const InventoryDataContext = React.createContext<InventoryDataContextValue | null>(null)

const LS_KEY = "inventory_opportunities_v1"
const LS_RULES_KEY = "inventory_snooze_rules_v1"

function planFromPath(pathname: string | null): Plan {
  if (!pathname) return "ERP"
  return pathname.startsWith("/inventory/alternative-plan") ? "ALT" : "ERP"
}

function loadInitial(): Opportunity[] {
  // Deterministic, same in all environments
  return [...seedOpportunities("ERP"), ...seedOpportunities("ALT")]
}

export function InventoryDataProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const plan = planFromPath(pathname)

  // ✅ freeze "now" exactly once for the lifetime of this provider instance
  const nowRef = React.useRef<Date | null>(null)
  if (!nowRef.current) nowRef.current = new Date()
  const now = nowRef.current

  const [opportunities, setOpportunities] = React.useState<Opportunity[]>(() => loadInitial())
  const [filters, setFilters] = React.useState<OpportunityFilters>({
    partKeys: [],
    suggestedActions: [],
    customers: [],
    escLevels: [],
    statuses: [],
    plants: [],
    buyerCodes: [],
    mrpCodes: [],
  })
  const [snoozeRules, setSnoozeRules] = React.useState<SnoozeRule[]>([])

  // ✅ single source of truth for timeframe preset + range (derived from stable now)
  const [timeframePreset, setTimeframePreset] = React.useState<PresetKey>("current")
  const [dateRange, setDateRange] = React.useState<DateRange>(() => rangeFromPreset("current", now))

  // ✅ when preset changes, derive the range from the same stable "now"
  React.useEffect(() => {
    if (timeframePreset === "custom") return
    setDateRange(rangeFromPreset(timeframePreset, now))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframePreset])

  // Optional: load from localStorage AFTER mount (won't cause hydration mismatch)
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LS_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        const normalized = (parsed as Opportunity[]).map((o) => ({
          ...o,
          customer: o.customer ?? o.supplier ?? "—",
          escLevel: o.escLevel ?? 1,
          buyerCode:
            o.buyerCode && FALLBACK_BUYER_CODES.includes(o.buyerCode)
              ? o.buyerCode
              : pickFallback(FALLBACK_BUYER_CODES, o.id),
          mrpCode:
            o.mrpCode && FALLBACK_MRP_CODES.includes(o.mrpCode)
              ? o.mrpCode
              : pickFallback(FALLBACK_MRP_CODES, o.id),
          team: o.team ?? pickFallback(FALLBACK_TEAMS, o.id),
          snoozeRuleIds: o.snoozeRuleIds ?? [],
          prevStatus: o.prevStatus,
        }))
        setOpportunities(normalized)
      }
    } catch {
      // ignore
    }
  }, [])

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LS_RULES_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) setSnoozeRules(parsed as SnoozeRule[])
    } catch {
      // ignore
    }
  }, [])

  // Persist
  React.useEffect(() => {
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(opportunities))
    } catch {
      // ignore
    }
  }, [opportunities])

  React.useEffect(() => {
    try {
      window.localStorage.setItem(LS_RULES_KEY, JSON.stringify(snoozeRules))
    } catch {
      // ignore
    }
  }, [snoozeRules])

  const updateStatusByIds = React.useCallback((ids: string[], status: Opportunity["status"]) => {
    if (ids.length === 0) return
    setOpportunities((prev) =>
      prev.map((o) => (ids.includes(o.id) ? { ...o, status } : o))
    )
  }, [])

  const snoozeByIds = React.useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return
      setOpportunities((prev) =>
        prev.map((o) => {
          if (!ids.includes(o.id)) return o
          if (o.status === "Snoozed") return o
          return {
            ...o,
            status: "Snoozed",
            prevStatus: o.status,
          }
        })
      )
    },
    []
  )

  const unsnoozeByIds = React.useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return
      setOpportunities((prev) =>
        prev.map((o) => {
          if (!ids.includes(o.id)) return o
          if (o.status !== "Snoozed") return o
          return {
            ...o,
            status: o.prevStatus ?? "To Do",
            prevStatus: undefined,
            snoozeRuleIds: [],
          }
        })
      )
    },
    []
  )

  const setStatusByIds = React.useCallback((ids: string[], status: Opportunity["status"]) => {
    if (ids.length === 0) return
    setOpportunities((prev) =>
      prev.map((o) => {
        if (!ids.includes(o.id)) return o
        if (status === "Snoozed") {
          if (o.status === "Snoozed") return o
          return {
            ...o,
            status: "Snoozed",
            prevStatus: o.status,
          }
        }
        return {
          ...o,
          status,
          prevStatus: undefined,
          snoozeRuleIds: [],
        }
      })
    )
  }, [])

  const setAssigneeByIds = React.useCallback((ids: string[], assignee: Opportunity["assignee"]) => {
    if (ids.length === 0) return
    setOpportunities((prev) => prev.map((o) => (ids.includes(o.id) ? { ...o, assignee } : o)))
  }, [])

  const setTeamByIds = React.useCallback((ids: string[], team: Opportunity["team"]) => {
    if (ids.length === 0) return
    setOpportunities((prev) => prev.map((o) => (ids.includes(o.id) ? { ...o, team } : o)))
  }, [])

  const applyRule = React.useCallback((rule: SnoozeRule, rows: Opportunity[]) => {
    return rows.map((o) => {
      const matches =
        rule.kind === "customer"
          ? o.customer === rule.value
          : buildPartKey(o) === rule.value
      if (!matches) return o
      if (o.status === "Snoozed" && o.snoozeRuleIds?.includes(rule.id)) return o
      return {
        ...o,
        status: "Snoozed" as Opportunity["status"],
        prevStatus: o.status === "Snoozed" ? o.prevStatus : o.status,
        snoozeRuleIds: Array.from(new Set([...(o.snoozeRuleIds ?? []), rule.id])),
      }
    })
  }, [])

  const addSnoozeRule = React.useCallback(
    (rule: Omit<SnoozeRule, "id">) => {
      const next: SnoozeRule = { ...rule, id: `${Date.now()}_${Math.random()}` }
      setSnoozeRules((prev) => {
        const exists = prev.some((r) => r.kind === next.kind && r.value === next.value)
        return exists ? prev : [next, ...prev]
      })
      setOpportunities((prev) => applyRule(next, prev))
    },
    [applyRule]
  )

  const removeSnoozeRule = React.useCallback((id: string) => {
    setSnoozeRules((prev) => prev.filter((r) => r.id !== id))
    setOpportunities((prev) =>
      prev.map((o) => {
        if (!o.snoozeRuleIds?.includes(id)) return o
        const nextRuleIds = o.snoozeRuleIds.filter((ruleId) => ruleId !== id)
        if (nextRuleIds.length > 0) {
          return { ...o, snoozeRuleIds: nextRuleIds }
        }
        if (o.status === "Snoozed") {
          return {
            ...o,
            status: o.prevStatus ?? "To Do",
            prevStatus: undefined,
            snoozeRuleIds: [],
          }
        }
        return { ...o, snoozeRuleIds: [] }
      })
    )
  }, [])

  const value = React.useMemo<InventoryDataContextValue>(
    () => ({
      plan,
      dateRange,
      setDateRange,
      timeframePreset,
      setTimeframePreset,
      opportunities,
      updateStatusByIds,
      snoozeByIds,
      unsnoozeByIds,
      setStatusByIds,
      setAssigneeByIds,
      setTeamByIds,
      now,
      filters,
      setFilters,
      clearFilters: () =>
        setFilters({
          partKeys: [],
          suggestedActions: [],
          customers: [],
          escLevels: [],
          statuses: [],
          plants: [],
          buyerCodes: [],
          mrpCodes: [],
        }),
      snoozeRules,
      addSnoozeRule,
      removeSnoozeRule,
    }),
    [
      plan,
      dateRange,
      timeframePreset,
      opportunities,
      updateStatusByIds,
      snoozeByIds,
      unsnoozeByIds,
      setStatusByIds,
      setAssigneeByIds,
      setTeamByIds,
      now,
      filters,
      snoozeRules,
      addSnoozeRule,
      removeSnoozeRule,
    ]
  )

  return <InventoryDataContext.Provider value={value}>{children}</InventoryDataContext.Provider>
}

export function useInventoryData() {
  const ctx = React.useContext(InventoryDataContext)
  if (!ctx) throw new Error("useInventoryData must be used inside InventoryDataProvider")
  return ctx
}

export function applyOpportunityFilters(opps: Opportunity[], filters: OpportunityFilters) {
  let res = opps
  if (filters.partKeys.length > 0) {
    res = res.filter((o) => filters.partKeys.includes(buildPartKey(o)))
  }
  if (filters.suggestedActions.length > 0) {
    res = res.filter((o) => filters.suggestedActions.includes(o.suggestedAction))
  }
  if (filters.customers.length > 0) {
    res = res.filter((o) => filters.customers.includes(o.customer))
  }
  if (filters.escLevels.length > 0) {
    res = res.filter((o) => filters.escLevels.includes(o.escLevel))
  }
  if (filters.statuses.length > 0) {
    res = res.filter((o) => filters.statuses.includes(o.status))
  }
  if (filters.plants.length > 0) {
    res = res.filter((o) => filters.plants.includes(o.plant))
  }
  if (filters.buyerCodes.length > 0) {
    res = res.filter((o) => filters.buyerCodes.includes(o.buyerCode))
  }
  if (filters.mrpCodes.length > 0) {
    res = res.filter((o) => filters.mrpCodes.includes(o.mrpCode))
  }
  return res
}

export function useFilteredOpportunities(options?: { includeSnoozed?: boolean }) {
  const { plan, dateRange, opportunities, timeframePreset, filters } = useInventoryData()
  const { includeSnoozed = true } = options ?? {}

  return React.useMemo(() => {
    const baseFrom = dateRange.from ? dateRange.from.getTime() : -Infinity
    const baseTo = dateRange.to ? dateRange.to.getTime() : Infinity

    const matches = (from: number, to: number) =>
      opportunities.filter((o) => {
        if (o.plan !== plan) return false
        if (!includeSnoozed && o.status === "Snoozed") return false

        const t = new Date(o.suggestedDate).getTime()
        if (!Number.isFinite(t)) return false

        return t >= from && t <= to
      })


    // 1) normal filtering
    let res = matches(baseFrom, baseTo)

    // 2) fallback: if Today/Tomorrow returns nothing, widen window forward
    if (res.length === 0 && (timeframePreset === "today" || timeframePreset === "tomorrow")) {
      const from = baseFrom
      const day = 24 * 60 * 60 * 1000

      for (const days of [7, 14, 30, 60]) {
        const widenedTo = from + days * day
        res = matches(from, widenedTo)
        if (res.length > 0) break
      }
    }

    return applyOpportunityFilters(res, filters)
  }, [
    plan,
    dateRange.from,
    dateRange.to,
    opportunities,
    includeSnoozed,
    timeframePreset,
    filters.partKeys,
    filters.suggestedActions,
    filters.customers,
    filters.escLevels,
    filters.statuses,
    filters.plants,
    filters.buyerCodes,
    filters.mrpCodes,
  ])
}

export function buildPartKey(o: Opportunity) {
  return `${o.partNumber} - ${o.partName}`
}

export function useOpportunitiesForFilters() {
  const { plan, dateRange, opportunities } = useInventoryData()

  return React.useMemo(() => {
    const baseFrom = dateRange.from ? dateRange.from.getTime() : -Infinity
    const baseTo = dateRange.to ? dateRange.to.getTime() : Infinity

    const base = opportunities.filter((o) => {
      if (o.plan !== plan) return false
      if (o.status === "Snoozed") return false
      const t = new Date(o.suggestedDate).getTime()
      if (!Number.isFinite(t)) return false
      return t >= baseFrom && t <= baseTo
    })

    const kpis = computeHealthRiskKPIs(base, dateRange.from, dateRange.to)
    const mode = getOpportunityMode(kpis.overstockEur, kpis.understockEur)
    return filterOpportunitiesByMode(base, mode)
  }, [plan, dateRange.from, dateRange.to, opportunities])
}

  

