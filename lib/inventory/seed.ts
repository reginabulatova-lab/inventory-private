import type { Opportunity, Plan, OpportunityStatus, SuggestedAction } from "./types"

// Small deterministic pseudo-random helper (stable across refreshes)
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

const PARTS = [
  { name: "Valve Assembly", number: "VA-77821" },
  { name: "Bearing Kit", number: "BK-22109" },
  { name: "Sensor Module", number: "SM-45010" },
  { name: "Gear Housing", number: "GH-90211" },
  { name: "Hydraulic Pump", number: "HP-33018" },
  { name: "Nozzle Plate", number: "NP-11409" },
  { name: "Actuator Rod", number: "AR-77102" },
  { name: "Seal Pack", number: "SP-55219" },
]

const SUPPLIERS = ["LunaCraft", "Celestial Dynamics", "AeroForge", "NovaComponents", "Orion Industrial"]
const CUSTOMERS = ["SkyWorks", "BlueJet", "AeroLink", "StellarWings", "Atlas Airframes"]
const ASSIGNEES = ["A. Martin", "S. Dubois", "C. Leroy", "M. Rossi"]
const TEAMS = ["Supply", "Production", "Customer Support"]
const PLANTS = ["1123", "3535", "2041", "8810"]
const BUYER_CODES = ["AV67", "TY82", "BN29"]
const MRP_CODES = ["XJ45", "WM22", "QR98", "ZL16"]
const STORAGE_LOCATIONS = ["Warehouse A", "Warehouse B", "Warehouse C", "Warehouse D"]

function pick<T>(r: () => number, arr: T[]): T {
  return arr[Math.floor(r() * arr.length)]
}

function weightedStatus(r: () => number): OpportunityStatus {
  const x = r()
  if (x < 0.7) return "Backlog"
  if (x < 0.82) return "To Do"
  if (x < 0.9) return "In Progress"
  if (x < 0.96) return "Done"
  if (x < 0.99) return "Canceled"
  return "Snoozed"
}

function weightedAction(r: () => number): SuggestedAction {
  const x = r()
  if (x < 0.26) return "Push Out"
  if (x < 0.48) return "Cancel"
  if (x < 0.76) return "Pull in"
  if (x < 0.88) return "STO"
  return "Scrap/Sell"
}

function weightedEscLevel(r: () => number): 1 | 2 | 3 | 4 {
  const x = r()
  if (x < 0.45) return 1
  if (x < 0.75) return 2
  if (x < 0.92) return 3
  return 4
}

/**
 * Generates "realistic enough" opportunities:
 * - Different distributions per plan
 * - Dates spread over the year
 * - Numeric cash impact to power KPIs/widgets later
 */
