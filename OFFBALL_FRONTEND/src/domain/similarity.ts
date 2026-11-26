/**
 * Exploración local de similitud — NO es un endpoint del backend ni una predicción GMM.
 *
 * Alcance: sólo análisis manuales guardados en este navegador con todas las
 * variables necesarias (goles/90, asistencias/90 y altura, que son las mismas
 * variables que usa el GMM, más edad y minutos).
 *
 * Método: cada variable se estandariza (z-score) con la media y la desviación
 * típica del propio conjunto guardado; la distancia es euclídea en ese espacio.
 * Si una variable no tiene variación en el conjunto, se ignora. Ningún dato
 * faltante se imputa: los registros incompletos se excluyen.
 */
import type { ManualItem } from '../state/storage'
import { per90 } from './format'

export const SIMILARITY_FEATURES = ['goles_90', 'asistencias_90', 'height_in_cm', 'age', 'minutos'] as const
type Feature = (typeof SIMILARITY_FEATURES)[number]

export interface SimilarityVector {
  id: string
  values: Record<Feature, number>
}

export function vectorFor(item: ManualItem): SimilarityVector | null {
  const f = item.form
  const minutos = Number(f.minutos)
  const goles = Number(f.goles)
  const asist = Number(f.asistencias)
  const h = Number(f.height_in_cm.replace(',', '.'))
  const age = Number(f.age)
  if ([f.minutos, f.goles, f.asistencias, f.height_in_cm, f.age].some((s) => s.trim() === '')) return null
  const g90 = per90(goles, minutos)
  const a90 = per90(asist, minutos)
  if (g90 === null || a90 === null || ![h, age, minutos].every(Number.isFinite)) return null
  return { id: item.id, values: { goles_90: g90, asistencias_90: a90, height_in_cm: h, age, minutos } }
}

export interface Neighbour {
  id: string
  distance: number
}

export function nearest(target: SimilarityVector, pool: SimilarityVector[], k = 3): Neighbour[] {
  const all = [target, ...pool.filter((p) => p.id !== target.id)]
  if (all.length < 3) return []
  const stats = SIMILARITY_FEATURES.map((f) => {
    const xs = all.map((v) => v.values[f])
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length)
    return { f, mean, sd }
  }).filter((s) => s.sd > 0)
  if (stats.length === 0) return []
  const z = (v: SimilarityVector) => stats.map((s) => (v.values[s.f] - s.mean) / s.sd)
  const zt = z(target)
  return pool
    .filter((p) => p.id !== target.id)
    .map((p) => {
      const zp = z(p)
      return { id: p.id, distance: Math.sqrt(zp.reduce((a, x, i) => a + (x - zt[i]!) ** 2, 0)) }
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, k)
}
