import { describe, expect, it } from 'vitest'
import { buildEconomicPayload, buildOffensivePayload, EMPTY_FORM, validateForm, validateOffensiveOnly, type AnalysisForm } from '../src/domain/form'
import { FICTIONAL_EXAMPLE } from '../src/domain/example'

const ctx = { today: '2026-11-25', corte: '2026-06-12' }

describe('payload económico', () => {
  it('coincide exactamente con la petición de prueba del anexo', () => {
    expect(buildEconomicPayload(FICTIONAL_EXAMPLE)).toEqual({
      position: 'Attack',
      sub_position: 'Centre-Forward',
      minutos: 2100,
      goles: 12,
      asistencias: 5,
      age: 23,
      partidos: 30,
      competition_id: 'ES1',
      market_value_in_eur: 750000,
      fin_temporada: '2025-05-25',
      valuation_date: '2025-06-10',
    })
  })

  it('no envía campos extra (nombre, altura, pie)', () => {
    const p = buildEconomicPayload(FICTIONAL_EXAMPLE) as unknown as Record<string, unknown>
    expect(Object.keys(p).sort()).toEqual(
      ['age', 'asistencias', 'competition_id', 'fin_temporada', 'goles', 'market_value_in_eur', 'minutos', 'partidos', 'position', 'sub_position', 'valuation_date'].sort(),
    )
    expect('nombre' in p).toBe(false)
    expect('height_in_cm' in p).toBe(false)
    expect('foot' in p).toBe(false)
  })

  it('omite el valor observado cuando está vacío', () => {
    const p = buildEconomicPayload({ ...FICTIONAL_EXAMPLE, market_value_in_eur: '' })
    expect('market_value_in_eur' in p).toBe(false)
  })

  it('acepta importes con separador de miles', () => {
    expect(buildEconomicPayload({ ...FICTIONAL_EXAMPLE, market_value_in_eur: '1.250.000' }).market_value_in_eur).toBe(1250000)
  })

  it('usa códigos originales, no etiquetas en español', () => {
    const p = buildEconomicPayload({ ...FICTIONAL_EXAMPLE, position: 'Midfield', sub_position: 'Attacking Midfield', competition_id: 'L1' })
    expect(p.position).toBe('Midfield')
    expect(p.sub_position).toBe('Attacking Midfield')
    expect(p.competition_id).toBe('L1')
  })
})

describe('payload ofensivo', () => {
  it('coincide con la petición de prueba del anexo', () => {
    expect(buildOffensivePayload(FICTIONAL_EXAMPLE)).toEqual({
      position: 'Attack',
      sub_position: 'Centre-Forward',
      minutos: 2100,
      goles: 12,
      asistencias: 5,
      height_in_cm: 183,
      foot: 'right',
    })
  })
  it('omite el pie si no se indicó y no incluye campos económicos', () => {
    const p = buildOffensivePayload({ ...FICTIONAL_EXAMPLE, foot: '' }) as unknown as Record<string, unknown>
    expect('foot' in p).toBe(false)
    for (const k of ['age', 'partidos', 'competition_id', 'market_value_in_eur', 'fin_temporada', 'valuation_date', 'nombre']) expect(k in p).toBe(false)
  })
})

