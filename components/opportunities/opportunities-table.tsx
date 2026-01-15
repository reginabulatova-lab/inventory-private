"use client"

import * as React from "react"
import { format } from "date-fns"
import { useFilteredOpportunities, useInventoryData } from "@/components/inventory/inventory-data-provider"

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Status = "To Do" | "In Progress" | "Done" | "Snoozed"
type SuggestedAction = "Pull in" | "Cancel"

export type Opportunity = {
  id: string
  orderNumber: string
  partName: string
  partNumber: string
  suggestedAction: SuggestedAction
  suggestedDate: Date
  status: Status
  assignee: string
}

const seed: Opportunity[] = [
  {
    id: "opp_1",
    orderNumber: "PO-10492",
    partName: "Valve Assembly",
    partNumber: "VA-77821",
    suggestedAction: "Cancel",
    suggestedDate: new Date(),
    status: "To Do",
    assignee: "A. Martin",
  },
  {
    id: "opp_2",
    orderNumber: "PO-10501",
    partName: "Bearing Kit",
    partNumber: "BK-22109",
    suggestedAction: "Pull in",
    suggestedDate: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    status: "In Progress",
    assignee: "S. Dubois",
  },
  {
    id: "opp_3",
    orderNumber: "PO-10519",
    partName: "Sensor Module",
    partNumber: "SM-45010",
    suggestedAction: "Cancel",
    suggestedDate: new Date(Date.now() + 14 * 24 * 3600 * 1000),
    status: "To Do",
    assignee: "–",
  },
]

export function OpportunitiesTable() {
  const rows = useFilteredOpportunities({ includeSnoozed: true })
  const { snoozeByIds } = useInventoryData()  
  const [selected, setSelected] = React.useState<Record<string, boolean>>({})
  const [openSnooze, setOpenSnooze] = React.useState(false)

  const selectedIds = React.useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected]
  )

  const selectedCount = selectedIds.length

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

  const allChecked = rows.length > 0 && selectedCount === rows.length
  const indeterminate = selectedCount > 0 && selectedCount < rows.length

  return (
    <div className="space-y-3">
      {/* Action bar */}
      {selectedCount > 0 && (
        <div className="sticky top-[72px] z-10 flex items-center justify-between rounded-xl border bg-background px-4 py-3 shadow-sm">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{selectedCount}</span>{" "}
            selected
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" className="h-9" onClick={() => setOpenSnooze(true)}>
              Snooze
            </Button>
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
              <TableHead>Suggested Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assignee</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((r) => (
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
                <TableCell>{format(r.suggestedDate, "MMM d, yyyy")}</TableCell>
                <TableCell>
                  <Badge variant={r.status === "Snoozed" ? "secondary" : "outline"}>
                    {r.status}
                  </Badge>
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
    </div>
  )
}
