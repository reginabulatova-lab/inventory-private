import type { Opportunity, Plan } from "@/lib/inventory/types"

type PartSource = {
  partName: string
  partNumber: string
}

type PartMetrics = PartSource & {
  currentStock: number
  unitValueEur: number
  inventoryValueEur: number
  safetyStock: number
  minLotSize: number
  leadTimeDays: number
  demandPerDay: number
  weeklySupply: number
  supplyOffsetDays: number
  volatility: number
  seed: number
}

export type RiskPart = {
  partName: string
  partNumber: string
  contributionEur: number
  qty: number
}

export type HealthRiskKpis = {
  inventoryEur: number
  overstockEur: number
  understockEur: number
  overstockPartsCount: number
  understockPartsCount: number
  overstockParts: RiskPart[]
  understockParts: RiskPart[]
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seedFromString(input: string) {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function diffDays(from: Date, to: Date) {
  const day = 24 * 60 * 60 * 1000
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / day))
}

export function buildPartSources(opps: Opportunity[], plan: Plan): PartSource[] {
  const map = new Map<string, PartSource>()
  opps
    .filter((o) => o.plan === plan)
    .forEach((o) => {
      if (!map.has(o.partNumber)) {
        map.set(o.partNumber, { partName: o.partName, partNumber: o.partNumber })
      }
    })
  return Array.from(map.values())
}

export function buildPartMetrics(sources: PartSource[]): PartMetrics[] {
  return sources.map((part) => {
    const seed = seedFromString(part.partNumber)
    const r = mulberry32(seed)
    const unitValueEur = Math.round(40 + r() * 180)
    const currentStock = Math.max(0, Math.round(2 + r() * 22))
    const inventoryValueEur = currentStock * unitValueEur
    const safetyStock = Math.max(2, Math.round(4 + r() * 10))
    const minLotSize = Math.max(1, Math.round(2 + r() * 12))
    const leadTimeDays = Math.max(1, Math.round(5 + r() * 20))
    const demandPerDay = Math.max(0, Number((0.2 + r() * 1.6).toFixed(2)))
    const weeklySupply = Math.max(0, Math.round(r() * 10))
    const supplyOffsetDays = Math.round(r() * 6)
    const volatility = Math.max(0, Math.round(r() * 3))

    return {
      ...part,
      currentStock,
      unitValueEur,
      inventoryValueEur,
      safetyStock,
      minLotSize,
      leadTimeDays,
      demandPerDay,
      weeklySupply,
      supplyOffsetDays,
      volatility,
      seed,
    }
  })
}

function clampNonNegative(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, value)
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function toValue(qty: number, unitValue: number) {
  const safeQty = Number.isFinite(qty) ? qty : 0
  const safeUnit = Number.isFinite(unitValue) ? unitValue : 1
  return safeQty * safeUnit
}

function projectedStockRaw(part: PartMetrics, from: Date, date: Date) {
  const days = diffDays(from, date)
  const demand = part.demandPerDay * days
  const supplyEvents = Math.floor((days + part.supplyOffsetDays) / 7)
  const supply = part.weeklySupply * supplyEvents
  const jitter = Math.round(Math.sin((days + part.seed) / 6) * part.volatility)
  return Math.round(part.currentStock - demand + supply + jitter)
}

function buildProjectionSeries(part: PartMetrics, from: Date, to: Date) {
  const start = startOfDay(from)
  const end = startOfDay(to)
  const points: { date: Date; qty: number }[] = []
  const stepDays = 7
  const totalDays = diffDays(start, end)
  for (let d = 0; d <= totalDays; d += stepDays) {
    const date = new Date(start.getTime() + d * 86400000)
    points.push({ date, qty: projectedStockRaw(part, start, date) })
  }
  if (totalDays % stepDays !== 0) {
    points.push({ date: end, qty: projectedStockRaw(part, start, end) })
  }
  return points
}

function getProjectedStockAt(part: PartMetrics, from: Date, to: Date, date: Date) {
  const series = buildProjectionSeries(part, from, to)
  if (!series.length) return safeNumber(part.currentStock, 0)
  const target = startOfDay(date).getTime()
  const sorted = [...series].sort((a, b) => a.date.getTime() - b.date.getTime())
  let candidate = sorted[0]
  for (const point of sorted) {
    if (point.date.getTime() <= target) candidate = point
    else break
  }
  return safeNumber(candidate?.qty ?? safeNumber(part.currentStock, 0), safeNumber(part.currentStock, 0))
}

