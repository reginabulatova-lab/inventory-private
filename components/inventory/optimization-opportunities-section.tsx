"use client"

import * as React from "react"
import { WidgetCard } from "@/components/inventory/kpi-card"
import { PieBreakdown, PieDatum } from "@/components/inventory/pie-breakdown"
import { BottomSheetModal } from "@/components/inventory/bottom-sheet-modal"
import { OpportunitiesTable } from "@/components/inventory/opportunities-table"

import {
  BarChart,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

type WidgetKey = "type" | "status" | "concentration"

type Active = {
  widget: WidgetKey
  category: string
} | null


const TYPE_DATA: PieDatum[] = [
  { name: "Push Out", value: 1800, displayValue: "1,8 M€", percent: "85%", color: "#2563EB" },
  { name: "Cancel", value: 500, displayValue: "0,5 M€", percent: "15%", color: "#19A7B0" },
]

const STATUS_DATA: PieDatum[] = [
  { name: "In progress", value: 15, displayValue: "15", percent: "32%", color: "#2563EB" },
  { name: "Not prioritized", value: 12, displayValue: "12", percent: "26%", color: "#19A7B0" },
  { name: "Completed", value: 12, displayValue: "12", percent: "25%", color: "#F59E0B" },
  { name: "Prioritized", value: 8, displayValue: "8", percent: "17%", color: "#F97316" },
]

// mock “opportunities concentration” buckets
const CONCENTRATION = [
  { bucket: "10%", value: 380 },
  { bucket: "20%", value: 350 },
  { bucket: "30%", value: 210 },
  { bucket: "40%", value: 180 },
  { bucket: "50%", value: 140 },
  { bucket: "60%", value: 120 },
  { bucket: "70%", value: 95 },
  { bucket: "80%", value: 80 },
  { bucket: "90%", value: 45 },
  { bucket: "100%", value: 15 },
]

function formatKeur(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(1)} M€`
  return `${Math.round(v)} K€`
}

export function OptimizationOpportunitiesSection() {
  const [open, setOpen] = React.useState(false)
  const [active, setActive] = React.useState<Active>(null)

  // same “only one active at a time” UX as Inventory Breakdown
  const [selected, setSelected] = React.useState<{
    type: string | null
    status: string | null
    concentration: string | null
  }>({ type: null, status: null, concentration: null })

  const close = () => {
    setOpen(false)
    setActive(null)
    setSelected({ type: null, status: null, concentration: null })
  }

  const openModal = (widget: WidgetKey, category: string) => {
    setSelected((prev) => ({ ...prev, [widget]: category }))
    setActive({ widget, category })
    setOpen(true)
  }  

  const modalTitle =
    active?.widget === "type"
      ? "Opportunities by type"
      : active?.widget === "status"
        ? "Opportunities by status"
        : active?.widget === "concentration"
          ? "Opportunities Concentration"
          : "Details"

  const filter =
    active?.widget === "type"
      ? { kind: "type" as const, category: active.category }
      : active?.widget === "status"
        ? { kind: "status" as const, category: active.category }
        : active?.widget === "concentration"
          ? { kind: "concentration" as const, category: active.category }
          : null

  return (
    <section className="mt-10">
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">
        Optimization Opportunities
      </h2>

      <div className="mt-5 grid grid-cols-12 gap-6">
        {/* Card 1 */}
        <WidgetCard title="Opportunities by type" size="m">
          <PieBreakdown
            totalLabel="Total"
            totalValue="2,3 M€"
            data={TYPE_DATA}
            selectedCategory={selected.type}
            onSelectCategory={(cat) => openModal("type", cat)}
          />
        </WidgetCard>

        {/* Card 2 */}
        <WidgetCard title="Opportunities by status" size="m">
          <PieBreakdown
            totalLabel="Total"
            totalValue="1,2 M€"
            data={STATUS_DATA}
            selectedCategory={selected.status}
            onSelectCategory={(cat) => openModal("status", cat)}
          />
        </WidgetCard>

        {/* Card 3 */}
        <WidgetCard title="Opportunities Concentration" size="m">
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={CONCENTRATION} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid opacity={0.25} />
                <XAxis dataKey="bucket" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatKeur(Number(v))}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.35 }}
                  formatter={(v: any) => formatKeur(Number(v))}
                />
                <Bar
                  dataKey="value"
                  radius={[6, 6, 0, 0]}
                  fill="#2563EB"
                  onClick={(d: any) => openModal("concentration", d.bucket)}
                  style={{ cursor: "pointer" }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </WidgetCard>
      </div>

      {/* SAME MODAL COMPONENT, DIFFERENT CONTENT */}
      <BottomSheetModal
        open={open}
        title={modalTitle}
        subtitle={active?.category}
        onClose={close}
      >
        <OpportunitiesTable filter={filter} />
      </BottomSheetModal>
    </section>
  )
}

