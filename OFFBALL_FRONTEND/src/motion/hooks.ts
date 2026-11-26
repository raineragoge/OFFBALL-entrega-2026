/**
 * Primitivas de animación sin dependencias (requestAnimationFrame + CSS).
 * Se descartó Framer Motion/GSAP: las necesidades (contadores, interpolación de
 * valores, revelado escalonado) caben en ~100 líneas y evitan ~40–60 kB de JS.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { DUR, EASE } from './tokens'

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribeRM(cb: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const mq = window.matchMedia(QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(QUERY).matches
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeRM, prefersReducedMotion, () => false)
}

/**
 * Interpola un registro de números (p. ej. afinidades por zona) hacia su
 * nuevo valor. Las claves nuevas parten de `from` (0 por defecto) para que
 * las zonas "crezcan" al aparecer. Con reduced-motion salta al valor final.
 */
export function useTweenedRecord(target: Record<string, number>, duration: number = DUR.map, from = 0): Record<string, number> {
  const reduced = useReducedMotion()
  const [value, setValue] = useState<Record<string, number>>(() =>
    reduced ? target : Object.fromEntries(Object.keys(target).map((k) => [k, from])),
  )
  const current = useRef(value)
  current.current = value
  const key = JSON.stringify(target)

  useEffect(() => {
    if (reduced) {
      setValue(target)
      return
    }
    const start = { ...current.current }
    const t0 = performance.now()
    let raf = 0
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / duration)
      const e = EASE.outSoft(p)
      const next: Record<string, number> = {}
      for (const k of Object.keys(target)) {
        const a = start[k] ?? from
        next[k] = a + (target[k]! - a) * e
      }
      setValue(next)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reduced, duration])

  return value
}

/** Número animado (contadores). Devuelve el valor intermedio. */
export function useTweenedNumber(target: number | null, duration: number = DUR.data): number | null {
  const rec = useTweenedRecord(target === null ? {} : { v: target }, duration)
  if (target === null) return null
  return rec.v ?? target
}

/**
 * Marca un contenedor como visible la primera vez que entra en pantalla.
 * Úsalo con la clase .reveal-group y [data-reveal] en los hijos.
 */
export function useInView<T extends Element>(opts: { once?: boolean; rootMargin?: string } = {}) {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true)
          if (opts.once !== false) io.disconnect()
        } else if (opts.once === false) setInView(false)
      },
      { rootMargin: opts.rootMargin ?? '0px 0px -10% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [opts.once, opts.rootMargin])
  return { ref, inView }
}

/** Devuelve true un frame después de montar (para transiciones de entrada CSS). */
export function useMounted(): boolean {
  const [m, setM] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setM(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return m
}
