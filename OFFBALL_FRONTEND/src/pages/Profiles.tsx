/**
 * Perfiles deportivos (GMM K=5).
 * - Nombres de perfil: /api/v1/metadata (perfiles).
 * - Jugadores: SÓLO tus análisis guardados con resultado de /afinidad.
 * - Ejes del gráfico: goles/90 y asistencias/90 reales (sin reducción
 *   dimensional). La altura, tercera variable del modelo, se ve en el detalle.
 * - K-Means: la API v0.1.0 no expone sus asignaciones → se documenta, no se simula.
 */
import { useId, useMemo, useState } from 'react'
import { ProbabilityStrip } from '../components/charts/ProbabilityStrip'
import { linearTicks } from '../components/charts/scale'
import { IconArrowRight, IconInfo, IconProfiles } from '../components/icons'
import { Badge, EmptyState, PageHeader, Panel, SectionTitle, buttonClass, cx } from '../components/ui/primitives'
import { offensiveItems } from '../domain/comparisons'
import { fractionLabel, num, per90 } from '../domain/format'
import { subShort } from '../domain/positions'
import { MIXED_THRESHOLD, profileColor, profileGloss, readProfiles } from '../domain/profiles'
import { RevealGroup, reveal } from '../motion/components'
import { useReducedMotion } from '../motion/hooks'
import { Link } from '../router/router'
import { useApiStatus } from '../state/api-status'
import { useMode } from '../state/prefs'
import { useSaved } from '../state/saved'

interface Pt {
  id: string
  name: string
  sub: string
  g90: number
  a90: number
  height: number | null
  cluster: number
  perfil: string
  prob: number
  mixed: boolean
  item: ReturnType<typeof offensiveItems>[number]
}

const W = 640
const H = 380
const M = { l: 52, r: 18, t: 16, b: 44 }

