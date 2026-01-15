"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { ChevronDown } from "lucide-react"
import { Filter, X } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  buildPartKey,
  useInventoryData,
  useOpportunitiesForFilters,
} from "@/components/inventory/inventory-data-provider"
import type { PresetKey } from "@/components/inventory/inventory-data-provider"
import type { Opportunity } from "@/lib/inventory/types"
import { rangeFromPreset } from "@/components/inventory/inventory-data-provider"

import { cn } from "@/lib/utils"


type View = {
  label: string
  href: string
}

const VIEWS: View[] = [
  { label: "Control Tower", href: "/inventory/control-tower" },
  { label: "Analytics", href: "/inventory/analytics" },
  { label: "Opportunities", href: "/inventory/opportunities/" },
]

function labelFromPath(pathname: string) {
    const clean = (pathname || "").split("?")[0].replace(/\/+$/, "") // remove query + trailing slash
    const parts = clean.split("/").filter(Boolean)
  
    // Find the segment AFTER "inventory"
    const idx = parts.lastIndexOf("inventory")
    const view = idx >= 0 ? parts[idx + 1] : undefined
  
    switch (view) {
      case "control-tower":
        return "Control Tower"
      case "analytics":
        return "Analytics"
      case "opportunities":
        return "Opportunities"
      default:
        return "Control Tower"
    }
  }  

