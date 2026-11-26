import {marketDetailUrl} from '../api/market'
import {fromHistorical} from '../domain/shortlist'
import {navigate} from '../router/router'
import {MarketSearch} from '../components/market/MarketSearch'
/**
 * Mercado: explorador del catálogo histórico de alertas (GET /oportunidades)
 * con cuatro vistas sobre los MISMOS datos: ranking, tabla, mapa de valor y
 * residuos (Avanzado). Filtros del servidor, paginación y CSV conservados.
 */
import { useMemo, useRef, useState } from 'react'
import { getClient } from '../api/client'
import { toApiError } from '../api/errors'
import type { OpportunityQuery, OpportunityResponse, OpportunityRow, Position } from '../api/types'
import { ResidualChart } from '../components/charts/ResidualChart'
import { ValueScatter } from '../components/charts/ValueScatter'
import {
  IconBookmark,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconFilter,
  IconList,
  IconMarket,
  IconResidual,
  IconScatter,
  IconTable,
  IconX,
} from '../components/icons'
import { OpportunityRanking, rankRows } from '../components/market/OpportunityRanking'
import { RowDetail } from '../components/market/RowDetail'
import { Badge, Button, EmptyState, ErrorState, Field, Notice, PageHeader, Panel, Select, Skeleton, Tabs, TextInput, Toggle, cx } from '../components/ui/primitives'
import { useToast } from '../components/ui/toast'
import { competitionLabel, competitionShort } from '../domain/competitions'
import { downloadText, stamp } from '../domain/download'
import { dateLabel, eurCompact, isoDay, num, parseEuroInput, pctPoints } from '../domain/format'
import { catalogIdentity, DEFAULT_QUERY, opportunitiesCsv, pageInfo, validateQuery } from '../domain/market'
import { POSITIONS, positionLabel, subLabel, subShort } from '../domain/positions'
import { useApiStatus } from '../state/api-status'
import { useMode, usePrefs, type MarketView } from '../state/prefs'
import { useCatalogActions } from '../state/useCatalogActions'
import { useOpportunities } from '../state/useOpportunities'

const BUDGET_PRESETS = [1e6, 2.5e6, 5e6, 10e6, 25e6]
const POS_COLORS: Record<string, string> = { Attack: '#b7e68f', Midfield: '#83b9ce', Defender: '#c9a4d3', Goalkeeper: '#e5c383' }

