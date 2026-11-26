/**
 * Formulario de análisis: estado, validación compatible con los esquemas
 * Pydantic del backend y construcción de payloads independientes y sin campos extra.
 * El backend sigue siendo la autoridad final: esta validación sólo evita
 * peticiones que sabemos que serían rechazadas.
 */
import type { EconomicPayload, Foot, OffensivePayload, Position } from '../api/types'
import { daysBetween, parseEuroInput, parseIsoDate } from './format'
import { isOffensiveSub, isPosition, SUBPOS_CONTRACT } from './positions'

export interface AnalysisForm {
  /** Sólo local: nunca se envía al backend. */
  nombre: string
  position: Position | ''
  sub_position: string
  competition_id: string
  partidos: string
  minutos: string
  goles: string
  asistencias: string
  age: string
  market_value_in_eur: string
  fin_temporada: string
  valuation_date: string
  height_in_cm: string
  foot: Foot | ''
}

export const EMPTY_FORM: AnalysisForm = {
  nombre: '',
  position: '',
  sub_position: '',
  competition_id: '',
  partidos: '',
  minutos: '',
  goles: '',
  asistencias: '',
  age: '',
  market_value_in_eur: '',
  fin_temporada: '',
  valuation_date: '',
  height_in_cm: '',
  foot: '',
}

export type FormField = keyof AnalysisForm
export type FormErrors = Partial<Record<FormField | '_form', string>>

export interface ValidationContext {
  /** Fecha de hoy (YYYY-MM-DD) para la regla "valoración futura". */
  today: string
  /** corte_datos de la API, si se conoce. */
  corte?: string | null
  /** Subposiciones válidas (metadata.subposiciones o respaldo del contrato). */
  subposiciones?: Record<string, string[]>
  /** Competiciones observadas en entrenamiento. */
  competiciones?: string[]
}

export interface ValidationResult {
  errors: FormErrors
  warnings: string[]
  /** Sección económica lista para enviarse. */
  economicReady: boolean
  /** Sección ofensiva aplicable (subposición admitida por el GMM). */
  offensiveApplies: boolean
  offensiveReady: boolean
}

function parseIntStrict(raw: string): number | null {
  const s = raw.trim()
  if (s === '') return null
  if (!/^-?\d+$/.test(s)) return NaN
  return Number(s)
}

function parseFloatStrict(raw: string): number | null {
  const s = raw.trim().replace(',', '.')
  if (s === '') return null
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN
  return Number(s)
}

function intRange(errors: FormErrors, field: FormField, raw: string, min: number, max: number, required = true): number | null {
  const v = parseIntStrict(raw)
  if (v === null) {
    if (required) errors[field] = 'Obligatorio.'
    return null
  }
  if (Number.isNaN(v)) {
    errors[field] = 'Debe ser un número entero.'
    return null
  }
  if (v < min || v > max) {
    errors[field] = `Entre ${min.toLocaleString('es-ES')} y ${max.toLocaleString('es-ES')}.`
    return null
  }
  return v
}

/** Validación de la parte común (Stats). */
function validateStats(f: AnalysisForm, ctx: ValidationContext, errors: FormErrors) {
  const subpos = ctx.subposiciones ?? SUBPOS_CONTRACT
  if (!f.position) errors.position = 'Selecciona una posición.'
  if (!f.sub_position) errors.sub_position = 'Selecciona una subposición.'
  else if (f.position && !(subpos[f.position] ?? []).includes(f.sub_position))
    errors.sub_position = 'Subposición incompatible con la posición.'
  const minutos = intRange(errors, 'minutos', f.minutos, 450, 10000)
  const goles = intRange(errors, 'goles', f.goles, 0, 300)
  const asistencias = intRange(errors, 'asistencias', f.asistencias, 0, 300)
  return { minutos, goles, asistencias }
}