export function ProfilesPage() {
  const api = useApiStatus()
  const { advanced } = useMode()
  const saved = useSaved()
  const reduced = useReducedMotion()
  const uid = useId()
  const md = api.metadata.state === 'ok' ? api.metadata.data : null
  const [focus, setFocus] = useState<number | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)

  const pts: Pt[] = useMemo(
    () =>
      offensiveItems(saved.items).flatMap((i) => {
        const r = readProfiles(i.offensive.perfiles)
        const m = Number(i.form.minutos)
        const g = i.economic?.goles_90 ?? per90(Number(i.form.goles), m)
        const a = i.economic?.asistencias_90 ?? per90(Number(i.form.asistencias), m)
        if (!r || g === null || a === null) return []
        const h = Number(i.form.height_in_cm.replace(',', '.'))
        return [
          {
            id: i.id,
            name: i.nombre || 'Análisis sin nombre',
            sub: subShort(i.form.sub_position),
            g90: g,
            a90: a,
            height: Number.isFinite(h) ? h : null,
            cluster: r.top.cluster,
            perfil: r.top.perfil,
            prob: r.top.probabilidad,
            mixed: r.mixed,
            item: i,
          },
        ]
      }),
    [saved.items],
  )

  const names = md?.perfiles ?? [...new Set(pts.map((p) => p.perfil))]
  const clusterOf = (name: string) => {
    const i = names.indexOf(name)
    return i >= 0 ? i : (pts.find((p) => p.perfil === name)?.cluster ?? 0)
  }
  const stats = names.map((n) => {
    const g = pts.filter((p) => p.perfil === n)
    const mean = (f: (p: Pt) => number | null) => {
      const v = g.map(f).filter((x): x is number => x !== null)
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
    }
    return { name: n, cluster: clusterOf(n), n: g.length, g90: mean((p) => p.g90), a90: mean((p) => p.a90), h: mean((p) => p.height) }
  })

  const gx = linearTicks(Math.max(0.3, ...pts.map((p) => p.g90)), 4)
  const gy = linearTicks(Math.max(0.3, ...pts.map((p) => p.a90)), 4)
  const sx = (v: number) => M.l + (v / gx.max) * (W - M.l - M.r)
  const sy = (v: number) => H - M.b - (v / gy.max) * (H - M.t - M.b)
  const selected = pts.find((p) => p.id === sel) ?? null
  const hv = pts.find((p) => p.id === hover) ?? null
  const mixedCount = pts.filter((p) => p.mixed).length

  return (
    <div>
      <PageHeader
        title="Perfiles deportivos"
        description="El modelo agrupa a los atacantes en cinco perfiles según goles por 90, asistencias por 90 y altura. Un jugador no pertenece a un solo perfil: recibe una probabilidad para cada uno."
      />

      {/* Los cinco perfiles */}
      <RevealGroup className="mb-10 grid overflow-hidden rounded-[var(--radius-card)] border border-line bg-panel sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s, i) => {
          const active = focus === s.cluster
          return (
            <button
              key={s.name}
              type="button"
              {...reveal(i)}
              onClick={() => setFocus(active ? null : s.cluster)}
              aria-pressed={active}
              className={cx(
                'group relative border-line p-5 text-left transition-colors duration-[var(--dur-1)] max-lg:border-b sm:[&:nth-child(odd)]:border-r lg:border-r lg:last:border-r-0',
                active ? 'bg-panel-2' : 'hover:bg-panel-2/60',
                focus !== null && !active && 'opacity-60',
              )}
            >
              <span className="absolute inset-x-0 top-0 h-[3px] origin-left transition-transform duration-[var(--dur-3)]" style={{ background: profileColor(s.cluster), transform: active ? 'scaleX(1)' : 'scaleX(0.25)' }} />
              <p className="font-mono text-2xs text-salvia">C{s.cluster}</p>
              <p className="mt-1 font-display text-[1.02rem] font-bold text-blanco">{s.name}</p>
              <p className="mt-1.5 min-h-[2.5rem] text-[0.76rem] leading-snug text-salvia-2">{profileGloss(s.name) ?? 'Perfil definido por el modelo.'}</p>
              <p className="mt-3 text-[0.78rem] text-salvia">
                <span className="font-mono text-blanco tabular">{s.n}</span> de tus jugadores
              </p>
              {advanced && s.n > 0 && (
                <p className="mt-1 font-mono text-2xs text-salvia tabular">
                  G/90 {num(s.g90, 2)} · A/90 {num(s.a90, 2)}
                  {s.h !== null && ` · ${num(s.h, 0)} cm`}
                </p>
              )}
            </button>
          )
        })}
      </RevealGroup>

      {pts.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<IconProfiles size={20} />}
            title="Aún no hay jugadores con perfil"
            action={
              <Link to="/analizar?ejemplo=1" className={buttonClass('primary', 'md')}>
                Analizar el ejemplo
              </Link>
            }
          >
            Analiza y guarda atacantes (DC, SD, EI, ED o MCO) para verlos situados aquí. La API no publica el conjunto de entrenamiento, así que este mapa sólo muestra
            tus propios análisis.
          </EmptyState>
        </Panel>
      ) : (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
          <div className="min-w-0">
            <SectionTitle
              title="Tus jugadores por perfil"
              description="Cada punto es un análisis guardado, coloreado por su perfil más probable. Los anillos discontinuos señalan perfiles mixtos."
            />
            <Panel className="p-5">
              <div className="relative">
                <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-labelledby={`${uid}-t`}>
                  <title id={`${uid}-t`}>
                    Goles por 90 frente a asistencias por 90 de {pts.length} análisis guardados, coloreados por perfil GMM dominante.
                  </title>
                  {gx.ticks.map((t) => (
                    <g key={`x${t}`}>
                      <line x1={sx(t)} x2={sx(t)} y1={M.t} y2={H - M.b} stroke="#1b2f26" className="crisp" />
                      <text x={sx(t)} y={H - M.b + 16} textAnchor="middle" fontSize="10" fill="#7d948c" fontFamily="var(--font-mono)">
                        {num(t, 2)}
                      </text>
                    </g>
                  ))}
                  {gy.ticks.map((t) => (
                    <g key={`y${t}`}>
                      <line x1={M.l} x2={W - M.r} y1={sy(t)} y2={sy(t)} stroke="#1b2f26" className="crisp" />
                      <text x={M.l - 8} y={sy(t) + 3} textAnchor="end" fontSize="10" fill="#7d948c" fontFamily="var(--font-mono)">
                        {num(t, 2)}
                      </text>
                    </g>
                  ))}
                  <text x={(W + M.l) / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="#a8b9b2">
                    Goles por 90 minutos
                  </text>
                  <text transform={`translate(14 ${(H - M.b + M.t) / 2}) rotate(-90)`} textAnchor="middle" fontSize="11" fill="#a8b9b2">
                    Asistencias por 90 minutos
                  </text>
                  {pts.map((p, i) => {
                    const dim = (focus !== null && p.cluster !== focus) || (hover && hover !== p.id)
                    const isSel = sel === p.id
                    const c = profileColor(p.cluster)
                    return (
                      <g
                        key={p.id}
                        style={{ transform: `translate(${sx(p.g90)}px, ${sy(p.a90)}px)`, transition: reduced ? undefined : 'transform var(--dur-4) var(--ease-out-soft), opacity var(--dur-2)' }}
                        opacity={dim ? 0.25 : 1}
                      >
                        {p.mixed && <circle r={11} fill="none" stroke={c} strokeOpacity={0.7} strokeDasharray="3 3" />}
                        <circle
                          r={4 + p.prob * 4}
                          fill={c}
                          stroke={isSel ? '#fcfcfa' : '#0d1915'}
                          strokeWidth={isSel ? 2 : 1.5}
                          className={cx('cursor-pointer', !reduced && 'animate-pop')}
                          style={{ animationDelay: `${Math.min(i, 20) * 30}ms` }}
                          tabIndex={0}
                          role="button"
                          aria-pressed={isSel}
                          aria-label={`${p.name}: ${p.perfil} ${fractionLabel(p.prob)}, goles/90 ${num(p.g90, 2)}, asistencias/90 ${num(p.a90, 2)}`}
                          onMouseEnter={() => setHover(p.id)}
                          onMouseLeave={() => setHover(null)}
                          onFocus={() => setHover(p.id)}
                          onBlur={() => setHover(null)}
                          onClick={() => setSel(isSel ? null : p.id)}
                          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setSel(isSel ? null : p.id))}
                        />
                      </g>
                    )
                  })}
                </svg>
                {hv && (
                  <div
                    className="pointer-events-none absolute z-10 w-52 -translate-x-1/2 -translate-y-[calc(100%+14px)] animate-pop rounded-[var(--radius-btn)] border border-line-2 bg-panel-3/95 px-3 py-2 text-[0.76rem]"
                    style={{ left: `${(sx(hv.g90) / W) * 100}%`, top: `${(sy(hv.a90) / H) * 100}%` }}
                  >
                    <p className="truncate font-semibold text-blanco">{hv.name}</p>
                    <p className="mt-0.5" style={{ color: profileColor(hv.cluster) }}>
                      {hv.perfil} · {fractionLabel(hv.prob, 0)}
                    </p>
                    <p className="font-mono text-salvia-2 tabular">
                      G/90 {num(hv.g90, 2)} · A/90 {num(hv.a90, 2)}
                    </p>
                  </div>
                )}
              </div>
              <p className="mt-3 flex items-start gap-2 text-2xs leading-snug text-salvia">
                <IconInfo size={13} className="mt-px shrink-0" />
                Sin reducción dimensional: los ejes son dos de las tres variables reales del modelo. El tamaño del punto crece con la probabilidad del perfil dominante.
                Al proyectar en 2D sin la altura, perfiles distintos pueden solaparse.
              </p>
            </Panel>
          </div>

          <aside className="min-w-0">
            <SectionTitle title={selected ? selected.name : 'Detalle'} description={selected ? undefined : 'Selecciona un punto para ver su reparto de probabilidades.'} />
            {selected ? (
              <Panel key={selected.id} className="animate-slide-in p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">{selected.sub}</Badge>
                  {selected.mixed ? <Badge tone="gold">Perfil mixto</Badge> : <Badge tone="lavender">Perfil claro</Badge>}
                </div>
                <p className="mt-3 text-[0.86rem] text-salvia-2">
                  Perfil más probable: <span className="font-semibold" style={{ color: profileColor(selected.cluster) }}>{selected.perfil}</span>{' '}
                  <span className="font-mono tabular">({fractionLabel(selected.prob)})</span>
                </p>
                <ProbabilityStrip perfiles={selected.item.offensive.perfiles} height="h-3" showLegend className="mt-4" />
                <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4 text-[0.78rem]">
                  <div>
                    <dt className="text-2xs text-salvia">Goles/90</dt>
                    <dd className="font-mono text-blanco">{num(selected.g90, 2)}</dd>
                  </div>
                  <div>
                    <dt className="text-2xs text-salvia">Asist./90</dt>
                    <dd className="font-mono text-blanco">{num(selected.a90, 2)}</dd>
                  </div>
                  <div>
                    <dt className="text-2xs text-salvia">Altura</dt>
                    <dd className="font-mono text-blanco">{selected.height !== null ? `${num(selected.height)} cm` : 'N/D'}</dd>
                  </div>
                </dl>
                <Link to={`/analizar?id=${encodeURIComponent(selected.id)}`} className={buttonClass('secondary', 'sm', 'mt-5 w-full')}>
                  Abrir informe <IconArrowRight size={14} />
                </Link>
              </Panel>
            ) : (
              <Panel className="p-5 text-[0.84rem] leading-relaxed text-salvia-2">
                <p>
                  <span className="font-mono text-blanco tabular">{pts.length}</span> jugadores con perfil · <span className="font-mono text-blanco tabular">{mixedCount}</span> con perfil
                  mixto (ninguna probabilidad supera el {Math.round(MIXED_THRESHOLD * 100)} %).
                </p>
                <p className="mt-3 text-[0.8rem] text-salvia">Pulsa un perfil arriba para resaltar sólo a sus jugadores.</p>
              </Panel>
            )}

            {advanced && (
              <Panel className="mt-6 p-5">
                <p className="text-[0.86rem] font-semibold text-blanco">Comparación con K-Means</p>
                <p className="mt-2 text-[0.8rem] leading-relaxed text-salvia-2">
                  K-Means se usó como modelo de referencia durante el desarrollo, pero la API v0.1.0 no publica sus asignaciones ni métricas. Para comparar ambos métodos
                  aquí haría falta un endpoint con el clúster K-Means de cada jugador (o una tabla de contingencia GMM × K-Means).
                </p>
                <p className="mt-3 text-2xs text-salvia">No se muestra ninguna comparación simulada.</p>
              </Panel>
            )}
          </aside>
        </section>
      )}
    </div>
  )
}
