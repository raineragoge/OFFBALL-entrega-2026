/**
 * Bloques del perfil ofensivo: lectura del perfil GMM (radar + franja) y
 * mapa táctico estimado con comparaciones reales.
 */
import { useMemo, useState } from 'react'
import type { OffensiveResult } from '../../api/types'
import { buildAffinityRefs } from '../../domain/comparisons'
import { fractionLabel } from '../../domain/format'
import { byCluster, profileColor, profileGloss, profileSentence, readProfiles } from '../../domain/profiles'
import { useMode } from '../../state/prefs'
import { useSaved } from '../../state/saved'
import { ProbabilityStrip } from '../charts/ProbabilityStrip'
import { ProfileRadar, type RadarSeries } from '../charts/ProfileRadar'
import { EstimatedMapNotice, TacticalMap } from '../pitch/TacticalMap'
import { Badge, InfoTip, Meter, Select, cx } from '../ui/primitives'
import { Warnings } from './Economic'

export function ProfileBars({ r }: { r: OffensiveResult }) {
  const max = Math.max(...r.perfiles.map((p) => p.probabilidad))
  return (
    <ul className="space-y-3" aria-label="Probabilidad de pertenencia a cada perfil">
      {byCluster(r.perfiles).map((p) => {
        const top = p.probabilidad === max
        const gloss = profileGloss(p.perfil)
        return (
          <li key={p.cluster}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[0.8rem]">
              <span className={cx('flex min-w-0 items-center gap-2', top ? 'font-semibold text-blanco' : 'text-salvia-2')}>
                <span className="size-2 shrink-0 rounded-[2px]" style={{ background: profileColor(p.cluster) }} />
                <span className="font-mono text-2xs text-salvia">C{p.cluster}</span>
                <span className="truncate">{p.perfil}</span>
                {gloss && <InfoTip label={`Sobre ${p.perfil}`}>{gloss}</InfoTip>}
              </span>
              <span className="shrink-0 font-mono text-blanco tabular">{fractionLabel(p.probabilidad)}</span>
            </div>
            <Meter value={p.probabilidad} color={profileColor(p.cluster)} />
          </li>
        )
      })}
    </ul>
  )
}

/** Lectura del perfil: frase, franja y radar (con comparación opcional). */
export function ProfileReadingBlock({ r, playerLabel, excludeId }: { r: OffensiveResult; playerLabel: string; excludeId?: string | null }) {
  const { advanced } = useMode()
  const saved = useSaved()
  const reading = readProfiles(r.perfiles)
  const refs = useMemo(() => buildAffinityRefs(r, saved.items, excludeId).filter((x) => x.perfiles), [r, saved.items, excludeId])
  const [cmpId, setCmpId] = useState('')
  const cmp = refs.find((x) => x.id === cmpId)
  const axes = byCluster(r.perfiles).map((p) => p.perfil)
  const series: RadarSeries[] = [
    { id: 'self', label: playerLabel, color: '#c9a4d3', values: Object.fromEntries(r.perfiles.map((p) => [p.perfil, p.probabilidad])) },
    ...(cmp?.perfiles ? [{ id: cmp.id, label: cmp.label, color: '#83b9ce', values: cmp.perfiles }] : []),
  ]
  if (!reading) return null
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="size-3 rounded-[3px]" style={{ background: profileColor(reading.top.cluster) }} />
            <h3 className="font-display text-[1.35rem] font-bold text-blanco">{reading.top.perfil}</h3>
            {reading.mixed ? <Badge tone="gold">Perfil mixto</Badge> : <Badge tone="lavender">Perfil claro</Badge>}
          </div>
          <p className="mt-2 text-[0.88rem] leading-relaxed text-salvia-2">{profileSentence(reading)}</p>
          {profileGloss(reading.top.perfil) && <p className="mt-1 text-[0.8rem] text-salvia">{profileGloss(reading.top.perfil)}</p>}
        </div>
        <ProbabilityStrip perfiles={r.perfiles} height="h-3.5" showLegend />
        {reading.mixed && (
          <p className="rounded-[var(--radius-btn)] border border-line bg-noche-2 p-3 text-[0.8rem] leading-relaxed text-salvia-2">
            <span className="font-semibold text-blanco">¿Qué es un perfil mixto?</span> Ningún perfil supera el {Math.round(0.6 * 100)} % de probabilidad. El
            jugador comparte rasgos de varios grupos; conviene leer también el segundo perfil antes de etiquetarlo.
          </p>
        )}
        {advanced && (
          <div>
            <h4 className="mb-3 flex items-center gap-2 text-[0.84rem] font-semibold text-blanco">
              Pertenencia a los cinco clústeres GMM
              <InfoTip>Probabilidades a posteriori (predict_proba) del modelo de mezcla gaussiana con K=5 sobre goles/90, asistencias/90 y altura.</InfoTip>
            </h4>
            <ProfileBars r={r} />
            <p className="mt-3 text-2xs text-salvia">
              Margen entre los dos perfiles más probables: <span className="font-mono text-salvia-2 tabular">{fractionLabel(reading.margin)}</span>
            </p>
          </div>
        )}
      </div>
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[0.84rem] font-semibold text-blanco">Radar de perfil</p>
          {refs.length > 0 && (
            <div className="w-56">
              <Select aria-label="Comparar radar con" value={cmpId} onChange={(e) => setCmpId(e.target.value)} className="h-8 text-xs">
                <option value="">Sin comparación</option>
                {refs.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
        <ProfileRadar axes={axes} series={series} colorForAxis={(a) => profileColor(byCluster(r.perfiles).find((p) => p.perfil === a)?.cluster ?? 0)} />
        <div className="mt-1 flex flex-wrap gap-4 text-2xs text-salvia">
          {series.map((s) => (
            <span key={s.id} className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
          <span>Escala fija 0–100 % de probabilidad.</span>
        </div>
      </div>
    </div>
  )
}

/** Mapa táctico con comparaciones construidas a partir del seguimiento. */
export function PositionalMap({ r, playerLabel, footKnown, excludeId }: { r: OffensiveResult; playerLabel: string; footKnown?: boolean; excludeId?: string | null }) {
  const saved = useSaved()
  const refs = useMemo(() => buildAffinityRefs(r, saved.items, excludeId), [r, saved.items, excludeId])
  return (
    <div>
      <EstimatedMapNotice className="mb-4" />
      <TacticalMap afinidad={r.afinidad} mejor={r.mejor_zona} alternativa={r.alternativa} playerLabel={playerLabel} comparisons={refs} footKnown={footKnown} />
      {r.advertencias.length > 0 && (
        <div className="mt-5">
          <Warnings items={r.advertencias} />
        </div>
      )}
    </div>
  )
}
