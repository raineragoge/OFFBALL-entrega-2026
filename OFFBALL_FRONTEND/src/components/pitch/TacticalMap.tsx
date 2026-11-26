/**
 * Mapa táctico estimado — componente completo (controles, leyenda, comparación,
 * pantalla completa y panel contextual). Comparte estado de preferencias
 * (representación, contraste, opacidad, capas) entre todas las instancias.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { fractionLabel, num } from '../../domain/format'
import { affinityDelta, HEAT_STOPS, rgb, shape, uniformBaseline, VIEW_IDENTITY, zonesFrom, zoomAt, type View } from '../../domain/pitch'
import { useMode, usePrefs, type PitchRender } from '../../state/prefs'
import { IconFullscreen, IconInfo, IconLayers, IconMinus, IconPlus, IconRefresh, IconSliders, IconX } from '../icons'
import { Badge, ChipToggle, IconButton, Meter, Segmented, Select, cx } from '../ui/primitives'
import { TacticalPitch } from './TacticalPitch'

export interface ComparisonOption {
  id: string
  label: string
  kind: 'jugador' | 'grupo' | 'uniforme'
  afinidad: Record<string, number>
  note?: string
}

export interface TacticalMapProps {
  afinidad: Record<string, number>
  mejor: string
  alternativa: string
  playerLabel: string
  comparisons?: ComparisonOption[]
  /** Comparación preseleccionada (id). */
  defaultCompare?: string | null
  footKnown?: boolean
  className?: string
}

type CompareDisplay = 'paralelo' | 'diferencia'

const ppLabel = (d: number) => `${d > 0 ? '+' : d < 0 ? '−' : '±'}${num(Math.abs(d) * 100, 1)} pp`