export function validateForm(f: AnalysisForm, ctx: ValidationContext): ValidationResult {
  const errors: FormErrors = {}
  const warnings: string[] = []
  const { minutos } = validateStats(f, ctx, errors)

  // --- Económico (EconomicInput) ---
  const partidos = intRange(errors, 'partidos', f.partidos, 1, 100)
  intRange(errors, 'age', f.age, 15, 45)
  if (!f.competition_id) errors.competition_id = 'Selecciona una competición.'
  else if (f.competition_id.length > 20) errors.competition_id = 'Código de competición no válido.'
  else if (ctx.competiciones && !ctx.competiciones.includes(f.competition_id))
    errors.competition_id = 'Competición no observada en entrenamiento.'

  if (minutos !== null && partidos !== null && minutos > partidos * 90)
    errors.minutos = `Máximo ${(partidos * 90).toLocaleString('es-ES')} (90 por partido de liga).`

  const mv = parseEuroInput(f.market_value_in_eur)
  if (mv !== null) {
    if (Number.isNaN(mv)) errors.market_value_in_eur = 'Importe no válido (en euros).'
    else if (mv <= 0) errors.market_value_in_eur = 'Debe ser mayor que 0 €.'
    else if (mv > 1e10) errors.market_value_in_eur = 'Máximo 10.000 M€.'
  }

  const fin = f.fin_temporada.trim()
  const val = f.valuation_date.trim()
  if (!fin) errors.fin_temporada = 'Obligatorio.'
  else if (!parseIsoDate(fin)) errors.fin_temporada = 'Fecha no válida.'
  if (!val) errors.valuation_date = 'Obligatorio.'
  else if (!parseIsoDate(val)) errors.valuation_date = 'Fecha no válida.'

  if (fin && val && parseIsoDate(fin) && parseIsoDate(val)) {
    const d = daysBetween(fin, val)
    if (d === null || d < 1 || d > 365)
      errors.valuation_date = 'Debe ser entre 1 y 365 días posterior al cierre de la temporada.'
    else if (val > ctx.today) errors.valuation_date = 'La fecha de valoración no puede ser futura.'
    if (ctx.corte && val > ctx.corte && !errors.valuation_date)
      warnings.push(
        `La fecha de valoración es posterior al corte del dataset (${ctx.corte}): extrapolación temporal no validada.`,
      )
  }

  const economicKeys: FormField[] = [
    'position', 'sub_position', 'minutos', 'goles', 'asistencias', 'partidos', 'age',
    'competition_id', 'market_value_in_eur', 'fin_temporada', 'valuation_date',
  ]
  const economicReady = economicKeys.every((k) => !errors[k])

  // --- Ofensivo (OffensiveInput) ---
  const offensiveApplies = isOffensiveSub(f.sub_position)
  let offensiveReady = false
  if (offensiveApplies) {
    const h = parseFloatStrict(f.height_in_cm)
    if (h === null) errors.height_in_cm = 'Obligatoria para el perfil ofensivo.'
    else if (Number.isNaN(h)) errors.height_in_cm = 'Debe ser un número.'
    else if (h < 140 || h > 220) errors.height_in_cm = 'Entre 140 y 220 cm.'
    const statsKeys: FormField[] = ['position', 'sub_position', 'minutos', 'goles', 'asistencias', 'height_in_cm']
    offensiveReady = statsKeys.every((k) => !errors[k])
  }

  return { errors, warnings, economicReady, offensiveApplies, offensiveReady }
}

/** Validación del acceso directo a inteligencia posicional (sólo OffensiveInput). */
export function validateOffensiveOnly(f: AnalysisForm, ctx: ValidationContext): { errors: FormErrors; ready: boolean } {
  const errors: FormErrors = {}
  validateStats(f, ctx, errors)
  if (f.sub_position && !isOffensiveSub(f.sub_position))
    errors.sub_position = 'El GMM sólo admite DC, SD, EI, ED y MCO.'
  const h = parseFloatStrict(f.height_in_cm)
  if (h === null) errors.height_in_cm = 'Obligatoria.'
  else if (Number.isNaN(h)) errors.height_in_cm = 'Debe ser un número.'
  else if (h < 140 || h > 220) errors.height_in_cm = 'Entre 140 y 220 cm.'
  return { errors, ready: Object.keys(errors).length === 0 }
}

/** Payload exacto de EconomicInput. Lanza si el formulario no es válido. */
export function buildEconomicPayload(f: AnalysisForm): EconomicPayload {
  if (!isPosition(f.position)) throw new Error('Posición no válida')
  const mv = parseEuroInput(f.market_value_in_eur)
  const payload: EconomicPayload = {
    position: f.position,
    sub_position: f.sub_position,
    minutos: Number(f.minutos.trim()),
    goles: Number(f.goles.trim()),
    asistencias: Number(f.asistencias.trim()),
    age: Number(f.age.trim()),
    partidos: Number(f.partidos.trim()),
    competition_id: f.competition_id,
    fin_temporada: f.fin_temporada.trim(),
    valuation_date: f.valuation_date.trim(),
  }
  // Valor observado opcional: se omite si está vacío (el backend usa None).
  if (mv !== null && !Number.isNaN(mv)) payload.market_value_in_eur = mv
  return payload
}

/** Payload exacto de OffensiveInput. `foot` se omite si no se indicó. */
export function buildOffensivePayload(f: AnalysisForm): OffensivePayload {
  if (!isPosition(f.position)) throw new Error('Posición no válida')
  const payload: OffensivePayload = {
    position: f.position,
    sub_position: f.sub_position,
    minutos: Number(f.minutos.trim()),
    goles: Number(f.goles.trim()),
    asistencias: Number(f.asistencias.trim()),
    height_in_cm: Number(f.height_in_cm.trim().replace(',', '.')),
  }
  if (f.foot) payload.foot = f.foot
  return payload
}
