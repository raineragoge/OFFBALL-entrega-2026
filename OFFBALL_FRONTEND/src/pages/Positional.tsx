/** Acceso directo a inteligencia posicional: sólo POST /api/v1/afinidad. */
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { getClient } from '../api/client'
import { toApiError, type ApiError } from '../api/errors'
import type { Foot, OffensiveResult, Position } from '../api/types'
import { PositionalMap, ProfileReadingBlock } from '../components/analysis/Positional'
import { PitchOutline } from '../components/charts/Pitch'
import { IconPitch, IconPlay } from '../components/icons'
import { Badge, Button, EmptyState, ErrorState, Field, PageHeader, Panel, Segmented, Select, Skeleton, TextInput } from '../components/ui/primitives'
import { buildOffensivePayload, EMPTY_FORM, validateOffensiveOnly, type AnalysisForm, type FormField } from '../domain/form'
import { dateTimeLabel, num, per90, todayIso } from '../domain/format'
import { FOOT_LABELS, OFFENSIVE_SUBPOSITIONS, subLabel, subShort } from '../domain/positions'
import { Link } from '../router/router'
import { useApiStatus } from '../state/api-status'
import { useSaved } from '../state/saved'

/** La posición se deduce de la subposición ofensiva (contrato SUBPOS). */
function positionFor(sub: string, subpos: Record<string, string[]>): Position | '' {
  for (const [pos, subs] of Object.entries(subpos)) if (subs.includes(sub)) return pos as Position
  return ''
}

