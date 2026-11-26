import { describe, expect, it } from 'vitest'
import type { EconomicResult, OffensiveResult } from '../src/api/types'
import { valueSentence } from '../src/domain/analysis'
import { buildAffinityRefs } from '../src/domain/comparisons'
import { eurCompact } from '../src/domain/format'
import {
  affinityDelta,
  clampView,
  fieldAt,
  heatColor,
  meanAffinity,
  rasterizeField,
  shape,
  slotValues,
  uniformBaseline,
  zonesFrom,
  zoomAt,
  ZONE_KERNEL,
  ZONE_RECT,
  PITCH,
} from '../src/domain/pitch'
import { MIXED_THRESHOLD, profileColor, readProfiles } from '../src/domain/profiles'
import { selectedMetrics } from '../src/domain/metrics'
import { DEFAULT_PREFS, parsePrefs } from '../src/state/prefs'
import { makeManualItem } from '../src/state/storage'
import { EMPTY_FORM } from '../src/domain/form'

const AF = { DC: 0.435, EI: 0.214, ED: 0.164, MCO: 0.186 }

describe('mapa táctico estimado: integridad', () => {
  it('ordena las zonas de la API sin inventar ninguna', () => {
    const z = zonesFrom({ ...AF, Lateral: 0.001 })
    expect(z.map((x) => x.name)).toEqual(['DC', 'EI', 'MCO', 'ED', 'Lateral'])
    expect(z.find((x) => x.name === 'Lateral')?.slot).toBeNull()
    expect(z[0]!.rank).toBe(1)
  })
  it('las áreas de zona caben en la media cancha reglamentaria', () => {
    for (const r of Object.values(ZONE_RECT)) {
      expect(r.x).toBeGreaterThanOrEqual(0)
      expect(r.y).toBeGreaterThanOrEqual(0)
      expect(r.x + r.w).toBeLessThanOrEqual(PITCH.width)
      expect(r.y + r.h).toBeLessThanOrEqual(PITCH.depth)
    }
  })
  it('el campo continuo vale (casi) la afinidad en el centro de cada zona', () => {
    const v = slotValues(AF)
    for (const [slot, k] of Object.entries(ZONE_KERNEL)) {
      const at = fieldAt(k.cx, k.cy, v)
      const own = v[slot as keyof typeof v]!
      expect(at).toBeGreaterThanOrEqual(own)
      expect(at - own).toBeLessThan(0.05)
    }
  })
  it('sin datos el campo es 0 (no aparece intensidad inventada)', () => {
    expect(fieldAt(34, 10, {})).toBe(0)
    const buf = rasterizeField({}, { ppm: 1, gamma: 0.5, opacity: 1 })
    expect(buf.width).toBe(68)
    expect(buf.data.length).toBe(68 * Math.round(52.5) * 4)
  })
  it('escala de color fija y monótona; el contraste no altera los valores', () => {
    expect(heatColor(0.3)).toBe(heatColor(0.3))
    expect(shape(0.25, 0.5)).toBeCloseTo(0.5, 9)
    expect(shape(0.1, 0.5)).toBeLessThan(shape(0.2, 0.5))
    expect(shape(2, 0.5)).toBe(1)
    expect(shape(-1, 0.5)).toBe(0)
  })
  it('referencias de comparación: uniforme, diferencias y medias por claves comunes', () => {
    expect(uniformBaseline(AF)).toBe(0.25)
    const d = affinityDelta(AF, { DC: 0.25, EI: 0.25 })
    expect(Object.keys(d)).toEqual(['DC', 'EI'])
    expect(d.DC).toBeCloseTo(0.185, 9)
    expect(meanAffinity([{ DC: 0.4, EI: 0.6 }, { DC: 0.2, EI: 0.8, ED: 0 }])).toEqual({ DC: 0.30000000000000004, EI: 0.7 })
    expect(meanAffinity([])).toBeNull()
  })
  it('zoom acotado y sin salirse del marco', () => {
    expect(clampView({ k: 9, x: 5, y: -5 })).toEqual({ k: 4, x: 1.5, y: -1.5 })
    const z = zoomAt({ k: 1, x: 0, y: 0 }, 2, 0.25, 0)
    expect(z.k).toBe(2)
    expect(z.x).toBeCloseTo(-0.25, 9)
    expect(zoomAt(z, 0.1).k).toBe(1)
  })
})

