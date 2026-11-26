/**
 * Análisis individual → informe interactivo de scouting.
 * Lógica conservada: validación compatible con Pydantic, dos peticiones
 * independientes (éxito parcial), cancelación de peticiones obsoletas,
 * borrador en sessionStorage, guardado y comparador.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { getClient } from '../api/client'
import { toApiError } from '../api/errors'
import type { EconomicResult, OffensiveResult } from '../api/types'
import { EconomicDetail, RatiosPanel, ValueVerdict, Warnings } from '../components/analysis/Economic'
import { PlayerForm } from '../components/analysis/PlayerForm'
import { PositionalMap, ProfileReadingBlock } from '../components/analysis/Positional'
import { PitchOutline } from '../components/charts/Pitch'
import { ProbabilityStrip } from '../components/charts/ProbabilityStrip'
import { IconBookmark, IconColumns, IconDownload, IconEdit, IconPlay, IconRefresh, IconTarget, IconX } from '../components/icons'
import { TacticalPitch } from '../components/pitch/TacticalPitch'
import { Badge, Button, ErrorState, Notice, Panel, Skeleton, cx } from '../components/ui/primitives'
import { useToast } from '../components/ui/toast'
import { runAnalysis, type AnalysisOutcome } from '../domain/analysis'
import { competitionShort } from '../domain/competitions'
import { downloadText, stamp } from '../domain/download'
import { FICTIONAL_EXAMPLE } from '../domain/example'
import { buildEconomicPayload, buildOffensivePayload, EMPTY_FORM, validateForm, type AnalysisForm, type FormField } from '../domain/form'
import { dateTimeLabel, fractionLabel, num, per90, todayIso } from '../domain/format'
import { zonesFrom } from '../domain/pitch'
import { positionLabel, subLabel, subShort } from '../domain/positions'
import { profileColor, readProfiles } from '../domain/profiles'
import { AnimatedNumber } from '../motion/components'
import { Link, navigate, useRoute } from '../router/router'
import { useApiStatus } from '../state/api-status'
import { useMode } from '../state/prefs'
import { useCompare, useSaved } from '../state/saved'
import { makeManualItem, type ManualItem } from '../state/storage'

const DRAFT_KEY = 'offball.borrador'

function readDraft(): AnalysisForm {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    return raw ? { ...EMPTY_FORM, ...(JSON.parse(raw) as Partial<AnalysisForm>) } : EMPTY_FORM
  } catch {
    return EMPTY_FORM
  }
}

interface RunState {
  status: 'idle' | 'loading' | 'done'
  outcome?: AnalysisOutcome
  snapshot?: AnalysisForm
  at?: string
  restoredFrom?: ManualItem
  savedId?: string
}

type SectionId = 'resumen' | 'valor' | 'perfil' | 'mapa' | 'tecnico'

export function AnalyzePage() {
  const api = useApiStatus()
  const { advanced } = useMode()
  const { query } = useRoute()
  const toast = useToast()
  const saved = useSaved()
  const compare = useCompare()
  const [form, setForm] = useState<AnalysisForm>(readDraft)
  const [touched, setTouched] = useState<Set<FormField>>(new Set())
  const [submitted, setSubmitted] = useState(false)
  const [run, setRun] = useState<RunState>({ status: 'idle' })
  const [isExample, setIsExample] = useState(false)
  const [formOpen, setFormOpen] = useState(true)
  const ctrl = useRef<AbortController | null>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  const qId = query.get('id')
  const qEjemplo = query.get('ejemplo')
  useEffect(() => {
    if (qId) {
      const item = saved.get(qId)
      if (item && item.origen === 'manual') {
        setForm(item.form)
        setIsExample(false)
        setFormOpen(false)
        setRun({
          status: 'done',
          snapshot: item.form,
          at: item.analizadoEn,
          restoredFrom: item,
          savedId: item.id,
          outcome: {
            economic: item.economic ? { status: 'ok', data: item.economic } : { status: 'skipped', reason: 'No se guardó resultado económico.' },
            offensive: item.offensive ? { status: 'ok', data: item.offensive } : { status: 'skipped', reason: 'Esta ficha no tiene resultado de afinidad guardado.' },
          },
        })
      }
      navigate('/analizar', { replace: true })
    } else if (qEjemplo) {
      setForm(FICTIONAL_EXAMPLE)
      setIsExample(true)
      setTouched(new Set())
      setSubmitted(false)
      setFormOpen(true)
      navigate('/analizar', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qId, qEjemplo])

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form))
    } catch {
      /* almacenamiento no disponible */
    }
  }, [form])

  useEffect(() => () => ctrl.current?.abort(), [])

  const ctx = useMemo(
    () => ({ today: todayIso(), corte: api.corte, subposiciones: api.subposiciones, competiciones: api.competiciones }),
    [api.corte, api.subposiciones, api.competiciones],
  )
  const validation = useMemo(() => validateForm(form, ctx), [form, ctx])

  const onChange = useCallback((patch: Partial<AnalysisForm>) => {
    setForm((f) => ({ ...f, ...patch }))
    setIsExample(false)
  }, [])
  const visible = useCallback((f: FormField) => submitted || touched.has(f), [submitted, touched])
  const onBlurField = useCallback((f: FormField) => setTouched((t) => (t.has(f) ? t : new Set(t).add(f))), [])

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    setSubmitted(true)
    if (!validation.economicReady || (validation.offensiveApplies && !validation.offensiveReady)) {
      setFormOpen(true)
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    ctrl.current?.abort()
    const c = new AbortController()
    ctrl.current = c
    const snapshot = form
    setRun({ status: 'loading', snapshot })
    if (window.matchMedia('(max-width: 1279px)').matches) resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    try {
      const outcome = await runAnalysis(
        getClient(),
        buildEconomicPayload(snapshot),
        validation.offensiveApplies ? buildOffensivePayload(snapshot) : null,
        { signal: c.signal, offensiveApplies: validation.offensiveApplies },
      )
      if (c.signal.aborted) return
      setRun({ status: 'done', outcome, snapshot, at: new Date().toISOString() })
      if (outcome.economic.status === 'ok' || outcome.offensive.status === 'ok') setFormOpen(false)
    } catch (err) {
      if (c.signal.aborted) return
      const error = toApiError(err)
      setRun({ status: 'done', snapshot, at: new Date().toISOString(), outcome: { economic: { status: 'error', error }, offensive: { status: 'error', error } } })
    }
  }

  const cancel = () => {
    ctrl.current?.abort()
    setRun({ status: 'idle' })
  }

  const reset = () => {
    setForm(EMPTY_FORM)
    setTouched(new Set())
    setSubmitted(false)
    setIsExample(false)
  }

  const eco: EconomicResult | null = run.outcome?.economic.status === 'ok' ? run.outcome.economic.data : null
  const off: OffensiveResult | null = run.outcome?.offensive.status === 'ok' ? run.outcome.offensive.data : null
  const canSave = !!run.snapshot && (eco || off) && !run.restoredFrom

  const save = (): string | null => {
    if (run.savedId) return run.savedId
    if (!run.snapshot || !run.at) return null
    const item = makeManualItem({ nombre: run.snapshot.nombre.trim(), form: run.snapshot, economic: eco, offensive: off, analizadoEn: run.at, corteDatos: api.corte })
    saved.add(item)
    setRun((r) => ({ ...r, savedId: item.id }))
    toast(
      <>
        Ficha guardada en seguimiento.{' '}
        <Link to="/seguimiento" className="font-semibold text-lime underline underline-offset-4">
          Ver
        </Link>
      </>,
    )
    return item.id
  }

  const addToCompare = () => {
    const id = save()
    if (!id) return
    if (compare.ids.includes(id)) {
      navigate('/comparador')
      return
    }
    const r = compare.toggle(id)
    if (r.full) toast('El comparador ya tiene 3 fichas. Quita una para añadir otra.', 'warn')
    else
      toast(
        <>
          Añadida al comparador ({r.ids.length}/3).{' '}
          <Link to="/comparador" className="font-semibold text-lime underline underline-offset-4">
            Abrir
          </Link>
        </>,
      )
  }

  const exportJson = () => {
    if (!run.snapshot) return
    const payload = {
      app: 'OFFBALL',
      exportadoEn: new Date().toISOString(),
      analizadoEn: run.at,
      corteDatos: api.corte,
      entrada: run.snapshot,
      peticiones: {
        valoracion: safe(() => buildEconomicPayload(run.snapshot!)),
        afinidad: validation.offensiveApplies ? safe(() => buildOffensivePayload(run.snapshot!)) : null,
      },
      respuestas: { valoracion: eco, afinidad: off },
    }
    downloadText(`offball-informe-${slug(run.snapshot.nombre) || 'jugador'}-${stamp()}.json`, JSON.stringify(payload, null, 2), 'application/json')
    toast('Informe exportado en JSON.')
  }

  const preview = {
    g: form.minutos && form.goles ? per90(Number(form.goles), Number(form.minutos)) : null,
    a: form.minutos && form.asistencias ? per90(Number(form.asistencias), Number(form.minutos)) : null,
  }
  const snap = run.snapshot
  const hasReport = run.status !== 'idle' && !!snap
  const playerLabel = snap?.nombre.trim() || 'Este jugador'

  return (
    <div>
      {!hasReport && (
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <h1 className="font-display text-[1.75rem] leading-[1.08] font-extrabold tracking-[-0.015em] text-blanco sm:text-[2.2rem]">Analizar jugador</h1>
            <p className="mt-3 text-[0.92rem] leading-relaxed text-salvia-2">
              Introduce una temporada de liga ya cerrada. Recibirás su valor estimado frente al de mercado, la señal de posible infravaloración y, si es atacante,
              su perfil y su mapa táctico.
            </p>
          </div>
          <Link to="/analizar?ejemplo=1" className="text-[0.84rem] font-semibold text-lime underline decoration-lime/40 underline-offset-4 hover:decoration-lime">
            Cargar jugador ficticio de ejemplo
          </Link>
        </header>
      )}

      <div className={cx('grid items-start gap-6', hasReport ? 'xl:grid-cols-[340px_minmax(0,1fr)]' : 'xl:grid-cols-[420px_minmax(0,1fr)]')}>
        {/* -------- Formulario -------- */}
        <form onSubmit={submit} noValidate className="xl:sticky xl:top-20" aria-label="Datos del jugador">
          <Panel as="div" className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-line bg-panel-2 px-5 py-3.5">
              <p className="flex items-center gap-2 text-sm font-semibold whitespace-nowrap text-blanco">
                <IconTarget size={16} className="text-lime" />
                {hasReport ? 'Datos' : 'Datos del jugador'}
              </p>
              <div className="flex items-center gap-2">
                {isExample && <Badge tone="gold">Jugador ficticio</Badge>}
                {hasReport && !formOpen ? (
                  <Button variant="ghost" size="sm" icon={<IconEdit size={14} />} onClick={() => setFormOpen(true)}>
                    Editar
                  </Button>
                ) : (
                  <button type="button" onClick={reset} className="rounded px-1.5 py-0.5 text-2xs text-salvia hover:text-blanco">
                    Vaciar
                  </button>
                )}
              </div>
            </div>

            {hasReport && !formOpen && snap && <FormSummary f={snap} />}

            <div className="disclose" data-open={!hasReport || formOpen} inert={hasReport && !formOpen}>
              <div>
                <div className="max-h-none xl:max-h-[calc(100dvh-16rem)] xl:overflow-y-auto">
                  <PlayerForm
                    form={form}
                    onChange={onChange}
                    errors={validation.errors}
                    visible={visible}
                    onBlurField={onBlurField}
                    subposiciones={api.subposiciones}
                    competiciones={api.competiciones}
                    corte={api.corte}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3 border-t border-line bg-panel-2 px-5 py-4">
              {validation.warnings.map((w) => (
                <Notice key={w} tone="warn">
                  {w}
                </Notice>
              ))}
              {!api.catalogsFromApi && formOpen && <p className="text-2xs text-salvia">Catálogos del contrato v0.1.0 (metadata aún no disponible).</p>}
              <div className="flex gap-2">
                <Button type="submit" size="lg" className="flex-1" loading={run.status === 'loading'} icon={<IconPlay size={15} />}>
                  {run.status === 'loading' ? 'Analizando…' : hasReport ? 'Volver a analizar' : 'Analizar'}
                </Button>
                {run.status === 'loading' && (
                  <Button variant="ghost" size="lg" onClick={cancel} icon={<IconX size={15} />}>
                    Cancelar
                  </Button>
                )}
              </div>
              {api.connection === 'offline' && <p className="text-2xs text-coral">Sin conexión: puedes preparar la ficha; el análisis requiere la API.</p>}
            </div>
          </Panel>
        </form>

        {/* -------- Informe -------- */}
        <div ref={resultsRef} className="min-w-0 scroll-mt-20" aria-live="polite" aria-busy={run.status === 'loading'}>
          {run.status === 'idle' && <IdleResults />}

          {hasReport && snap && (
            <ReportHeader
              f={snap}
              at={run.at}
              profileColor={off ? profileColor(readProfiles(off.perfiles)?.top.cluster ?? 0) : null}
              actions={
                run.restoredFrom ? (
                  <>
                    <Badge tone="blue">Recuperado de seguimiento</Badge>
                    <Button variant="secondary" size="sm" icon={<IconRefresh size={14} />} onClick={() => submit()}>
                      Volver a ejecutar
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="secondary" size="sm" icon={<IconBookmark size={14} fill={run.savedId ? 'currentColor' : 'none'} />} disabled={!canSave || !!run.savedId} onClick={save}>
                      {run.savedId ? 'Guardada' : 'Guardar'}
                    </Button>
                    <Button variant="ghost" size="sm" icon={<IconColumns size={14} />} disabled={!canSave} onClick={addToCompare}>
                      Comparar
                    </Button>
                  </>
                )
              }
              extra={
                advanced && run.status === 'done' && (eco || off) ? (
                  <Button variant="ghost" size="sm" icon={<IconDownload size={14} />} onClick={exportJson}>
                    JSON
                  </Button>
                ) : null
              }
            />
          )}

          {run.status === 'loading' && <LoadingResults offensive={validation.offensiveApplies} />}

          {run.status === 'done' && run.outcome && snap && (
            <Report
              outcome={run.outcome}
              eco={eco}
              off={off}
              snap={snap}
              preview={preview}
              playerLabel={playerLabel}
              savedId={run.savedId ?? null}
              onRetry={() => submit()}
              offensiveApplies={validation.offensiveApplies}
            />
          )}
        </div>
      </div>
    </div>
  )
}

