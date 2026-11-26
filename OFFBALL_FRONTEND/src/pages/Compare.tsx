/**
 * Comparador de 2–3 fichas guardadas. Escalas homogéneas en todos los
 * gráficos (0 € común, 0–100 % fijo en radar y mapas). N/D nunca es 0.
 */
import type { ReactNode } from 'react'
import type { Profile } from '../api/types'
import { AlertBadge } from '../components/analysis/Economic'
import { ProbabilityStrip } from '../components/charts/ProbabilityStrip'
import { ProfileRadar } from '../components/charts/ProfileRadar'
import { ValueChart } from '../components/charts/ValueChart'
import { IconColumns, IconPlus, IconX } from '../components/icons'
import { HeatLegend } from '../components/pitch/TacticalMap'
import { TacticalPitch } from '../components/pitch/TacticalPitch'
import { Badge, Button, EmptyState, Notice, PageHeader, Panel, SectionTitle, cx } from '../components/ui/primitives'
import { useToast } from '../components/ui/toast'
import { toComparable, type Comparable } from '../domain/compare'
import { competitionShort } from '../domain/competitions'
import { dateLabel, eurCompact, eurSigned, fractionLabel, ND, num, pctPoints } from '../domain/format'
import { positionLabel, subLabel } from '../domain/positions'
import { byCluster } from '../domain/profiles'
import { zoneDisplayName } from '../domain/zones'
import { RevealGroup, reveal } from '../motion/components'
import { Link } from '../router/router'
import { useMode, usePrefs } from '../state/prefs'
import { useCompare, useSaved } from '../state/saved'
import { MAX_COMPARE, type SavedItem } from '../state/storage'

type Row = { label: ReactNode; render: (c: Comparable) => ReactNode; value?: (c: Comparable) => number | null; advanced?: boolean }

const nd = <span className="text-salvia/70">{ND}</span>

const GROUPS: { title: string; rows: Row[]; advanced?: boolean }[] = [
  {
    title: 'Jugador',
    rows: [
      { label: 'Posición', render: (c) => `${positionLabel(c.position)} · ${subLabel(c.sub_position)}` },
      { label: 'Competición', render: (c) => competitionShort(c.competition_id) },
      { label: 'Edad', render: (c) => (c.edad === null ? nd : `${num(c.edad)}${c.edadEsHistorica ? ' (histórica)' : ''}`) },
      { label: 'Minutos', render: (c) => (c.minutos === null ? nd : num(c.minutos)), value: (c) => c.minutos },
      { label: 'Partidos', render: (c) => (c.partidos === null ? nd : num(c.partidos)), value: (c) => c.partidos, advanced: true },
      { label: 'Goles por 90', render: (c) => (c.goles90 === null ? nd : num(c.goles90, 2)), value: (c) => c.goles90 },
      { label: 'Asistencias por 90', render: (c) => (c.asistencias90 === null ? nd : num(c.asistencias90, 2)), value: (c) => c.asistencias90 },
    ],
  },
  {
    title: 'Valor de mercado',
    rows: [
      { label: 'Valor observado', render: (c) => (c.observado === null ? nd : <span className="text-gold">{eurCompact(c.observado)}</span>), value: (c) => c.observado },
      { label: 'Valor estimado (G02)', render: (c) => (c.estimado === null ? nd : <span className="text-lime">{eurCompact(c.estimado)}</span>), value: (c) => c.estimado },
      { label: 'Referencia G01', render: (c) => (c.referenciaG01 === null ? nd : <span className="text-blue">{eurCompact(c.referenciaG01)}</span>), advanced: true },
      { label: 'Diferencia', render: (c) => (c.diferenciaEur === null ? nd : `${eurSigned(c.diferenciaEur)} · ${pctPoints(c.diferenciaPct, 0)}`), value: (c) => c.diferenciaPct },
      { label: 'Señal P95', render: (c) => <AlertBadge result={{ alerta_economica: c.alerta }} size="sm" /> },
      { label: 'Exceso sobre P95', render: (c) => (c.excesoResiduo === null ? nd : num(c.excesoResiduo, 3)), value: (c) => c.excesoResiduo, advanced: true },
    ],
  },
  {
    title: 'Perfil ofensivo',
    rows: [
      {
        label: 'Perfil dominante',
        render: (c) =>
          c.perfilDominante ? (
            <span>
              <span className="text-lavender">{c.perfilDominante.nombre}</span> <span className="text-salvia">{fractionLabel(c.perfilDominante.prob)}</span>
            </span>
          ) : (
            nd
          ),
      },
      { label: 'Mejor zona', render: (c) => (c.mejorZona ? zoneDisplayName(c.mejorZona) : nd) },
      { label: 'Alternativa', render: (c) => (c.alternativa ? zoneDisplayName(c.alternativa) : nd), advanced: true },
    ],
  },
  {
    title: 'Procedencia',
    advanced: true,
    rows: [
      { label: 'Origen', render: (c) => <Badge tone={c.origen === 'manual' ? 'blue' : 'gold'}>{c.origen === 'manual' ? 'Análisis manual' : 'Catálogo histórico'}</Badge> },
      { label: 'Fecha de valoración', render: (c) => (c.fechaValoracion ? dateLabel(c.fechaValoracion) : nd) },
      { label: 'Cierre de temporada', render: (c) => (c.finTemporada ? dateLabel(c.finTemporada) : nd) },
      { label: 'Modelo', render: (c) => c.modelo ?? nd },
      { label: 'Corte del dataset', render: (c) => (c.corte ? dateLabel(c.corte) : nd) },
    ],
  },
]

