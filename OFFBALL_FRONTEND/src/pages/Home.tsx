/**
 * Centro de scouting. Responde: qué jugadores destacan, qué perfiles hay,
 * qué oportunidades se detectan, cómo se relacionan rendimiento y valor, y
 * qué dice el modelo. Todo procede de la API o del seguimiento local.
 */
import { useMemo, useState, type ReactNode } from 'react'
import type { OpportunityQuery, OpportunityRow, TestMetricRow } from '../api/types'
import { ValueScatter } from '../components/charts/ValueScatter'
import { IconArrowRight, IconColumns, IconPlay, IconTarget } from '../components/icons'
import { connectionText, ConnectionDot } from '../components/layout/Shell'
import { OpportunityRanking, rankRows } from '../components/market/OpportunityRanking'
import { RowDetail } from '../components/market/RowDetail'
import { Badge, ErrorState, Meter, Skeleton, buttonClass, cx } from '../components/ui/primitives'
import { offensiveItems } from '../domain/comparisons'
import { dateLabel, eurCompact, fractionLabel, ND, num, pctPoints } from '../domain/format'
import { catalogIdentity } from '../domain/market'
import { selectedMetrics } from '../domain/metrics'
import { subShort } from '../domain/positions'
import { profileColor, profileGloss, readProfiles } from '../domain/profiles'
import { AnimatedNumber, RevealGroup, reveal } from '../motion/components'
import { Link } from '../router/router'
import { useApiStatus } from '../state/api-status'
import { useMode } from '../state/prefs'
import { useCompare, useSaved } from '../state/saved'
import { useCatalogActions } from '../state/useCatalogActions'
import { useOpportunities } from '../state/useOpportunities'

/** Muestra amplia del catálogo (alertas históricas incluidas, sin filtro de presupuesto). */
const SAMPLE_QUERY: OpportunityQuery = {
  presupuesto: 1e10,
  edad_max: 45,
  minutos_min: 450,
  position: null,
  competition_id: null,
  incluir_no_vigentes: true,
  limit: 100,
  offset: 0,
}
const VIGENTES_QUERY: OpportunityQuery = { ...SAMPLE_QUERY, incluir_no_vigentes: false, limit: 1 }


function Kpi({ label, value, sub, loading, tone = 'text-blanco', i }: { label: ReactNode; value: ReactNode; sub?: ReactNode; loading?: boolean; tone?: string; i: number }) {
  return (
    <div {...reveal(i)} className="min-w-0 px-5 py-4">
      <p className="text-[0.76rem] font-medium text-salvia">{label}</p>
      <div className={cx('mt-1.5 font-mono text-[1.65rem] leading-none tracking-[-0.02em]', tone)}>{loading ? <Skeleton className="h-7 w-20" /> : value}</div>
      {sub && <p className="mt-1.5 truncate text-2xs text-salvia">{sub}</p>}
    </div>
  )
}

