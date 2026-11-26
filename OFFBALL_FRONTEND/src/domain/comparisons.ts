/**
 * Referencias de comparación para el mapa táctico y el radar.
 * Sólo se usan resultados REALES ya calculados por la API y guardados en
 * este navegador. La API v0.1.0 no expone la media de cada clúster: la
 * referencia "grupo" es la media de TUS fichas con el mismo perfil dominante
 * (muestra local, n visible), no un centroide del modelo.
 */
import type { OffensiveResult } from '../api/types'
import type { SavedItem } from '../state/storage'
import { meanAffinity } from './pitch'
import { readProfiles } from './profiles'

export interface AffinityRef {
  id: string
  label: string
  kind: 'jugador' | 'grupo' | 'uniforme'
  afinidad: Record<string, number>
  /** Probabilidades por perfil (para el radar), si existen. */
  perfiles?: Record<string, number>
  note?: string
}

const probsOf = (o: OffensiveResult) => Object.fromEntries(o.perfiles.map((p) => [p.perfil, p.probabilidad]))

export function offensiveItems(items: SavedItem[]) {
  return items.filter((i): i is Extract<SavedItem, { origen: 'manual' }> & { offensive: OffensiveResult } => i.origen === 'manual' && !!i.offensive)
}

export function buildAffinityRefs(current: OffensiveResult, items: SavedItem[], excludeId?: string | null): AffinityRef[] {
  const refs: AffinityRef[] = []
  const keys = Object.keys(current.afinidad)
  if (keys.length) {
    refs.push({
      id: 'uniforme',
      label: 'Reparto uniforme',
      kind: 'uniforme',
      afinidad: Object.fromEntries(keys.map((k) => [k, 1 / keys.length])),
      note: 'Referencia neutra: la misma afinidad en todas las zonas.',
    })
  }
  const pool = offensiveItems(items).filter((i) => i.id !== excludeId)
  const top = readProfiles(current.perfiles)?.top
  if (top) {
    const same = pool.filter((i) => readProfiles(i.offensive.perfiles)?.top.perfil === top.perfil)
    const mean = meanAffinity(same.map((i) => i.offensive.afinidad))
    if (mean && same.length >= 1) {
      refs.push({
        id: `grupo:${top.perfil}`,
        label: `Media de tus fichas «${top.perfil}» (n=${same.length})`,
        kind: 'grupo',
        afinidad: mean,
        note: `Media local de ${same.length} ficha${same.length === 1 ? '' : 's'} guardada${same.length === 1 ? '' : 's'} con el mismo perfil dominante. No es la media del clúster en el modelo (la API no la publica).`,
      })
    }
  }
  for (const i of pool) {
    refs.push({
      id: i.id,
      label: i.nombre || 'Análisis sin nombre',
      kind: 'jugador',
      afinidad: i.offensive.afinidad,
      perfiles: probsOf(i.offensive),
    })
  }
  return refs
}
