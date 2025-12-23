"use client"

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

export function ActionBar() {
  return (
    <div className="mt-4">
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
  )
}
