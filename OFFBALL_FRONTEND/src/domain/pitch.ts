/**
 * Mapa táctico ESTIMADO de OFFBALL — lógica pura.
 *
 * Integridad de datos (requisito obligatorio):
 *  - OFFBALL API v0.1.0 NO devuelve coordenadas ni eventos espaciales.
 *  - La única entrada es /api/v1/afinidad → `afinidad`: fracción 0–1 por zona
 *    (DC, EI, ED, MCO; suma 1), calculada a partir de las probabilidades GMM,
 *    una matriz perfil×zona, el pie y un prior.
 *  - Este módulo coloca cada ZONA (un rol táctico) en su área convencional del
 *    campo y la colorea según esa afinidad. No genera acciones, posiciones,
 *    trayectorias ni secuencias temporales.
 *  - El modo "continuo" difumina cada zona con un núcleo gaussiano centrado en
 *    su área: es una representación visual de las mismas cuatro cifras.
 *
 * Coordenadas en metros: media cancha de 68 × 52,5 m (FIFA 105 × 68),
 * origen en la esquina superior izquierda, ataque hacia arriba (y = 0 es la
 * línea de gol rival, y = 52,5 la línea de medio campo).
 */
import type { ZoneSlot } from './zones'
import { zoneSlot, SLOT_LABEL } from './zones'

export const PITCH = {
  width: 68,
  depth: 52.5,
  boxW: 40.32,
  boxD: 16.5,
  sixW: 18.32,
  sixD: 5.5,
  spot: 11,
  arcR: 9.15,
  goalW: 7.32,
  goalD: 2.44,
  cornerR: 1,
} as const

/** Margen alrededor del campo en el viewBox (m). */
export const PITCH_MARGIN = { x: 3, top: 4, bottom: 3 }

export const PITCH_VIEWBOX = {
  x: -PITCH_MARGIN.x,
  y: -PITCH_MARGIN.top,
  w: PITCH.width + 2 * PITCH_MARGIN.x,
  h: PITCH.depth + PITCH_MARGIN.top + PITCH_MARGIN.bottom,
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Área convencional de cada rol en la media cancha ofensiva. */
export const ZONE_RECT: Record<ZoneSlot, Rect> = {
  EI: { x: 0, y: 3, w: 17, h: 31 },
  ED: { x: 51, y: 3, w: 17, h: 31 },
  DC: { x: 17, y: 0, w: 34, h: 20 },
  MCO: { x: 17, y: 20, w: 34, h: 18 },
}

/** Centro del núcleo gaussiano y dispersión (m) para el modo continuo. */
export const ZONE_KERNEL: Record<ZoneSlot, { cx: number; cy: number; sx: number; sy: number }> = {
  DC: { cx: 34, cy: 10, sx: 8.5, sy: 6.5 },
  EI: { cx: 8.5, cy: 18, sx: 5.5, sy: 10 },
  ED: { cx: 59.5, cy: 18, sx: 5.5, sy: 10 },
  MCO: { cx: 34, cy: 29, sx: 8.5, sy: 5.5 },
}

export const ZONE_ORDER: ZoneSlot[] = ['EI', 'DC', 'ED', 'MCO']

export interface ZoneDatum {
  /** Nombre exacto devuelto por la API. */
  name: string
  slot: ZoneSlot | null
  label: string
  value: number
  rank: number
}

/** Normaliza la respuesta de la API a una lista ordenada (sin inventar zonas). */
export function zonesFrom(afinidad: Record<string, number>): ZoneDatum[] {
  const sorted = Object.entries(afinidad)
    .filter(([, v]) => Number.isFinite(v))
    .sort((a, b) => b[1] - a[1])
  return sorted.map(([name, value], i) => {
    const slot = zoneSlot(name)
    return { name, slot, label: slot ? SLOT_LABEL[slot] : name, value, rank: i + 1 }
  })
}

/** Reparto uniforme (referencia neutra): 1 / nº de zonas. */
export function uniformBaseline(afinidad: Record<string, number>): number {
  const n = Object.keys(afinidad).length
  return n > 0 ? 1 / n : 0
}

/** Diferencia por zona A − B (fracciones). Sólo zonas presentes en ambos. */
export function affinityDelta(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const k of Object.keys(a)) if (k in b && Number.isFinite(a[k]) && Number.isFinite(b[k])) out[k] = a[k]! - b[k]!
  return out
}

/** Media por zona de varios repartos (sólo claves comunes a todos). */
export function meanAffinity(list: Record<string, number>[]): Record<string, number> | null {
  if (!list.length) return null
  const keys = Object.keys(list[0]!).filter((k) => list.every((r) => Number.isFinite(r[k])))
  if (!keys.length) return null
  return Object.fromEntries(keys.map((k) => [k, list.reduce((s, r) => s + r[k]!, 0) / list.length]))
}

// ---------------------------------------------------------------- color

type RGB = [number, number, number]

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

/** Rampa secuencial (escala fija 0–1). Coincide con --color-heat-0…5. */
export const HEAT_STOPS: { t: number; c: RGB }[] = [
  { t: 0, c: hex('#13261e') },
  { t: 0.15, c: hex('#326b39') },
  { t: 0.35, c: hex('#87b43a') },
  { t: 0.6, c: hex('#e8d43a') },
  { t: 0.85, c: hex('#f39132') },
  { t: 1, c: hex('#df3d36') },
]

