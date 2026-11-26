/**
 * Campo táctico interactivo (SVG + canvas).
 * Visualiza EXCLUSIVAMENTE el reparto de afinidad por zona devuelto por la API
 * (ver domain/pitch.ts). Sin eventos, sin coordenadas inventadas.
 *
 * Interacción: hover/foco → tooltip; clic/Enter → selección; Ctrl/⌘ + rueda,
 * doble clic o botones → zoom; arrastrar → desplazar (con zoom > 1).
 */
import { useEffect, useId, useMemo, useRef, useState, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent } from 'react'
import {
  clampView,
  divergingColor,
  divergingRGB,
  heatColor,
  inkFor,
  PITCH,
  PITCH_VIEWBOX,
  rampRGB,
  rasterizeField,
  shape,
  slotValues,
  VIEW_IDENTITY,
  ZONE_RECT,
  zonesFrom,
  zoomAt,
  type View,
} from '../../domain/pitch'
import { fractionLabel, num } from '../../domain/format'
import type { ZoneSlot } from '../../domain/zones'
import { useReducedMotion, useTweenedRecord } from '../../motion/hooks'
import type { PitchRender } from '../../state/prefs'
import { cx } from '../ui/cx'
import { PitchMarkings, PitchTurf } from './PitchMarkings'

export interface PitchLayers {
  lines: boolean
  labels: boolean
  values: boolean
  markers: boolean
}

export interface TacticalPitchProps {
  /** afinidad de la API: zona → fracción 0–1. */
  values: Record<string, number>
  /** Reparto de comparación (otro jugador, grupo o uniforme). */
  compare?: Record<string, number> | null
  compareLabel?: string
  /** 'diff' pinta A − B con rampa divergente. */
  display?: 'single' | 'diff'
  mejor?: string | null
  alternativa?: string | null
  render?: PitchRender
  gamma?: number
  opacity?: number
  layers?: PitchLayers
  selected?: string | null
  onSelect?: (zone: string | null) => void
  view?: View
  onViewChange?: (v: View) => void
  /** Desactiva zoom/arrastre (miniaturas). */
  compact?: boolean
  title: string
  className?: string
  accent?: string
}

const VB = PITCH_VIEWBOX
const FIELD_BOX = {
  left: ((0 - VB.x) / VB.w) * 100,
  top: ((0 - VB.y) / VB.h) * 100,
  width: (PITCH.width / VB.w) * 100,
  height: (PITCH.depth / VB.h) * 100,
}

const ALL_LAYERS: PitchLayers = { lines: true, labels: true, values: true, markers: true }
const SHORT: Record<ZoneSlot, string> = { DC: 'DC', EI: 'EI', ED: 'ED', MCO: 'MCO' }

const ppLabel = (d: number) => `${d > 0 ? '+' : d < 0 ? '−' : '±'}${num(Math.abs(d) * 100, 1)} pp`