describe('validación compatible con Pydantic', () => {
  const ok: AnalysisForm = { ...FICTIONAL_EXAMPLE }

  it('el ejemplo es válido y ofensivo', () => {
    const v = validateForm(ok, ctx)
    expect(v.errors).toEqual({})
    expect(v.economicReady).toBe(true)
    expect(v.offensiveApplies).toBe(true)
    expect(v.offensiveReady).toBe(true)
  })

  it('formulario vacío no está listo', () => {
    const v = validateForm(EMPTY_FORM, ctx)
    expect(v.economicReady).toBe(false)
    expect(v.errors.position).toBeTruthy()
  })

  it('minutos fuera de rango y superiores a 90 por partido', () => {
    expect(validateForm({ ...ok, minutos: '449' }, ctx).errors.minutos).toBeTruthy()
    expect(validateForm({ ...ok, minutos: '10001' }, ctx).errors.minutos).toBeTruthy()
    expect(validateForm({ ...ok, partidos: '10', minutos: '901' }, ctx).errors.minutos).toContain('900')
    expect(validateForm({ ...ok, partidos: '10', minutos: '900' }, ctx).errors.minutos).toBeUndefined()
  })

  it('rangos de edad, partidos, goles', () => {
    expect(validateForm({ ...ok, age: '14' }, ctx).errors.age).toBeTruthy()
    expect(validateForm({ ...ok, age: '46' }, ctx).errors.age).toBeTruthy()
    expect(validateForm({ ...ok, partidos: '0' }, ctx).errors.partidos).toBeTruthy()
    expect(validateForm({ ...ok, goles: '301' }, ctx).errors.goles).toBeTruthy()
    expect(validateForm({ ...ok, goles: '1.5' }, ctx).errors.goles).toBeTruthy()
  })

  it('valor observado > 0 y ≤ 1e10', () => {
    expect(validateForm({ ...ok, market_value_in_eur: '0' }, ctx).errors.market_value_in_eur).toBeTruthy()
    expect(validateForm({ ...ok, market_value_in_eur: '20000000000' }, ctx).errors.market_value_in_eur).toBeTruthy()
    expect(validateForm({ ...ok, market_value_in_eur: 'abc' }, ctx).errors.market_value_in_eur).toBeTruthy()
    expect(validateForm({ ...ok, market_value_in_eur: '' }, ctx).economicReady).toBe(true)
  })

  it('el cierre precede a la valoración entre 1 y 365 días', () => {
    expect(validateForm({ ...ok, fin_temporada: '2025-06-10', valuation_date: '2025-06-10' }, ctx).errors.valuation_date).toBeTruthy()
    expect(validateForm({ ...ok, fin_temporada: '2025-06-11', valuation_date: '2025-06-10' }, ctx).errors.valuation_date).toBeTruthy()
    expect(validateForm({ ...ok, fin_temporada: '2024-06-10', valuation_date: '2025-06-10' }, ctx).errors.valuation_date).toBeUndefined() // 365
    expect(validateForm({ ...ok, fin_temporada: '2024-06-09', valuation_date: '2025-06-10' }, ctx).errors.valuation_date).toBeTruthy() // 366
  })

  it('rechaza fecha de valoración futura', () => {
    expect(validateForm({ ...ok, fin_temporada: '2026-11-01', valuation_date: '2026-11-26' }, ctx).errors.valuation_date).toContain('futura')
  })

  it('avisa (sin bloquear) si la valoración es posterior al corte', () => {
    const v = validateForm({ ...ok, fin_temporada: '2026-05-30', valuation_date: '2026-07-01' }, ctx)
    expect(v.economicReady).toBe(true)
    expect(v.warnings.length).toBe(1)
    expect(v.warnings[0]).toContain('posterior al corte')
  })

  it('subposición incompatible con posición', () => {
    expect(validateForm({ ...ok, position: 'Defender', sub_position: 'Centre-Forward' }, ctx).errors.sub_position).toBeTruthy()
  })

  it('competición no observada en entrenamiento', () => {
    expect(validateForm({ ...ok, competition_id: 'XX9' }, { ...ctx, competiciones: ['ES1'] }).errors.competition_id).toBeTruthy()
  })

  it('altura obligatoria y en rango sólo para ofensivos', () => {
    expect(validateForm({ ...ok, height_in_cm: '' }, ctx).offensiveReady).toBe(false)
    expect(validateForm({ ...ok, height_in_cm: '139' }, ctx).errors.height_in_cm).toBeTruthy()
    const def = validateForm({ ...ok, position: 'Defender', sub_position: 'Centre-Back', height_in_cm: '' }, ctx)
    expect(def.offensiveApplies).toBe(false)
    expect(def.errors.height_in_cm).toBeUndefined()
    expect(def.economicReady).toBe(true)
  })

  it('acceso posicional rechaza subposiciones no ofensivas', () => {
    expect(validateOffensiveOnly({ ...ok, position: 'Midfield', sub_position: 'Central Midfield' }, ctx).ready).toBe(false)
    expect(validateOffensiveOnly({ ...ok, position: 'Midfield', sub_position: 'Attacking Midfield' }, ctx).ready).toBe(true)
  })
})
