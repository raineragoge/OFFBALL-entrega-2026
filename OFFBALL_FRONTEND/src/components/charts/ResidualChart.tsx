/**
 * Exceso de residuo sobre el umbral P95 (exceso_residuo de la API) frente al
 * valor observado (escala log). Todas las filas del catálogo son alertas, por
 * lo que el exceso es ≥ 0; la línea base 0 es el propio umbral P95.
 */
import { useId, useState } from 'react'
import { eurCompact, num } from '../../domain/format'
import { useMounted } from '../../motion/hooks'
import { logTicks, linearTicks } from './scale'

export interface ResidualPoint {
  id: string
  label: string
  observed: number | null
  excess: number | null
  color: string
}

const W = 680
const H = 300
const M = { l: 56, r: 16, t: 14, b: 42 }

export function ResidualChart({ points, onSelect, selectedId }: { points: ResidualPoint[]; onSelect?: (id: string) => void; selectedId?: string | null }) {
  const uid = useId()
  const mounted = useMounted()
  const [hover, setHover] = useState<string | null>(null)
  const pts = points.filter((p): p is ResidualPoint & { observed: number; excess: number } => !!p.observed && p.observed > 0 && p.excess !== null && Number.isFinite(p.excess))
  if (pts.length < 1) return null
  const xs = pts.map((p) => p.observed)
  const lo = Math.min(...xs) / 1.4
  const hi = Math.max(...xs) * 1.4
  const L = (v: number) => (Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))
  const sx = (v: number) => M.l + L(v) * (W - M.l - M.r)
  const maxE = Math.max(...pts.map((p) => p.excess), 0.05)
  const { max, ticks } = linearTicks(maxE, 4)
  const sy = (v: number) => H - M.b - (v / max) * (H - M.t - M.b)
  const h = hover ? pts.find((p) => p.id === hover) : null
  return (
    <figure className="m-0">
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-labelledby={`${uid}-t`}>
          <title id={`${uid}-t`}>Exceso del residuo logarítmico sobre el umbral P95 para {pts.length} alertas, frente al valor observado.</title>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.l} x2={W - M.r} y1={sy(t)} y2={sy(t)} stroke={t === 0 ? '#b7e68f' : '#1b2f26'} strokeOpacity={t === 0 ? 0.6 : 1} className="crisp" />
              <text x={M.l - 8} y={sy(t) + 3} textAnchor="end" fontSize="10" fill="#7d948c" fontFamily="var(--font-mono)">
                {num(t, 2)}
              </text>
            </g>
          ))}
          {logTicks(lo, hi).map((t) => (
            <text key={t} x={sx(t)} y={H - M.b + 16} textAnchor="middle" fontSize="10" fill="#7d948c" fontFamily="var(--font-mono)">
              {eurCompact(t)}
            </text>
          ))}
          <text x={M.l + 4} y={sy(0) - 6} fontSize="10" fill="#b7e68f">
            umbral P95
          </text>
          <text x={(W + M.l) / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="#a8b9b2">
            Valor observado (escala log)
          </text>
          <text transform={`translate(14 ${(H - M.b + M.t) / 2}) rotate(-90)`} textAnchor="middle" fontSize="11" fill="#a8b9b2">
            Exceso sobre P95 (log)
          </text>
          {pts.map((p, i) => {
            const sel = selectedId === p.id
            const y = sy(p.excess)
            const lift = mounted ? 0 : sy(0) - y
            const delay = `${Math.min(i, 30) * 14}ms`
            return (
              <g
                key={p.id}
                className="cursor-pointer"
                onMouseEnter={() => setHover(p.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelect?.(p.id)}
                opacity={hover && hover !== p.id ? 0.35 : 1}
              >
                <rect
                  x={sx(p.observed) - 0.75}
                  y={y}
                  width={1.5}
                  height={Math.max(0, sy(0) - y)}
                  fill={p.color}
                  style={{
                    transformBox: 'fill-box',
                    transformOrigin: 'bottom',
                    transform: `scaleY(${mounted ? 1 : 0})`,
                    transition: `transform var(--dur-4) var(--ease-out-soft) ${delay}`,
                  }}
                />
                <circle
                  cx={sx(p.observed)}
                  cy={y}
                  r={sel ? 6 : 4}
                  fill={p.color}
                  stroke={sel ? '#fcfcfa' : '#0d1915'}
                  strokeWidth={1.5}
                  tabIndex={0}
                  role="button"
                  aria-label={`${p.label}: exceso ${num(p.excess, 3)}`}
                  onFocus={() => setHover(p.id)}
                  onBlur={() => setHover(null)}
                  onKeyDown={(e) => e.key === 'Enter' && onSelect?.(p.id)}
                  style={{ transform: `translateY(${lift}px)`, transition: `transform var(--dur-4) var(--ease-out-soft) ${delay}` }}
                />
              </g>
            )
          })}
        </svg>
        {h && (
          <div
            className="pointer-events-none absolute z-10 w-52 -translate-x-1/2 -translate-y-[calc(100%+12px)] animate-pop rounded-[var(--radius-btn)] border border-line-2 bg-panel-3/95 px-3 py-2 text-[0.76rem]"
            style={{ left: `${(sx(h.observed) / W) * 100}%`, top: `${(sy(h.excess) / H) * 100}%` }}
          >
            <p className="truncate font-semibold text-blanco">{h.label}</p>
            <p className="mt-1 font-mono text-salvia-2 tabular">
              Obs. {eurCompact(h.observed)} · exceso <span className="text-lime">{num(h.excess, 3)}</span>
            </p>
          </div>
        )}
      </div>
    </figure>
  )
}
