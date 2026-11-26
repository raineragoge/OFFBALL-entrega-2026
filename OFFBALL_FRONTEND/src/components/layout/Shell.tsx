import { useEffect, useState, type ReactNode } from 'react'
import { Link, useRoute } from '../../router/router'
import { useApiStatus } from '../../state/api-status'
import { useMode } from '../../state/prefs'
import { useSaved } from '../../state/saved'
import { dateLabel } from '../../domain/format'
import { Logo } from '../brand/Logo'
import { IconMenu, IconRefresh, IconSearch, IconTarget, IconX } from '../icons'
import { Kbd, buttonClass, cx, usePresence } from '../ui/primitives'
import { CommandPalette } from './CommandPalette'
import { ModeSwitch } from './ModeSwitch'
import { activeNav, NAV } from './nav'

export { NAV }

export function ConnectionDot({ className }: { className?: string }) {
  const { connection } = useApiStatus()
  const color = {
    checking: 'bg-salvia animate-pulse',
    online: 'bg-lime',
    degraded: 'bg-gold',
    offline: 'bg-coral',
  }[connection]
  return (
    <span className={cx('relative inline-flex size-2', className)} aria-hidden="true">
      {connection === 'online' && <span className="absolute inset-0 animate-ping rounded-full bg-lime/40 [animation-iteration-count:2]" />}
      <span className={cx('relative inline-block size-2 rounded-full', color)} />
    </span>
  )
}

export function connectionText(c: ReturnType<typeof useApiStatus>['connection']) {
  return { checking: 'Comprobando API…', online: 'API conectada', degraded: 'API parcial', offline: 'Sin conexión' }[c]
}

