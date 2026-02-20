"use client"

import * as React from "react"
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Label,
} from "recharts"
import { cn } from "@/lib/utils"

/** Min/max donut size so it's "not very small neither" when widget is narrow. */
const CHART_SIZE_MIN = 160
const CHART_SIZE_MAX = 240
/** Fixed height for the chart zone so donuts align across cards. */
const CHART_ZONE_MIN_HEIGHT = 200

export type PieDatum = {
  name: string
  value: number
  displayValue?: string
  percent?: string
  color: string
}

function formatEurCompact(value: number) {
  const abs = Math.abs(value)

  if (abs >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `€${(value / 1_000).toFixed(0)}K`
  return `€${Math.round(value)}`
}

function formatPct(p: number) {
  return `${Math.round(p)}%`
}


type PieBreakdownProps = {
  totalLabel: string
  totalValue: string
  data: PieDatum[]
  selectedCategory?: string | null
  onSelectCategory: (categoryName: string) => void
  /** Compact layout: chart on top, legend below; fits narrow cards in a single row */
  variant?: "default" | "compact"
}

function CenterLabel({
    totalLabel,
    totalValue,
    small,
  }: {
    totalLabel: string
    totalValue: string
    small?: boolean
  }) {
    const labelSize = small ? 10 : 12
    const valueSize = small ? 14 : 16
    const dy = small ? 5 : 6
    const dy2 = small ? 11 : 14
    return (
      <Label
        position="center"
        content={(props: any) => {
          const vb = props?.viewBox
          const cx =
            typeof vb?.cx === "number"
              ? vb.cx
              : typeof props?.cx === "number"
                ? props.cx
                : undefined
          const cy =
            typeof vb?.cy === "number"
              ? vb.cy
              : typeof props?.cy === "number"
                ? props.cy
                : undefined
          const w = typeof vb?.width === "number" ? vb.width : undefined
          const h = typeof vb?.height === "number" ? vb.height : undefined
          if ((cx == null || cy == null) && typeof w === "number" && typeof h === "number") {
            const fallbackCx = (vb.x ?? 0) + w / 2
            const fallbackCy = (vb.y ?? 0) + h / 2
            return (
              <>
                <text x={fallbackCx} y={fallbackCy - dy} textAnchor="middle" className="fill-muted-foreground" fontSize={labelSize}>
                  {totalLabel}
                </text>
                <text x={fallbackCx} y={fallbackCy + dy2} textAnchor="middle" className="fill-foreground" fontSize={valueSize} fontWeight={600}>
                  {totalValue}
                </text>
              </>
            )
          }
          if (typeof cx !== "number" || typeof cy !== "number") return null
          return (
            <>
              <text x={cx} y={cy - dy} textAnchor="middle" className="fill-muted-foreground" fontSize={labelSize}>
                {totalLabel}
              </text>
              <text x={cx} y={cy + dy2} textAnchor="middle" className="fill-foreground" fontSize={valueSize} fontWeight={600}>
                {totalValue}
              </text>
            </>
          )
        }}
      />
    )
  }  

function useContainerWidth(ref: React.RefObject<HTMLElement | null>) {
  const [width, setWidth] = React.useState<number | null>(null)
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setWidth(entry.contentRect.width)
    })
    ro.observe(el)
    setWidth(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [ref])
  return width
}

function chartSizeFromWidth(width: number, isCompact: boolean) {
  const raw = width * (isCompact ? 0.45 : 0.5)
  const w = Math.round(Math.min(CHART_SIZE_MAX, Math.max(CHART_SIZE_MIN, raw)))
  const h = isCompact ? Math.round(w * 0.9) : Math.round(w * 0.72)
  const outerR = Math.min(75, Math.round(w * 0.31))
  const innerR = Math.round(outerR * 0.73)
  return { width: w, height: h, innerR, outerR }
}