export function PositionalPage() {
  const api = useApiStatus()
  const saved = useSaved()
  const [form, setForm] = useState<AnalysisForm>({ ...EMPTY_FORM })
  const [submitted, setSubmitted] = useState(false)
  const [touched, setTouched] = useState<Set<FormField>>(new Set())
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'ok' | 'error'; data?: OffensiveResult; error?: ApiError; at?: string; foot?: string }>({
    status: 'idle',
  })
  const ctrl = useRef<AbortController | null>(null)
  useEffect(() => () => ctrl.current?.abort(), [])

  const { errors, ready } = useMemo(
    () => validateOffensiveOnly(form, { today: todayIso(), subposiciones: api.subposiciones }),
    [form, api.subposiciones],
  )
  const err = (f: FormField) => (submitted || touched.has(f) ? errors[f] : undefined)
  const blur = (f: FormField) => setTouched((t) => new Set(t).add(f))
  const set = (patch: Partial<AnalysisForm>) => setForm((f) => ({ ...f, ...patch }))

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    setSubmitted(true)
    if (!ready) return
    ctrl.current?.abort()
    const c = new AbortController()
    ctrl.current = c
    setState((s) => ({ ...s, status: 'loading' }))
    try {
      const data = await getClient().afinidad(buildOffensivePayload(form), { signal: c.signal })
      if (!c.signal.aborted) setState({ status: 'ok', data, at: new Date().toISOString(), foot: form.foot })
    } catch (er) {
      const error = toApiError(er)
      if (error.kind !== 'aborted') setState({ status: 'error', error })
    }
  }

  const savedOffensive = saved.items.filter((i) => i.origen === 'manual' && i.offensive)
  const g90 = form.minutos && form.goles ? per90(Number(form.goles), Number(form.minutos)) : null
  const a90 = form.minutos && form.asistencias ? per90(Number(form.asistencias), Number(form.minutos)) : null

  return (
    <div>
      <PageHeader
        title="Afinidad rápida"
        description="Sólo perfil GMM y mapa táctico estimado, a partir de goles/90, asistencias/90, altura y pie. Para delanteros, extremos y mediapuntas. Para la valoración económica usa Analizar jugador."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-6 xl:sticky xl:top-20">
          <form onSubmit={submit} noValidate aria-label="Datos ofensivos">
            <Panel as="div">
              <div className="flex items-center gap-2 border-b border-line bg-panel-2 px-5 py-3.5 text-sm font-semibold">
                <IconPitch size={16} className="text-lime" /> Datos ofensivos
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-4 p-5">
                <Field label="Subposición" htmlFor="p-sub" error={err('sub_position')} className="col-span-2">
                  <Select
                    id="p-sub"
                    value={form.sub_position}
                    invalid={!!err('sub_position')}
                    onChange={(e) => set({ sub_position: e.target.value, position: positionFor(e.target.value, api.subposiciones) })}
                    onBlur={() => blur('sub_position')}
                  >
                    <option value="">Selecciona…</option>
                    {OFFENSIVE_SUBPOSITIONS.map((s) => (
                      <option key={s} value={s}>
                        {subShort(s)} · {subLabel(s)}
                      </option>
                    ))}
                  </Select>
                </Field>
                {(
                  [
                    ['minutos', 'Minutos', '450–10.000'],
                    ['goles', 'Goles', '0–300'],
                    ['asistencias', 'Asistencias', '0–300'],
                    ['height_in_cm', 'Altura (cm)', '140–220'],
                  ] as const
                ).map(([f, label, hint]) => (
                  <Field key={f} label={label} htmlFor={`p-${f}`} error={err(f)} hint={hint}>
                    <TextInput
                      id={`p-${f}`}
                      inputMode="numeric"
                      value={form[f]}
                      invalid={!!err(f)}
                      onChange={(e) => set({ [f]: e.target.value } as Partial<AnalysisForm>)}
                      onBlur={() => blur(f)}
                    />
                  </Field>
                ))}
                <Field label="Pie dominante" htmlFor="p-foot" optional className="col-span-2" hint="El pie modifica la afinidad, no el perfil.">
                  <Segmented<Foot>
                    label="Pie dominante"
                    size="sm"
                    value={form.foot}
                    onChange={(v) => set({ foot: form.foot === v ? '' : v })}
                    options={(['right', 'left', 'both', 'desconocido'] as Foot[]).map((f) => ({ value: f, label: FOOT_LABELS[f] }))}
                  />
                </Field>
                <div className="col-span-2 flex justify-between rounded-md border border-dashed border-line-2 px-3 py-2 font-mono text-[0.78rem] tabular">
                  <span className="text-salvia">Vista previa</span>
                  <span>
                    <span className="text-salvia">G/90 </span>
                    {g90 !== null && Number.isFinite(g90) ? num(g90, 2) : '—'} <span className="ml-2 text-salvia">A/90 </span>
                    {a90 !== null && Number.isFinite(a90) ? num(a90, 2) : '—'}
                  </span>
                </div>
              </div>
              <div className="border-t border-line px-5 py-4">
                <Button type="submit" size="lg" className="w-full" loading={state.status === 'loading'} icon={<IconPlay size={15} />}>
                  Calcular afinidad
                </Button>
              </div>
            </Panel>
          </form>

          {savedOffensive.length > 0 && (
            <Panel>
              <p className="eyebrow border-b border-line px-5 py-3 text-salvia">Desde seguimiento</p>
              <ul className="divide-y divide-line">
                {savedOffensive.slice(0, 6).map((i) =>
                  i.origen === 'manual' ? (
                    <li key={i.id}>
                      <button
                        type="button"
                        onClick={() => setState({ status: 'ok', data: i.offensive!, at: i.analizadoEn, foot: i.form.foot })}
                        className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left text-sm transition-colors hover:bg-panel-2"
                      >
                        <span className="min-w-0 truncate text-blanco">{i.nombre || 'Análisis sin nombre'}</span>
                        <span className="shrink-0 font-mono text-2xs text-salvia">{subShort(i.form.sub_position)}</span>
                      </button>
                    </li>
                  ) : null,
                )}
              </ul>
            </Panel>
          )}
        </div>

        <div className="min-w-0" aria-live="polite">
          {state.status === 'idle' && (
            <Panel className="relative overflow-hidden">
              <PitchOutline className="mx-auto mt-8 block w-[min(520px,90%)] opacity-50" />
              <EmptyState title="Mapa de afinidad sin calcular" className="pt-4">
                Introduce los datos ofensivos y pulsa <strong className="text-blanco">Calcular afinidad</strong>. El campo mostrará las cuatro
                afinidades devueltas por la API, sin posiciones ni movimientos inventados.{' '}
                <Link to="/analizar" className="text-lime underline underline-offset-4">
                  Análisis completo
                </Link>
              </EmptyState>
            </Panel>
          )}
          {state.status === 'loading' && !state.data && (
            <Panel className="p-5">
              <Skeleton className="aspect-[74/59.5] w-full" />
            </Panel>
          )}
          {state.status === 'error' && state.error && (
            <Panel className="p-5">
              <ErrorState error={state.error} onRetry={() => submit()} />
            </Panel>
          )}
          {state.data && (state.status === 'ok' || state.status === 'loading') && (
            <div className={state.status === 'loading' ? 'opacity-60 transition-opacity duration-[var(--dur-2)]' : 'transition-opacity duration-[var(--dur-2)]'}>
              {state.at && (
                <p className="mb-3 flex items-center gap-2 font-mono text-2xs text-salvia">
                  <Badge tone="muted">Resultado</Badge> {dateTimeLabel(state.at)}
                </p>
              )}
              <div className="space-y-10">
                <PositionalMap r={state.data} playerLabel="Este jugador" footKnown={!!state.foot} />
                <div className="border-t border-line pt-6">
                  <h2 className="mb-5 font-display text-[1.2rem] font-bold text-blanco">Perfil deportivo</h2>
                  <ProfileReadingBlock r={state.data} playerLabel="Este jugador" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
