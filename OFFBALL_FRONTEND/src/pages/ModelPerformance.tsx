/**
 * Rendimiento de los modelos de regresión: métricas de test publicadas por
 * /api/v1/metadata (metricas_test). Ninguna cifra está fijada en el código.
 */
import type { ReactNode } from 'react'
import type { TestMetricRow } from '../api/types'
import { IconAlert } from '../components/icons'
import { Badge, ErrorState, InfoTip, Meter, PageHeader, Panel, SectionTitle, Skeleton, cx } from '../components/ui/primitives'
import { eurCompact, fractionLabel, ND, num } from '../domain/format'
import { RevealGroup, reveal } from '../motion/components'
import { useApiStatus } from '../state/api-status'
import { selectedMetrics } from '../domain/metrics'

const MODEL_COLORS = ['#b7e68f', '#83b9ce', '#c9a4d3', '#e5c383']

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function MetricGroup({
  title,
  help,
  rows,
  get,
  fmt,
  max,
  better,
  i,
  reference,
}: {
  title: string
  help: ReactNode
  rows: TestMetricRow[]
  get: (r: TestMetricRow) => unknown
  fmt: (v: number) => string
  max: number
  better: 'menor' | 'mayor' | 'cercano a 1'
  i: number
  reference?: number
}) {
  const vals = rows.map(get).filter(isNum)
  if (!vals.length) return null
  const best = better === 'menor' ? Math.min(...vals) : better === 'mayor' ? Math.max(...vals) : vals.reduce((a, b) => (Math.abs(b - 1) < Math.abs(a - 1) ? b : a))
  return (
    <div {...reveal(i)} className="border-line p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[0.86rem] font-semibold text-blanco">
          {title} <InfoTip>{help}</InfoTip>
        </p>
        <span className="text-2xs text-salvia">Mejor: {better}</span>
      </div>
      <div className="space-y-2.5">
        {rows.map((r, k) => {
          const v = get(r)
          return (
            <div key={r.modelo}>
              <div className="mb-1 flex justify-between gap-2 text-[0.76rem]">
                <span className="truncate font-mono text-salvia-2">{r.modelo}</span>
                <span className={cx('font-mono tabular', isNum(v) && v === best ? 'text-lime' : 'text-blanco')}>{isNum(v) ? fmt(v) : ND}</span>
              </div>
              <div className="relative">
                <Meter value={isNum(v) ? v / max : 0} color={MODEL_COLORS[k % MODEL_COLORS.length]} />
                {reference !== undefined && (
                  <span className="absolute -top-1 -bottom-1 w-px bg-salvia-2" style={{ left: `${(reference / max) * 100}%` }} aria-hidden="true" />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ModelPerformancePage() {
  const api = useApiStatus()
  const md = api.metadata.state === 'ok' ? api.metadata.data : null
  const rows = md?.metricas_test ?? []
  const cfg = md?.configuracion
  const sel = selectedMetrics(rows, cfg?.modelos?.general)
  const maxEur = Math.max(1, ...rows.flatMap((r) => [r.MAE_EUR, r.RMSE_EUR]).filter(isNum))
  const maxRatio = Math.max(1.5, ...rows.map((r) => r.ratio_mediano).filter(isNum))

  return (
    <div>
      <PageHeader
        title="Rendimiento del modelo"
        description="Cómo se comportaron los modelos de valoración en el conjunto de test temporal. Las cifras proceden de /api/v1/metadata."
        meta={
          cfg && (
            <>
              <span>
                Entrenamiento hasta <span className="text-salvia-2 tabular">{cfg.train_hasta ?? ND}</span>
              </span>
              <span>
                Test desde <span className="text-salvia-2 tabular">{cfg.test_desde ?? ND}</span>
              </span>
              <span>
                <span className="text-salvia-2 tabular">{isNum(cfg.n_test) ? num(cfg.n_test) : ND}</span> observaciones de test
              </span>
              {sel && <Badge tone="lime">Principal: {sel.modelo}</Badge>}
            </>
          )
        }
      />

      {api.metadata.state === 'loading' && <Skeleton className="h-72" />}
      {api.metadata.state === 'error' && (
        <Panel className="p-5">
          <ErrorState error={api.metadata.error} onRetry={api.retry} />
          <p className="mt-3 text-[0.8rem] text-salvia">Sin metadata no se muestran métricas: OFFBALL no las fija en el código.</p>
        </Panel>
      )}

      {md && rows.length === 0 && <p className="text-sm text-salvia">La API no publica métricas de test.</p>}

      {md && rows.length > 0 && (
        <div className="space-y-10">
          <section>
            <SectionTitle title="Error en euros" description="Distancia entre la estimación y el valor observado. Escala común desde 0 € para ambos indicadores." />
            <RevealGroup className="grid overflow-hidden rounded-[var(--radius-card)] border border-line bg-panel md:grid-cols-2 md:[&>*+*]:border-l max-md:[&>*+*]:border-t">
              <MetricGroup i={0} title="MAE" help="Error absoluto medio: cuántos euros se equivoca de media el modelo." rows={rows} get={(r) => r.MAE_EUR} fmt={eurCompact} max={maxEur} better="menor" />
              <MetricGroup i={1} title="RMSE" help="Raíz del error cuadrático medio: penaliza más los errores grandes (jugadores caros)." rows={rows} get={(r) => r.RMSE_EUR} fmt={eurCompact} max={maxEur} better="menor" />
            </RevealGroup>
          </section>

          <section>
            <SectionTitle title="Ajuste y sesgo" />
            <RevealGroup className="grid overflow-hidden rounded-[var(--radius-card)] border border-line bg-panel md:grid-cols-2 md:[&>*+*]:border-l max-md:[&>*+*]:border-t">
              <MetricGroup i={0} title="R²" help="Proporción de la variación del valor que explica el modelo (1 = perfecto)." rows={rows} get={(r) => r.R2} fmt={(v) => num(v, 3)} max={1} better="mayor" />
              <MetricGroup
                i={1}
                title="Ratio mediano"
                help="Mediana de estimado / observado. 1 = sin sesgo; mayor que 1 sobreestima, menor que 1 infraestima. La línea vertical marca 1."
                rows={rows}
                get={(r) => r.ratio_mediano}
                fmt={(v) => `${num(v, 3)}×`}
                max={maxRatio}
                better="cercano a 1"
                reference={1}
              />
            </RevealGroup>
          </section>

          <section>
            <SectionTitle title="Clasificación por umbral de valor" description="¿Acierta el modelo al decir si un jugador vale más de 1 M€ o de 5 M€? Escala 0–100 %." />
            <RevealGroup className="grid overflow-hidden rounded-[var(--radius-card)] border border-line bg-panel md:grid-cols-3 md:[&>*+*]:border-l max-md:[&>*+*]:border-t">
              {(['1M', '5M'] as const).flatMap((t, ti) =>
                (['precision', 'recall', 'f1'] as const).map((m, mi) => (
                  <MetricGroup
                    key={`${m}_${t}`}
                    i={ti * 3 + mi}
                    title={`${{ precision: 'Precisión', recall: 'Recall', f1: 'F1' }[m]} · ${t === '1M' ? '1 M€' : '5 M€'}`}
                    help={
                      {
                        precision: 'De los jugadores que el modelo sitúa por encima del umbral, qué porcentaje lo está realmente.',
                        recall: 'De los jugadores que realmente superan el umbral, qué porcentaje detecta el modelo.',
                        f1: 'Media armónica de precisión y recall.',
                      }[m]
                    }
                    rows={rows}
                    get={(r) => r[`${m}_${t}`]}
                    fmt={(v) => fractionLabel(v, 0)}
                    max={1}
                    better="mayor"
                  />
                )),
              )}
            </RevealGroup>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <Panel className="p-5">
              <p className="text-[0.9rem] font-semibold text-blanco">Cómo leer estas cifras</p>
              <ul className="mt-3 space-y-2.5 text-[0.82rem] leading-relaxed text-salvia-2">
                <li>El test es temporal: el modelo se evalúa con temporadas posteriores a las de entrenamiento.</li>
                <li>Un modelo puede tener mejor MAE y peor RMSE: el RMSE castiga más los errores en jugadores caros.</li>
                <li>Las métricas son globales: no garantizan la precisión de una estimación concreta.</li>
              </ul>
            </Panel>
            <Panel className="p-5">
              <p className="flex items-center gap-2 text-[0.9rem] font-semibold text-blanco">
                <IconAlert size={15} className="text-gold" /> Límites
              </p>
              <ul className="mt-3 space-y-2.5 text-[0.82rem] leading-relaxed text-salvia-2">
                <li>La API no publica residuos de test por jugador ni intervalos de predicción: no se dibujan.</li>
                <li>No hay métricas del GMM ni de K-Means en la API v0.1.0.</li>
                <li>Las predicciones no son precios de traspaso ni garantías de inversión.</li>
              </ul>
            </Panel>
          </section>
        </div>
      )}
    </div>
  )
}
