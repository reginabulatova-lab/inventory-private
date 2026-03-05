"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { format } from "date-fns"
import {
  applyOpportunityFilters,
  useFilteredOpportunities,
  useInventoryData,
  type EscalationTicket,
  type OpportunityFilters,
} from "@/components/inventory/inventory-data-provider"
import type { Opportunity, OpportunityPriority, ScrapSellStatus } from "@/lib/inventory/types"
import {
  calcTimeToActDays,
  PRIORITY_ORDER,
  resolveOpportunityPriority,
} from "@/lib/inventory/priority"
import {
  buildConcentrationBuckets,
  capOpportunitiesTotal,
  computeHealthRiskKPIs,
  filterOpportunitiesByMode,
  getOpportunitiesScale,
  getOpportunityMode,
} from "@/lib/inventory/selectors"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronDown,
  CircleCheckBig,
  CircleDashed,
  CircleDotDashed,
  Clock,
  Files,
  Pencil,
  PauseCircle,
  X,
} from "lucide-react"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type OpportunitiesTableFilter =
  | { kind: "type"; category: string }
  | { kind: "status"; category: string }
  | { kind: "concentration"; category: string }
  | { kind: "priority"; category: OpportunityPriority }
  | null

export type OpportunityTypeView = "all" | "standard" | "sto" | "scrap-sell"

const STANDARD_ACTIONS: Opportunity["suggestedAction"][] = ["Pull in", "Push Out", "Cancel"]

const TEAM_OPTIONS = ["Supply", "Production", "Customer Support"]
const EMPTY_OPTION = "__empty__"
const ACTION_STYLES: Record<
  string,
  { icon?: React.ReactNode; className: string }
> = {
  Cancel: {
    icon: <X className="h-3.5 w-3.5" />,
    className: "bg-red-100 text-red-700 border border-red-200",
  },
  "Push Out": {
    icon: <ArrowRight className="h-3.5 w-3.5" />,
    className: "bg-blue-100 text-blue-700 border border-blue-200",
  },
  "Pull in": {
    icon: <ArrowDown className="h-3.5 w-3.5" />,
    className: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  },
  STO: {
    className: "bg-violet-100 text-violet-700 border border-violet-200",
  },
  "Scrap/Sell": {
    className: "bg-pink-100 text-pink-700 border border-pink-200",
  },
}

