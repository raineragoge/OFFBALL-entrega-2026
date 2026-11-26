/**
 * Etiquetas de competición (códigos de origen Transfermarkt usados por el dataset).
 * El payload siempre envía el código original. Códigos desconocidos se muestran tal cual.
 * COMPETITIONS_CONTRACT replica configuracion.json v0.1.0 y sólo es respaldo sin conexión.
 */
export const COMPETITIONS_CONTRACT = [
  'BE1', 'DK1', 'ES1', 'FR1', 'GB1', 'GR1', 'IT1', 'L1', 'NL1', 'PO1', 'RU1', 'SC1', 'TR1', 'UKR1',
]

const LABELS: Record<string, { name: string; country: string }> = {
  BE1: { name: 'Jupiler Pro League', country: 'Bélgica' },
  DK1: { name: 'Superliga', country: 'Dinamarca' },
  ES1: { name: 'LaLiga', country: 'España' },
  FR1: { name: 'Ligue 1', country: 'Francia' },
  GB1: { name: 'Premier League', country: 'Inglaterra' },
  GR1: { name: 'Super League', country: 'Grecia' },
  IT1: { name: 'Serie A', country: 'Italia' },
  L1: { name: 'Bundesliga', country: 'Alemania' },
  NL1: { name: 'Eredivisie', country: 'Países Bajos' },
  PO1: { name: 'Liga Portugal', country: 'Portugal' },
  RU1: { name: 'Premier Liga', country: 'Rusia' },
  SC1: { name: 'Scottish Premiership', country: 'Escocia' },
  TR1: { name: 'Süper Lig', country: 'Turquía' },
  UKR1: { name: 'Premier Liha', country: 'Ucrania' },
}

export function competitionLabel(code: string | null | undefined): string {
  if (!code) return 'N/D'
  const l = LABELS[code]
  return l ? `${l.name} · ${l.country}` : code
}

export function competitionShort(code: string | null | undefined): string {
  if (!code) return 'N/D'
  return LABELS[code]?.name ?? code
}
