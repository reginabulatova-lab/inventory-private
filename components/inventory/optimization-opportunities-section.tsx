"use client"

import * as React from "react"
import { WidgetCard } from "@/components/inventory/kpi-card"
import { PieBreakdown, PieDatum } from "@/components/inventory/pie-breakdown"
import { BottomSheetModal } from "@/components/inventory/bottom-sheet-modal"
import { OpportunitiesTable } from "@/components/opportunities/opportunities-table"
import {
  useFilteredOpportunities,
  useInventoryData,
} from "@/components/inventory/inventory-data-provider"
import {
  buildConcentrationBuckets,
  capOpportunitiesTotal,
  computeHealthRiskKPIs,
  filterOpportunitiesByMode,
  getOpportunitiesScale,
  getOpportunityMode,
} from "@/lib/inventory/selectors"

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


const STATUS_COLORS = ["#2563EB", "#19A7B0", "#F59E0B"]
const TYPE_COLORS = ["#2563EB", "#19A7B0", "#F59E0B"]

function formatEurCompact(value: number) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `€${(value / 1_000).toFixed(0)}K`
  return `€${Math.round(value)}`
}

function formatPct(value: number, total: number) {
  if (!total) return "0%"
  return `${Math.round((value / total) * 100)}%`
}

function BarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value?: number }>
  label?: string | number
}) {
  if (!active || !payload?.length) return null
  const value = payload[0]?.value ?? 0
  return (
    <div className="rounded-lg border bg-white px-3 py-2 text-sm shadow-sm">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-medium text-foreground">{formatEurCompact(Number(value))}</div>
    </div>
  )
}

export function OptimizationOpportunitiesSection() {
  const [open, setOpen] = React.useState(false)
  const [active, setActive] = React.useState<Active>(null)
  const { dateRange } = useInventoryData()
  const opportunities = useFilteredOpportunities({ includeSnoozed: false })

  const kpis = computeHealthRiskKPIs(opportunities, dateRange.from, dateRange.to)
  const mode = getOpportunityMode(kpis.overstockEur, kpis.understockEur)

  const scopedOpportunities = React.useMemo(
    () => filterOpportunitiesByMode(opportunities, mode),
    [opportunities, mode]
  )
  const baseTotal = React.useMemo(
    () => scopedOpportunities.reduce((sum, opp) => sum + opp.cashImpactEur, 0),
    [scopedOpportunities]
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

  // same “only one active at a time” UX as Inventory Breakdown
  const [selected, setSelected] = React.useState<{
    type: string | null
    status: string | null
    concentration: string | null
  }>({ type: null, status: null, concentration: null })

  const typeData = React.useMemo<PieDatum[]>(() => {
    const totals = scopedOpportunities.reduce(
      (acc, o) => {
        acc[o.suggestedAction] =
          (acc[o.suggestedAction] ?? 0) + Math.round(o.cashImpactEur * scale)
        return acc
      },
      { "Push Out": 0, Cancel: 0, "Pull in": 0 } as Record<string, number>
    )

    const rows =
      mode === "overstock"
        ? [
            { name: "Push Out", value: totals["Push Out"], color: TYPE_COLORS[0] },
            { name: "Cancel", value: totals.Cancel, color: TYPE_COLORS[1] },
          ]
        : [{ name: "Pull in", value: totals["Pull in"], color: TYPE_COLORS[2] }]

    const scaledTotal = rows.reduce((sum, row) => sum + row.value, 0)

    return rows.map((row) => ({
      name: row.name,
      value: row.value,
      displayValue: formatEurCompact(row.value),
      percent: formatPct(row.value, scaledTotal),
      color: row.color,
    }))
  }, [scopedOpportunities, mode, scale])

  const typeTotal = React.useMemo(
    () => typeData.reduce((sum, row) => sum + row.value, 0),
    [typeData]
  )

  const statusData = React.useMemo<PieDatum[]>(() => {
    const totals = scopedOpportunities.reduce(
      (acc, o) => {
        if (o.status === "Snoozed") return acc
        acc[o.status] = (acc[o.status] ?? 0) + Math.round(o.cashImpactEur * scale)
        return acc
      },
      { "In Progress": 0, "To Do": 0, Done: 0 } as Record<string, number>
    )

    const rows = [
      { name: "In Progress", value: totals["In Progress"], color: STATUS_COLORS[0] },
      { name: "To Do", value: totals["To Do"], color: STATUS_COLORS[1] },
      { name: "Done", value: totals.Done, color: STATUS_COLORS[2] },
    ]

    const scaledTotal = rows.reduce((sum, row) => sum + row.value, 0)

    return rows.map((row) => ({
      name: row.name,
      value: row.value,
      displayValue: formatEurCompact(row.value),
      percent: formatPct(row.value, scaledTotal),
      color: row.color,
    }))
  }, [scopedOpportunities, scale])

  const statusTotal = React.useMemo(
    () => statusData.reduce((sum, row) => sum + row.value, 0),
    [statusData]
  )

  const concentrationData = React.useMemo(() => {
    const buckets = buildConcentrationBuckets(scopedOpportunities)
    const rows = buckets.map((bucket) => ({
      bucket: bucket.bucket,
      value: Math.round(bucket.totalEur * scale),
    }))
    return rows
  }, [scopedOpportunities, scale])

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

  const seeAllHref = "/inventory/opportunities"

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
            totalValue={formatEurCompact(typeTotal)}
            data={typeData}
            selectedCategory={selected.type}
            onSelectCategory={(cat) => openModal("type", cat)}
          />
        </WidgetCard>

        {/* Card 2 */}
        <WidgetCard title="Opportunities by status" size="m">
          <PieBreakdown
            totalLabel="Total"
            totalValue={formatEurCompact(statusTotal)}
            data={statusData}
            selectedCategory={selected.status}
            onSelectCategory={(cat) => openModal("status", cat)}
          />
        </WidgetCard>

        {/* Card 3 */}
        <WidgetCard title="Opportunities Concentration" size="m">
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={concentrationData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid opacity={0.25} />
                <XAxis dataKey="bucket" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatEurCompact(Number(v))}
                />
                <Tooltip cursor={{ fill: "hsl(var(--muted))", opacity: 0.35 }} content={<BarTooltip />} />
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
        seeAllHref={seeAllHref}
      >
        <OpportunitiesTable
          filter={filter}
          showToolbar
          showSummary={false}
          includeSnoozed={false}
          actionBarOffsetClass="top-0"
          actionBarGapClass="mt-3"
          actionBarClassName="mt-3"
        />
      </BottomSheetModal>
    </section>
  )
}

