/**
 * Errores de API normalizados y mensajes comprensibles en español.
 * FastAPI devuelve `detail` como lista de errores de Pydantic (422 de esquema)
 * o como string (HTTPException(422, str(e)) en /valoracion).
 */

export type ApiErrorKind =
  | 'network' // sin conexión / CORS / backend apagado
  | 'timeout'
  | 'aborted'
  | 'validation' // 422
  | 'http' // otros códigos
  | 'parse' // respuesta no JSON o con forma inesperada

export interface FieldIssue {
  /** Campo del payload afectado (p. ej. "minutos"), o null si es de modelo. */
  field: string | null
  message: string
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | null
  readonly issues: FieldIssue[]

  constructor(kind: ApiErrorKind, message: string, status: number | null = null, issues: FieldIssue[] = []) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
    this.issues = issues
  }

  get retryable(): boolean {
    return this.kind === 'network' || this.kind === 'timeout' || (this.kind === 'http' && (this.status ?? 0) >= 500)
  }
}

export const FIELD_LABELS: Record<string, string> = {
  position: 'Posición',
  sub_position: 'Subposición',
  minutos: 'Minutos',
  goles: 'Goles',
  asistencias: 'Asistencias',
  age: 'Edad',
  partidos: 'Partidos',
  competition_id: 'Competición',
  market_value_in_eur: 'Valor observado',
  fin_temporada: 'Cierre de temporada',
  valuation_date: 'Fecha de valoración',
  height_in_cm: 'Altura',
  foot: 'Pie',
  presupuesto: 'Presupuesto',
  edad_max: 'Edad máxima',
  minutos_min: 'Minutos mínimos',
  incluir_no_vigentes: 'Incluir no vigentes',
  limit: 'Límite',
  offset: 'Desplazamiento',
}

interface PydanticDetail {
  type?: string
  loc?: (string | number)[]
  msg?: string
  ctx?: Record<string, unknown>
}

function fmtCtx(v: unknown): string {
  if (typeof v === 'number') return v.toLocaleString('es-ES')
  return String(v)
}

/** Traduce un error individual de Pydantic v2 al español. */
export function translatePydantic(d: PydanticDetail): string {
  const ctx = d.ctx ?? {}
  switch (d.type) {
    case 'missing':
      return 'Campo obligatorio.'
    case 'extra_forbidden':
      return 'Campo no admitido por la API.'
    case 'greater_than_equal':
      return `Debe ser mayor o igual que ${fmtCtx(ctx.ge)}.`
    case 'greater_than':
      return `Debe ser mayor que ${fmtCtx(ctx.gt)}.`
    case 'less_than_equal':
      return `Debe ser menor o igual que ${fmtCtx(ctx.le)}.`
    case 'less_than':
      return `Debe ser menor que ${fmtCtx(ctx.lt)}.`
    case 'int_parsing':
    case 'int_type':
    case 'int_from_float':
      return 'Debe ser un número entero.'
    case 'float_parsing':
    case 'float_type':
    case 'finite_number':
      return 'Debe ser un número válido.'
    case 'date_parsing':
    case 'date_from_datetime_parsing':
    case 'date_type':
      return 'Fecha no válida (formato AAAA-MM-DD).'
    case 'literal_error':
      return `Valor no admitido${ctx.expected ? ` (se esperaba ${String(ctx.expected)})` : ''}.`
    case 'string_too_short':
      return 'Texto demasiado corto.'
    case 'string_too_long':
      return 'Texto demasiado largo.'
    case 'bool_parsing':
      return 'Debe ser verdadero o falso.'
    case 'value_error':
    case 'assertion_error':
      // Los validadores del backend ya redactan en español: "Value error, <texto>"
      return (d.msg ?? 'Valor no válido.').replace(/^Value error,\s*/i, '').replace(/^Assertion failed,\s*/i, '')
    default:
      return d.msg ?? 'Valor no válido.'
  }
}

/** Convierte el `detail` de FastAPI (lista o string) en incidencias por campo. */
export function parseValidationDetail(detail: unknown): FieldIssue[] {
  if (typeof detail === 'string') return [{ field: null, message: detail }]
  if (Array.isArray(detail)) {
    return detail.map((raw): FieldIssue => {
      const d = (raw ?? {}) as PydanticDetail
      const loc = Array.isArray(d.loc) ? d.loc : []
      // loc = ['body', 'minutos'] | ['query', 'presupuesto'] | ['body'] (validador de modelo)
      const fieldPart = loc.filter((p) => p !== 'body' && p !== 'query' && typeof p === 'string')
      const field = (fieldPart[fieldPart.length - 1] as string | undefined) ?? null
      return { field, message: translatePydantic(d) }
    })
  }
  if (detail && typeof detail === 'object') return [{ field: null, message: JSON.stringify(detail) }]
  return [{ field: null, message: 'La API rechazó los datos enviados.' }]
}

export function describeIssue(issue: FieldIssue): string {
  if (!issue.field) return issue.message
  return `${FIELD_LABELS[issue.field] ?? issue.field}: ${issue.message}`
}

export function httpMessage(status: number): string {
  if (status === 404) return 'Recurso no encontrado en la API (¿versión distinta a v0.1.0?).'
  if (status === 405) return 'Método HTTP no admitido por la API.'
  if (status === 422) return 'La API rechazó los datos enviados.'
  if (status >= 500) return 'Error interno de la API. Revisa los registros del contenedor del backend.'
  return `La API respondió con el código ${status}.`
}

export function errorTitle(e: ApiError): string {
  switch (e.kind) {
    case 'network':
      return 'Sin conexión con OFFBALL API'
    case 'timeout':
      return 'La API tardó demasiado en responder'
    case 'aborted':
      return 'Petición cancelada'
    case 'validation':
      return 'Datos no válidos para el modelo'
    case 'parse':
      return 'Respuesta inesperada de la API'
    default:
      return 'Error de la API'
  }
}

export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e
  if (e instanceof Error) return new ApiError('parse', e.message)
  return new ApiError('parse', 'Error desconocido')
}
