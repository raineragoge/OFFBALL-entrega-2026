import { describe, expect, it } from 'vitest'
import { OffballClient } from '../src/api/client'
import { ApiError, parseValidationDetail } from '../src/api/errors'
import type { OpportunityRow } from '../src/api/types'
import { toComparable } from '../src/domain/compare'
import { FICTIONAL_EXAMPLE } from '../src/domain/example'
import { buildOpportunityParams, catalogIdentity, DEFAULT_QUERY, opportunitiesCsv, pageInfo, validateQuery } from '../src/domain/market'
import { nearest, vectorFor } from '../src/domain/similarity'
import {
  addItem,
  exportJson,
  importJson,
  makeCatalogItem,
  makeManualItem,
  memoryStore,
  readStore,
  STORE_KEY,
  toggleCompare,
  writeStore,
} from '../src/state/storage'

const ROW: OpportunityRow = {
  player_id: 123,
  name: 'Fila de prueba',
  position: 'Attack',
  sub_position: 'Left Winger',
  competition_id: 'NL1',
  age: 21,
  minutos: 1800,
  valuation_date: '2024-07-01T00:00:00.000',
  fin_temporada: '2024-05-19T00:00:00.000',
  market_value_in_eur: 400000,
  valor_estimado: 1500000,
  diferencia_pct: 275,
  exceso_residuo: 0.12,
  vigente_en_corte: false,
}

describe('filtros de mercado', () => {
  it('query string por defecto: sólo vigentes, sin posición ni competición', () => {
    expect(buildOpportunityParams(DEFAULT_QUERY).toString()).toBe(
      'presupuesto=5000000&edad_max=45&minutos_min=450&incluir_no_vigentes=false&limit=30&offset=0',
    )
  })
  it('reproduce la consulta de prueba del anexo', () => {
    const p = buildOpportunityParams({ ...DEFAULT_QUERY, edad_max: 40, incluir_no_vigentes: true, limit: 10 })
    expect(p.toString()).toBe('presupuesto=5000000&edad_max=40&minutos_min=450&incluir_no_vigentes=true&limit=10&offset=0')
  })
  it('incluye position y competition_id cuando se filtran', () => {
    const p = buildOpportunityParams({ ...DEFAULT_QUERY, position: 'Defender', competition_id: 'ES1', offset: 60 })
    expect(p.get('position')).toBe('Defender')
    expect(p.get('competition_id')).toBe('ES1')
    expect(p.get('offset')).toBe('60')
  })
  it('valida rangos del backend', () => {
    expect(validateQuery({ ...DEFAULT_QUERY, presupuesto: 0 }).presupuesto).toBeTruthy()
    expect(validateQuery({ ...DEFAULT_QUERY, edad_max: 46 }).edad_max).toBeTruthy()
    expect(validateQuery({ ...DEFAULT_QUERY, minutos_min: 449 }).minutos_min).toBeTruthy()
    expect(validateQuery({ ...DEFAULT_QUERY, limit: 101 }).limit).toBeTruthy()
    expect(validateQuery(DEFAULT_QUERY)).toEqual({})
  })
  it('paginación del servidor', () => {
    expect(pageInfo(0, 30, 0)).toMatchObject({ from: 0, to: 0, pages: 1, hasNext: false })
    expect(pageInfo(75, 30, 30)).toMatchObject({ page: 2, pages: 3, from: 31, to: 60, hasPrev: true, hasNext: true })
  })
  it('CSV con metadatos de alcance', () => {
    const csv = opportunitiesCsv([ROW], {
      query: DEFAULT_QUERY,
      alcance: 'pagina',
      exportadoEn: '2026-11-25T10:00:00Z',
      response: { modelo: 'G02_general_log', corte_datos: '2026-06-12', total: 1, advertencia: 'Catálogo histórico', incluye_no_vigentes: false },
    })
    expect(csv).toContain('# corte_datos;2026-06-12')
    expect(csv).toContain('# alcance;página (offset 0, límite 30)')
    expect(csv).toContain('123;Fila de prueba;Attack')
  })
})

describe('persistencia local', () => {
  it('guarda y lee con versión de esquema', () => {
    const kv = memoryStore()
    const item = makeCatalogItem(ROW, 'G02_general_log', '2026-06-12')
    writeStore(kv, addItem(readStore(kv), item).store)
    const raw = JSON.parse(kv.getItem(STORE_KEY)!)
    expect(raw.version).toBe(1)
    expect(readStore(kv).items.length).toBe(1)
  })
  it('no duplica fichas de catálogo con misma identidad y fecha', () => {
    let s = readStore(memoryStore())
    s = addItem(s, makeCatalogItem(ROW, 'G02', '2026-06-12')).store
    const r = addItem(s, makeCatalogItem(ROW, 'G02', '2026-06-12'))
    expect(r.result.added).toBe(false)
    expect(r.store.items.length).toBe(1)
    const other = addItem(s, makeCatalogItem({ ...ROW, valuation_date: '2025-07-01' }, 'G02', '2026-06-12'))
    expect(other.result.added).toBe(true)
    expect(catalogIdentity(ROW)).toBe('cat:123:2024-07-01')
  })
  it('versión incompatible: respalda y empieza vacío', () => {
    const kv = memoryStore()
    kv.setItem(STORE_KEY, JSON.stringify({ version: 99, items: [{}] }))
    expect(readStore(kv).items).toEqual([])
    expect(kv.getItem(`${STORE_KEY}.respaldo-99`)).toBeTruthy()
  })
  it('exporta e importa sin duplicar', () => {
    let s = readStore(memoryStore())
    s = addItem(s, makeCatalogItem(ROW, 'G02', '2026-06-12')).store
    const json = exportJson(s)
    const r = importJson(s, json)
    expect(r.added).toBe(0)
    expect(r.skipped).toBe(1)
    const r2 = importJson(readStore(memoryStore()), json)
    expect(r2.added).toBe(1)
  })
  it('comparador limitado a 3', () => {
    let ids: string[] = []
    for (const id of ['a', 'b', 'c']) ids = toggleCompare(ids, id).ids
    expect(toggleCompare(ids, 'd').full).toBe(true)
    expect(toggleCompare(ids, 'b').ids).toEqual(['a', 'c'])
  })
})

