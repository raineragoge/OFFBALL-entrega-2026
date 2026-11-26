import type { EconomicResult } from '../../api/types'
import { ALERT_LABEL, alertExplanation, alertState, valueSentence } from '../../domain/analysis'
import { eurCompact, eurFull, eurSigned, num, pctPoints } from '../../domain/format'
import { AnimatedNumber } from '../../motion/components'
import { useMode } from '../../state/prefs'
import { IconAlert, IconCheck, IconInfo } from '../icons'
import { ResidualGauge, ValueChart } from '../charts/ValueChart'
import { Badge, InfoTip, cx } from '../ui/primitives'

export function AlertBadge({ result, size = 'md' }: { result: Pick<EconomicResult, 'alerta_economica'>; size?: 'sm' | 'md' }) {
  const s = alertState(result)
  const tone = s === 'posible' ? 'lime' : s === 'sin_alerta' ? 'blue' : 'muted'
  const Icon = s === 'posible' ? IconAlert : s === 'sin_alerta' ? IconCheck : IconInfo
  return (
    <Badge tone={tone} className={size === 'md' ? 'h-7 px-2.5 text-[0.78rem]' : undefined}>
      <Icon size={size === 'md' ? 14 : 12} />
      {ALERT_LABEL[s]}
    </Badge>
  )
}

/**
 * Veredicto económico: tres cifras clave (observado, estimado, diferencia)
 * con contadores y, en modo Esencial, una frase en lenguaje llano.
 */
export function ValueVerdict({ r }: { r: EconomicResult }) {
  const { advanced } = useMode()
  const diffTone = r.diferencia_eur === null ? 'text-salvia' : r.diferencia_eur >= 0 ? 'text-lime' : 'text-coral'
  return (
    <div>
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line sm:grid-cols-3">
        <div className="bg-panel p-5">
          <p className="flex items-center gap-2 text-[0.78rem] font-medium text-salvia">
            <span className="size-2 rounded-[2px] bg-gold" /> Valor observado
          </p>
          <p className={cx('mt-2 font-mono text-[2rem] leading-none tracking-[-0.02em]', r.valor_observado_eur === null ? 'text-salvia-2' : 'text-gold')}>
            <AnimatedNumber value={r.valor_observado_eur} format={eurCompact} />
          </p>
          <p className="mt-2 text-[0.75rem] text-salvia tabular">{r.valor_observado_eur === null ? 'No aportado' : eurFull(r.valor_observado_eur)}</p>
        </div>
        <div className="relative bg-panel p-5">
          <span className="absolute inset-x-0 top-0 h-[2px] bg-lime" aria-hidden="true" />
          <p className="flex items-center gap-2 text-[0.78rem] font-medium text-salvia">
            <span className="size-2 rounded-[2px] bg-lime" /> Valor estimado
            <InfoTip>Estimación del modelo general G02 (regresión sobre escala logarítmica). Es una estimación estadística, no un precio de traspaso.</InfoTip>
          </p>
          <p className="mt-2 font-mono text-[2rem] leading-none tracking-[-0.02em] text-lime">
            <AnimatedNumber value={r.valor_estimado_eur} format={eurCompact} />
          </p>
          <p className="mt-2 text-[0.75rem] text-salvia tabular">{eurFull(r.valor_estimado_eur)}</p>
        </div>
        <div className="bg-panel p-5">
          <p className="text-[0.78rem] font-medium text-salvia">Diferencia (estimado − observado)</p>
          <p className={cx('mt-2 font-mono text-[2rem] leading-none tracking-[-0.02em]', diffTone)}>
            <AnimatedNumber value={r.diferencia_eur} format={eurSigned} />
          </p>
          <p className={cx('mt-2 text-[0.75rem] tabular', diffTone)}>{r.diferencia_eur === null ? 'Requiere valor observado' : pctPoints(r.diferencia_pct)}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-start gap-3">
        <AlertBadge result={r} />
        {!advanced && <p className="min-w-0 flex-1 basis-80 text-[0.9rem] leading-relaxed text-salvia-2">{valueSentence(r, eurCompact)}</p>}
      </div>
    </div>
  )
}