export function seedOpportunities(plan: Plan, count = 220): Opportunity[] {
  const baseSeed = plan === "ERP" ? 12345 : 67890
  const r = mulberry32(baseSeed)

  const today = new Date()
    // Spread forward from today so short presets (Today/Tomorrow/EOM) always have data
    const start = new Date(today)
    const horizonDays = 365

  const out: Opportunity[] = []

  for (let i = 0; i < count; i++) {
    const part = pick(r, PARTS)
    const supplier = pick(r, SUPPLIERS)
    const customer = pick(r, CUSTOMERS)
    const plant = pick(r, PLANTS)
    const buyerCode = pick(r, BUYER_CODES)
    const mrpCode = pick(r, MRP_CODES)
    const status = weightedStatus(r)
    const escLevel = weightedEscLevel(r)

    // ERP plan only in this prototype
    const action = weightedAction(r)

    const supplyType = r() < 0.78 ? "PO" : "PR"
    const leadTimeDays = Math.max(3, Math.round(5 + r() * 40))
    // 70% near-term (0-90 days), 30% anywhere in the next year
    const nearTerm = r() < 0.7
    const dayOffset = nearTerm ? Math.floor(r() * 90) : Math.floor(r() * horizonDays)
    const date = new Date(start.getTime() + dayOffset * 86400000)
    const deliveryOffsetDays = Math.floor(r() * 18) + 3
    const deliveryDate =
      action === "Push Out"
        ? new Date(date.getTime() - deliveryOffsetDays * 86400000)
        : action === "STO" || action === "Scrap/Sell"
          ? new Date(date.getTime() + deliveryOffsetDays * 86400000)
          : date

    // Keep opportunity values in a realistic 5k–150k range
    const minImpact = 5_000
    const maxImpact = 150_000
    let cashImpactEur = Math.round(minImpact + r() * (maxImpact - minImpact))

    const urgencyRoll = r()
    let needDateOffsetDays = 0
    if (urgencyRoll < 0.25) {
      // critical: due very soon (or already late)
      const offset = Math.floor(r() * 6) - 2 // -2..3
      needDateOffsetDays = leadTimeDays + offset
    } else if (urgencyRoll < 0.6) {
      // medium: 7-14 days
      needDateOffsetDays = leadTimeDays + (7 + Math.floor(r() * 8))
    } else {
      // longer-term: 30+ days
      needDateOffsetDays = leadTimeDays + (30 + Math.floor(r() * 45))
    }
    const needDate = new Date(today.getTime() + needDateOffsetDays * 86400000)

    const ageRoll = r()
    let ageDays = 0
    if (ageRoll < 0.25) {
      ageDays = 2 + Math.floor(r() * 5) // 2-6d
    } else if (ageRoll < 0.55) {
      ageDays = 7 + Math.floor(r() * 12) // 7-18d
    } else if (ageRoll < 0.8) {
      ageDays = 19 + Math.floor(r() * 20) // 19-38d
    } else {
      ageDays = 45 + Math.floor(r() * 40) // 45-84d
    }
    const createdAt = new Date(today.getTime() - ageDays * 86400000)
    const todoAt =
      status !== "Backlog"
        ? new Date(createdAt.getTime() + Math.max(0, Math.floor(r() * 2)) * 86400000)
        : null
    const startedAt =
      status === "In Progress" || status === "Done"
        ? new Date((todoAt ?? createdAt).getTime() + Math.max(0, Math.floor(r() * 6)) * 86400000)
        : null
    const completedAt =
      status === "Done" && startedAt
        ? new Date(startedAt.getTime() + Math.max(0, Math.floor(r() * Math.max(1, ageDays / 2))) * 86400000)
        : null

    const assignee = status === "Backlog" ? "" : pick(r, ASSIGNEES)
    const team = status === "Backlog" ? "" : pick(r, TEAMS)

    let currentStorageLocation: string | undefined
    let targetStorageLocation: string | undefined
    if (action === "STO") {
      currentStorageLocation = pick(r, STORAGE_LOCATIONS)
      const others = STORAGE_LOCATIONS.filter((loc) => loc !== currentStorageLocation)
      targetStorageLocation = others.length > 0 ? pick(r, others) : STORAGE_LOCATIONS[0]
    }

    out.push({
      id: `${plan.toLowerCase()}_opp_${i + 1}`,
      plan,
      orderNumber: `${supplyType}-${10000 + i}`,
      objectId: `${supplyType}-${20000 + i}`,
      objectType: supplyType,
      needDate: toISODate(needDate),
      leadTimeDays,
      createdAt: createdAt.toISOString(),
      startedAt: startedAt ? startedAt.toISOString() : null,
      completedAt: completedAt ? completedAt.toISOString() : null,
      todoAt: todoAt ? todoAt.toISOString() : null,
      inProgressAt: startedAt ? startedAt.toISOString() : null,
      doneAt: completedAt ? completedAt.toISOString() : null,
      statusHistory: [
        { status: "Backlog" as OpportunityStatus, timestamp: createdAt.toISOString() },
        ...(todoAt
          ? [{ status: "To Do" as OpportunityStatus, timestamp: todoAt.toISOString() }]
          : []),
        ...(startedAt
          ? [
              {
                status: "In Progress" as OpportunityStatus,
                timestamp: startedAt.toISOString(),
              },
            ]
          : []),
        ...(completedAt
          ? [{ status: "Done" as OpportunityStatus, timestamp: completedAt.toISOString() }]
          : []),
      ],
      partName: part.name,
      partNumber: part.number,
      suggestedAction: action,
      suggestedDate: toISODate(date),
      deliveryDate: toISODate(deliveryDate),
      status,
      assignee,
      team,
      supplier,
      customer,
      escLevel,
      plant,
      buyerCode,
      mrpCode,
      supplyType,
      cashImpactEur,
      ...(action === "STO" && {
        currentStorageLocation,
        targetStorageLocation,
      }),
    })
  }

  return out
}