describe('preferencias persistentes', () => {
  it('modo Esencial por defecto y lectura tolerante', () => {
    expect(parsePrefs(null).mode).toBe('esencial')
    expect(parsePrefs('{roto').mode).toBe('esencial')
    const p = parsePrefs(JSON.stringify({ mode: 'avanzado', marketView: 'xx', pitch: { gamma: 9, layers: { lines: false } } }))
    expect(p.mode).toBe('avanzado')
    expect(p.marketView).toBe(DEFAULT_PREFS.marketView)
    expect(p.pitch.gamma).toBe(1)
    expect(p.pitch.layers.lines).toBe(false)
    expect(p.pitch.layers.values).toBe(true)
  })
})

const off = (probs: number[], afinidad: Record<string, number> = AF): OffensiveResult => ({
  modelo: 'GMM',
  perfiles: probs.map((p, i) => ({ cluster: i, perfil: ['Goleador', 'Asistente', 'Moderado', 'Sin asistencias', 'Aéreo'][i]!, probabilidad: p })),
  afinidad,
  mejor_zona: 'DC',
  alternativa: 'EI',
  advertencias: [],
})

describe('perfiles GMM', () => {
  it('perfil dominante, mixto y margen', () => {
    const clear = readProfiles(off([0.8, 0.1, 0.05, 0.03, 0.02]).perfiles)!
    expect(clear.top.perfil).toBe('Goleador')
    expect(clear.mixed).toBe(false)
    const mixed = readProfiles(off([0.45, 0.4, 0.1, 0.03, 0.02]).perfiles)!
    expect(mixed.mixed).toBe(true)
    expect(mixed.top.probabilidad).toBeLessThan(MIXED_THRESHOLD)
    expect(mixed.margin).toBeCloseTo(0.05, 9)
  })
  it('colores estables por clúster', () => {
    expect(profileColor(0)).toBe(profileColor(5))
    expect(profileColor(2)).not.toBe(profileColor(3))
  })
  it('la media de grupo es local y lo dice explícitamente', () => {
    const now = new Date('2026-01-01')
    const a = makeManualItem({ nombre: 'A', form: EMPTY_FORM, economic: null, offensive: off([0.7, 0.1, 0.1, 0.05, 0.05], { DC: 0.5, EI: 0.5 }), analizadoEn: 'x', corteDatos: null }, now, 'a')
    const refs = buildAffinityRefs(off([0.9, 0.05, 0.03, 0.01, 0.01], { DC: 0.3, EI: 0.7 }), [a])
    expect(refs.map((r) => r.kind)).toEqual(['uniforme', 'grupo', 'jugador'])
    expect(refs[1]!.note).toMatch(/No es la media del clúster/)
    expect(buildAffinityRefs(off([0.9, 0.05, 0.03, 0.01, 0.01]), [a], a.id).map((r) => r.kind)).toEqual(['uniforme'])
  })
})

const eco = (p: Partial<EconomicResult>): EconomicResult => ({
  modelo: 'G02',
  valor_estimado_eur: 2_140_000,
  referencia_directa_eur: 1_800_000,
  valor_observado_eur: 750_000,
  diferencia_eur: 1_390_000,
  diferencia_pct: 185.3,
  residuo_log: 1.05,
  umbral_p95: 0.62,
  alerta_economica: true,
  rango: '< 1 M€',
  goles_90: 0.5,
  asistencias_90: 0.2,
  advertencias: [],
  ...p,
})

describe('textos del modo Esencial', () => {
  it('reformula cifras reales sin prometer certezas', () => {
    const s = valueSentence(eco({}), eurCompact)
    expect(s).toContain('2,14 M€')
    expect(s).toContain('185 % más')
    expect(s).toMatch(/no es una garantía/)
  })
  it('sin valor observado no compara ni evalúa P95', () => {
    const s = valueSentence(eco({ valor_observado_eur: null, diferencia_pct: null, alerta_economica: null }), eurCompact)
    expect(s).toMatch(/Sin valor observado/)
  })
  it('selecciona las métricas del modelo principal', () => {
    const rows = [{ modelo: 'G01_x' }, { modelo: 'G02_y' }]
    expect(selectedMetrics(rows, 'G01_x')?.modelo).toBe('G01_x')
    expect(selectedMetrics(rows, undefined)?.modelo).toBe('G02_y')
    expect(selectedMetrics([], 'x')).toBeNull()
  })
})
