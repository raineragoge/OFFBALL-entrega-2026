/** Formulario integrado de análisis (económico + ofensivo condicional). */
import type { InputHTMLAttributes, ReactNode } from 'react'
import type { Foot, Position } from '../../api/types'
import { competitionLabel } from '../../domain/competitions'
import type { AnalysisForm, FormErrors, FormField } from '../../domain/form'
import { daysBetween, eurCompact, num, parseEuroInput, per90 } from '../../domain/format'
import { FOOT_LABELS, isOffensiveSub, POSITIONS, positionLabel, subLabel, subShort } from '../../domain/positions'
import { IconLayers, IconPitch } from '../icons'
import { Badge, Field, Segmented, Select, TextInput, cx } from '../ui/primitives'

interface Props {
  form: AnalysisForm
  onChange: (patch: Partial<AnalysisForm>) => void
  errors: FormErrors
  visible: (f: FormField) => boolean
  onBlurField: (f: FormField) => void
  subposiciones: Record<string, string[]>
  competiciones: string[]
  corte: string | null
}

function Section({ n, title, children, aside }: { n: string; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <fieldset className="border-t border-line px-5 py-5 first:border-t-0">
      <legend className="sr-only">{title}</legend>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2.5 text-[0.8rem] font-semibold text-blanco" aria-hidden="true">
          <span className="font-mono text-2xs text-lime">{n}</span>
          {title}
        </p>
        {aside}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-4">{children}</div>
    </fieldset>
  )
}

