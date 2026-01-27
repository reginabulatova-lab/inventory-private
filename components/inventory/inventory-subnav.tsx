"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { format } from "date-fns"
import type { DateRange as DayPickerRange } from "react-day-picker"
import { Calendar as CalendarIcon, ChevronDown, X } from "lucide-react"
import { Filter } from "lucide-react"
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
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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
    const { timeframePreset, setTimeframePreset, setDateRange, dateRange, filters, setFilters, clearFilters } =
      useInventoryData()
    const filterOptions = useOpportunitiesForFilters()
    const [partSearch, setPartSearch] = React.useState("")
    const [customOpen, setCustomOpen] = React.useState(false)
    const [openScopeDropdown, setOpenScopeDropdown] = React.useState<
      "plant" | "buyerCode" | "mrpCode" | null
    >(null)
  const scopeDefaultsApplied = React.useRef(false)

    const customLabel = React.useMemo(() => {
      if (dateRange.from && dateRange.to) {
        return `Custom (${format(dateRange.from, "dd/MM/yy")} - ${format(
          dateRange.to,
          "dd/MM/yy"
        )})`
      }
      if (dateRange.from) return `Custom (${format(dateRange.from, "dd/MM/yy")} - )`
      return "Custom"
    }, [dateRange.from, dateRange.to])

    const calendarRange = React.useMemo<DayPickerRange | undefined>(() => {
      if (!dateRange.from) return undefined
      return { from: dateRange.from, to: dateRange.to }
    }, [dateRange.from, dateRange.to])

    React.useEffect(() => {
      if (timeframePreset !== "custom") setCustomOpen(false)
    }, [timeframePreset])

    React.useEffect(() => {
      if (timeframePreset !== "custom") return
      if (dateRange.from && dateRange.to) return
      setCustomOpen(true)
    }, [timeframePreset, dateRange.from, dateRange.to])

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

    const scopeOptions = React.useMemo(() => {
      const plants = Array.from(new Set(filterOptions.map((o) => o.plant))).filter(Boolean).sort()
      const buyerCodes = Array.from(new Set(filterOptions.map((o) => o.buyerCode))).filter(Boolean).sort()
      const mrpCodes = Array.from(new Set(filterOptions.map((o) => o.mrpCode))).filter(Boolean).sort()
      return { plants, buyerCodes, mrpCodes }
    }, [filterOptions])

    React.useEffect(() => {
      if (scopeDefaultsApplied.current) return
      if (
        scopeOptions.plants.length === 0 ||
        scopeOptions.buyerCodes.length === 0 ||
        scopeOptions.mrpCodes.length === 0
      ) {
        return
      }

      setFilters((prev) => ({
        ...prev,
        plants: prev.plants.length > 0 ? prev.plants : scopeOptions.plants,
        buyerCodes: prev.buyerCodes.length > 0 ? prev.buyerCodes : scopeOptions.buyerCodes,
        mrpCodes: prev.mrpCodes.length > 0 ? prev.mrpCodes : scopeOptions.mrpCodes,
      }))
      scopeDefaultsApplied.current = true
    }, [scopeOptions, setFilters])

    // Close scope dropdowns when clicking outside
    React.useEffect(() => {
      if (openScopeDropdown === null) return
      
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as HTMLElement
        if (!target.closest('[data-scope-dropdown]')) {
          setOpenScopeDropdown(null)
        }
      }
      
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [openScopeDropdown])      

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
                <div className="flex items-center justify-between gap-4 flex-nowrap whitespace-nowrap">
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
                        filters.plants.length > 0,
                        filters.buyerCodes.length > 0,
                        filters.mrpCodes.length > 0,
                      ].filter(Boolean).length > 0 ? (
                        <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-semibold text-background">
                          {
                            [
                              filters.partKeys.length > 0,
                              filters.suggestedActions.length > 0,
                              filters.customers.length > 0,
                              filters.escLevels.length > 0,
                              filters.statuses.length > 0,
                              filters.plants.length > 0,
                              filters.buyerCodes.length > 0,
                              filters.mrpCodes.length > 0,
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
                      {/* Scope */}
                      <div className="space-y-3 rounded-lg bg-[#E6F7F8] border border-[#BFEFF2] p-3">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                          <span>✨</span>
                          <span>Scope</span>
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                          {/* Plant chip */}
                          {(() => {
                            const allPlants = Array.from(new Set(filterOptions.map((o) => o.plant)))
                              .filter(Boolean)
                              .sort()
                            const selectedPlants = filters.plants.filter((p) => allPlants.includes(p)).sort()
                            const isOpen = openScopeDropdown === "plant"
                            
                            return (
                              <div className="relative" data-scope-dropdown>
                                <div
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setOpenScopeDropdown(isOpen ? null : "plant")
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault()
                                      setOpenScopeDropdown(isOpen ? null : "plant")
                                    }
                                  }}
                                  className="flex items-center gap-1.5 rounded-full bg-white border border-[#D9DDE7] px-3 py-2 text-xs cursor-pointer hover:bg-white/80 transition-colors"
                                >
                                  <span className="font-medium text-muted-foreground">Plant:</span>
                                  <span className="text-foreground">
                                    {selectedPlants.length > 0 ? selectedPlants.join(", ") : "—"}
                                  </span>
                                  {selectedPlants.length > 0 && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setFilters((prev) => ({ ...prev, plants: [] }))
                                      }}
                                      className="ml-1.5 hover:bg-accent rounded-full p-0.5 transition-colors"
                                    >
                                      <X className="h-3 w-3 text-muted-foreground" />
                                    </button>
                                  )}
                                </div>
                                
                                {isOpen && (
                                  <div className="absolute top-full left-0 mt-1 z-50 w-64 rounded-md border bg-white shadow-lg">
                                    <div className="max-h-60 overflow-y-auto p-2">
                                      {(() => {
                                        const allSelected = allPlants.length > 0 && allPlants.every((plant) => filters.plants.includes(plant))
                                        const someSelected = filters.plants.length > 0 && !allSelected
                                        
                                        return (
                                          <div
                                            role="button"
                                            tabIndex={0}
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              if (allSelected) {
                                                setFilters((prev) => ({ ...prev, plants: [] }))
                                              } else {
                                                setFilters((prev) => ({ ...prev, plants: allPlants }))
                                              }
                                            }}
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter" || e.key === " ") {
                                                e.preventDefault()
                                                if (allSelected) {
                                                  setFilters((prev) => ({ ...prev, plants: [] }))
                                                } else {
                                                  setFilters((prev) => ({ ...prev, plants: allPlants }))
                                                }
                                              }
                                            }}
                                            className={cn(
                                              "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent rounded",
                                              filters.plants.length === 0 && "bg-accent"
                                            )}
                                          >
                                            <Checkbox 
                                              checked={allSelected}
                                              className={someSelected ? "data-[state=checked]:bg-primary/50" : ""}
                                            />
                                            <span>All plants</span>
                                          </div>
                                        )
                                      })()}
                                      {allPlants.map((plant) => (
                                        <div
                                          key={plant}
                                          role="button"
                                          tabIndex={0}
                                          onClick={() =>
                                            setFilters((prev) => ({
                                              ...prev,
                                              plants: toggleValue(prev.plants, plant),
                                            }))
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                              e.preventDefault()
                                              setFilters((prev) => ({
                                                ...prev,
                                                plants: toggleValue(prev.plants, plant),
                                              }))
                                            }
                                          }}
                                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent rounded"
                                        >
                                          <Checkbox checked={filters.plants.includes(plant)} />
                                          <span>{plant}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })()}

                          {/* Buyer code chip */}
                          {(() => {
                            const allBuyerCodes = Array.from(new Set(filterOptions.map((o) => o.buyerCode)))
                              .filter(Boolean)
                              .sort()
                            const selectedBuyerCodes = filters.buyerCodes.filter((c) => allBuyerCodes.includes(c)).sort()
                            const isOpen = openScopeDropdown === "buyerCode"
                            
                            return (
                              <div className="relative" data-scope-dropdown>
                                <div
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setOpenScopeDropdown(isOpen ? null : "buyerCode")
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault()
                                      setOpenScopeDropdown(isOpen ? null : "buyerCode")
                                    }
                                  }}
                                  className="flex items-center gap-1.5 rounded-full bg-white border border-[#D9DDE7] px-3 py-2 text-xs cursor-pointer hover:bg-white/80 transition-colors"
                                >
                                  <span className="font-medium text-muted-foreground">Buyer code:</span>
                                  <span className="text-foreground">
                                    {selectedBuyerCodes.length > 0 ? selectedBuyerCodes.join(", ") : "—"}
                                  </span>
                                  {selectedBuyerCodes.length > 0 && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setFilters((prev) => ({ ...prev, buyerCodes: [] }))
                                      }}
                                      className="ml-1.5 hover:bg-accent rounded-full p-0.5 transition-colors"
                                    >
                                      <X className="h-3 w-3 text-muted-foreground" />
                                    </button>
                                  )}
                                </div>
                                
                                {isOpen && (
                                  <div className="absolute top-full left-0 mt-1 z-50 w-64 rounded-md border bg-white shadow-lg">
                                    <div className="max-h-60 overflow-y-auto p-2">
                                      {(() => {
                                        const allSelected = allBuyerCodes.length > 0 && allBuyerCodes.every((code) => filters.buyerCodes.includes(code))
                                        const someSelected = filters.buyerCodes.length > 0 && !allSelected
                                        
                                        return (
                                          <div
                                            role="button"
                                            tabIndex={0}
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              if (allSelected) {
                                                setFilters((prev) => ({ ...prev, buyerCodes: [] }))
                                              } else {
                                                setFilters((prev) => ({ ...prev, buyerCodes: allBuyerCodes }))
                                              }
                                            }}
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter" || e.key === " ") {
                                                e.preventDefault()
                                                if (allSelected) {
                                                  setFilters((prev) => ({ ...prev, buyerCodes: [] }))
                                                } else {
                                                  setFilters((prev) => ({ ...prev, buyerCodes: allBuyerCodes }))
                                                }
                                              }
                                            }}
                                            className={cn(
                                              "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent rounded",
                                              filters.buyerCodes.length === 0 && "bg-accent"
                                            )}
                                          >
                                            <Checkbox 
                                              checked={allSelected}
                                              className={someSelected ? "data-[state=checked]:bg-primary/50" : ""}
                                            />
                                            <span>All buyer codes</span>
                                          </div>
                                        )
                                      })()}
                                      {allBuyerCodes.map((code) => (
                                        <div
                                          key={code}
                                          role="button"
                                          tabIndex={0}
                                          onClick={() =>
                                            setFilters((prev) => ({
                                              ...prev,
                                              buyerCodes: toggleValue(prev.buyerCodes, code),
                                            }))
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                              e.preventDefault()
                                              setFilters((prev) => ({
                                                ...prev,
                                                buyerCodes: toggleValue(prev.buyerCodes, code),
                                              }))
                                            }
                                          }}
                                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent rounded"
                                        >
                                          <Checkbox checked={filters.buyerCodes.includes(code)} />
                                          <span>{code}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })()}

                          {/* MRP code chip */}
                          {(() => {
                            const allMrpCodes = Array.from(new Set(filterOptions.map((o) => o.mrpCode)))
                              .filter(Boolean)
                              .sort()
                            const selectedMrpCodes = filters.mrpCodes.filter((c) => allMrpCodes.includes(c)).sort()
                            const isOpen = openScopeDropdown === "mrpCode"
                            
                            return (
                              <div className="relative" data-scope-dropdown>
                                <div
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setOpenScopeDropdown(isOpen ? null : "mrpCode")
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault()
                                      setOpenScopeDropdown(isOpen ? null : "mrpCode")
                                    }
                                  }}
                                  className="flex items-center gap-1.5 rounded-full bg-white border border-[#D9DDE7] px-3 py-2 text-xs cursor-pointer hover:bg-white/80 transition-colors"
                                >
                                  <span className="font-medium text-muted-foreground">MRP code:</span>
                                  <span className="text-foreground">
                                    {selectedMrpCodes.length > 0 ? selectedMrpCodes.join(", ") : "—"}
                                  </span>
                                  {selectedMrpCodes.length > 0 && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setFilters((prev) => ({ ...prev, mrpCodes: [] }))
                                      }}
                                      className="ml-1.5 hover:bg-accent rounded-full p-0.5 transition-colors"
                                    >
                                      <X className="h-3 w-3 text-muted-foreground" />
                                    </button>
                                  )}
                                </div>
                                
                                {isOpen && (
                                  <div className="absolute top-full left-0 mt-1 z-50 w-64 rounded-md border bg-white shadow-lg">
                                    <div className="max-h-60 overflow-y-auto p-2">
                                      {(() => {
                                        const allSelected = allMrpCodes.length > 0 && allMrpCodes.every((code) => filters.mrpCodes.includes(code))
                                        const someSelected = filters.mrpCodes.length > 0 && !allSelected
                                        
                                        return (
                                          <div
                                            role="button"
                                            tabIndex={0}
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              if (allSelected) {
                                                setFilters((prev) => ({ ...prev, mrpCodes: [] }))
                                              } else {
                                                setFilters((prev) => ({ ...prev, mrpCodes: allMrpCodes }))
                                              }
                                            }}
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter" || e.key === " ") {
                                                e.preventDefault()
                                                if (allSelected) {
                                                  setFilters((prev) => ({ ...prev, mrpCodes: [] }))
                                                } else {
                                                  setFilters((prev) => ({ ...prev, mrpCodes: allMrpCodes }))
                                                }
                                              }
                                            }}
                                            className={cn(
                                              "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent rounded",
                                              filters.mrpCodes.length === 0 && "bg-accent"
                                            )}
                                          >
                                            <Checkbox 
                                              checked={allSelected}
                                              className={someSelected ? "data-[state=checked]:bg-primary/50" : ""}
                                            />
                                            <span>All MRP codes</span>
                                          </div>
                                        )
                                      })()}
                                      {allMrpCodes.map((code) => (
                                        <div
                                          key={code}
                                          role="button"
                                          tabIndex={0}
                                          onClick={() =>
                                            setFilters((prev) => ({
                                              ...prev,
                                              mrpCodes: toggleValue(prev.mrpCodes, code),
                                            }))
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                              e.preventDefault()
                                              setFilters((prev) => ({
                                                ...prev,
                                                mrpCodes: toggleValue(prev.mrpCodes, code),
                                              }))
                                            }
                                          }}
                                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent rounded"
                                        >
                                          <Checkbox checked={filters.mrpCodes.includes(code)} />
                                          <span>{code}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })()}
                        </div>
                      </div>

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
                          {(() => {
                            const allPartKeys = filterOptions
                              .map((o) => buildPartKey(o))
                              .filter((key, idx, arr) => arr.findIndex((x) => x === key) === idx)
                            const allSelected = allPartKeys.length > 0 && allPartKeys.every((key) => filters.partKeys.includes(key))
                            const someSelected = filters.partKeys.length > 0 && !allSelected
                            
                            return (
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (allSelected) {
                                    setFilters((prev) => ({ ...prev, partKeys: [] }))
                                  } else {
                                    setFilters((prev) => ({ ...prev, partKeys: allPartKeys }))
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault()
                                    if (allSelected) {
                                      setFilters((prev) => ({ ...prev, partKeys: [] }))
                                    } else {
                                      setFilters((prev) => ({ ...prev, partKeys: allPartKeys }))
                                    }
                                  }
                                }}
                                className={cn(
                                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent",
                                  filters.partKeys.length === 0 && "bg-accent"
                                )}
                              >
                                <Checkbox 
                                  checked={allSelected}
                                  className={someSelected ? "data-[state=checked]:bg-primary/50" : ""}
                                />
                                <span>All parts</span>
                              </div>
                            )
                          })()}
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
                          {(() => {
                            const allActions = Array.from(new Set(filterOptions.map((o) => o.suggestedAction)))
                              .filter(Boolean)
                              .sort() as Opportunity["suggestedAction"][]
                            const allSelected = allActions.length > 0 && allActions.every((action) => filters.suggestedActions.includes(action))
                            const someSelected = filters.suggestedActions.length > 0 && !allSelected
                            
                            return (
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (allSelected) {
                                    setFilters((prev) => ({ ...prev, suggestedActions: [] }))
                                  } else {
                                    setFilters((prev) => ({ ...prev, suggestedActions: allActions }))
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault()
                                    if (allSelected) {
                                      setFilters((prev) => ({ ...prev, suggestedActions: [] }))
                                    } else {
                                      setFilters((prev) => ({ ...prev, suggestedActions: allActions }))
                                    }
                                  }
                                }}
                                className={cn(
                                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent",
                                  filters.suggestedActions.length === 0 && "bg-accent"
                                )}
                              >
                                <Checkbox 
                                  checked={allSelected}
                                  className={someSelected ? "data-[state=checked]:bg-primary/50" : ""}
                                />
                                <span>All actions</span>
                              </div>
                            )
                          })()}
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
                          {(() => {
                            const allCustomers = Array.from(new Set(filterOptions.map((o) => o.customer)))
                              .filter(Boolean)
                              .sort()
                            const allSelected = allCustomers.length > 0 && allCustomers.every((customer) => filters.customers.includes(customer))
                            const someSelected = filters.customers.length > 0 && !allSelected
                            
                            return (
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (allSelected) {
                                    setFilters((prev) => ({ ...prev, customers: [] }))
                                  } else {
                                    setFilters((prev) => ({ ...prev, customers: allCustomers }))
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault()
                                    if (allSelected) {
                                      setFilters((prev) => ({ ...prev, customers: [] }))
                                    } else {
                                      setFilters((prev) => ({ ...prev, customers: allCustomers }))
                                    }
                                  }
                                }}
                                className={cn(
                                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent",
                                  filters.customers.length === 0 && "bg-accent"
                                )}
                              >
                                <Checkbox 
                                  checked={allSelected}
                                  className={someSelected ? "data-[state=checked]:bg-primary/50" : ""}
                                />
                                <span>All customers</span>
                              </div>
                            )
                          })()}
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
                          {(() => {
                            const allLevels: Opportunity["escLevel"][] = [1, 2, 3, 4]
                            const allSelected = allLevels.every((level) => filters.escLevels.includes(level))
                            const someSelected = filters.escLevels.length > 0 && !allSelected
                            
                            return (
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (allSelected) {
                                    setFilters((prev) => ({ ...prev, escLevels: [] }))
                                  } else {
                                    setFilters((prev) => ({ ...prev, escLevels: allLevels }))
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault()
                                    if (allSelected) {
                                      setFilters((prev) => ({ ...prev, escLevels: [] }))
                                    } else {
                                      setFilters((prev) => ({ ...prev, escLevels: allLevels }))
                                    }
                                  }
                                }}
                                className={cn(
                                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent",
                                  filters.escLevels.length === 0 && "bg-accent"
                                )}
                              >
                                <Checkbox 
                                  checked={allSelected}
                                  className={someSelected ? "data-[state=checked]:bg-primary/50" : ""}
                                />
                                <span>All levels</span>
                              </div>
                            )
                          })()}
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
                          {(() => {
                            const allStatuses: Opportunity["status"][] = ["To Do", "In Progress", "Done", "Snoozed"]
                            const allSelected = allStatuses.every((status) => filters.statuses.includes(status))
                            const someSelected = filters.statuses.length > 0 && !allSelected
                            
                            return (
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (allSelected) {
                                    setFilters((prev) => ({ ...prev, statuses: [] }))
                                  } else {
                                    setFilters((prev) => ({ ...prev, statuses: allStatuses }))
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault()
                                    if (allSelected) {
                                      setFilters((prev) => ({ ...prev, statuses: [] }))
                                    } else {
                                      setFilters((prev) => ({ ...prev, statuses: allStatuses }))
                                    }
                                  }
                                }}
                                className={cn(
                                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent",
                                  filters.statuses.length === 0 && "bg-accent"
                                )}
                              >
                                <Checkbox 
                                  checked={allSelected}
                                  className={someSelected ? "data-[state=checked]:bg-primary/50" : ""}
                                />
                                <span>All statuses</span>
                              </div>
                            )
                          })()}
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
                  <div className="flex items-center gap-2">
                    <Select
                      value={timeframePreset}
                      onValueChange={(v) => {
                        const key = v as PresetKey
                        setTimeframePreset(key)
                        if (key === "custom") {
                          setDateRange({ from: undefined, to: undefined })
                          setCustomOpen(true)
                          return
                        }
                        setCustomOpen(false)
                        setDateRange(rangeFromPreset(key))
                      }}
                    >
                      <SelectTrigger className="h-10 w-[260px] bg-white px-3">
                        <div className="flex flex-col items-start leading-tight">
                          <span className="text-xs text-muted-foreground">Timeframe</span>
                          <span className="relative text-sm font-medium text-foreground">
                            <SelectValue
                              className={timeframePreset === "custom" ? "opacity-0" : ""}
                            />
                            {timeframePreset === "custom" ? (
                              <span className="absolute inset-0 pointer-events-none">
                                {customLabel}
                              </span>
                            ) : null}
                          </span>
                        </div>
                      </SelectTrigger>

                      <SelectContent align="start">
                        <SelectItem value="current">Current</SelectItem>

                        <div className="px-2 py-2 text-xs font-medium text-muted-foreground">
                          Projected
                        </div>

                        <SelectItem value="eom">End of Month</SelectItem>
                        <SelectItem value="eoq">End of Quarter</SelectItem>
                        <SelectItem value="eoy">End of Year</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>

                    {timeframePreset === "custom" ? (
                      <Popover
                        open={customOpen}
                        onOpenChange={(open) => {
                          if (!open && (!dateRange.from || !dateRange.to)) return
                          setCustomOpen(open)
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 bg-white"
                            aria-label="Pick custom date range"
                          >
                            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-auto p-0">
                          <Calendar
                            mode="range"
                            numberOfMonths={2}
                            selected={calendarRange}
                            onSelect={(range) => {
                              if (!range?.from) return
                              setDateRange({ from: range.from, to: range.to })
                              setTimeframePreset("custom")
                              if (range.from && range.to) setCustomOpen(false)
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                    ) : null}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-10 bg-white px-4">
                      Export
                      <ChevronDown className="ml-2 h-4 w-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>XLS</DropdownMenuItem>
                    <DropdownMenuItem>CSV</DropdownMenuItem>
                    <DropdownMenuItem>PDF</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                </div>
              </div>
            </div>
          </div>
        </>
      )
    }      

  