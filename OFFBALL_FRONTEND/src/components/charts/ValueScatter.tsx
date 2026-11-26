/**
 * Dispersión valor observado (x) frente a estimación G02 (y), escala log en
 * ambos ejes con el MISMO dominio (la diagonal es la predicción perfecta).
 * Sólo pinta filas con ambos valores > 0 devueltos por la API.
 * Los puntos se desplazan con transición al cambiar filtros o página.
 */
import { useId, useMemo, useState, type ReactNode } from 'react'
import { eurCompact } from '../../domain/format'
import { useReducedMotion } from '../../motion/hooks'
import { cx } from '../ui/cx'
import { logTicks } from './scale'

export interface ScatterPoint {
  id: string
  x: number | null
  y: number | null
  category: string
  label: string
  detail?: ReactNode
}

export interface ScatterCategory {
  id: string
  label: string
  color: string
}

const W = 680
const H = 400
const M = { l: 62, r: 18, t: 16, b: 44 }

export function ValueScatter({
  points,
  categories,
  selectedId,
  onSelect,
  guides = false,
  caption,
  className,
}: {
  points: ScatterPoint[]
  categories: ScatterCategory[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  /** Muestra líneas ×2 y ×½ (modo Avanzado). */
  guides?: boolean
  caption?: ReactNode
  className?: string
}) {
  const uid = useId()
  const reduced = useReducedMotion()
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [hover, setHover] = useState<string | null>(null)

  const valid = useMemo(
    () => points.filter((p): p is ScatterPoint & { x: number; y: number } => !!p.x && !!p.y && p.x > 0 && p.y > 0),
    [points],
  )
  const visible = valid.filter((p) => !hidden.has(p.category))
  const domainPts = valid.length ? valid : [{ x: 1e5, y: 1e7 }]
  const all = domainPts.flatMap((p) => [p.x, p.y])
  const lo = Math.min(...all) / 1.5
  const hi = Math.max(...all) * 1.5
  const L = (v: number) => (Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))
  const sx = (v: number) => M.l + L(v) * (W - M.l - M.r)
  const sy = (v: number) => H - M.b - L(v) * (H - M.t - M.b)
  const ticks = logTicks(lo, hi)
  const color = (c: string) => categories.find((k) => k.id === c)?.color ?? '#a8b9b2'
  const h = hover ? visible.find((p) => p.id === hover) : null
  const aboveCount = visible.filter((p) => p.y > p.x).length

  if (valid.length < 1) return null

  return (
    <figure className={cx('m-0', className)}>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-labelledby={`${uid}-t`}>
          <title id={`${uid}-t`}>
            Valor observado frente a estimación G02 para {visible.length} jugadores, escala logarítmica. {aboveCount} por encima de la diagonal.
          </title>
          <defs>
            <clipPath id={`${uid}-plot`}>
              <rect x={M.l} y={M.t} width={W - M.l - M.r} height={H - M.t - M.b} />
            </clipPath>
          </defs>
          {/* Región "estimación superior al observado" */}
          <path
            d={`M ${sx(lo)} ${sy(lo)} L ${sx(hi)} ${sy(hi)} L ${sx(lo)} ${sy(hi)} Z`}
            fill="#b7e68f"
            fillOpacity={0.035}
            clipPath={`url(#${uid}-plot)`}
          />
          {ticks.map((t) => (
            <g key={t}>
              <line x1={sx(t)} x2={sx(t)} y1={M.t} y2={H - M.b} stroke="#1b2f26" className="crisp" />
              <line x1={M.l} x2={W - M.r} y1={sy(t)} y2={sy(t)} stroke="#1b2f26" className="crisp" />
              <text x={sx(t)} y={H - M.b + 16} textAnchor="middle" fontSize="10" fill="#7d948c" fontFamily="var(--font-mono)">
                {eurCompact(t)}
              </text>
              <text x={M.l - 8} y={sy(t) + 3} textAnchor="end" fontSize="10" fill="#7d948c" fontFamily="var(--font-mono)">
                {eurCompact(t)}
              </text>
            </g>
          ))}
          {guides &&
            [2, 0.5].map((f) => (
              <g key={f} clipPath={`url(#${uid}-plot)`}>
                <line x1={sx(lo)} y1={sy(lo * f)} x2={sx(hi)} y2={sy(hi * f)} stroke="#3c5a4c" strokeDasharray="2 4" />
                <text x={sx(hi / (f > 1 ? 2.4 : 1.2)) - 4} y={sy((hi / (f > 1 ? 2.4 : 1.2)) * f) + (f > 1 ? -6 : 14)} textAnchor="end" fontSize="9.5" fill="#7d948c">
                  {f > 1 ? 'estimado = 2 × observado' : 'estimado = ½ × observado'}
                </text>
              </g>
            ))}
          <line x1={sx(lo)} y1={sy(lo)} x2={sx(hi)} y2={sy(hi)} stroke="#a8b9b2" strokeWidth={1.25} strokeDasharray="5 4" className={reduced ? undefined : 'draw'} style={{ ['--len' as string]: 900 }} />
          <text x={sx(hi) - 6} y={sy(hi) + 16} textAnchor="end" fontSize="10" fill="#a8b9b2">
            predicción perfecta
          </text>
          <text x={(W + M.l) / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="#a8b9b2">
            Valor observado de mercado (escala log)
          </text>
          <text transform={`translate(14 ${(H - M.b + M.t) / 2}) rotate(-90)`} textAnchor="middle" fontSize="11" fill="#a8b9b2">
            Estimación del modelo G02 (escala log)
          </text>

          <g clipPath={`url(#${uid}-plot)`}>
            {visible.map((p, i) => {
              const sel = selectedId === p.id
              const hv = hover === p.id
              const dim = (hover && !hv) || (selectedId && !sel && !hover)
              return (
                <g
                  key={p.id}
                  style={{
                    transform: `translate(${sx(p.x)}px, ${sy(p.y)}px)`,
                    transition: reduced ? undefined : 'transform var(--dur-4) var(--ease-out-soft)',
                  }}
                >
                  <circle
                    r={sel ? 7 : hv ? 6.5 : 4.5}
                    fill={color(p.category)}
                    fillOpacity={dim ? 0.3 : 0.92}
                    stroke={sel ? '#fcfcfa' : '#0d1915'}
                    strokeWidth={sel ? 2 : 1.25}
                    className={cx('cursor-pointer transition-[r,fill-opacity] duration-[var(--dur-1)]', !reduced && 'animate-fade')}
                    style={{ animationDelay: `${Math.min(i, 40) * 12}ms` }}
                    tabIndex={0}
                    role="button"
                    aria-label={`${p.label}: observado ${eurCompact(p.x)}, estimado ${eurCompact(p.y)}`}
                    aria-pressed={sel}
                    onMouseEnter={() => setHover(p.id)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(p.id)}
                    onBlur={() => setHover(null)}
                    onClick={() => onSelect?.(p.id)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect?.(p.id))}
                  />
                </g>
              )
            })}
          </g>
        </svg>
        {h && (
          <div
            className="pointer-events-none absolute z-10 w-56 -translate-x-1/2 -translate-y-[calc(100%+12px)] animate-pop rounded-[var(--radius-btn)] border border-line-2 bg-panel-3/95 px-3 py-2 text-[0.76rem] shadow-[0_12px_32px_-16px_rgba(0,0,0,0.8)]"
            style={{ left: `${(sx(h.x) / W) * 100}%`, top: `${(sy(h.y) / H) * 100}%` }}
          >
            <p className="truncate font-semibold text-blanco">{h.label}</p>
            <p className="mt-1 font-mono text-salvia-2 tabular">
              <span className="text-gold">Obs. {eurCompact(h.x)}</span> · <span className="text-lime">Est. {eurCompact(h.y)}</span>
            </p>
            {h.detail && <div className="mt-0.5 text-salvia-2">{h.detail}</div>}
          </div>
        )}
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-2xs text-salvia">
        {categories.map((c) => {
          const off = hidden.has(c.id)
          const n = valid.filter((p) => p.category === c.id).length
          if (!n) return null
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={!off}
              onClick={() =>
                setHidden((s) => {
                  const next = new Set(s)
                  if (next.has(c.id)) next.delete(c.id)
                  else next.add(c.id)
                  return next
                })
              }
              className={cx('press flex items-center gap-1.5 rounded px-1 py-0.5 transition-opacity hover:text-blanco', off && 'opacity-40 line-through')}
            >
              <span className="size-2 rounded-full" style={{ background: c.color }} /> {c.label} <span className="font-mono tabular">({n})</span>
            </button>
          )
        })}
        {caption && <span className="basis-full sm:basis-auto">{caption}</span>}
      </figcaption>
    </figure>
  )
}