function formatEurCompact(value: number) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `€${(value / 1_000).toFixed(0)}K`
  return `€${Math.round(value)}`
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`
}

function ActionBadge({ action }: { action: string }) {
  const style = ACTION_STYLES[action] ?? {
    className: "bg-muted text-foreground border border-border",
  }
  return (
    <Badge className={`gap-1 rounded-full px-2 py-1 text-xs font-semibold ${style.className}`}>
      {style.icon ? <span className="inline-flex">{style.icon}</span> : null}
      {action}
    </Badge>
  )
}

function statusColorClass(status: string) {
  if (status === "Canceled") return "text-red-600"
  if (status === "In Progress") return "text-blue-600"
  if (status === "Done") return "text-emerald-600"
  if (status === "Snoozed") return "text-[#D4D4D4]"
  if (status === "Backlog") return "text-slate-400"
  return "text-slate-500"
}

function statusIcon(status: string) {
  const className = `h-3.5 w-3.5 ${statusColorClass(status)}`
  if (status === "Canceled") return <X className={className} />
  if (status === "In Progress") return <Clock className={className} />
  if (status === "Done") return <CircleCheckBig className={className} />
  if (status === "Snoozed") return <PauseCircle className={className} />
  if (status === "Backlog") return <CircleDashed className={className} />
  return <CircleDotDashed className={`${className} fill-current`} />
}

const PRIORITY_BADGES: Record<OpportunityPriority, string> = {
  P1: "bg-rose-100 text-rose-700 border border-rose-200",
  P2: "bg-orange-100 text-orange-700 border border-orange-200",
  P3: "bg-amber-100 text-amber-700 border border-amber-200",
  P4: "bg-slate-100 text-slate-700 border border-slate-200",
}

export function PriorityBadge({ value }: { value: OpportunityPriority }) {
  return (
    <Badge className={`rounded-full px-2 py-1 text-xs font-semibold ${PRIORITY_BADGES[value]}`}>
      {value}
    </Badge>
  )
}

function timeToActLabel(days: number | null) {
  if (days == null) return "—"
  if (days < 0) return `Late ${Math.abs(days)} days`
  return `${days} days`
}

function timeToActClass(days: number | null) {
  if (days == null) return "bg-muted text-muted-foreground"
  if (days < 0) return "bg-red-100 text-red-700"
  if (days <= 3) return "bg-red-100 text-red-700"
  if (days <= 7) return "bg-orange-100 text-orange-700"
  if (days <= 14) return "bg-yellow-100 text-yellow-800"
  return "bg-emerald-100 text-emerald-700"
}

export function TimeToActBadge({ days }: { days: number | null }) {
  return (
    <Badge className={`border border-transparent ${timeToActClass(days)}`}>
      {timeToActLabel(days)}
    </Badge>
  )
}

function formatAgeDuration(diffMs: number) {
  const hour = 3600000
  const day = 86400000
  const days = Math.max(0, Math.round(diffMs / day))
  if (diffMs < day) {
    const hours = Math.max(0, Math.round(diffMs / hour))
    return `${hours}h`
  }
  if (days <= 30) return `${days}d`
  if (days <= 90) return `${Math.round(days / 7)}w`
  return `${Math.round(days / 30)}mo`
}

function ageColorClass(days: number | null) {
  if (days == null) return "bg-muted text-muted-foreground"
  if (days < 7) return "bg-emerald-100 text-emerald-700"
  if (days <= 14) return "bg-yellow-100 text-yellow-800"
  if (days <= 30) return "bg-orange-100 text-orange-700"
  return "bg-red-100 text-red-700"
}

function waitColorClass(days: number | null) {
  if (days == null) return "bg-muted text-muted-foreground"
  if (days < 3) return "bg-emerald-100 text-emerald-700"
  if (days <= 7) return "bg-yellow-100 text-yellow-800"
  if (days <= 14) return "bg-orange-100 text-orange-700"
  return "bg-red-100 text-red-700"
}

function inProgressColorClass(days: number | null) {
  if (days == null) return "bg-muted text-muted-foreground"
  if (days < 7) return "bg-emerald-100 text-emerald-700"
  if (days <= 14) return "bg-yellow-100 text-yellow-800"
  if (days <= 21) return "bg-orange-100 text-orange-700"
  return "bg-red-100 text-red-700"
}

function ticketBadgeClass(level: EscalationTicket["level"]) {
  if (level === 1) return "bg-cyan-100 text-cyan-800"
  if (level === 2) return "bg-yellow-100 text-yellow-800"
  if (level === 3) return "bg-red-100 text-red-800"
  return "bg-zinc-300 text-zinc-900"
}

export function StatusLabel({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {statusIcon(status)}
      <span className="text-sm text-foreground">{status}</span>
    </span>
  )
}

function supplyTypeLabel(value: string) {
  return value === "PO" ? "Purchase Order" : value === "PR" ? "Purchase Request" : value
}

export function OpportunitiesTable({
  filter,
  showToolbar = true,
  includeSnoozed = true,
  overrideDateRange,
  overrideStatus,
  useRawInventoryValue = false,
  excludeStatuses,
  disableModeFilter = false,
  showSummary = true,
  statusFilter,
  teamFilter,
  rowFilter,
  externalSort,
  actionBarOffsetClass = "top-[72px]",
  actionBarGapClass = "mt-3",
  actionBarClassName = "",
  opportunityTypeView = "standard",
  suggestedActionsFilter,
  maxRows,
}: {
  filter?: OpportunitiesTableFilter
  showToolbar?: boolean
  includeSnoozed?: boolean
  overrideDateRange?: { from?: Date; to?: Date }
  overrideStatus?: Opportunity["status"]
  useRawInventoryValue?: boolean
  excludeStatuses?: Opportunity["status"][]
  disableModeFilter?: boolean
  showSummary?: boolean
  statusFilter?: Opportunity["status"] | null
  teamFilter?: string | null
  rowFilter?: (row: Opportunity) => boolean
  opportunityTypeView?: OpportunityTypeView
  /** When set, only show rows with these suggested actions (e.g. for Top 10 widget tabs). */
  suggestedActionsFilter?: Opportunity["suggestedAction"][]
  /** When set, show only first N rows after sorting (e.g. 10 for Top 10 widget). */
  maxRows?: number
  externalSort?: {
    key: "inventory" | "timeToAct" | "age" | "timeToStart" | "inProgress" | "suggestedDate"
    dir: "asc" | "desc"
  }
  actionBarOffsetClass?: string
  actionBarGapClass?: string
  actionBarClassName?: string
}) {
  const {
    snoozeByIds,
    unsnoozeByIds,
    setStatusByIds,
    setAssigneeByIds,
    setTeamByIds,
    setDeliveryDateByIds,
    setPriorityByIds,
    setScrapSellStatusByIds,
    setQuantityByIds,
    applyPushOutByIds,
    escalationTickets,
    upsertEscalationTicket,
    dateRange,
    plan,
    opportunities,
    filters,
    setFilters,
    now,
  } = useInventoryData()
  const defaultBase = useFilteredOpportunities({ includeSnoozed: false })
  const defaultRows = useFilteredOpportunities({ includeSnoozed })

  const overrideActive = Boolean(overrideDateRange || overrideStatus)
  const overrideRows = React.useMemo(() => {
    if (!overrideActive) return defaultRows
    const from =
      (overrideDateRange?.from ?? dateRange.from)?.getTime() ?? -Infinity
    const to = (overrideDateRange?.to ?? dateRange.to)?.getTime() ?? Infinity
    let res = opportunities.filter((o) => {
      if (o.plan !== plan) return false
      if (!includeSnoozed && o.status === "Snoozed") return false
      const t = new Date(o.suggestedDate).getTime()
      if (!Number.isFinite(t)) return false
      return t >= from && t <= to
    })
    res = applyOpportunityFilters(res, filters, escalationTickets)
    if (overrideStatus) res = res.filter((o) => o.status === overrideStatus)
    if (excludeStatuses?.length) {
      res = res.filter((o) => !excludeStatuses.includes(o.status))
    }
    return res
  }, [
    overrideActive,
    overrideDateRange?.from,
    overrideDateRange?.to,
    overrideStatus,
    dateRange.from,
    dateRange.to,
    opportunities,
    plan,
    includeSnoozed,
    filters,
    defaultRows,
    excludeStatuses,
  ])

  const filteredSourceRows = React.useMemo(() => {
    let res = overrideActive ? overrideRows : defaultRows
    if (excludeStatuses?.length) {
      res = res.filter((o) => !excludeStatuses.includes(o.status))
    }
    return res
  }, [overrideActive, overrideRows, defaultRows, excludeStatuses])

  const baseOpportunities = overrideActive
    ? filteredSourceRows.filter((o) => o.status !== "Snoozed")
    : defaultBase
  const allRows = overrideActive ? filteredSourceRows : defaultRows

  const kpis = computeHealthRiskKPIs(baseOpportunities, dateRange.from, dateRange.to)
  const mode = getOpportunityMode(kpis.overstockEur, kpis.understockEur)
  const scopedBase = React.useMemo(
    () => (disableModeFilter ? baseOpportunities : filterOpportunitiesByMode(baseOpportunities, mode)),
    [baseOpportunities, mode, disableModeFilter]
  )
  const scopedAll = React.useMemo(
    () => (disableModeFilter ? allRows : filterOpportunitiesByMode(allRows, mode)),
    [allRows, mode, disableModeFilter]
  )
  const baseTotal = React.useMemo(
    () => scopedAll.reduce((sum, opp) => sum + opp.cashImpactEur, 0),
    [scopedAll]
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
  const [selected, setSelected] = React.useState<Record<string, boolean>>({})
  const [openSnooze, setOpenSnooze] = React.useState(false)
  const [openUnsnooze, setOpenUnsnooze] = React.useState(false)
  const [openStatus, setOpenStatus] = React.useState(false)
  const [bulkStatus, setBulkStatus] = React.useState<Opportunity["status"]>("Backlog")
  const [openPanel, setOpenPanel] = React.useState(false)
  const [panelRow, setPanelRow] = React.useState<Opportunity | null>(null)
  const [openTicketPanel, setOpenTicketPanel] = React.useState(false)
  const [activeTicket, setActiveTicket] = React.useState<EscalationTicket | null>(null)
  const [openDeliveryId, setOpenDeliveryId] = React.useState<string | null>(null)
  const [deliveryDraft, setDeliveryDraft] = React.useState<Date | undefined>(undefined)
  const [snackbarOpen, setSnackbarOpen] = React.useState(false)
  const [snackbarMessage, setSnackbarMessage] = React.useState("")
  const [ticketCommentDraft, setTicketCommentDraft] = React.useState("")
  const [ticketComments, setTicketComments] = React.useState<
    Record<string, { id: string; text: string; createdAt: string }[]>
  >({})
  const [commentsById, setCommentsById] = React.useState<
    Record<string, { id: string; text: string; createdAt: string }[]>
  >({})
  const [commentDraft, setCommentDraft] = React.useState("")
  const [, startTransition] = React.useTransition()
  const [sortKey, setSortKey] = React.useState<
    "inventory" | "timeToAct" | "priority" | "age" | "timeToStart" | "inProgress" | "suggestedDate"
  >("inventory")
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc")
  const searchParams = useSearchParams()
  const groupBy = searchParams.get("groupBy") === "order" ? "order" : "none"
  const [collapsedOrders, setCollapsedOrders] = React.useState<Set<string>>(new Set())
  React.useEffect(() => {
    if (!externalSort) return
    setSortKey(externalSort.key)
    setSortDir(externalSort.dir)
  }, [externalSort])
  const filteredRows = React.useMemo(() => {
    let res = scopedAll
    if (suggestedActionsFilter?.length) {
      res = res.filter((o) => suggestedActionsFilter.includes(o.suggestedAction))
    } else if (opportunityTypeView === "all") {
      // no filter by type — show all opportunity types
    } else if (opportunityTypeView === "standard") {
      res = res.filter((o) => STANDARD_ACTIONS.includes(o.suggestedAction))
    } else if (opportunityTypeView === "sto") {
      res = res.filter((o) => o.suggestedAction === "STO")
    } else if (opportunityTypeView === "scrap-sell") {
      res = res.filter((o) => o.suggestedAction === "Scrap/Sell")
    }
    if (filter?.kind === "type") {
      res = res.filter((o) => o.suggestedAction === filter.category)
    }
    if (filter?.kind === "status") {
      res = res.filter((o) => o.status === filter.category)
    }
    if (filter?.kind === "concentration") {
      const buckets = buildConcentrationBuckets(scopedBase)
      const match = buckets.find((b) => b.bucket === filter.category)
      const ids = new Set(match?.ids ?? [])
      res = res.filter((o) => ids.has(o.id))
    }
    if (filter?.kind === "priority") {
      res = res.filter((o) => resolveOpportunityPriority(o, now) === filter.category)
    }
    if (statusFilter) {
      res = res.filter((o) => o.status === statusFilter)
    }
    if (teamFilter) {
      res = res.filter((o) => o.team === teamFilter)
    }
    if (filters.timeToAct.length > 0) {
      const today = new Date()
      res = res.filter((o) => {
        const days = calcTimeToActDays(o.needDate, o.leadTimeDays, today)
        if (days == null) return false
        return filters.timeToAct.some((range) => {
          if (range === "late") return days < 0
          if (range === "lt7") return days <= 7
          if (range === "lt14") return days <= 14
          if (range === "gte14") return days > 14
          return false
        })
      })
    }
    if (filters.ageRanges.length > 0) {
      const now = Date.now()
      res = res.filter((o) => {
        const created = Date.parse(o.createdAt)
        if (!Number.isFinite(created)) return false
        const days = Math.round((now - created) / 86400000)
        return filters.ageRanges.some((range) => {
          if (range === "lt7") return days < 7
          if (range === "d7to14") return days >= 7 && days <= 14
          if (range === "d15to30") return days >= 15 && days <= 30
          if (range === "gt30") return days > 30
          return false
        })
      })
    }
    if (filters.timeToStartRanges.length > 0) {
      const now = Date.now()
      res = res.filter((o) => {
        const created = Date.parse(o.createdAt)
        if (!Number.isFinite(created)) return false
        const started = o.startedAt ? Date.parse(o.startedAt) : NaN
        const days =
          o.status === "To Do"
            ? Math.round((now - created) / 86400000)
            : Number.isFinite(started)
              ? Math.max(0, Math.round((started - created) / 86400000))
              : null
        if (days == null) return false
        return filters.timeToStartRanges.some((range) => {
          if (range === "lt3") return days < 3
          if (range === "d3to7") return days >= 3 && days <= 7
          if (range === "d8to14") return days >= 8 && days <= 14
          if (range === "gt14") return days > 14
          return false
        })
      })
    }
    if (filters.inProgressRanges.length > 0) {
      const now = Date.now()
      res = res.filter((o) => {
        if (o.status !== "In Progress") return false
        const started = o.startedAt ? Date.parse(o.startedAt) : NaN
        if (!Number.isFinite(started)) return false
        const days = Math.max(0, Math.round((now - started) / 86400000))
        return filters.inProgressRanges.some((range) => {
          if (range === "lt7") return days < 7
          if (range === "d7to14") return days >= 7 && days <= 14
          if (range === "d15to21") return days >= 15 && days <= 21
          if (range === "gt21") return days > 21
          return false
        })
      })
    }
    if (rowFilter) {
      res = res.filter(rowFilter)
    }
    return res
  }, [
    scopedAll,
    scopedBase,
    opportunityTypeView,
    suggestedActionsFilter,
    filter,
    statusFilter,
    teamFilter,
    filters.timeToAct,
    filters.ageRanges,
    filters.timeToStartRanges,
    filters.inProgressRanges,
    rowFilter,
    now,
  ])

  const rows = filteredRows
  const rowMeta = React.useMemo(() => {
    const meta = new Map<
      string,
      {
        inventoryValueEur: number
        suggestedDateTime: number
        suggestedDateLabel: string
        deliveryDateLabel: string
        timeToActDays: number | null
        ageDays: number | null
        timeToStartDays: number | null
        inProgressDays: number | null
      }
    >()
    rows.forEach((row) => {
      const suggestedTime = Date.parse(row.suggestedDate)
      const safeSuggestedTime = Number.isFinite(suggestedTime) ? suggestedTime : Infinity
      const suggestedDateLabel =
        row.suggestedAction === "Cancel" || !Number.isFinite(suggestedTime)
          ? ""
          : format(new Date(suggestedTime), "MMM d, yyyy")
      const deliveryTime = Date.parse(row.deliveryDate)
      const deliveryDateLabel = Number.isFinite(deliveryTime)
        ? format(new Date(deliveryTime), "MMM d, yyyy")
        : "—"
      const timeToActDays = calcTimeToActDays(row.needDate, row.leadTimeDays, new Date())
      const createdTime = Date.parse(row.createdAt)
      const ageDays = Number.isFinite(createdTime)
        ? Math.round((Date.now() - createdTime) / 86400000)
        : null
      const startedTime = row.startedAt ? Date.parse(row.startedAt) : NaN
      const timeToStartDays =
        row.status === "To Do"
          ? ageDays
          : Number.isFinite(startedTime) && Number.isFinite(createdTime)
            ? Math.max(0, Math.round((startedTime - createdTime) / 86400000))
            : null
      const inProgressDays =
        row.status === "In Progress" && Number.isFinite(startedTime)
          ? Math.max(0, Math.round((Date.now() - startedTime) / 86400000))
          : null
      meta.set(row.id, {
        inventoryValueEur: useRawInventoryValue
          ? row.cashImpactEur
          : Math.round(row.cashImpactEur * scale),
        suggestedDateTime: safeSuggestedTime,
        suggestedDateLabel,
        deliveryDateLabel,
        timeToActDays,
        ageDays,
        timeToStartDays,
        inProgressDays,
      })
    })
    return meta
  }, [rows, scale, useRawInventoryValue])

  const rowById = React.useMemo(() => {
    const map = new Map<string, (typeof rows)[number]>()
    rows.forEach((row) => {
      map.set(row.id, row)
    })
    return map
  }, [rows])

  const sortedRowIds = React.useMemo(() => {
    const ids = rows.map((row) => row.id)
    return ids.sort((aId, bId) => {
      const aMeta = rowMeta.get(aId)
      const bMeta = rowMeta.get(bId)
      if (sortKey === "suggestedDate") {
        const aTime = aMeta?.suggestedDateTime ?? Infinity
        const bTime = bMeta?.suggestedDateTime ?? Infinity
        const diff = aTime - bTime
        if (diff !== 0) return sortDir === "asc" ? diff : -diff
      } else if (sortKey === "timeToAct") {
        const aDays = aMeta?.timeToActDays ?? Infinity
        const bDays = bMeta?.timeToActDays ?? Infinity
        const diff = aDays - bDays
        if (diff !== 0) return sortDir === "asc" ? diff : -diff
      } else if (sortKey === "age") {
        const aDays = aMeta?.ageDays ?? Infinity
        const bDays = bMeta?.ageDays ?? Infinity
        const diff = aDays - bDays
        if (diff !== 0) return sortDir === "asc" ? diff : -diff
      } else if (sortKey === "timeToStart") {
        const aDays = aMeta?.timeToStartDays ?? Infinity
        const bDays = bMeta?.timeToStartDays ?? Infinity
        const diff = aDays - bDays
        if (diff !== 0) return sortDir === "asc" ? diff : -diff
      } else if (sortKey === "priority") {
        const aRow = rowById.get(aId)
        const bRow = rowById.get(bId)
        if (aRow && bRow) {
          const aPri = PRIORITY_ORDER.indexOf(resolveOpportunityPriority(aRow, now))
          const bPri = PRIORITY_ORDER.indexOf(resolveOpportunityPriority(bRow, now))
          const priA = aPri < 0 ? PRIORITY_ORDER.length : aPri
          const priB = bPri < 0 ? PRIORITY_ORDER.length : bPri
          const diff = priA - priB
          if (diff !== 0) return sortDir === "asc" ? diff : -diff
        }
      } else if (sortKey === "inProgress") {
        const aDays = aMeta?.inProgressDays ?? Infinity
        const bDays = bMeta?.inProgressDays ?? Infinity
        const diff = aDays - bDays
        if (diff !== 0) return sortDir === "asc" ? diff : -diff
      } else {
        const byValue = (bMeta?.inventoryValueEur ?? 0) - (aMeta?.inventoryValueEur ?? 0)
        if (byValue !== 0) return sortDir === "asc" ? -byValue : byValue
      }
      // Tie-breaker: by priority (P1 first) then suggested date
      const aRow = rowById.get(aId)
      const bRow = rowById.get(bId)
      if (aRow && bRow) {
        const aPri = PRIORITY_ORDER.indexOf(resolveOpportunityPriority(aRow, now))
        const bPri = PRIORITY_ORDER.indexOf(resolveOpportunityPriority(bRow, now))
        const priA = aPri < 0 ? PRIORITY_ORDER.length : aPri
        const priB = bPri < 0 ? PRIORITY_ORDER.length : bPri
        if (priA !== priB) return priA - priB
      }
      return (aMeta?.suggestedDateTime ?? Infinity) - (bMeta?.suggestedDateTime ?? Infinity)
    })
  }, [rows, rowMeta, sortKey, sortDir, rowById, now])

  const displayedRowIds =
    maxRows != null ? sortedRowIds.slice(0, maxRows) : sortedRowIds

  const orderGroups = React.useMemo(() => {
    const map = new Map<string, Opportunity[]>()
    for (const r of rows) {
      const key = r.orderNumber?.trim() || "—"
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    const sorted = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
    sorted.forEach(([, groupRows]) => {
      groupRows.sort((a, b) => {
        const aId = sortedRowIds.indexOf(a.id)
        const bId = sortedRowIds.indexOf(b.id)
        return aId - bId
      })
    })
    return sorted
  }, [rows, sortedRowIds])

  const assigneeOptions = React.useMemo(() => {
    const values = Array.from(
      new Set(
        allRows
          .map((r) => r.assignee)
          .filter((value) => value && value !== "—" && value !== "–")
      )
    )
    values.sort((a, b) => a.localeCompare(b))
    return [EMPTY_OPTION, ...values]
  }, [allRows])

  const teamOptions = React.useMemo(() => [EMPTY_OPTION, ...TEAM_OPTIONS], [])

  const selectedIds = React.useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected]
  )

  const selectedCount = selectedIds.length
  const selectedRows = rows.filter((r) => selectedIds.includes(r.id))
  const selectedSnoozedCount = selectedRows.filter((r) => r.status === "Snoozed").length
  const selectedActiveCount = selectedRows.length - selectedSnoozedCount
  const selectedPushOutIds = selectedRows
    .filter((r) => r.suggestedAction === "Push Out")
    .map((r) => r.id)

  const showSnackbar = React.useCallback((message: string) => {
    setSnackbarMessage(message)
    setSnackbarOpen(true)
    window.setTimeout(() => setSnackbarOpen(false), 3500)
  }, [])

  const statusSummary = React.useMemo(() => {
    if (!showSummary) return null
    const summary = {
      Backlog: { count: 0, total: 0 },
      "To Do": { count: 0, total: 0 },
      "In Progress": { count: 0, total: 0 },
      Done: { count: 0, total: 0 },
      Canceled: { count: 0, total: 0 },
      Snoozed: { count: 0, total: 0 },
    } as Record<string, { count: number; total: number }>

    rows.forEach((row) => {
      const entry = summary[row.status] ?? { count: 0, total: 0 }
      entry.count += 1
      entry.total += rowMeta.get(row.id)?.inventoryValueEur ?? 0
      summary[row.status] = entry
    })

    const nonSnoozedTotal = Object.entries(summary)
      .filter(([status]) => status !== "Snoozed")
      .reduce((sum, [, entry]) => sum + entry.total, 0)

    return { summary, nonSnoozedTotal }
  }, [rows, rowMeta, showSummary])

  const toggleAll = (checked: boolean) => {
    if (!checked) return setSelected({})
    const next: Record<string, boolean> = {}
    rows.forEach((r) => (next[r.id] = true))
    setSelected(next)
  }

  const snoozeSelected = () => {
    snoozeByIds(selectedIds)
    setSelected({})
    setOpenSnooze(false)
  }  

  const unsnoozeSelected = () => {
    unsnoozeByIds(selectedIds)
    setSelected({})
    setOpenUnsnooze(false)
  }

  const applyPushOutSelected = () => {
    applyPushOutByIds(selectedPushOutIds)
    setSelected({})
    showSnackbar("Date updated successfully! The ticket is now marked as Done.")
  }

  const allChecked = rows.length > 0 && selectedCount === rows.length
  const indeterminate = selectedCount > 0 && selectedCount < rows.length

  return (
    <div className="space-y-3">
      {showToolbar && showSummary && statusSummary ? (
        <div className="rounded-xl border bg-background p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {(
                ["Backlog", "To Do", "In Progress", "Done", "Canceled", "Snoozed"] as const
              ).map((status, idx) => (
                <React.Fragment key={status}>
                  {idx > 0 ? <Separator orientation="vertical" className="h-5" /> : null}
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{status}</span>
                    <span className="text-muted-foreground">{statusSummary.summary[status].count}</span>
                    <span className="text-muted-foreground">
                      ({formatEurCompact(statusSummary.summary[status].total)})
                    </span>
                  </div>
                </React.Fragment>
              ))}
              <Separator orientation="vertical" className="h-5" />
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">Non-snoozed total</span>
                <span className="text-muted-foreground">
                  {formatEurCompact(statusSummary.nonSnoozedTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Action bar */}
      {showToolbar && selectedCount > 0 && (
        <div
          className={`sticky ${actionBarOffsetClass} z-10 flex items-center justify-between rounded-xl border bg-background px-4 py-3 shadow-sm ${actionBarClassName}`}
        >
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{selectedCount}</span>{" "}
            selected
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" className="h-9" onClick={() => setOpenStatus(true)}>
              Set status
            </Button>
            <Button
              variant="secondary"
              className="h-9"
              onClick={applyPushOutSelected}
              disabled={selectedPushOutIds.length === 0}
            >
              Apply push out
            </Button>
            {selectedActiveCount > 0 && (
              <Button variant="secondary" className="h-9" onClick={() => setOpenSnooze(true)}>
                Snooze
              </Button>
            )}
            {selectedSnoozedCount > 0 && (
              <Button variant="secondary" className="h-9" onClick={() => setOpenUnsnooze(true)}>
                Unsnooze
              </Button>
            )}
          </div>
        </div>
      )}

      <div
        className={`rounded-xl border bg-background overflow-hidden ${
          showToolbar && selectedCount > 0 ? actionBarGapClass : ""
        }`}
      >
        {opportunityTypeView === "all" ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[48px]">
                  <Checkbox
                    checked={allChecked ? true : indeterminate ? "indeterminate" : false}
                    onCheckedChange={(v) => toggleAll(Boolean(v))}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Opportunity type</TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => {
                      if (sortKey !== "timeToAct") {
                        setSortKey("timeToAct")
                        setSortDir("asc")
                        return
                      }
                      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
                    }}
                    className="inline-flex items-center gap-1 text-left font-medium"
                  >
                    Time to Act
                    <ArrowDown
                      className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                        sortKey === "timeToAct" && sortDir === "asc" ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => {
                      if (sortKey !== "priority") {
                        setSortKey("priority")
                        setSortDir("asc")
                        return
                      }
                      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
                    }}
                    className="inline-flex items-center gap-1 text-left font-medium"
                  >
                    Priority
                    <ArrowDown
                      className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                        sortKey === "priority" && sortDir === "asc" ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button
                    type="button"
                    onClick={() => {
                      if (sortKey !== "inventory") {
                        setSortKey("inventory")
                        setSortDir("desc")
                        return
                      }
                      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
                    }}
                    className="inline-flex items-center gap-1 text-right font-medium"
                  >
                    Value
                    <ArrowDown
                      className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                        sortKey === "inventory" && sortDir === "asc" ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Order number</TableHead>
                <TableHead>Esc.</TableHead>
                <TableHead>Part Name</TableHead>
                <TableHead>Part Number</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedRowIds.map((rowId) => {
                const r = rowById.get(rowId)
                if (!r) return null
                const meta = rowMeta.get(r.id)
                return (
                  <TableRow key={r.id} className={r.status === "Snoozed" ? "opacity-60" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={!!selected[r.id]}
                        onCheckedChange={(v) =>
                          setSelected((prev) => ({ ...prev, [r.id]: Boolean(v) }))
                        }
                        aria-label={`Select ${r.orderNumber}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{r.suggestedAction}</TableCell>
                    <TableCell>
                      <TimeToActBadge days={meta?.timeToActDays ?? null} />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={resolveOpportunityPriority(r, now)}
                        onValueChange={(value) =>
                          setPriorityByIds([r.id], value as OpportunityPriority)
                        }
                      >
                        <SelectTrigger className="h-8 w-[110px] border-0 bg-transparent px-2 text-xs font-semibold shadow-none hover:bg-muted/40 data-[state=open]:bg-muted/60">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="start">
                          {PRIORITY_ORDER.map((priority) => (
                            <SelectItem key={priority} value={priority}>
                              <PriorityBadge value={priority} />
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatEurCompact(meta?.inventoryValueEur ?? 0)}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={r.status}
                        onValueChange={(value) => {
                          const nextStatus = value as Opportunity["status"]
                          startTransition(() => setStatusByIds([r.id], nextStatus))
                        }}
                      >
                        <SelectTrigger className="h-8 w-[150px] rounded-full border bg-muted/40 px-2 text-xs font-semibold shadow-none hover:bg-muted/60 data-[state=open]:bg-muted/70">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="start">
                          <SelectItem value="Backlog"><StatusLabel status="Backlog" /></SelectItem>
                          <SelectItem value="To Do"><StatusLabel status="To Do" /></SelectItem>
                          <SelectItem value="In Progress"><StatusLabel status="In Progress" /></SelectItem>
                          <SelectItem value="Done"><StatusLabel status="Done" /></SelectItem>
                          <SelectItem value="Canceled"><StatusLabel status="Canceled" /></SelectItem>
                          <SelectItem value="Snoozed"><StatusLabel status="Snoozed" /></SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={r.team || EMPTY_OPTION}
                        onValueChange={(value) =>
                          setTeamByIds([r.id], value === EMPTY_OPTION ? "" : value)
                        }
                      >
                        <SelectTrigger className="h-8 w-[180px] border-0 bg-transparent px-2 text-sm shadow-none hover:bg-muted/40 data-[state=open]:bg-muted/60">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent align="start">
                          {teamOptions.map((team) => (
                            <SelectItem key={team} value={team}>
                              {team === EMPTY_OPTION ? "—" : team}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={r.assignee || EMPTY_OPTION}
                        onValueChange={(value) =>
                          setAssigneeByIds([r.id], value === EMPTY_OPTION ? "" : value)
                        }
                      >
                        <SelectTrigger className="h-8 w-[160px] border-0 bg-transparent px-2 text-sm shadow-none hover:bg-muted/40 data-[state=open]:bg-muted/60">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent align="start">
                          {assigneeOptions.map((assignee) => (
                            <SelectItem key={assignee} value={assignee}>
                              {assignee === EMPTY_OPTION ? "—" : assignee}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="font-medium text-blue-700 hover:text-blue-900"
                        onClick={() => {
                          setPanelRow(r)
                          setOpenPanel(true)
                        }}
                      >
                        {r.orderNumber}
                      </button>
                    </TableCell>
                    <TableCell>
                      {escalationTickets[r.partNumber] ? (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTicket(escalationTickets[r.partNumber] ?? null)
                            setOpenTicketPanel(true)
                          }}
                          className="inline-flex"
                          aria-label="View ticket"
                        >
                          <Badge className={ticketBadgeClass(escalationTickets[r.partNumber]!.level)}>
                            L{escalationTickets[r.partNumber]!.level}
                          </Badge>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
                          onClick={() => {
                            const ticket: EscalationTicket = {
                              id: `TCK-${1000 + Number(r.id.replace(/\D/g, ""))}`,
                              level: 1,
                              createdAt: new Date().toISOString(),
                              team: r.team || "Supply",
                              partName: r.partName,
                              partNumber: r.partNumber,
                              description: "Escalation ticket created for part review.",
                            }
                            upsertEscalationTicket(ticket)
                            setActiveTicket(ticket)
                            setOpenTicketPanel(true)
                          }}
                          aria-label="Create ticket"
                        >
                          <Files className="h-4 w-4 text-muted-foreground" />
                        </button>
                      )}
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="font-medium text-blue-700 hover:text-blue-900"
                        onClick={() => {
                          setPanelRow(r)
                          setOpenPanel(true)
                        }}
                      >
                        {r.partName}
                      </button>
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="font-medium text-blue-700 hover:text-blue-900"
                        onClick={() => {
                          setPanelRow(r)
                          setOpenPanel(true)
                        }}
                      >
                        {r.partNumber}
                      </button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : opportunityTypeView === "sto" ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[48px]">
                  <Checkbox
                    checked={allChecked ? true : indeterminate ? "indeterminate" : false}
                    onCheckedChange={(v) => toggleAll(Boolean(v))}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Opportunity type</TableHead>
                <TableHead>Part Name</TableHead>
                <TableHead>Part Number</TableHead>
                <TableHead>Current Storage location</TableHead>
                <TableHead>Target Storage location</TableHead>
                <TableHead>Date of the STO</TableHead>
                <TableHead className="text-right">
                  <button
                    type="button"
                    onClick={() => {
                      if (sortKey !== "inventory") {
                        setSortKey("inventory")
                        setSortDir("desc")
                        return
                      }
                      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
                    }}
                    className="inline-flex items-center gap-1 text-right font-medium"
                  >
                    Value
                    <ArrowDown
                      className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                        sortKey === "inventory" && sortDir === "asc" ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => {
                      if (sortKey !== "timeToAct") {
                        setSortKey("timeToAct")
                        setSortDir("asc")
                        return
                      }
                      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
                    }}
                    className="inline-flex items-center gap-1 text-left font-medium"
                  >
                    Time to Act
                    <ArrowDown
                      className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                        sortKey === "timeToAct" && sortDir === "asc" ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => {
                      if (sortKey !== "priority") {
                        setSortKey("priority")
                        setSortDir("asc")
                        return
                      }
                      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
                    }}
                    className="inline-flex items-center gap-1 text-left font-medium"
                  >
                    Priority
                    <ArrowDown
                      className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                        sortKey === "priority" && sortDir === "asc" ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Time to Start</TableHead>
                <TableHead>In Progress</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Esc.</TableHead>
                <TableHead>Buyer code</TableHead>
                <TableHead>MRP code</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedRowIds.map((rowId) => {
                const r = rowById.get(rowId)
                if (!r) return null
                const meta = rowMeta.get(r.id)
                return (
                  <TableRow key={r.id} className={r.status === "Snoozed" ? "opacity-60" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={!!selected[r.id]}
                        onCheckedChange={(v) =>
                          setSelected((prev) => ({ ...prev, [r.id]: Boolean(v) }))
                        }
                        aria-label={`Select ${r.orderNumber}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">STO</TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="font-medium text-blue-700 hover:text-blue-900"
                        onClick={() => {
                          setPanelRow(r)
                          setOpenPanel(true)
                        }}
                      >
                        {r.partName}
                      </button>
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="font-medium text-blue-700 hover:text-blue-900"
                        onClick={() => {
                          setPanelRow(r)
                          setOpenPanel(true)
                        }}
                      >
                        {r.partNumber}
                      </button>
                    </TableCell>
                    <TableCell>{r.currentStorageLocation ?? "—"}</TableCell>
                    <TableCell>{r.targetStorageLocation ?? "—"}</TableCell>
                    <TableCell>{meta?.suggestedDateLabel ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {formatEurCompact(meta?.inventoryValueEur ?? 0)}
                    </TableCell>
                    <TableCell>
                      <TimeToActBadge days={meta?.timeToActDays ?? null} />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={resolveOpportunityPriority(r, now)}
                        onValueChange={(value) =>
                          setPriorityByIds([r.id], value as OpportunityPriority)
                        }
                      >
                        <SelectTrigger className="h-8 w-[110px] border-0 bg-transparent px-2 text-xs font-semibold shadow-none hover:bg-muted/40 data-[state=open]:bg-muted/60">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="start">
                          {PRIORITY_ORDER.map((priority) => (
                            <SelectItem key={priority} value={priority}>
                              <PriorityBadge value={priority} />
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge className={`border border-transparent ${ageColorClass(meta?.ageDays ?? null)}`}>
                        {meta?.ageDays != null ? formatAgeDuration(meta.ageDays * 86400000) : "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {meta?.timeToStartDays == null ? (
                        <span className="text-sm text-muted-foreground">—</span>
                      ) : (
                        <Badge className={`border border-transparent ${waitColorClass(meta.timeToStartDays)}`}>
                          <span className="inline-flex items-center gap-1">
                            {r.status === "To Do" ? (
                              <Clock className="h-3 w-3" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )}
                            {formatAgeDuration(meta.timeToStartDays * 86400000)}
                          </span>
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {meta?.inProgressDays == null ? (
                        <span className="text-sm text-muted-foreground">—</span>
                      ) : (
                        <Badge className={`border border-transparent ${inProgressColorClass(meta.inProgressDays)}`}>
                          {formatAgeDuration(meta.inProgressDays * 86400000)}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={r.status}
                        onValueChange={(value) => {
                          const nextStatus = value as Opportunity["status"]
                          startTransition(() => setStatusByIds([r.id], nextStatus))
                        }}
                      >
                        <SelectTrigger className="h-8 w-[150px] rounded-full border bg-muted/40 px-2 text-xs font-semibold shadow-none hover:bg-muted/60 data-[state=open]:bg-muted/70">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="start">
                          <SelectItem value="Backlog"><StatusLabel status="Backlog" /></SelectItem>
                          <SelectItem value="To Do"><StatusLabel status="To Do" /></SelectItem>
                          <SelectItem value="In Progress"><StatusLabel status="In Progress" /></SelectItem>
                          <SelectItem value="Done"><StatusLabel status="Done" /></SelectItem>
                          <SelectItem value="Canceled"><StatusLabel status="Canceled" /></SelectItem>
                          <SelectItem value="Snoozed"><StatusLabel status="Snoozed" /></SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={r.team || EMPTY_OPTION}
                        onValueChange={(value) =>
                          setTeamByIds([r.id], value === EMPTY_OPTION ? "" : value)
                        }
                      >
                        <SelectTrigger className="h-8 w-[180px] border-0 bg-transparent px-2 text-sm shadow-none hover:bg-muted/40 data-[state=open]:bg-muted/60">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent align="start">
                          {teamOptions.map((team) => (
                            <SelectItem key={team} value={team}>
                              {team === EMPTY_OPTION ? "—" : team}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={r.assignee || EMPTY_OPTION}
                        onValueChange={(value) =>
                          setAssigneeByIds([r.id], value === EMPTY_OPTION ? "" : value)
                        }
                      >
                        <SelectTrigger className="h-8 w-[160px] border-0 bg-transparent px-2 text-sm shadow-none hover:bg-muted/40 data-[state=open]:bg-muted/60">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent align="start">
                          {assigneeOptions.map((assignee) => (
                            <SelectItem key={assignee} value={assignee}>
                              {assignee === EMPTY_OPTION ? "—" : assignee}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="font-medium text-blue-700 hover:text-blue-900"
                        onClick={() => {
                          setPanelRow(r)
                          setOpenPanel(true)
                        }}
                      >
                        {r.orderNumber}
                      </button>
                    </TableCell>
                    <TableCell>
                      {escalationTickets[r.partNumber] ? (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTicket(escalationTickets[r.partNumber] ?? null)
                            setOpenTicketPanel(true)
                          }}
                          className="inline-flex"
                          aria-label="View ticket"
                        >
                          <Badge className={ticketBadgeClass(escalationTickets[r.partNumber]!.level)}>
                            L{escalationTickets[r.partNumber]!.level}
                          </Badge>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
                          onClick={() => {
                            const ticket: EscalationTicket = {
                              id: `TCK-${1000 + Number(r.id.replace(/\D/g, ""))}`,
                              level: 1,
                              createdAt: new Date().toISOString(),
                              team: r.team || "Supply",
                              partName: r.partName,
                              partNumber: r.partNumber,
                              description: "Escalation ticket created for part review.",
                            }
                            upsertEscalationTicket(ticket)
                            setActiveTicket(ticket)
                            setOpenTicketPanel(true)
                          }}
                          aria-label="Create ticket"
                        >
                          <Files className="h-4 w-4 text-muted-foreground" />
                        </button>
                      )}
                    </TableCell>
                    <TableCell>{r.buyerCode}</TableCell>
                    <TableCell>{r.mrpCode}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : opportunityTypeView === "scrap-sell" ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[48px]">
                  <Checkbox
                    checked={allChecked ? true : indeterminate ? "indeterminate" : false}
                    onCheckedChange={(v) => toggleAll(Boolean(v))}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Opportunity type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plant</TableHead>
                <TableHead>Esc.</TableHead>
                <TableHead>Part Name</TableHead>
                <TableHead>Part Number</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">
                  <button
                    type="button"
                    onClick={() => {
                      if (sortKey !== "inventory") {
                        setSortKey("inventory")
                        setSortDir("desc")
                        return
                      }
                      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
                    }}
                    className="inline-flex items-center gap-1 text-right font-medium"
                  >
                    Value
                    <ArrowDown
                      className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                        sortKey === "inventory" && sortDir === "asc" ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => {
                      if (sortKey !== "timeToAct") {
                        setSortKey("timeToAct")
                        setSortDir("asc")
                        return
                      }
                      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
                    }}
                    className="inline-flex items-center gap-1 text-left font-medium"
                  >
                    Time to Act
                    <ArrowDown
                      className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                        sortKey === "timeToAct" && sortDir === "asc" ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => {
                      if (sortKey !== "priority") {
                        setSortKey("priority")
                        setSortDir("asc")
                        return
                      }
                      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
                    }}
                    className="inline-flex items-center gap-1 text-left font-medium"
                  >
                    Priority
                    <ArrowDown
                      className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                        sortKey === "priority" && sortDir === "asc" ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Time to Start</TableHead>
                <TableHead>In Progress</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Assignee</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedRowIds.map((rowId) => {
                const r = rowById.get(rowId)
                if (!r) return null
                const meta = rowMeta.get(r.id)
                const scrapSellStatus = r.scrapSellStatus ?? "New"
                return (
                  <TableRow key={r.id} className={r.status === "Snoozed" ? "opacity-60" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={!!selected[r.id]}
                        onCheckedChange={(v) =>
                          setSelected((prev) => ({ ...prev, [r.id]: Boolean(v) }))
                        }
                        aria-label={`Select ${r.orderNumber}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">Scrap/Sell</TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{scrapSellStatus}</span>
                    </TableCell>
                    <TableCell>{r.plant}</TableCell>
                    <TableCell>
                      {escalationTickets[r.partNumber] ? (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTicket(escalationTickets[r.partNumber] ?? null)
                            setOpenTicketPanel(true)
                          }}
                          className="inline-flex"
                          aria-label="View ticket"
                        >
                          <Badge className={ticketBadgeClass(escalationTickets[r.partNumber]!.level)}>
                            L{escalationTickets[r.partNumber]!.level}
                          </Badge>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
                          onClick={() => {
                            const ticket: EscalationTicket = {
                              id: `TCK-${1000 + Number(r.id.replace(/\D/g, ""))}`,
                              level: 1,
                              createdAt: new Date().toISOString(),
                              team: r.team || "Supply",
                              partName: r.partName,
                              partNumber: r.partNumber,
                              description: "Escalation ticket created for part review.",
                            }
                            upsertEscalationTicket(ticket)
                            setActiveTicket(ticket)
                            setOpenTicketPanel(true)
                          }}
                          aria-label="Create ticket"
                        >
                          <Files className="h-4 w-4 text-muted-foreground" />
                        </button>
                      )}
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="font-medium text-blue-700 hover:text-blue-900"
                        onClick={() => {
                          setPanelRow(r)
                          setOpenPanel(true)
                        }}
                      >
                        {r.partName}
                      </button>
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="font-medium text-blue-700 hover:text-blue-900"
                        onClick={() => {
                          setPanelRow(r)
                          setOpenPanel(true)
                        }}
                      >
                        {r.partNumber}
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm">
                        {r.quantity != null ? r.quantity.toLocaleString() : "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatEurCompact(meta?.inventoryValueEur ?? 0)}
                    </TableCell>
                    <TableCell>
                      <TimeToActBadge days={meta?.timeToActDays ?? null} />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={resolveOpportunityPriority(r, now)}
                        onValueChange={(value) =>
                          setPriorityByIds([r.id], value as OpportunityPriority)
                        }
                      >
                        <SelectTrigger className="h-8 w-[110px] border-0 bg-transparent px-2 text-xs font-semibold shadow-none hover:bg-muted/40 data-[state=open]:bg-muted/60">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="start">
                          {PRIORITY_ORDER.map((priority) => (
                            <SelectItem key={priority} value={priority}>
                              <PriorityBadge value={priority} />
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge className={`border border-transparent ${ageColorClass(meta?.ageDays ?? null)}`}>
                        {meta?.ageDays != null ? formatAgeDuration(meta.ageDays * 86400000) : "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {meta?.timeToStartDays == null ? (
                        <span className="text-sm text-muted-foreground">—</span>
                      ) : (
                        <Badge className={`border border-transparent ${waitColorClass(meta.timeToStartDays)}`}>
                          <span className="inline-flex items-center gap-1">
                            {r.status === "To Do" ? (
                              <Clock className="h-3 w-3" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )}
                            {formatAgeDuration(meta.timeToStartDays * 86400000)}
                          </span>
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {meta?.inProgressDays == null ? (
                        <span className="text-sm text-muted-foreground">—</span>
                      ) : (
                        <Badge className={`border border-transparent ${inProgressColorClass(meta.inProgressDays)}`}>
                          {formatAgeDuration(meta.inProgressDays * 86400000)}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={r.status}
                        onValueChange={(value) => {
                          const nextStatus = value as Opportunity["status"]
                          startTransition(() => setStatusByIds([r.id], nextStatus))
                        }}
                      >
                        <SelectTrigger className="h-8 w-[150px] rounded-full border bg-muted/40 px-2 text-xs font-semibold shadow-none hover:bg-muted/60 data-[state=open]:bg-muted/70">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="start">
                          <SelectItem value="Backlog"><StatusLabel status="Backlog" /></SelectItem>
                          <SelectItem value="To Do"><StatusLabel status="To Do" /></SelectItem>
                          <SelectItem value="In Progress"><StatusLabel status="In Progress" /></SelectItem>
                          <SelectItem value="Done"><StatusLabel status="Done" /></SelectItem>
                          <SelectItem value="Canceled"><StatusLabel status="Canceled" /></SelectItem>
                          <SelectItem value="Snoozed"><StatusLabel status="Snoozed" /></SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={r.team || EMPTY_OPTION}
                        onValueChange={(value) =>
                          setTeamByIds([r.id], value === EMPTY_OPTION ? "" : value)
                        }
                      >
                        <SelectTrigger className="h-8 w-[180px] border-0 bg-transparent px-2 text-sm shadow-none hover:bg-muted/40 data-[state=open]:bg-muted/60">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent align="start">
                          {teamOptions.map((team) => (
                            <SelectItem key={team} value={team}>
                              {team === EMPTY_OPTION ? "—" : team}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={r.assignee || EMPTY_OPTION}
                        onValueChange={(value) =>
                          setAssigneeByIds([r.id], value === EMPTY_OPTION ? "" : value)
                        }
                      >
                        <SelectTrigger className="h-8 w-[160px] border-0 bg-transparent px-2 text-sm shadow-none hover:bg-muted/40 data-[state=open]:bg-muted/60">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent align="start">
                          {assigneeOptions.map((assignee) => (
                            <SelectItem key={assignee} value={assignee}>
                              {assignee === EMPTY_OPTION ? "—" : assignee}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : groupBy === "order" && maxRows == null ? (
          <div className="divide-y divide-border">
            {orderGroups.map(([orderNumber, groupRows]) => {
              const isCollapsed = collapsedOrders.has(orderNumber)
              return (
                <div key={orderNumber} className="first:border-t-0">
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsedOrders((prev) => {
                        const next = new Set(prev)
                        if (next.has(orderNumber)) next.delete(orderNumber)
                        else next.add(orderNumber)
                        return next
                      })
                    }
                    className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                  >
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                        isCollapsed && "-rotate-90"
                      )}
                    />
                    <Badge
                      variant="secondary"
                      className="rounded-md px-2.5 py-0.5 font-medium text-foreground"
                    >
                      {orderNumber}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {groupRows.length} {groupRows.length === 1 ? "opportunity" : "opportunities"}
                    </span>
                  </button>
                  {!isCollapsed && (
                    <div className="overflow-x-auto border-t border-border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[48px]">
                              <Checkbox
                                checked={
                                  groupRows.length > 0 &&
                                  groupRows.every((r) => selected[r.id])
                                }
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelected((prev) => {
                                      const next = { ...prev }
                                      groupRows.forEach((r) => (next[r.id] = true))
                                      return next
                                    })
                                  } else {
                                    setSelected((prev) => {
                                      const next = { ...prev }
                                      groupRows.forEach((r) => (next[r.id] = false))
                                      return next
                                    })
                                  }
                                }}
                                aria-label={`Select all in ${orderNumber}`}
                              />
                            </TableHead>
                            <TableHead>Opportunity type</TableHead>
                            <TableHead>Suggested Date</TableHead>
                            <TableHead>Delivery date</TableHead>
                            <TableHead>
                              <button
                                type="button"
                                onClick={() => {
                                  if (sortKey !== "timeToAct") {
                                    setSortKey("timeToAct")
                                    setSortDir("asc")
                                    return
                                  }
                                  setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
                                }}
                                className="inline-flex items-center gap-1 text-left font-medium"
                              >
                                Time to Act
                                <ArrowDown
                                  className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                                    sortKey === "timeToAct" && sortDir === "asc" ? "rotate-180" : ""
                                  }`}
                                />
                              </button>
                            </TableHead>
                            <TableHead>
                              <button
                                type="button"
                                onClick={() => {
                                  if (sortKey !== "priority") {
                                    setSortKey("priority")
                                    setSortDir("asc")
                                    return
                                  }
                                  setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
                                }}
                                className="inline-flex items-center gap-1 text-left font-medium"
                              >
                                Priority
                                <ArrowDown
                                  className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                                    sortKey === "priority" && sortDir === "asc" ? "rotate-180" : ""
                                  }`}
                                />
                              </button>
                            </TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Order number</TableHead>
                            <TableHead>Part Name</TableHead>
                            <TableHead>Part Number</TableHead>
                            <TableHead className="text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  if (sortKey !== "inventory") {
                                    setSortKey("inventory")
                                    setSortDir("desc")
                                    return
                                  }
                                  setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
                                }}
                                className="inline-flex items-center gap-1 text-right font-medium"
                              >
                                Value
                                <ArrowDown
                                  className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                                    sortKey === "inventory" && sortDir === "asc" ? "rotate-180" : ""
                                  }`}
                                />
                              </button>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {groupRows.map((r) => {
                            const meta = rowMeta.get(r.id)
                            return (
                              <TableRow
                                key={r.id}
                                className={r.status === "Snoozed" ? "opacity-60" : ""}
                              >
                                <TableCell>
                                  <Checkbox
                                    checked={!!selected[r.id]}
                                    onCheckedChange={(v) =>
                                      setSelected((prev) => ({
                                        ...prev,
                                        [r.id]: Boolean(v),
                                      }))
                                    }
                                    aria-label={`Select ${r.orderNumber}`}
                                  />
                                </TableCell>
                                <TableCell className="font-medium">{r.suggestedAction}</TableCell>
                                <TableCell>{meta?.suggestedDateLabel ?? ""}</TableCell>
                                <TableCell>{meta?.deliveryDateLabel ?? "—"}</TableCell>
                                <TableCell>
                                  <TimeToActBadge days={meta?.timeToActDays ?? null} />
                                </TableCell>
                                <TableCell>
                                  <Select
                                    value={resolveOpportunityPriority(r, now)}
                                    onValueChange={(value) =>
                                      setPriorityByIds([r.id], value as OpportunityPriority)
                                    }
                                  >
                                    <SelectTrigger className="h-8 w-[110px] border-0 bg-transparent px-2 text-xs font-semibold shadow-none hover:bg-muted/40 data-[state=open]:bg-muted/60">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent align="start">
                                      {PRIORITY_ORDER.map((priority) => (
                                        <SelectItem key={priority} value={priority}>
                                          <PriorityBadge value={priority} />
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <Select
                                    value={r.status}
                                    onValueChange={(value) => {
                                      const nextStatus = value as Opportunity["status"]
                                      startTransition(() => {
                                        setStatusByIds([r.id], nextStatus)
                                      })
                                    }}
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
                                </TableCell>
                                <TableCell>
                                  <button
                                    type="button"
                                    className="font-medium text-blue-700 hover:text-blue-900"
                                    onClick={() => {
                                      setPanelRow(r)
                                      setOpenPanel(true)
                                    }}
                                  >
                                    {r.orderNumber}
                                  </button>
                                </TableCell>
                                <TableCell>
                                  <button
                                    type="button"
                                    className="font-medium text-blue-700 hover:text-blue-900"
                                    onClick={() => {
                                      setPanelRow(r)
                                      setOpenPanel(true)
                                    }}
                                  >
                                    {r.partName}
                                  </button>
                                </TableCell>
                                <TableCell>
                                  <button
                                    type="button"
                                    className="font-medium text-blue-700 hover:text-blue-900"
                                    onClick={() => {
                                      setPanelRow(r)
                                      setOpenPanel(true)
                                    }}
                                  >
                                    {r.partNumber}
                                  </button>
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatEurCompact(meta?.inventoryValueEur ?? 0)}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[48px]">
                <Checkbox
                  checked={allChecked ? true : indeterminate ? "indeterminate" : false}
                  onCheckedChange={(v) => toggleAll(Boolean(v))}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Opportunity type</TableHead>
              <TableHead>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (sortKey !== "suggestedDate") {
                        setSortKey("suggestedDate")
                        setSortDir("asc")
                        return
                      }
                      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
                    }}
                    className="inline-flex items-center gap-1 text-left"
                  >
                    Suggested Date
                    <ArrowDown
                      className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                        sortKey === "suggestedDate" && sortDir === "asc" ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </div>
              </TableHead>
              <TableHead>Delivery date</TableHead>
              <TableHead>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (sortKey !== "timeToAct") {
                        setSortKey("timeToAct")
                        setSortDir("asc")
                        return
                      }
                      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
                    }}
                    className="inline-flex items-center gap-1 text-left"
                  >
                    Time to Act
                    <ArrowDown
                      className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                        sortKey === "timeToAct" && sortDir === "asc" ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground hover:bg-accent"
                          aria-label="Time to Act info"
                        >
                          i
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        Time to Act = Need date − Lead time (days) − Today.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => {
                    if (sortKey !== "priority") {
                      setSortKey("priority")
                      setSortDir("asc")
                      return
                    }
                    setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
                  }}
                  className="inline-flex items-center gap-1 text-left"
                >
                  Priority
                  <ArrowDown
                    className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                      sortKey === "priority" && sortDir === "asc" ? "rotate-180" : ""
                    }`}
                  />
                </button>
              </TableHead>
              <TableHead>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (sortKey !== "age") {
                        setSortKey("age")
                        setSortDir("desc")
                        return
                      }
                      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
                    }}
                    className="inline-flex items-center gap-1 text-left"
                  >
                    Age
                    <ArrowDown
                      className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                        sortKey === "age" && sortDir === "asc" ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground hover:bg-accent"
                          aria-label="Age info"
                        >
                          i
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Time since created/identified.</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (sortKey !== "timeToStart") {
                        setSortKey("timeToStart")
                        setSortDir("desc")
                        return
                      }
                      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
                    }}
                    className="inline-flex items-center gap-1 text-left"
                  >
                    Time to Start
                    <ArrowDown
                      className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                        sortKey === "timeToStart" && sortDir === "asc" ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground hover:bg-accent"
                          aria-label="Time to start info"
                        >
                          i
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        Time from To Do → In Progress (when applicable).
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (sortKey !== "inProgress") {
                        setSortKey("inProgress")
                        setSortDir("desc")
                        return
                      }
                      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
                    }}
                    className="inline-flex items-center gap-1 text-left"
                  >
                    In Progress
                    <ArrowDown
                      className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                        sortKey === "inProgress" && sortDir === "asc" ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground hover:bg-accent"
                          aria-label="In progress info"
                        >
                          i
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Time since In Progress started.</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => {
                    if (sortKey !== "inventory") {
                      setSortKey("inventory")
                      setSortDir("desc")
                      return
                    }
                    setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
                  }}
                  className="inline-flex items-center gap-1 text-left"
                >
                  Value
                  <ArrowDown
                    className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                      sortKey === "inventory" && sortDir === "asc" ? "rotate-180" : ""
                    }`}
                  />
                </button>
              </TableHead>
            <TableHead>Status</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Order number</TableHead>
            <TableHead>Esc.</TableHead>
              <TableHead>Part Name</TableHead>
              <TableHead>Part Number</TableHead>
              <TableHead>Plant</TableHead>
              <TableHead>Buyer code</TableHead>
              <TableHead>MRP code</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {displayedRowIds.map((rowId) => {
              const r = rowById.get(rowId)
              if (!r) return null
              const meta = rowMeta.get(r.id)
              return (
                <TableRow key={r.id} className={r.status === "Snoozed" ? "opacity-60" : ""}>
                  <TableCell>
                    <Checkbox
                      checked={!!selected[r.id]}
                      onCheckedChange={(v) =>
                        setSelected((prev) => ({ ...prev, [r.id]: Boolean(v) }))
                      }
                      aria-label={`Select ${r.orderNumber}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{r.suggestedAction}</TableCell>
                  <TableCell>{meta?.suggestedDateLabel ?? ""}</TableCell>
                  <TableCell>
                  <Popover
                    open={openDeliveryId === r.id}
                    onOpenChange={(open) => {
                      if (open) {
                        const baseDate = r.deliveryDate || r.suggestedDate
                        const parsed = new Date(baseDate)
                        setDeliveryDraft(Number.isFinite(parsed.getTime()) ? parsed : undefined)
                        setOpenDeliveryId(r.id)
                      } else {
                        setOpenDeliveryId(null)
                      }
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-muted/40"
                        aria-label="Edit delivery date"
                      >
                        <span>{meta?.deliveryDateLabel ?? "—"}</span>
                        <Pencil className="h-3.5 w-3.5 text-[#B8B8B8]" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-3">
                      <div className="space-y-3">
                        <Calendar
                          mode="single"
                          selected={deliveryDraft}
                          onSelect={(date) => {
                            if (!date) return
                            setDeliveryDraft(date)
                            setDeliveryDateByIds([r.id], toISODate(date))
                          }}
                          disabled={(date) => {
                            if (r.suggestedAction !== "Push Out") return false
                            const suggested = new Date(r.suggestedDate)
                            if (!Number.isFinite(suggested.getTime())) return false
                            return date > suggested
                          }}
                        />
                        {r.suggestedAction === "Push Out" ? (
                          <Button
                            className="h-8"
                            onClick={() => {
                              applyPushOutByIds([r.id])
                              setOpenDeliveryId(null)
                              showSnackbar(
                                "Date updated successfully! The ticket is now marked as Done."
                              )
                            }}
                          >
                            Apply push out
                          </Button>
                        ) : null}
                      </div>
                    </PopoverContent>
                  </Popover>
                </TableCell>
                <TableCell>
                  <TimeToActBadge days={meta?.timeToActDays ?? null} />
                </TableCell>
                <TableCell>
                  <Select
                    value={resolveOpportunityPriority(r, now)}
                    onValueChange={(value) =>
                      setPriorityByIds([r.id], value as OpportunityPriority)
                    }
                  >
                    <SelectTrigger className="h-8 w-[110px] border-0 bg-transparent px-2 text-xs font-semibold shadow-none hover:bg-muted/40 data-[state=open]:bg-muted/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="start">
                      {PRIORITY_ORDER.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          <PriorityBadge value={priority} />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Badge className={`border border-transparent ${ageColorClass(meta?.ageDays ?? null)}`}>
                    {meta?.ageDays != null ? formatAgeDuration(meta.ageDays * 86400000) : "—"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {meta?.timeToStartDays == null ? (
                    <span className="text-sm text-muted-foreground">—</span>
                  ) : (
                    <Badge className={`border border-transparent ${waitColorClass(meta.timeToStartDays)}`}>
                      <span className="inline-flex items-center gap-1">
                        {r.status === "To Do" ? (
                          <Clock className="h-3 w-3" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}
                        {formatAgeDuration(meta.timeToStartDays * 86400000)}
                      </span>
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {meta?.inProgressDays == null ? (
                    <span className="text-sm text-muted-foreground">—</span>
                  ) : (
                    <Badge className={`border border-transparent ${inProgressColorClass(meta.inProgressDays)}`}>
                      {formatAgeDuration(meta.inProgressDays * 86400000)}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{formatEurCompact(meta?.inventoryValueEur ?? 0)}</TableCell>
                <TableCell>
                  <Select
                    value={r.status}
                    onValueChange={(value) => {
                      const nextStatus = value as Opportunity["status"]
                      startTransition(() => {
                        setStatusByIds([r.id], nextStatus)
                      })
                      if (nextStatus === "To Do" && (!r.assignee || !r.team)) {
                        showSnackbar(
                          "Status changed to To Do. Assignee and team were assigned automatically based on the scope."
                        )
                      }
                    }}
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
                </TableCell>
                <TableCell>
                  <Select
                    value={r.team || EMPTY_OPTION}
                    onValueChange={(value) =>
                      setTeamByIds([r.id], value === EMPTY_OPTION ? "" : value)
                    }
                  >
                    <SelectTrigger className="h-8 w-[180px] border-0 bg-transparent px-2 text-sm shadow-none hover:bg-muted/40 data-[state=open]:bg-muted/60">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent align="start">
                      {teamOptions.map((team) => (
                        <SelectItem key={team} value={team}>
                          {team === EMPTY_OPTION ? "—" : team}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select
                    value={r.assignee || EMPTY_OPTION}
                    onValueChange={(value) =>
                      setAssigneeByIds([r.id], value === EMPTY_OPTION ? "" : value)
                    }
                  >
                    <SelectTrigger className="h-8 w-[160px] border-0 bg-transparent px-2 text-sm shadow-none hover:bg-muted/40 data-[state=open]:bg-muted/60">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent align="start">
                      {assigneeOptions.map((assignee) => (
                        <SelectItem key={assignee} value={assignee}>
                          {assignee === EMPTY_OPTION ? "—" : assignee}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    className="font-medium text-blue-700 hover:text-blue-900"
                    onClick={() => {
                      setPanelRow(r)
                      setOpenPanel(true)
                    }}
                  >
                    {r.orderNumber}
                  </button>
                </TableCell>
                <TableCell>
                  {escalationTickets[r.partNumber] ? (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTicket(escalationTickets[r.partNumber] ?? null)
                        setOpenTicketPanel(true)
                      }}
                      className="inline-flex"
                      aria-label="View ticket"
                    >
                      <Badge className={ticketBadgeClass(escalationTickets[r.partNumber]!.level)}>
                        L{escalationTickets[r.partNumber]!.level}
                      </Badge>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
                      onClick={() => {
                        const ticket: EscalationTicket = {
                          id: `TCK-${1000 + Number(r.id.replace(/\D/g, ""))}`,
                          level: 1,
                          createdAt: new Date().toISOString(),
                          team: r.team || "Supply",
                          partName: r.partName,
                          partNumber: r.partNumber,
                          description: "Escalation ticket created for part review.",
                        }
                        upsertEscalationTicket(ticket)
                        setActiveTicket(ticket)
                        setOpenTicketPanel(true)
                      }}
                      aria-label="Create ticket"
                    >
                      <Files className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    className="font-medium text-blue-700 hover:text-blue-900"
                    onClick={() => {
                      setPanelRow(r)
                      setOpenPanel(true)
                    }}
                  >
                    {r.partName}
                  </button>
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    className="font-medium text-blue-700 hover:text-blue-900"
                    onClick={() => {
                      setPanelRow(r)
                      setOpenPanel(true)
                    }}
                  >
                    {r.partNumber}
                  </button>
                </TableCell>
                <TableCell>{r.plant}</TableCell>
                <TableCell>{r.buyerCode}</TableCell>
                <TableCell>{r.mrpCode}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        )}

        {openPanel && panelRow ? (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/10"
              onClick={() => setOpenPanel(false)}
            />
            <aside className="fixed right-0 top-0 bottom-0 z-50 w-[420px] max-w-full bg-white shadow-xl">
              <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Opportunity</div>
                  <div className="text-lg font-semibold text-foreground">
                    {panelRow.orderNumber} • {supplyTypeLabel(panelRow.supplyType)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {panelRow.partNumber} — {panelRow.partName}
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-md p-2 text-muted-foreground hover:bg-muted"
                  onClick={() => setOpenPanel(false)}
                  aria-label="Close panel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="h-full overflow-y-auto px-5 py-4">
                <div className="space-y-4">
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground">Details</div>
                    <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-muted-foreground">Status</div>
                        <div className="text-foreground">{panelRow.status}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Opportunity type</div>
                        <div className="text-foreground">{panelRow.suggestedAction}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Suggested date</div>
                        <div className="text-foreground">
                          {panelRow.suggestedAction === "Cancel" || !panelRow.suggestedDate
                            ? "—"
                            : format(new Date(panelRow.suggestedDate), "MMM d, yyyy")}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Value</div>
                        <div className="text-foreground">
                          {formatEurCompact(
                            useRawInventoryValue
                              ? panelRow.cashImpactEur
                              : Math.round(panelRow.cashImpactEur * scale)
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Assignee</div>
                        <div className="text-foreground">{panelRow.assignee || "—"}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Team</div>
                        <div className="text-foreground">{panelRow.team || "—"}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Plant</div>
                        <div className="text-foreground">{panelRow.plant}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Buyer code</div>
                        <div className="text-foreground">{panelRow.buyerCode}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">MRP code</div>
                        <div className="text-foreground">{panelRow.mrpCode}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Supplier</div>
                        <div className="text-foreground">{panelRow.supplier}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Customer</div>
                        <div className="text-foreground">{panelRow.customer}</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-muted-foreground">Comments</div>
                    <div className="mt-2 space-y-3">
                      {(commentsById[panelRow.id] ?? []).length === 0 ? (
                        <div className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
                          No comments yet.
                        </div>
                      ) : (
                        (commentsById[panelRow.id] ?? []).map((comment) => (
                          <div key={comment.id} className="rounded-md border bg-background p-3 text-sm">
                            <div className="flex items-center justify-between">
                              <div className="font-medium text-foreground">You</div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(comment.createdAt), "MMM d, yyyy HH:mm")}
                              </div>
                            </div>
                            <div className="mt-1 text-muted-foreground">{comment.text}</div>
                          </div>
                        ))
                      )}

                      <div className="rounded-md border bg-background p-3 text-sm">
                        <label className="text-xs font-semibold text-muted-foreground">Add comment</label>
                        <textarea
                          className="mt-2 w-full rounded-md border border-border p-2 text-sm"
                          rows={3}
                          value={commentDraft}
                          onChange={(e) => setCommentDraft(e.target.value)}
                          placeholder="Write a comment..."
                        />
                        <div className="mt-2 flex justify-end">
                          <Button
                            className="h-8"
                            onClick={() => {
                              const text = commentDraft.trim()
                              if (!text) return
                              setCommentsById((prev) => ({
                                ...prev,
                                [panelRow.id]: [
                                  ...(prev[panelRow.id] ?? []),
                                  {
                                    id: `${Date.now()}`,
                                    text,
                                    createdAt: new Date().toISOString(),
                                  },
                                ],
                              }))
                              setCommentDraft("")
                            }}
                          >
                            Add comment
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </>
        ) : null}

        {openTicketPanel && activeTicket ? (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/10"
              onClick={() => setOpenTicketPanel(false)}
            />
            <aside className="fixed right-0 top-0 bottom-0 z-50 w-[420px] max-w-full bg-white shadow-xl">
              <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Ticket</div>
                  <div className="text-lg font-semibold text-foreground">{activeTicket.id}</div>
                  <div className="text-sm text-muted-foreground">
                    {activeTicket.partNumber} — {activeTicket.partName}
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-md p-2 text-muted-foreground hover:bg-muted"
                  onClick={() => setOpenTicketPanel(false)}
                  aria-label="Close panel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="h-full overflow-y-auto px-5 py-4">
                <div className="space-y-4">
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground">Details</div>
                    <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-muted-foreground">Creation date</div>
                        <div className="text-foreground">
                          {format(new Date(activeTicket.createdAt), "MMM d, yyyy HH:mm")}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Team</div>
                        <div className="text-foreground">{activeTicket.team}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Ticket level</div>
                        <select
                          className="h-9 rounded-md border border-border bg-white px-2 text-sm text-foreground"
                          value={activeTicket.level}
                          onChange={(e) => {
                            const nextLevel = Number(e.target.value) as EscalationTicket["level"]
                            setActiveTicket((prev) =>
                              prev ? { ...prev, level: nextLevel } : prev
                            )
                            if (activeTicket) {
                              upsertEscalationTicket({
                                ...activeTicket,
                                level: nextLevel,
                              })
                            }
                          }}
                        >
                          <option value={1}>Level 1</option>
                          <option value={2}>Level 2</option>
                          <option value={3}>Level 3</option>
                          <option value={4}>Level 4</option>
                        </select>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Part</div>
                        <div className="text-foreground">
                          {activeTicket.partNumber} — {activeTicket.partName}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-muted-foreground">Description</div>
                        <div className="text-foreground">{activeTicket.description}</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-muted-foreground">Comments</div>
                    <div className="mt-2 space-y-3">
                      {(ticketComments[activeTicket.id] ?? []).length === 0 ? (
                        <div className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
                          No comments yet.
                        </div>
                      ) : (
                        (ticketComments[activeTicket.id] ?? []).map((comment) => (
                          <div key={comment.id} className="rounded-md border bg-background p-3 text-sm">
                            <div className="flex items-center justify-between">
                              <div className="font-medium text-foreground">You</div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(comment.createdAt), "MMM d, yyyy HH:mm")}
                              </div>
                            </div>
                            <div className="mt-1 text-muted-foreground">{comment.text}</div>
                          </div>
                        ))
                      )}

                      <div className="rounded-md border bg-background p-3 text-sm">
                        <label className="text-xs font-semibold text-muted-foreground">Add comment</label>
                        <textarea
                          className="mt-2 w-full rounded-md border border-border p-2 text-sm"
                          rows={3}
                          value={ticketCommentDraft}
                          onChange={(e) => setTicketCommentDraft(e.target.value)}
                          placeholder="Write a comment..."
                        />
                        <div className="mt-2 flex justify-end">
                          <Button
                            className="h-8"
                            onClick={() => {
                              const text = ticketCommentDraft.trim()
                              if (!text) return
                              setTicketComments((prev) => ({
                                ...prev,
                                [activeTicket.id]: [
                                  ...(prev[activeTicket.id] ?? []),
                                  {
                                    id: `${Date.now()}`,
                                    text,
                                    createdAt: new Date().toISOString(),
                                  },
                                ],
                              }))
                              setTicketCommentDraft("")
                            }}
                          >
                            Add comment
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </>
        ) : null}
      </div>

      {snackbarOpen ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border bg-white px-4 py-2 text-sm text-foreground shadow-lg">
          <span className="inline-flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600" />
            {snackbarMessage}
          </span>
        </div>
      ) : null}

      {/* Snooze modal */}
      <Dialog open={openSnooze} onOpenChange={setOpenSnooze}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Snooze opportunities</DialogTitle>
            <DialogDescription>
              Snoozing marks these opportunities as <span className="font-medium">not actionable right now</span>.
              They’ll be moved to <span className="font-medium">Snoozed</span> so they stop appearing in your active list.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setOpenSnooze(false)}>
              Cancel
            </Button>
            <Button onClick={snoozeSelected}>Snooze</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openUnsnooze} onOpenChange={setOpenUnsnooze}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unsnooze opportunities</DialogTitle>
            <DialogDescription>
              Unsnoozing returns these opportunities to your active list.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setOpenUnsnooze(false)}>
              Cancel
            </Button>
            <Button onClick={unsnoozeSelected}>Unsnooze</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Dialog open={openStatus} onOpenChange={setOpenStatus}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set status</DialogTitle>
            <DialogDescription>
              Apply a new status to the selected opportunities.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2">
            <Select
              value={bulkStatus}
              onValueChange={(value) => setBulkStatus(value as Opportunity["status"])}
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
            <Button variant="ghost" onClick={() => setOpenStatus(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                startTransition(() => {
                  setStatusByIds(selectedIds, bulkStatus)
                })
                setSelected({})
                setOpenStatus(false)
                if (
                  bulkStatus === "To Do" &&
                  selectedRows.some((row) => !row.assignee || !row.team)
                ) {
                  showSnackbar(
                    "Status changed to To Do. Assignee and team were assigned automatically based on the scope."
                  )
                }
              }}
            >
              Apply status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
