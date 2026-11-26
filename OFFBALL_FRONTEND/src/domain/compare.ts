/**
 * Normalización de fichas guardadas para el comparador.
 * Regla: un dato ausente es null (se muestra N/D), nunca 0. No se infiere
 * afinidad ni perfil para fichas de catálogo (faltan altura, pie y goles).
 */
import type { SavedItem } from '../state/storage'
import { isoDay, per90 } from './format'

export interface Comparable {
  id: string
  nombre: string
  origen: 'manual' | 'catalogo'
  procedencia: string
  position: string | null
  sub_position: string | null
  competition_id: string | null
  edad: number | null
  edadEsHistorica: boolean
  minutos: number | null
  partidos: number | null
  observado: number | null
  estimado: number | null
  referenciaG01: number | null
  diferenciaEur: number | null
  diferenciaPct: number | null
  alerta: boolean | null
  excesoResiduo: number | null
  goles90: number | null
  asistencias90: number | null
  perfilDominante: { nombre: string; prob: number } | null
  mejorZona: string | null
  alternativa: string | null
  afinidad: Record<string, number> | null
  /** Motivo por el que no hay afinidad (si aplica). */
  afinidadMotivo: string | null
  fechaValoracion: string | null
  finTemporada: string | null
  modelo: string | null
  corte: string | null
  analizadoEn: string | null
}

const n = (s: string): number | null => (s.trim() === '' || !Number.isFinite(Number(s)) ? null : Number(s))

export function toComparable(item: SavedItem): Comparable {
  if (item.origen === 'catalogo') {
    const r = item.row
    const obs = r.market_value_in_eur
    const est = r.valor_estimado
    return {
      id: item.id,
      nombre: r.name ?? 'Sin nombre',
      origen: 'catalogo',
      procedencia: 'Catálogo histórico (GET /oportunidades)',
      position: r.position,
      sub_position: r.sub_position,
      competition_id: r.competition_id,
      edad: r.age,
      edadEsHistorica: true,
      minutos: r.minutos,
      partidos: null,
      observado: obs,
      estimado: est,
      referenciaG01: null,
      diferenciaEur: obs !== null && est !== null ? est - obs : null,
      diferenciaPct: r.diferencia_pct,
      // Todas las filas de /oportunidades cumplen alerta_economica == True en su fecha.
      alerta: true,
      excesoResiduo: r.exceso_residuo,
      goles90: null,
      asistencias90: null,
      perfilDominante: null,
      mejorZona: null,
      alternativa: null,
      afinidad: null,
      afinidadMotivo: 'No calculable: el catálogo no incluye goles, asistencias, altura ni pie.',
      fechaValoracion: isoDay(r.valuation_date),
      finTemporada: isoDay(r.fin_temporada),
      modelo: item.modelo,
      corte: item.corteDatos,
      analizadoEn: null,
    }
  }
  const f = item.form
  const e = item.economic
  const o = item.offensive
  const minutos = n(f.minutos)
  const top = o ? [...o.perfiles].sort((a, b) => b.probabilidad - a.probabilidad)[0] : undefined
  return {
    id: item.id,
    nombre: item.nombre || 'Análisis sin nombre',
    origen: 'manual',
    procedencia: 'Análisis manual (datos aportados, no verificados)',
    position: f.position || null,
    sub_position: f.sub_position || null,
    competition_id: f.competition_id || null,
    edad: n(f.age),
    edadEsHistorica: false,
    minutos,
    partidos: n(f.partidos),
    observado: e?.valor_observado_eur ?? null,
    estimado: e?.valor_estimado_eur ?? null,
    referenciaG01: e?.referencia_directa_eur ?? null,
    diferenciaEur: e?.diferencia_eur ?? null,
    diferenciaPct: e?.diferencia_pct ?? null,
    alerta: e ? e.alerta_economica : null,
    excesoResiduo: e && e.residuo_log !== null && e.umbral_p95 !== null ? e.residuo_log - e.umbral_p95 : null,
    goles90: e?.goles_90 ?? (minutos !== null && n(f.goles) !== null ? per90(n(f.goles)!, minutos) : null),
    asistencias90: e?.asistencias_90 ?? (minutos !== null && n(f.asistencias) !== null ? per90(n(f.asistencias)!, minutos) : null),
    perfilDominante: top ? { nombre: top.perfil, prob: top.probabilidad } : null,
    mejorZona: o?.mejor_zona ?? null,
    alternativa: o?.alternativa ?? null,
    afinidad: o?.afinidad ?? null,
    afinidadMotivo: o ? null : 'No calculada: subposición no ofensiva o sin datos ofensivos.',
    fechaValoracion: f.valuation_date || null,
    finTemporada: f.fin_temporada || null,
    modelo: e?.modelo ?? o?.modelo ?? null,
    corte: item.corteDatos,
    analizadoEn: item.analizadoEn,
  }
}
