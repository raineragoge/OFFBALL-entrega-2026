import type { CSSProperties, ElementType, ReactNode } from 'react'
import { cx } from '../components/ui/cx'
import { useInView, useTweenedNumber } from './hooks'

/** Cifra que cuenta hasta su valor. El texto accesible es siempre el valor final. */
export function AnimatedNumber({
  value,
  format,
  className,
  duration,
}: {
  value: number | null
  format: (v: number | null) => string
  className?: string
  duration?: number
}) {
  const v = useTweenedNumber(value, duration)
  return (
    <span className={cx('tabular', className)}>
      <span aria-hidden="true">{format(v)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  )
}

/** Contenedor que revela sus hijos [data-reveal] en cascada al entrar en pantalla. */
export function RevealGroup({
  as: As = 'div',
  className,
  children,
  style,
}: {
  as?: ElementType
  className?: string
  children: ReactNode
  style?: CSSProperties
}) {
  const { ref, inView } = useInView<HTMLElement>()
  return (
    <As ref={ref} className={cx('reveal-group', inView && 'is-in', className)} style={style}>
      {children}
    </As>
  )
}

/** Atributos para un hijo escalonado: <div {...reveal(2)} /> */
export const reveal = (i: number) => ({ 'data-reveal': '', style: { '--i': i } as CSSProperties })