export function HomePage() {
  const api = useApiStatus()
  const { advanced } = useMode()
  const { items } = useSaved()
  const compare = useCompare()
  const sample = useOpportunities(SAMPLE_QUERY)
  const vigentes = useOpportunities(VIGENTES_QUERY)
  const actions = useCatalogActions(sample.data)
  const [detail, setDetail] = useState<OpportunityRow | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const md = api.metadata.state === 'ok' ? api.metadata.data : null
  const h = api.health.state === 'ok' ? api.health.data : null
  const metrics = selectedMetrics(md?.metricas_test, md?.configuracion.modelos?.general)
  const rows = sample.data?.resultados ?? []
  const ranked = useMemo(() => rankRows(rows).slice(0, 8), [rows])
  const selectedId = detail && detailOpen ? catalogIdentity(detail) : null

  const open = (r: OpportunityRow) => {
    setDetail(r)
    setDetailOpen(true)
  }

  // Perfiles de tus análisis guardados (resultados reales de la API).
  const offensive = offensiveItems(items)
  const profileNames = md?.perfiles ?? []
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of offensive) {
      const t = readProfiles(i.offensive.perfiles)?.top.perfil
      if (t) m.set(t, (m.get(t) ?? 0) + 1)
    }
    return m
  }, [offensive])
  const maxCount = Math.max(1, ...counts.values())
  const recent = items.filter((i) => i.origen === 'manual').slice(0, 4)

  const loadingMd = api.metadata.state === 'loading'

  return (
    <div className="space-y-10">
      {/* Cabecera */}
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-2xl">
          <h1 className="font-display text-[1.9rem] leading-[1.05] font-extrabold tracking-[-0.015em] text-blanco sm:text-[2.5rem]">Centro de scouting</h1>
          <p className="mt-3 text-[0.94rem] leading-relaxed text-salvia-2">
            Qué jugadores destacan frente a su valor de mercado, qué perfiles existen y cuánto se puede confiar en el modelo.
          </p>
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.78rem] text-salvia">
            <span className="flex items-center gap-2">
              <ConnectionDot /> {connectionText(api.connection)}
            </span>
            <span>
              Datos hasta el <span className="text-salvia-2 tabular">{api.corte ? dateLabel(api.corte) : ND}</span>
            </span>
            {advanced && h && <span className="font-mono">{h.regresion}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/analizar" className={buttonClass('primary', 'md')}>
            <IconTarget size={16} /> Analizar jugador
          </Link>
          <Link to="/analizar?ejemplo=1" className={buttonClass('secondary', 'md')}>
            <IconPlay size={14} /> Ver un ejemplo
          </Link>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-3">{[
        ['/tactica','01 / TÁCTICA','Construye tu ataque','Mapas de calor y pizarra de candidatos'],
        ['/database','02 / DATOS','Descubre nuevas oportunidades','Importación masiva y alertas'],
        ['/analizar','03 / INFORME','Explora el perfil','Estadísticas por pantallas'],
      ].map(([to,k,title,desc])=><Link key={to} to={to!} className="ob-deck-panel ob-shortcut p-5"><p className="ob-kicker">◆ {k}</p><h2 className="mt-3 text-xl font-display font-bold">{title} ↗</h2><p className="mt-2 text-salvia-2 text-sm">{desc}</p></Link>)}</section>
      {/* Indicadores */}
      <RevealGroup className="grid grid-cols-2 divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-panel sm:grid-cols-3 lg:grid-cols-5 [&>*]:border-line max-lg:[&>*:nth-child(n+3)]:border-t sm:[&>*:not(:first-child)]:border-l">
        <Kpi
          i={0}
          label="Alertas en el catálogo"
          loading={sample.status === 'loading' && !sample.data}
          value={<AnimatedNumber value={sample.data?.total ?? null} format={(v) => num(v)} />}
          sub="Posibles infravaloraciones históricas"
        />
        <Kpi
          i={1}
          label="Vigentes en el corte"
          loading={vigentes.status === 'loading' && !vigentes.data}
          value={<AnimatedNumber value={vigentes.data?.total ?? null} format={(v) => num(v)} />}
          tone={vigentes.data?.total ? 'text-lime' : 'text-blanco'}
          sub={vigentes.data?.total === 0 ? 'Ninguna vigente: ver históricas' : 'Temporada más reciente del dataset'}
        />
        <Kpi i={2} label="Perfiles ofensivos" loading={api.connection === 'checking'} value={h ? num(h.gmm_componentes) : ND} sub="Modelo GMM" tone="text-lavender" />
        <Kpi
          i={3}
          label={advanced ? 'R² en test (G02)' : 'Error medio del modelo'}
          loading={loadingMd}
          value={advanced ? (typeof metrics?.R2 === 'number' ? num(metrics.R2, 3) : ND) : typeof metrics?.MAE_EUR === 'number' ? eurCompact(metrics.MAE_EUR) : ND}
          sub={advanced ? (typeof metrics?.MAE_EUR === 'number' ? `MAE ${eurCompact(metrics.MAE_EUR)}` : undefined) : 'Error absoluto medio en test (G02)'}
        />
        <Kpi i={4} label="En seguimiento" value={<AnimatedNumber value={items.length} format={(v) => num(v)} />} sub={`${compare.ids.length}/3 en el comparador`} />
      </RevealGroup>

      {/* Mercado: dispersión + ranking */}
      <section aria-labelledby="h-mercado" className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,1fr)]">
        <div className="min-w-0 rounded-[var(--radius-card)] border border-line bg-panel p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="h-mercado" className="font-display text-[1.15rem] font-bold text-blanco">
                Valor observado frente a estimado
              </h2>
              <p className="mt-1 max-w-[62ch] text-[0.8rem] leading-relaxed text-salvia-2">
                Cada punto es una alerta del catálogo. Cuanto más por encima de la diagonal, más valor estima el modelo respecto al mercado.
              </p>
            </div>
            <Badge tone="muted">Muestra: {rows.length} filas</Badge>
          </div>
          {sample.status === 'error' && sample.error && <ErrorState error={sample.error} onRetry={sample.reload} />}
          {sample.status === 'loading' && !sample.data && <Skeleton className="aspect-[680/400] w-full" />}
          {sample.data && rows.length > 0 && (
            <ValueScatter
              points={rows.map((r) => ({
                id: catalogIdentity(r),
                x: r.market_value_in_eur,
                y: r.valor_estimado,
                category: r.vigente_en_corte ? 'vig' : 'hist',
                label: r.name ?? 'Sin nombre',
                detail: (
                  <>
                    {subShort(r.sub_position)} · {num(r.age)} años · <span className="text-lime">{pctPoints(r.diferencia_pct, 0)}</span>
                  </>
                ),
              }))}
              categories={[
                { id: 'vig', label: 'Vigente en el corte', color: '#b7e68f' },
                { id: 'hist', label: 'Histórico', color: '#e5c383' },
              ]}
              guides={advanced}
              selectedId={selectedId}
              onSelect={(id) => {
                const r = rows.find((x) => catalogIdentity(x) === id)
                if (r) open(r)
              }}
              caption={advanced ? 'Primeras 100 filas devueltas por el servidor (incluye históricos).' : undefined}
            />
          )}
          {sample.data && rows.length === 0 && <p className="py-10 text-center text-sm text-salvia">El catálogo no devolvió filas.</p>}
        </div>

        <div className="min-w-0 rounded-[var(--radius-card)] border border-line bg-panel">
          <div className="flex items-end justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h2 className="font-display text-[1.15rem] font-bold text-blanco">Oportunidades destacadas</h2>
              <p className="mt-1 text-[0.78rem] text-salvia-2">Mayor exceso sobre el umbral P95 en la muestra.</p>
            </div>
            <Link to="/mercado" className="flex shrink-0 items-center gap-1 text-[0.8rem] font-semibold text-lime hover:underline">
              Mercado <IconArrowRight size={14} />
            </Link>
          </div>
          <div className="px-4 py-1">
            {sample.status === 'loading' && !sample.data && (
              <div className="space-y-3 py-3">
                {Array.from({ length: 6 }, (_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            )}
            {ranked.length > 0 && <OpportunityRanking rows={ranked} onOpen={open} selectedId={selectedId} advanced={advanced} dense />}
          </div>
          <p className="border-t border-line px-5 py-3 text-2xs leading-snug text-salvia">
            Una alerta es una señal para revisar, no una recomendación de fichaje: el catálogo es histórico y no acredita disponibilidad.
          </p>
        </div>
      </section>

      {/* Perfiles · Modelo · Tu trabajo */}
      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-[var(--radius-card)] border border-line bg-panel p-5 lg:col-span-1">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-[1.05rem] font-bold text-blanco">Perfiles deportivos</h2>
            <Link to="/perfiles" className="text-[0.78rem] font-semibold text-lime hover:underline">
              Explorar
            </Link>
          </div>
          {profileNames.length === 0 ? (
            loadingMd ? (
              <Skeleton className="h-40" />
            ) : (
              <p className="text-sm text-salvia">Perfiles no disponibles sin metadata.</p>
            )
          ) : (
            <ul className="space-y-3">
              {profileNames.map((p, i) => {
                const n = counts.get(p) ?? 0
                return (
                  <li key={p}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-[0.82rem]">
                      <span className="flex min-w-0 items-center gap-2 text-blanco">
                        <span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: profileColor(i) }} />
                        <span className="truncate">{p}</span>
                      </span>
                      <span className="shrink-0 font-mono text-2xs text-salvia tabular">{n} tuyos</span>
                    </div>
                    <Meter value={n / maxCount} color={profileColor(i)} className="h-1" />
                    {!advanced && profileGloss(p) && <p className="mt-1 text-2xs text-salvia">{profileGloss(p)}</p>}
                  </li>
                )
              })}
            </ul>
          )}
          <p className="mt-4 text-2xs leading-snug text-salvia">
            Recuento de tus análisis guardados por perfil dominante ({offensive.length} con perfil). La API no publica cuántos jugadores del dataset hay en cada perfil.
          </p>
        </div>

        <div className="rounded-[var(--radius-card)] border border-line bg-panel p-5">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-[1.05rem] font-bold text-blanco">El modelo en cifras</h2>
            <Link to={advanced ? '/rendimiento' : '/metodologia'} className="text-[0.78rem] font-semibold text-lime hover:underline">
              {advanced ? 'Rendimiento' : 'Cómo funciona'}
            </Link>
          </div>
          {loadingMd ? (
            <Skeleton className="h-40" />
          ) : md ? (
            <ModelSummary rows={md.metricas_test} general={md.configuracion.modelos?.general} nTest={md.configuracion.n_test} advanced={advanced} />
          ) : (
            <p className="text-sm text-salvia">Métricas no disponibles: la API no respondió a /metadata.</p>
          )}
        </div>

        <div className="rounded-[var(--radius-card)] border border-line bg-panel p-5">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-[1.05rem] font-bold text-blanco">Tu trabajo</h2>
            <Link to="/seguimiento" className="text-[0.78rem] font-semibold text-lime hover:underline">
              Seguimiento
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="py-4">
              <p className="text-[0.86rem] leading-relaxed text-salvia-2">Aún no has guardado análisis. Analiza un jugador y guárdalo para compararlo y recuperarlo aquí.</p>
              <Link to="/analizar?ejemplo=1" className="mt-4 inline-block text-[0.84rem] font-semibold text-lime underline decoration-lime/40 underline-offset-4">
                Empezar con el ejemplo ficticio
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((i) =>
                i.origen === 'manual' ? (
                  <li key={i.id}>
                    <Link to={`/analizar?id=${encodeURIComponent(i.id)}`} className="group flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block truncate text-[0.86rem] font-medium text-blanco group-hover:text-lime">{i.nombre || 'Análisis sin nombre'}</span>
                        <span className="block text-2xs text-salvia">
                          {subShort(i.form.sub_position)} · {i.economic ? eurCompact(i.economic.valor_estimado_eur) : 'sin valoración'}
                          {i.offensive && ` · ${readProfiles(i.offensive.perfiles)?.top.perfil ?? ''}`}
                        </span>
                      </span>
                      <IconArrowRight size={14} className="shrink-0 text-salvia transition-transform group-hover:translate-x-0.5 group-hover:text-blanco" />
                    </Link>
                  </li>
                ) : null,
              )}
            </ul>
          )}
          {compare.ids.length >= 2 && (
            <Link to="/comparador" className={buttonClass('secondary', 'sm', 'mt-4 w-full')}>
              <IconColumns size={14} /> Abrir comparador ({compare.ids.length})
            </Link>
          )}
        </div>
      </section>

      {detail && sample.data && (
        <RowDetail
          row={detail}
          open={detailOpen}
          corte={sample.data.corte_datos}
          modelo={sample.data.modelo}
          onClose={() => setDetailOpen(false)}
          onSave={() => actions.saveRow(detail)}
          onCompare={() => actions.compareRow(detail)}
          saved={actions.isSaved(detail)}
          inCompare={actions.inCompare(detail)}
        />
      )}
    </div>
  )
}

