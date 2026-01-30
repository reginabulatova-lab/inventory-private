"use client"

import * as React from "react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import {
  ArrowDown,
  ChevronDown,
  ChevronRight,
  Files,
  Lightbulb,
  MoreHorizontal,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { useInventoryData, type EscalationTicket } from "@/components/inventory/inventory-data-provider"
import type { Opportunity } from "@/lib/inventory/types"
import type { RiskPart } from "@/lib/inventory/health-risk-kpis"
import {
    TOP_10_PROGRAMS,
    OTHER_PROGRAMS,
    STOCK_STATUS_CATEGORIES,
    WIP_CATEGORIES,
  } from "@/components/inventory/inventory-categories"
  

// If you already have shadcn Table components, use these imports.
// If not, tell me and I’ll provide the minimal table primitives.
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type HeatStatus = "red" | "yellow" | "green"

type HeatCell = {
  label: string // e.g., "W49\nDec 2025"
  value: number
  status: HeatStatus
}

type PartRow = {
  id: string
  escalationTicket: string
  partName: string
  partNumber: string
  inventoryValueEur: number
  hasOpportunities: boolean
  program: string
  plant: string
  currentStock: number
  stockStatus: string
  lateCount: number
  heatmap: HeatCell[]
  lines: LineMap
}

type PartSource = {
  partName: string
  partNumber: string
}

type LineKey =
  | "needs.customerOrders"
  | "needs.workOrders"
  | "resources.purchaseOrders"
  | "resources.workOrders"

type LineMap = Record<LineKey, HeatCell[]>

type Comment = {
  id: string
  text: string
  createdAt: string
}

function addCells(a: HeatCell[], b: HeatCell[]): HeatCell[] {
  return a.map((cell, i) => ({
    ...cell,
    value: cell.value + (b[i]?.value ?? 0),
  }))
}

function sumLate(a: number, b: number) {
    return Math.max(0, a) + Math.max(0, b)
  }
  
  // For prototype: keep child late logic in one place so totals stay consistent
  function getNeedsLate(r: { lateCount: number }) {
    const customer = Math.max(0, r.lateCount - 2)
    const work = Math.max(0, r.lateCount - 3)
    return { customer, work, total: sumLate(customer, work) }
  }
  
  function getResourcesLate(r: { lateCount: number }) {
    const purchase = Math.max(0, r.lateCount - 1)
    const work = Math.max(0, r.lateCount - 2)
    return { purchase, work, total: sumLate(purchase, work) }
  }
  

function statusFromValue(v: number): HeatStatus {
  // Prototype rule: you can tweak later
  if (v < 0) return "red"
  if (v === 0) return "yellow"
  return "green"
}

function formatEurCompact(value: number) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `€${(value / 1_000).toFixed(0)}K`
  return `€${Math.round(value)}`
}

function supplyTypeLabel(value: string) {
  return value === "PO" ? "Purchase Order" : value === "PR" ? "Purchase Request" : value
}

function ticketBadgeClass(level: EscalationTicket["level"]) {
  if (level === 1) return "bg-cyan-100 text-cyan-800"
  if (level === 2) return "bg-yellow-100 text-yellow-800"
  if (level === 3) return "bg-red-100 text-red-800"
  return "bg-zinc-300 text-zinc-900"
}

function deriveStatus(cells: HeatCell[]): HeatCell[] {
  return cells.map((c) => ({
    ...c,
    status: statusFromValue(c.value),
  }))
}

function renderHeatChip(c: HeatCell) {
  return (
    <div
      className={cn(
        "h-10 w-full rounded-md",
        "flex items-center justify-center",
        "text-sm font-semibold",
        heatBg[c.status]
      )}
    >
      {c.value}
    </div>
  )
}

type FilterContext =
  | { kind: "program"; category: string; topPrograms: string[] } // Top 10 Programs widget
  | { kind: "stockStatus"; category: string } // Stock Status widget
  | { kind: "wip"; category: string } // WIP widget
  | null

const heatBg: Record<HeatStatus, string> = {
  red: "bg-red-200 text-red-900",
  yellow: "bg-yellow-200 text-yellow-900",
  green: "bg-green-200 text-green-900",
}

