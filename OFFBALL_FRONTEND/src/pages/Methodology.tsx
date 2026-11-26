import type { ReactNode } from 'react'
import type { TestMetricRow } from '../api/types'
import { IconAlert } from '../components/icons'
import { Badge, ErrorState, KeyValue, PageHeader, Panel, PanelHeader, Skeleton } from '../components/ui/primitives'
import { dateLabel, eurCompact, fractionLabel, ND, num } from '../domain/format'
import { zoneDisplayName } from '../domain/zones'
import { useApiStatus } from '../state/api-status'
import { Link } from '../router/router'
import { useMode } from '../state/prefs'

const METRIC_COLS: { key: keyof TestMetricRow; label: string; fmt: (v: unknown) => string; hint?: string }[] = [
  { key: 'n', label: 'n', fmt: (v) => (typeof v === 'number' ? num(v) : ND) },
  { key: 'MAE_EUR', label: 'MAE', fmt: (v) => (typeof v === 'number' ? eurCompact(v) : ND), hint: 'Error absoluto medio' },
  { key: 'RMSE_EUR', label: 'RMSE', fmt: (v) => (typeof v === 'number' ? eurCompact(v) : ND) },
  { key: 'R2', label: 'R²', fmt: (v) => (typeof v === 'number' ? num(v, 3) : ND) },
  { key: 'ratio_mediano', label: 'Ratio mediano', fmt: (v) => (typeof v === 'number' ? num(v, 3) : ND), hint: 'Mediana estimado/observado' },
  { key: 'precision_1M', label: 'Precisión 1M', fmt: (v) => (typeof v === 'number' ? fractionLabel(v) : ND) },
  { key: 'recall_1M', label: 'Recall 1M', fmt: (v) => (typeof v === 'number' ? fractionLabel(v) : ND) },
  { key: 'f1_1M', label: 'F1 1M', fmt: (v) => (typeof v === 'number' ? fractionLabel(v) : ND) },
  { key: 'precision_5M', label: 'Precisión 5M', fmt: (v) => (typeof v === 'number' ? fractionLabel(v) : ND) },
  { key: 'recall_5M', label: 'Recall 5M', fmt: (v) => (typeof v === 'number' ? fractionLabel(v) : ND) },
  { key: 'f1_5M', label: 'F1 5M', fmt: (v) => (typeof v === 'number' ? fractionLabel(v) : ND) },
]

function Step({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <div className="border-t border-line pt-4">
      <p className="font-mono text-2xs text-lime">{n}</p>
      <h3 className="mt-1.5 text-[0.95rem] font-semibold text-blanco">{title}</h3>
      <div className="mt-2 text-[0.84rem] leading-relaxed text-salvia-2">{children}</div>
    </div>
  )
}