function minProjectedStock(part: PartMetrics, from: Date, to: Date) {
  const series = buildProjectionSeries(part, from, to)
  if (!series.length) return safeNumber(part.currentStock, 0)
  let min = Number.POSITIVE_INFINITY
  for (const point of series) {
    if (point.qty < min) min = point.qty
  }
  if (!Number.isFinite(min)) {
    return safeNumber(part.currentStock, 0)
  }
  return min
}

function sumContributions(parts: RiskPart[]) {
  return parts.reduce((sum, p) => sum + (Number.isFinite(p.contributionEur) ? p.contributionEur : 0), 0)
}

function scaleRiskParts(parts: RiskPart[], scale: number) {
  if (!Number.isFinite(scale) || scale <= 0 || scale === 1) return parts
  return parts.map((p) => ({
    ...p,
    contributionEur: p.contributionEur * scale,
  }))
}

function normalizeKpis(options: {
  inventoryValue: number
  overstockParts: RiskPart[]
  understockParts: RiskPart[]
}) {
  let inventoryValue = clampNonNegative(options.inventoryValue)
  let overstockParts = options.overstockParts
  let understockParts = options.understockParts
  let overstockValue = clampNonNegative(sumContributions(overstockParts))
  let understockValue = clampNonNegative(sumContributions(understockParts))

  // Hard caps relative to inventory
  overstockValue = Math.min(overstockValue, inventoryValue)
  understockValue = Math.min(understockValue, inventoryValue)

  // Combined risk should not exceed inventory
  const combined = overstockValue + understockValue
  if (combined > inventoryValue && combined > 0) {
    const scale = inventoryValue / combined
    overstockValue *= scale
    understockValue *= scale
    overstockParts = scaleRiskParts(overstockParts, scale)
    understockParts = scaleRiskParts(understockParts, scale)
  }

  // Ratio caps (enterprise ranges)
  const MAX_OVERSTOCK_RATIO = 0.35
  const MAX_UNDERSTOCK_RATIO = 0.2
  const overstockCap = inventoryValue * MAX_OVERSTOCK_RATIO
  if (overstockValue > overstockCap && overstockValue > 0) {
    const scale = overstockCap / overstockValue
    overstockValue *= scale
    overstockParts = scaleRiskParts(overstockParts, scale)
  }
  const understockCap = inventoryValue * MAX_UNDERSTOCK_RATIO
  if (understockValue > understockCap && understockValue > 0) {
    const scale = understockCap / understockValue
    understockValue *= scale
    understockParts = scaleRiskParts(understockParts, scale)
  }

  // Re-apply combined constraint after ratio caps
  const combinedAfter = overstockValue + understockValue
  if (combinedAfter > inventoryValue && combinedAfter > 0) {
    const scale = inventoryValue / combinedAfter
    overstockValue *= scale
    understockValue *= scale
    overstockParts = scaleRiskParts(overstockParts, scale)
    understockParts = scaleRiskParts(understockParts, scale)
  }

  // Keep understock from dominating overstock (if any)
  if (overstockValue > 0) {
    const target = overstockValue * 0.8
    if (understockValue > target && understockValue > 0) {
      const scale = target / understockValue
      understockValue *= scale
      understockParts = scaleRiskParts(understockParts, scale)
    }
  }

  // Parts count consistency with zero values
  if (overstockValue === 0) overstockParts = []
  if (understockValue === 0) understockParts = []

  return {
    inventoryValue,
    overstockValue,
    understockValue,
    overstockParts,
    understockParts,
  }
}

