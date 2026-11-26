/**
 * Comparación de valores (observado, estimación G02, referencia G01) en una
 * escala lineal común que parte de 0 €. Las barras crecen al montarse; las
 * etiquetas muestran siempre el valor final real.
 */
import { useEffect, useState } from 'react'
import { eurCompact, eurFull } from '../../domain/format'
import { linearTicks } from './scale'

export interface ValueBar {
  key: string
  label: string
  sublabel?: string
  value: number | null
  color: string
}

export function ValueChart({ bars, caption }: { bars: ValueBar[]; caption: string }) {
  const [grown, setGrown] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const present = bars.filter((b): b is ValueBar & { value: number } => b.value !== null && Number.isFinite(b.value))
  const maxV = Math.max(...present.map((b) => b.value), 1)
  const { max, ticks } = linearTicks(maxV, 3)
  const pct = (v: number) => (v / max) * 100

  return (
    <figure className="m-0">
      <div className="grid grid-cols-[minmax(92px,140px)_minmax(0,1fr)] gap-x-4">
        {/* Filas */}
        {bars.map((b) => (
          <div key={b.key} className="contents">
            <div className="flex flex-col justify-center py-2.5">
              <span className="text-[0.8rem] font-medium text-blanco">{b.label}</span>
              {b.sublabel && <span className="font-mono text-2xs text-salvia">{b.sublabel}</span>}
            </div>
            <div className="relative flex items-center py-2.5">
              {/* rejilla */}
              {ticks.map((t) => (
                <span key={t} className="absolute top-0 bottom-0 w-px bg-line" style={{ left: `${pct(t)}%` }} aria-hidden="true" />
              ))}
              {b.value === null ? (
                <span className="relative font-mono text-[0.8rem] text-salvia">N/D · no aportado</span>
              ) : (
                <div className="relative flex w-full items-center gap-3">
                  <div
                    className="h-7 rounded-[3px] transition-[width] duration-500 ease-[var(--ease-out-soft)]"
                    style={{ width: grown ? `${Math.max(pct(b.value), 0.6)}%` : '0%', background: b.color }}
                    title={`${b.label}: ${eurFull(b.value)}`}
                  />
                  <span className="shrink-0 font-mono text-[0.85rem] font-medium text-blanco tabular">{eurCompact(b.value)}</span>
                </div>
              )}
            </div>
          </div>
        ))}
        {/* Eje */}
        <div />
        <div className="relative mt-1 h-5 border-t border-line-2">
          {ticks.map((t, i) => (
            <span
              key={t}
              className="absolute top-1.5 font-mono text-2xs whitespace-nowrap text-salvia tabular"
              style={{
                left: `${pct(t)}%`,
                transform: i === 0 ? 'none' : i === ticks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
              }}
            >
              {t === 0 ? '0 €' : eurCompact(t)}
            </span>
          ))}
        </div>
      </div>
      <figcaption className="mt-3 text-2xs text-salvia">{caption}</figcaption>
    </figure>
  )
}

/**
 * Posición del residuo logarítmico frente al umbral P95 (ambos del backend).
 * No es una probabilidad: sólo muestra si el residuo supera el umbral.
 */
export function ResidualGauge({ residuo, umbral }: { residuo: number; umbral: number }) {
  const lo = Math.min(-0.5, residuo - 0.25, 0)
  const hi = Math.max(umbral + 0.5, residuo + 0.25)
  const x = (v: number) => ((v - lo) / (hi - lo)) * 100
  const over = residuo > umbral
  return (
    <div>
      <div className="relative h-10">
        <div className="absolute top-1/2 right-0 left-0 h-[6px] -translate-y-1/2 rounded-full bg-panel-3" />
        <div
          className="absolute top-1/2 h-[6px] -translate-y-1/2 rounded-r-full bg-lime/25"
          style={{ left: `${x(umbral)}%`, right: 0 }}
          aria-hidden="true"
        />
        <span className="absolute top-1 bottom-1 w-px bg-salvia-2" style={{ left: `${x(0)}%` }} aria-hidden="true" />
        <span className="absolute top-0 bottom-0 w-[2px] bg-lime" style={{ left: `${x(umbral)}%` }} aria-hidden="true" />
        <span
          className={`absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-noche transition-[left] duration-500 ${over ? 'bg-lime' : 'bg-blanco'}`}
          style={{ left: `${x(residuo)}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="relative h-4 font-mono text-2xs text-salvia tabular">
        <span className="absolute -translate-x-1/2" style={{ left: `${x(0)}%` }}>
          0
        </span>
        <span className="absolute -translate-x-1/2 text-lime" style={{ left: `${x(umbral)}%` }}>
          P95
        </span>
      </div>
      <p className="sr-only">
        Residuo logarítmico {residuo.toFixed(3)}, umbral P95 {umbral.toFixed(3)}: {over ? 'supera' : 'no supera'} el umbral.
      </p>
    </div>
  )
}
