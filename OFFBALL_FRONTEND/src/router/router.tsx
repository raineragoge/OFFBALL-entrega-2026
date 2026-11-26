/**
 * Enrutador mínimo sobre la History API (sin dependencias).
 * Rutas planas; el servidor debe devolver index.html para cualquier ruta (SPA).
 * Las navegaciones usan la View Transitions API cuando existe (fundido + 6 px).
 */
import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react'

const EVENT = 'offball:navigate'

function subscribe(cb: () => void) {
  window.addEventListener('popstate', cb)
  window.addEventListener(EVENT, cb)
  return () => {
    window.removeEventListener('popstate', cb)
    window.removeEventListener(EVENT, cb)
  }
}

const getSnapshot = () => window.location.pathname + window.location.search

type VTDoc = Document & { startViewTransition?: (cb: () => void) => unknown }

export function navigate(to: string, opts: { replace?: boolean; transition?: boolean } = {}) {
  if (to === getSnapshot()) return
  const samePath = to.split('?')[0] === window.location.pathname
  const apply = () => {
    if (opts.replace) window.history.replaceState(null, '', to)
    else window.history.pushState(null, '', to)
    window.dispatchEvent(new Event(EVENT))
    if (!opts.replace && !samePath) window.scrollTo({ top: 0 })
  }
  const doc = document as VTDoc
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (opts.transition !== false && !opts.replace && !samePath && doc.startViewTransition && !reduced) doc.startViewTransition(apply)
  else apply()
}

export interface Route {
  path: string
  query: URLSearchParams
}

export function useRoute(): Route {
  const loc = useSyncExternalStore(subscribe, getSnapshot, () => '/')
  const [path, search = ''] = loc.split('?')
  const clean = (path ?? '/').replace(/\/+$/, '') || '/'
  return { path: clean, query: new URLSearchParams(search) }
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }

export function Link({ to, onClick, ...rest }: LinkProps) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    navigate(to)
  }
  return <a href={to} onClick={handle} {...rest} />
}
