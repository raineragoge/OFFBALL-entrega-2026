import type { ReactNode } from 'react'
import {
  IconBook,
  IconBookmark,
  IconColumns,
  IconGauge,
  IconHome,
  IconMarket,
  IconPitch,
  IconProfiles,
  IconTarget,
  type IconProps,
} from '../icons'

export interface NavItem {
  to: string
  label: string
  /** Descripción breve (buscador y tooltips). */
  hint: string
  Icon: (p: IconProps) => ReactNode
  group: 'Scouting' | 'Mi trabajo' | 'Modelo'
  /** Sólo visible en la navegación del modo Avanzado. */
  advancedOnly?: boolean
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Inicio', hint: 'Centro de scouting: oportunidades, perfiles y estado del modelo', Icon: IconHome, group: 'Scouting' },
  { to: '/plantilla', label: 'Mi plantilla', hint: 'Alineación, rendimiento y recomendaciones de fichaje', Icon: IconPitch, group: 'Scouting' },
  { to: '/tactica', label: 'Laboratorio táctico', hint: 'Pizarra, candidatos y mapas de calor', Icon: IconPitch, group: 'Scouting' },
  { to: '/database', label: 'Base de jugadores', hint: 'Importación masiva y nuevas oportunidades', Icon: IconMarket, group: 'Scouting' },
  { to: '/analizar', label: 'Analizar jugador', hint: 'Informe individual: valor, perfil y mapa táctico', Icon: IconTarget, group: 'Scouting' },
  { to: '/mercado', label: 'Mercado', hint: 'Explorador del catálogo y ranking de oportunidades', Icon: IconMarket, group: 'Scouting' },
  { to: '/comparador', label: 'Comparador', hint: 'Hasta tres fichas lado a lado', Icon: IconColumns, group: 'Scouting' },
  { to: '/perfiles', label: 'Perfiles', hint: 'Los cinco perfiles GMM y tus jugadores en cada uno', Icon: IconProfiles, group: 'Scouting' },
  { to: '/seguimiento', label: 'Seguimiento', hint: 'Tu lista de candidatos con notas', Icon: IconBookmark, group: 'Mi trabajo' },
  { to: '/rendimiento', label: 'Rendimiento del modelo', hint: 'Métricas de test de G01 y G02', Icon: IconGauge, group: 'Modelo', advancedOnly: true },
  { to: '/posicional', label: 'Afinidad rápida', hint: 'Sólo perfil GMM y mapa táctico, sin valoración', Icon: IconPitch, group: 'Modelo', advancedOnly: true },
  { to: '/metodologia', label: 'Metodología', hint: 'Cómo funcionan los modelos y sus límites', Icon: IconBook, group: 'Modelo' },
]

export const activeNav = (path: string) => NAV.find((n) => (n.to === '/' ? path === '/' : path.startsWith(n.to)))
