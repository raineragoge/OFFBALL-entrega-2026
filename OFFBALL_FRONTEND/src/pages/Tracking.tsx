import {Shortlist} from '../components/market/Shortlist'
import { useMemo, useRef, useState } from 'react'
import { AlertBadge } from '../components/analysis/Economic'
import { IconBookmark, IconColumns, IconDownload, IconRefresh, IconSearch, IconTrash, IconUpload } from '../components/icons'
import { Badge, Button, EmptyState, Notice, PageHeader, Panel, Segmented, TextInput, cx } from '../components/ui/primitives'
import { useToast } from '../components/ui/toast'
import { toComparable } from '../domain/compare'
import { competitionShort } from '../domain/competitions'
import { downloadText, stamp } from '../domain/download'
import { dateLabel, dateTimeLabel, eurCompact, num, pctPoints } from '../domain/format'
import { toCsv } from '../domain/market'
import { subLabel, subShort } from '../domain/positions'
import { nearest, vectorFor, SIMILARITY_FEATURES } from '../domain/similarity'
import { Link, navigate } from '../router/router'
import { useCompare, useSaved } from '../state/saved'
import { exportJson, SCHEMA_VERSION, type ManualItem, type SavedItem } from '../state/storage'

type Filter = 'todos' | 'manual' | 'catalogo'

export function TrackingPage() {
  const saved = useSaved()
  const compare = useCompare()
  const toast = useToast()
  const [filter, setFilter] = useState<Filter>('todos')
  const [text, setText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const items = useMemo(() => {
    const t = text.trim().toLowerCase()
    return saved.items.filter((i) => {
      if (filter !== 'todos' && i.origen !== filter) return false
      if (!t) return true
      const c = toComparable(i)
      return [c.nombre, i.notas, c.sub_position, c.competition_id, subLabel(c.sub_position)].some((s) => s?.toLowerCase().includes(t))
    })
  }, [saved.items, filter, text])

  const counts = { manual: saved.items.filter((i) => i.origen === 'manual').length, catalogo: saved.items.filter((i) => i.origen === 'catalogo').length }

  const exportBackup = () => downloadText(`offball-seguimiento-${stamp()}.json`, exportJson({ version: SCHEMA_VERSION, items: saved.items }), 'application/json')
  const exportCsv = () => {
    const rows: unknown[][] = [
      ['# OFFBALL · Seguimiento (almacenado en este navegador)'],
      ['# exportado_en', new Date().toISOString()],
      ['# alcance', `${items.length} fichas (filtro: ${filter}${text ? `, búsqueda "${text}"` : ''})`],
      [],
      ['id', 'origen', 'nombre', 'position', 'sub_position', 'competition_id', 'edad', 'minutos', 'valor_observado_eur', 'valor_estimado_eur', 'referencia_g01_eur', 'diferencia_pct', 'alerta_p95', 'mejor_zona', 'fecha_valoracion', 'fin_temporada', 'modelo', 'corte_datos', 'guardado_en', 'notas'],
      ...items.map((i) => {
        const c = toComparable(i)
        return [c.id, c.origen, c.nombre, c.position, c.sub_position, c.competition_id, c.edad, c.minutos, c.observado, c.estimado, c.referenciaG01, c.diferenciaPct, c.alerta, c.mejorZona, c.fechaValoracion, c.finTemporada, c.modelo, c.corte, i.guardadoEn, i.notas]
      }),
    ]
    downloadText(`offball-seguimiento-${stamp()}.csv`, toCsv(rows), 'text/csv;charset=utf-8')
  }

  const onImport = async (file: File) => {
    try {
      const r = saved.importBackup(await file.text())
      toast(`Importadas ${r.added} fichas${r.skipped ? ` · ${r.skipped} omitidas (duplicadas o no válidas)` : ''}.`)
    } catch (e) {
      toast(`No se pudo importar: ${e instanceof Error ? e.message : 'archivo no válido'}`, 'warn')
    }
  }

  return (
    <div>
      <Shortlist/>
      <PageHeader
        title="Seguimiento"
        description="Tu lista de candidatos. Se almacena únicamente en este navegador (localStorage, esquema v1): no hay cuenta ni servidor. Exporta una copia si cambias de equipo o navegador."
        actions={
          <>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
            <Button variant="ghost" icon={<IconUpload size={15} />} onClick={() => fileRef.current?.click()}>
              Importar copia
            </Button>
            <Button variant="ghost" icon={<IconDownload size={15} />} disabled={!items.length} onClick={exportCsv}>
              CSV
            </Button>
            <Button variant="secondary" icon={<IconDownload size={15} />} disabled={!saved.items.length} onClick={exportBackup}>
              Copia JSON
            </Button>
          </>
        }
      />

      {saved.items.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<IconBookmark size={20} />}
            title="Aún no sigues a ningún jugador"
            action={
              <>
                <Link to="/analizar" className="text-sm font-semibold text-lime underline underline-offset-4">
                  Analizar jugador
                </Link>
                <Link to="/mercado" className="text-sm font-semibold text-salvia-2 underline underline-offset-4">
                  Explorar mercado
                </Link>
              </>
            }
          >
            Guarda análisis manuales o fichas del catálogo histórico para anotarlas, compararlas y recuperarlas más tarde.
          </EmptyState>
        </Panel>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="w-full sm:w-80">
              <Segmented<Filter>
                label="Filtrar por origen"
                size="sm"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'todos', label: `Todos · ${saved.items.length}` },
                  { value: 'manual', label: `Manual · ${counts.manual}` },
                  { value: 'catalogo', label: `Catálogo · ${counts.catalogo}` },
                ]}
              />
            </div>
            <div className="relative w-full sm:w-72">
              <IconSearch size={15} className="pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 text-salvia" />
              <TextInput id="t-buscar" aria-label="Buscar en seguimiento" placeholder="Buscar nombre, nota, posición…" value={text} onChange={(e) => setText(e.target.value)} className="pl-9" />
            </div>
          </div>

          {items.length === 0 ? (
            <Panel>
              <EmptyState title="Ninguna ficha coincide con el filtro" />
            </Panel>
          ) : (
            <ul className="grid gap-4 lg:grid-cols-2">
              {items.map((i) => (
                <TrackedCard
                  key={i.id}
                  item={i}
                  inCompare={compare.ids.includes(i.id)}
                  onCompare={() => {
                    const r = compare.toggle(i.id)
                    if (r.full) toast('El comparador ya tiene 3 fichas.', 'warn')
                  }}
                  onRemove={() => {
                    saved.remove(i.id)
                    toast('Ficha eliminada de seguimiento.')
                  }}
                  onNotes={(v) => saved.setNotes(i.id, v)}
                  pool={saved.items}
                />
              ))}
            </ul>
          )}

          <SimilarityNote />
        </>
      )}
    </div>
  )
}