/** Rampa divergente para diferencias: azul (B mayor) ← neutro → lima (A mayor). */
const DIV_NEG = hex('#83b9ce')
const DIV_MID = hex('#1e352b')
const DIV_POS = hex('#b7e68f')

function lerp(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

export function rampRGB(t: number): RGB {
  const x = Math.min(1, Math.max(0, t))
  for (let i = 1; i < HEAT_STOPS.length; i++) {
    const a = HEAT_STOPS[i - 1]!
    const b = HEAT_STOPS[i]!
    if (x <= b.t) return lerp(a.c, b.c, (x - a.t) / (b.t - a.t))
  }
  return HEAT_STOPS[HEAT_STOPS.length - 1]!.c
}

export const rgb = (c: RGB) => `rgb(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])})`

/**
 * Transformación de intensidad: v^gamma (gamma 0,5 = raíz, por defecto).
 * Monótona y fija: el mismo valor produce siempre el mismo color.
 */
export function shape(v: number, gamma: number): number {
  if (!Number.isFinite(v) || v <= 0) return 0
  return Math.pow(Math.min(1, v), gamma)
}

export function heatColor(v: number, gamma = 0.5): string {
  return rgb(rampRGB(shape(v, gamma)))
}

/** Color divergente para una diferencia d ∈ [−1, 1]. */
export function divergingRGB(d: number, gamma = 0.5): RGB {
  const m = shape(Math.abs(d), gamma)
  return lerp(DIV_MID, d >= 0 ? DIV_POS : DIV_NEG, m)
}

export function divergingColor(d: number, gamma = 0.5): string {
  return rgb(divergingRGB(d, gamma))
}

/** Texto legible sobre un color de fondo (contraste simple por luminancia). */
export function inkFor(c: RGB): string {
  const l = (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255
  return l > 0.55 ? '#0d1915' : '#fcfcfa'
}

// ---------------------------------------------------------------- campo continuo

/**
 * Valor del campo continuo en (x, y): suma de núcleos gaussianos de pico
 * igual a la afinidad de cada zona. En el centro de cada zona el valor es
 * (casi) su afinidad; entre zonas decae suavemente. Recortado a [−1, 1].
 */
export function fieldAt(x: number, y: number, values: Partial<Record<ZoneSlot, number>>): number {
  let s = 0
  for (const slot of ZONE_ORDER) {
    const v = values[slot]
    if (v === undefined || !Number.isFinite(v)) continue
    const k = ZONE_KERNEL[slot]
    const dx = (x - k.cx) / k.sx
    const dy = (y - k.cy) / k.sy
    s += v * Math.exp(-0.5 * (dx * dx + dy * dy))
  }
  return Math.max(-1, Math.min(1, s))
}

/**
 * Rasteriza el campo continuo en un buffer RGBA (resolución `ppm` píxeles/m).
 * `diverging` usa la rampa de diferencias; alpha crece con la intensidad para
 * que las áreas sin afinidad dejen ver el césped.
 */
export function rasterizeField(
  values: Partial<Record<ZoneSlot, number>>,
  opts: { ppm: number; gamma: number; opacity: number; diverging?: boolean },
): { width: number; height: number; data: Uint8ClampedArray<ArrayBuffer> } {
  const width = Math.round(PITCH.width * opts.ppm)
  const height = Math.round(PITCH.depth * opts.ppm)
  const data = new Uint8ClampedArray(new ArrayBuffer(width * height * 4))
  for (let j = 0; j < height; j++) {
    const y = (j + 0.5) / opts.ppm
    for (let i = 0; i < width; i++) {
      const x = (i + 0.5) / opts.ppm
      const v = fieldAt(x, y, values)
      const c = opts.diverging ? divergingRGB(v, opts.gamma) : rampRGB(shape(v, opts.gamma))
      const mag = shape(Math.abs(v), opts.gamma)
      const a = opts.opacity * Math.min(1, 0.15 + mag * 1.1)
      const o = (j * width + i) * 4
      data[o] = c[0]
      data[o + 1] = c[1]
      data[o + 2] = c[2]
      data[o + 3] = Math.round(a * 255)
    }
  }
  return { width, height, data }
}

/** Valores por ranura a partir del registro de la API (ignora zonas no reconocidas). */
export function slotValues(afinidad: Record<string, number>): Partial<Record<ZoneSlot, number>> {
  const out: Partial<Record<ZoneSlot, number>> = {}
  for (const [name, v] of Object.entries(afinidad)) {
    const s = zoneSlot(name)
    if (s) out[s] = v
  }
  return out
}

// ---------------------------------------------------------------- zoom

export interface View {
  k: number
  x: number
  y: number
}

export const VIEW_IDENTITY: View = { k: 1, x: 0, y: 0 }

/**
 * Restringe el desplazamiento para que el campo no salga del marco.
 * x, y en fracción del tamaño del contenedor (0 = sin desplazamiento).
 */
export function clampView(v: View, kMin = 1, kMax = 4): View {
  const k = Math.min(kMax, Math.max(kMin, v.k))
  const lim = (k - 1) / 2
  return { k, x: Math.min(lim, Math.max(-lim, v.x)), y: Math.min(lim, Math.max(-lim, v.y)) }
}

/** Zoom manteniendo fijo el punto (px, py) en fracciones −0,5…0,5 del contenedor. */
export function zoomAt(v: View, factor: number, px = 0, py = 0): View {
  const k = Math.min(4, Math.max(1, v.k * factor))
  const r = k / v.k
  return clampView({ k, x: px - (px - v.x) * r, y: py - (py - v.y) * r })
}
