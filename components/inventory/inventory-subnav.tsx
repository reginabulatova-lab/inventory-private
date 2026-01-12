"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { ChevronDown } from "lucide-react"
import { Filter } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"


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
    const [dateRange, setDateRange] = React.useState<{ from?: Date; to?: Date }>({
      from: new Date(new Date().getFullYear(), 0, 1),
      to: new Date(),
    })    
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
                <Button variant="outline" size="icon" className="h-11 w-11 bg-white">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                  </Button>

                  <div className="h-4 w-px bg-[#E5E7EB]" />

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-11 w-[260px] justify-start bg-white px-3 text-left"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />

                        <div className="flex flex-col leading-tight">
                          <span className="text-xs text-muted-foreground">Timeframe</span>

                          {dateRange?.from ? (
                            dateRange.to ? (
                              <span className="truncate text-sm font-medium text-foreground">
                                {format(dateRange.from, "MMM d, yyyy")} – {format(dateRange.to, "MMM d, yyyy")}
                              </span>
                            ) : (
                              <span className="truncate text-sm font-medium text-foreground">
                                {format(dateRange.from, "MMM d, yyyy")}
                              </span>
                            )
                          ) : (
                            <span className="text-sm font-medium text-muted-foreground">Pick a date range</span>
                          )}
                        </div>
                      </Button>
                    </PopoverTrigger>

                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="range"
                        numberOfMonths={2}
                        selected={dateRange as any}
                        onSelect={(range) => setDateRange(range as any)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          </div>
        </>
      )
    }      

  