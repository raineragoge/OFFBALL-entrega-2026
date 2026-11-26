/**
 * Buscador global (Ctrl/⌘ + K o "/"): páginas, fichas guardadas y acciones.
 * Navegación completa por teclado (↑ ↓ Intro Esc).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toComparable } from '../../domain/compare'
import { subShort } from '../../domain/positions'
import { DUR } from '../../motion/tokens'
import { navigate } from '../../router/router'
import { useApiStatus } from '../../state/api-status'
import { useMode } from '../../state/prefs'
import { useSaved } from '../../state/saved'
import { IconAdvanced, IconBookmark, IconEssential, IconPlay, IconRefresh, IconSearch } from '../icons'
import { Kbd, cx, usePresence } from '../ui/primitives'
import { NAV } from './nav'

interface Entry {
  id: string
  group: 'Páginas' | 'Fichas guardadas' | 'Acciones'
  label: string
  hint?: string
  icon: ReactNode
  run: () => void
  keywords?: string
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mounted, visible } = usePresence(open, DUR.fast)
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const saved = useSaved()
  const { mode, setMode } = useMode()
  const api = useApiStatus()

  useEffect(() => {
    if (open) {
      setQ('')
      setIdx(0)
      requestAnimationFrame(() => input.current?.focus())
    }
  }, [open])

  const entries = useMemo<Entry[]>(() => {
    const pages: Entry[] = NAV.map((n) => ({
      id: `p:${n.to}`,
      group: 'Páginas',
      label: n.label,
      hint: n.advancedOnly ? `${n.hint} · Avanzado` : n.hint,
      icon: <n.Icon size={16} />,
      run: () => navigate(n.to),
    }))
    const players: Entry[] = saved.items.map((i) => {
      const c = toComparable(i)
      return {
        id: `s:${i.id}`,
        group: 'Fichas guardadas',
        label: c.nombre,
        hint: `${subShort(c.sub_position)} · ${c.origen === 'manual' ? 'análisis manual' : 'catálogo'}`,
        icon: <IconBookmark size={16} />,
        keywords: `${c.sub_position ?? ''} ${c.competition_id ?? ''} ${i.notas}`,
        run: () => navigate(i.origen === 'manual' ? `/analizar?id=${encodeURIComponent(i.id)}` : '/seguimiento'),
      }
    })
    const actions: Entry[] = [
      {
        id: 'a:mode',
        group: 'Acciones',
        label: mode === 'esencial' ? 'Cambiar a modo Avanzado' : 'Cambiar a modo Esencial',
        icon: mode === 'esencial' ? <IconAdvanced size={16} /> : <IconEssential size={16} />,
        run: () => setMode(mode === 'esencial' ? 'avanzado' : 'esencial'),
        keywords: 'modo nivel detalle tecnico simple',
      },
      { id: 'a:example', group: 'Acciones', label: 'Analizar el jugador ficticio de ejemplo', icon: <IconPlay size={16} />, run: () => navigate('/analizar?ejemplo=1') },
      { id: 'a:retry', group: 'Acciones', label: 'Volver a comprobar la conexión con la API', icon: <IconRefresh size={16} />, run: api.retry },
    ]
    return [...pages, ...players, ...actions]
  }, [saved.items, mode, setMode, api.retry])

  const results = useMemo(() => {
    const t = norm(q.trim())
    if (!t) {
      const by = (g: Entry['group']) => entries.filter((e) => e.group === g)
      return [...by('Páginas'), ...by('Fichas guardadas').slice(0, 5), ...by('Acciones')]
    }
    return entries.filter((e) => norm(`${e.label} ${e.hint ?? ''} ${e.keywords ?? ''}`).includes(t))
  }, [q, entries])

  useEffect(() => setIdx(0), [q])
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-idx="${idx}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [idx])

  if (!mounted) return null

  const run = (e?: Entry) => {
    if (!e) return
    onClose()
    e.run()
  }

  let lastGroup = ''
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Buscar en OFFBALL">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Cerrar buscador"
        onClick={onClose}
        className={cx('absolute inset-0 bg-black/55 transition-opacity duration-[var(--dur-1)]', visible ? 'opacity-100' : 'opacity-0')}
      />
      <div
        className={cx(
          'relative w-full max-w-xl overflow-hidden rounded-[var(--radius-card)] border border-line-2 bg-panel shadow-[0_24px_64px_-24px_rgba(0,0,0,0.85)] transition-[opacity,transform] duration-[var(--dur-2)] ease-[var(--ease-emph)]',
          visible ? 'translate-y-0 scale-100 opacity-100' : '-translate-y-1 scale-[0.985] opacity-0',
        )}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <IconSearch size={18} className="shrink-0 text-salvia" />
          <input
            ref={input}
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setIdx((i) => Math.min(results.length - 1, i + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setIdx((i) => Math.max(0, i - 1))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                run(results[idx])
              } else if (e.key === 'Escape') onClose()
            }}
            placeholder="Busca páginas, jugadores guardados o acciones…"
            aria-label="Buscar"
            aria-controls="cmd-list"
            aria-activedescendant={results[idx] ? `cmd-${results[idx]!.id}` : undefined}
            className="h-14 w-full bg-transparent text-[0.95rem] text-blanco placeholder:text-salvia focus:outline-none"
          />
          <Kbd>Esc</Kbd>
        </div>
        <ul id="cmd-list" ref={list} role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-8 text-center text-sm text-salvia">Sin resultados para «{q}».</li>}
          {results.map((e, i) => {
            const header = e.group !== lastGroup
            lastGroup = e.group
            return (
              <li key={e.id} role="presentation">
                {header && <p className="kicker px-3 pt-3 pb-1.5">{e.group}</p>}
                <button
                  id={`cmd-${e.id}`}
                  data-idx={i}
                  role="option"
                  aria-selected={i === idx}
                  type="button"
                  onMouseMove={() => setIdx(i)}
                  onClick={() => run(e)}
                  className={cx(
                    'flex w-full items-center gap-3 rounded-[var(--radius-ctl)] px-3 py-2.5 text-left transition-colors duration-[var(--dur-1)]',
                    i === idx ? 'bg-panel-3 text-blanco' : 'text-salvia-2',
                  )}
                >
                  <span className={i === idx ? 'text-lime' : 'text-salvia'}>{e.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.86rem] font-medium">{e.label}</span>
                    {e.hint && <span className="block truncate text-2xs text-salvia">{e.hint}</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <div className="flex gap-4 border-t border-line px-4 py-2 text-2xs text-salvia">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> moverse
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>Intro</Kbd> abrir
          </span>
        </div>
      </div>
    </div>
  )
}