function StatusBlock() {
  const api = useApiStatus()
  return (
    <div className="border-t border-line px-3 pt-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[0.78rem] font-medium text-blanco">
          <ConnectionDot />
          {connectionText(api.connection)}
        </span>
        <button
          type="button"
          onClick={api.retry}
          aria-label="Volver a comprobar la conexión"
          className="press rounded p-1 text-salvia transition-colors hover:text-blanco"
        >
          <IconRefresh size={14} />
        </button>
      </div>
      <p className="mt-2 text-2xs text-salvia">
        Corte de datos <span className="font-mono text-salvia-2 tabular">{api.corte ? dateLabel(api.corte) : 'N/D'}</span>
      </p>
      <p className="mt-0.5 truncate font-mono text-2xs text-salvia/80" title={api.target}>
        {api.target}
      </p>
    </div>
  )
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { path } = useRoute()
  const { items } = useSaved()
  const { advanced } = useMode()
  const visible = NAV.filter((n) => advanced || !n.advancedOnly)
  const groups = [...new Set(visible.map((n) => n.group))]
  return (
    <nav aria-label="Principal" className="space-y-5">
      {groups.map((g) => (
        <div key={g}>
          <p className="mb-1.5 px-3 text-[0.7rem] font-semibold text-salvia/80">{g}</p>
          <ul className="space-y-px">
            {visible
              .filter((n) => n.group === g)
              .map(({ to, label, Icon, advancedOnly }) => {
                const active = to === '/' ? path === '/' : path.startsWith(to)
                return (
                  <li key={to} className={advancedOnly ? 'animate-pop' : undefined}>
                    <Link
                      to={to}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cx(
                        'group relative flex h-9 items-center gap-3 rounded-[var(--radius-ctl)] px-3 text-[0.85rem] transition-colors duration-[var(--dur-1)]',
                        active ? 'bg-panel-2 font-semibold text-blanco' : 'text-salvia-2 hover:bg-panel hover:text-blanco',
                      )}
                    >
                      <span
                        className={cx(
                          'absolute top-2 bottom-2 left-0 w-[2px] origin-center rounded-full bg-lime transition-transform duration-[var(--dur-2)] ease-[var(--ease-out-soft)]',
                          active ? 'scale-y-100' : 'scale-y-0',
                        )}
                        aria-hidden="true"
                      />
                      <Icon size={17} className={cx('transition-colors', active ? 'text-lime' : 'text-salvia group-hover:text-salvia-2')} />
                      <span className="flex-1 truncate">{label}</span>
                      {to === '/seguimiento' && items.length > 0 && (
                        <span className="rounded bg-panel-3 px-1.5 font-mono text-2xs text-salvia-2 tabular">{items.length}</span>
                      )}
                    </Link>
                  </li>
                )
              })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function Brand() {
  return (
    <Link to="/" className="block rounded-[var(--radius-ctl)] px-3 py-1" aria-label="OFFBALL, ir al inicio">
      <Logo variant="lockup" className="h-[46px] w-auto" />
    </Link>
  )
}

export function Shell({ children, onReplayIntro }: { children: ReactNode; onReplayIntro:()=>void }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState(false)
  const { path } = useRoute()
  const api = useApiStatus()
  const current = activeNav(path)
  const drawer = usePresence(open, 200)

  useEffect(() => setOpen(false), [path])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setSearch((s) => !s)
      } else if (e.key === '/' && !typing) {
        e.preventDefault()
        setSearch(true)
      } else if (e.key === 'Escape') {
        setOpen(false)
        setSearch(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-lime focus:px-3 focus:py-2 focus:text-noche">
        Saltar al contenido
      </a>

      {/* Barra lateral (escritorio) */}
      <aside className="vt-aside sticky top-0 hidden h-dvh flex-col border-r border-line bg-noche-2 px-2.5 pt-5 pb-4 lg:flex">
        <Brand />
        <div className="mt-7 flex-1 overflow-y-auto">
          <NavList />
        </div>
        <StatusBlock />
      </aside>

      {/* Cajón móvil */}
      {drawer.mounted && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <button
            type="button"
            aria-label="Cerrar menú"
            className={cx('absolute inset-0 bg-black/60 transition-opacity duration-[var(--dur-2)]', drawer.visible ? 'opacity-100' : 'opacity-0')}
            onClick={() => setOpen(false)}
          />
          <div
            className={cx(
              'relative flex h-full w-[min(300px,86vw)] flex-col border-r border-line bg-noche-2 px-2.5 pt-5 pb-4 transition-transform',
              drawer.visible ? 'translate-x-0 duration-[var(--dur-3)] ease-[var(--ease-emph)]' : '-translate-x-full duration-[var(--dur-2)] ease-[var(--ease-exit)]',
            )}
          >
            <div className="flex items-start justify-between">
              <Brand />
              <button type="button" onClick={() => setOpen(false)} className="rounded p-2 text-salvia hover:text-blanco" aria-label="Cerrar menú">
                <IconX size={18} />
              </button>
            </div>
            <ModeSwitch className="mt-5 px-1" />
            <div className="mt-5 flex-1 overflow-y-auto">
              <NavList onNavigate={() => setOpen(false)} />
            </div>
            <StatusBlock />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="vt-header sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-noche/95 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
          <button
            type="button"
            className="-ml-1 rounded p-2 text-salvia-2 hover:text-blanco lg:hidden"
            aria-label="Abrir menú"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <IconMenu size={20} />
          </button>
          <Link to="/" className="lg:hidden" aria-label="OFFBALL, inicio">
            <Logo variant="wordmark" className="h-5 w-auto" />
          </Link>
          <p className="hidden min-w-0 truncate text-[0.8rem] text-salvia lg:block">
            <span className="text-salvia-2">{current?.label ?? 'Página'}</span>
          </p>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <button type="button" className="text-xs text-lime hover:underline" onClick={onReplayIntro} title="Reproducir presentación de OFFBALL">◆ Ver intro</button>
            <button
              type="button"
              onClick={() => setSearch(true)}
              className="press flex h-8 items-center gap-2 rounded-[var(--radius-btn)] border border-line bg-panel px-2.5 text-[0.8rem] text-salvia transition-colors hover:border-line-3 hover:text-salvia-2"
              aria-label="Buscar (Ctrl+K)"
            >
              <IconSearch size={15} />
              <span className="hidden md:inline">Buscar</span>
              <span className="hidden md:inline">
                <Kbd>Ctrl K</Kbd>
              </span>
            </button>
            <ModeSwitch className="hidden w-48 sm:block" />
            <span className="hidden items-center gap-2 text-[0.75rem] text-salvia-2 xl:flex" title={api.target}>
              <ConnectionDot />
              {connectionText(api.connection)}
            </span>
            {!path.startsWith('/analizar') && (
              <Link to="/analizar" className={buttonClass('primary', 'sm')}>
                <IconTarget size={15} />
                <span className="hidden sm:inline">Analizar jugador</span>
                <span className="sm:hidden">Analizar</span>
              </Link>
            )}
          </div>
        </header>

        {api.connection === 'offline' && (
          <div className="flex animate-fade flex-wrap items-center gap-x-3 gap-y-1 border-b border-coral/30 bg-coral/[0.06] px-4 py-2 text-[0.8rem] text-salvia-2 sm:px-6 lg:px-8">
            <span className="font-semibold text-coral">Sin conexión con OFFBALL API.</span>
            <span>Puedes preparar formularios; los análisis se ejecutan cuando la API responda. No se muestran datos simulados.</span>
            <button type="button" onClick={api.retry} className="font-semibold text-blanco underline decoration-line-2 underline-offset-4 hover:decoration-lime">
              Reintentar
            </button>
          </div>
        )}

        <main id="contenido" className="mx-auto w-full max-w-[1440px] flex-1 px-4 pt-8 pb-16 sm:px-6 lg:px-10">
          {children}
        </main>

        <footer className="border-t border-line px-4 py-5 text-2xs text-salvia sm:px-6 lg:px-10">
          <div className="mx-auto flex max-w-[1440px] flex-wrap justify-between gap-2">
            <span>OFFBALL · Football Intelligence · Frontend 0.4.2 · API v0.1.0</span>
            <span>
              Estimaciones estadísticas: no son precios de traspaso ni garantías de rendimiento.{' '}
              <Link to="/metodologia" className="text-salvia-2 underline decoration-line-2 underline-offset-2 hover:text-blanco">
                Metodología
              </Link>
            </span>
          </div>
        </footer>
      </div>

      <CommandPalette open={search} onClose={() => setSearch(false)} />
    </div>
  )
}
