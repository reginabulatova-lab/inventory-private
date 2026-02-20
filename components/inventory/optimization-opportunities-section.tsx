"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { WidgetCard } from "@/components/inventory/kpi-card"
import { PieBreakdown, PieDatum } from "@/components/inventory/pie-breakdown"
import { BottomSheetModal } from "@/components/inventory/bottom-sheet-modal"
import {
  OpportunitiesTable,
  PriorityBadge,
  StatusLabel,
  TimeToActBadge,
} from "@/components/opportunities/opportunities-table"
import {
  useFilteredOpportunities,
  useInventoryData,
  applyOpportunityFilters,
  rangeFromPreset,
} from "@/components/inventory/inventory-data-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  capOpportunitiesTotal,
  computeHealthRiskKPIs,
  filterOpportunitiesByMode,
  getOpportunitiesScale,
  getOpportunityMode,
} from "@/lib/inventory/selectors"
import { calcTimeToActDays, PRIORITY_ORDER, resolveOpportunityPriority } from "@/lib/inventory/priority"
import type { Opportunity, OpportunityPriority } from "@/lib/inventory/types"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowDown, ChevronDown, ChevronRight, ChevronUp, Lightbulb } from "lucide-react"

type WidgetKey = "type" | "status" | "priority"

type Active = {
  widget: WidgetKey
  category: string
} | null


const TYPE_COLORS = ["#2563EB", "#19A7B0", "#F59E0B", "#8B5CF6", "#EC4899"]
const TEAM_COLORS = ["#2563EB", "#06B6D4", "#F59E0B", "#22C55E", "#A855F7"]

function formatEurCompact(value: number) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `€${(value / 1_000).toFixed(0)}K`
  return `€${Math.round(value)}`
}

function formatPct(value: number, total: number) {
  if (!total) return "0%"
  return `${Math.round((value / total) * 100)}%`
}

type OptimizationOpportunitiesSectionProps = {
  /** When true, render only the widgets and modals (no section wrapper, no title). */
  embedded?: boolean
}

