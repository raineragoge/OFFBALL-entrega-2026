/** Escalas y marcas "bonitas" para los gráficos SVG propios. */

export function niceStep(range: number, count: number): number {
  if (range <= 0 || !Number.isFinite(range)) return 1
  const raw = range / count
  const pow = 10 ** Math.floor(Math.log10(raw))
  const n = raw / pow
  const mult = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10
  return mult * pow
}

/** Dominio lineal [0, max redondeado] y marcas. Siempre parte de cero. */
export function linearTicks(maxValue: number, count = 4): { max: number; ticks: number[] } {
  const step = niceStep(maxValue, count)
  const max = Math.max(step, Math.ceil((maxValue * 1.04) / step) * step)
  const ticks: number[] = []
  for (let v = 0; v <= max + step / 2; v += step) ticks.push(v)
  return { max, ticks }
}

/** Marcas logarítmicas 1-2-5 entre min y max (positivos). */
export function logTicks(min: number, max: number): number[] {
  const out: number[] = []
  const lo = Math.floor(Math.log10(min))
  const hi = Math.ceil(Math.log10(max))
  for (let e = lo; e <= hi; e++) {
    for (const m of [1, 2, 5]) {
      const v = m * 10 ** e
      if (v >= min && v <= max) out.push(v)
    }
  }
  return out
}
