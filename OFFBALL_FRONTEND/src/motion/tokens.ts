/**
 * Tokens de movimiento de OFFBALL (espejo JS de las variables CSS --dur-* / --ease-*).
 *
 * Personalidad: "corporativa precisa" — sin rebotes, deceleración marcada.
 *  - Firma (80 % de los casos): ease-out-soft  cubic-bezier(0.2, 0, 0, 1)
 *  - Entradas con énfasis:      ease-emph      cubic-bezier(0.05, 0.7, 0.1, 1)
 *  - Salidas:                   ease-exit      cubic-bezier(0.3, 0, 1, 1)
 * Duraciones: 120 (feedback) · 200 (estado) · 320 (paneles) · 520 (datos/revelado).
 * Desplazamientos: 4–10 px en entradas; 24 px en paneles laterales. Escala mínima 0.97.
 * Escalonado: 45 ms por elemento, máximo 8 elementos (≤ 360 ms en total).
 * Las entradas duran ~40 % más que las salidas.
 */
export const DUR = { fast: 120, base: 200, slow: 320, data: 520, map: 700 } as const

export const STAGGER_MS = 45

type Ease = (t: number) => number

/** Aproximación cúbica de Bézier (Newton–Raphson) para animaciones en JS. */
function bezier(x1: number, y1: number, x2: number, y2: number): Ease {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t
  const sy = (t: number) => ((ay * t + by) * t + cy) * t
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx
  return (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let t = x
    for (let i = 0; i < 6; i++) {
      const d = dx(t)
      if (Math.abs(d) < 1e-6) break
      t -= (sx(t) - x) / d
    }
    return sy(Math.min(1, Math.max(0, t)))
  }
}

export const EASE = {
  outSoft: bezier(0.2, 0, 0, 1),
  emph: bezier(0.05, 0.7, 0.1, 1),
  exit: bezier(0.3, 0, 1, 1),
} as const