export function MarketPage() {
  const api = useApiStatus()
  const toast = useToast()
  const { advanced } = useMode()
  const { prefs, update } = usePrefs()
  const view: MarketView = !advanced && prefs.marketView === 'residuos' ? 'ranking' : prefs.marketView
  const setView = (v: MarketView) => update((p) => ({ ...p, marketView: v }))

  const [q, setQ] = useState<OpportunityQuery>(DEFAULT_QUERY)
  const [budgetText, setBudgetText] = useState(String(DEFAULT_QUERY.presupuesto))
  const [edadText, setEdadText] = useState(String(DEFAULT_QUERY.edad_max))
  const [minText, setMinText] = useState(String(DEFAULT_QUERY.minutos_min))
  const [detail, setDetail] = useState<OpportunityRow | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [exporting, setExporting] = useState<{ done: number; total: number } | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const exportCtrl = useRef<AbortController | null>(null)

  const draft: OpportunityQuery = useMemo(() => {
    const b = parseEuroInput(budgetText)
    return {
      ...q,
      presupuesto: b === null ? NaN : b,
      edad_max: edadText.trim() === '' ? NaN : Number(edadText),
      minutos_min: minText.trim() === '' ? NaN : Number(minText),
    }
  }, [q, budgetText, edadText, minText])
  const errors = validateQuery(draft)
  const valid = Object.keys(errors).length === 0
  const res = useOpportunities(valid ? draft : null, 350)
  const data = res.data
  const actions = useCatalogActions(data)
  const info = data ? pageInfo(data.total, draft.limit, draft.offset) : null

  const patch = (p: Partial<OpportunityQuery>) => setQ((x) => ({ ...x, offset: 0, ...p }))
  const resetFilters = () => {
    setQ(DEFAULT_QUERY)
    setBudgetText(String(DEFAULT_QUERY.presupuesto))
    setEdadText(String(DEFAULT_QUERY.edad_max))
    setMinText(String(DEFAULT_QUERY.minutos_min))
  }

  const chips: { k: string; label: string; clear: () => void }[] = []
  if (Number.isFinite(draft.presupuesto) && draft.presupuesto !== DEFAULT_QUERY.presupuesto)
    chips.push({ k: 'p', label: `< ${eurCompact(draft.presupuesto)}`, clear: () => setBudgetText(String(DEFAULT_QUERY.presupuesto)) })
  if (Number.isFinite(draft.edad_max) && draft.edad_max !== DEFAULT_QUERY.edad_max) chips.push({ k: 'e', label: `≤ ${draft.edad_max} años`, clear: () => setEdadText(String(DEFAULT_QUERY.edad_max)) })
  if (Number.isFinite(draft.minutos_min) && draft.minutos_min !== DEFAULT_QUERY.minutos_min)
    chips.push({ k: 'm', label: `≥ ${num(draft.minutos_min)} min`, clear: () => setMinText(String(DEFAULT_QUERY.minutos_min)) })
  if (q.position) chips.push({ k: 'pos', label: positionLabel(q.position), clear: () => patch({ position: null }) })
  if (q.competition_id) chips.push({ k: 'c', label: competitionShort(q.competition_id), clear: () => patch({ competition_id: null }) })
  if (q.incluir_no_vigentes) chips.push({ k: 'h', label: 'Incluye históricos', clear: () => patch({ incluir_no_vigentes: false }) })

  const exportPage = () => {
    if (!data) return
    const csv = opportunitiesCsv(data.resultados, { query: draft, alcance: 'pagina', exportadoEn: new Date().toISOString(), response: data })
    downloadText(`offball-mercado-pagina-${info?.page ?? 1}-${stamp()}.csv`, csv, 'text/csv;charset=utf-8')
  }

  const exportAll = async () => {
    if (!data) return
    exportCtrl.current?.abort()
    const c = new AbortController()
    exportCtrl.current = c
    const rows: OpportunityRow[] = []
    const total = data.total
    setExporting({ done: 0, total })
    try {
      let last: OpportunityResponse = data
      for (let offset = 0; offset < total; offset += 100) {
        last = await getClient().oportunidades({ ...draft, limit: 100, offset }, { signal: c.signal })
        rows.push(...last.resultados)
        setExporting({ done: rows.length, total })
        if (last.resultados.length === 0) break
      }
      const csv = opportunitiesCsv(rows, { query: draft, alcance: 'todo', exportadoEn: new Date().toISOString(), response: last })
      downloadText(`offball-mercado-completo-${stamp()}.csv`, csv, 'text/csv;charset=utf-8')
      toast(`Exportadas ${rows.length} filas (todas las páginas).`)
    } catch (e) {
      const err = toApiError(e)
      if (err.kind !== 'aborted') toast(`Exportación interrumpida: ${err.message}`, 'warn')
    } finally {
      setExporting(null)
    }
  }

  const open = (r: OpportunityRow) => {
    const row=fromHistorical(r)
    if(row){navigate(marketDetailUrl(row));return}
    setDetail(r)
    setDetailOpen(true)
  }
  const nCandidatos = api.metadata.state === 'ok' ? api.metadata.data.configuracion.n_candidatos : undefined
  const selectedId = detail && detailOpen ? catalogIdentity(detail) : null
  const rows = data?.resultados ?? []
  const byId = (id: string) => rows.find((r) => catalogIdentity(r) === id)

  return (
    <div>
      <PageHeader
        title="Mercado"
        description={
          <>
            Alertas de posible infravaloración detectadas por el modelo en el catálogo histórico. La vigencia se mide respecto al corte del dataset, no a hoy: una fila
            no acredita que el jugador esté disponible.
          </>
        }
        actions={
          advanced ? (
            <>
              <Button variant="ghost" icon={<IconDownload size={15} />} disabled={!data || data.resultados.length === 0} onClick={exportPage}>
                CSV página
              </Button>
              <Button variant="secondary" icon={<IconDownload size={15} />} disabled={!data || data.total === 0 || !!exporting} loading={!!exporting} onClick={exportAll}>
                {exporting ? `${exporting.done}/${exporting.total}` : `CSV completo${data ? ` (${num(data.total)})` : ''}`}
              </Button>
              {exporting && (
                <Button variant="ghost" icon={<IconX size={14} />} onClick={() => exportCtrl.current?.abort()}>
                  Cancelar
                </Button>
              )}
            </>
          ) : (
            <Button variant="ghost" icon={<IconDownload size={15} />} disabled={!data || data.resultados.length === 0} onClick={exportPage}>
              Descargar CSV
            </Button>
          )
        }
      />

      <MarketSearch/>
      {/* Filtros */}
      <Panel className="mb-6">
        <button
          type="button"
          className="flex w-full items-center justify-between px-5 py-3.5 text-left text-sm font-semibold text-blanco lg:hidden"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((o) => !o)}
        >
          <span className="flex items-center gap-2">
            <IconFilter size={15} /> Filtros {chips.length > 0 && <Badge tone="lime">{chips.length}</Badge>}
          </span>
          <IconChevronRight size={16} className={cx('transition-transform duration-[var(--dur-2)]', filtersOpen && 'rotate-90')} />
        </button>
        <div className={cx('lg:block', filtersOpen ? 'block animate-fade' : 'hidden')}>
          <div className="grid gap-4 border-t border-line p-5 sm:grid-cols-2 lg:grid-cols-[1.5fr_0.7fr_0.8fr_1fr_1.2fr_0.6fr] lg:border-t-0">
            <Field
              label="Presupuesto máximo"
              htmlFor="m-presupuesto"
              error={errors.presupuesto}
              hint={Number.isFinite(draft.presupuesto) ? `Valor observado < ${eurCompact(draft.presupuesto)}` : undefined}
            >
              <TextInput
                id="m-presupuesto"
                inputMode="numeric"
                value={budgetText}
                invalid={!!errors.presupuesto}
                suffix="€"
                onChange={(e) => {
                  setBudgetText(e.target.value)
                  setQ((x) => ({ ...x, offset: 0 }))
                }}
              />
              <div className="mt-2 flex flex-wrap gap-1">
                {BUDGET_PRESETS.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => {
                      setBudgetText(String(b))
                      setQ((x) => ({ ...x, offset: 0 }))
                    }}
                    className={cx(
                      'press h-6 rounded-[var(--radius-ctl)] border px-1.5 font-mono text-2xs transition-colors',
                      draft.presupuesto === b ? 'border-lime/60 bg-lime/[0.06] text-lime' : 'border-line text-salvia hover:text-blanco',
                    )}
                  >
                    {eurCompact(b)}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Edad máxima" htmlFor="m-edad" error={errors.edad_max} hint="15–45 (edad histórica)">
              <TextInput id="m-edad" inputMode="numeric" value={edadText} invalid={!!errors.edad_max} onChange={(e) => (setEdadText(e.target.value), setQ((x) => ({ ...x, offset: 0 })))} />
            </Field>
            <Field label="Minutos mínimos" htmlFor="m-min" error={errors.minutos_min} hint="450–10.000">
              <TextInput id="m-min" inputMode="numeric" value={minText} invalid={!!errors.minutos_min} onChange={(e) => (setMinText(e.target.value), setQ((x) => ({ ...x, offset: 0 })))} />
            </Field>
            <Field label="Posición" htmlFor="m-pos">
              <Select id="m-pos" value={q.position ?? ''} onChange={(e) => patch({ position: (e.target.value || null) as Position | null })}>
                <option value="">Todas</option>
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {positionLabel(p)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Competición" htmlFor="m-comp">
              <Select id="m-comp" value={q.competition_id ?? ''} onChange={(e) => patch({ competition_id: e.target.value || null })}>
                <option value="">Todas</option>
                {api.competiciones.map((c) => (
                  <option key={c} value={c}>
                    {competitionLabel(c)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Por página" htmlFor="m-limit">
              <Select id="m-limit" value={q.limit} onChange={(e) => patch({ limit: Number(e.target.value) })}>
                {[10, 30, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line px-5 py-4">
            <Toggle
              id="m-historicos"
              checked={q.incluir_no_vigentes}
              onChange={(v) => patch({ incluir_no_vigentes: v })}
              label="Incluir históricos (no vigentes en el corte)"
              description="Alertas de temporadas anteriores. No son oportunidades actuales."
            />
            <div className="flex flex-wrap items-center gap-1.5">
              {chips.map((c) => (
                <button
                  key={c.k}
                  type="button"
                  onClick={c.clear}
                  className="press inline-flex h-7 animate-pop items-center gap-1.5 rounded-[var(--radius-ctl)] border border-line-2 bg-panel-2 px-2 text-[0.74rem] text-salvia-2 hover:text-blanco"
                  aria-label={`Quitar filtro ${c.label}`}
                >
                  {c.label} <IconX size={12} />
                </button>
              ))}
              {chips.length > 0 && (
                <button type="button" className="ml-1 text-[0.78rem] text-salvia underline decoration-line-2 underline-offset-4 hover:text-blanco" onClick={resetFilters}>
                  Restablecer
                </button>
              )}
            </div>
          </div>
        </div>
      </Panel>

      {/* Vistas */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <Tabs<MarketView>
          label="Vista del mercado"
          value={view}
          onChange={setView}
          tabs={[
            { value: 'ranking', label: <span className="flex items-center gap-2"><IconList size={15} /> Ranking</span> },
            { value: 'tabla', label: <span className="flex items-center gap-2"><IconTable size={15} /> Tabla</span> },
            { value: 'mapa', label: <span className="flex items-center gap-2"><IconScatter size={15} /> Valor vs. estimado</span> },
            ...(advanced ? [{ value: 'residuos' as const, label: <span className="flex items-center gap-2"><IconResidual size={15} /> Residuos</span> }] : []),
          ]}
          className="min-w-0 flex-1"
        />
      </div>

      {data && (
        <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.8rem] text-salvia">
          <span>
            <span className="font-mono text-blanco tabular">{num(data.total)}</span> alertas con estos filtros
          </span>
          <span>
            Corte <span className="text-salvia-2 tabular">{dateLabel(data.corte_datos)}</span>
          </span>
          {advanced && (
            <span>
              Modelo <span className="font-mono text-salvia-2">{data.modelo}</span>
            </span>
          )}
          <Badge tone={data.incluye_no_vigentes ? 'gold' : 'lime'}>{data.incluye_no_vigentes ? 'Incluye históricos' : 'Sólo vigentes en el corte'}</Badge>
        </div>
      )}
      {data?.advertencia && (
        <Notice tone="warn" className="mb-6">
          {data.advertencia}
        </Notice>
      )}

      {res.status === 'error' && res.error && (
        <Panel className="mb-6 p-5">
          <ErrorState error={res.error} onRetry={res.reload} />
        </Panel>
      )}

      {res.status === 'loading' && !data && (
        <Panel className="space-y-3 p-5">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-11" />
          ))}
        </Panel>
      )}

      {data && data.total === 0 && (
        <Panel>
          <EmptyState
            icon={<IconMarket size={20} />}
            title={data.incluye_no_vigentes ? 'Sin alertas con estos filtros' : 'Sin candidatos vigentes en el corte'}
            action={
              <>
                {!data.incluye_no_vigentes && (
                  <Button variant="secondary" onClick={() => patch({ incluir_no_vigentes: true })}>
                    Incluir históricos
                  </Button>
                )}
                {chips.length > 0 && (
                  <Button variant="ghost" onClick={resetFilters}>
                    Restablecer filtros
                  </Button>
                )}
              </>
            }
          >
            {data.incluye_no_vigentes ? (
              <p>Amplía el presupuesto o la edad máxima, o quita filtros de posición y competición.</p>
            ) : (
              <p>
                El catálogo no contiene candidatos vigentes respecto al corte ({dateLabel(data.corte_datos)}) con estos criterios
                {nCandidatos === 0 ? ' (la configuración del modelo registra 0 candidatos vigentes)' : ''}. Es una limitación del catálogo, no un fallo. Puedes
                consultar las alertas históricas.
              </p>
            )}
          </EmptyState>
        </Panel>
      )}

      {data && rows.length > 0 && (
        <div key={view} className={cx('animate-fade transition-opacity duration-[var(--dur-2)]', res.status === 'loading' && 'opacity-60')}>
          {view === 'ranking' && (
            <Panel className="px-4 py-1">
              <OpportunityRanking quickActions rows={rankRows(rows)} onOpen={open} selectedId={selectedId} startRank={draft.offset + 1} advanced={advanced} />
            </Panel>
          )}

          {view === 'tabla' && (
            <Panel>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse text-left text-sm [&_td]:whitespace-nowrap">
                  <caption className="sr-only">Alertas económicas del catálogo histórico</caption>
                  <thead>
                    <tr className="border-b border-line text-[0.72rem] font-medium text-salvia">
                      <th scope="col" className="px-5 py-3 font-medium">Jugador</th>
                      <th scope="col" className="px-3 py-3 font-medium">Competición</th>
                      <th scope="col" className="px-3 py-3 text-right font-medium">Edad*</th>
                      <th scope="col" className="px-3 py-3 text-right font-medium">Minutos</th>
                      <th scope="col" className="px-3 py-3 text-right font-medium">Observado</th>
                      <th scope="col" className="px-3 py-3 text-right font-medium">Estimado</th>
                      <th scope="col" className="px-3 py-3 text-right font-medium">Diferencia</th>
                      {advanced && <th scope="col" className="px-3 py-3 text-right font-medium" title="Residuo log − umbral P95">Exceso P95</th>}
                      {advanced && <th scope="col" className="px-3 py-3 font-medium">Valoración · cierre</th>}
                      <th scope="col" className="px-3 py-3 font-medium">Vigencia</th>
                      <th scope="col" className="px-5 py-3"><span className="sr-only">Acciones</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const id = catalogIdentity(r)
                      const isSaved = actions.isSaved(r)
                      return (
                        <tr
                          key={id}
                          className={cx('group animate-fade border-b border-line transition-colors last:border-b-0 hover:bg-panel-2', selectedId === id && 'bg-panel-2')}
                          style={{ animationDelay: `${Math.min(i, 12) * 20}ms` }}
                        >
                          <td className="px-5 py-2.5">
                            <button type="button" onClick={() => open(r)} className="flex items-center gap-3 text-left">
                              <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line-2 bg-noche-2 font-mono text-2xs text-salvia-2">{subShort(r.sub_position)}</span>
                              <span className="min-w-0">
                                <span className="block truncate font-medium text-blanco group-hover:text-lime">{r.name ?? 'Sin nombre'}</span>
                                <span className="block text-2xs text-salvia">{subLabel(r.sub_position)}</span>
                              </span>
                            </button>
                          </td>
                          <td className="px-3 py-2.5 text-salvia-2">{competitionShort(r.competition_id)}</td>
                          <td className="px-3 py-2.5 text-right font-mono tabular">{num(r.age)}</td>
                          <td className="px-3 py-2.5 text-right font-mono tabular">{num(r.minutos)}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-gold tabular">{eurCompact(r.market_value_in_eur)}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-lime tabular">{eurCompact(r.valor_estimado)}</td>
                          <td className="px-3 py-2.5 text-right font-mono tabular">{pctPoints(r.diferencia_pct, 0)}</td>
                          {advanced && <td className="px-3 py-2.5 text-right font-mono text-salvia-2 tabular">{num(r.exceso_residuo, 3)}</td>}
                          {advanced && (
                            <td className="px-3 py-2.5 font-mono text-2xs leading-4 text-salvia tabular">
                              {isoDay(r.valuation_date) ?? 'N/D'}
                              <br />
                              {isoDay(r.fin_temporada) ?? 'N/D'}
                            </td>
                          )}
                          <td className="px-3 py-2.5">
                            {r.vigente_en_corte === true ? <Badge tone="lime">Vigente</Badge> : r.vigente_en_corte === false ? <Badge tone="gold">Histórico</Badge> : <Badge tone="muted">N/D</Badge>}
                          </td>
                          <td className="px-5 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => actions.saveRow(r)}
                              disabled={isSaved}
                              aria-label={isSaved ? 'Ya en seguimiento' : `Guardar ${r.name ?? 'ficha'} en seguimiento`}
                              title={isSaved ? 'Ya en seguimiento' : 'Guardar en seguimiento'}
                              className={cx('press rounded-[var(--radius-ctl)] p-2 transition-colors', isSaved ? 'text-lime' : 'text-salvia hover:bg-panel-3 hover:text-blanco')}
                            >
                              <IconBookmark size={15} fill={isSaved ? 'currentColor' : 'none'} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-line px-5 py-2 text-2xs text-salvia">* Edad en la fecha de valoración histórica.</p>
            </Panel>
          )}

          {view === 'mapa' && (
            <Panel className="p-5">
              <ValueScatter
                points={rows.map((r) => ({
                  id: catalogIdentity(r),
                  x: r.market_value_in_eur,
                  y: r.valor_estimado,
                  category: r.position ?? 'nd',
                  label: r.name ?? 'Sin nombre',
                  detail: (
                    <>
                      {subShort(r.sub_position)} · {competitionShort(r.competition_id)} · <span className="text-lime">{pctPoints(r.diferencia_pct, 0)}</span>
                    </>
                  ),
                }))}
                categories={POSITIONS.map((p) => ({ id: p, label: positionLabel(p), color: POS_COLORS[p]! }))}
                guides={advanced}
                selectedId={selectedId}
                onSelect={(id) => {
                  const r = byId(id)
                  if (r) open(r)
                }}
                caption="Página actual. Pulsa una posición en la leyenda para ocultarla."
              />
            </Panel>
          )}

          {view === 'residuos' && advanced && (
            <Panel className="p-5">
              <p className="mb-4 max-w-[72ch] text-[0.82rem] leading-relaxed text-salvia-2">
                Altura de cada línea = cuánto supera el residuo logarítmico log(estimado/observado) el umbral P95 de su posición y rango (campo{' '}
                <span className="font-mono">exceso_residuo</span>). Todas las filas del catálogo son alertas, por eso ninguna queda por debajo de 0.
              </p>
              <ResidualChart
                points={rows.map((r) => ({ id: catalogIdentity(r), label: r.name ?? 'Sin nombre', observed: r.market_value_in_eur, excess: r.exceso_residuo, color: POS_COLORS[r.position ?? ''] ?? '#a8b9b2' }))}
                selectedId={selectedId}
                onSelect={(id) => {
                  const r = byId(id)
                  if (r) open(r)
                }}
              />
            </Panel>
          )}

          {info && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[0.8rem] text-salvia">
              <span className="font-mono tabular">
                {num(info.from)}–{num(info.to)} de {num(data.total)} · página {info.page}/{info.pages}
              </span>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" disabled={!info.hasPrev} icon={<IconChevronLeft size={14} />} onClick={() => setQ((x) => ({ ...x, offset: Math.max(0, x.offset - x.limit) }))}>
                  Anterior
                </Button>
                <Button variant="ghost" size="sm" disabled={!info.hasNext} iconRight={<IconChevronRight size={14} />} onClick={() => setQ((x) => ({ ...x, offset: x.offset + x.limit }))}>
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {detail && data && (
        <RowDetail
          row={detail}
          open={detailOpen}
          corte={data.corte_datos}
          modelo={data.modelo}
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
