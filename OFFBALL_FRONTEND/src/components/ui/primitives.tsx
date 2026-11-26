/**
 * Componentes base del Design System OFFBALL v2.
 * Jerarquía de radios: control 5 px < botón 7 px < panel 10 px.
 * Sin sombras salvo en capas flotantes (tooltip, cajón, paleta de comandos).
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'
import { ApiError, describeIssue, errorTitle } from '../../api/errors'
import { DUR } from '../../motion/tokens'
import { IconAlert, IconChevronDown, IconInfo, IconRefresh, IconWifiOff, IconX } from '../icons'
import { cx } from './cx'

export { cx }

// ---------------- Botones ----------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet'
type ButtonSize = 'sm' | 'md' | 'lg'

const BTN_BASE =
  'press inline-flex items-center justify-center gap-2 rounded-[var(--radius-btn)] font-semibold whitespace-nowrap transition-[background-color,border-color,color,transform] duration-[var(--dur-1)] ease-[var(--ease-out-soft)] disabled:cursor-not-allowed disabled:opacity-45'
const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-lime text-noche hover:bg-[#c6ef9f] border border-lime',
  secondary: 'border border-line-3 text-blanco hover:border-lime/70 hover:bg-lime/[0.06]',
  ghost: 'border border-transparent text-salvia-2 hover:text-blanco hover:bg-panel-2',
  quiet: 'border border-line text-salvia-2 hover:text-blanco hover:border-line-3 bg-panel',
  danger: 'border border-coral/60 text-coral hover:bg-coral/10',
}
const BTN_SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-[0.84rem]',
  lg: 'h-12 px-5 text-[0.95rem]',
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  iconRight?: ReactNode
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon, iconRight, loading, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size], className)}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
      {iconRight}
    </button>
  )
})

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra?: string) {
  return cx(BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size], extra)
}

export function IconButton({ label, children, className, active, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cx(
        'press grid size-8 place-items-center rounded-[var(--radius-ctl)] transition-colors duration-[var(--dur-1)]',
        active ? 'bg-panel-3 text-lime' : 'text-salvia-2 hover:bg-panel-2 hover:text-blanco',
        'disabled:opacity-40',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx('size-4 animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line-2 bg-noche-2 px-1.5 py-px font-mono text-[0.65rem] text-salvia-2">{children}</kbd>
}

// ---------------- Superficies ----------------

export function Panel({
  children,
  className,
  as: As = 'section',
  ...rest
}: HTMLAttributes<HTMLElement> & { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' | 'aside' }) {
  return (
    <As className={cx('rounded-[var(--radius-card)] border border-line bg-panel', className)} {...rest}>
      {children}
    </As>
  )
}

export function PanelHeader({
  title,
  eyebrow,
  action,
  className,
  id,
  description,
}: {
  title: ReactNode
  eyebrow?: ReactNode
  action?: ReactNode
  className?: string
  id?: string
  description?: ReactNode
}) {
  return (
    <header className={cx('flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="kicker mb-1">{eyebrow}</p>}
        <h2 id={id} className="text-[0.98rem] font-semibold tracking-tight text-blanco">
          {title}
        </h2>
        {description && <p className="mt-1 max-w-2xl text-[0.8rem] leading-relaxed text-salvia-2">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </header>
  )
}

/** Cabecera de página. `index` se conserva por compatibilidad pero ya no se muestra. */
export function PageHeader({
  title,
  description,
  actions,
  meta,
}: {
  index?: string
  title: string
  description?: ReactNode
  actions?: ReactNode
  meta?: ReactNode
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
      <div className="max-w-3xl min-w-0">
        <h1 className="text-balance font-display text-[1.75rem] leading-[1.08] font-extrabold tracking-[-0.015em] text-blanco sm:text-[2.2rem]">
          {title}
        </h1>
        {description && <div className="mt-3 max-w-[68ch] text-[0.92rem] leading-relaxed text-salvia-2">{description}</div>}
        {meta && <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.78rem] text-salvia">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Título de sección dentro de una página (sin caja). */
export function SectionTitle({ title, description, action, id }: { title: ReactNode; description?: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="font-display text-[1.15rem] font-bold tracking-[-0.01em] text-blanco">
          {title}
        </h2>
        {description && <p className="mt-1 max-w-[70ch] text-[0.82rem] leading-relaxed text-salvia-2">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  )
}

// ---------------- Etiquetas ----------------

type Tone = 'neutral' | 'lime' | 'blue' | 'gold' | 'lavender' | 'coral' | 'muted'

const TONE: Record<Tone, string> = {
  neutral: 'border-line-2 text-salvia-2 bg-panel-2',
  muted: 'border-line text-salvia bg-transparent',
  lime: 'border-lime/45 text-lime bg-lime/[0.07]',
  blue: 'border-blue/45 text-blue bg-blue/[0.07]',
  gold: 'border-gold/45 text-gold bg-gold/[0.07]',
  lavender: 'border-lavender/45 text-lavender bg-lavender/[0.07]',
  coral: 'border-coral/50 text-coral bg-coral/[0.07]',
}

export function Badge({ tone = 'neutral', children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span
      className={cx(
        'inline-flex h-6 items-center gap-1.5 rounded-[var(--radius-ctl)] border px-2 text-[0.72rem] font-medium whitespace-nowrap',
        TONE[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  )
}

/** Etiqueta de procedencia de datos: real (API), estimado, local… */
export function DataTag({ kind, children }: { kind: 'api' | 'estimado' | 'local' | 'nd'; children?: ReactNode }) {
  const map = {
    api: { tone: 'neutral' as Tone, text: 'Dato de la API' },
    estimado: { tone: 'gold' as Tone, text: 'Representación estimada' },
    local: { tone: 'blue' as Tone, text: 'Cálculo local' },
    nd: { tone: 'muted' as Tone, text: 'No disponible' },
  }[kind]
  return (
    <Badge tone={map.tone} className="h-5 px-1.5 text-[0.66rem]">
      {children ?? map.text}
    </Badge>
  )
}

// ---------------- Formularios ----------------

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  optional,
  className,
}: {
  label: ReactNode
  hint?: ReactNode
  error?: string
  children: ReactNode
  htmlFor: string
  optional?: boolean
  className?: string
}) {
  return (
    <div className={cx('min-w-0', className)}>
      <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-2 text-[0.78rem] font-medium text-salvia-2">
        <span>{label}</span>
        {optional && <span className="text-2xs font-normal text-salvia">Opcional</span>}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="mt-1.5 flex animate-fade items-start gap-1.5 text-[0.75rem] text-coral">
          <IconAlert size={13} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="mt-1.5 text-[0.75rem] leading-snug text-salvia">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

const INPUT =
  'h-10 w-full rounded-[var(--radius-ctl)] border bg-noche-2 px-3 text-sm text-blanco placeholder:text-salvia/70 transition-[border-color,box-shadow] duration-[var(--dur-1)] hover:border-line-3 focus:border-lime focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-lime/25'

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; suffix?: ReactNode }>(
  function TextInput({ invalid, className, suffix, id, ...rest }, ref) {
    return (
      <div className="relative">
        <input
          ref={ref}
          id={id}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${id}-error` : `${id}-hint`}
          className={cx(INPUT, invalid ? 'border-coral/70' : 'border-line', suffix ? 'pr-12' : '', 'tabular', className)}
          {...rest}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-xs text-salvia">{suffix}</span>
        )}
      </div>
    )
  },
)

export function Select({
  invalid,
  className,
  children,
  id,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <div className="relative">
      <select
        id={id}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : `${id}-hint`}
        className={cx(INPUT, 'cursor-pointer appearance-none pr-9', invalid ? 'border-coral/70' : 'border-line', className)}
        {...rest}
      >
        {children}
      </select>
      <IconChevronDown size={16} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-salvia" />
    </div>
  )
}

/**
 * Indicador deslizante para grupos de opciones: mide la opción activa y
 * desplaza una "pastilla" con la curva de firma.
 */
function useSlidingIndicator(activeIndex: number, deps: unknown[]) {
  const wrap = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const measure = useCallback(() => {
    const el = wrap.current
    if (!el || activeIndex < 0) return setBox(null)
    const btn = el.querySelectorAll<HTMLElement>('[data-seg]')[activeIndex]
    if (!btn) return setBox(null)
    setBox({ x: btn.offsetLeft, y: btn.offsetTop, w: btn.offsetWidth, h: btn.offsetHeight })
  }, [activeIndex])
  useLayoutEffect(measure, [measure, ...deps]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = wrap.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure])
  return { wrap, box }
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  invalid,
  size = 'md',
  className,
}: {
  value: T | ''
  onChange: (v: T) => void
  options: { value: T; label: ReactNode; hint?: string; disabled?: boolean }[]
  label: string
  invalid?: boolean
  size?: 'sm' | 'md'
  className?: string
}) {
  const idx = options.findIndex((o) => o.value === value)
  const { wrap, box } = useSlidingIndicator(idx, [options.length, value])
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return
    e.preventDefault()
    const enabled = options.filter((o) => !o.disabled)
    const cur = enabled.findIndex((o) => o.value === value)
    const next = enabled[(cur + (e.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length]
    if (next) {
      onChange(next.value)
      requestAnimationFrame(() => wrap.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus())
    }
  }
  return (
    <div
      ref={wrap}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKey}
      className={cx('relative flex w-full flex-wrap gap-1 rounded-[var(--radius-btn)] border bg-noche-2 p-1', invalid ? 'border-coral/70' : 'border-line', className)}
    >
      {box && (
        <span
          aria-hidden="true"
          className="absolute rounded-[var(--radius-ctl)] bg-panel-3 shadow-[inset_0_0_0_1px_var(--color-line-2)] transition-[transform,width,height] duration-[var(--dur-2)] ease-[var(--ease-out-soft)]"
          style={{ width: box.w, height: box.h, transform: `translate(${box.x}px, ${box.y}px)`, left: 0, top: 0 }}
        />
      )}
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            data-seg=""
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active || (idx < 0 && o === options[0]) ? 0 : -1}
            title={o.hint}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cx(
              'relative min-w-0 flex-1 rounded-[var(--radius-ctl)] px-2.5 font-medium transition-colors duration-[var(--dur-1)] disabled:cursor-not-allowed disabled:opacity-40',
              size === 'sm' ? 'h-7 text-xs' : 'h-8 text-[0.8rem]',
              active ? 'text-blanco' : 'text-salvia hover:text-blanco',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** Pestañas con subrayado deslizante (role=tablist). */
export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
  label,
  className,
}: {
  value: T
  onChange: (v: T) => void
  tabs: { value: T; label: ReactNode; badge?: ReactNode }[]
  label: string
  className?: string
}) {
  const idx = tabs.findIndex((t) => t.value === value)
  const { wrap, box } = useSlidingIndicator(idx, [tabs.length, value])
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    const n = tabs.length
    const next =
      e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (idx + (e.key === 'ArrowRight' ? 1 : -1) + n) % n
    const t = tabs[next]
    if (t) {
      onChange(t.value)
      requestAnimationFrame(() => wrap.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus())
    }
  }
  return (
    <div ref={wrap} role="tablist" aria-label={label} onKeyDown={onKey} className={cx('relative flex gap-1 overflow-x-auto border-b border-line', className)}>
      {tabs.map((t) => {
        const active = t.value === value
        return (
          <button
            key={t.value}
            data-seg=""
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.value)}
            className={cx(
              'relative flex h-10 shrink-0 items-center gap-2 px-3 text-[0.84rem] font-medium whitespace-nowrap transition-colors duration-[var(--dur-1)]',
              active ? 'text-blanco' : 'text-salvia hover:text-salvia-2',
            )}
          >
            {t.label}
            {t.badge}
          </button>
        )
      })}
      {box && (
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-0 h-[2px] rounded-full bg-lime transition-[transform,width] duration-[var(--dur-3)] ease-[var(--ease-out-soft)]"
          style={{ width: box.w, transform: `translateX(${box.x}px)` }}
        />
      )}
    </div>
  )
}

export function Toggle({ checked, onChange, label, description, id }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode; id: string }) {
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors duration-[var(--dur-2)]',
          checked ? 'border-lime bg-lime/25' : 'border-line-2 bg-noche-2',
        )}
      >
        <span
          className={cx(
            'absolute top-1/2 left-0.5 size-3.5 -translate-y-1/2 rounded-full transition-transform duration-[var(--dur-2)] ease-[var(--ease-out-soft)]',
            checked ? 'translate-x-4 bg-lime' : 'bg-salvia',
          )}
        />
      </button>
      <label htmlFor={id} className="cursor-pointer text-sm">
        <span className="block font-medium text-blanco">{label}</span>
        {description && <span className="mt-0.5 block text-[0.78rem] leading-snug text-salvia">{description}</span>}
      </label>
    </div>
  )
}

/** Casilla compacta para activar capas (chip con estado). */
export function ChipToggle({ checked, onChange, children, swatch }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; swatch?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cx(
        'press inline-flex h-7 items-center gap-1.5 rounded-[var(--radius-ctl)] border px-2 text-[0.75rem] font-medium transition-colors duration-[var(--dur-1)]',
        checked ? 'border-line-3 bg-panel-3 text-blanco' : 'border-line text-salvia hover:text-salvia-2',
      )}
    >
      <span
        aria-hidden="true"
        className={cx('size-2 rounded-[2px] transition-opacity', checked ? 'opacity-100' : 'opacity-30')}
        style={{ background: swatch ?? 'var(--color-lime)' }}
      />
      {children}
    </button>
  )
}

// ---------------- Métricas ----------------

export function Stat({
  label,
  value,
  sub,
  tone = 'blanco',
  size = 'md',
  hint,
}: {
  label: ReactNode
  value: ReactNode
  sub?: ReactNode
  tone?: 'blanco' | 'lime' | 'blue' | 'gold' | 'lavender' | 'salvia' | 'coral'
  size?: 'sm' | 'md' | 'lg'
  hint?: ReactNode
}) {
  const color = {
    blanco: 'text-blanco',
    lime: 'text-lime',
    blue: 'text-blue',
    gold: 'text-gold',
    lavender: 'text-lavender',
    salvia: 'text-salvia-2',
    coral: 'text-coral',
  }[tone]
  const sizeCls = { sm: 'text-lg', md: 'text-[1.6rem]', lg: 'text-[2.15rem]' }[size]
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center gap-1.5 text-[0.76rem] font-medium text-salvia">
        {label}
        {hint}
      </div>
      <div className={cx('font-mono leading-none font-medium tracking-[-0.02em] tabular', sizeCls, color)}>{value}</div>
      {sub && <div className="mt-2 text-[0.75rem] text-salvia tabular">{sub}</div>}
    </div>
  )
}

/** Barra de valor 0–1 que crece al montarse. */
export function Meter({ value, color = 'var(--color-lime)', className, label }: { value: number; color?: string; className?: string; label?: string }) {
  const [grown, setGrown] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div className={cx('h-1.5 overflow-hidden rounded-full bg-panel-3', className)} role={label ? 'img' : undefined} aria-label={label}>
      <div
        className="h-full rounded-full transition-[width,background-color] duration-[var(--dur-4)] ease-[var(--ease-out-soft)]"
        style={{ width: grown ? `${pct}%` : '0%', background: color }}
      />
    </div>
  )
}

/**
 * Ayuda contextual: tooltip con entrada/salida animada.
 * Accesible por teclado (focus) y con Escape para cerrar.
 */
export function InfoTip({ children, label = 'Más información', side = 'top' }: { children: ReactNode; label?: string; side?: 'top' | 'bottom' }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-describedby={id}
        aria-label={label}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        className="rounded text-salvia transition-colors hover:text-blanco focus-visible:text-blanco"
      >
        <IconInfo size={14} />
      </button>
      <span
        id={id}
        role="tooltip"
        className={cx(
          'pointer-events-none absolute left-1/2 z-40 w-64 -translate-x-1/2 rounded-[var(--radius-btn)] border border-line-2 bg-panel-3 px-3 py-2 text-left text-[0.76rem] leading-snug font-normal text-salvia-2 shadow-[0_12px_32px_-16px_rgba(0,0,0,0.7)] transition-[opacity,transform] duration-[var(--dur-1)] ease-[var(--ease-out-soft)]',
          side === 'top' ? 'bottom-[calc(100%+8px)]' : 'top-[calc(100%+8px)]',
          open ? 'visible translate-y-0 opacity-100' : cx('invisible opacity-0', side === 'top' ? 'translate-y-1' : '-translate-y-1'),
        )}
      >
        {children}
      </span>
    </span>
  )
}

/** Sección plegable (divulgación progresiva) con animación de altura. */
export function Disclosure({
  title,
  children,
  defaultOpen = false,
  open: controlled,
  onOpenChange,
  className,
  meta,
}: {
  title: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (v: boolean) => void
  className?: string
  meta?: ReactNode
}) {
  const [inner, setInner] = useState(defaultOpen)
  const open = controlled ?? inner
  const id = useId()
  const toggle = () => {
    onOpenChange?.(!open)
    if (controlled === undefined) setInner(!open)
  }
  return (
    <div className={cx('border-t border-line', className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={toggle}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left text-[0.86rem] font-semibold text-blanco transition-colors hover:bg-panel-2/60"
      >
        <span className="flex min-w-0 items-center gap-2">{title}</span>
        <span className="flex items-center gap-3">
          {meta}
          <IconChevronDown size={16} className={cx('text-salvia transition-transform duration-[var(--dur-2)] ease-[var(--ease-out-soft)]', open && 'rotate-180')} />
        </span>
      </button>
      <div id={id} className="disclose" data-open={open} inert={!open}>
        <div>{children}</div>
      </div>
    </div>
  )
}

/** Mantiene montado un elemento durante su animación de salida. */
export function usePresence(open: boolean, exitMs: number = DUR.base) {
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (open) {
      setMounted(true)
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
      return () => cancelAnimationFrame(id)
    }
    setVisible(false)
    const t = window.setTimeout(() => setMounted(false), exitMs)
    return () => window.clearTimeout(t)
  }, [open, exitMs])
  return { mounted, visible }
}

/** Cajón lateral modal con foco gestionado y salida animada. */
export function Drawer({
  open,
  onClose,
  title,
  kicker,
  children,
  footer,
  width = 460,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  kicker?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: number
}) {
  const { mounted, visible } = usePresence(open, DUR.base)
  const closeRef = useRef<HTMLButtonElement>(null)
  const id = useId()
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const k = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => {
      window.removeEventListener('keydown', k)
      prev?.focus?.()
    }
  }, [open, onClose])
  if (!mounted) return null
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby={id}>
      <button
        type="button"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={onClose}
        className={cx('absolute inset-0 bg-black/60 transition-opacity duration-[var(--dur-2)]', visible ? 'opacity-100' : 'opacity-0')}
      />
      <aside
        className={cx(
          'absolute top-0 right-0 flex h-full flex-col border-l border-line bg-noche-2 shadow-[-24px_0_48px_-24px_rgba(0,0,0,0.6)] transition-[transform,opacity]',
          visible ? 'translate-x-0 opacity-100 duration-[var(--dur-3)] ease-[var(--ease-emph)]' : 'translate-x-6 opacity-0 duration-[var(--dur-2)] ease-[var(--ease-exit)]',
        )}
        style={{ width: `min(${width}px, 100vw)` }}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-5">
          <div className="min-w-0">
            {kicker && <p className="kicker mb-1.5">{kicker}</p>}
            <h2 id={id} className="font-display text-xl font-extrabold text-blanco">
              {title}
            </h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="rounded p-2 text-salvia hover:text-blanco" aria-label="Cerrar">
            <IconX size={18} />
          </button>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex gap-2 border-t border-line px-6 py-4">{footer}</div>}
      </aside>
    </div>
  )
}

// ---------------- Estados ----------------

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton rounded-[var(--radius-ctl)]', className)} aria-hidden="true" />
}

export function EmptyState({
  title,
  children,
  action,
  icon,
  className,
}: {
  title: string
  children?: ReactNode
  action?: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    <div className={cx('flex animate-fade flex-col items-center px-6 py-12 text-center', className)}>
      {icon && <div className="mb-4 grid size-12 place-items-center rounded-full border border-line-2 text-salvia">{icon}</div>}
      <h3 className="text-base font-semibold text-blanco">{title}</h3>
      {children && <div className="mt-2 max-w-lg text-sm leading-relaxed text-salvia-2">{children}</div>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry, compact }: { error: ApiError; onRetry?: () => void; compact?: boolean }) {
  const Icon = error.kind === 'network' ? IconWifiOff : IconAlert
  return (
    <div role="alert" className={cx('animate-pop rounded-[var(--radius-btn)] border border-coral/40 bg-coral/[0.06]', compact ? 'p-3' : 'p-4')}>
      <div className="flex items-start gap-3">
        <Icon size={18} className="mt-0.5 shrink-0 text-coral" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-blanco">{errorTitle(error)}</p>
          <p className="mt-1 text-[0.8rem] leading-relaxed text-salvia-2">{error.message}</p>
          {error.issues.length > 0 && (
            <ul className="mt-2 space-y-1 text-[0.8rem] text-salvia-2">
              {error.issues.map((i, k) => (
                <li key={k} className="flex gap-2">
                  <span className="text-coral">—</span>
                  {describeIssue(i)}
                </li>
              ))}
            </ul>
          )}
          {onRetry && error.kind !== 'validation' && (
            <Button variant="ghost" size="sm" className="mt-2 -ml-2" icon={<IconRefresh size={14} />} onClick={onRetry}>
              Reintentar
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export function Notice({ tone = 'info', title, children, className }: { tone?: 'info' | 'warn'; title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'flex gap-3 rounded-[var(--radius-btn)] border px-4 py-3 text-[0.8rem] leading-relaxed',
        tone === 'warn' ? 'border-gold/40 bg-gold/[0.06] text-salvia-2' : 'border-line-2 bg-panel-2 text-salvia-2',
        className,
      )}
    >
      {tone === 'warn' ? <IconAlert size={16} className="mt-0.5 shrink-0 text-gold" /> : <IconInfo size={16} className="mt-0.5 shrink-0 text-blue" />}
      <div className="min-w-0">
        {title && <p className="mb-0.5 font-semibold text-blanco">{title}</p>}
        {children}
      </div>
    </div>
  )
}

export function KeyValue({ items, className }: { items: { k: ReactNode; v: ReactNode }[]; className?: string }) {
  return (
    <dl className={cx('divide-y divide-line', className)}>
      {items.map((it, i) => (
        <div key={i} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
          <dt className="text-salvia">{it.k}</dt>
          <dd className="text-right font-mono text-[0.82rem] text-blanco tabular">{it.v}</dd>
        </div>
      ))}
    </dl>
  )
}