export function TacticalPitch({
  values,
  compare = null,
  compareLabel,
  display = 'single',
  mejor,
  alternativa,
  render = 'zonas',
  gamma = 0.5,
  opacity = 0.9,
  layers = ALL_LAYERS,
  selected = null,
  onSelect,
  view = VIEW_IDENTITY,
  onViewChange,
  compact = false,
  title,
  className,
  accent = '#b7e68f',
}: TacticalPitchProps) {
  const uid = useId().replace(/:/g, '')
  const reduced = useReducedMotion()
  const shown = useTweenedRecord(values)
  const shownCmp = useTweenedRecord(compare ?? {})
  const diff = display === 'diff' && !!compare

  const zones = useMemo(() => zonesFrom(values), [values])
  const placed = zones.filter((z): z is typeof z & { slot: ZoneSlot } => z.slot !== null)

  /** Valor que se pinta en cada zona (afinidad o diferencia), interpolado. */
  const paint = (name: string) => {
    const a = shown[name] ?? 0
    return diff ? a - (shownCmp[name] ?? 0) : a
  }

  // ---------- capa continua (canvas) ----------
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const paintKey = JSON.stringify([shown, diff ? shownCmp : null, gamma, opacity, render])
  useEffect(() => {
    if (render !== 'continuo') return
    const cv = canvasRef.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    const byName: Record<string, number> = {}
    for (const z of placed) byName[z.name] = paint(z.name)
    const buf = rasterizeField(slotValues(byName), { ppm: 3, gamma, opacity, diverging: diff })
    if (cv.width !== buf.width) cv.width = buf.width
    if (cv.height !== buf.height) cv.height = buf.height
    ctx.putImageData(new ImageData(buf.data, buf.width, buf.height), 0, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paintKey])

  // ---------- tooltip ----------
  const outer = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{ name: string; x: number; y: number } | null>(null)
  const [tipVisible, setTipVisible] = useState(false)
  const lastTip = useRef<{ name: string; x: number; y: number } | null>(null)
  if (hover) lastTip.current = hover
  useEffect(() => setTipVisible(!!hover), [hover])

  const pointFromEvent = (e: { clientX: number; clientY: number }) => {
    const r = outer.current?.getBoundingClientRect()
    if (!r) return { x: 0, y: 0, fx: 0, fy: 0 }
    return { x: e.clientX - r.left, y: e.clientY - r.top, fx: (e.clientX - r.left) / r.width - 0.5, fy: (e.clientY - r.top) / r.height - 0.5 }
  }

  /** Centro de una zona en píxeles del contenedor (para el foco por teclado). */
  const zoneCenterPx = (slot: ZoneSlot) => {
    const r = outer.current?.getBoundingClientRect()
    const z = ZONE_RECT[slot]
    if (!r) return { x: 0, y: 0 }
    const fx = (z.x + z.w / 2 - VB.x) / VB.w - 0.5
    const fy = (z.y + z.h / 3 - VB.y) / VB.h - 0.5
    return { x: ((fx * view.k + view.x) + 0.5) * r.width, y: ((fy * view.k + view.y) + 0.5) * r.height }
  }

  // ---------- zoom y desplazamiento ----------
  const interactive = !compact && !!onViewChange
  const drag = useRef<{ id: number; sx: number; sy: number; v: View; moved: boolean } | null>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const el = outer.current
    if (!el || !interactive) return
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      const p = pointFromEvent(e)
      onViewChange!(zoomAt(view, e.deltaY < 0 ? 1.15 : 1 / 1.15, p.fx, p.fy))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, view, onViewChange])

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (!interactive || view.k <= 1 || e.button !== 0) return
    drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, v: view, moved: false }
  }
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const r = outer.current!.getBoundingClientRect()
    const dx = (e.clientX - d.sx) / r.width
    const dy = (e.clientY - d.sy) / r.height
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 4) {
      d.moved = true
      setDragging(true)
      setHover(null)
      outer.current!.setPointerCapture(e.pointerId)
    }
    if (d.moved) onViewChange!(clampView({ k: d.v.k, x: d.v.x + dx, y: d.v.y + dy }))
  }
  const endDrag = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    if (d.moved) {
      // Evita que el clic que termina el arrastre seleccione una zona.
      const stop = (ev: MouseEvent) => {
        ev.stopPropagation()
        ev.preventDefault()
      }
      window.addEventListener('click', stop, { capture: true, once: true })
      window.setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 0)
    }
    drag.current = null
    setDragging(false)
  }

  const onDoubleClick = (e: RMouseEvent) => {
    if (!interactive) return
    const p = pointFromEvent(e)
    onViewChange!(view.k >= 3.9 ? VIEW_IDENTITY : zoomAt(view, 1.6, p.fx, p.fy))
  }

  // ---------- render ----------
  const tip = lastTip.current
  const tipZone = tip ? zones.find((z) => z.name === tip.name) : null
  const baseline = zones.length ? 1 / zones.length : 0
  const hasSel = !!selected

  return (
    <div
      ref={outer}
      className={cx('relative isolate overflow-hidden rounded-[8px] bg-[#0c1813] select-none', interactive && view.k > 1 && (dragging ? 'cursor-grabbing' : 'cursor-grab'), className)}
      style={{ aspectRatio: `${VB.w} / ${VB.h}`, touchAction: interactive && view.k > 1 ? 'none' : 'pan-y' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={onDoubleClick}
      onMouseLeave={() => setHover(null)}
    >
      <div
        className={cx('absolute inset-0 origin-center will-change-transform', !dragging && !reduced && 'transition-transform duration-[var(--dur-3)] ease-[var(--ease-out-soft)]')}
        style={{ transform: `translate(${view.x * 100}%, ${view.y * 100}%) scale(${view.k})` }}
      >
        {/* Capa SVG inferior: césped */}
        <svg viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
          <PitchTurf id={`${uid}-turf`} />
        </svg>

        {/* Capa continua */}
        {render === 'continuo' && (
          <canvas
            ref={canvasRef}
            className="absolute animate-fade"
            style={{ left: `${FIELD_BOX.left}%`, top: `${FIELD_BOX.top}%`, width: `${FIELD_BOX.width}%`, height: `${FIELD_BOX.height}%` }}
            aria-hidden="true"
          />
        )}

        {/* Capa SVG superior: zonas, líneas, rótulos, interacción */}
        <svg viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} className="absolute inset-0 h-full w-full" role="img" aria-labelledby={`${uid}-t ${uid}-d`}>
          <title id={`${uid}-t`}>{title}</title>
          <desc id={`${uid}-d`}>
            Representación táctica estimada a partir de la afinidad estadística por zona. {zones.map((z) => `${z.label}: ${fractionLabel(z.value)}`).join('; ')}.
            {mejor ? ` Mejor zona ${mejor}.` : ''}
            {alternativa ? ` Alternativa ${alternativa}.` : ''}
          </desc>

          {render === 'zonas' &&
            placed.map((z, i) => {
              const r = ZONE_RECT[z.slot]
              const v = paint(z.name)
              const fill = diff ? divergingColor(v, gamma) : heatColor(v, gamma)
              const dim = hasSel && selected !== z.name
              return (
                <g key={z.name} className={reduced ? undefined : 'animate-pop'} style={{ animationDelay: `${i * 70}ms` }}>
                  <rect
                    x={r.x + 0.5}
                    y={r.y + 0.5}
                    width={r.w - 1}
                    height={r.h - 1}
                    rx={1.6}
                    fill={fill}
                    fillOpacity={opacity * (dim ? 0.45 : 1)}
                    style={{ transition: 'fill-opacity var(--dur-2) var(--ease-out-soft)' }}
                  />
                </g>
              )
            })}

          {layers.lines && <PitchMarkings stroke={render === 'continuo' ? 'rgba(252,252,250,0.42)' : 'rgba(252,252,250,0.28)'} />}

          {/* Marcadores mejor zona / alternativa */}
          {layers.markers &&
            placed
              .filter((z) => z.name === mejor || z.name === alternativa)
              .map((z) => {
                const r = ZONE_RECT[z.slot]
                const best = z.name === mejor
                return (
                  <rect
                    key={`m-${z.name}`}
                    x={r.x + 0.5}
                    y={r.y + 0.5}
                    width={r.w - 1}
                    height={r.h - 1}
                    rx={1.6}
                    fill="none"
                    stroke={best ? accent : '#a8b9b2'}
                    strokeWidth={best ? 2 : 1.5}
                    strokeDasharray={best ? undefined : '5 4'}
                    vectorEffect="non-scaling-stroke"
                  />
                )
              })}

          {/* Selección */}
          {placed
            .filter((z) => z.name === selected)
            .map((z) => {
              const r = ZONE_RECT[z.slot]
              return (
                <g key={`s-${z.name}`}>
                  <rect x={r.x + 0.5} y={r.y + 0.5} width={r.w - 1} height={r.h - 1} rx={1.6} fill="none" stroke="#fcfcfa" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                  {!reduced && (
                    <rect className="zone-pulse" x={r.x + 0.5} y={r.y + 0.5} width={r.w - 1} height={r.h - 1} rx={1.6} fill="none" stroke="#fcfcfa" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                  )}
                </g>
              )
            })}

          {/* Rótulos */}
          {(layers.labels || layers.values) &&
            placed.map((z) => {
              const r = ZONE_RECT[z.slot]
              const v = paint(z.name)
              const c = diff ? divergingRGB(v, gamma) : rampRGB(shape(v, gamma))
              const onFill = render === 'zonas' && opacity > 0.6
              const ink = onFill ? inkFor(c) : '#fcfcfa'
              const cx_ = r.x + r.w / 2
              const cy_ = r.y + r.h / 2
              const dim = hasSel && selected !== z.name
              const label = diff ? ppLabel(v) : fractionLabel(v, compact ? 0 : 1)
              return (
                <g key={`l-${z.name}`} opacity={dim ? 0.55 : 1} style={{ transition: 'opacity var(--dur-2)' }} pointerEvents="none">
                  {!onFill && (
                    <rect x={cx_ - 8} y={cy_ - (layers.labels && layers.values ? 4.4 : 2.6)} width={16} height={layers.labels && layers.values ? 8.6 : 5.2} rx={1} fill="#0d1915" fillOpacity={0.78} />
                  )}
                  {layers.labels && (
                    <text x={cx_} y={layers.values ? cy_ - 1.2 : cy_ + 0.7} textAnchor="middle" fontSize={compact ? 2.6 : 2} fontWeight={600} fill={ink} fillOpacity={0.85} fontFamily="var(--font-sans)">
                      {SHORT[z.slot]}
                    </text>
                  )}
                  {layers.values && (
                    <text
                      x={cx_}
                      y={layers.labels ? cy_ + 2.9 : cy_ + 1.3}
                      textAnchor="middle"
                      fontSize={compact ? 3.6 : diff ? 2.7 : 3.4}
                      fontWeight={600}
                      fill={ink}
                      fontFamily="var(--font-mono)"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {label}
                    </text>
                  )}
                </g>
              )
            })}

          {/* Áreas de interacción (también en modo continuo) */}
          {placed.map((z) => {
            const r = ZONE_RECT[z.slot]
            const isSel = selected === z.name
            return (
              <rect
                key={`h-${z.name}`}
                x={r.x}
                y={r.y}
                width={r.w}
                height={r.h}
                fill="transparent"
                tabIndex={onSelect ? 0 : -1}
                role={onSelect ? 'button' : undefined}
                aria-pressed={onSelect ? isSel : undefined}
                aria-label={`${z.label}: ${fractionLabel(z.value)} de afinidad${compare && compare[z.name] !== undefined ? `, ${compareLabel ?? 'comparación'} ${fractionLabel(compare[z.name])}` : ''}`}
                className={cx(onSelect && 'cursor-pointer', 'outline-none focus-visible:stroke-lime')}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
                onMouseMove={(e) => {
                  if (dragging) return
                  const p = pointFromEvent(e)
                  setHover({ name: z.name, x: p.x, y: p.y })
                }}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover({ name: z.name, ...zoneCenterPx(z.slot) })}
                onBlur={() => setHover(null)}
                onClick={() => onSelect?.(isSel ? null : z.name)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect?.(isSel ? null : z.name)
                  } else if (e.key === 'Escape') onSelect?.(null)
                }}
              />
            )
          })}

          {/* Dirección de ataque */}
          {!compact && (
            <g transform={`translate(${PITCH.width + 1.6} ${PITCH.depth * 0.62})`} fill="#7d948c" aria-hidden="true">
              <path d="M0 -4.2 L-0.9 -2.6 L0.9 -2.6 Z" />
              <rect x={-0.15} y={-2.6} width={0.3} height={7} />
            </g>
          )}
        </svg>
      </div>

      {/* Tooltip */}
      {tip && tipZone && (
        <div
          role="status"
          className={cx(
            'pointer-events-none absolute z-10 w-56 rounded-[var(--radius-btn)] border border-line-2 bg-panel-3/95 px-3 py-2.5 text-[0.76rem] shadow-[0_12px_32px_-16px_rgba(0,0,0,0.8)] transition-[opacity,transform] duration-[var(--dur-1)] ease-[var(--ease-out-soft)]',
            tipVisible ? 'opacity-100' : 'opacity-0',
          )}
          style={{
            left: Math.min(Math.max(tip.x, 116), (outer.current?.clientWidth ?? 0) - 116),
            top: tip.y,
            // Se coloca debajo del cursor si no cabe encima (borde superior del campo).
            transform:
              tip.y > 150
                ? `translate(-50%, calc(-100% - 14px)) translateY(${tipVisible ? 0 : 4}px)`
                : `translate(-50%, 18px) translateY(${tipVisible ? 0 : -4}px)`,
          }}
        >
          <p className="flex items-center justify-between gap-2 font-semibold text-blanco">
            <span className="truncate">{tipZone.label}</span>
            <span className="font-mono text-2xs text-salvia">#{tipZone.rank} de {zones.length}</span>
          </p>
          <p className="mt-1 font-mono text-[0.95rem] text-lime tabular">{fractionLabel(tipZone.value)}</p>
          <p className="mt-0.5 text-salvia-2 tabular">
            {ppLabel(tipZone.value - baseline)} frente a reparto uniforme ({fractionLabel(baseline, 0)})
          </p>
          {compare && compare[tipZone.name] !== undefined && (
            <p className="mt-1 border-t border-line pt-1 text-salvia-2 tabular">
              {compareLabel ?? 'Comparación'}: {fractionLabel(compare[tipZone.name])} · <span className="text-blanco">{ppLabel(tipZone.value - compare[tipZone.name]!)}</span>
            </p>
          )}
          {onSelect && <p className="mt-1 text-2xs text-salvia">Clic para ver el detalle</p>}
        </div>
      )}
    </div>
  )
}