export function HeatLegend({ gamma, diverging = false, compact = false }: { gamma: number; diverging?: boolean; compact?: boolean }) {
  if (diverging) {
    return (
      <div aria-label="Leyenda de diferencia: azul, la comparación es mayor; lima, el jugador es mayor" role="img">
        <div className="h-2 rounded-full" style={{ background: 'linear-gradient(90deg, #83b9ce, #1e352b 50%, #b7e68f)' }} />
        <div className="mt-1 flex justify-between font-mono text-2xs text-salvia tabular">
          <span>Comparación mayor</span>
          <span>0</span>
          <span>Jugador mayor</span>
        </div>
      </div>
    )
  }
  const ticks = compact ? [0, 0.25, 1] : [0, 0.1, 0.25, 0.5, 1]
  const grad = HEAT_STOPS.map((s) => `${rgb(s.c)} ${s.t * 100}%`).join(', ')
  return (
    <div role="img" aria-label="Escala fija de afinidad de 0 a 100 %">
      <div className="h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${grad})` }} />
      <div className="relative mt-1 h-4 font-mono text-2xs whitespace-nowrap text-salvia tabular">
        {ticks.map((t, i) => (
          <span
            key={t}
            className="absolute transition-[left] duration-[var(--dur-3)] ease-[var(--ease-out-soft)]"
            style={{ left: `${shape(t, gamma) * 100}%`, transform: i === 0 ? 'none' : i === ticks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)' }}
          >
            {Math.round(t * 100)} %
          </span>
        ))}
      </div>
    </div>
  )
}

/** Aviso permanente de naturaleza estimada del mapa. */
export function EstimatedMapNotice({ className }: { className?: string }) {
  return (
    <p className={cx('flex items-start gap-2 text-[0.75rem] leading-snug text-salvia', className)}>
      <IconInfo size={14} className="mt-0.5 shrink-0 text-gold" />
      <span>
        <span className="font-semibold text-gold">Mapa táctico estimado.</span> Colorea cuatro roles según la afinidad estadística que devuelve el modelo
        (GMM + matriz perfil×zona). No son acciones, toques ni posiciones registradas en partido.
      </span>
    </p>
  )
}

export function TacticalMap({ afinidad, mejor, alternativa, playerLabel, comparisons = [], defaultCompare = null, footKnown, className }: TacticalMapProps) {
  const { advanced } = useMode()
  const { prefs, update } = usePrefs()
  const P = prefs.pitch
  const setPitch = useCallback((patch: Partial<typeof P>) => update((p) => ({ ...p, pitch: { ...p.pitch, ...patch } })), [update])

  const [selected, setSelected] = useState<string | null>(null)
  const [view, setView] = useState<View>(VIEW_IDENTITY)
  const [cmpId, setCmpId] = useState<string | null>(defaultCompare)
  const [cmpDisplay, setCmpDisplay] = useState<CompareDisplay>('paralelo')
  const [showControls, setShowControls] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const [isFs, setIsFs] = useState(false)

  const cmp = comparisons.find((c) => c.id === cmpId) ?? null
  const zones = useMemo(() => zonesFrom(afinidad), [afinidad])
  const baseline = uniformBaseline(afinidad)

  // Al cambiar de jugador se conserva la selección si la zona existe.
  useEffect(() => {
    if (selected && !(selected in afinidad)) setSelected(null)
  }, [afinidad, selected])

  useEffect(() => {
    const on = () => setIsFs(document.fullscreenElement === root.current)
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])
  const toggleFs = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void root.current?.requestFullscreen?.().catch(() => {})
  }

  const fsSupported = typeof document !== 'undefined' && !!document.fullscreenEnabled
  const sel = zones.find((z) => z.name === selected) ?? null
  const best = zones.find((z) => z.name === mejor)
  const alt = zones.find((z) => z.name === alternativa)
  const unmapped = zones.filter((z) => !z.slot)

  const common = {
    mejor,
    alternativa,
    render: P.render,
    gamma: P.gamma,
    opacity: P.opacity,
    layers: P.layers,
    selected,
    onSelect: setSelected,
    view,
    onViewChange: setView,
  }

  const parallel = !!cmp && cmpDisplay === 'paralelo'
  const diff = !!cmp && cmpDisplay === 'diferencia'

  return (
    <div
      ref={root}
      className={cx(
        '@container min-w-0',
        isFs && 'overflow-y-auto bg-noche p-6',
        className,
      )}
    >
      {/* Barra de herramientas */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="w-full sm:w-auto">
          <Segmented<PitchRender>
            label="Representación del mapa"
            size="sm"
            value={P.render}
            onChange={(render) => setPitch({ render })}
            options={[
              { value: 'zonas', label: 'Zonas', hint: 'Cada rol como un área de color uniforme' },
              { value: 'continuo', label: 'Difuminado', hint: 'Transición suave entre zonas (representativa)' },
            ]}
            className="sm:w-56"
          />
        </div>
        <div className="flex items-center gap-1">
          <IconButton label="Acercar" onClick={() => setView((v) => zoomAt(v, 1.4))} disabled={view.k >= 4}>
            <IconPlus size={16} />
          </IconButton>
          <IconButton label="Alejar" onClick={() => setView((v) => zoomAt(v, 1 / 1.4))} disabled={view.k <= 1}>
            <IconMinus size={16} />
          </IconButton>
          <IconButton label="Restablecer vista" onClick={() => setView(VIEW_IDENTITY)} disabled={view.k === 1 && view.x === 0 && view.y === 0}>
            <IconRefresh size={15} />
          </IconButton>
          <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />
          <IconButton label="Ajustes del mapa" active={showControls} onClick={() => setShowControls((s) => !s)} aria-expanded={showControls}>
            <IconSliders size={16} />
          </IconButton>
          {fsSupported && (
            <IconButton label={isFs ? 'Salir de pantalla completa' : 'Pantalla completa'} onClick={toggleFs}>
              {isFs ? <IconX size={16} /> : <IconFullscreen size={16} />}
            </IconButton>
          )}
        </div>
      </div>

      {/* Ajustes (capas, intensidad, opacidad, comparación) */}
      <div className="disclose" data-open={showControls} inert={!showControls}>
        <div>
          <div className="mb-4 grid gap-4 rounded-[var(--radius-btn)] border border-line bg-noche-2 p-4 md:grid-cols-2">
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[0.76rem] font-medium text-salvia-2">
                <IconLayers size={14} /> Capas
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ['lines', 'Líneas del campo', '#a8b9b2'],
                    ['labels', 'Nombres', '#fcfcfa'],
                    ['values', 'Valores', '#b7e68f'],
                    ['markers', 'Mejor / alternativa', '#b7e68f'],
                  ] as const
                ).map(([k, label, sw]) => (
                  <ChipToggle key={k} checked={P.layers[k]} swatch={sw} onChange={(v) => setPitch({ layers: { ...P.layers, [k]: v } })}>
                    {label}
                  </ChipToggle>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-[0.76rem] text-salvia-2">
                <span className="mb-1.5 flex justify-between">
                  Contraste <span className="font-mono text-salvia tabular">γ {num(P.gamma, 2)}</span>
                </span>
                <input type="range" min={0.35} max={1} step={0.05} value={P.gamma} onChange={(e) => setPitch({ gamma: Number(e.target.value) })} className="w-full" />
              </label>
              <label className="block text-[0.76rem] text-salvia-2">
                <span className="mb-1.5 flex justify-between">
                  Opacidad <span className="font-mono text-salvia tabular">{Math.round(P.opacity * 100)} %</span>
                </span>
                <input type="range" min={0.3} max={1} step={0.05} value={P.opacity} onChange={(e) => setPitch({ opacity: Number(e.target.value) })} className="w-full" />
              </label>
              <p className="col-span-2 -mt-2 text-2xs leading-snug text-salvia">
                El contraste cambia sólo la escala de color (v<sup>γ</sup>); los porcentajes no se alteran.
              </p>
            </div>
            {comparisons.length > 0 && (
              <div className="grid gap-3 md:col-span-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <label className="block text-[0.76rem] text-salvia-2">
                  <span className="mb-1.5 block">Comparar con</span>
                  <Select value={cmpId ?? ''} onChange={(e) => setCmpId(e.target.value || null)}>
                    <option value="">Sin comparación</option>
                    {comparisons.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                </label>
                <Segmented<CompareDisplay>
                  label="Tipo de comparación"
                  size="sm"
                  value={cmpDisplay}
                  onChange={setCmpDisplay}
                  options={[
                    { value: 'paralelo', label: 'En paralelo', disabled: !cmp },
                    { value: 'diferencia', label: 'Diferencia', disabled: !cmp },
                  ]}
                  className="md:w-60"
                />
                {cmp?.note && <p className="text-2xs text-salvia md:col-span-2">{cmp.note}</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={cx('grid gap-5', isFs ? '@4xl:grid-cols-[minmax(0,1fr)_340px]' : '@2xl:grid-cols-[minmax(0,1fr)_260px]')}>
        <div className="min-w-0">
          <div className={cx('grid gap-3', parallel && 'sm:grid-cols-2')}>
            <figure className="m-0 min-w-0">
              {parallel && <figcaption className="mb-1.5 truncate text-[0.78rem] font-semibold text-blanco">{playerLabel}</figcaption>}
              <TacticalPitch
                {...common}
                values={afinidad}
                compare={cmp?.afinidad ?? null}
                compareLabel={cmp?.label}
                display={diff ? 'diff' : 'single'}
                title={diff ? `Diferencia de afinidad: ${playerLabel} menos ${cmp?.label}` : `Mapa táctico estimado de ${playerLabel}`}
                className={cx('w-full border border-line', isFs && !parallel && 'mx-auto max-w-[min(100%,calc((100dvh-12rem)*1.25))]')}
              />
            </figure>
            {parallel && cmp && (
              <figure className="m-0 min-w-0 animate-slide-in">
                <figcaption className="mb-1.5 flex items-center gap-2 truncate text-[0.78rem] font-semibold text-blue">{cmp.label}</figcaption>
                <TacticalPitch
                  {...common}
                  mejor={null}
                  alternativa={null}
                  values={cmp.afinidad}
                  compare={afinidad}
                  compareLabel={playerLabel}
                  title={`Mapa táctico estimado de ${cmp.label}`}
                  accent="#83b9ce"
                  className="w-full border border-line"
                />
              </figure>
            )}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <HeatLegend gamma={P.gamma} diverging={diff} />
            {P.layers.markers && !diff && (
              <div className="flex gap-4 text-2xs text-salvia sm:pt-0.5">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-3.5 rounded-[2px] border-2 border-lime" /> Mejor zona
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-3.5 rounded-[2px] border-2 border-dashed border-salvia-2" /> Alternativa
                </span>
              </div>
            )}
          </div>
          <p className="mt-2 text-2xs text-salvia">
            {view.k > 1 ? 'Arrastra para desplazar · doble clic para acercar más.' : 'Ctrl/⌘ + rueda o doble clic para acercar · pasa el cursor o tabula por las zonas.'}
          </p>
          {unmapped.length > 0 && (
            <p className="mt-2 text-2xs text-gold">Zonas sin área conocida en el campo (sólo en la lista): {unmapped.map((z) => z.name).join(', ')}.</p>
          )}
        </div>

        {/* Panel contextual */}
        <aside className="min-w-0" aria-live="polite">
          {sel ? (
            <ZoneDetail
              key={sel.name}
              zone={sel}
              total={zones.length}
              baseline={baseline}
              best={sel.name === mejor}
              alt={sel.name === alternativa}
              cmp={cmp}
              advanced={advanced}
              onClose={() => setSelected(null)}
            />
          ) : (
            <div className="animate-fade space-y-4">
              {best && (
                <p className="text-[0.86rem] leading-relaxed text-salvia-2">
                  Encaja sobre todo como <span className="font-semibold text-blanco">{best.label.toLowerCase()}</span>{' '}
                  <span className="font-mono text-lime tabular">({fractionLabel(best.value)})</span>
                  {alt && (
                    <>
                      , con <span className="font-semibold text-blanco">{alt.label.toLowerCase()}</span> como alternativa{' '}
                      <span className="font-mono tabular">({fractionLabel(alt.value)})</span>
                    </>
                  )}
                  .
                </p>
              )}
              <ul className="space-y-2.5" aria-label="Afinidad por zona">
                {zones.map((z) => (
                  <li key={z.name}>
                    <button
                      type="button"
                      onClick={() => setSelected(z.name)}
                      className="group w-full rounded-[var(--radius-ctl)] text-left"
                    >
                      <span className="mb-1 flex items-baseline justify-between gap-2 text-[0.8rem]">
                        <span className="flex min-w-0 items-center gap-2 text-blanco group-hover:text-lime">
                          <span className="truncate">{z.label}</span>
                          {z.name === mejor && <Badge tone="lime" className="h-5 px-1.5 text-[0.65rem]">Mejor</Badge>}
                          {z.name === alternativa && <Badge tone="neutral" className="h-5 px-1.5 text-[0.65rem]">Alternativa</Badge>}
                        </span>
                        <span className="shrink-0 font-mono text-blanco tabular">{fractionLabel(z.value)}</span>
                      </span>
                      <Meter value={z.value} color={rgb(HEAT_STOPS[4]!.c)} />
                      {cmp && cmp.afinidad[z.name] !== undefined && (
                        <span className="mt-1 flex items-center gap-2">
                          <Meter value={cmp.afinidad[z.name]!} color="var(--color-blue)" className="h-1 flex-1" />
                          <span className="w-16 text-right font-mono text-2xs text-blue tabular">{fractionLabel(cmp.afinidad[z.name])}</span>
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              {cmp && advanced && (
                <DeltaTable a={afinidad} b={cmp.afinidad} bLabel={cmp.label} />
              )}
              <p className="text-2xs leading-snug text-salvia">
                Las cuatro cifras suman 100 %: es un reparto relativo, no una medida de calidad.
                {footKnown === false && ' No se indicó el pie: la afinidad no aplica ese ajuste.'}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function DeltaTable({ a, b, bLabel }: { a: Record<string, number>; b: Record<string, number>; bLabel: string }) {
  const d = affinityDelta(a, b)
  return (
    <table className="w-full text-[0.76rem]">
      <caption className="mb-1.5 text-left text-2xs text-salvia">Diferencia frente a {bLabel}</caption>
      <tbody>
        {Object.entries(d)
          .sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]))
          .map(([k, v]) => (
            <tr key={k} className="border-t border-line">
              <th scope="row" className="py-1.5 text-left font-normal text-salvia-2">
                {zonesFrom({ [k]: 0 })[0]?.label ?? k}
              </th>
              <td className={cx('py-1.5 text-right font-mono tabular', v > 0 ? 'text-lime' : v < 0 ? 'text-blue' : 'text-salvia')}>{ppLabel(v)}</td>
            </tr>
          ))}
      </tbody>
    </table>
  )
}

function ZoneDetail({
  zone,
  total,
  baseline,
  best,
  alt,
  cmp,
  advanced,
  onClose,
}: {
  zone: ReturnType<typeof zonesFrom>[number]
  total: number
  baseline: number
  best: boolean
  alt: boolean
  cmp: ComparisonOption | null
  advanced: boolean
  onClose: () => void
}) {
  const vs = zone.value - baseline
  const cv = cmp?.afinidad[zone.name]
  const Row = ({ k, v }: { k: ReactNode; v: ReactNode }) => (
    <div className="flex items-baseline justify-between gap-3 border-t border-line py-2 text-[0.8rem]">
      <dt className="text-salvia">{k}</dt>
      <dd className="font-mono text-blanco tabular">{v}</dd>
    </div>
  )
  return (
    <div className="animate-slide-in rounded-[var(--radius-btn)] border border-line-2 bg-noche-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="kicker">Zona seleccionada</p>
          <h3 className="mt-1 font-display text-lg font-bold text-blanco">{zone.label}</h3>
        </div>
        <IconButton label="Cerrar detalle de zona" onClick={onClose}>
          <IconX size={15} />
        </IconButton>
      </div>
      <p className="mt-3 font-mono text-[2rem] leading-none text-lime tabular">{fractionLabel(zone.value)}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {best && <Badge tone="lime">Mejor zona</Badge>}
        {alt && <Badge tone="neutral">Alternativa</Badge>}
        <Badge tone="muted">
          Puesto {zone.rank} de {total}
        </Badge>
      </div>
      <p className="mt-3 text-[0.8rem] leading-relaxed text-salvia-2">
        {vs >= 0
          ? `Recibe ${num(vs * 100, 1)} puntos más que un reparto uniforme entre las ${total} zonas.`
          : `Recibe ${num(-vs * 100, 1)} puntos menos que un reparto uniforme entre las ${total} zonas.`}
      </p>
      <dl className="mt-3">
        <Row k="Reparto uniforme" v={fractionLabel(baseline)} />
        {cv !== undefined && cmp && <Row k={cmp.label} v={`${fractionLabel(cv)} (${ppLabel(zone.value - cv)})`} />}
        {advanced && <Row k="Fracción devuelta por la API" v={num(zone.value, 4)} />}
        {advanced && <Row k="Nombre de zona (API)" v={zone.name} />}
      </dl>
    </div>
  )
}