export function PieBreakdown({
  totalLabel,
  totalValue,
  data,
  selectedCategory,
  onSelectCategory,
  variant = "default",
}: PieBreakdownProps) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const containerWidth = useContainerWidth(rootRef)
  const [hoveredCategory, setHoveredCategory] = React.useState<string | null>(null)

  const activeCategory = selectedCategory ?? hoveredCategory
  const hasEmphasis = Boolean(activeCategory)

  const isCompact = variant === "compact"
  const effectiveWidth = containerWidth ?? 400
  const chartSize = React.useMemo(
    () => chartSizeFromWidth(effectiveWidth, isCompact),
    [effectiveWidth, isCompact]
  )
  const isSmallDonut = chartSize.outerR < 60

  const legendContent = (
    <div
      className={cn(
        isCompact
          ? "flex flex-wrap items-center justify-center gap-x-3 gap-y-2"
          : "space-y-2"
      )}
    >
      {data.map((d) => {
        const dim = hasEmphasis && activeCategory !== d.name
        return (
          <button
            key={d.name}
            type="button"
            onClick={() => onSelectCategory(d.name)}
            onMouseEnter={() => setHoveredCategory(d.name)}
            onMouseLeave={() => setHoveredCategory(null)}
            className={cn(
              "rounded-lg px-2 py-1 text-left hover:bg-accent",
              isCompact
                ? "inline-flex items-center gap-2"
                : "flex w-full items-center justify-between gap-3"
            )}
            style={{ opacity: dim ? 0.3 : 1 }}
          >
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: d.color }}
              />
              <span className="text-sm text-muted-foreground">
                {d.name}
              </span>
            </div>
            {!isCompact ? (
              <span className="text-foreground shrink-0 text-sm">
                {d.displayValue ?? String(d.value)}
                {d.percent ? (
                  <span className="text-muted-foreground"> ({d.percent})</span>
                ) : null}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )

  return (
    <div
      ref={rootRef}
      className={cn(
        "flex items-start gap-6 min-h-0",
        isCompact && "flex-col items-stretch gap-3",
        !isCompact && "flex-1"
      )}
    >
      <div
        className={cn(
          "shrink-0 flex flex-col items-start",
          isCompact ? "mx-auto" : "",
          !isCompact && "min-h-[var(--chart-zone-height)]"
        )}
        style={
          !isCompact
            ? ({ "--chart-zone-height": `${CHART_ZONE_MIN_HEIGHT}px` } as React.CSSProperties)
            : undefined
        }
      >
        <div
          className="shrink-0"
          style={{
            width: chartSize.width,
            height: chartSize.height,
            minHeight: chartSize.height,
          }}
        >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              contentStyle={{ borderRadius: 10 }}
              formatter={((value: unknown, name: unknown, props: any) => {
                const payload = props?.payload as PieDatum | undefined
                const display = payload?.displayValue ?? formatEurCompact(Number(value ?? 0))
                const percent = payload?.percent ? ` (${payload.percent})` : ""
                const label = typeof name === "string" ? name : ""
                return [`${display}${percent}`, label]
              }) as any}
            />

            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={chartSize.innerR}
              outerRadius={chartSize.outerR}
              paddingAngle={2}
              onClick={(payload) => {
                const name = payload?.name
                if (name) onSelectCategory(String(name))
              }}
              onMouseLeave={() => setHoveredCategory(null)}
              onMouseEnter={(payload) => {
                const name = payload?.name
                if (name) setHoveredCategory(String(name))
              }}
            >
              <CenterLabel totalLabel={totalLabel} totalValue={totalValue} small={isSmallDonut} />

              {data.map((entry) => {
                const dim = hasEmphasis && activeCategory !== entry.name
                return (
                  <Cell
                    key={entry.name}
                    fill={entry.color}
                    fillOpacity={dim ? 0.3 : 1}
                    style={{ cursor: "pointer" }}
                  />
                )
              })}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        </div>
      </div>

      <div className={cn(isCompact ? "min-w-0" : "flex-1")}>
        {legendContent}
      </div>
    </div>
  )
}
