"use client"

import * as React from "react"
import { format } from "date-fns"
import {
  applyOpportunityFilters,
  useFilteredOpportunities,
  useInventoryData,
} from "@/components/inventory/inventory-data-provider"
import type { Opportunity } from "@/lib/inventory/types"
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
  CircleCheckBig,
  CircleDashed,
  CircleDotDashed,
  Clock,
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
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export type OpportunitiesTableFilter =
  | { kind: "type"; category: string }
  | { kind: "status"; category: string }
  | { kind: "concentration"; category: string }
  | null

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
    className: "bg-emerald-100 text-emerald-700 border border-emerald-200",
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

function StatusLabel({ status }: { status: string }) {
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
}) {
  const {
    snoozeByIds,
    unsnoozeByIds,
    setStatusByIds,
    setAssigneeByIds,
    setTeamByIds,
    setDeliveryDateByIds,
    applyPushOutByIds,
    dateRange,
    plan,
    opportunities,
    filters,
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
    res = applyOpportunityFilters(res, filters)
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
  const filteredRows = React.useMemo(() => {
    let res = scopedAll
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
    if (statusFilter) {
      res = res.filter((o) => o.status === statusFilter)
    }
    if (teamFilter) {
      res = res.filter((o) => o.team === teamFilter)
    }
    return res
  }, [scopedAll, scopedBase, filter, statusFilter, teamFilter])

  const rows = filteredRows
  const displayRows = React.useMemo(() => {
    const scaled = rows.map((row) => ({
      ...row,
      inventoryValueEur: useRawInventoryValue
        ? row.cashImpactEur
        : Math.round(row.cashImpactEur * scale),
    }))
    return scaled.sort((a, b) => {
      const byValue = b.inventoryValueEur - a.inventoryValueEur
      if (byValue !== 0) return byValue
      const aTime = Number.isFinite(new Date(a.suggestedDate).getTime())
        ? new Date(a.suggestedDate).getTime()
        : Infinity
      const bTime = Number.isFinite(new Date(b.suggestedDate).getTime())
        ? new Date(b.suggestedDate).getTime()
        : Infinity
      return aTime - bTime
    })
  }, [rows, scale, useRawInventoryValue])

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

  const [selected, setSelected] = React.useState<Record<string, boolean>>({})
  const [openSnooze, setOpenSnooze] = React.useState(false)
  const [openUnsnooze, setOpenUnsnooze] = React.useState(false)
  const [openStatus, setOpenStatus] = React.useState(false)
  const [bulkStatus, setBulkStatus] = React.useState<Opportunity["status"]>("Backlog")
  const [openPanel, setOpenPanel] = React.useState(false)
  const [panelRow, setPanelRow] = React.useState<Opportunity | null>(null)
  const [openDeliveryId, setOpenDeliveryId] = React.useState<string | null>(null)
  const [deliveryDraft, setDeliveryDraft] = React.useState<Date | undefined>(undefined)
  const [snackbarOpen, setSnackbarOpen] = React.useState(false)

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

  const showPushOutSnackbar = React.useCallback(() => {
    setSnackbarOpen(true)
    window.setTimeout(() => setSnackbarOpen(false), 3500)
  }, [])

  const statusSummary = React.useMemo(() => {
    const summary = {
      Backlog: { count: 0, total: 0 },
      "To Do": { count: 0, total: 0 },
      "In Progress": { count: 0, total: 0 },
      Done: { count: 0, total: 0 },
      Canceled: { count: 0, total: 0 },
      Snoozed: { count: 0, total: 0 },
    } as Record<string, { count: number; total: number }>

    displayRows.forEach((row) => {
      const entry = summary[row.status] ?? { count: 0, total: 0 }
      entry.count += 1
      entry.total += row.inventoryValueEur
      summary[row.status] = entry
    })

    const nonSnoozedTotal = Object.entries(summary)
      .filter(([status]) => status !== "Snoozed")
      .reduce((sum, [, entry]) => sum + entry.total, 0)

    return { summary, nonSnoozedTotal }
  }, [displayRows])

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
    showPushOutSnackbar()
  }

  const allChecked = rows.length > 0 && selectedCount === rows.length
  const indeterminate = selectedCount > 0 && selectedCount < rows.length

  return (
    <div className="space-y-3">
      {showToolbar && showSummary ? (
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
        <div className="sticky top-[72px] z-10 flex items-center justify-between rounded-xl border bg-background px-4 py-3 shadow-sm">
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

      <div className="rounded-xl border bg-background overflow-hidden">
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
                  Suggested Date
                  <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </TableHead>
              <TableHead>Delivery date</TableHead>
              <TableHead>
                <div className="flex items-center gap-1">
                  Inventory value
                  <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Order number</TableHead>
              <TableHead>Part Name</TableHead>
              <TableHead>Part Number</TableHead>
              <TableHead>Plant</TableHead>
              <TableHead>Buyer code</TableHead>
              <TableHead>MRP code</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {displayRows.map((r) => (
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
                  {r.suggestedAction === "Cancel" || !r.suggestedDate
                    ? ""
                    : format(new Date(r.suggestedDate), "MMM d, yyyy")}
                </TableCell>
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
                        <span>
                          {!r.deliveryDate
                            ? "—"
                            : format(new Date(r.deliveryDate), "MMM d, yyyy")}
                        </span>
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
                              showPushOutSnackbar()
                            }}
                          >
                            Apply push out
                          </Button>
                        ) : null}
                      </div>
                    </PopoverContent>
                  </Popover>
                </TableCell>
                <TableCell>{formatEurCompact(r.inventoryValueEur)}</TableCell>
                <TableCell>
                  <Select
                    value={r.status}
                    onValueChange={(value) =>
                      setStatusByIds([r.id], value as any)
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
            ))}
          </TableBody>
        </Table>

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
                        <div className="text-muted-foreground">Inventory value</div>
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
                      <div className="rounded-md border bg-background p-3 text-sm">
                        <div className="font-medium text-foreground">A. Martin</div>
                        <div className="text-muted-foreground">
                          Reviewing supplier dates and awaiting confirmation.
                        </div>
                      </div>
                      <div className="rounded-md border bg-background p-3 text-sm">
                        <div className="font-medium text-foreground">S. Dubois</div>
                        <div className="text-muted-foreground">
                          Planned update for next week based on MRP refresh.
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
            Date updated successfully! The ticket is now marked as Done.
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
                setStatusByIds(selectedIds, bulkStatus)
                setSelected({})
                setOpenStatus(false)
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
