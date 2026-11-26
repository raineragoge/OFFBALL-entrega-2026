/**
 * Estado global de conexión: GET /health y GET /api/v1/metadata al iniciar,
 * sin bloquear la navegación. Reintento manual y al recuperar la red.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getClient } from '../api/client'
import { ApiError, toApiError } from '../api/errors'
import type { HealthResponse, MetadataResponse } from '../api/types'
import { COMPETITIONS_CONTRACT } from '../domain/competitions'
import { SUBPOS_CONTRACT } from '../domain/positions'

export type Loadable<T> =
  | { state: 'loading' }
  | { state: 'ok'; data: T; at: number }
  | { state: 'error'; error: ApiError }

export type Connection = 'checking' | 'online' | 'offline' | 'degraded'

interface ApiStatus {
  health: Loadable<HealthResponse>
  metadata: Loadable<MetadataResponse>
  connection: Connection
  target: string
  retry: () => void
  /** Subposiciones: metadata si existe; si no, respaldo del contrato. */
  subposiciones: Record<string, string[]>
  /** Competiciones observadas en entrenamiento (metadata o contrato). */
  competiciones: string[]
  /** true si los catálogos provienen de metadata (no del respaldo). */
  catalogsFromApi: boolean
  corte: string | null
}

const Ctx = createContext<ApiStatus | null>(null)

export function ApiStatusProvider({ children }: { children: ReactNode }) {
  const client = getClient()
  const [health, setHealth] = useState<Loadable<HealthResponse>>({ state: 'loading' })
  const [metadata, setMetadata] = useState<Loadable<MetadataResponse>>({ state: 'loading' })
  const ctrlRef = useRef<AbortController | null>(null)

  const load = useCallback(() => {
    ctrlRef.current?.abort()
    const ctrl = new AbortController()
    ctrlRef.current = ctrl
    setHealth({ state: 'loading' })
    setMetadata((m) => (m.state === 'ok' ? m : { state: 'loading' }))
    client
      .health({ signal: ctrl.signal })
      .then((data) => !ctrl.signal.aborted && setHealth({ state: 'ok', data, at: Date.now() }))
      .catch((e) => {
        const err = toApiError(e)
        if (err.kind !== 'aborted') setHealth({ state: 'error', error: err })
      })
    client
      .metadata({ signal: ctrl.signal })
      .then((data) => !ctrl.signal.aborted && setMetadata({ state: 'ok', data, at: Date.now() }))
      .catch((e) => {
        const err = toApiError(e)
        if (err.kind !== 'aborted') setMetadata((m) => (m.state === 'ok' ? m : { state: 'error', error: err }))
      })
  }, [client])

  useEffect(() => {
    load()
    const onOnline = () => load()
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('online', onOnline)
      ctrlRef.current?.abort()
    }
  }, [load])

  const value = useMemo<ApiStatus>(() => {
    const connection: Connection =
      health.state === 'loading'
        ? 'checking'
        : health.state === 'error'
          ? 'offline'
          : metadata.state === 'error'
            ? 'degraded'
            : 'online'
    const md = metadata.state === 'ok' ? metadata.data : null
    const comps = md?.configuracion?.categorias_entrenamiento?.competition_id
    return {
      health,
      metadata,
      connection,
      target: client.displayTarget,
      retry: load,
      subposiciones: md?.subposiciones ?? SUBPOS_CONTRACT,
      competiciones: Array.isArray(comps) && comps.length ? comps : COMPETITIONS_CONTRACT,
      catalogsFromApi: !!md,
      corte: (health.state === 'ok' ? health.data.corte_datos : null) ?? md?.configuracion?.corte_datos ?? null,
    }
  }, [health, metadata, client, load])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApiStatus(): ApiStatus {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApiStatus fuera de ApiStatusProvider')
  return v
}