export function PlayerForm({ form, onChange, errors, visible, onBlurField, subposiciones, competiciones, corte }: Props) {
  const err = (f: FormField) => (visible(f) ? errors[f] : undefined)
  const subs = form.position ? (subposiciones[form.position] ?? []) : []
  const offensive = isOffensiveSub(form.sub_position)
  const m = Number(form.minutos)
  const g90 = form.minutos && form.goles ? per90(Number(form.goles), m) : null
  const a90 = form.minutos && form.asistencias ? per90(Number(form.asistencias), m) : null
  const mv = parseEuroInput(form.market_value_in_eur)
  const days = form.fin_temporada && form.valuation_date ? daysBetween(form.fin_temporada, form.valuation_date) : null

  const input = (f: FormField, extra: InputHTMLAttributes<HTMLInputElement> & { suffix?: string } = {}) => ({
    id: `f-${f}`,
    value: form[f] as string,
    invalid: !!err(f),
    onChange: (e: { target: { value: string } }) => onChange({ [f]: e.target.value } as Partial<AnalysisForm>),
    onBlur: () => onBlurField(f),
    ...extra,
  })

  const sel = (f: FormField) => ({
    id: `f-${f}`,
    value: form[f] as string,
    invalid: !!err(f),
    onChange: (e: { target: { value: string } }) => onChange({ [f]: e.target.value } as Partial<AnalysisForm>),
    onBlur: () => onBlurField(f),
  })

  return (
    <div>
      <Section n="01" title="Identificación" aside={<Badge tone="muted">Sólo en este navegador</Badge>}>
        <Field label="Nombre o referencia" htmlFor="f-nombre" optional className="col-span-2" hint="Nunca se envía a la API. Sirve para reconocer la ficha guardada.">
          <TextInput {...input('nombre', { autoComplete: 'off', placeholder: 'p. ej. Lateral cantera · informe 12' })} />
        </Field>
      </Section>

      <Section n="02" title="Posición y competición">
        <Field label="Posición" htmlFor="f-position" error={err('position')} className="col-span-2">
          <Segmented<Position>
            label="Posición"
            value={form.position}
            invalid={!!err('position')}
            onChange={(v) => {
              const keep = (subposiciones[v] ?? []).includes(form.sub_position)
              onChange({ position: v, sub_position: keep ? form.sub_position : '' })
              onBlurField('position')
            }}
            options={POSITIONS.map((p) => ({ value: p, label: positionLabel(p) }))}
          />
        </Field>
        <Field label="Subposición" htmlFor="f-sub_position" error={err('sub_position')} className="col-span-2 sm:col-span-1">
          <Select {...sel('sub_position')} disabled={!form.position}>
            <option value="">{form.position ? 'Selecciona…' : 'Elige posición'}</option>
            {subs.map((s) => (
              <option key={s} value={s}>
                {subShort(s)} · {subLabel(s)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Competición" htmlFor="f-competition_id" error={err('competition_id')} className="col-span-2 sm:col-span-1">
          <Select {...sel('competition_id')}>
            <option value="">Selecciona…</option>
            {competiciones.map((c) => (
              <option key={c} value={c}>
                {competitionLabel(c)}
              </option>
            ))}
          </Select>
        </Field>
        {form.sub_position && (
          <div className="col-span-2 -mt-1">
            {offensive ? (
              <p className="flex items-center gap-2 text-[0.75rem] text-lime">
                <IconPitch size={14} /> Subposición ofensiva: se calcularán también perfiles GMM y afinidad.
              </p>
            ) : (
              <p className="flex items-center gap-2 text-[0.75rem] text-salvia">
                <IconLayers size={14} /> Sólo valoración económica: el GMM está limitado a DC, SD, EI, ED y MCO.
              </p>
            )}
          </div>
        )}
      </Section>

      <Section n="03" title="Temporada de liga cerrada">
        <Field label="Partidos" htmlFor="f-partidos" error={err('partidos')} hint="1–100">
          <TextInput {...input('partidos', { inputMode: 'numeric', placeholder: '30' })} />
        </Field>
        <Field label="Minutos" htmlFor="f-minutos" error={err('minutos')} hint="450–10.000 · máx. 90 por partido">
          <TextInput {...input('minutos', { inputMode: 'numeric', placeholder: '2100' })} />
        </Field>
        <Field label="Goles" htmlFor="f-goles" error={err('goles')}>
          <TextInput {...input('goles', { inputMode: 'numeric', placeholder: '0' })} />
        </Field>
        <Field label="Asistencias" htmlFor="f-asistencias" error={err('asistencias')}>
          <TextInput {...input('asistencias', { inputMode: 'numeric', placeholder: '0' })} />
        </Field>
        <div className="col-span-2 flex items-center justify-between gap-3 rounded-md border border-dashed border-line-2 px-3 py-2.5">
          <span className="text-2xs text-salvia">Vista previa por 90′ · la API es la autoridad final</span>
          <span className="flex gap-4 font-mono text-[0.8rem] text-blanco tabular">
            <span>
              <span className="text-salvia">G/90 </span>
              {g90 !== null && Number.isFinite(g90) ? num(g90, 2) : '—'}
            </span>
            <span>
              <span className="text-salvia">A/90 </span>
              {a90 !== null && Number.isFinite(a90) ? num(a90, 2) : '—'}
            </span>
          </span>
        </div>
      </Section>

      <Section n="04" title="Contexto económico">
        <Field label="Edad" htmlFor="f-age" error={err('age')} hint="15–45 años">
          <TextInput {...input('age', { inputMode: 'numeric', placeholder: '23' })} />
        </Field>
        <Field
          label="Valor observado"
          htmlFor="f-market_value_in_eur"
          optional
          error={err('market_value_in_eur')}
          hint={mv && !Number.isNaN(mv) ? `= ${eurCompact(mv)} · activa la señal P95` : 'En euros. Sin él no se evalúa la señal P95.'}
        >
          <TextInput {...input('market_value_in_eur', { inputMode: 'decimal', placeholder: '750000', suffix: '€' })} />
        </Field>
        <Field label="Cierre de temporada" htmlFor="f-fin_temporada" error={err('fin_temporada')} hint="Último día de la liga finalizada.">
          <TextInput {...input('fin_temporada', { type: 'date' })} />
        </Field>
        <Field
          label="Fecha de valoración"
          htmlFor="f-valuation_date"
          error={err('valuation_date')}
          hint={days !== null && days >= 1 && days <= 365 ? `${days} días tras el cierre` : 'Entre 1 y 365 días tras el cierre, no futura.'}
        >
          <TextInput {...input('valuation_date', { type: 'date' })} />
        </Field>
        {corte && (
          <p className="col-span-2 -mt-1 font-mono text-2xs text-salvia">
            Corte del dataset: {corte}. Fechas posteriores = extrapolación no validada.
          </p>
        )}
      </Section>

      <div className={cx('grid transition-[grid-template-rows] duration-300 ease-out', offensive ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden" inert={!offensive}>
          <Section n="05" title="Perfil ofensivo" aside={<Badge tone="lime">GMM</Badge>}>
            <Field label="Altura" htmlFor="f-height_in_cm" error={err('height_in_cm')} hint="140–220 cm">
              <TextInput {...input('height_in_cm', { inputMode: 'decimal', placeholder: '183', suffix: 'cm' })} />
            </Field>
            <Field label="Pie dominante" htmlFor="f-foot" optional hint="Ajusta la afinidad, no el perfil.">
              <Select id="f-foot" value={form.foot} onChange={(e) => onChange({ foot: e.target.value as Foot | '' })}>
                <option value="">Sin indicar</option>
                {(['right', 'left', 'both', 'desconocido'] as Foot[]).map((f) => (
                  <option key={f} value={f}>
                    {FOOT_LABELS[f]}
                  </option>
                ))}
              </Select>
            </Field>
          </Section>
        </div>
      </div>
    </div>
  )
}
