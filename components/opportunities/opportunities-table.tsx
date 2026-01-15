"use client"

import * as React from "react"
import { format } from "date-fns"
import {
  buildPartKey,
  useFilteredOpportunities,
  useInventoryData,
  useOpportunitiesForFilters,
} from "@/components/inventory/inventory-data-provider"
import {
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

function formatEurCompact(value: number) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `€${(value / 1_000).toFixed(0)}K`
  return `€${Math.round(value)}`
}

export function OpportunitiesTable() {
  const {
    snoozeByIds,
    unsnoozeByIds,
    setStatusByIds,
    dateRange,
    snoozeRules,
    addSnoozeRule,
    removeSnoozeRule,
  } = useInventoryData()
  const filterOptions = useOpportunitiesForFilters()
  const baseOpportunities = useFilteredOpportunities({ includeSnoozed: false })
  const allRows = useFilteredOpportunities({ includeSnoozed: true })

  const kpis = computeHealthRiskKPIs(baseOpportunities, dateRange.from, dateRange.to)
  const mode = getOpportunityMode(kpis.overstockEur, kpis.understockEur)
  const scopedBase = React.useMemo(
    () => filterOpportunitiesByMode(baseOpportunities, mode),
    [baseOpportunities, mode]
  )
  const scopedAll = React.useMemo(() => filterOpportunitiesByMode(allRows, mode), [allRows, mode])
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
  const rows = scopedAll
  const displayRows = React.useMemo(() => {
    const scaled = rows.map((row) => ({
      ...row,
      inventoryValueEur: Math.round(row.cashImpactEur * scale),
    }))
    return scaled.sort((a, b) => b.inventoryValueEur - a.inventoryValueEur)
  }, [rows, scale])

  const [selected, setSelected] = React.useState<Record<string, boolean>>({})
  const [openSnooze, setOpenSnooze] = React.useState(false)
  const [openUnsnooze, setOpenUnsnooze] = React.useState(false)
  const [openRules, setOpenRules] = React.useState(false)
  const [selectedCustomers, setSelectedCustomers] = React.useState<string[]>([])
  const [selectedParts, setSelectedParts] = React.useState<string[]>([])

  const selectedIds = React.useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected]
  )

  const selectedCount = selectedIds.length
  const selectedRows = rows.filter((r) => selectedIds.includes(r.id))
  const selectedSnoozedCount = selectedRows.filter((r) => r.status === "Snoozed").length
  const selectedActiveCount = selectedRows.length - selectedSnoozedCount

  const statusSummary = React.useMemo(() => {
    const summary = {
      "To Do": { count: 0, total: 0 },
      "In Progress": { count: 0, total: 0 },
      Done: { count: 0, total: 0 },
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

  const allChecked = rows.length > 0 && selectedCount === rows.length
  const indeterminate = selectedCount > 0 && selectedCount < rows.length

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-background p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {(["To Do", "In Progress", "Done", "Snoozed"] as const).map((status, idx) => (
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
          <Button variant="secondary" className="h-9" onClick={() => setOpenRules(true)}>
            Manage snooze rules
          </Button>
        </div>
      </div>

      {/* Action bar */}
      {selectedCount > 0 && (
        <div className="sticky top-[72px] z-10 flex items-center justify-between rounded-xl border bg-background px-4 py-3 shadow-sm">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{selectedCount}</span>{" "}
            selected
          </div>

          <div className="flex items-center gap-2">
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
              <TableHead>Order number</TableHead>
              <TableHead>Part Name</TableHead>
              <TableHead>Part Number</TableHead>
              <TableHead>Suggested Action</TableHead>
              <TableHead>Inventory value</TableHead>
              <TableHead>Suggested Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assignee</TableHead>
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
                <TableCell className="font-medium">{r.orderNumber}</TableCell>
                <TableCell>{r.partName}</TableCell>
                <TableCell className="text-muted-foreground">{r.partNumber}</TableCell>
                <TableCell>{r.suggestedAction}</TableCell>
                <TableCell>{formatEurCompact(r.inventoryValueEur)}</TableCell>
                <TableCell>{format(new Date(r.suggestedDate), "MMM d, yyyy")}</TableCell>
                <TableCell>
                  <Select
                    value={r.status}
                    onValueChange={(value) =>
                      setStatusByIds([r.id], value as any)
                    }
                  >
                    <SelectTrigger className="h-8 w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="start">
                      <SelectItem value="To Do">To Do</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="Done">Done</SelectItem>
                      <SelectItem value="Snoozed">Snoozed</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>{r.assignee}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

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

      <Dialog open={openRules} onOpenChange={setOpenRules}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Snooze rules</DialogTitle>
            <DialogDescription>
              Create rules to auto‑snooze opportunities by customer or part.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium text-foreground">Customer</div>
              <div className="mt-2 max-h-40 overflow-y-auto rounded-md border">
                {Array.from(new Set(filterOptions.map((o) => o.customer)))
                  .filter(Boolean)
                  .sort()
                  .map((customer) => (
                    <div
                      key={customer}
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        setSelectedCustomers((prev) =>
                          prev.includes(customer)
                            ? prev.filter((c) => c !== customer)
                            : [...prev, customer]
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          setSelectedCustomers((prev) =>
                            prev.includes(customer)
                              ? prev.filter((c) => c !== customer)
                              : [...prev, customer]
                          )
                        }
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                    >
                      <Checkbox checked={selectedCustomers.includes(customer)} />
                      <span>{customer}</span>
                    </div>
                  ))}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-foreground">Part</div>
              <div className="mt-2 max-h-40 overflow-y-auto rounded-md border">
                {Array.from(new Set(filterOptions.map((o) => buildPartKey(o))))
                  .filter(Boolean)
                  .sort()
                  .map((part) => (
                    <div
                      key={part}
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        setSelectedParts((prev) =>
                          prev.includes(part) ? prev.filter((p) => p !== part) : [...prev, part]
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          setSelectedParts((prev) =>
                            prev.includes(part) ? prev.filter((p) => p !== part) : [...prev, part]
                          )
                        }
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                    >
                      <Checkbox checked={selectedParts.includes(part)} />
                      <span>{part}</span>
                    </div>
                  ))}
              </div>
            </div>

            {snoozeRules.length > 0 && (
              <div className="space-y-2">
                {snoozeRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <div className="text-foreground">
                      Snooze if {rule.kind === "customer" ? "Customer" : "Part"} is{" "}
                      <span className="font-medium">{rule.value}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeSnoozeRule(rule.id)}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setOpenRules(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                selectedCustomers.forEach((customer) =>
                  addSnoozeRule({ kind: "customer", value: customer })
                )
                selectedParts.forEach((part) => addSnoozeRule({ kind: "part", value: part }))
                setSelectedCustomers([])
                setSelectedParts([])
                setOpenRules(false)
              }}
            >
              Add rules
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