describe('comparador: N/D, nunca cero ni afinidad inferida', () => {
  it('fila de catálogo sin goles ni afinidad', () => {
    const c = toComparable(makeCatalogItem(ROW, 'G02', '2026-06-12'))
    expect(c.goles90).toBeNull()
    expect(c.referenciaG01).toBeNull()
    expect(c.afinidad).toBeNull()
    expect(c.afinidadMotivo).toContain('No calculable')
    expect(c.edadEsHistorica).toBe(true)
  })
  it('análisis manual sin valor observado: observado null', () => {
    const m = makeManualItem({ nombre: 'x', form: { ...FICTIONAL_EXAMPLE, market_value_in_eur: '' }, economic: null, offensive: null, analizadoEn: '2026-11-25T10:00:00Z', corteDatos: null })
    const c = toComparable(m)
    expect(c.observado).toBeNull()
    expect(c.goles90).toBeCloseTo((12 * 90) / 2100, 9)
  })
})

describe('similitud local', () => {
  it('excluye registros incompletos y exige al menos 3', () => {
    const mk = (h: string, g: string, id: string) =>
      makeManualItem({ nombre: id, form: { ...FICTIONAL_EXAMPLE, height_in_cm: h, goles: g }, economic: null, offensive: null, analizadoEn: '', corteDatos: null }, new Date(), id)
    expect(vectorFor(mk('', '5', 'a'))).toBeNull()
    const a = vectorFor(mk('180', '5', 'a'))!
    const b = vectorFor(mk('181', '6', 'b'))!
    expect(nearest(a, [b])).toEqual([])
    const c = vectorFor(mk('195', '20', 'c'))!
    const res = nearest(a, [b, c])
    expect(res[0]!.id).toBe('man:b')
  })
})

describe('errores de la API', () => {
  it('422 con detalle como lista (Pydantic)', () => {
    const issues = parseValidationDetail([
      { type: 'greater_than_equal', loc: ['body', 'minutos'], msg: 'Input should be greater than or equal to 450', ctx: { ge: 450 } },
      { type: 'value_error', loc: ['body'], msg: 'Value error, Minutos superiores a 90 por partido de liga' },
      { type: 'extra_forbidden', loc: ['body', 'nombre'], msg: 'Extra inputs are not permitted' },
    ])
    expect(issues[0]).toEqual({ field: 'minutos', message: 'Debe ser mayor o igual que 450.' })
    expect(issues[1]).toEqual({ field: null, message: 'Minutos superiores a 90 por partido de liga' })
    expect(issues[2]!.message).toBe('Campo no admitido por la API.')
  })
  it('422 con detalle como string (HTTPException)', () => {
    expect(parseValidationDetail('competition_id: categoría no observada en entrenamiento')).toEqual([
      { field: null, message: 'competition_id: categoría no observada en entrenamiento' },
    ])
  })

  const res = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

  it('cliente: 422 → ApiError validation', async () => {
    const c = new OffballClient({ baseUrl: 'http://api', timeoutMs: 1000, fetcher: async () => res(422, { detail: 'x' }) })
    let err: unknown
    try {
      await c.health()
    } catch (e) {
      err = e
    }
    expect(err instanceof ApiError && err.kind).toBe('validation')
  })
  it('cliente: sin conexión → network, sin datos simulados', async () => {
    const c = new OffballClient({ baseUrl: 'http://api', timeoutMs: 1000, fetcher: async () => { throw new TypeError('Failed to fetch') } })
    let err: unknown
    try {
      await c.metadata()
    } catch (e) {
      err = e
    }
    expect(err instanceof ApiError && err.kind).toBe('network')
  })
  it('cliente: timeout', async () => {
    const c = new OffballClient({
      baseUrl: 'http://api',
      timeoutMs: 20,
      fetcher: (_i, init) => new Promise((_r, rej) => init?.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')))),
    })
    let err: unknown
    try {
      await c.health()
    } catch (e) {
      err = e
    }
    expect(err instanceof ApiError && err.kind).toBe('timeout')
  })
  it('cliente: respuesta con forma inesperada → parse', async () => {
    const c = new OffballClient({ baseUrl: 'http://api', timeoutMs: 1000, fetcher: async () => res(200, { foo: 1 }) })
    let err: unknown
    try {
      await c.oportunidades(DEFAULT_QUERY)
    } catch (e) {
      err = e
    }
    expect(err instanceof ApiError && err.kind).toBe('parse')
  })
  it('cliente: URL y método exactos', async () => {
    const seen: { url: string; method?: string; body?: unknown }[] = []
    const c = new OffballClient({
      baseUrl: 'http://localhost:8000',
      timeoutMs: 1000,
      fetcher: async (url, init) => {
        seen.push({ url, method: init?.method, body: init?.body })
        return res(200, { modelo: 'G02_general_log', corte_datos: '2026-06-12', incluye_no_vigentes: false, total: 0, resultados: [], advertencia: '' })
      },
    })
    await c.oportunidades(DEFAULT_QUERY)
    expect(seen[0]!.url).toBe('http://localhost:8000/api/v1/oportunidades?presupuesto=5000000&edad_max=45&minutos_min=450&incluir_no_vigentes=false&limit=30&offset=0')
    expect(seen[0]!.method).toBe('GET')
  })
})