export function MethodologyPage() {
  const api = useApiStatus()
  const { advanced } = useMode()
  const md = api.metadata.state === 'ok' ? api.metadata.data : null
  const cfg = md?.configuracion
  const selected = cfg?.modelos?.general

  const bands = cfg?.rango_valor_eur
  const bandText =
    Array.isArray(bands) && bands.length >= 3
      ? `menos de ${eurCompact(bands[1])}, entre ${eurCompact(bands[1])} y ${eurCompact(bands[2])}, y ${eurCompact(bands[2])} o más`
      : null

  return (
    <div>
      <PageHeader
        title="Metodología y limitaciones"
        description="Qué modelos responden en OFFBALL, cómo se validaron y qué no pueden afirmar. Las cifras de esta página provienen de /api/v1/metadata."
      />

      <Panel className="mb-6">
        <PanelHeader eyebrow="Integridad de los datos" title="Qué es real, qué es estimado y qué no existe" />
        <div className="grid gap-px bg-line md:grid-cols-3">
          {[
            {
              t: 'Real (de la API)',
              c: 'text-lime',
              d: 'Valor estimado G02 y referencia G01, residuo y umbral P95, probabilidades de los cinco perfiles GMM, afinidad por zona, catálogo de alertas y métricas de test.',
            },
            {
              t: 'Representación estimada',
              c: 'text-gold',
              d: 'El mapa táctico: coloca cada rol (DC, EI, ED, MCO) en su área convencional y lo colorea según su afinidad. El modo difuminado suaviza esas mismas cuatro cifras.',
            },
            {
              t: 'No disponible en API v0.1.0',
              c: 'text-coral',
              d: 'Coordenadas y eventos espaciales (pases, tiros, recuperaciones), secuencias temporales, asignaciones y métricas de K-Means, medias por clúster y distribuciones de la liga para percentiles.',
            },
          ].map((x) => (
            <div key={x.t} className="bg-panel p-5">
              <p className={`text-[0.86rem] font-semibold ${x.c}`}>{x.t}</p>
              <p className="mt-2 text-[0.82rem] leading-relaxed text-salvia-2">{x.d}</p>
            </div>
          ))}
        </div>
        <p className="border-t border-line px-5 py-3 text-2xs text-salvia">
          Los filtros por tipo de acción y las reproducciones cronológicas no se han implementado porque no existen datos que los respalden.
        </p>
      </Panel>

      {api.metadata.state === 'loading' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      )}
      {api.metadata.state === 'error' && (
        <Panel className="mb-6 p-5">
          <ErrorState error={api.metadata.error} onRetry={api.retry} />
          <p className="mt-3 text-[0.8rem] text-salvia">Sin metadata no se muestran métricas: OFFBALL no las fija en el código.</p>
        </Panel>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHeader eyebrow="Proceso" title="De los datos a la señal" />
          <div className="grid gap-5 p-5 sm:grid-cols-2">
            <Step n="01" title="Valoración económica · G02">
              Regresión general sobre escala logarítmica{selected ? <> (<span className="font-mono text-blanco">{selected}</span>)</> : null},
              seleccionada en validación para uso general y económico. Variables: {cfg?.features?.join(', ') ?? ND}.
            </Step>
            <Step n="02" title="Referencia directa · G01">
              Modelo directo sobre euros, mostrado sólo como referencia junto a la estimación principal. Sus métricas de test aparecen en la
              tabla inferior; no sustituye a G02.
            </Step>
            <Step n="03" title="Señal P95">
              Residuo logarítmico log(estimación / observado) comparado con el percentil {cfg?.percentil ?? 95} calibrado por posición y rango de
              valor{bandText ? ` (${bandText})` : ''}; si no hay umbral específico se usa el global. Indica posible infravaloración, no
              probabilidad de éxito.
            </Step>
            <Step n="04" title="Perfiles ofensivos · GMM K=5">
              Mezcla gaussiana con cinco componentes sobre goles/90, asistencias/90 y altura. La afinidad por zona combina las probabilidades con
              una matriz perfil×zona, un factor por pie y corrección por prior.
            </Step>
          </div>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Configuración" title="Datos y validación" action={cfg?.version ? <Badge tone="neutral">{cfg.version}</Badge> : undefined} />
          <div className="px-5 pb-2">
            <KeyValue
              items={[
                { k: 'Corte de datos', v: cfg?.corte_datos ? dateLabel(cfg.corte_datos) : ND },
                { k: 'Entrenamiento hasta', v: cfg?.train_hasta ?? ND },
                { k: 'Test desde', v: cfg?.test_desde ?? ND },
                { k: 'Observaciones de test', v: typeof cfg?.n_test === 'number' ? num(cfg.n_test) : ND },
                { k: 'Minutos mínimos', v: typeof cfg?.min_minutos === 'number' ? num(cfg.min_minutos) : ND },
                { k: 'Máx. días estadísticas → valoración', v: cfg?.max_dias_stats ?? ND },
                { k: 'Competiciones', v: cfg?.categorias_entrenamiento?.competition_id?.length ?? ND },
                { k: 'Candidatos vigentes en catálogo', v: typeof cfg?.n_candidatos === 'number' ? num(cfg.n_candidatos) : ND },
                { k: 'scikit-learn / semilla', v: cfg ? `${cfg.sklearn ?? ND} · ${cfg.seed ?? ND}` : ND },
              ]}
            />
          </div>
        </Panel>
      </div>

      {!advanced && (
        <p className="mt-6 text-[0.84rem] text-salvia-2">
          Las métricas de test detalladas están en{' '}
          <Link to="/rendimiento" className="font-semibold text-lime underline decoration-lime/40 underline-offset-4">
            Rendimiento del modelo
          </Link>
          .
        </p>
      )}
      {advanced && (
      <Panel className="mt-6">
        <PanelHeader eyebrow="Métricas de test" title="Rendimiento global en el conjunto de test" />
        {md && md.metricas_test.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] border-collapse text-sm [&_td]:whitespace-nowrap">
              <thead>
                <tr className="border-b border-line text-[0.72rem] text-salvia">
                  <th scope="col" className="px-5 py-3 text-left font-medium">Modelo</th>
                  {METRIC_COLS.map((c) => (
                    <th key={c.key} scope="col" className="px-3 py-3 text-right font-medium" title={c.hint}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {md.metricas_test.map((r) => (
                  <tr key={r.modelo} className="border-b border-line last:border-b-0">
                    <th scope="row" className="px-5 py-3 text-left font-mono text-[0.8rem] font-medium">
                      <span className={r.modelo === selected ? 'text-lime' : 'text-blanco'}>{r.modelo}</span>
                      {r.modelo === selected && <Badge tone="lime" className="ml-2">Seleccionado</Badge>}
                    </th>
                    {METRIC_COLS.map((c) => (
                      <td key={c.key} className="px-3 py-3 text-right font-mono text-[0.8rem] text-blanco tabular">
                        {c.fmt(r[c.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-5 text-sm text-salvia">{api.metadata.state === 'loading' ? 'Cargando…' : 'Métricas no disponibles.'}</p>
        )}
        <p className="border-t border-line px-5 py-3 text-2xs text-salvia">
          1M y 5M: métricas de clasificación por umbral de valor (1 M€ y 5 M€) tal como las publica la API. Las métricas globales no garantizan
          precisión individual.
        </p>
      </Panel>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader eyebrow="GMM K=5" title="Perfiles y zonas" />
          <div className="grid gap-6 p-5 sm:grid-cols-2">
            <div>
              <p className="eyebrow mb-3 text-lavender">Perfiles</p>
              <ol className="space-y-2 text-[0.84rem]">
                {(md?.perfiles ?? []).map((p, i) => (
                  <li key={p} className="flex gap-3">
                    <span className="font-mono text-2xs leading-5 text-salvia">C{i}</span>
                    <span className="text-blanco">{p}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <p className="eyebrow mb-3 text-lime">Zonas de afinidad</p>
              <ul className="space-y-2 text-[0.84rem] text-blanco">
                {(md?.zonas ?? []).map((z) => (
                  <li key={z}>{zoneDisplayName(z)}</li>
                ))}
              </ul>
            </div>
          </div>
          {md?.nota && <p className="border-t border-line px-5 py-3 text-[0.8rem] text-salvia-2">{md.nota}</p>}
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Límites" title="Lo que OFFBALL no afirma" />
          <ul className="space-y-3 p-5 text-[0.84rem] leading-relaxed text-salvia-2">
            {[
              'Las estimaciones son estadísticas: no son precio de traspaso, ni garantía de rentabilidad o rendimiento.',
              'No hay métricas específicas de porteros ni de rendimiento defensivo: la valoración de esas posiciones es menos informativa.',
              'La selección de K=5 tiene estabilidad moderada y una componente con varianza reducida (sin asistencias registradas): no se promete certeza táctica.',
              'La afinidad es relativa y estadística: no son mapas de movimientos observados ni prueba la mejor posición real.',
              'Los datos introducidos por el usuario no se verifican externamente.',
              'El catálogo de mercado es histórico; la vigencia es relativa al corte del dataset y no acredita disponibilidad de fichaje.',
            ].map((t) => (
              <li key={t} className="flex gap-3">
                <IconAlert size={15} className="mt-0.5 shrink-0 text-gold" />
                {t}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  )
}
