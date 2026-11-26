/** Comprobaciones mínimas de forma de las respuestas (sin inventar campos). */
import type {
  EconomicResult,
  HealthResponse,
  MetadataResponse,
  OffensiveResult,
  OpportunityResponse,
} from './types'

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isNumOrNull = (v: unknown) => v === null || isNum(v)

export function isHealth(v: unknown): v is HealthResponse {
  return isObj(v) && typeof v.status === 'string'
}

export function isMetadata(v: unknown): v is MetadataResponse {
  return isObj(v) && isObj(v.configuracion) && isObj(v.subposiciones) && Array.isArray(v.zonas) && Array.isArray(v.perfiles)
}

export function isEconomicResult(v: unknown): v is EconomicResult {
  return (
    isObj(v) &&
    isNum(v.valor_estimado_eur) &&
    isNum(v.referencia_directa_eur) &&
    isNumOrNull(v.valor_observado_eur) &&
    isNumOrNull(v.diferencia_pct) &&
    (v.alerta_economica === null || typeof v.alerta_economica === 'boolean') &&
    Array.isArray(v.advertencias)
  )
}

export function isOffensiveResult(v: unknown): v is OffensiveResult {
  return (
    isObj(v) &&
    Array.isArray(v.perfiles) &&
    v.perfiles.every((p) => isObj(p) && isNum(p.probabilidad) && typeof p.perfil === 'string') &&
    isObj(v.afinidad) &&
    Object.values(v.afinidad).every(isNum) &&
    typeof v.mejor_zona === 'string' &&
    typeof v.alternativa === 'string'
  )
}

export function isOpportunityResponse(v: unknown): v is OpportunityResponse {
  return isObj(v) && isNum(v.total) && Array.isArray(v.resultados)
}