export const COMPARE_COLORS = ['#b7e68f', '#83b9ce', '#e5c383']

const perfilesOf = (i: SavedItem): Profile[] | null => (i.origen === 'manual' && i.offensive ? i.offensive.perfiles : null)

export function ComparePage() {
  const saved = useSaved()
  const compare = useCompare()
  const toast = useToast()
  const { advanced } = useMode()
  const { prefs } = usePrefs()
  const selected = compare.ids.map((id) => saved.get(id)).filter((x): x is NonNullable<typeof x> => !!x)
  const cols = selected.map(toComparable)
  const candidates = saved.items.filter((i) => !compare.ids.includes(i.id))
  const mixed = new Set(cols.map((c) => c.origen)).size > 1
  const dates = new Set(cols.map((c) => c.fechaValoracion))

  const withProfiles = selected.map((i, k) => ({ i, k, p: perfilesOf(i) })).filter((x): x is { i: SavedItem; k: number; p: Profile[] } => !!x.p)
  const axes = withProfiles[0] ? byCluster(withProfiles[0].p).map((p) => p.perfil) : []

  return (
    <div>
      <PageHeader
        title="Comparador"
        description="Compara hasta tres fichas guardadas con los resultados ya calculados. Todos los gráficos usan la misma escala para cada jugador; lo que falta aparece como N/D, nunca como cero."
        actions={
          cols.length > 0 && (
            <Button variant="ghost" onClick={compare.clear}>
              Vaciar comparador
            </Button>
          )
        }
      />

      {saved.items.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<IconColumns size={20} />}
            title="No hay fichas guardadas"
            action={
              <>
                <Link to="/analizar" className="text-sm font-semibold text-lime underline underline-offset-4">
                  Analizar un jugador
                </Link>
                <Link to="/mercado" className="text-sm font-semibold text-salvia-2 underline underline-offset-4">
                  Explorar el mercado
                </Link>
              </>
            }
          >
            El comparador trabaja con fichas de seguimiento: guarda un análisis o una fila del mercado para poder compararla.
          </EmptyState>
        </Panel>
      ) : (
        <>
          {/* Selección */}
          <div className="mb-8 flex flex-wrap items-center gap-2">
            <span className="mr-1 font-mono text-[0.78rem] text-salvia tabular">
              {cols.length}/{MAX_COMPARE}
            </span>
            {cols.map((c, i) => (
              <span key={c.id} className="inline-flex h-9 animate-pop items-center gap-2 rounded-[var(--radius-btn)] border border-line-2 bg-panel-2 pr-1 pl-3 text-[0.84rem] font-medium text-blanco">
                <span className="size-2.5 rounded-[2px]" style={{ background: COMPARE_COLORS[i] }} />
                {c.nombre}
                <button type="button" onClick={() => compare.toggle(c.id)} className="rounded p-1.5 text-salvia hover:text-blanco" aria-label={`Quitar ${c.nombre}`}>
                  <IconX size={13} />
                </button>
              </span>
            ))}
            {cols.length < MAX_COMPARE &&
              candidates.slice(0, 8).map((i) => {
                const c = toComparable(i)
                return (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => {
                      const r = compare.toggle(i.id)
                      if (r.full) toast('Máximo 3 fichas.', 'warn')
                    }}
                    className="press inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-btn)] border border-dashed border-line-2 px-3 text-[0.8rem] text-salvia transition-colors hover:border-lime/60 hover:text-blanco"
                  >
                    <IconPlus size={13} /> {c.nombre}
                    <span className="text-2xs text-salvia/70">{c.origen === 'manual' ? 'manual' : 'catálogo'}</span>
                  </button>
                )
              })}
          </div>

          {cols.length < 2 ? (
            <Panel>
              <EmptyState icon={<IconColumns size={20} />} title="Elige al menos dos fichas">
                Añádelas desde los botones de arriba, desde Seguimiento o con «Comparar» en un análisis o en el mercado.
              </EmptyState>
            </Panel>
          ) : (
            <div className="space-y-10">
              {(mixed || dates.size > 1) && (
                <Notice tone="warn" title="Comparabilidad limitada">
                  {mixed && 'Se mezclan análisis manuales (datos aportados, sin verificar) con filas del catálogo histórico. '}
                  {dates.size > 1 && 'Las fechas de valoración son distintas: las estimaciones corresponden a momentos diferentes. '}
                  Las métricas sin dato equivalente se muestran como N/D.
                </Notice>
              )}

              <section>
                <SectionTitle title="Valor estimado" description="Misma escala lineal desde 0 € para todas las fichas." />
                <Panel className="p-5">
                  <ValueChart
                    caption="Estimación G02 de cada ficha. El valor observado y la diferencia se comparan en la tabla."
                    bars={cols.map((c, i) => ({ key: c.id, label: c.nombre, sublabel: c.origen === 'manual' ? 'manual' : 'catálogo', value: c.estimado, color: COMPARE_COLORS[i]! }))}
                  />
                </Panel>
              </section>

              <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
                <div className="min-w-0">
                  <SectionTitle title="Perfil deportivo" description="Probabilidad GMM superpuesta en escala fija 0–100 %." />
                  <Panel className="p-5">
                    {withProfiles.length >= 1 && axes.length >= 3 ? (
                      <>
                        <ProfileRadar
                          axes={axes}
                          series={withProfiles.map(({ i, k, p }) => ({
                            id: i.id,
                            label: toComparable(i).nombre,
                            color: COMPARE_COLORS[k]!,
                            values: Object.fromEntries(p.map((x) => [x.perfil, x.probabilidad])),
                          }))}
                        />
                        <div className="mt-3 space-y-3">
                          {withProfiles.map(({ i, k, p }) => (
                            <div key={i.id}>
                              <p className="mb-1 flex items-center gap-2 text-[0.78rem] text-salvia-2">
                                <span className="size-2 rounded-[2px]" style={{ background: COMPARE_COLORS[k] }} />
                                {toComparable(i).nombre}
                              </p>
                              <ProbabilityStrip perfiles={p} height="h-2" />
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="py-8 text-center text-sm text-salvia">Ninguna ficha seleccionada tiene perfil GMM (sólo análisis manuales de DC, SD, EI, ED o MCO).</p>
                    )}
                    {withProfiles.length > 0 && withProfiles.length < cols.length && (
                      <p className="mt-3 text-2xs text-salvia">{cols.length - withProfiles.length} ficha(s) sin perfil: no aparecen en el radar.</p>
                    )}
                  </Panel>
                </div>
                <div className="min-w-0">
                  <SectionTitle title="Mapas tácticos estimados" description="En paralelo y con la misma escala de color. No son eventos registrados." />
                  <Panel className="p-5">
                    <RevealGroup className={cx('grid gap-4', cols.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
                      {cols.map((c, i) => (
                        <figure key={c.id} {...reveal(i)} className="m-0 min-w-0">
                          <figcaption className="mb-1.5 flex items-center gap-2 truncate text-[0.78rem] font-semibold text-blanco">
                            <span className="size-2 shrink-0 rounded-[2px]" style={{ background: COMPARE_COLORS[i] }} />
                            <span className="truncate">{c.nombre}</span>
                          </figcaption>
                          {c.afinidad ? (
                            <TacticalPitch
                              values={c.afinidad}
                              mejor={c.mejorZona}
                              alternativa={advanced ? c.alternativa : null}
                              compact
                              gamma={prefs.pitch.gamma}
                              opacity={prefs.pitch.opacity}
                              render={prefs.pitch.render}
                              accent={COMPARE_COLORS[i]}
                              title={`Mapa táctico estimado de ${c.nombre}`}
                              className="border border-line"
                            />
                          ) : (
                            <div className="grid aspect-[74/59.5] place-items-center rounded-[8px] border border-dashed border-line-2 p-4 text-center text-[0.75rem] text-salvia">
                              {c.afinidadMotivo}
                            </div>
                          )}
                        </figure>
                      ))}
                    </RevealGroup>
                    <div className="mt-4 max-w-md">
                      <HeatLegend gamma={prefs.pitch.gamma} compact />
                    </div>
                  </Panel>
                </div>
              </section>

              <section>
                <SectionTitle title="Tabla comparativa" description="El punto lima marca el valor más alto de cada fila numérica." />
                <Panel className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-line">
                        <th scope="col" className="w-52 px-5 py-4 text-left text-[0.72rem] font-medium text-salvia">
                          Métrica
                        </th>
                        {cols.map((c, i) => (
                          <th key={c.id} scope="col" className="px-4 py-4 text-left align-top">
                            <span className="flex items-center gap-2">
                              <span className="size-2.5 rounded-[2px]" style={{ background: COMPARE_COLORS[i] }} />
                              <span className="font-display text-[0.95rem] font-extrabold text-blanco">{c.nombre}</span>
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    {GROUPS.filter((g) => advanced || !g.advanced).map((g) => (
                      <tbody key={g.title}>
                        <tr>
                          <th colSpan={cols.length + 1} scope="colgroup" className="bg-panel-2 px-5 py-2 text-left text-[0.76rem] font-semibold text-salvia-2">
                            {g.title}
                          </th>
                        </tr>
                        {g.rows
                          .filter((r) => advanced || !r.advanced)
                          .map((r, k) => {
                            const vals = r.value ? cols.map((c) => r.value!(c)) : []
                            const present = vals.filter((v): v is number => v !== null && Number.isFinite(v))
                            const max = present.length >= 2 ? Math.max(...present) : null
                            return (
                              <tr key={k} className="border-b border-line last:border-b-0">
                                <th scope="row" className="px-5 py-2.5 text-left text-[0.8rem] font-normal text-salvia">
                                  {r.label}
                                </th>
                                {cols.map((c, ci) => {
                                  const top = max !== null && vals[ci] === max && present.filter((v) => v === max).length === 1
                                  return (
                                    <td key={c.id} className={cx('px-4 py-2.5 align-top font-mono text-[0.8rem] text-blanco tabular', top && 'font-semibold')}>
                                      <span className="inline-flex items-center gap-1.5">
                                        {r.render(c)}
                                        {top && <span className="size-1.5 rounded-full bg-lime" aria-label="valor más alto" />}
                                      </span>
                                    </td>
                                  )
                                })}
                              </tr>
                            )
                          })}
                      </tbody>
                    ))}
                  </table>
                </Panel>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  )
}