/** Detalle de la valoración: barras en escala común y señal P95. */
export function EconomicDetail({ r }: { r: EconomicResult }) {
  const { advanced } = useMode()
  const s = alertState(r)
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div>
        <h3 className="mb-3 text-[0.9rem] font-semibold text-blanco">Valor en una escala común</h3>
        <ValueChart
          caption="Escala lineal desde 0 €, igual para las tres barras. Pasa el cursor por una barra para ver el importe exacto."
          bars={[
            { key: 'obs', label: 'Observado', sublabel: 'mercado', value: r.valor_observado_eur, color: 'var(--color-gold)' },
            { key: 'g02', label: 'Estimado', sublabel: 'modelo G02', value: r.valor_estimado_eur, color: 'var(--color-lime)' },
            ...(advanced ? [{ key: 'g01', label: 'Referencia', sublabel: 'modelo G01', value: r.referencia_directa_eur, color: 'var(--color-blue)' }] : []),
          ]}
        />
      </div>
      <div>
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-[0.9rem] font-semibold text-blanco">Señal de posible infravaloración</h3>
          <InfoTip>
            Compara el residuo logarítmico log(estimación / observado) con el percentil 95 calibrado por posición y rango de valor (o el umbral global si no hay uno
            específico). No es una probabilidad de éxito.
          </InfoTip>
        </div>
        <p className="text-[0.84rem] leading-relaxed text-salvia-2">{alertExplanation(r)}</p>
        {r.residuo_log !== null && r.umbral_p95 !== null && (
          <div className="mt-4">
            <ResidualGauge residuo={r.residuo_log} umbral={r.umbral_p95} />
            {advanced && (
              <dl className="mt-3 grid grid-cols-3 gap-4 font-mono text-[0.8rem] tabular">
                <div>
                  <dt className="font-sans text-2xs text-salvia">Residuo log</dt>
                  <dd className={s === 'posible' ? 'text-lime' : 'text-blanco'}>{num(r.residuo_log, 3)}</dd>
                </div>
                <div>
                  <dt className="font-sans text-2xs text-salvia">Umbral P95</dt>
                  <dd className="text-blanco">{num(r.umbral_p95, 3)}</dd>
                </div>
                <div>
                  <dt className="font-sans text-2xs text-salvia">Exceso</dt>
                  <dd className="text-blanco">{num(r.residuo_log - r.umbral_p95, 3)}</dd>
                </div>
              </dl>
            )}
          </div>
        )}
        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 text-[0.8rem]">
          <div>
            <dt className="text-2xs text-salvia">Rango de valor</dt>
            <dd className="mt-0.5 text-blanco">{r.rango ?? 'N/D'}</dd>
          </div>
          {advanced && (
            <div>
              <dt className="text-2xs text-salvia">Modelo</dt>
              <dd className="mt-0.5 font-mono text-blanco">{r.modelo}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  )
}

export function RatiosPanel({ r, preview }: { r: EconomicResult | null; preview: { g: number | null; a: number | null } }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-btn)] border border-line bg-line">
      {[
        { label: 'Goles por 90 min', api: r?.goles_90 ?? null, local: preview.g },
        { label: 'Asistencias por 90 min', api: r?.asistencias_90 ?? null, local: preview.a },
      ].map((x) => (
        <div key={x.label} className="bg-panel p-4">
          <p className="text-[0.75rem] text-salvia">{x.label}</p>
          <p className="mt-1 font-mono text-xl text-blanco">
            <AnimatedNumber value={x.api ?? x.local} format={(v) => num(v, 2)} />
          </p>
          <p className="mt-1 text-2xs text-salvia">{x.api !== null ? 'Calculado por la API' : 'Vista previa local'}</p>
        </div>
      ))}
    </div>
  )
}

export function Warnings({ items, title = 'Advertencias del modelo' }: { items: string[]; title?: string }) {
  if (!items.length) return null
  return (
    <div className="rounded-[var(--radius-btn)] border border-gold/30 bg-gold/[0.04] p-4">
      <p className="mb-2.5 text-[0.8rem] font-semibold text-gold">{title}</p>
      <ul className="space-y-2">
        {items.map((w, i) => (
          <li key={i} className="flex gap-2.5 text-[0.82rem] leading-relaxed text-salvia-2">
            <IconAlert size={14} className="mt-0.5 shrink-0 text-gold" />
            {w}
          </li>
        ))}
      </ul>
    </div>
  )
}
