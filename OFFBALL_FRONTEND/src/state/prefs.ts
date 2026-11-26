/**
 * Preferencias de interfaz persistentes (localStorage, por navegador).
 * Una sola clave versionada para todo: modo, vista del mercado, ajustes del mapa…
 * Sin datos de jugadores: eso vive en offball.seguimiento (storage.ts).
 */
import { useCallback, useSyncExternalStore } from 'react'
import type { KeyValueStore } from './storage'

export const PREFS_KEY = 'offball.preferencias'
const EVENT = 'offball:prefs'

export type UiMode = 'esencial' | 'avanzado'
export type PitchRender = 'zonas' | 'continuo'
export type MarketView = 'ranking' | 'tabla' | 'mapa' | 'residuos'

export interface Prefs {
  version: 1
  mode: UiMode
  marketView: MarketView
  pitch: {
    render: PitchRender
    /** Exponente de la escala de color (0.35–1). 0.5 = raíz cuadrada (por defecto). */
    gamma: number
    /** Opacidad de la capa de intensidad (0.3–1). */
    opacity: number
    layers: { lines: boolean; labels: boolean; values: boolean; markers: boolean }
  }
}

export const DEFAULT_PREFS: Prefs = {
  version: 1,
  mode: 'esencial',
  marketView: 'ranking',
  pitch: { render: 'continuo', gamma: 0.5, opacity: 0.9, layers: { lines: true, labels: true, values: true, markers: true } },
}

const clamp = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d)

/** Lectura tolerante: cualquier campo inválido vuelve a su valor por defecto. */
export function parsePrefs(raw: string | null): Prefs {
  if (!raw) return DEFAULT_PREFS
  try {
    const p = JSON.parse(raw) as Partial<Prefs> & { pitch?: Partial<Prefs['pitch']> }
    const pitch: Partial<Prefs['pitch']> = p.pitch ?? {}
    const layers = (pitch.layers ?? {}) as Partial<Prefs['pitch']['layers']>
    const D = DEFAULT_PREFS.pitch
    return {
      version: 1,
      mode: p.mode === 'avanzado' ? 'avanzado' : 'esencial',
      marketView: (['ranking', 'tabla', 'mapa', 'residuos'] as const).includes(p.marketView as MarketView)
        ? (p.marketView as MarketView)
        : DEFAULT_PREFS.marketView,
      pitch: {
        render: pitch.render === 'zonas' ? 'zonas' : 'continuo',
        gamma: clamp(pitch.gamma, 0.35, 1, D.gamma),
        opacity: clamp(pitch.opacity, 0.3, 1, D.opacity),
        layers: {
          lines: layers.lines ?? D.layers.lines,
          labels: layers.labels ?? D.layers.labels,
          values: layers.values ?? D.layers.values,
          markers: layers.markers ?? D.layers.markers,
        },
      },
    }
  } catch {
    return DEFAULT_PREFS
  }
}

function kv(): KeyValueStore | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

let memory: string | null = null
let cache: { raw: string | null; value: Prefs } | null = null

function readRaw(): string | null {
  const s = kv()
  try {
    return s ? s.getItem(PREFS_KEY) : memory
  } catch {
    return memory
  }
}

function snapshot(): Prefs {
  const raw = readRaw()
  if (!cache || cache.raw !== raw) cache = { raw, value: parsePrefs(raw) }
  return cache.value
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => e.key === PREFS_KEY && cb()
  window.addEventListener('storage', onStorage)
  window.addEventListener(EVENT, cb)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(EVENT, cb)
  }
}

export function writePrefs(next: Prefs) {
  const raw = JSON.stringify(next)
  const s = kv()
  try {
    if (s) s.setItem(PREFS_KEY, raw)
    else memory = raw
  } catch {
    memory = raw
  }
  window.dispatchEvent(new Event(EVENT))
}

export function usePrefs() {
  const prefs = useSyncExternalStore(subscribe, snapshot, () => DEFAULT_PREFS)
  const update = useCallback((fn: (p: Prefs) => Prefs) => writePrefs(fn(snapshot())), [])
  return { prefs, update }
}

/** Modo global Esencial / Avanzado. */
export function useMode() {
  const { prefs, update } = usePrefs()
  const setMode = useCallback(
    (mode: UiMode) => {
      const apply = () => update((p) => ({ ...p, mode }))
      // Transición suave entre modos cuando el navegador lo permite.
      const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
      if (doc.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) doc.startViewTransition(apply)
      else apply()
    },
    [update],
  )
  return { mode: prefs.mode, advanced: prefs.mode === 'avanzado', setMode }
}
