/**
 * Posiciones y subposiciones. Los códigos son los del backend (inglés);
 * las etiquetas son sólo de presentación.
 * SUBPOS_CONTRACT replica app/schemas.py v0.1.0 y sólo se usa como respaldo
 * cuando /api/v1/metadata aún no ha respondido (preparar el formulario sin conexión).
 */
import type { Position } from '../api/types'

export const POSITIONS: Position[] = ['Attack', 'Midfield', 'Defender', 'Goalkeeper']

export const SUBPOS_CONTRACT: Record<Position, string[]> = {
  Attack: ['Centre-Forward', 'Second Striker', 'Left Winger', 'Right Winger'],
  Midfield: ['Attacking Midfield', 'Central Midfield', 'Defensive Midfield', 'Left Midfield', 'Right Midfield'],
  Defender: ['Centre-Back', 'Left-Back', 'Right-Back'],
  Goalkeeper: ['Goalkeeper'],
}

/** Subposiciones admitidas por el GMM ofensivo (OffensiveInput.check_offensive). */
export const OFFENSIVE_SUBPOSITIONS = [
  'Centre-Forward',
  'Second Striker',
  'Left Winger',
  'Right Winger',
  'Attacking Midfield',
] as const

export function isOffensiveSub(sub: string | null | undefined): boolean {
  return !!sub && (OFFENSIVE_SUBPOSITIONS as readonly string[]).includes(sub)
}

const POSITION_LABELS: Record<string, string> = {
  Attack: 'Ataque',
  Midfield: 'Centrocampo',
  Defender: 'Defensa',
  Goalkeeper: 'Portería',
}

const SUB_LABELS: Record<string, { label: string; short: string }> = {
  'Centre-Forward': { label: 'Delantero centro', short: 'DC' },
  'Second Striker': { label: 'Segundo delantero', short: 'SD' },
  'Left Winger': { label: 'Extremo izquierdo', short: 'EI' },
  'Right Winger': { label: 'Extremo derecho', short: 'ED' },
  'Attacking Midfield': { label: 'Mediapunta', short: 'MCO' },
  'Central Midfield': { label: 'Mediocentro', short: 'MC' },
  'Defensive Midfield': { label: 'Mediocentro defensivo', short: 'MCD' },
  'Left Midfield': { label: 'Interior izquierdo', short: 'MI' },
  'Right Midfield': { label: 'Interior derecho', short: 'MD' },
  'Centre-Back': { label: 'Defensa central', short: 'DFC' },
  'Left-Back': { label: 'Lateral izquierdo', short: 'LI' },
  'Right-Back': { label: 'Lateral derecho', short: 'LD' },
  Goalkeeper: { label: 'Portero', short: 'POR' },
}

export function positionLabel(code: string | null | undefined): string {
  if (!code) return 'N/D'
  return POSITION_LABELS[code] ?? code
}

export function subLabel(code: string | null | undefined): string {
  if (!code) return 'N/D'
  return SUB_LABELS[code]?.label ?? code
}

export function subShort(code: string | null | undefined): string {
  if (!code) return '—'
  return SUB_LABELS[code]?.short ?? code
}

export function isPosition(v: unknown): v is Position {
  return typeof v === 'string' && (POSITIONS as string[]).includes(v)
}

export const FOOT_LABELS: Record<string, string> = {
  right: 'Diestro',
  left: 'Zurdo',
  both: 'Ambidiestro',
  desconocido: 'Desconocido',
}
