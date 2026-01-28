"use client"

import * as React from "react"
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
  buildPartKey,
  useInventoryData,
  useOpportunitiesForFilters,
} from "@/components/inventory/inventory-data-provider"

type SnoozeRulesDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SnoozeRulesDialog({ open, onOpenChange }: SnoozeRulesDialogProps) {
  const { snoozeRules, addSnoozeRule, removeSnoozeRule } = useInventoryData()
  const filterOptions = useOpportunitiesForFilters()
  const [selectedCustomers, setSelectedCustomers] = React.useState<string[]>([])
  const [selectedParts, setSelectedParts] = React.useState<string[]>([])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          <Button
            variant="ghost"
            onClick={() => {
              setSelectedCustomers([])
              setSelectedParts([])
              onOpenChange(false)
            }}
          >
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
              onOpenChange(false)
            }}
          >
            Add rules
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
