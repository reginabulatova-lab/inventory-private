"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import type { Opportunity, Plan } from "@/lib/inventory/types"
import { seedOpportunities } from "@/lib/inventory/seed"

export type PresetKey = "current" | "today" | "tomorrow" | "eom" | "eoq" | "eoy"
export type DateRange = { from?: Date; to?: Date }

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
    // Month-to-date
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    return { from: startOfDay(from), to: endOfDay(now) }
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

  /**
   * Expose a stable "now" so other computations can be consistent too if needed.
   * (Optional but useful.)
   */
  now: Date
}

const InventoryDataContext = React.createContext<InventoryDataContextValue | null>(null)

const LS_KEY = "inventory_opportunities_v1"

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

  // ✅ single source of truth for timeframe preset + range (derived from stable now)
  const [timeframePreset, setTimeframePreset] = React.useState<PresetKey>("current")
  const [dateRange, setDateRange] = React.useState<DateRange>(() => rangeFromPreset("current", now))

  // ✅ when preset changes, derive the range from the same stable "now"
  React.useEffect(() => {
    setDateRange(rangeFromPreset(timeframePreset, now))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframePreset])

  // Optional: load from localStorage AFTER mount (won't cause hydration mismatch)
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LS_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) setOpportunities(parsed as Opportunity[])
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

  const updateStatusByIds = React.useCallback((ids: string[], status: Opportunity["status"]) => {
    if (ids.length === 0) return
    setOpportunities((prev) => prev.map((o) => (ids.includes(o.id) ? { ...o, status } : o)))
  }, [])

  const snoozeByIds = React.useCallback(
    (ids: string[]) => updateStatusByIds(ids, "Snoozed"),
    [updateStatusByIds]
  )

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
      now,
    }),
    [plan, dateRange, timeframePreset, opportunities, updateStatusByIds, snoozeByIds, now]
  )

  return <InventoryDataContext.Provider value={value}>{children}</InventoryDataContext.Provider>
}

export function useInventoryData() {
  const ctx = React.useContext(InventoryDataContext)
  if (!ctx) throw new Error("useInventoryData must be used inside InventoryDataProvider")
  return ctx
}

export function useFilteredOpportunities(options?: { includeSnoozed?: boolean }) {
  const { plan, dateRange, opportunities, timeframePreset } = useInventoryData()
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

    return res
  }, [
    plan,
    dateRange.from,
    dateRange.to,
    opportunities,
    includeSnoozed,
    timeframePreset,
  ])
}

  

