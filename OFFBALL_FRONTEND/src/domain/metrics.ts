import type { TestMetricRow } from '../api/types'

/** Fila de métricas del modelo principal (configuracion.modelos.general o, si falta, la que contenga "G02"). */
export function selectedMetrics(rows: TestMetricRow[] | undefined, general: string | undefined): TestMetricRow | null {
  if (!rows?.length) return null
  return rows.find((r) => r.modelo === general) ?? rows.find((r) => /g02/i.test(r.modelo)) ?? null
}