function makeWeeks(): HeatCell[] {
  // Prototype: 8 weeks forward (you can change this)
  const weeks = [
    { label: "W48\nNov 2025", status: "red" as const, value: -623 },
    { label: "W49\nDec 2025", status: "yellow" as const, value: -623 },
    { label: "W50\nDec 2025", status: "red" as const, value: -625 },
    { label: "W51\nDec 2025", status: "red" as const, value: -629 },
    { label: "W52\nDec 2025", status: "yellow" as const, value: -629 },
    { label: "W01\nJan 2026", status: "green" as const, value: -610 },
    { label: "W02\nJan 2026", status: "green" as const, value: -590 },
    { label: "W03\nJan 2026", status: "yellow" as const, value: -605 },
  ]
  return weeks
}

function buildMockRow(part: PartSource, index: number, idOverride?: string): PartRow {
  const topProgramsNoOther = TOP_10_PROGRAMS.filter((p) => p !== "Other")
  const allPrograms = [...topProgramsNoOther, ...OTHER_PROGRAMS]
  const program = allPrograms[index % allPrograms.length]
  const stockStatus = STOCK_STATUS_CATEGORIES[index % STOCK_STATUS_CATEGORIES.length]

  const base = makeWeeks()

  const mkLine = (seed: number): HeatCell[] =>
    base.map((c, idx) => {
      const raw = Math.round((Math.abs(c.value) / (seed + idx + 3)) * (idx % 2 === 0 ? -1 : 1))
      return { ...c, value: raw, status: statusFromValue(raw) }
    })

  const lines: LineMap = {
    "needs.customerOrders": mkLine(index + 1),
    "needs.workOrders": mkLine(index + 2),
    "resources.purchaseOrders": mkLine(index + 3),
    "resources.workOrders": mkLine(index + 4),
  }

  const inventoryValueEur = 5_000 + ((index + 1) * 13_579) % 145_000

  return {
    id: idOverride ?? `p${index + 1}`,
    escalationTicket: `T-${(index % 4) + 1}`,
    partName: part.partName,
    partNumber: part.partNumber,
    inventoryValueEur,
    hasOpportunities: index % 2 === 0,
    program,
    plant: index % 2 === 0 ? "1123" : "1130",
    currentStock: index % 2 === 0 ? 12 : 0,
    stockStatus,
    lateCount: 10 - index,
    heatmap: makeWeeks().map((c, idx) => ({
      ...c,
      status: (["red", "yellow", "green"] as const)[(index + idx) % 3],
      value: Math.round(Math.abs(c.value) / (index + 2)),
    })),
    lines,
  }
}

function buildMockParts(parts: PartSource[]): PartRow[] {
  const fallbackParts =
    parts.length > 0 ? parts : [{ partName: "Part name 1", partNumber: "PN-1000" }]

  return Array.from({ length: 10 }).map((_, i) => {
    const part = fallbackParts[i % fallbackParts.length]
    return buildMockRow(part, i)
  })
}

function buildMockRowsForParts(parts: PartSource[]): PartRow[] {
  if (parts.length === 0) return buildMockParts(parts)
  return parts.map((part, i) => buildMockRow(part, i, part.partNumber))
}
  
/**
 * Filtering rules (prototype):
 * - Top 10 Programs:
 *    - If category === "Other" => show parts with program === "Other"
 *      (You can later implement “not in top list” if you prefer.)
 *    - Else program === category
 * - Stock Status: stockStatus === category
 * - WIP: maps to a field later; for now uses stockStatus as placeholder
 */
function applyFilter(rows: PartRow[], filter: FilterContext): PartRow[] {
    if (!filter) return rows.slice(0, 10)
  
    if (filter.kind === "program") {
      const cat = filter.category
  
      // "Other" = any program NOT in the displayed top 10 (excluding "Other" label itself)
      if (cat === "Other") {
        const top = new Set(filter.topPrograms.filter((p) => p !== "Other"))
        return rows.filter((r) => !top.has(r.program)).slice(0, 10)
      }
  
      return rows.filter((r) => r.program === cat).slice(0, 10)
    }
  
    if (filter.kind === "stockStatus") {
      return rows.filter((r) => r.stockStatus === filter.category).slice(0, 10)
    }
  
    if (filter.kind === "wip") {
      // placeholder until you add a real wipStatus column in PartRow
      return rows.filter((r) => r.stockStatus === filter.category).slice(0, 10)
    }
  
    return rows.slice(0, 10)
  }   