export function computeHealthRiskKpisFromParts(options: {
  parts: PartMetrics[]
  mode: "snapshot" | "projection"
  rangeFrom: Date
  rangeTo: Date
  todayStart: Date
}): HealthRiskKpis {
  const { parts, mode, rangeFrom, rangeTo, todayStart } = options
  const from = startOfDay(rangeFrom)
  const to = startOfDay(rangeTo)
  const today = startOfDay(todayStart)

  const isDev = process.env.NODE_ENV !== "production"
  const stockEvalDate = mode === "projection" ? to : today

  if (from.getTime() < today.getTime() || to.getTime() < today.getTime()) {
    return {
      inventoryEur: 0,
      overstockEur: 0,
      understockEur: 0,
      overstockPartsCount: 0,
      understockPartsCount: 0,
      overstockParts: [],
      understockParts: [],
    }
  }

  let inventoryEur = 0
  const rawOverstockParts: RiskPart[] = []
  const rawUnderstockParts: RiskPart[] = []

  const warnIfInvalid = (
    part: PartMetrics,
    label: string,
    value: number,
    date?: Date
  ) => {
    if (!isDev) return
    if (!Number.isFinite(value) || value < 0) {
      console.warn("Health & Risk KPI invalid value.", {
        label,
        value,
        partNumber: part.partNumber,
        partName: part.partName,
        date: date ? date.toISOString() : undefined,
        mode,
      })
    }
  }

  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i]!

    const unitValue = Number.isFinite(part.unitValueEur) ? part.unitValueEur : isDev ? 1 : 0
    const inventoryStock =
      mode === "projection"
        ? getProjectedStockAt(part, from, to, to)
        : safeNumber(part.currentStock, 0)

    warnIfInvalid(part, "inventoryStock", inventoryStock ?? 0, mode === "projection" ? to : today)
    const safeInventoryStock = clampNonNegative(inventoryStock ?? 0)
    inventoryEur += toValue(safeInventoryStock, unitValue)

    const demandLeadTime = safeNumber(part.demandPerDay, 0) * safeNumber(part.leadTimeDays, 0)
    const maxThresholdBase =
      safeNumber(part.safetyStock, 0) + Math.max(demandLeadTime, safeNumber(part.minLotSize, 0))
    const maxThreshold = isDev ? maxThresholdBase * 0.8 : maxThresholdBase
    const evalStock =
      mode === "projection"
        ? getProjectedStockAt(part, from, to, stockEvalDate)
        : safeNumber(part.currentStock, 0)

    warnIfInvalid(part, "evalStock", evalStock ?? 0, stockEvalDate)
    const safeEvalStock = clampNonNegative(evalStock ?? 0)
    const overstockQty = Math.max(0, safeEvalStock - maxThreshold)

    if (overstockQty > 0) {
      rawOverstockParts.push({
        partName: part.partName,
        partNumber: part.partNumber,
        qty: overstockQty,
        contributionEur: toValue(overstockQty, unitValue),
      })
    }

    if (mode === "projection") {
      const minProjRaw = minProjectedStock(part, from, to)
      warnIfInvalid(part, "minProjectedStock", minProjRaw, to)
      const minProj = clampNonNegative(minProjRaw)
      const shortageQty = Math.max(0, safeNumber(part.safetyStock, 0) - minProj)
      if (shortageQty > 0) {
        rawUnderstockParts.push({
          partName: part.partName,
          partNumber: part.partNumber,
          qty: shortageQty,
          contributionEur: toValue(shortageQty, unitValue),
        })
      }
    }
  }

  if (mode === "snapshot") {
    rawUnderstockParts.length = 0
  }

  // Dev-only: auto-scale to keep values in M€ range.
  if (isDev) {
    let multiplier = 1
    const cap = 1_000_000
    while (inventoryEur * multiplier < 1_000_000 && multiplier < cap) {
      multiplier *= 10
    }
    if (multiplier > cap) multiplier = cap

    inventoryEur *= multiplier
    for (const p of rawOverstockParts) {
      p.contributionEur *= multiplier
    }
    for (const p of rawUnderstockParts) {
      p.contributionEur *= multiplier
    }
  }

  if (isDev) {
    if (
      !Number.isFinite(inventoryEur) ||
      !Number.isFinite(sumContributions(rawOverstockParts)) ||
      !Number.isFinite(sumContributions(rawUnderstockParts)) ||
      inventoryEur < 0 ||
      sumContributions(rawOverstockParts) < 0 ||
      sumContributions(rawUnderstockParts) < 0
    ) {
      console.warn("Health & Risk KPI anomaly detected.", {
        inventoryEur,
        overstockEur: sumContributions(rawOverstockParts),
        understockEur: sumContributions(rawUnderstockParts),
        mode,
        rangeFrom: from.toISOString(),
        rangeTo: to.toISOString(),
      })
    }
  }

  const normalized = normalizeKpis({
    inventoryValue: inventoryEur,
    overstockParts: rawOverstockParts,
    understockParts: rawUnderstockParts,
  })
  inventoryEur = normalized.inventoryValue
  const overstockEur = normalized.overstockValue
  const understockEur = normalized.understockValue
  const overstockParts = normalized.overstockParts
  const understockParts = normalized.understockParts
  const overstockPartsCount = overstockParts.length
  const understockPartsCount = understockParts.length

  if (isDev && overstockEur > 500_000 && overstockPartsCount < 5) {
    console.warn("Overstock seems too concentrated; check counting and aggregation.", {
      overstockEur,
      overstockPartsCount,
    })
  }

  return {
    inventoryEur: Math.round(inventoryEur),
    overstockEur: Math.round(overstockEur),
    understockEur: Math.round(understockEur),
    overstockPartsCount,
    understockPartsCount,
    overstockParts,
    understockParts,
  }
}
