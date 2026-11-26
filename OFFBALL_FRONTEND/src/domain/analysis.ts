/**
 * Orquestación del análisis: valoración siempre; afinidad sólo si la
 * subposición es ofensiva. Las dos peticiones son independientes y se
 * resuelven por separado (éxito parcial).
 */
import type { ApiError } from '../api/errors'
import { toApiError } from '../api/errors'
import type { EconomicPayload, EconomicResult, OffensivePayload, OffensiveResult } from '../api/types'

export type Section<T> =
  | { status: 'ok'; data: T }
  | { status: 'error'; error: ApiError }
  | { status: 'not_applicable'; reason: string }
  | { status: 'skipped'; reason: string }

export interface AnalysisApi {
  valoracion(p: EconomicPayload, o?: { signal?: AbortSignal }): Promise<EconomicResult>
  afinidad(p: OffensivePayload, o?: { signal?: AbortSignal }): Promise<OffensiveResult>
}

export interface AnalysisOutcome {
  economic: Section<EconomicResult>
  offensive: Section<OffensiveResult>
}

export const NOT_OFFENSIVE_REASON =
  'El modelo de perfiles (GMM K=5) está limitado a delanteros centro, segundos delanteros, extremos y mediapuntas. Para esta subposición sólo se calcula la valoración económica.'

export async function runAnalysis(
  api: AnalysisApi,
  economic: EconomicPayload,
  offensive: OffensivePayload | null,
  opts: { signal?: AbortSignal; offensiveApplies: boolean },
): Promise<AnalysisOutcome> {
  const ecoP = api.valoracion(economic, { signal: opts.signal })
  const offP: Promise<OffensiveResult> | null =
    opts.offensiveApplies && offensive ? api.afinidad(offensive, { signal: opts.signal }) : null

  const [eco, off] = await Promise.allSettled([ecoP, offP ?? Promise.resolve(null)])

  const economicSection: Section<EconomicResult> =
    eco.status === 'fulfilled' ? { status: 'ok', data: eco.value } : { status: 'error', error: toApiError(eco.reason) }

  let offensiveSection: Section<OffensiveResult>
  if (!opts.offensiveApplies) offensiveSection = { status: 'not_applicable', reason: NOT_OFFENSIVE_REASON }
  else if (!offP) offensiveSection = { status: 'skipped', reason: 'Faltan datos ofensivos (altura) para calcular la afinidad.' }
  else if (off.status === 'fulfilled' && off.value) offensiveSection = { status: 'ok', data: off.value }
  else offensiveSection = { status: 'error', error: toApiError(off.status === 'rejected' ? off.reason : null) }

  return { economic: economicSection, offensive: offensiveSection }
}

export type AlertState = 'posible' | 'sin_alerta' | 'no_evaluada'

export function alertState(r: Pick<EconomicResult, 'alerta_economica'>): AlertState {
  if (r.alerta_economica === true) return 'posible'
  if (r.alerta_economica === false) return 'sin_alerta'
  return 'no_evaluada'
}

export const ALERT_LABEL: Record<AlertState, string> = {
  posible: 'Posible infravaloración',
  sin_alerta: 'Sin alerta según P95',
  no_evaluada: 'No evaluada',
}

export function alertExplanation(r: EconomicResult): string {
  const s = alertState(r)
  if (s === 'no_evaluada') {
    if (r.valor_observado_eur === null)
      return 'Sin valor observado no se puede calcular el residuo frente al umbral P95.'
    return 'No hay umbral P95 disponible para esta posición y rango de valor.'
  }
  if (s === 'posible')
    return 'El residuo logarítmico (estimación frente a valor observado) supera el percentil 95 calibrado para su posición y rango de valor. Es una señal para revisar, no una garantía de rentabilidad.'
  return 'El residuo logarítmico no supera el percentil 95 calibrado para su posición y rango de valor.'
}

/**
 * Resumen en lenguaje llano (modo Esencial). Sólo reformula cifras de la API:
 * no añade juicios de inversión ni certezas.
 */
export function valueSentence(r: EconomicResult, fmt: (v: number) => string): string {
  const est = fmt(r.valor_estimado_eur)
  if (r.valor_observado_eur === null)
    return `El modelo estima un valor de ${est}. Sin valor observado no se puede comparar con el mercado ni evaluar la señal P95.`
  const obs = fmt(r.valor_observado_eur)
  const pct = r.diferencia_pct
  let base: string
  if (pct === null || !Number.isFinite(pct)) base = `El modelo estima ${est} frente a un valor observado de ${obs}.`
  else if (Math.abs(pct) < 0.5) base = `El modelo estima ${est}, prácticamente igual que su valor observado (${obs}).`
  else
    base = `El modelo estima ${est}, un ${Math.abs(Math.round(pct)).toLocaleString('es-ES')} % ${pct > 0 ? 'más' : 'menos'} que su valor observado (${obs}).`
  const s = alertState(r)
  if (s === 'posible') return `${base} La diferencia supera el umbral P95 de su posición y rango de valor: merece una revisión, no es una garantía.`
  if (s === 'sin_alerta') return `${base} La diferencia está dentro de lo habitual para su posición y rango (no supera el P95).`
  return base
}
