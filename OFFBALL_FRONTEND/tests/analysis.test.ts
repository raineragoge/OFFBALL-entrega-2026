/**
 * Orquestación del análisis con un cliente falso (los mocks existen SÓLO en tests).
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '../src/api/errors'
import type { EconomicPayload, EconomicResult, OffensivePayload, OffensiveResult } from '../src/api/types'
import { alertState, runAnalysis, type AnalysisApi } from '../src/domain/analysis'
import { buildEconomicPayload, buildOffensivePayload } from '../src/domain/form'
import { FICTIONAL_EXAMPLE } from '../src/domain/example'
import { isOffensiveSub } from '../src/domain/positions'

const ECO: EconomicResult = {
  modelo: 'G02_general_log',
  valor_estimado_eur: 1,
  referencia_directa_eur: 1,
  valor_observado_eur: null,
  diferencia_eur: null,
  diferencia_pct: null,
  residuo_log: null,
  umbral_p95: null,
  alerta_economica: null,
  rango: null,
  goles_90: 0,
  asistencias_90: 0,
  advertencias: [],
}
const OFF: OffensiveResult = { modelo: 'GMM_EXTENDIDO_K5', perfiles: [], afinidad: {}, mejor_zona: 'a', alternativa: 'b', advertencias: [] }

function fakeApi(opts: { ecoFails?: boolean; offFails?: boolean } = {}) {
  const calls = { valoracion: [] as EconomicPayload[], afinidad: [] as OffensivePayload[] }
  const api: AnalysisApi = {
    async valoracion(p) {
      calls.valoracion.push(p)
      if (opts.ecoFails) throw new ApiError('validation', 'x', 422, [{ field: null, message: 'La temporada cerrada debe preceder la valoración entre 1 y 365 días' }])
      return ECO
    },
    async afinidad(p) {
      calls.afinidad.push(p)
      if (opts.offFails) throw new ApiError('network', 'sin red')
      return OFF
    },
  }
  return { api, calls }
}

describe('runAnalysis', () => {
  it('ofensivo: llama a valoración y afinidad con payloads independientes', async () => {
    const { api, calls } = fakeApi()
    const out = await runAnalysis(api, buildEconomicPayload(FICTIONAL_EXAMPLE), buildOffensivePayload(FICTIONAL_EXAMPLE), { offensiveApplies: true })
    expect(calls.valoracion.length).toBe(1)
    expect(calls.afinidad.length).toBe(1)
    expect(calls.valoracion[0]).not.toBe(calls.afinidad[0] as unknown)
    expect(out.economic.status).toBe('ok')
    expect(out.offensive.status).toBe('ok')
  })

  it('posiciones no ofensivas: NO llama al GMM y lo explica', async () => {
    for (const [position, sub] of [
      ['Goalkeeper', 'Goalkeeper'],
      ['Defender', 'Centre-Back'],
      ['Defender', 'Left-Back'],
      ['Midfield', 'Central Midfield'],
      ['Midfield', 'Defensive Midfield'],
    ] as const) {
      expect(isOffensiveSub(sub)).toBe(false)
      const { api, calls } = fakeApi()
      const form = { ...FICTIONAL_EXAMPLE, position, sub_position: sub }
      const out = await runAnalysis(api, buildEconomicPayload(form), null, { offensiveApplies: isOffensiveSub(sub) })
      expect(calls.afinidad.length).toBe(0)
      expect(out.offensive.status).toBe('not_applicable')
      expect(out.economic.status).toBe('ok')
    }
  })

  it('las cinco subposiciones ofensivas sí aplican', () => {
    for (const s of ['Centre-Forward', 'Second Striker', 'Left Winger', 'Right Winger', 'Attacking Midfield']) expect(isOffensiveSub(s)).toBe(true)
  })

  it('éxito parcial: falla la afinidad pero se conserva la valoración', async () => {
    const { api } = fakeApi({ offFails: true })
    const out = await runAnalysis(api, buildEconomicPayload(FICTIONAL_EXAMPLE), buildOffensivePayload(FICTIONAL_EXAMPLE), { offensiveApplies: true })
    expect(out.economic.status).toBe('ok')
    expect(out.offensive.status).toBe('error')
  })

  it('éxito parcial: falla la valoración (422) pero se conserva la afinidad', async () => {
    const { api } = fakeApi({ ecoFails: true })
    const out = await runAnalysis(api, buildEconomicPayload(FICTIONAL_EXAMPLE), buildOffensivePayload(FICTIONAL_EXAMPLE), { offensiveApplies: true })
    expect(out.economic.status).toBe('error')
    if (out.economic.status === 'error') expect(out.economic.error.kind).toBe('validation')
    expect(out.offensive.status).toBe('ok')
  })
})

describe('estado de la alerta P95', () => {
  it('mapea true/false/null sin inventar', () => {
    expect(alertState({ alerta_economica: true })).toBe('posible')
    expect(alertState({ alerta_economica: false })).toBe('sin_alerta')
    expect(alertState({ alerta_economica: null })).toBe('no_evaluada')
  })
})
