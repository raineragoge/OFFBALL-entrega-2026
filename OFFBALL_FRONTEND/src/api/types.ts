/**
 * Contrato de OFFBALL API v0.1.0 (app/schemas.py, app/main.py, app/service.py).
 * Los nombres de campo son exactamente los del backend: no renombrar.
 */

export type Position = 'Attack' | 'Midfield' | 'Defender' | 'Goalkeeper'

export type Foot = 'left' | 'right' | 'both' | 'desconocido'

/** POST /api/v1/valoracion — EconomicInput (extra='forbid'). */
export interface EconomicPayload {
  position: Position
  sub_position: string
  minutos: number
  goles: number
  asistencias: number
  age: number
  partidos: number
  competition_id: string
  market_value_in_eur?: number | null
  /** ISO YYYY-MM-DD */
  fin_temporada: string
  /** ISO YYYY-MM-DD */
  valuation_date: string
}

/** POST /api/v1/afinidad — OffensiveInput (extra='forbid'). */
export interface OffensivePayload {
  position: Position
  sub_position: string
  minutos: number
  goles: number
  asistencias: number
  height_in_cm: number
  foot?: Foot | null
}

export interface EconomicResult {
  modelo: string
  valor_estimado_eur: number
  referencia_directa_eur: number
  valor_observado_eur: number | null
  diferencia_eur: number | null
  diferencia_pct: number | null
  residuo_log: number | null
  umbral_p95: number | null
  alerta_economica: boolean | null
  rango: string | null
  goles_90: number
  asistencias_90: number
  advertencias: string[]
}

export interface Profile {
  cluster: number
  perfil: string
  /** Fracción 0–1 devuelta por predict_proba. */
  probabilidad: number
}

export interface OffensiveResult {
  modelo: string
  perfiles: Profile[]
  /** Zona → fracción 0–1 (normalizada, suma 1). */
  afinidad: Record<string, number>
  mejor_zona: string
  alternativa: string
  advertencias: string[]
}

export interface HealthResponse {
  status: string
  regresion: string
  gmm_componentes: number
  corte_datos: string
}

export interface ModelConfig {
  version?: string
  modelos?: Record<string, string>
  features?: string[]
  numericas?: string[]
  categoricas?: string[]
  categorias_entrenamiento?: {
    position?: string[]
    sub_position?: string[]
    competition_id?: string[]
  }
  min_minutos?: number
  max_dias_stats?: number
  max_dias_valoracion_corte?: number
  corte_datos?: string
  sklearn?: string
  seed?: number
  train_hasta?: number
  test_desde?: number
  rango_valor_eur?: number[]
  percentil?: number
  n_test?: number
  n_candidatos?: number
  [key: string]: unknown
}

export interface TestMetricRow {
  modelo: string
  n?: number
  MAE_EUR?: number
  RMSE_EUR?: number
  R2?: number
  ratio_mediano?: number
  precision_1M?: number
  recall_1M?: number
  f1_1M?: number
  precision_5M?: number
  recall_5M?: number
  f1_5M?: number
  [key: string]: unknown
}

export interface MetadataResponse {
  configuracion: ModelConfig
  subposiciones: Record<string, string[]>
  metricas_test: TestMetricRow[]
  zonas: string[]
  perfiles: string[]
  nota: string
}

/** GET /api/v1/oportunidades — parámetros de consulta. */
export interface OpportunityQuery {
  /** Exclusivo: market_value_in_eur < presupuesto. */
  presupuesto: number
  edad_max: number
  minutos_min: number
  position?: Position | null
  competition_id?: string | null
  incluir_no_vigentes: boolean
  limit: number
  offset: number
}

export interface OpportunityRow {
  player_id: number | string
  name: string | null
  position: string | null
  sub_position: string | null
  competition_id: string | null
  age: number | null
  minutos: number | null
  valuation_date: string | null
  fin_temporada: string | null
  market_value_in_eur: number | null
  valor_estimado: number | null
  diferencia_pct: number | null
  exceso_residuo: number | null
  vigente_en_corte: boolean | null
}

export interface OpportunityResponse {
  modelo: string
  corte_datos: string
  incluye_no_vigentes: boolean
  total: number
  resultados: OpportunityRow[]
  advertencia: string
}
