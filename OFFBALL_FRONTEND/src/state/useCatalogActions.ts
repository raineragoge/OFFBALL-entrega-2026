/** Acciones compartidas sobre filas del catálogo: guardar y comparar. */
import { useCallback } from 'react'
import type { OpportunityResponse, OpportunityRow } from '../api/types'
import { useToast } from '../components/ui/toast'
import { catalogIdentity } from '../domain/market'
import { useCompare, useSaved } from './saved'
import { makeCatalogItem } from './storage'

export function useCatalogActions(data: Pick<OpportunityResponse, 'modelo' | 'corte_datos'> | undefined) {
  const toast = useToast()
  const saved = useSaved()
  const compare = useCompare()

  const saveRow = useCallback(
    (r: OpportunityRow) => {
      if (!data) return null
      const item = makeCatalogItem(r, data.modelo, data.corte_datos)
      const result = saved.add(item)
      if (result.added) toast('Ficha de catálogo guardada en seguimiento.')
      else toast('Esta ficha (mismo jugador y fecha de valoración) ya está en seguimiento.', 'warn')
      return item.id
    },
    [data, saved, toast],
  )

  const compareRow = useCallback(
    (r: OpportunityRow) => {
      const id = catalogIdentity(r)
      if (!saved.get(id)) saveRow(r)
      if (compare.ids.includes(id)) return
      const t = compare.toggle(id)
      if (t.full) toast('El comparador ya tiene 3 fichas.', 'warn')
      else toast(`Añadida al comparador (${t.ids.length}/3).`)
    },
    [saveRow, saved, compare, toast],
  )

  return {
    saveRow,
    compareRow,
    isSaved: (r: OpportunityRow) => !!saved.get(catalogIdentity(r)),
    inCompare: (r: OpportunityRow) => compare.ids.includes(catalogIdentity(r)),
  }
}
