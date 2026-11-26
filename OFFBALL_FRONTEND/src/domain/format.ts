/** Formato de cifras en es-ES. "N/D" para datos ausentes (nunca 0). */

export const ND = 'N/D'

const nf = (opts: Intl.NumberFormatOptions) => new Intl.NumberFormat('es-ES', opts)

const isNum = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v)

/** 28 000 000 → "28,0 M€"; 750 000 → "750 k€"; 900 → "900 €". */
export function eurCompact(v: number | null | undefined): string {
  if (!isNum(v)) return ND
  const a = Math.abs(v)
  const sign = v < 0 ? '−' : ''
  if (a >= 1e6) return `${sign}${nf({ minimumFractionDigits: a >= 1e8 ? 0 : 1, maximumFractionDigits: a >= 1e8 ? 0 : 2 }).format(a / 1e6)} M€`
  if (a >= 1e3) return `${sign}${nf({ maximumFractionDigits: 0 }).format(a / 1e3)} k€`
  return `${sign}${nf({ maximumFractionDigits: 0 }).format(a)} €`
}

/** Importe completo: "750.000 €". */
export function eurFull(v: number | null | undefined): string {
  if (!isNum(v)) return ND
  return nf({ style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
}

/** Diferencia con signo explícito: "+1,2 M€" / "−300 k€". */
export function eurSigned(v: number | null | undefined): string {
  if (!isNum(v)) return ND
  const s = eurCompact(Math.abs(v))
  return v > 0 ? `+${s}` : v < 0 ? `−${s}` : s
}

/**
 * Porcentaje que YA viene en escala 0–100 (p. ej. diferencia_pct del backend).
 * No multiplica.
 */
export function pctPoints(v: number | null | undefined, digits = 1, signed = true): string {
  if (!isNum(v)) return ND
  const s = nf({ minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Math.abs(v))
  const sign = !signed ? (v < 0 ? '−' : '') : v > 0 ? '+' : v < 0 ? '−' : ''
  return `${sign}${s} %`
}

/**
 * Fracción 0–1 (probabilidades GMM, afinidades) → porcentaje.
 * ÚNICO punto del frontend donde se multiplica por 100.
 */
export function fractionToPct(v: number | null | undefined): number | null {
  if (!isNum(v)) return null
  return v * 100
}

export function fractionLabel(v: number | null | undefined, digits = 1): string {
  const p = fractionToPct(v)
  return p === null ? ND : pctPoints(p, digits, false)
}

export function num(v: number | null | undefined, digits = 0): string {
  if (!isNum(v)) return ND
  return nf({ minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v)
}

/** Fecha ISO (YYYY-MM-DD o con hora) → "12 jun 2026". */
export function dateLabel(iso: string | null | undefined): string {
  if (!iso) return ND
  const d = parseIsoDate(iso)
  if (!d) return iso
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(d)
    .replace('.', '')
}

export function parseIsoDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return Number.isNaN(d.getTime()) ? null : d
}

/** Sólo la parte de fecha de un ISO (los parquet serializan con hora). */
export function isoDay(iso: string | null | undefined): string | null {
  if (!iso) return null
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso)
  return m ? (m[1] ?? null) : null
}

export function daysBetween(fromIso: string, toIso: string): number | null {
  const a = parseIsoDate(fromIso)
  const b = parseIsoDate(toIso)
  if (!a || !b) return null
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function dateTimeLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

/** Parseo tolerante de importes en euros: "750.000", "750000", "1 250 000,50". */
export function parseEuroInput(raw: string): number | null {
  const s = raw.replace(/[\s€]/g, '').replace(/\./g, '').replace(',', '.')
  if (s === '') return null
  if (!/^\d+(\.\d+)?$/.test(s)) return NaN
  return Number(s)
}

export function per90(count: number, minutes: number): number | null {
  if (!Number.isFinite(count) || !Number.isFinite(minutes) || minutes <= 0) return null
  return (count * 90) / minutes
}
