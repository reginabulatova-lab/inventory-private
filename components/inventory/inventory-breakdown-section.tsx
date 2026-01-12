"use client"

import * as React from "react"
import { WidgetCard } from "@/components/inventory/kpi-card"
import { PieBreakdown, PieDatum } from "@/components/inventory/pie-breakdown"
import { BottomSheetModal } from "@/components/inventory/bottom-sheet-modal"
import { PartbookTable } from "@/components/inventory/partbook-table"
import { InventoryProjectionCard } from "@/components/inventory/inventory-projection-card"


export function InventoryBreakdownSection() {
    const [modalOpen, setModalOpen] = React.useState(false)
    const [active, setActive] = React.useState<{ chart: string; category: string } | null>(null)
    
    const [selected, setSelected] = React.useState<Record<string, string | null>>({
      topPrograms: null,
      stockStatus: null,
      wip: null,
    })
    
    const handleSelect = (
      chartKey: "topPrograms" | "stockStatus" | "wip",
      chartName: string,
      category: string
    ) => {
      if (!category) return
    
      // ✅ clear other widgets selection so only one widget is “active”
      setSelected({
        topPrograms: null,
        stockStatus: null,
        wip: null,
        [chartKey]: category,
      })
    
      setActive({ chart: chartName, category })
      setModalOpen(true)
    }
    
    const handleClose = () => {
      setModalOpen(false)
      setActive(null)
    
      // ✅ reset all charts to default state (no dimming, no active category)
      setSelected({
        topPrograms: null,
        stockStatus: null,
        wip: null,
      })
    }    

  const topPrograms: PieDatum[] = [
    { name: "Airbus A350", value: 575, displayValue: "575 K€", percent: "25%", color: "#2563EB" },
    { name: "Boeing 787", value: 460, displayValue: "460 K€", percent: "20%", color: "#0EA5E9" },
    { name: "Boeing 737", value: 414, displayValue: "414 K€", percent: "18%", color: "#F59E0B" },
    { name: "ATR 72", value: 276, displayValue: "276 K€", percent: "12%", color: "#F97316" },
    { name: "Rafale Marine", value: 184, displayValue: "184 K€", percent: "8%", color: "#7C3AED" },
    { name: "Other", value: 138, displayValue: "138 K€", percent: "6%", color: "#9CA3AF" },
  ]

  const stockStatus: PieDatum[] = [
    { name: "Quality Inspection", value: 1000, displayValue: "1,0 M€", percent: "35%", color: "#2563EB" },
    { name: "At Vendor", value: 800, displayValue: "0,8 M€", percent: "30%", color: "#0EA5E9" },
    { name: "Excluded", value: 300, displayValue: "0,3 M€", percent: "20%", color: "#F59E0B" },
    { name: "Blocked", value: 200, displayValue: "0,2 M€", percent: "15%", color: "#F97316" },
  ]

  const wip: PieDatum[] = [
    { name: "Blocked", value: 100, displayValue: "100 K€", percent: "15%", color: "#E11D48" },
    { name: "Conditionally covered", value: 500, displayValue: "500 K€", percent: "45%", color: "#F59E0B" },
    { name: "Covered", value: 300, displayValue: "300 K€", percent: "40%", color: "#22C55E" },
  ]

  const filter =
  active?.chart === "Top 10 Programs"
    ? {
        kind: "program" as const,
        category: active.category,
        topPrograms: topPrograms.map((p) => p.name),
      }
    : active?.chart === "Stock Status"
      ? {
          kind: "stockStatus" as const,
          category: active.category,
        }
      : active?.chart === "WIP"
        ? {
            kind: "wip" as const,
            category: active.category,
          }
        : null

  return (
    <section className="mt-10">
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">
        Inventory Breakdown
      </h2>

      <div className="mt-5 grid grid-cols-12 gap-6">
        <WidgetCard title="Top 10 Programs" size="m">
          <PieBreakdown
            totalLabel="Total"
            totalValue="2,3 M€"
            data={topPrograms}
            selectedCategory={selected.topPrograms}
            onSelectCategory={(cat) => handleSelect("topPrograms", "Top 10 Programs", cat)}
          />
        </WidgetCard>

        <WidgetCard title="Stock Status" tooltip="Inventory split by current stock status." size="m">
          <PieBreakdown
            totalLabel="Total"
            totalValue="2,3 M€"
            data={stockStatus}
            selectedCategory={selected.stockStatus}
            onSelectCategory={(cat) => handleSelect("stockStatus", "Stock Status", cat)}
          />
        </WidgetCard>

        <WidgetCard title="WIP" tooltip="Work-in-progress coverage split." size="m">
          <PieBreakdown
            totalLabel="Total"
            totalValue="900 K€"
            data={wip}
            selectedCategory={selected.wip}
            onSelectCategory={(cat) => handleSelect("wip", "WIP", cat)}
          />
        </WidgetCard>

        <InventoryProjectionCard />
        
      </div>

          <BottomSheetModal
              open={modalOpen}
              title={active ? active.chart : "Details"}
              subtitle={active ? active.category : undefined}
              onClose={handleClose}
          >
              <PartbookTable filter={filter} />
          </BottomSheetModal>

    </section>
  )
}
