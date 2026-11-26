/**
 * Mapeo de las zonas devueltas por /afinidad al campo SVG (media cancha
 * ofensiva, ataque hacia arriba). Los nombres reales vienen del backend
 * (metadata.zonas); aquí sólo se reconocen alias para colocarlos.
 * Una zona no reconocida se muestra en la lista de barras, pero no se
 * dibuja en el campo (no se inventa su posición).
 */
export type ZoneSlot = 'DC' | 'EI' | 'ED' | 'MCO'

const ALIASES: Record<ZoneSlot, string[]> = {
  DC: ['dc', 'delantero centro', 'delantero', 'centre-forward', 'centre forward', 'center forward', 'cf', 'st', 'striker', '9', 'punta'],
  EI: ['ei', 'extremo izquierdo', 'extremo izq', 'left winger', 'left wing', 'lw', 'banda izquierda', 'izquierda'],
  ED: ['ed', 'extremo derecho', 'extremo der', 'right winger', 'right wing', 'rw', 'banda derecha', 'derecha'],
  MCO: ['mco', 'mediapunta', 'media punta', 'attacking midfield', 'attacking midfielder', 'am', 'cam', '10', 'enganche'],
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[_]/g, ' ')
    .trim()

export function zoneSlot(name: string): ZoneSlot | null {
  const n = norm(name)
  for (const slot of Object.keys(ALIASES) as ZoneSlot[]) {
    if (ALIASES[slot].includes(n)) return slot
  }
  return null
}

/** Coordenadas en el viewBox del campo (728 × 573, ataque hacia arriba). */
export const SLOT_POSITION: Record<ZoneSlot, { x: number; y: number }> = {
  DC: { x: 364, y: 150 },
  EI: { x: 128, y: 222 },
  ED: { x: 600, y: 222 },
  MCO: { x: 364, y: 338 },
}

export const SLOT_LABEL: Record<ZoneSlot, string> = {
  DC: 'Delantero centro',
  EI: 'Extremo izquierdo',
  ED: 'Extremo derecho',
  MCO: 'Mediapunta',
}

export function zoneDisplayName(name: string): string {
  const s = zoneSlot(name)
  return s ? `${SLOT_LABEL[s]} (${name})` : name
}

/**
 * Escala de intensidad fija y definida: dominio 0–1 (fracción de afinidad),
 * con raíz cuadrada para que las diferencias en valores bajos sean visibles.
 * Valores iguales producen siempre el mismo color.
 */
export function intensity(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 0
  return Math.sqrt(Math.min(1, v))
}

const LOW = [0x1f, 0x3a, 0x2e] // verde panel
const HIGH = [0xb7, 0xe6, 0x8f] // Signal Lime

export function intensityColor(v: number): string {
  const t = intensity(v)
  const c = LOW.map((l, i) => Math.round(l + (HIGH[i]! - l) * t))
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}

/** Marcas de la leyenda (en fracción) y su posición en la barra (0–1). */
export const LEGEND_TICKS = [0, 0.1, 0.25, 0.5, 1].map((v) => ({ value: v, pos: intensity(v) }))
