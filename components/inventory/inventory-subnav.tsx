"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"


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
  
    return (
        <div className="px-6 pt-6">
          <div className="flex items-center justify-between gap-6">
            {/* Left: breadcrumb + dropdown */}
            <div className="flex items-center gap-2 text-lg">
                <span className="font-medium text-muted-foreground">Inventory</span>
                <span className="text-muted-foreground">/</span>

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
            </div>

    
            {/* Right: timeframe + filter (moved from ActionBar) */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Timeframe</span>
    
                <Select defaultValue="current">
                  <SelectTrigger className="h-9 w-[220px] bg-white">
                    <SelectValue placeholder="Current" />
                  </SelectTrigger>
    
                  <SelectContent>
                    <SelectItem value="current">Current</SelectItem>
    
                    <SelectGroup>
                      <SelectLabel>Projected</SelectLabel>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="tomorrow">Tomorrow</SelectItem>
                      <SelectItem value="eom">End of Month</SelectItem>
                      <SelectItem value="eoq">End of Quarter</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
    
              <div className="h-4 w-px bg-[#E5E7EB]" />
    
              <Button variant="outline" className="h-9 gap-2">
                <Plus className="h-4 w-4" />
                Filter
              </Button>
            </div>
          </div>
        </div>
      )
    }
  