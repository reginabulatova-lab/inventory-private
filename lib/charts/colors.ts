type Rgb = { r: number; g: number; b: number }
type Hsl = { h: number; s: number; l: number }

export const BRAND = {
  primary: "#19A7B0",
  secondary: "#F3AF06",
} as const

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function hexToRgb(hex: string): Rgb {
  const cleaned = hex.replace("#", "")
  const value =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((c) => c + c)
          .join("")
      : cleaned
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  return { r, g, b }
}

function rgbToHex({ r, g, b }: Rgb) {
  const toHex = (v: number) => v.toString(16).padStart(2, "0")
  return `#${toHex(clamp(Math.round(r), 0, 255))}${toHex(clamp(Math.round(g), 0, 255))}${toHex(
    clamp(Math.round(b), 0, 255)
  )}`
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min

  let h = 0
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6
    else if (max === gn) h = (bn - rn) / delta + 2
    else h = (rn - gn) / delta + 4
  }
  h = Math.round(h * 60)
  if (h < 0) h += 360

  const l = (max + min) / 2
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1))
  return { h, s, l }
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2

  let r = 0
  let g = 0
  let b = 0

  if (h >= 0 && h < 60) {
    r = c
    g = x
  } else if (h >= 60 && h < 120) {
    r = x
    g = c
  } else if (h >= 120 && h < 180) {
    g = c
    b = x
  } else if (h >= 180 && h < 240) {
    g = x
    b = c
  } else if (h >= 240 && h < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }

  return {
    r: (r + m) * 255,
    g: (g + m) * 255,
    b: (b + m) * 255,
  }
}

function generateScale(
  baseHex: string,
  steps: number,
  lightnessMin: number,
  lightnessMax: number
) {
  const { h, s } = rgbToHsl(hexToRgb(baseHex))
  const min = clamp(lightnessMin, 0, 100) / 100
  const max = clamp(lightnessMax, 0, 100) / 100
  return Array.from({ length: steps }, (_, idx) => {
    const t = steps === 1 ? 0 : idx / (steps - 1)
    const l = max - (max - min) * t
    return rgbToHex(hslToRgb({ h, s, l }))
  })
}

export const PRIMARY_SCALE = generateScale(BRAND.primary, 8, 32, 92)
export const SECONDARY_SCALE = generateScale(BRAND.secondary, 4, 40, 90)

export const STATUS_COLORS = {
  Backlog: PRIMARY_SCALE[1],
  "To Do": PRIMARY_SCALE[3],
  "In Progress": BRAND.secondary,
  Done: PRIMARY_SCALE[6],
  Canceled: PRIMARY_SCALE[0],
  Snoozed: PRIMARY_SCALE[2],
} as const

export const TYPE_COLORS = {
  "Push Out": BRAND.primary,
  Cancel: BRAND.secondary,
  "Pull in": PRIMARY_SCALE[5],
} as const

export const TEAM_SCALE = [
  PRIMARY_SCALE[2],
  PRIMARY_SCALE[3],
  PRIMARY_SCALE[4],
  PRIMARY_SCALE[5],
  PRIMARY_SCALE[6],
]

export const UNASSIGNED_COLOR = PRIMARY_SCALE[0]

export function getTeamColor(team: string | null | undefined, idx: number) {
  if (!team || team === "Unassigned") return UNASSIGNED_COLOR
  return TEAM_SCALE[idx % TEAM_SCALE.length]
}

/** Cyan base for stacked bar chart. */
const STACKED_BAR_CYAN_BASE = "#06B6D4"

/** Stacked bar chart: single cyan hue, punchy so bars don’t feel sad or gray. */
function cyanAtLightness(lightness: number, saturation = 0.42): string {
  const { h } = rgbToHsl(hexToRgb(STACKED_BAR_CYAN_BASE))
  return rgbToHex(hslToRgb({ h, s: saturation, l: lightness / 100 }))
}

export const STACKED_BAR_TEAL = {
  raw_material: cyanAtLightness(58),
  wip: cyanAtLightness(70),
  rotables: cyanAtLightness(76),
  finished_goods: cyanAtLightness(82),
} as const
