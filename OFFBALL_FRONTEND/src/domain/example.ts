/**
 * JUGADOR FICTICIO DE PRUEBA.
 * Son las peticiones de prueba documentadas en el encargo (anexo técnico).
 * No es un jugador real ni un resultado: sólo rellena el formulario y el
 * análisis se ejecuta contra la API real.
 */
import type { AnalysisForm } from './form'

export const FICTIONAL_EXAMPLE: AnalysisForm = {
  nombre: 'Jugador ficticio (ejemplo)',
  position: 'Attack',
  sub_position: 'Centre-Forward',
  competition_id: 'ES1',
  partidos: '30',
  minutos: '2100',
  goles: '12',
  asistencias: '5',
  age: '23',
  market_value_in_eur: '750000',
  fin_temporada: '2025-05-25',
  valuation_date: '2025-06-10',
  height_in_cm: '183',
  foot: 'right',
}
