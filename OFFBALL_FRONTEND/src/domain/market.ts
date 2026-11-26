/** Filtros de GET /api/v1/oportunidades (nombres y rangos del backend). */
import type { OpportunityQuery, OpportunityResponse, OpportunityRow } from '../api/types'
import { competitionLabel } from './competitions'
import { isoDay } from './format'
import { positionLabel, subLabel } from './positions'

export const DEFAULT_QUERY: OpportunityQuery = {
  presupuesto: 5_000_000,
  edad_max: 45,
  minutos_min: 450,
  position: null,
  competition_id: null,
  incluir_no_vigentes: false,
  limit: 30,
  offset: 0,
}

export const QUERY_LIMITS = {
  presupuesto: { gt: 0, le: 1e10 },
  edad_max: { ge: 15, le: 45 },
  minutos_min: { ge: 450, le: 10000 },
  limit: { ge: 1, le: 100 },
} as const

/** Query string exacta. position/competition_id se omiten si no se filtra. */
export function buildOpportunityParams(q: OpportunityQuery): URLSearchParams {
  const p = new URLSearchParams()
  p.set('presupuesto', String(q.presupuesto))
  p.set('edad_max', String(q.edad_max))
  p.set('minutos_min', String(q.minutos_min))
  if (q.position) p.set('position', q.position)
  if (q.competition_id) p.set('competition_id', q.competition_id)
  p.set('incluir_no_vigentes', q.incluir_no_vigentes ? 'true' : 'false')
  p.set('limit', String(q.limit))
  p.set('offset', String(q.offset))
  return p
}

export function validateQuery(q: OpportunityQuery): Partial<Record<keyof OpportunityQuery, string>> {
  const e: Partial<Record<keyof OpportunityQuery, string>> = {}
  if (!Number.isFinite(q.presupuesto) || q.presupuesto <= 0 || q.presupuesto > 1e10) e.presupuesto = 'Entre 1 € y 10.000 M€.'
  if (!Number.isInteger(q.edad_max) || q.edad_max < 15 || q.edad_max > 45) e.edad_max = 'Entre 15 y 45.'
  if (!Number.isInteger(q.minutos_min) || q.minutos_min < 450 || q.minutos_min > 10000) e.minutos_min = 'Entre 450 y 10.000.'
  if (!Number.isInteger(q.limit) || q.limit < 1 || q.limit > 100) e.limit = 'Entre 1 y 100.'
  if (!Number.isInteger(q.offset) || q.offset < 0) e.offset = 'No negativo.'
  return e
}

export function pageInfo(total: number, limit: number, offset: number) {
  const page = Math.floor(offset / limit) + 1
  const pages = Math.max(1, Math.ceil(total / limit))
  const from = total === 0 ? 0 : offset + 1
  const to = Math.min(offset + limit, total)
  return { page, pages, from, to, hasPrev: offset > 0, hasNext: offset + limit < total }
}

/** Identidad estable de una fila de catálogo (evita duplicados en seguimiento). */
export function catalogIdentity(r: Pick<OpportunityRow, 'player_id' | 'valuation_date'>): string {
  return `cat:${String(r.player_id)}:${isoDay(r.valuation_date) ?? 'sin-fecha'}`
}

// ---------------- CSV ----------------

export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = typeof v === 'number' ? String(v) : String(v)
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: unknown[][]): string {
  // Separador ";" (Excel en configuración regional española). BOM para UTF-8.
  return '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n') + '\r\n'
}

const CSV_COLUMNS: { key: keyof OpportunityRow; header: string }[] = [
  { key: 'player_id', header: 'player_id' },
  { key: 'name', header: 'nombre' },
  { key: 'position', header: 'position' },
  { key: 'sub_position', header: 'sub_position' },
  { key: 'competition_id', header: 'competition_id' },
  { key: 'age', header: 'edad_historica' },
  { key: 'minutos', header: 'minutos' },
  { key: 'fin_temporada', header: 'fin_temporada' },
  { key: 'valuation_date', header: 'valuation_date' },
  { key: 'market_value_in_eur', header: 'valor_observado_eur' },
  { key: 'valor_estimado', header: 'valor_estimado_eur' },
  { key: 'diferencia_pct', header: 'diferencia_pct' },
  { key: 'exceso_residuo', header: 'exceso_residuo' },
  { key: 'vigente_en_corte', header: 'vigente_en_corte' },
]

export interface CsvScope {
  query: OpportunityQuery
  /** 'pagina' = sólo la página consultada; 'todo' = todas las páginas recorridas. */
  alcance: 'pagina' | 'todo'
  exportadoEn: string
  response: Pick<OpportunityResponse, 'modelo' | 'corte_datos' | 'total' | 'advertencia' | 'incluye_no_vigentes'>
}

export function opportunitiesCsv(rows: OpportunityRow[], scope: CsvScope): string {
  const q = scope.query
  const meta: unknown[][] = [
    ['# OFFBALL · Explorar mercado (catálogo histórico)'],
    ['# alcance', scope.alcance === 'pagina' ? `página (offset ${q.offset}, límite ${q.limit})` : `todas las páginas (${rows.length} de ${scope.response.total})`],
    ['# exportado_en', scope.exportadoEn],
    ['# modelo', scope.response.modelo],
    ['# corte_datos', scope.response.corte_datos],
    ['# filtros', buildOpportunityParams({ ...q, offset: scope.alcance === 'todo' ? 0 : q.offset }).toString()],
    ['# incluye_no_vigentes', String(scope.response.incluye_no_vigentes)],
    ['# total_servidor', scope.response.total],
    ['# advertencia', scope.response.advertencia],
    [],
  ]
  const header = CSV_COLUMNS.map((c) => c.header)
  const body = rows.map((r) => CSV_COLUMNS.map((c) => r[c.key]))
  return toCsv([...meta, header, ...body])
}

export function describeRow(r: OpportunityRow): string {
  return [r.name ?? 'Sin nombre', positionLabel(r.position), subLabel(r.sub_position), competitionLabel(r.competition_id)].join(' · ')
}
