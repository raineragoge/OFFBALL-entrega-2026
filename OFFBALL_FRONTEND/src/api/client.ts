/**
 * Cliente único de OFFBALL API v0.1.0.
 * - Base configurable con VITE_API_BASE_URL ("" = mismo origen / proxy).
 * - Timeout con AbortController y cancelación externa (peticiones obsoletas).
 * - Nunca devuelve datos simulados: si falla, lanza ApiError.
 */
import { ApiError, httpMessage, parseValidationDetail } from './errors'
import type {
  EconomicPayload,
  EconomicResult,
  HealthResponse,
  MetadataResponse,
  OffensivePayload,
  OffensiveResult,
  OpportunityQuery,
  OpportunityResponse,
} from './types'
import { buildOpportunityParams } from '../domain/market'
import { isEconomicResult, isOffensiveResult, isOpportunityResponse, isHealth, isMetadata } from './guards'

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>

export interface ClientOptions {
  baseUrl: string
  timeoutMs: number
  fetcher?: Fetcher
}

export interface RequestOptions {
  signal?: AbortSignal
}

function readEnv(): { baseUrl: string; timeoutMs: number } {
  // import.meta.env sólo existe bajo Vite; en tests se pasa la configuración explícita.
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {}
  const raw = env.VITE_API_BASE_URL
  const baseUrl = (raw === undefined ? 'http://localhost:8000' : raw).trim().replace(/\/+$/, '')
  const t = Number(env.VITE_API_TIMEOUT_MS)
  return { baseUrl, timeoutMs: Number.isFinite(t) && t > 0 ? t : 20000 }
}

export class OffballClient {
  readonly baseUrl: string
  readonly timeoutMs: number
  private readonly fetcher: Fetcher

  constructor(opts: ClientOptions) {
    this.baseUrl = opts.baseUrl
    this.timeoutMs = opts.timeoutMs
    this.fetcher = opts.fetcher ?? ((i, init) => fetch(i, init))
  }

  /** Etiqueta legible del destino (para la UI). */
  get displayTarget(): string {
    return this.baseUrl === '' ? 'mismo origen (proxy)' : this.baseUrl
  }

  private async request<T>(
    path: string,
    init: RequestInit,
    guard: (v: unknown) => v is T,
    opts: RequestOptions = {},
  ): Promise<T> {
    const ctrl = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      ctrl.abort()
    }, this.timeoutMs)
    const onExternalAbort = () => ctrl.abort()
    if (opts.signal) {
      if (opts.signal.aborted) ctrl.abort()
      else opts.signal.addEventListener('abort', onExternalAbort, { once: true })
    }

    let res: Response
    try {
      res = await this.fetcher(`${this.baseUrl}${path}`, { ...init, signal: ctrl.signal })
    } catch (e) {
      if (timedOut) throw new ApiError('timeout', `Sin respuesta tras ${Math.round(this.timeoutMs / 1000)} s.`)
      if (ctrl.signal.aborted) throw new ApiError('aborted', 'Petición sustituida por otra más reciente.')
      throw new ApiError(
        'network',
        `No se pudo contactar con ${this.displayTarget}. Comprueba que el contenedor del backend está en marcha y que el origen está permitido por CORS.`,
      )
    } finally {
      clearTimeout(timer)
      opts.signal?.removeEventListener('abort', onExternalAbort)
    }

    let body: unknown = null
    const text = await res.text().catch(() => '')
    if (text) {
      try {
        body = JSON.parse(text)
      } catch {
        if (res.ok) throw new ApiError('parse', 'La API devolvió una respuesta que no es JSON.', res.status)
      }
    }

    if (!res.ok) {
      const detail = (body as { detail?: unknown } | null)?.detail
      if (res.status === 422) {
        const issues = parseValidationDetail(detail)
        throw new ApiError('validation', httpMessage(422), 422, issues)
      }
      const extra = typeof detail === 'string' ? ` ${detail}` : ''
      throw new ApiError('http', `${httpMessage(res.status)}${extra}`, res.status)
    }

    if (!guard(body)) throw new ApiError('parse', 'La respuesta no coincide con el contrato de OFFBALL API v0.1.0.', res.status)
    return body
  }

  health(opts?: RequestOptions) {
    return this.request<HealthResponse>('/health', { method: 'GET' }, isHealth, opts)
  }

  metadata(opts?: RequestOptions) {
    return this.request<MetadataResponse>('/api/v1/metadata', { method: 'GET' }, isMetadata, opts)
  }

  valoracion(payload: EconomicPayload, opts?: RequestOptions) {
    return this.request<EconomicResult>(
      '/api/v1/valoracion',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
      isEconomicResult,
      opts,
    )
  }

  afinidad(payload: OffensivePayload, opts?: RequestOptions) {
    return this.request<OffensiveResult>(
      '/api/v1/afinidad',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
      isOffensiveResult,
      opts,
    )
  }

  oportunidades(query: OpportunityQuery, opts?: RequestOptions) {
    const qs = buildOpportunityParams(query).toString()
    return this.request<OpportunityResponse>(`/api/v1/oportunidades?${qs}`, { method: 'GET' }, isOpportunityResponse, opts)
  }
}

let singleton: OffballClient | null = null
export function getClient(): OffballClient {
  if (!singleton) singleton = new OffballClient(readEnv())
  return singleton
}
