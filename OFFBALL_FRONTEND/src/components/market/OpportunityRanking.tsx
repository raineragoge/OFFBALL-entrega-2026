import {QuickActions} from './QuickActions'
import {fromHistorical} from '../../domain/shortlist'
/**
 * Ranking de alertas del catálogo ordenadas por exceso de residuo sobre P95.
 * Cada fila dibuja observado (oro) → estimado (lima) en una escala log COMÚN a
 * toda la lista, para que las longitudes sean comparables entre filas.
 */
import type { OpportunityRow } from '../../api/types'
import { competitionShort } from '../../domain/competitions'
import { eurCompact, num, pctPoints } from '../../domain/format'
import { catalogIdentity } from '../../domain/market'
import { subShort } from '../../domain/positions'
import { useMounted } from '../../motion/hooks'
import { cx } from '../ui/cx'

export function rankRows(rows: OpportunityRow[]): OpportunityRow[] {
  return [...rows].sort((a, b) => (b.exceso_residuo ?? -Infinity) - (a.exceso_residuo ?? -Infinity))
}

export function OpportunityRanking({
  rows,
  onOpen,
  selectedId,
  startRank = 1,
  advanced,
  dense,
  quickActions,
}: {
  rows: OpportunityRow[]
  onOpen: (r: OpportunityRow) => void
  selectedId?: string | null
  startRank?: number
  advanced?: boolean
  dense?: boolean
  quickActions?: boolean
}) {
  const mounted = useMounted()
  const vals = rows.flatMap((r) => [r.market_value_in_eur, r.valor_estimado]).filter((v): v is number => !!v && v > 0)
  const lo = vals.length ? Math.min(...vals) / 1.3 : 1
  const hi = vals.length ? Math.max(...vals) * 1.3 : 10
  const pos = (v: number) => ((Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * 100

  return (
    <ol className="divide-y divide-line" aria-label="Ranking de oportunidades por exceso sobre el umbral P95">
      {rows.map((r, i) => {
        const id = catalogIdentity(r)
        const o = r.market_value_in_eur
        const e = r.valor_estimado
        const sel = selectedId === id
        const market = quickActions ? fromHistorical(r) : null
        return (
          <li key={id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}>
            <button
              type="button"
              onClick={() => onOpen(r)}
              aria-pressed={sel}
              className={cx(
                'group grid w-full grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-3 px-1 text-left transition-colors duration-[var(--dur-1)] hover:bg-panel-2/70',
                dense ? 'py-2.5' : 'py-3',
                sel && 'bg-panel-2',
              )}
            >
              <span className="text-center font-mono text-[0.8rem] text-salvia tabular">{startRank + i}</span>
              <span className="min-w-0">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[0.86rem] font-semibold text-blanco group-hover:text-lime">{r.name ?? 'Sin nombre'}</span>
                  <span className="shrink-0 font-mono text-[0.8rem] text-lime tabular">{pctPoints(r.diferencia_pct, 0)}</span>
                </span>
                <span className="mt-0.5 flex justify-between gap-3 text-2xs text-salvia">
                  <span className="truncate">
                    {subShort(r.sub_position)} · {competitionShort(r.competition_id)} · {num(r.age)} años
                  </span>
                  <span className="shrink-0 font-mono tabular">
                    <span className="text-gold">{eurCompact(o)}</span> → <span className="text-salvia-2">{eurCompact(e)}</span>
                  </span>
                </span>
                {o && e && o > 0 && e > 0 && (
                  <span className="relative mt-2 block h-2" aria-hidden="true">
                    <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line" />
                    <span
                      className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-gradient-to-r from-gold/70 to-lime transition-[width] duration-[var(--dur-4)] ease-[var(--ease-out-soft)]"
                      style={{ left: `${pos(Math.min(o, e))}%`, width: mounted ? `${Math.abs(pos(e) - pos(o))}%` : '0%', transitionDelay: `${Math.min(i, 8) * 45}ms` }}
                    />
                    <span className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold" style={{ left: `${pos(o)}%` }} />
                    <span
                      className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime transition-[left] duration-[var(--dur-4)] ease-[var(--ease-out-soft)]"
                      style={{ left: `${mounted ? pos(e) : pos(o)}%`, transitionDelay: `${Math.min(i, 8) * 45}ms` }}
                    />
                  </span>
                )}
                {advanced && (
                  <span className="mt-1 block text-right font-mono text-2xs text-salvia tabular">exceso P95 {num(r.exceso_residuo, 3)}</span>
                )}
              </span>
            </button>
            {market&&<div className="pl-10 pb-2"><QuickActions row={market}/></div>}
          </li>
        )
      })}
    </ol>
  )
}
