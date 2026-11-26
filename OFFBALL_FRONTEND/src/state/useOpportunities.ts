/** Consulta a GET /api/v1/oportunidades con cancelación de peticiones obsoletas. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { getClient } from '../api/client'
import { toApiError, type ApiError } from '../api/errors'
import type { OpportunityQuery, OpportunityResponse } from '../api/types'

export type OppState = { status: 'loading' | 'ok' | 'error'; data?: OpportunityResponse; error?: ApiError }

export function useOpportunities(query: OpportunityQuery | null, debounceMs = 0) {
  const [state, setState] = useState<OppState>({ status: 'loading' })
  const [tick, setTick] = useState(0)
  const ctrl = useRef<AbortController | null>(null)
  const key = query ? JSON.stringify(query) : null

  useEffect(() => {
    if (!query) return
    const t = window.setTimeout(() => {
      ctrl.current?.abort()
      const c = new AbortController()
      ctrl.current = c
      setState((s) => ({ status: 'loading', data: s.data }))
      getClient()
        .oportunidades(query, { signal: c.signal })
        .then((data) => !c.signal.aborted && setState({ status: 'ok', data }))
        .catch((e) => {
          const error = toApiError(e)
          if (error.kind !== 'aborted') setState({ status: 'error', error })
        })
    }, debounceMs)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick, debounceMs])

  useEffect(() => () => ctrl.current?.abort(), [])
  const reload = useCallback(() => setTick((n) => n + 1), [])
  return { ...state, reload }
}
