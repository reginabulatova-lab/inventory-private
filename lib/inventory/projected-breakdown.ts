import type { Opportunity } from "@/lib/inventory/types"
import type { ProjectionPoint } from "@/components/inventory/projection-series"

export type BreakdownStage = "raw_material" | "wip" | "rotables" | "finished_goods"

export type ProjectedBreakdownPoint = {
  label: string
  date: Date
  totalK: number
  rawMaterialK: number
  wipK: number
  rotablesK: number
  finishedGoodsK: number
}

export type StageSummary = {
  totalValueEur: number
  partsCount: number
  breakdown: Array<{ label: string; valueEur: number }>
}

export type StageDetailRow = {
  id: string
  partNumber: string
  description: string
  quantity: number
  unitValueEur: number
  totalValueEur: number
  percentOfStage: number
  location: string
  status: string
  relatedOpps: number
}

export type RelatedOpportunityRow = {
  id: string
  type: string
  part: string
  context: string
  impactEur: number
  timeToAct: string
  status: string
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashSeed(input: string) {
  let h = 0
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function splitTotal(totalK: number, seedKey: string) {
  const rand = mulberry32(hashSeed(seedKey))
  let raw = 0.35 + rand() * 0.18
  let wip = 0.2 + rand() * 0.15
  let rotables = 0.08 + rand() * 0.12
  let finished = Math.max(0.15, 1 - raw - wip - rotables)
  const sum = raw + wip + rotables + finished
  raw /= sum
  wip /= sum
  rotables /= sum
  finished /= sum

  const rawK = Math.round(totalK * raw)
  const wipK = Math.round(totalK * wip)
  const rotablesK = Math.round(totalK * rotables)
  const finishedK = Math.max(0, totalK - rawK - wipK - rotablesK)
  return { rawK, wipK, rotablesK, finishedK }
}

export function buildProjectedBreakdownSeries(points: ProjectionPoint[]): ProjectedBreakdownPoint[] {
  return points.map((point) => {
    const totalK = point.erp
    const split = splitTotal(totalK, point.label)
    return {
      label: point.label,
      date: point.date,
      totalK,
      rawMaterialK: split.rawK,
      wipK: split.wipK,
      rotablesK: split.rotablesK,
      finishedGoodsK: split.finishedK,
    }
  })
}

function buildStageBreakdown(stage: BreakdownStage, totalValueEur: number, seed: string) {
  const rand = mulberry32(hashSeed(seed))
  const ratio = 0.4 + rand() * 0.2
  const first = Math.round(totalValueEur * ratio)
  const second = Math.max(0, totalValueEur - first)
  if (stage === "raw_material") {
    return [
      { label: "Purchased", valueEur: first },
      { label: "Consigned", valueEur: second },
    ]
  }
  if (stage === "wip") {
    return [
      { label: "At Operation", valueEur: first },
      { label: "In Transit", valueEur: second },
    ]
  }
  if (stage === "rotables") {
    return [
      { label: "Repairable", valueEur: first },
      { label: "Ready", valueEur: second },
    ]
  }
  return [
    { label: "Available", valueEur: first },
    { label: "Reserved", valueEur: second },
  ]
}

function stageLabel(stage: BreakdownStage) {
  if (stage === "raw_material") return "Raw Material"
  if (stage === "wip") return "WIP"
  if (stage === "rotables") return "Rotables"
  return "Finished Goods"
}

export function buildStageDetails(options: {
  stage: BreakdownStage
  point: ProjectedBreakdownPoint
  opportunities: Opportunity[]
}): { summary: StageSummary; rows: StageDetailRow[]; related: RelatedOpportunityRow[] } {
  const { stage, point, opportunities } = options
  const totalValueEur = point.totalK * 1000
  const breakdown = buildStageBreakdown(stage, totalValueEur, `${stage}-${point.label}`)

  const pool = opportunities.length > 0 ? opportunities : []
  const baseCount = pool.length > 0 ? Math.min(30, pool.length) : 24
  const rand = mulberry32(hashSeed(`${stage}-${point.label}-rows`))

  const rows: StageDetailRow[] = Array.from({ length: baseCount }, (_, idx) => {
    const opp = pool[idx % Math.max(1, pool.length)]
    const quantity = Math.max(5, Math.round(20 + rand() * 180))
    const unitValueEur = Math.round(600 + rand() * 5400)
    const totalValue = quantity * unitValueEur
    const percent = totalValueEur > 0 ? Math.round((totalValue / totalValueEur) * 1000) / 10 : 0
    return {
      id: `${stage}-${point.label}-${idx}`,
      partNumber: opp?.partNumber ?? `PN-${1000 + idx}`,
      description: opp?.partName ?? `Component ${idx + 1}`,
      quantity,
      unitValueEur,
      totalValueEur: totalValue,
      percentOfStage: percent,
      location: opp?.plant ?? `PL-${10 + (idx % 7)}`,
      status: opp?.status ?? (rand() > 0.5 ? "In Stock" : "On Order"),
      relatedOpps: Math.max(1, Math.round(rand() * 4)),
    }
  })

  const related: RelatedOpportunityRow[] = Array.from({ length: 6 }, (_, idx) => {
    const opp = pool[(idx * 3) % Math.max(1, pool.length)]
    const impactEur = Math.round(5000 + rand() * 45000)
    return {
      id: `${stage}-${point.label}-rel-${idx}`,
      type: opp?.suggestedAction ?? (rand() > 0.5 ? "Push Out" : "Cancel"),
      part: opp?.partName ?? `Part ${idx + 1}`,
      context:
        stage === "raw_material"
          ? opp?.supplier ?? `Supplier ${idx + 1}`
          : stage === "wip"
            ? `Op ${100 + idx}`
            : stage === "rotables"
              ? `Repair ${idx + 1}`
              : opp?.customer ?? `Customer ${idx + 1}`,
      impactEur,
      timeToAct: `${Math.max(1, Math.round(rand() * 12))} days`,
      status: opp?.status ?? (rand() > 0.5 ? "In Progress" : "Backlog"),
    }
  })

  return {
    summary: {
      totalValueEur,
      partsCount: rows.length,
      breakdown,
    },
    rows,
    related,
  }
}

export function labelForStage(stage: BreakdownStage) {
  return stageLabel(stage)
}