export function InventorySubnav() {
    const router = useRouter()
    const pathname = usePathname()
    const currentLabel = React.useMemo(() => labelFromPath(pathname), [pathname])
    const [isSticky, setIsSticky] = React.useState(false)
    const sentinelRef = React.useRef<HTMLDivElement | null>(null)
    const { timeframePreset, setTimeframePreset, setDateRange, filters, setFilters, clearFilters } =
      useInventoryData()
    const filterOptions = useOpportunitiesForFilters()
    const [partSearch, setPartSearch] = React.useState("")

    const toggleValue = React.useCallback(<T,>(list: T[], value: T) => {
      if (list.includes(value)) {
        return list.filter((v) => v !== value)
      }
      return [...list, value]
    }, [])

    const [mounted, setMounted] = React.useState(false)
    React.useEffect(() => {
        setMounted(true)
    }, [])
    React.useEffect(() => {
        const observer = new IntersectionObserver(
          ([entry]) => {
            setIsSticky(!entry.isIntersecting)
          },
          {
            rootMargin: "-48px 0px 0px 0px", // header height
            threshold: 0,
          }
        )
      
        if (sentinelRef.current) observer.observe(sentinelRef.current)
      
        return () => observer.disconnect()
      }, [])      

      return (
        <>
          {/* Sentinel */}
          <div ref={sentinelRef} />
      
          {/* Sticky subnav */}
          <div
            className={cn(
              "sticky top-12 z-40 bg-[#F8F9FC] transition-all duration-200",
              isSticky ? "pb-6 shadow-sm" : "pb-0"
            )}
          >
            <div className="px-6 pt-6">
            <div className="flex flex-col gap-5">
            {/* Row 1: Inventory navigation (unchanged content) */}
            <div className="flex items-center gap-6">
                  {/* Left */}
                  <div className="flex items-center gap-2 text-lg min-w-0">
                    <span className="font-medium text-muted-foreground shrink-0">Inventory</span>
                    <span className="text-muted-foreground shrink-0">/</span>

                    <div className="min-w-0">
                      {!mounted ? (
                        <span className="text-lg font-semibold">{currentLabel}</span>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-auto px-1 text-lg font-semibold">
                              {currentLabel}
                              <ChevronDown className="ml-1 h-4 w-4 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>

                          <DropdownMenuContent align="start">
                            {VIEWS.map((v) => (
                              <DropdownMenuItem key={v.href} onClick={() => router.push(v.href)}>
                                {v.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </div>

                {/* Row 2: Controls */}
                <div className="flex items-center gap-4 flex-nowrap whitespace-nowrap">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" className="relative h-10 w-10 bg-white">
                      <Filter className="h-4 w-4 text-muted-foreground" />
                      {[
                        filters.partKeys.length > 0,
                        filters.suggestedActions.length > 0,
                        filters.customers.length > 0,
                        filters.escLevels.length > 0,
                        filters.statuses.length > 0,
                      ].filter(Boolean).length > 0 ? (
                        <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-semibold text-background">
                          {
                            [
                              filters.partKeys.length > 0,
                              filters.suggestedActions.length > 0,
                              filters.customers.length > 0,
                              filters.escLevels.length > 0,
                              filters.statuses.length > 0,
                            ].filter(Boolean).length
                          }
                        </span>
                      ) : null}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[340px]">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-foreground">Filters</div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          clearFilters()
                          setPartSearch("")
                        }}
                      >
                        Clear all
                      </Button>
                    </div>

                    <div className="mt-4 space-y-4">
                      {/* Part name/number */}
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">
                          Part name / number
                        </div>
                        <input
                          value={partSearch}
                          onChange={(e) => setPartSearch(e.target.value)}
                          placeholder="Search parts..."
                          className="h-9 w-full rounded-md border bg-white px-3 text-sm outline-none"
                        />
                        <div className="max-h-40 overflow-y-auto rounded-md border">
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setFilters((prev) => ({ ...prev, partKeys: [] }))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                setFilters((prev) => ({ ...prev, partKeys: [] }))
                              }
                            }}
                            className={cn(
                              "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent",
                              filters.partKeys.length === 0 && "bg-accent"
                            )}
                          >
                            All parts
                            {filters.partKeys.length === 0 ? (
                              <X className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : null}
                          </div>
                          {filterOptions
                            .map((o) => ({
                              key: buildPartKey(o),
                              label: buildPartKey(o),
                            }))
                            .filter((o, idx, arr) => arr.findIndex((x) => x.key === o.key) === idx)
                            .filter((o) =>
                              o.label.toLowerCase().includes(partSearch.trim().toLowerCase())
                            )
                            .sort((a, b) => a.label.localeCompare(b.label))
                            .map((o) => (
                              <div
                                key={o.key}
                                role="button"
                                tabIndex={0}
                                onClick={() =>
                                  setFilters((prev) => ({
                                    ...prev,
                                    partKeys: toggleValue(prev.partKeys, o.key),
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault()
                                    setFilters((prev) => ({
                                      ...prev,
                                      partKeys: toggleValue(prev.partKeys, o.key),
                                    }))
                                  }
                                }}
                                className={cn(
                                  "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <Checkbox checked={filters.partKeys.includes(o.key)} />
                                  <span>{o.label}</span>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* Suggested action */}
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">
                          Suggested action
                        </div>
                        <div className="rounded-md border">
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() =>
                              setFilters((prev) => ({ ...prev, suggestedActions: [] }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                setFilters((prev) => ({ ...prev, suggestedActions: [] }))
                              }
                            }}
                            className={cn(
                              "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent",
                              filters.suggestedActions.length === 0 && "bg-accent"
                            )}
                          >
                            All actions
                            {filters.suggestedActions.length === 0 ? (
                              <X className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : null}
                          </div>
                          {Array.from(new Set(filterOptions.map((o) => o.suggestedAction)))
                            .filter(Boolean)
                            .sort()
                            .map((action) => (
                              <div
                                key={action}
                                role="button"
                                tabIndex={0}
                                onClick={() =>
                                  setFilters((prev) => ({
                                    ...prev,
                                    suggestedActions: toggleValue(
                                      prev.suggestedActions,
                                      action as Opportunity["suggestedAction"]
                                    ),
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault()
                                    setFilters((prev) => ({
                                      ...prev,
                                      suggestedActions: toggleValue(
                                        prev.suggestedActions,
                                        action as Opportunity["suggestedAction"]
                                      ),
                                    }))
                                  }
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                              >
                                <Checkbox
                                  checked={filters.suggestedActions.includes(
                                    action as Opportunity["suggestedAction"]
                                  )}
                                />
                                <span>{action}</span>
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* Customer */}
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">Customer</div>
                        <div className="rounded-md border">
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setFilters((prev) => ({ ...prev, customers: [] }))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                setFilters((prev) => ({ ...prev, customers: [] }))
                              }
                            }}
                            className={cn(
                              "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent",
                              filters.customers.length === 0 && "bg-accent"
                            )}
                          >
                            All customers
                            {filters.customers.length === 0 ? (
                              <X className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : null}
                          </div>
                          {Array.from(new Set(filterOptions.map((o) => o.customer)))
                            .filter(Boolean)
                            .sort()
                            .map((customer) => (
                              <div
                                key={customer}
                                role="button"
                                tabIndex={0}
                                onClick={() =>
                                  setFilters((prev) => ({
                                    ...prev,
                                    customers: toggleValue(prev.customers, customer),
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault()
                                    setFilters((prev) => ({
                                      ...prev,
                                      customers: toggleValue(prev.customers, customer),
                                    }))
                                  }
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                              >
                                <Checkbox checked={filters.customers.includes(customer)} />
                                <span>{customer}</span>
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* Esc. level */}
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">Esc. level</div>
                        <div className="rounded-md border">
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setFilters((prev) => ({ ...prev, escLevels: [] }))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                setFilters((prev) => ({ ...prev, escLevels: [] }))
                              }
                            }}
                            className={cn(
                              "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent",
                              filters.escLevels.length === 0 && "bg-accent"
                            )}
                          >
                            All levels
                            {filters.escLevels.length === 0 ? (
                              <X className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : null}
                          </div>
                          {[1, 2, 3, 4].map((level) => (
                            <div
                              key={level}
                              role="button"
                              tabIndex={0}
                              onClick={() =>
                                setFilters((prev) => ({
                                  ...prev,
                                  escLevels: toggleValue(
                                    prev.escLevels,
                                    level as Opportunity["escLevel"]
                                  ),
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault()
                                  setFilters((prev) => ({
                                    ...prev,
                                    escLevels: toggleValue(
                                      prev.escLevels,
                                      level as Opportunity["escLevel"]
                                    ),
                                  }))
                                }
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                            >
                              <Checkbox checked={filters.escLevels.includes(level as Opportunity["escLevel"])} />
                              <span>{level}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Status */}
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">Status</div>
                        <div className="rounded-md border">
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setFilters((prev) => ({ ...prev, statuses: [] }))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                setFilters((prev) => ({ ...prev, statuses: [] }))
                              }
                            }}
                            className={cn(
                              "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent",
                              filters.statuses.length === 0 && "bg-accent"
                            )}
                          >
                            All statuses
                            {filters.statuses.length === 0 ? (
                              <X className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : null}
                          </div>
                          {["To Do", "In Progress", "Done", "Snoozed"].map((status) => (
                            <div
                              key={status}
                              role="button"
                              tabIndex={0}
                              onClick={() =>
                                setFilters((prev) => ({
                                  ...prev,
                                  statuses: toggleValue(
                                    prev.statuses,
                                    status as Opportunity["status"]
                                  ),
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault()
                                  setFilters((prev) => ({
                                    ...prev,
                                    statuses: toggleValue(
                                      prev.statuses,
                                      status as Opportunity["status"]
                                    ),
                                  }))
                                }
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                            >
                              <Checkbox checked={filters.statuses.includes(status as Opportunity["status"])} />
                              <span>{status}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                  <div className="h-4 w-px bg-[#E5E7EB]" />
                  <Select
                    value={timeframePreset}
                    onValueChange={(v) => {
                      const key = v as PresetKey
                      setTimeframePreset(key)
                      setDateRange(rangeFromPreset(key))
                    }}
                  >
                    <SelectTrigger className="h-11 w-[260px] bg-white px-3">
                      <div className="flex flex-col items-start leading-tight">
                        <span className="text-xs text-muted-foreground">Timeframe</span>
                        <SelectValue />
                      </div>
                    </SelectTrigger>

                    <SelectContent align="start">
                      <SelectItem value="current">Current</SelectItem>

                      <div className="px-2 py-2 text-xs font-medium text-muted-foreground">
                        Projected
                      </div>

                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="tomorrow">Tomorrow</SelectItem>
                      <SelectItem value="eom">End of Month</SelectItem>
                      <SelectItem value="eoq">End of Quarter</SelectItem>
                      <SelectItem value="eoy">End of Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </>
      )
    }      

  