/** Notificaciones breves (aria-live). */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { IconAlert, IconCheck, IconX } from '../icons'
import { cx } from './primitives'

interface Toast {
  id: number
  message: ReactNode
  tone: 'ok' | 'warn'
}

const Ctx = createContext<(message: ReactNode, tone?: 'ok' | 'warn') => void>(() => {})

let seq = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id))
  const push = useCallback((message: ReactNode, tone: 'ok' | 'warn' = 'ok') => {
    const id = ++seq
    setToasts((t) => [...t.slice(-2), { id, message, tone }])
    window.setTimeout(() => dismiss(id), 4200)
  }, [])
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex animate-rise items-start gap-3 rounded-md border border-line-2 bg-panel-3 px-4 py-3 text-sm text-blanco shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)]"
          >
            {t.tone === 'ok' ? <IconCheck size={16} className="mt-0.5 shrink-0 text-lime" /> : <IconAlert size={16} className="mt-0.5 shrink-0 text-gold" />}
            <div className="min-w-0 flex-1 leading-snug">{t.message}</div>
            <button type="button" aria-label="Cerrar aviso" onClick={() => dismiss(t.id)} className={cx('rounded text-salvia hover:text-blanco')}>
              <IconX size={14} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
