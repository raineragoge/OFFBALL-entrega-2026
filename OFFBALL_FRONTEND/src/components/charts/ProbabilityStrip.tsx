/**
 * Franja apilada de probabilidades GMM (suma 100 %). Cada segmento usa el
 * color fijo de su clúster; los anchos se animan al cambiar de jugador.
 */
import { useState } from 'react'
import type { Profile } from '../../api/types'
import { fractionLabel } from '../../domain/format'
import { byCluster, profileColor } from '../../domain/profiles'
import { useMounted } from '../../motion/hooks'
import { cx } from '../ui/cx'

export function ProbabilityStrip({ perfiles, height = 'h-3', showLegend = false, className, label }: { perfiles: Profile[]; height?: string; showLegend?: boolean; className?: string; label?: string }) {
  const mounted = useMounted()
  const [hover, setHover] = useState<number | null>(null)
  const list = byCluster(perfiles)
  const h = list.find((p) => p.cluster === hover)
  return (
    <div className={cx('min-w-0', className)}>
      <div
        className={cx('relative flex w-full overflow-hidden rounded-full bg-panel-3', height)}
        role="img"
        aria-label={label ?? `Probabilidades GMM: ${list.map((p) => `${p.perfil} ${fractionLabel(p.probabilidad)}`).join(', ')}`}
        onMouseLeave={() => setHover(null)}
      >
        {list.map((p) => (
          <span
            key={p.cluster}
            onMouseEnter={() => setHover(p.cluster)}
            className="h-full transition-[width,opacity] duration-[var(--dur-4)] ease-[var(--ease-out-soft)] first:rounded-l-full last:rounded-r-full"
            style={{
              width: mounted ? `${p.probabilidad * 100}%` : '0%',
              background: profileColor(p.cluster),
              opacity: hover === null || hover === p.cluster ? 1 : 0.35,
              boxShadow: 'inset -1px 0 0 #0d1915',
            }}
          />
        ))}
      </div>
      {h && (
        <p className="mt-1 animate-fade text-[0.72rem] text-salvia-2 tabular">
          <span style={{ color: profileColor(h.cluster) }}>{h.perfil}</span> · {fractionLabel(h.probabilidad)}
        </p>
      )}
      {showLegend && (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.72rem] text-salvia-2">
          {list.map((p) => (
            <li key={p.cluster} className="flex items-center gap-1.5">
              <span className="size-2 rounded-[2px]" style={{ background: profileColor(p.cluster) }} />
              {p.perfil}
              <span className="font-mono text-salvia tabular">{fractionLabel(p.probabilidad, 0)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