const safe = <T,>(fn: () => T): T | null => {
  try {
    return fn()
  } catch {
    return null
  }
}
const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '—'
  return (parts[0]![0]! + (parts[1]?.[0] ?? '')).toUpperCase()
}

function FormSummary({ f }: { f: AnalysisForm }) {
  const items: [string, string][] = [
    ['Posición', `${subShort(f.sub_position)} · ${subLabel(f.sub_position)}`],
    ['Competición', competitionShort(f.competition_id)],
    ['Temporada', `${f.partidos} PJ · ${num(Number(f.minutos))} min`],
    ['Goles · asistencias', `${f.goles} · ${f.asistencias}`],
    ['Edad', `${f.age} años`],
  ]
  return (
    <dl className="animate-fade divide-y divide-line px-5 py-2 text-[0.8rem]">
      {items.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 py-2">
          <dt className="text-salvia">{k}</dt>
          <dd className="truncate text-right text-blanco tabular">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function ReportHeader({ f, at, actions, extra, profileColor: ring }: { f: AnalysisForm; at?: string; actions: ReactNode; extra?: ReactNode; profileColor: string | null }) {
  return (
    <div className="mb-2 animate-fade">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div
            className="grid size-14 shrink-0 place-items-center rounded-full bg-noche-2 font-display text-lg font-extrabold text-blanco"
            style={{ boxShadow: `inset 0 0 0 2px ${ring ?? 'var(--color-line-2)'}` }}
            aria-hidden="true"
          >
            {initials(f.nombre)}
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-display text-[1.6rem] leading-tight font-extrabold tracking-[-0.01em] text-blanco">{f.nombre.trim() || 'Análisis sin nombre'}</h1>
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[0.8rem] text-salvia">
              <span className="text-salvia-2">
                {positionLabel(f.position || null)} · {subLabel(f.sub_position)}
              </span>
              <span>{competitionShort(f.competition_id)}</span>
              <span>{f.age} años</span>
              {at && <span className="tabular">Analizado {dateTimeLabel(at)}</span>}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {extra}
          {actions}
        </div>
      </div>
    </div>
  )
}

function Report({
  outcome,
  eco,
  off,
  snap,
  preview,
  playerLabel,
  savedId,
  onRetry,
  offensiveApplies,
}: {
  outcome: AnalysisOutcome
  eco: EconomicResult | null
  off: OffensiveResult | null
  snap: AnalysisForm
  preview: { g: number | null; a: number | null }
  playerLabel: string
  savedId: string | null
  onRetry: () => void
  offensiveApplies: boolean
}) {
  const { advanced } = useMode()
  const sections: { id: SectionId; label: string }[] = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'valor', label: 'Valor' },
    ...(off ? [{ id: 'perfil' as const, label: 'Perfil' }, { id: 'mapa' as const, label: 'Mapa táctico' }] : []),
    ...(advanced ? [{ id: 'tecnico' as const, label: 'Detalle técnico' }] : []),
  ]
  const [tab, setActive] = useState<SectionId>('resumen')
  const active = sections.some(s=>s.id===tab) ? tab : 'resumen'
  const go = (id: SectionId) => {
    setActive(id)

  }
  const reading = off ? readProfiles(off.perfiles) : null
  const best = off ? zonesFrom(off.afinidad).find((z) => z.name === off.mejor_zona) : null

  return (
    <div>
      {/* Navegación interna del informe */}
      <nav aria-label="Secciones del informe" className="sticky top-14 z-20 -mx-1 mb-6 border-b border-line bg-noche/95 px-1 backdrop-blur-sm">
        <ul className="flex gap-1 overflow-x-auto">
          {sections.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => go(s.id)}
                aria-current={active === s.id ? 'true' : undefined}
                className={cx(
                  'relative h-11 px-3 text-[0.84rem] font-medium whitespace-nowrap transition-colors duration-[var(--dur-1)]',
                  active === s.id ? 'text-blanco' : 'text-salvia hover:text-salvia-2',
                )}
              >
                {s.label}
                <span
                  aria-hidden="true"
                  className={cx(
                    'absolute inset-x-2 bottom-0 h-[2px] origin-center rounded-full bg-lime transition-transform duration-[var(--dur-3)] ease-[var(--ease-out-soft)]',
                    active === s.id ? 'scale-x-100' : 'scale-x-0',
                  )}
                />
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex items-center justify-between gap-2 mb-4"><Button variant="secondary" size="sm" disabled={sections.findIndex(s=>s.id===active)===0} onClick={()=>go(sections[sections.findIndex(s=>s.id===active)-1]!.id)}>← Anterior</Button><span className="ob-kicker">◆ {String(sections.findIndex(s=>s.id===active)+1).padStart(2,'0')} / {String(sections.length).padStart(2,'0')}</span><Button variant="secondary" size="sm" disabled={sections.findIndex(s=>s.id===active)===sections.length-1} onClick={()=>go(sections[sections.findIndex(s=>s.id===active)+1]!.id)}>Siguiente →</Button></div>
      <div key={active} className="ob-deck-panel p-5 ob-slide">
        {/* RESUMEN */}
        <section hidden={active !== 'resumen'} id="sec-resumen" aria-labelledby="h-resumen" className="scroll-mt-32">
          <h2 id="h-resumen" className="sr-only">
            Resumen
          </h2>
          {outcome.economic.status === 'ok' && <ValueVerdict r={outcome.economic.data} />}
          {outcome.economic.status === 'error' && <ErrorState error={outcome.economic.error} onRetry={onRetry} />}
          {outcome.economic.status === 'skipped' && <Notice>{outcome.economic.reason}</Notice>}

          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              <RatiosPanel r={eco} preview={preview} />
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-btn)] border border-line bg-line">
                <div className="bg-panel p-4">
                  <p className="text-[0.75rem] text-salvia">Minutos</p>
                  <p className="mt-1 font-mono text-xl text-blanco">
                    <AnimatedNumber value={Number(snap.minutos)} format={(v) => num(v)} />
                  </p>
                </div>
                <div className="bg-panel p-4">
                  <p className="text-[0.75rem] text-salvia">Partidos</p>
                  <p className="mt-1 font-mono text-xl text-blanco">
                    <AnimatedNumber value={Number(snap.partidos)} format={(v) => num(v)} />
                  </p>
                </div>
              </div>
            </div>
            {off && reading && best ? (
              <button
                type="button"
                onClick={() => go('mapa')}
                className="group grid grid-cols-[minmax(0,1fr)_132px] gap-4 rounded-[var(--radius-card)] border border-line bg-panel p-4 text-left transition-colors hover:border-line-3"
              >
                <div className="min-w-0">
                  <p className="text-[0.75rem] text-salvia">Perfil deportivo</p>
                  <p className="mt-1 flex items-center gap-2 font-display text-lg font-bold text-blanco">
                    <span className="size-2.5 rounded-[2px]" style={{ background: profileColor(reading.top.cluster) }} />
                    <span className="truncate">{reading.top.perfil}</span>
                  </p>
                  <p className="text-[0.78rem] text-salvia-2 tabular">
                    {fractionLabel(reading.top.probabilidad, 0)} de probabilidad{reading.mixed ? ' · perfil mixto' : ''}
                  </p>
                  <ProbabilityStrip perfiles={off.perfiles} height="h-2" className="mt-3" />
                  <p className="mt-4 text-[0.75rem] text-salvia">Zona de mayor afinidad</p>
                  <p className="mt-0.5 text-[0.9rem] font-semibold text-blanco">
                    {best.label} <span className="font-mono text-lime tabular">{fractionLabel(best.value)}</span>
                  </p>
                  <p className="mt-3 text-2xs text-salvia group-hover:text-salvia-2">Ver el mapa táctico estimado</p>
                </div>
                <TacticalPitch values={off.afinidad} mejor={off.mejor_zona} compact title={`Mapa táctico estimado de ${playerLabel} (miniatura)`} layers={{ lines: true, labels: false, values: false, markers: true }} className="self-center border border-line" />
              </button>
            ) : (
              <OffensiveStatus outcome={outcome} onRetry={onRetry} offensiveApplies={offensiveApplies} />
            )}
          </div>
          {eco && eco.advertencias.length > 0 && (
            <div className="mt-4">
              <Warnings items={eco.advertencias} />
            </div>
          )}
        </section>

        {/* VALOR */}
        <section hidden={active !== 'valor'} id="sec-valor" aria-labelledby="h-valor" className="scroll-mt-32">
          <ReportSectionTitle id="h-valor" title="Valor de mercado" description="Cuánto estima el modelo frente al valor observado, y si la diferencia es inusual para su posición y rango." />
          {eco ? <EconomicDetail r={eco} /> : <p className="text-sm text-salvia">Sin resultado económico.</p>}
        </section>

        {/* PERFIL */}
        {off && (
          <section hidden={active !== 'perfil'} id="sec-perfil" aria-labelledby="h-perfil" className="scroll-mt-32">
            <ReportSectionTitle id="h-perfil" title="Perfil deportivo" description="A qué grupo de atacantes se parece según goles/90, asistencias/90 y altura (modelo GMM, cinco perfiles)." />
            <ProfileReadingBlock r={off} playerLabel={playerLabel} excludeId={savedId} />
          </section>
        )}

        {/* MAPA */}
        {off && (
          <section hidden={active !== 'mapa'} id="sec-mapa" aria-labelledby="h-mapa" className="scroll-mt-32">
            <ReportSectionTitle id="h-mapa" title="Mapa táctico estimado" description="Dónde encaja estadísticamente entre los cuatro roles ofensivos. Pasa el cursor por el campo, haz clic en una zona o compárala." />
            <PositionalMap r={off} playerLabel={playerLabel} footKnown={!!snap.foot} excludeId={savedId} />
          </section>
        )}
        {/* TÉCNICO */}
        {advanced && (
          <section hidden={active !== 'tecnico'} id="sec-tecnico" aria-labelledby="h-tecnico" className="scroll-mt-32 animate-fade">
            <ReportSectionTitle id="h-tecnico" title="Detalle técnico" description="Peticiones enviadas y respuestas exactas de la API. El nombre del jugador nunca se envía." />
            <div className="grid gap-4 xl:grid-cols-2">
              <JsonBlock title="POST /api/v1/valoracion · petición" value={safe(() => buildEconomicPayload(snap))} />
              <JsonBlock title="Respuesta" value={eco} />
              {offensiveApplies && <JsonBlock title="POST /api/v1/afinidad · petición" value={safe(() => buildOffensivePayload(snap))} />}
              {offensiveApplies && <JsonBlock title="Respuesta" value={off} />}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function ReportSectionTitle({ id, title, description }: { id: string; title: string; description: string }) {
  return (
    <div className="mb-5 border-t border-line pt-6">
      <h2 id={id} className="font-display text-[1.25rem] font-bold tracking-[-0.01em] text-blanco">
        {title}
      </h2>
      <p className="mt-1 max-w-[70ch] text-[0.84rem] leading-relaxed text-salvia-2">{description}</p>
    </div>
  )
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="min-w-0 rounded-[var(--radius-btn)] border border-line bg-noche-2">
      <p className="border-b border-line px-4 py-2 font-mono text-2xs text-salvia">{title}</p>
      <pre className="max-h-72 overflow-auto px-4 py-3 font-mono text-[0.72rem] leading-relaxed text-salvia-2">{value ? JSON.stringify(value, null, 2) : 'N/D'}</pre>
    </div>
  )
}

function OffensiveStatus({ outcome, onRetry, offensiveApplies }: { outcome: AnalysisOutcome; onRetry: () => void; offensiveApplies: boolean }) {
  const o = outcome.offensive
  if (o.status === 'ok') return null
  if (o.status === 'error')
    return (
      <div className="rounded-[var(--radius-card)] border border-line bg-panel p-5">
        <p className="mb-3 text-[0.84rem] font-semibold text-blanco">Perfil ofensivo</p>
        <ErrorState error={o.error} onRetry={onRetry} compact />
      </div>
    )
  return (
    <div className="flex gap-4 rounded-[var(--radius-card)] border border-line bg-panel p-5">
      <PitchOutline className="hidden w-24 shrink-0 opacity-60 sm:block" />
      <div>
        <p className="text-[0.84rem] font-semibold text-blanco">Perfil y mapa táctico · {offensiveApplies ? 'sin calcular' : 'no aplicable'}</p>
        <p className="mt-1.5 max-w-2xl text-[0.82rem] leading-relaxed text-salvia-2">{o.reason}</p>
      </div>
    </div>
  )
}

function IdleResults() {
  return (
    <Panel className="relative overflow-hidden">
      <PitchOutline className="pointer-events-none absolute -right-16 -bottom-24 w-[460px] opacity-40" />
      <div className="relative px-6 py-14 sm:px-10">
        <h2 className="max-w-md font-display text-xl font-bold text-blanco">El informe aparecerá aquí</h2>
        <p className="mt-2 max-w-md text-[0.88rem] leading-relaxed text-salvia-2">Completa la temporada y pulsa Analizar. Obtendrás:</p>
        <ul className="mt-5 max-w-md space-y-3 text-[0.86rem] text-salvia-2">
          <li className="flex gap-3">
            <span className="mt-1.5 size-2 shrink-0 rounded-[2px] bg-lime" />
            <span>
              <span className="font-semibold text-blanco">Valor estimado</span> frente al valor de mercado y si la diferencia es inusual.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="mt-1.5 size-2 shrink-0 rounded-[2px] bg-lavender" />
            <span>
              <span className="font-semibold text-blanco">Perfil deportivo</span> entre cinco grupos de atacantes (sólo DC, SD, EI, ED y MCO).
            </span>
          </li>
          <li className="flex gap-3">
            <span className="mt-1.5 size-2 shrink-0 rounded-[2px] bg-gold" />
            <span>
              <span className="font-semibold text-blanco">Mapa táctico estimado</span> con su afinidad por zona.
            </span>
          </li>
        </ul>
        <Link to="/analizar?ejemplo=1" className="mt-7 inline-block text-sm font-semibold text-lime underline decoration-lime/40 underline-offset-4 hover:decoration-lime">
          Probar con el jugador ficticio de ejemplo
        </Link>
      </div>
    </Panel>
  )
}

function LoadingResults({ offensive }: { offensive: boolean }) {
  return (
    <div className="mt-6 space-y-6" role="status" aria-label="Calculando análisis">
      <div className="grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-line sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-3 bg-panel p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      <Skeleton className="h-4 w-2/3" />
      {offensive && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="aspect-[74/59.5]" />
          <div className="space-y-3">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        </div>
      )}
      <span className="sr-only">Calculando…</span>
    </div>
  )
}