export function PartbookTable({
  filter,
  fullHeight = false,
  overrideParts,
  valueLabel,
}: {
  filter: FilterContext
  fullHeight?: boolean
  overrideParts?: RiskPart[]
  valueLabel?: string
}) {
  const { opportunities, plan, escalationTickets, upsertEscalationTicket } = useInventoryData()
  const [openPanel, setOpenPanel] = React.useState(false)
  const [panelRow, setPanelRow] = React.useState<Opportunity | null>(null)
  const [openTicketPanel, setOpenTicketPanel] = React.useState(false)
  const [activeTicket, setActiveTicket] = React.useState<EscalationTicket | null>(null)
  const [selected, setSelected] = React.useState<Record<string, boolean>>({})
  const [partComments, setPartComments] = React.useState<Record<string, Comment[]>>({})
  const [partCommentDraft, setPartCommentDraft] = React.useState("")
  const [ticketComments, setTicketComments] = React.useState<Record<string, Comment[]>>({})
  const [ticketCommentDraft, setTicketCommentDraft] = React.useState("")

  const partSources = React.useMemo<PartSource[]>(() => {
    const map = new Map<string, PartSource>()
    opportunities
      .filter((o) => o.plan === plan)
      .forEach((o) => {
        if (!map.has(o.partNumber)) {
          map.set(o.partNumber, { partName: o.partName, partNumber: o.partNumber })
        }
      })
    return Array.from(map.values())
  }, [opportunities, plan])

  const opportunityByPart = React.useMemo(() => {
    const map = new Map<string, Opportunity>()
    opportunities
      .filter((o) => o.plan === plan)
      .forEach((o) => {
        if (!map.has(o.partNumber)) map.set(o.partNumber, o)
      })
    return map
  }, [opportunities, plan])

  const all = React.useMemo(() => buildMockParts(partSources), [partSources])
  const rows = React.useMemo(() => {
    if (overrideParts) {
      if (overrideParts.length === 0) return []
      const sources = overrideParts.map((p) => ({
        partName: p.partName,
        partNumber: p.partNumber,
      }))
      const byPart = new Map(
        overrideParts.map((p) => [p.partNumber, p.contributionEur])
      )
      return buildMockRowsForParts(sources)
        .map((row) => ({
          ...row,
          inventoryValueEur: byPart.get(row.partNumber) ?? 0,
        }))
        .sort((a, b) => b.inventoryValueEur - a.inventoryValueEur)
    }

    const filtered = applyFilter(all, filter)
    return filtered.sort((a, b) => b.inventoryValueEur - a.inventoryValueEur)
  }, [all, filter, overrideParts])

  const selectedIds = React.useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected]
  )
  const selectedCount = selectedIds.length
  const allChecked = rows.length > 0 && selectedCount === rows.length
  const indeterminate = selectedCount > 0 && selectedCount < rows.length

  const createTicketForPart = React.useCallback(
    (row: PartRow) => {
      const existing = escalationTickets[row.partNumber]
      if (existing) return existing
      const match = opportunityByPart.get(row.partNumber)
      const base = Number(row.id.replace(/\D/g, "")) || 1
      const level = (((base - 1) % 4) + 1) as 1 | 2 | 3 | 4
      const team = match?.team || "Supply"
      const ticket: EscalationTicket = {
        id: `TCK-${1000 + base}`,
        level,
        createdAt: new Date().toISOString(),
        team,
        partName: row.partName,
        partNumber: row.partNumber,
        description: "Escalation ticket created for part review.",
      }
      upsertEscalationTicket(ticket)
      return ticket
    },
    [opportunityByPart, escalationTickets, upsertEscalationTicket]
  )

  const openTicketForRow = React.useCallback(
    (row: PartRow) => {
      const ticket = createTicketForPart(row)
      setActiveTicket(ticket)
      setOpenTicketPanel(true)
    },
    [createTicketForPart]
  )

  const createTicketsForSelection = React.useCallback(() => {
    if (selectedIds.length === 0) return
    let firstTicket: EscalationTicket | null = null
    rows.forEach((row) => {
      if (!selectedIds.includes(row.id)) return
      const ticket = createTicketForPart(row)
      if (!firstTicket) firstTicket = ticket
    })
    setSelected({})
    if (firstTicket) {
      setActiveTicket(firstTicket)
      setOpenTicketPanel(true)
    }
  }, [createTicketForPart, rows, selectedIds])

  // ─────────────────────────────────────────────