export function OptimizationOpportunitiesSection({ embedded = false }: OptimizationOpportunitiesSectionProps = {}) {
  const [open, setOpen] = React.useState(false)
  const [active, setActive] = React.useState<Active>(null)
  const [kpiOpen, setKpiOpen] = React.useState(false)
  const [activeKpi, setActiveKpi] = React.useState<"lead" | "start" | "cycle" | null>(null)
  const [backlogSelected, setBacklogSelected] = React.useState<Record<string, boolean>>({})
  const [backlogStatusOpen, setBacklogStatusOpen] = React.useState(false)
  const [backlogStatus, setBacklogStatus] = React.useState<Opportunity["status"]>("Backlog")
  const [backlogExpanded, setBacklogExpanded] = React.useState(false)
  const [recapOpen, setRecapOpen] = React.useState(false)
  const [topOpen, setTopOpen] = React.useState(false)
  const [topActiveId, setTopActiveId] = React.useState<string | null>(null)
  const {
    currentUser,
    dateRange,
    timeframePreset,
    opportunities,
    plan,
    filters,
    escalationTickets,
    now,
    setStatusByIds,
    setPriorityByIds,
    applyPushOutByIds,
    snoozeByIds,
  } = useInventoryData()
  const filteredOpportunities = useFilteredOpportunities({ includeSnoozed: false })

  const kpis = computeHealthRiskKPIs(filteredOpportunities, dateRange.from, dateRange.to)
  const mode = getOpportunityMode(kpis.overstockEur, kpis.understockEur)

  const scopedOpportunities = React.useMemo(
    () => filterOpportunitiesByMode(filteredOpportunities, mode),
    [filteredOpportunities, mode]
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

  const [hideIntels, setHideIntels] = React.useState(false)
  const HIDE_INTELS_STORAGE_KEY = "inventory_hide_intels"
  const HIDE_INTELS_EVENT = "inventory_hide_intels_change"

  const readHideIntels = React.useCallback(() => {
    try {
      const raw = window.localStorage.getItem(HIDE_INTELS_STORAGE_KEY)
      setHideIntels(raw === "true")
    } catch {
      // ignore
    }
  }, [])

  React.useEffect(() => {
    readHideIntels()
  }, [readHideIntels])

  React.useEffect(() => {
    const onEvent = (e: Event) => {
      const next = (e as CustomEvent<boolean>).detail
      if (typeof next === "boolean") setHideIntels(next)
      else readHideIntels()
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key !== HIDE_INTELS_STORAGE_KEY) return
      readHideIntels()
    }

    window.addEventListener(HIDE_INTELS_EVENT, onEvent as EventListener)
    window.addEventListener("storage", onStorage)
    return () => {
      window.removeEventListener(HIDE_INTELS_EVENT, onEvent as EventListener)
      window.removeEventListener("storage", onStorage)
    }
  }, [readHideIntels])

  const formatDuration = React.useCallback((days: number | null) => {
    if (days == null) return "N/A"
    if (days < 7) return `${days.toFixed(1)}d`
    if (days < 30) return `${(days / 7).toFixed(1)}w`
    return `${(days / 30).toFixed(1)}mo`
  }, [])

  const avg = React.useCallback((values: number[]) => {
    if (values.length === 0) return null
    return values.reduce((sum, v) => sum + v, 0) / values.length
  }, [])

  const computeWorkflowMetrics = React.useCallback(
    (rows: Opportunity[], asOf: number) => {
      const timeToStart: number[] = []
      const cycleTimes: number[] = []

      const parseDate = (value?: string | null) => (value ? Date.parse(value) : NaN)

      rows.forEach((row) => {
        const created = parseDate(row.createdAt)
        const started = parseDate(row.startedAt ?? row.inProgressAt)
        const done = parseDate(row.doneAt ?? row.completedAt)

        const timeToStartDays =
          row.status === "To Do"
            ? Number.isFinite(created)
              ? Math.round((asOf - created) / 86400000)
              : null
            : Number.isFinite(started) && Number.isFinite(created)
              ? Math.max(0, Math.round((started - created) / 86400000))
              : null

        if (timeToStartDays != null) {
          timeToStart.push(timeToStartDays)
        }

        if (row.status === "Done" && Number.isFinite(started) && Number.isFinite(done)) {
          cycleTimes.push(Math.max(0, Math.round((done - started) / 86400000)))
        }
      })

      return {
        timeToStart: avg(timeToStart),
        cycleTime: avg(cycleTimes),
        timeToStartCount: timeToStart.length,
        cycleCount: cycleTimes.length,
      }
    },
    [avg]
  )

  const resolvedRange = React.useMemo(() => {
    if (dateRange.from || dateRange.to) {
      return {
        from: dateRange.from ?? new Date((dateRange.to ?? now).getTime() - 30 * 86400000),
        to: dateRange.to ?? now,
      }
    }
    return rangeFromPreset(timeframePreset, now)
  }, [dateRange.from, dateRange.to, timeframePreset, now])

  const currentRange = React.useMemo(() => {
    const from = resolvedRange.from ?? new Date(now.getTime() - 30 * 86400000)
    const to = resolvedRange.to ?? now
    return from.getTime() <= to.getTime() ? { from, to } : { from: to, to: from }
  }, [resolvedRange, now])

  const previousRange = React.useMemo(() => {
    const duration = currentRange.to.getTime() - currentRange.from.getTime()
    const prevTo = new Date(currentRange.from.getTime())
    const prevFrom = new Date(currentRange.from.getTime() - duration)
    return { from: prevFrom, to: prevTo }
  }, [currentRange])

  const filterOpportunitiesByRange = React.useCallback(
    (from: Date, to: Date) => {
      const fromMs = from.getTime()
      const toMs = to.getTime()
      const base = opportunities
        .filter((o) => {
          if (o.plan !== plan) return false
          if (o.status === "Snoozed") return false
          const t = new Date(o.suggestedDate).getTime()
          if (!Number.isFinite(t)) return false
          return t >= fromMs && t <= toMs
        })
      return applyOpportunityFilters(base, filters, escalationTickets)
    },
    [opportunities, plan, filters, escalationTickets]
  )

  const previousScoped = React.useMemo(() => {
    const base = filterOpportunitiesByRange(previousRange.from, previousRange.to)
    const prevKpis = computeHealthRiskKPIs(base, previousRange.from, previousRange.to)
    const prevMode = getOpportunityMode(prevKpis.overstockEur, prevKpis.understockEur)
    return filterOpportunitiesByMode(base, prevMode)
  }, [filterOpportunitiesByRange, previousRange])

  const workflowMetrics = React.useMemo(
    () => computeWorkflowMetrics(scopedOpportunities, now.getTime()),
    [scopedOpportunities, computeWorkflowMetrics, now]
  )

  const previousMetrics = React.useMemo(
    () => computeWorkflowMetrics(previousScoped, previousRange.to.getTime()),
    [previousScoped, previousRange, computeWorkflowMetrics]
  )

  const formatAvg = React.useCallback(
    (days: number | null, count: number) =>
      count === 0 ? "N/A" : formatDuration(days),
    [formatDuration]
  )

  const fallbackKpis = React.useMemo(
    () => ({
      timeToStart: { days: 3.2, count: 18 },
      cycleTime: { days: 6.1, count: 12 },
    }),
    []
  )

  const displayStart = workflowMetrics.timeToStartCount > 0
    ? { days: workflowMetrics.timeToStart, count: workflowMetrics.timeToStartCount }
    : fallbackKpis.timeToStart
  const displayCycle = workflowMetrics.cycleCount > 0
    ? { days: workflowMetrics.cycleTime, count: workflowMetrics.cycleCount }
    : fallbackKpis.cycleTime
  const displayLead = {
    days: (displayStart.days ?? 0) + (displayCycle.days ?? 0),
    count: Math.min(displayStart.count, displayCycle.count),
  }

  const kpiBadgeClass = React.useCallback((tone: "up" | "down" | "flat") => {
    if (tone === "up") return "text-emerald-700"
    if (tone === "down") return "text-rose-700"
    return "text-muted-foreground"
  }, [])

  const badgeFallback = React.useMemo(() => {
    const map: Record<string, { lead: number; start: number; direction: "up" | "down" }> = {
      today: { lead: 6, start: 4, direction: "up" },
      tomorrow: { lead: 5, start: 3, direction: "down" },
      current: { lead: 9, start: 7, direction: "up" },
      eom: { lead: 12, start: 8, direction: "down" },
      eoq: { lead: 14, start: 10, direction: "up" },
      eoy: { lead: 15, start: 11, direction: "down" },
      custom: { lead: 7, start: 5, direction: "up" },
    }
    return map[timeframePreset] ?? map.current
  }, [timeframePreset])

  const formatDelta = React.useCallback(
    (
      current: number | null,
      previous: number | null,
      fallback: { percent: number; direction: "up" | "down" }
    ): { label: string; tone: "up" | "down" | "flat" } => {
      if (current == null || previous == null || previous === 0) {
        const arrow = fallback.direction === "up" ? "↑" : "↓"
        return { label: `${arrow} ${fallback.percent}%`, tone: fallback.direction }
      }
      const raw = ((current - previous) / previous) * 100
      const pct = Math.max(2, Math.min(15, Math.round(Math.abs(raw))))
      const tone = raw >= 0 ? ("up" as const) : ("down" as const)
      const arrow = raw >= 0 ? "↑" : "↓"
      return { label: `${arrow} ${pct}%`, tone }
    },
    []
  )

  const openKpi = React.useCallback((key: "lead" | "start" | "cycle") => {
    setActiveKpi(key)
    setKpiOpen(true)
  }, [])

  const prevLead =
    previousMetrics.timeToStart != null && previousMetrics.cycleTime != null
      ? previousMetrics.timeToStart + previousMetrics.cycleTime
      : null
  const leadDelta = formatDelta(displayLead.days ?? null, prevLead, {
    percent: badgeFallback.lead,
    direction: badgeFallback.direction,
  })
  const startDelta = formatDelta(displayStart.days ?? null, previousMetrics.timeToStart ?? null, {
    percent: badgeFallback.start,
    direction: badgeFallback.direction === "up" ? "down" : "up",
  })

  const executionRows = [
    {
      key: "lead" as const,
      title: "Avg Lead Time",
      tooltip: "Average time from To Do → Done",
      value: formatAvg(displayLead.days, displayLead.count),
      delta: leadDelta,
    },
    {
      key: "start" as const,
      title: "Avg Time to Start",
      tooltip: "Average time from To Do → In Progress",
      value: formatAvg(displayStart.days, displayStart.count),
      delta: startDelta,
    },
    {
      key: "cycle" as const,
      title: "Avg Cycle Time",
      tooltip: "Average time from In Progress → Done",
      value: formatAvg(displayCycle.days, displayCycle.count),
      delta: null,
    },
  ]

  // same “only one active at a time” UX as Inventory Breakdown
  const [selected, setSelected] = React.useState<{
    type: string | null
    status: string | null
    priority: string | null
  }>({ type: null, status: null, priority: null })
  const [teamSelected, setTeamSelected] = React.useState<string | null>(null)

  const typeData = React.useMemo<PieDatum[]>(() => {
    const totals = scopedOpportunities.reduce(
      (acc, o) => {
        acc[o.suggestedAction] =
          (acc[o.suggestedAction] ?? 0) + Math.round(o.cashImpactEur * scale)
        return acc
      },
      {
        "Push Out": 0,
        Cancel: 0,
        "Pull in": 0,
        STO: 0,
        "Scrap/Sell": 0,
      } as Record<string, number>
    )

    const rows = [
      { name: "Push Out", value: totals["Push Out"], color: TYPE_COLORS[0] },
      { name: "Cancel", value: totals.Cancel, color: TYPE_COLORS[1] },
      { name: "Pull in", value: totals["Pull in"], color: TYPE_COLORS[2] },
      { name: "STO", value: totals.STO, color: TYPE_COLORS[3] },
      { name: "Scrap/Sell", value: totals["Scrap/Sell"], color: TYPE_COLORS[4] },
    ]

    const scaledTotal = rows.reduce((sum, row) => sum + row.value, 0)

    return rows.map((row) => ({
      name: row.name,
      value: row.value,
      displayValue: formatEurCompact(row.value),
      percent: formatPct(row.value, scaledTotal),
      color: row.color,
    }))
  }, [scopedOpportunities, mode, scale])

  const typeTotal = React.useMemo(
    () => typeData.reduce((sum, row) => sum + row.value, 0),
    [typeData]
  )

  const statusData = React.useMemo<PieDatum[]>(() => {
    const totals = scopedOpportunities.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] ?? 0) + Math.round(o.cashImpactEur * scale)
      return acc
    }, {} as Record<string, number>)
    const statuses = ["Backlog", "To Do", "In Progress", "Done", "Canceled", "Snoozed"] as const
    const colors = ["#2563EB", "#06B6D4", "#F59E0B", "#22C55E", "#EF4444", "#9CA3AF"]
    const total = Object.values(totals).reduce((sum, value) => sum + value, 0)
    return statuses.map((status, idx) => ({
      name: status,
      value: totals[status] ?? 0,
      displayValue: formatEurCompact(totals[status] ?? 0),
      percent: formatPct(totals[status] ?? 0, total),
      color: colors[idx % colors.length],
    }))
  }, [scopedOpportunities, scale])

  const statusTotal = React.useMemo(
    () => formatEurCompact(statusData.reduce((sum, row) => sum + row.value, 0)),
    [statusData]
  )

  const teamData = React.useMemo<PieDatum[]>(() => {
    const totals = scopedOpportunities.reduce((acc, o) => {
      const team = o.team || "Unassigned"
      acc[team] = (acc[team] ?? 0) + Math.round(o.cashImpactEur * scale)
      return acc
    }, {} as Record<string, number>)
    const teams = Object.keys(totals).sort()
    return teams.map((team, idx) => ({
      name: team,
      value: totals[team] ?? 0,
      displayValue: formatEurCompact(totals[team] ?? 0),
      percent: formatPct(totals[team] ?? 0, Object.values(totals).reduce((s, v) => s + v, 0)),
      color: TEAM_COLORS[idx % TEAM_COLORS.length],
    }))
  }, [scopedOpportunities, scale])

  const teamTotal = React.useMemo(
    () => formatEurCompact(teamData.reduce((sum, row) => sum + row.value, 0)),
    [teamData]
  )

  const priorityData = React.useMemo<PieDatum[]>(() => {
    const totals = scopedOpportunities.reduce((acc, o) => {
      const key = resolveOpportunityPriority(o, now)
      acc[key] = (acc[key] ?? 0) + Math.round(o.cashImpactEur * scale)
      return acc
    }, {} as Record<string, number>)

    const total = PRIORITY_ORDER.reduce((sum, priority) => sum + (totals[priority] ?? 0), 0)
    const colors = ["#EF4444", "#F97316", "#F59E0B", "#94A3B8"]

    return PRIORITY_ORDER.map((priority, idx) => ({
      name: priority,
      value: totals[priority] ?? 0,
      displayValue: formatEurCompact(totals[priority] ?? 0),
      percent: formatPct(totals[priority] ?? 0, total),
      color: colors[idx % colors.length],
    }))
  }, [scopedOpportunities, scale, now])

  const priorityTotal = React.useMemo(
    () => formatEurCompact(priorityData.reduce((sum, row) => sum + row.value, 0)),
    [priorityData]
  )

  const close = () => {
    setOpen(false)
    setActive(null)
    setSelected({ type: null, status: null, priority: null })
  }

  const openModal = (widget: WidgetKey, category: string) => {
    setSelected((prev) => ({ ...prev, [widget]: category }))
    setActive({ widget, category })
    setOpen(true)
  }  

  const modalTitle =
    active?.widget === "type"
      ? "Opportunities by type"
      : active?.widget === "status"
        ? "Opportunities by status"
        : active?.widget === "priority"
          ? "Opportunities by priority"
          : "Details"

  const filter =
    active?.widget === "type"
      ? { kind: "type" as const, category: active.category }
      : active?.widget === "status"
        ? { kind: "status" as const, category: active.category }
        : active?.widget === "priority"
          ? { kind: "priority" as const, category: active.category as OpportunityPriority }
          : null

  const seeAllHref = "/inventory/opportunities"

  const backlogOpportunities = React.useMemo(() => {
    const rows = filteredOpportunities
      .filter((row) => row.status === "Backlog")
      .map((row) => {
        const priority = resolveOpportunityPriority(row, now)
        const priorityIndex = PRIORITY_ORDER.indexOf(priority)
        const priorityRank = priorityIndex < 0 ? PRIORITY_ORDER.length : priorityIndex
        const timeToActDays = calcTimeToActDays(row.needDate, row.leadTimeDays, now)
        const value = Math.round(row.cashImpactEur * scale)
        return {
          row,
          priority,
          priorityRank,
          value,
          timeToActDays,
        }
      })
    rows.sort((a, b) => {
      if (a.value !== b.value) return b.value - a.value
      return a.priorityRank - b.priorityRank
    })
    return rows.slice(0, 10)
  }, [filteredOpportunities, now, scale])

  const visibleBacklogOpportunities = backlogExpanded
    ? backlogOpportunities
    : backlogOpportunities.slice(0, 5)

  const backlogIds = React.useMemo(() => backlogOpportunities.map((entry) => entry.row.id), [
    backlogOpportunities,
  ])
  const selectedBacklogIds = React.useMemo(
    () => backlogIds.filter((id) => backlogSelected[id]),
    [backlogIds, backlogSelected]
  )
  const backlogAllChecked =
    backlogIds.length > 0 && selectedBacklogIds.length === backlogIds.length
  const backlogIndeterminate =
    selectedBacklogIds.length > 0 && selectedBacklogIds.length < backlogIds.length

  const assignedOpportunities = React.useMemo(
    () => filteredOpportunities.filter((row) => row.status === "To Do"),
    [filteredOpportunities]
  )
  const assignedCount = assignedOpportunities.length
  const assignedValue = assignedOpportunities.reduce(
    (sum, row) => sum + Math.round(row.cashImpactEur * scale),
    0
  )
  const reviewedTodayCount = Math.max(selectedBacklogIds.length, assignedCount)

  const content = (
    <>
      <div className="mt-6 grid grid-cols-12 gap-6">
        <WidgetCard
          title="Opportunities by type"
          size="m"
          className={cn("h-full", currentUser === "leader" ? "col-span-6 sm:col-span-4" : "col-span-6 lg:col-span-3")}
        >
          <PieBreakdown
            totalLabel="Total"
            totalValue={formatEurCompact(typeTotal)}
            data={typeData}
            selectedCategory={selected.type}
            onSelectCategory={(cat) => openModal("type", cat)}
          />
        </WidgetCard>

        <WidgetCard
          title="Priority distribution"
          size="m"
          className={cn("h-full", currentUser === "leader" ? "col-span-6 sm:col-span-4" : "col-span-6 lg:col-span-3")}
        >
          <PieBreakdown
            totalLabel="Total"
            totalValue={priorityTotal}
            data={priorityData}
            selectedCategory={selected.priority}
            onSelectCategory={(cat) => openModal("priority", cat)}
          />
        </WidgetCard>

        <WidgetCard
          title="Status distribution"
          size="m"
          className={cn("h-full", currentUser === "leader" ? "col-span-6 sm:col-span-4" : "col-span-6 lg:col-span-3")}
        >
          <PieBreakdown
            totalLabel="Total"
            totalValue={statusTotal}
            data={statusData}
            selectedCategory={selected.status}
            onSelectCategory={(cat) => openModal("status", cat)}
          />
        </WidgetCard>

        {currentUser !== "leader" ? (
          <WidgetCard title="Team distribution" size="m" className="h-full col-span-6 lg:col-span-3">
            <PieBreakdown
              totalLabel="Total"
              totalValue={teamTotal}
              data={teamData}
              selectedCategory={teamSelected}
              onSelectCategory={(category) => {
                setTeamSelected((prev) => (prev === category ? null : category))
              }}
            />
          </WidgetCard>
        ) : null}
      </div>

      {!hideIntels && currentUser === "leader" ? (
        <div className="mt-5 grid grid-cols-12 gap-6">
          <WidgetCard
            title="Opportunity Execution"
            tooltip="Average duration across opportunity execution stages."
            size="s"
            className="col-span-12 lg:col-span-3"
          >
            <div className="flex flex-col gap-4">
              {executionRows.map((row) => (
                <div
                  key={row.key}
                  className="flex w-full items-center justify-between gap-4 px-0 py-2 text-left"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{row.title}</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground hover:bg-accent"
                              aria-label={`${row.title} info`}
                            >
                              i
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>{row.tooltip}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-medium tracking-tight text-foreground">
                        {row.value}
                      </span>
                      {row.delta ? (
                        <Badge
                          variant="outline"
                          className={`border-0 bg-transparent px-0 text-xs font-medium ${kpiBadgeClass(
                            row.delta.tone
                          )}`}
                        >
                          {row.delta.label}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openKpi(row.key)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={`Open ${row.title} details`}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </WidgetCard>

          <WidgetCard
            title="Top 10 Opportunities"
            tooltip="Most impactful opportunities to improve current KPIs, sorted by value and priority"
            size="l"
            className="col-span-12 lg:col-span-9"
          >
            <Tabs defaultValue="overstock" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="overstock">Overstock</TabsTrigger>
                <TabsTrigger value="understock">Understock</TabsTrigger>
                <TabsTrigger value="dead-stock">Dead stock</TabsTrigger>
              </TabsList>
              <TabsContent value="overstock" className="mt-0">
                <div className="overflow-hidden rounded-lg border border-border/60">
                  <OpportunitiesTable
                    suggestedActionsFilter={["Push Out", "Cancel"]}
                    maxRows={10}
                    showToolbar={false}
                    showSummary={false}
                    disableModeFilter
                    useRawInventoryValue
                    externalSort={{ key: "inventory", dir: "desc" }}
                  />
                </div>
              </TabsContent>
              <TabsContent value="understock" className="mt-0">
                <div className="overflow-hidden rounded-lg border border-border/60">
                  <OpportunitiesTable
                    suggestedActionsFilter={["Pull in"]}
                    maxRows={10}
                    showToolbar={false}
                    showSummary={false}
                    disableModeFilter
                    useRawInventoryValue
                    externalSort={{ key: "inventory", dir: "desc" }}
                  />
                </div>
              </TabsContent>
              <TabsContent value="dead-stock" className="mt-0">
                <div className="overflow-hidden rounded-lg border border-border/60">
                  <OpportunitiesTable
                    suggestedActionsFilter={["Scrap/Sell", "STO"]}
                    maxRows={10}
                    showToolbar={false}
                    showSummary={false}
                    disableModeFilter
                    useRawInventoryValue
                    externalSort={{ key: "inventory", dir: "desc" }}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </WidgetCard>
        </div>
      ) : null}

      {!hideIntels && currentUser === "manager" ? (
        <div className="mt-6 grid grid-cols-12 gap-6">
          <WidgetCard
            title="Backlog Opportunities"
            tooltip="Opportunities currently in Backlog, sorted by priority and value."
            size="l"
            className="col-span-12 lg:col-span-9"
          >
            {selectedBacklogIds.length > 0 ? (
              <div className="mb-4 flex items-center justify-between rounded-xl border bg-background px-4 py-3 shadow-sm">
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{selectedBacklogIds.length}</span>{" "}
                  selected
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" className="h-9" onClick={() => setBacklogStatusOpen(true)}>
                    Set status
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-9"
                    onClick={() => {
                      applyPushOutByIds(selectedBacklogIds)
                      setBacklogSelected({})
                    }}
                    disabled={selectedBacklogIds.length === 0}
                  >
                    Apply push out
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-9"
                    onClick={() => {
                      snoozeByIds(selectedBacklogIds)
                      setBacklogSelected({})
                    }}
                    disabled={selectedBacklogIds.length === 0}
                  >
                    Snooze
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="overflow-hidden rounded-lg border border-border/60">
              <div className="grid grid-cols-[0.3fr_2.2fr_0.7fr_0.9fr_0.9fr_0.9fr_0.3fr] gap-3 bg-muted/40 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <div>
                  <Checkbox
                    checked={backlogAllChecked ? true : backlogIndeterminate ? "indeterminate" : false}
                    onCheckedChange={(checked) => {
                      if (!checked) return setBacklogSelected({})
                      const next: Record<string, boolean> = {}
                      backlogIds.forEach((id) => (next[id] = true))
                      setBacklogSelected(next)
                    }}
                    aria-label="Select all backlog opportunities"
                  />
                </div>
                <div>Opportunity</div>
                <div>Priority</div>
                <div>Value</div>
                <div>Time to act</div>
                <div>Status</div>
                <div className="text-right"> </div>
              </div>
              <div className="divide-y divide-border/60">
                {backlogOpportunities.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-muted-foreground">
                    No backlog opportunities available.
                  </div>
                ) : (
                  <>
                    {visibleBacklogOpportunities.map(({ row, priority, value, timeToActDays }) => (
                      <div
                        key={row.id}
                        className={`grid grid-cols-[0.3fr_2.2fr_0.7fr_0.9fr_0.9fr_0.9fr_0.3fr] gap-3 px-4 py-3 text-sm ${
                          backlogSelected[row.id] ? "opacity-70" : ""
                        }`}
                      >
                        <div>
                          <Checkbox
                            checked={!!backlogSelected[row.id]}
                            onCheckedChange={(checked) =>
                              setBacklogSelected((prev) => ({ ...prev, [row.id]: Boolean(checked) }))
                            }
                            aria-label={`Select ${row.orderNumber}`}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-medium text-foreground ${
                                backlogSelected[row.id] ? "line-through" : ""
                              }`}
                            >
                              {row.orderNumber}
                            </span>
                            <span className="text-xs text-muted-foreground">{row.suggestedAction}</span>
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {row.partNumber} · {row.partName}
                          </div>
                        </div>
                        <div>
                          <Select
                            value={priority}
                            onValueChange={(value) =>
                              setPriorityByIds([row.id], value as OpportunityPriority)
                            }
                          >
                            <SelectTrigger className="h-8 w-[110px] border-0 bg-transparent px-2 text-xs font-semibold shadow-none hover:bg-muted/40 data-[state=open]:bg-muted/60">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent align="start">
                              {PRIORITY_ORDER.map((p) => (
                                <SelectItem key={p} value={p}>
                                  <PriorityBadge value={p} />
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="font-medium text-foreground">{formatEurCompact(value)}</div>
                        <div>
                          <TimeToActBadge days={timeToActDays} />
                        </div>
                        <div>
                          <Select
                            value={row.status}
                            onValueChange={(value) =>
                              setStatusByIds([row.id], value as Opportunity["status"])
                            }
                          >
                            <SelectTrigger className="h-8 w-[150px] rounded-full border bg-muted/40 px-2 text-xs font-semibold shadow-none hover:bg-muted/60 data-[state=open]:bg-muted/70">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent align="start">
                              <SelectItem value="Backlog">
                                <StatusLabel status="Backlog" />
                              </SelectItem>
                              <SelectItem value="To Do">
                                <StatusLabel status="To Do" />
                              </SelectItem>
                              <SelectItem value="In Progress">
                                <StatusLabel status="In Progress" />
                              </SelectItem>
                              <SelectItem value="Done">
                                <StatusLabel status="Done" />
                              </SelectItem>
                              <SelectItem value="Canceled">
                                <StatusLabel status="Canceled" />
                              </SelectItem>
                              <SelectItem value="Snoozed">
                                <StatusLabel status="Snoozed" />
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setTopActiveId(row.id)
                              setTopOpen(true)
                            }}
                            className="inline-flex items-center justify-center rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
                            aria-label={`View ${row.orderNumber} details`}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {backlogOpportunities.length > 5 ? (
                      <button
                        type="button"
                        onClick={() => setBacklogExpanded((prev) => !prev)}
                        className="flex w-full items-center justify-center gap-2 px-4 py-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                        aria-label={backlogExpanded ? "Show fewer opportunities" : "Show all opportunities"}
                      >
                        {backlogExpanded ? "Show less" : "Show more"}
                        {backlogExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </div>

            <Dialog open={backlogStatusOpen} onOpenChange={setBacklogStatusOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Set status</DialogTitle>
                  <DialogDescription>
                    Apply a new status to the selected opportunities.
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-2">
                  <Select
                    value={backlogStatus}
                    onValueChange={(value) => setBacklogStatus(value as Opportunity["status"])}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="start">
                      <SelectItem value="Backlog">Backlog</SelectItem>
                      <SelectItem value="To Do">To Do</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="Done">Done</SelectItem>
                      <SelectItem value="Canceled">Canceled</SelectItem>
                      <SelectItem value="Snoozed">Snoozed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="ghost" onClick={() => setBacklogStatusOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      setStatusByIds(selectedBacklogIds, backlogStatus)
                      setBacklogSelected({})
                      setBacklogStatusOpen(false)
                    }}
                    disabled={selectedBacklogIds.length === 0}
                  >
                    Apply status
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </WidgetCard>

          <WidgetCard
            title="Today's recap"
            tooltip="Summary of assigned opportunities and potential value."
            size="s"
            className="col-span-12 lg:col-span-3"
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">Reviewed today</span>
                <span className="text-2xl font-medium tracking-tight text-foreground">
                  {reviewedTodayCount} / {backlogOpportunities.length}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">Assigned (To Do)</span>
                <span className="text-2xl font-medium tracking-tight text-foreground">
                  {assignedCount}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">Potential value</span>
                <span className="text-2xl font-medium tracking-tight text-foreground">
                  {formatEurCompact(assignedValue)}
                </span>
              </div>
              <Button
                variant="secondary"
                className="h-9"
                onClick={() => setRecapOpen(true)}
                disabled={assignedCount === 0}
              >
                View details
              </Button>
            </div>
          </WidgetCard>
        </div>
      ) : null}

      {/* SAME MODAL COMPONENT, DIFFERENT CONTENT */}
      <BottomSheetModal
        open={open}
        title={modalTitle}
        subtitle={active?.category}
        onClose={close}
        seeAllHref={seeAllHref}
      >
        <OpportunitiesTable
          filter={filter}
          showToolbar
          showSummary={false}
          includeSnoozed={false}
          actionBarOffsetClass="top-0"
          actionBarGapClass="mt-3"
          actionBarClassName="mt-3"
        />
      </BottomSheetModal>

      <BottomSheetModal
        open={kpiOpen}
        title={
          activeKpi === "lead"
            ? "Longest lead time opportunities"
            : activeKpi === "start"
              ? "Longest time to start opportunities"
              : "Longest cycle time opportunities"
        }
        onClose={() => setKpiOpen(false)}
        seeAllHref={seeAllHref}
      >
        <OpportunitiesTable
          showToolbar
          showSummary={false}
          includeSnoozed={false}
          filter={
            activeKpi === "start"
              ? { kind: "status", category: "To Do" }
              : activeKpi === "cycle"
                ? { kind: "status", category: "In Progress" }
                : null
          }
          externalSort={
            activeKpi === "lead"
              ? { key: "age", dir: "desc" }
              : activeKpi === "start"
                ? { key: "timeToStart", dir: "desc" }
                : { key: "inProgress", dir: "desc" }
          }
          actionBarOffsetClass="top-0"
          actionBarGapClass="mt-3"
          actionBarClassName="mt-3"
        />
      </BottomSheetModal>

      <BottomSheetModal
        open={topOpen}
        title="Opportunity details"
        subtitle={topActiveId ?? undefined}
        onClose={() => {
          setTopOpen(false)
          setTopActiveId(null)
        }}
        seeAllHref={seeAllHref}
      >
        <OpportunitiesTable
          showToolbar
          showSummary={false}
          includeSnoozed={false}
          rowFilter={(row) => (topActiveId ? row.id === topActiveId : false)}
          actionBarOffsetClass="top-0"
          actionBarGapClass="mt-3"
          actionBarClassName="mt-3"
        />
      </BottomSheetModal>

      <BottomSheetModal
        open={recapOpen}
        title="Assigned opportunities"
        subtitle="Status: To Do"
        onClose={() => setRecapOpen(false)}
        seeAllHref={seeAllHref}
      >
        <OpportunitiesTable
          showToolbar
          showSummary={false}
          includeSnoozed={false}
          statusFilter="To Do"
          actionBarOffsetClass="top-0"
          actionBarGapClass="mt-3"
          actionBarClassName="mt-3"
        />
      </BottomSheetModal>
    </>
  )

  if (embedded) return content

  return (
    <section className="mt-10">
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">
        Optimization Opportunities
      </h2>
      {content}
    </section>
  )
}

