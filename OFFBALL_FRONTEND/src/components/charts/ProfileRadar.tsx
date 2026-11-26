/**
 * Radar de pertenencia a los perfiles GMM.
 * Ejes = los cinco perfiles; radio = probabilidad (escala FIJA 0–100 %, la
 * misma para todas las series, para no exagerar diferencias). Se dibuja
 * progresivamente y se interpola al cambiar de jugador.
 */
import { useId, useState } from 'react'
import { fractionLabel } from '../../domain/format'
import { useReducedMotion, useTweenedRecord } from '../../motion/hooks'
import { cx } from '../ui/cx'

export interface RadarSeries {
  id: string
  label: string
  color: string
  /** perfil → probabilidad 0–1 */
  values: Record<string, number>
}

const SIZE = 320
const C = SIZE / 2
const R = 112
const RINGS = [0.25, 0.5, 0.75, 1]

function Polygon({ s, axes, index }: { s: RadarSeries; axes: string[]; index: number }) {
  const reduced = useReducedMotion()
  const v = useTweenedRecord(s.values)
  const pts = axes.map((a, i) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / axes.length
    const r = R * Math.max(0, Math.min(1, v[a] ?? 0))
    return [C + r * Math.cos(ang), C + r * Math.sin(ang)] as const
  })
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') + ' Z'
  return (
    <g>
      <path d={d} fill={s.color} fillOpacity={0.14} stroke="none" className={reduced ? undefined : 'animate-fade'} style={{ animationDelay: `${120 + index * 90}ms` }} />
      <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" className={reduced ? undefined : 'draw'} style={{ ['--len' as string]: 900, animationDelay: `${index * 90}ms` }} />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3} fill={s.color} stroke="#0d1915" strokeWidth={1.5} />
      ))}
    </g>
  )
}

export function ProfileRadar({ axes, series, className, colorForAxis }: { axes: string[]; series: RadarSeries[]; className?: string; colorForAxis?: (axis: string, i: number) => string }) {
  const uid = useId()
  const [hover, setHover] = useState<number | null>(null)
  if (axes.length < 3) return null
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / axes.length
  return (
    <figure className={cx('m-0', className)}>
      <div className="relative">
        <svg viewBox={`-96 -18 ${SIZE + 192} ${SIZE + 36}`} className="block h-auto w-full" role="img" aria-labelledby={`${uid}-t`}>
          <title id={`${uid}-t`}>
            Probabilidad de pertenencia a cada perfil GMM, escala 0–100 %.{' '}
            {series.map((s) => `${s.label}: ${axes.map((a) => `${a} ${fractionLabel(s.values[a])}`).join(', ')}`).join('. ')}
          </title>
          {RINGS.map((r) => (
            <polygon
              key={r}
              points={axes.map((_, i) => `${C + R * r * Math.cos(angle(i))},${C + R * r * Math.sin(angle(i))}`).join(' ')}
              fill="none"
              stroke="#22392f"
              strokeWidth={1}
            />
          ))}
          {RINGS.map((r) => (
            <text key={`t${r}`} x={C + 4} y={C - R * r + 10} fontSize={9} fill="#7d948c" fontFamily="var(--font-mono)">
              {r * 100}
            </text>
          ))}
          {axes.map((a, i) => {
            const x = C + (R + 4) * Math.cos(angle(i))
            const y = C + (R + 4) * Math.sin(angle(i))
            const lx = C + (R + 18) * Math.cos(angle(i))
            const ly = C + (R + 18) * Math.sin(angle(i))
            const anchor = Math.abs(Math.cos(angle(i))) < 0.2 ? 'middle' : Math.cos(angle(i)) > 0 ? 'start' : 'end'
            return (
              <g key={a} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <line x1={C} y1={C} x2={x} y2={y} stroke={hover === i ? '#3c5a4c' : '#22392f'} />
                <text
                  x={lx}
                  y={ly + (Math.sin(angle(i)) > 0.5 ? 8 : 0)}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  fontSize={11}
                  fontWeight={hover === i ? 600 : 500}
                  fill={colorForAxis ? colorForAxis(a, i) : '#a8b9b2'}
                >
                  {a.length > 22 ? `${a.slice(0, 21)}…` : a}
                </text>
                <circle cx={x} cy={y} r={16} fill="transparent" />
              </g>
            )
          })}
          {series.map((s, i) => (
            <Polygon key={s.id} s={s} axes={axes} index={i} />
          ))}
        </svg>
        {hover !== null && (
          <div className="pointer-events-none absolute top-2 left-2 animate-pop rounded-[var(--radius-btn)] border border-line-2 bg-panel-3/95 px-3 py-2 text-[0.76rem]">
            <p className="font-semibold text-blanco">{axes[hover]}</p>
            {series.map((s) => (
              <p key={s.id} className="mt-0.5 flex items-center gap-2 font-mono tabular" style={{ color: s.color }}>
                <span className="size-2 rounded-full" style={{ background: s.color }} />
                {fractionLabel(s.values[axes[hover]!])}
                <span className="truncate font-sans text-salvia-2">{s.label}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </figure>
  )
}