// EMPTY STATE (no parts match the filters)
// ─────────────────────────────────────────────
if (rows.length === 0) {
    return (
      <div className="rounded-xl bg-white">
        <div className="flex flex-col items-center justify-center rounded-xl bg-muted/40 p-10 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
            <span className="text-lg">📦</span>
          </div>
  
          <div className="mt-4 text-base font-semibold text-foreground">
            No parts found
          </div>
  
          <div className="mt-1 text-sm text-muted-foreground">
            Try another category or adjust your filters.
          </div>
        </div>
      </div>
    )
  }  

  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({})

  const weeks = rows[0]?.heatmap ?? makeWeeks()

  // Sticky left columns need fixed widths + left offsets
  const col = {
    check: "w-[44px]",
    chevron: "w-[40px]",
    escalation: "w-[80px]",
    partName: "w-[220px]",
    partNumber: "w-[140px]",
    inventoryValue: "w-[140px]",
    opp: "w-[56px]",
    program: "w-[140px]",
    plant: "w-[110px]",
    stock: "w-[120px]",
    status: "w-[140px]",
    menu: "w-[48px]",
  }

  // left offsets (sum of previous widths)
  const left = {
    check: "left-0",
    chevron: "left-[44px]",
    escalation: "left-[84px]",
    partName: "left-[164px]",
    partNumber: "left-[384px]",
    inventoryValue: "left-[524px]",
    opp: "left-[664px]",
    program: "left-[720px]",
    plant: "left-[860px]",
    stock: "left-[970px]",
    status: "left-[1090px]",
    menu: "left-[1230px]",
  }

  const stickyCell = (w: string, l: string) =>
    cn(
      "sticky z-30 bg-white",
      w,
      l
    )  

  return (
    <div className="flex flex-col">
      {selectedCount > 0 && (
        <div className="sticky top-[72px] z-10 mb-4 flex items-center justify-between rounded-xl border bg-background px-4 py-3 shadow-sm">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{selectedCount}</span>{" "}
            selected
          </div>
          <Button variant="secondary" className="h-9" onClick={createTicketsForSelection}>
            Create ticket
          </Button>
        </div>
      )}

      {/* Scroll container: vertical + horizontal */}
      <div
        className={cn(
          "overflow-auto rounded-xl border border-border bg-white",
          fullHeight ? "max-h-[calc(100vh-220px)]" : "max-h-[420px]"
        )}
      >
      <Table className="min-w-max border-collapse">
          <TableHeader className="sticky top-0 z-20 bg-white">
            <TableRow>
              <TableHead className={stickyCell(col.check, left.check)}>
                <Checkbox
                  checked={allChecked ? true : indeterminate ? "indeterminate" : false}
                  onCheckedChange={(v) => {
                    if (!v) return setSelected({})
                    const next: Record<string, boolean> = {}
                    rows.forEach((r) => (next[r.id] = true))
                    setSelected(next)
                  }}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead className={stickyCell(col.chevron, left.chevron)} />
              <TableHead className={stickyCell(col.escalation, left.escalation)}>Esc.</TableHead>
              <TableHead className={stickyCell(col.partName, left.partName)}>Part Name</TableHead>
              <TableHead className={stickyCell(col.partNumber, left.partNumber)}>
                Part Number
              </TableHead>
              <TableHead className={stickyCell(col.inventoryValue, left.inventoryValue)}>
                <div className="flex items-center gap-1">
                  {valueLabel ?? "Inventory value"}
                  <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </TableHead>
              <TableHead className={stickyCell(col.opp, left.opp)}>Opp.</TableHead>
              <TableHead className={stickyCell(col.program, left.program)}>Program</TableHead>
              <TableHead className={stickyCell(col.plant, left.plant)}>Plant</TableHead>
              <TableHead className={stickyCell(col.stock, left.stock)}>Current stock</TableHead>
              <TableHead className={stickyCell(col.status, left.status)}>Stock status</TableHead>
              <TableHead className={stickyCell(col.menu, left.menu)} />

              {/* Heatmap columns */}
              <TableHead className="w-[90px]">
                <div className="flex flex-col">
                  <span>Late</span>
                  <span className="text-xs text-muted-foreground">From W48</span>
                </div>
              </TableHead>

              {weeks.map((w) => (
                <TableHead key={w.label} className="w-[110px]">
                  <div className="whitespace-pre text-xs text-muted-foreground leading-4">
                    {w.label}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((r) => {
              const isOpen = Boolean(expanded[r.id])

              return (
                <React.Fragment key={r.id}>
                  {/* Part row */}
                  <TableRow className="group hover:bg-muted/40">
                    <TableCell className={stickyCell(col.check, left.check)}>
                      <Checkbox
                        checked={!!selected[r.id]}
                        onCheckedChange={(v) =>
                          setSelected((prev) => ({ ...prev, [r.id]: Boolean(v) }))
                        }
                        aria-label={`Select ${r.partNumber}`}
                      />
                    </TableCell>

                    <TableCell className={stickyCell(col.chevron, left.chevron)}>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
                        onClick={() => setExpanded((p) => ({ ...p, [r.id]: !p[r.id] }))}
                        aria-label={isOpen ? "Collapse" : "Expand"}
                      >
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </TableCell>

                    <TableCell className={stickyCell(col.escalation, left.escalation)}>
                      {escalationTickets[r.partNumber] ? (
                        <button
                          type="button"
                          onClick={() => openTicketForRow(r)}
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
                          onClick={() => openTicketForRow(r)}
                          aria-label="Create ticket"
                        >
                          <Files className="h-4 w-4 text-muted-foreground" />
                        </button>
                      )}
                    </TableCell>

                    <TableCell className={stickyCell(col.partName, left.partName)}>
                      <button
                        type="button"
                        className="font-medium text-blue-700 hover:text-blue-900"
                        onClick={() => {
                          const match = opportunityByPart.get(r.partNumber)
                          if (!match) return
                          setPanelRow(match)
                          setOpenPanel(true)
                        }}
                      >
                        {r.partName}
                      </button>
                    </TableCell>

                    <TableCell className={stickyCell(col.partNumber, left.partNumber)}>
                      <button
                        type="button"
                        className="font-medium text-blue-700 hover:text-blue-900"
                        onClick={() => {
                          const match = opportunityByPart.get(r.partNumber)
                          if (!match) return
                          setPanelRow(match)
                          setOpenPanel(true)
                        }}
                      >
                        {r.partNumber}
                      </button>
                    </TableCell>

                    <TableCell className={stickyCell(col.inventoryValue, left.inventoryValue)}>
                      {formatEurCompact(r.inventoryValueEur)}
                    </TableCell>

                    <TableCell className={stickyCell(col.opp, left.opp)}>
                      <div className="flex items-center justify-center">
                        {r.hasOpportunities ? <Lightbulb className="h-4 w-4 text-muted-foreground" /> : null}
                      </div>
                    </TableCell>

                    <TableCell className={stickyCell(col.program, left.program)}>{r.program}</TableCell>
                    <TableCell className={stickyCell(col.plant, left.plant)}>{r.plant}</TableCell>
                    <TableCell className={stickyCell(col.stock, left.stock)}>{r.currentStock}</TableCell>
                    <TableCell className={stickyCell(col.status, left.status)}>{r.stockStatus}</TableCell>

                    <TableCell className={stickyCell(col.menu, left.menu)}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </TableCell>

                    {/* Late */}
                          <TableCell className="p-2">
                              <div
                                  className={cn(
                                      "h-10 w-full rounded-md",
                                      "flex items-center justify-center",
                                      "text-sm font-semibold",
                                      r.lateCount > 0 ? heatBg.red : heatBg.green
                                  )}
                              >
                                  {r.lateCount}
                              </div>
                          </TableCell>

                    {/* Heatmap */}
                    {r.heatmap.map((c, i) => (
                      <TableCell key={i} className="p-2 overflow-hidden">
                        <div
                                className={cn(
                                    "h-10 w-full rounded-md",
                                    "flex items-center justify-center",
                                    "text-sm font-semibold",
                                    heatBg[c.status]
                                )}
                            >
                          {c.value}
                        </div>
                      </TableCell>
                    ))}
                  </TableRow>

                  {/* Expanded structure */}
                  {isOpen ? (
                    <>
                      {/* Needs */}
                      <TableRow className="bg-muted/20">
                        <TableCell className={stickyCell(col.check, left.check)} />
                        <TableCell className={stickyCell(col.chevron, left.chevron)}>
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                        <TableCell className={stickyCell(col.escalation, left.escalation)} />
                        <TableCell className={cn(stickyCell(col.partName, left.partName), "font-semibold")}>
                          Needs
                        </TableCell>
                        {/* rest sticky left */}
                        <TableCell className={stickyCell(col.partNumber, left.partNumber)} />
                        <TableCell className={stickyCell(col.inventoryValue, left.inventoryValue)} />
                        <TableCell className={stickyCell(col.opp, left.opp)} />
                        <TableCell className={stickyCell(col.program, left.program)} />
                        <TableCell className={stickyCell(col.plant, left.plant)} />
                        <TableCell className={stickyCell(col.stock, left.stock)} />
                        <TableCell className={stickyCell(col.status, left.status)} />
                        <TableCell className={stickyCell(col.menu, left.menu)} />

                        {/* Late (Needs = sum of children) */}
                        <TableCell className="p-2 overflow-hidden">
                        {renderHeatChip({ label: "Late", value: getNeedsLate(r).total, status: "red" })}
                        </TableCell>

                        {/* Weeks (Needs = sum of children) */}
                        {deriveStatus(
                        addCells(r.lines["needs.customerOrders"], r.lines["needs.workOrders"])
                        ).map((c, i) => (
                        <TableCell key={i} className="p-2 overflow-hidden">
                            {renderHeatChip(c)}
                        </TableCell>
                        ))}

                      </TableRow>

                      {/* Needs → Customer orders */}
                              <TableRow>
                                  <TableCell className={stickyCell(col.check, left.check)} />
                                  <TableCell className={stickyCell(col.chevron, left.chevron)} />
                                  <TableCell className={stickyCell(col.escalation, left.escalation)} />
                                  <TableCell className={cn(stickyCell(col.partName, left.partName), "pl-8 text-muted-foreground")}>
                                      Customer orders
                                  </TableCell>

                                  <TableCell className={stickyCell(col.partNumber, left.partNumber)} />
                                  <TableCell className={stickyCell(col.inventoryValue, left.inventoryValue)} />
                                  <TableCell className={stickyCell(col.opp, left.opp)} />
                                  <TableCell className={stickyCell(col.program, left.program)} />
                                  <TableCell className={stickyCell(col.plant, left.plant)} />
                                  <TableCell className={stickyCell(col.stock, left.stock)} />
                                  <TableCell className={stickyCell(col.status, left.status)} />
                                  <TableCell className={stickyCell(col.menu, left.menu)} />

                                  {/* Late (prototype) */}
                                  <TableCell className="p-2 overflow-hidden">
                                      {renderHeatChip({ label: "Late", value: Math.max(0, r.lateCount - 2), status: "red" })}
                                  </TableCell>

                                  {/* Weeks */}
                                  {r.lines["needs.customerOrders"].map((c, i) => (
                                      <TableCell key={i} className="p-2 overflow-hidden">
                                          {renderHeatChip(c)}
                                      </TableCell>
                                  ))}
                              </TableRow>

                              {/* Needs → Work orders */}
                              <TableRow>
                                  <TableCell className={stickyCell(col.check, left.check)} />
                                  <TableCell className={stickyCell(col.chevron, left.chevron)} />
                                  <TableCell className={stickyCell(col.escalation, left.escalation)} />
                                  <TableCell className={cn(stickyCell(col.partName, left.partName), "pl-8 text-muted-foreground")}>
                                      Work orders
                                  </TableCell>

                                  <TableCell className={stickyCell(col.partNumber, left.partNumber)} />
                                  <TableCell className={stickyCell(col.opp, left.opp)} />
                                  <TableCell className={stickyCell(col.program, left.program)} />
                                  <TableCell className={stickyCell(col.plant, left.plant)} />
                                  <TableCell className={stickyCell(col.stock, left.stock)} />
                                  <TableCell className={stickyCell(col.status, left.status)} />
                                  <TableCell className={stickyCell(col.menu, left.menu)} />

                                  {/* Late (prototype) */}
                                  <TableCell className="p-2 overflow-hidden">
                                      {renderHeatChip({ label: "Late", value: getNeedsLate(r).work, status: "red" })}
                                  </TableCell>

                                  {/* Weeks */}
                                  {r.lines["needs.workOrders"].map((c, i) => (
                                      <TableCell key={i} className="p-2 overflow-hidden">
                                          {renderHeatChip(c)}
                                      </TableCell>
                                  ))}
                              </TableRow>


                      {["Customer orders", "Work orders"].map((label) => {[
                          { label: "Customer orders", key: "needs.customerOrders" as const },
                          { label: "Work orders", key: "needs.workOrders" as const },
                      ].map(({ label, key }) => (
                          <TableRow key={key}>
                              <TableCell className={stickyCell(col.check, left.check)} />
                              <TableCell className={stickyCell(col.chevron, left.chevron)} />
                              <TableCell className={stickyCell(col.escalation, left.escalation)} />
                              <TableCell
                                  className={cn(stickyCell(col.partName, left.partName), "pl-8 text-muted-foreground")}
                              >
                                  {label}
                              </TableCell>

                              <TableCell className={stickyCell(col.partNumber, left.partNumber)} />
                              <TableCell className={stickyCell(col.inventoryValue, left.inventoryValue)} />
                              <TableCell className={stickyCell(col.opp, left.opp)} />
                              <TableCell className={stickyCell(col.program, left.program)} />
                              <TableCell className={stickyCell(col.plant, left.plant)} />
                              <TableCell className={stickyCell(col.stock, left.stock)} />
                              <TableCell className={stickyCell(col.status, left.status)} />
                              <TableCell className={stickyCell(col.menu, left.menu)} />

                              {/* Late */}
                              <TableCell className="p-2 overflow-hidden">
                                  {renderHeatChip({
                                      label: "Late",
                                      value: getNeedsLate(r).customer,
                                      status: "red",
                                  })}
                              </TableCell>

                              {/* Weeks */}
                              {r.lines[key].map((c, i) => (
                                  <TableCell key={i} className="p-2 overflow-hidden">
                                      {renderHeatChip(c)}
                                  </TableCell>
                              ))}
                          </TableRow>
                      ))
                      }

                      )}

                      {/* Resources */}
                      <TableRow className="bg-muted/20">
                        <TableCell className={stickyCell(col.check, left.check)} />
                        <TableCell className={stickyCell(col.chevron, left.chevron)}>
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                        <TableCell className={stickyCell(col.escalation, left.escalation)} />
                        <TableCell className={cn(stickyCell(col.partName, left.partName), "font-semibold")}>
                          Resources
                        </TableCell>

                        <TableCell className={stickyCell(col.partNumber, left.partNumber)} />
                        <TableCell className={stickyCell(col.opp, left.opp)} />
                        <TableCell className={stickyCell(col.program, left.program)} />
                        <TableCell className={stickyCell(col.plant, left.plant)} />
                        <TableCell className={stickyCell(col.stock, left.stock)} />
                        <TableCell className={stickyCell(col.status, left.status)} />
                        <TableCell className={stickyCell(col.menu, left.menu)} />

                        {/* Late (Resources = sum of children) */}
                        <TableCell className="p-2 overflow-hidden">
                            {renderHeatChip({ label: "Late", value: getResourcesLate(r).total, status: "red" })}
                        </TableCell>

                        {/* Weeks (Resources = sum of children) */}
                            {deriveStatus(
                                addCells(r.lines["resources.purchaseOrders"], r.lines["resources.workOrders"])
                                ).map((c, i) => (
                                <TableCell key={i} className="p-2 overflow-hidden">
                                    {renderHeatChip(c)}
                                </TableCell>
                                  ))}

                        {weeks.map((_, i) => <TableCell key={i} />)}
                      </TableRow>

                        {/* Resources → Purchase orders */}
                        <TableRow>
                        <TableCell className={stickyCell(col.check, left.check)} />
                        <TableCell className={stickyCell(col.chevron, left.chevron)} />
                        <TableCell className={stickyCell(col.escalation, left.escalation)} />
                        <TableCell className={cn(stickyCell(col.partName, left.partName), "pl-8 text-muted-foreground")}>
                            Purchase orders
                        </TableCell>

                        <TableCell className={stickyCell(col.partNumber, left.partNumber)} />
                        <TableCell className={stickyCell(col.opp, left.opp)} />
                        <TableCell className={stickyCell(col.program, left.program)} />
                        <TableCell className={stickyCell(col.plant, left.plant)} />
                        <TableCell className={stickyCell(col.stock, left.stock)} />
                        <TableCell className={stickyCell(col.status, left.status)} />
                        <TableCell className={stickyCell(col.menu, left.menu)} />

                        {/* Late (prototype) */}
                        <TableCell className="p-2 overflow-hidden">
                            {renderHeatChip({ label: "Late", value: getResourcesLate(r).purchase, status: "red" })}
                        </TableCell>

                        {/* Weeks */}
                        {r.lines["resources.purchaseOrders"].map((c, i) => (
                            <TableCell key={i} className="p-2 overflow-hidden">
                            {renderHeatChip(c)}
                            </TableCell>
                        ))}
                        </TableRow>

                        {/* Resources → Work orders */}
                        <TableRow>
                        <TableCell className={stickyCell(col.check, left.check)} />
                        <TableCell className={stickyCell(col.chevron, left.chevron)} />
                        <TableCell className={stickyCell(col.escalation, left.escalation)} />
                        <TableCell className={cn(stickyCell(col.partName, left.partName), "pl-8 text-muted-foreground")}>
                            Work orders
                        </TableCell>

                        <TableCell className={stickyCell(col.partNumber, left.partNumber)} />
                        <TableCell className={stickyCell(col.opp, left.opp)} />
                        <TableCell className={stickyCell(col.program, left.program)} />
                        <TableCell className={stickyCell(col.plant, left.plant)} />
                        <TableCell className={stickyCell(col.stock, left.stock)} />
                        <TableCell className={stickyCell(col.status, left.status)} />
                        <TableCell className={stickyCell(col.menu, left.menu)} />

                        {/* Late (prototype) */}
                        <TableCell className="p-2 overflow-hidden">
                            {renderHeatChip({ label: "Late", value: getResourcesLate(r).work, status: "red" })}
                        </TableCell>

                        {/* Weeks */}
                        {r.lines["resources.workOrders"].map((c, i) => (
                            <TableCell key={i} className="p-2 overflow-hidden">
                            {renderHeatChip(c)}
                            </TableCell>
                        ))}
                        </TableRow>
                    </>
                  ) : null}
                </React.Fragment>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination (prototype: single page) */}
      <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
        <div>Showing {rows.length} of {rows.length}</div>
        <div className="flex items-center gap-2">
          <span>Page</span>
          <span className="rounded-md border border-border bg-white px-2 py-1 text-foreground">1</span>
          <span>of 1</span>
        </div>
      </div>
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
                        <div className="text-muted-foreground">Delivery date</div>
                        <div className="text-foreground">
                          {panelRow.deliveryDate
                            ? format(new Date(panelRow.deliveryDate), "MMM d, yyyy")
                            : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Inventory value</div>
                        <div className="text-foreground">
                          {formatEurCompact(panelRow.cashImpactEur)}
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
                      {(partComments[panelRow.id] ?? []).length === 0 ? (
                        <div className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
                          No comments yet.
                        </div>
                      ) : (
                        (partComments[panelRow.id] ?? []).map((comment) => (
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
                          value={partCommentDraft}
                          onChange={(e) => setPartCommentDraft(e.target.value)}
                          placeholder="Write a comment..."
                        />
                        <div className="mt-2 flex justify-end">
                          <Button
                            className="h-8"
                            onClick={() => {
                              const text = partCommentDraft.trim()
                              if (!text) return
                              setPartComments((prev) => ({
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
                              setPartCommentDraft("")
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
                          {format(new Date(activeTicket.createdAt), "MMM d, yyyy")}
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
                      {(activeTicket && (ticketComments[activeTicket.id] ?? []).length === 0) ? (
                        <div className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
                          No comments yet.
                        </div>
                      ) : (
                        (ticketComments[activeTicket?.id ?? ""] ?? []).map((comment) => (
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
                              if (!activeTicket) return
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
  )
}