function ModelSummary({ rows, general, nTest, advanced }: { rows: TestMetricRow[]; general?: string; nTest?: number; advanced: boolean }) {
  const sel = selectedMetrics(rows, general)
  const others = rows.filter((r) => r !== sel)
  const maxMae = Math.max(...rows.map((r) => (typeof r.MAE_EUR === 'number' ? r.MAE_EUR : 0)), 1)
  if (!sel) return <p className="text-sm text-salvia">Sin métricas de test publicadas.</p>
  return (
    <div className="space-y-4">
      <p className="text-[0.84rem] leading-relaxed text-salvia-2">
        En {typeof nTest === 'number' ? num(nTest) : 'las'} valoraciones de test, el modelo principal se desvía de media{' '}
        <span className="font-mono text-blanco">{eurCompact(sel.MAE_EUR as number)}</span> del valor real
        {typeof sel.ratio_mediano === 'number' && (
          <>
            {' '}
            y su estimación mediana es <span className="font-mono text-blanco">{num(sel.ratio_mediano, 2)}×</span> el valor observado
          </>
        )}
        .
      </p>
      <div className="space-y-2.5">
        {[sel, ...others].map((r) => (
          <div key={r.modelo}>
            <div className="mb-1 flex justify-between text-[0.76rem]">
              <span className={r === sel ? 'font-semibold text-lime' : 'text-salvia-2'}>
                {r.modelo}
                {r === sel && ' · principal'}
              </span>
              <span className="font-mono text-blanco tabular">MAE {eurCompact(r.MAE_EUR as number)}</span>
            </div>
            <Meter value={(r.MAE_EUR as number) / maxMae} color={r === sel ? 'var(--color-lime)' : 'var(--color-blue)'} className="h-1" />
          </div>
        ))}
      </div>
      {advanced && (
        <dl className="grid grid-cols-3 gap-3 border-t border-line pt-3 text-[0.76rem]">
          <div>
            <dt className="text-2xs text-salvia">R²</dt>
            <dd className="font-mono text-blanco">{typeof sel.R2 === 'number' ? num(sel.R2, 3) : ND}</dd>
          </div>
          <div>
            <dt className="text-2xs text-salvia">F1 1 M€</dt>
            <dd className="font-mono text-blanco">{typeof sel.f1_1M === 'number' ? fractionLabel(sel.f1_1M, 0) : ND}</dd>
          </div>
          <div>
            <dt className="text-2xs text-salvia">F1 5 M€</dt>
            <dd className="font-mono text-blanco">{typeof sel.f1_5M === 'number' ? fractionLabel(sel.f1_5M, 0) : ND}</dd>
          </div>
        </dl>
      )}
      <p className="text-2xs text-salvia">Métricas globales de test: no garantizan la precisión de una estimación individual.</p>
    </div>
  )
}