function TrackedCard({
  item,
  inCompare,
  onCompare,
  onRemove,
  onNotes,
  pool,
}: {
  item: SavedItem
  inCompare: boolean
  onCompare: () => void
  onRemove: () => void
  onNotes: (v: string) => void
  pool: SavedItem[]
}) {
  const c = toComparable(item)
  const [confirm, setConfirm] = useState(false)
  const [notes, setNotes] = useState(item.notas)
  const [showSim, setShowSim] = useState(false)
  return (
    <li>
      <Panel as="article" className="flex h-full flex-col">
        <div className="flex items-start gap-4 p-5">
          <div className="grid size-11 shrink-0 place-items-center rounded-full border border-line-2 bg-noche-2 font-mono text-2xs text-salvia-2">{subShort(c.sub_position)}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-display text-base font-extrabold text-blanco">{c.nombre}</h3>
              <Badge tone={c.origen === 'manual' ? 'blue' : 'gold'}>{c.origen === 'manual' ? 'Manual' : 'Catálogo histórico'}</Badge>
            </div>
            <p className="mt-1 text-[0.78rem] text-salvia">
              {subLabel(c.sub_position)} · {competitionShort(c.competition_id)} · {c.edad === null ? 'N/D' : `${num(c.edad)} años${c.edadEsHistorica ? ' (hist.)' : ''}`}
            </p>
            <p className="mt-1 font-mono text-2xs text-salvia">
              {c.origen === 'manual' && c.analizadoEn ? `Analizado ${dateTimeLabel(c.analizadoEn)}` : `Valoración ${dateLabel(c.fechaValoracion)}`} · Guardado{' '}
              {dateTimeLabel(item.guardadoEn)}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-px border-y border-line bg-line">
          {[
            { l: 'Observado', v: eurCompact(c.observado), cls: 'text-gold' },
            { l: 'Estimación', v: eurCompact(c.estimado), cls: 'text-lime' },
            { l: 'Diferencia', v: pctPoints(c.diferenciaPct, 0), cls: 'text-blanco' },
          ].map((x) => (
            <div key={x.l} className="bg-panel px-5 py-3">
              <p className="text-2xs text-salvia">{x.l}</p>
              <p className={cx('mt-0.5 font-mono text-[0.95rem] tabular', x.v === 'N/D' ? 'text-salvia/70' : x.cls)}>{x.v}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <AlertBadge result={{ alerta_economica: c.alerta }} size="sm" />
            {c.mejorZona && <Badge tone="lime">Mejor zona: {c.mejorZona}</Badge>}
            {c.perfilDominante && <Badge tone="lavender">{c.perfilDominante.nombre}</Badge>}
          </div>
          <label className="block">
            <span className="sr-only">Notas de {c.nombre}</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => notes !== item.notas && onNotes(notes)}
              placeholder="Notas de scouting (opcional)…"
              rows={2}
              className="w-full resize-y rounded-md border border-line bg-noche-2 px-3 py-2 text-[0.82rem] text-blanco placeholder:text-salvia/70 focus:border-lime focus:ring-2 focus:ring-lime/25 focus:outline-none"
            />
          </label>
          {showSim && item.origen === 'manual' && <SimilarList item={item} pool={pool} />}
        </div>
        <div className="flex flex-wrap items-center gap-1 border-t border-line px-3 py-2">
          {item.origen === 'manual' && (
            <Button variant="ghost" size="sm" icon={<IconRefresh size={14} />} onClick={() => navigate(`/analizar?id=${encodeURIComponent(item.id)}`)}>
              Recuperar
            </Button>
          )}
          <Button variant="ghost" size="sm" icon={<IconColumns size={14} />} onClick={onCompare} className={inCompare ? 'text-lime' : undefined}>
            {inCompare ? 'En comparador' : 'Comparar'}
          </Button>
          {item.origen === 'manual' && (
            <Button variant="ghost" size="sm" onClick={() => setShowSim((s) => !s)} aria-expanded={showSim}>
              Similares (local)
            </Button>
          )}
          <div className="ml-auto">
            {confirm ? (
              <span className="flex items-center gap-1">
                <Button variant="danger" size="sm" onClick={onRemove}>
                  Confirmar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
                  No
                </Button>
              </span>
            ) : (
              <Button variant="ghost" size="sm" icon={<IconTrash size={14} />} onClick={() => setConfirm(true)} aria-label={`Eliminar ${c.nombre}`}>
                Eliminar
              </Button>
            )}
          </div>
        </div>
      </Panel>
    </li>
  )
}

function SimilarList({ item, pool }: { item: ManualItem; pool: SavedItem[] }) {
  const target = vectorFor(item)
  const vectors = pool.filter((p): p is ManualItem => p.origen === 'manual').map(vectorFor).filter((v): v is NonNullable<typeof v> => !!v)
  if (!target)
    return <Notice>Esta ficha no tiene todas las variables necesarias (incluida la altura), así que no participa en la exploración local.</Notice>
  const res = nearest(target, vectors, 3)
  if (!res.length)
    return <Notice>Se necesitan al menos 3 análisis manuales completos guardados para explorar similitudes.</Notice>
  const byId = new Map(pool.map((p) => [p.id, p]))
  return (
    <div className="rounded-md border border-line bg-noche-2 p-3">
      <p className="eyebrow mb-2 text-salvia">Más próximos en tus fichas · exploración local</p>
      <ol className="space-y-1.5 text-[0.82rem]">
        {res.map((r) => {
          const p = byId.get(r.id)
          return (
            <li key={r.id} className="flex justify-between gap-3">
              <span className="truncate text-blanco">{p && p.origen === 'manual' ? p.nombre || 'Análisis sin nombre' : r.id}</span>
              <span className="shrink-0 font-mono text-salvia tabular">d = {num(r.distance, 2)}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function SimilarityNote() {
  return (
    <details className="mt-8 rounded-md border border-line bg-panel px-5 py-4 text-[0.82rem] text-salvia-2">
      <summary className="cursor-pointer font-semibold text-blanco">Cómo funciona «Similares (local)»</summary>
      <p className="mt-3 leading-relaxed">
        No existe un endpoint de similitud en OFFBALL API v0.1.0. Esta exploración usa sólo los análisis manuales guardados en este navegador
        con todas las variables ({SIMILARITY_FEATURES.join(', ')}). Cada variable se estandariza (z-score) con la media y desviación del
        propio conjunto, y se calcula la distancia euclídea. No se imputan datos faltantes. Es una distancia descriptiva, no una predicción
        del GMM ni una recomendación validada.
      </p>
    </details>
  )
}
