/**
 * Perfiles GMM (K = 5): colores consistentes, perfil dominante y perfiles mixtos.
 * Todo se calcula sobre las probabilidades que devuelve /api/v1/afinidad
 * (predict_proba). Nada se infiere para fichas sin resultado ofensivo.
 */
import type { Profile } from '../api/types'

/** Paleta categórica por índice de clúster (coincide con --color-p0…p4). */
export const PROFILE_COLORS = ['#83b9ce', '#e5c383', '#c9a4d3', '#8fd3b6', '#e9a27c'] as const

export function profileColor(cluster: number): string {
  const n = PROFILE_COLORS.length
  return PROFILE_COLORS[((cluster % n) + n) % n]!
}

/** Umbral por debajo del cual el perfil dominante se considera "mixto". */
export const MIXED_THRESHOLD = 0.6

export interface ProfileReading {
  top: Profile
  second: Profile | null
  mixed: boolean
  /** Diferencia entre las dos probabilidades más altas (0–1). */
  margin: number
}

export function readProfiles(perfiles: Profile[]): ProfileReading | null {
  if (!perfiles.length) return null
  const sorted = [...perfiles].sort((a, b) => b.probabilidad - a.probabilidad)
  const top = sorted[0]!
  const second = sorted[1] ?? null
  return { top, second, mixed: top.probabilidad < MIXED_THRESHOLD, margin: top.probabilidad - (second?.probabilidad ?? 0) }
}

/** Perfiles ordenados por clúster (orden estable para radar y franjas). */
export function byCluster(perfiles: Profile[]): Profile[] {
  return [...perfiles].sort((a, b) => a.cluster - b.cluster)
}

/**
 * Lectura en lenguaje llano del NOMBRE del perfil (no añade datos).
 * Si el nombre no coincide con ningún patrón conocido, devuelve null.
 */
export function profileGloss(name: string): string | null {
  const n = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
  if (/sin asistencias/.test(n)) return 'Registros con cero asistencias anotadas: describe el dato, no la capacidad del jugador.'
  if (/goleador|rematador|finalizador/.test(n)) return 'Destaca por sus goles por 90 minutos.'
  if (/asistente|creador|generador/.test(n)) return 'Destaca por sus asistencias por 90 minutos.'
  if (/moderad/.test(n)) return 'Producción ofensiva moderada en goles y asistencias.'
  if (/alto|altura|aereo|corpulent/.test(n)) return 'La altura pesa en la asignación de este perfil.'
  return null
}

/** Texto en lenguaje llano para el modo Esencial. */
export function profileSentence(r: ProfileReading): string {
  const pct = (v: number) => `${Math.round(v * 100)} %`
  if (!r.mixed) return `Perfil claro: ${r.top.perfil} (${pct(r.top.probabilidad)} de probabilidad).`
  if (r.second)
    return `Perfil mixto: reparte su probabilidad entre ${r.top.perfil} (${pct(r.top.probabilidad)}) y ${r.second.perfil} (${pct(r.second.probabilidad)}).`
  return `Perfil mixto: ${r.top.perfil} con ${pct(r.top.probabilidad)}.`
}
