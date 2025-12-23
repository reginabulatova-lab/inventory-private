"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronRight, Lightbulb, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
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
  hasOpportunities: boolean
  program: string
  plant: string
  currentStock: number
  stockStatus: string
  lateCount: number
  heatmap: HeatCell[]
  lines: LineMap
}

type LineKey =
  | "needs.customerOrders"
  | "needs.workOrders"
  | "resources.purchaseOrders"
  | "resources.workOrders"

type LineMap = Record<LineKey, HeatCell[]>

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

function buildMockParts(): PartRow[] {
    const topProgramsNoOther = TOP_10_PROGRAMS.filter((p) => p !== "Other")
    const allPrograms = [...topProgramsNoOther, ...OTHER_PROGRAMS]
  
    return Array.from({ length: 10 }).map((_, i) => {
      const program = allPrograms[i % allPrograms.length]
      const stockStatus = STOCK_STATUS_CATEGORIES[i % STOCK_STATUS_CATEGORIES.length]

      const base = makeWeeks()

        const mkLine = (seed: number): HeatCell[] =>
            base.map((c, idx) => {
                const raw = Math.round((Math.abs(c.value) / (seed + idx + 3)) * (idx % 2 === 0 ? -1 : 1))
                return { ...c, value: raw, status: statusFromValue(raw) }
            })

        const lines: LineMap = {
            "needs.customerOrders": mkLine(i + 1),
            "needs.workOrders": mkLine(i + 2),
            "resources.purchaseOrders": mkLine(i + 3),
            "resources.workOrders": mkLine(i + 4),
        }
  
      return {
        id: `p${i + 1}`,
        escalationTicket: `T-${(i % 4) + 1}`,
        partName: `Part name ${i + 1}`,
        partNumber: `PN-${1000 + i}`,
        hasOpportunities: i % 2 === 0,
        program,
        plant: i % 2 === 0 ? "1123" : "1130",
        currentStock: i % 2 === 0 ? 12 : 0,
        stockStatus,
        lateCount: 10 - i,
        heatmap: makeWeeks().map((c, idx) => ({
          ...c,
          status: (["red", "yellow", "green"] as const)[(i + idx) % 3],
          value: Math.round(Math.abs(c.value) / (i + 2)),
        })),
        lines,
      }
    })
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

export function PartbookTable({ filter }: { filter: FilterContext }) {
  const all = React.useMemo(() => buildMockParts(), [])
  const rows = React.useMemo(() => applyFilter(all, filter), [all, filter])

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
    opp: "left-[524px]",
    program: "left-[580px]",
    plant: "left-[720px]",
    stock: "left-[830px]",
    status: "left-[950px]",
    menu: "left-[1090px]",
  }

  const stickyCell = (w: string, l: string) =>
    cn(
      "sticky z-30 bg-white",
      w,
      l
    )  

  return (
    <div className="flex flex-col">
      {/* Scroll container: vertical + horizontal */}
      <div className="max-h-[420px] overflow-auto rounded-xl border border-border bg-white">
      <Table className="min-w-max border-collapse">
          <TableHeader className="sticky top-0 z-20 bg-white">
            <TableRow>
              <TableHead className={stickyCell(col.check, left.check)} />
              <TableHead className={stickyCell(col.chevron, left.chevron)} />
              <TableHead className={stickyCell(col.escalation, left.escalation)}>Esc.</TableHead>
              <TableHead className={stickyCell(col.partName, left.partName)}>Part Name</TableHead>
              <TableHead className={stickyCell(col.partNumber, left.partNumber)}>Part No.</TableHead>
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
                      <input type="checkbox" className="h-4 w-4" />
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
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium">
                        {r.escalationTicket}
                      </span>
                    </TableCell>

                    <TableCell className={stickyCell(col.partName, left.partName)}>
                      <a href="#" className="font-medium text-primary underline-offset-4 hover:underline">
                        {r.partName}
                      </a>
                    </TableCell>

                    <TableCell className={stickyCell(col.partNumber, left.partNumber)}>
                      <a href="#" className="text-primary underline-offset-4 hover:underline">
                        {r.partNumber}
                      </a>
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
    </div>
  )
}