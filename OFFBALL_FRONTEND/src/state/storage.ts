/**
 * Persistencia local versionada (localStorage). Sin cuenta, sin MongoDB.
 * Las funciones puras reciben un KeyValueStore para poder probarlas.
 */
import type { EconomicResult, OffensiveResult, OpportunityRow } from '../api/types'
import type { AnalysisForm } from '../domain/form'
import { EMPTY_FORM } from '../domain/form'
import { catalogIdentity } from '../domain/market'

export const STORE_KEY = 'offball.seguimiento'
export const COMPARE_KEY = 'offball.comparador'
export const SCHEMA_VERSION = 1
export const MAX_COMPARE = 3

export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

interface BaseItem {
  id: string
  guardadoEn: string
  notas: string
}

export interface ManualItem extends BaseItem {
  origen: 'manual'
  /** Nombre local opcional; nunca se envía al backend. */
  nombre: string
  form: AnalysisForm
  economic: EconomicResult | null
  offensive: OffensiveResult | null
  /** Momento en que se ejecutó el análisis contra la API. */
  analizadoEn: string
  corteDatos: string | null
}

export interface CatalogItem extends BaseItem {
  origen: 'catalogo'
  row: OpportunityRow
  modelo: string
  corteDatos: string
}

export type SavedItem = ManualItem | CatalogItem

export interface StoreShape {
  version: typeof SCHEMA_VERSION
  items: SavedItem[]
}

const empty = (): StoreShape => ({ version: SCHEMA_VERSION, items: [] })

function isItem(v: unknown): v is SavedItem {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  if (typeof o.id !== 'string' || typeof o.guardadoEn !== 'string') return false
  if (o.origen === 'manual') return typeof o.form === 'object' && o.form !== null
  if (o.origen === 'catalogo') return typeof o.row === 'object' && o.row !== null
  return false
}

function normalizeItem(i: SavedItem): SavedItem {
  if (i.origen === 'manual') return { ...i, notas: i.notas ?? '', nombre: i.nombre ?? '', form: { ...EMPTY_FORM, ...i.form } }
  return { ...i, notas: i.notas ?? '' }
}

/** Lee el almacén. Si la versión no es compatible, conserva una copia y devuelve vacío. */
export function readStore(kv: KeyValueStore): StoreShape {
  const raw = kv.getItem(STORE_KEY)
  if (!raw) return empty()
  try {
    const parsed = JSON.parse(raw) as { version?: unknown; items?: unknown }
    if (parsed.version !== SCHEMA_VERSION || !Array.isArray(parsed.items)) {
      kv.setItem(`${STORE_KEY}.respaldo-${String(parsed.version ?? 'desconocida')}`, raw)
      return empty()
    }
    return { version: SCHEMA_VERSION, items: parsed.items.filter(isItem).map(normalizeItem) }
  } catch {
    kv.setItem(`${STORE_KEY}.respaldo-corrupto`, raw)
    return empty()
  }
}

export function writeStore(kv: KeyValueStore, s: StoreShape) {
  kv.setItem(STORE_KEY, JSON.stringify(s))
}

export type AddResult = { added: true; item: SavedItem } | { added: false; reason: 'duplicado'; existing: SavedItem }

/** Añade un elemento. Las fichas de catálogo con misma identidad y fecha no se duplican. */
export function addItem(s: StoreShape, item: SavedItem): { store: StoreShape; result: AddResult } {
  const existing = s.items.find((i) => i.id === item.id)
  if (existing) return { store: s, result: { added: false, reason: 'duplicado', existing } }
  return { store: { ...s, items: [item, ...s.items] }, result: { added: true, item } }
}

export function removeItem(s: StoreShape, id: string): StoreShape {
  return { ...s, items: s.items.filter((i) => i.id !== id) }
}

export function updateNotes(s: StoreShape, id: string, notas: string): StoreShape {
  return { ...s, items: s.items.map((i) => (i.id === id ? { ...i, notas } : i)) }
}

export function makeCatalogItem(row: OpportunityRow, modelo: string, corteDatos: string, now: Date = new Date()): CatalogItem {
  return { id: catalogIdentity(row), origen: 'catalogo', row, modelo, corteDatos, guardadoEn: now.toISOString(), notas: '' }
}

export function makeManualItem(
  args: Omit<ManualItem, 'id' | 'origen' | 'guardadoEn' | 'notas'> & { notas?: string },
  now: Date = new Date(),
  id: string = randomId(),
): ManualItem {
  return { ...args, notas: args.notas ?? '', id: `man:${id}`, origen: 'manual', guardadoEn: now.toISOString() }
}

export function randomId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c?.randomUUID) return c.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Exportación completa (copia de seguridad). */
export function exportJson(s: StoreShape, now: Date = new Date()): string {
  return JSON.stringify({ app: 'OFFBALL', exportadoEn: now.toISOString(), almacenamiento: 'localStorage', ...s }, null, 2)
}

/** Importa una copia de seguridad fusionando sin duplicar identidades. */
export function importJson(s: StoreShape, text: string): { store: StoreShape; added: number; skipped: number } {
  const parsed = JSON.parse(text) as { version?: unknown; items?: unknown }
  if (parsed.version !== SCHEMA_VERSION || !Array.isArray(parsed.items))
    throw new Error(`Versión de esquema no compatible (se esperaba ${SCHEMA_VERSION}).`)
  let store = s
  let added = 0
  let skipped = 0
  for (const raw of parsed.items) {
    if (!isItem(raw)) {
      skipped++
      continue
    }
    const r = addItem(store, normalizeItem(raw))
    store = r.store
    if (r.result.added) added++
    else skipped++
  }
  return { store, added, skipped }
}

// ------------- selección del comparador -------------

export function readCompare(kv: KeyValueStore): string[] {
  try {
    const v = JSON.parse(kv.getItem(COMPARE_KEY) ?? '[]') as unknown
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, MAX_COMPARE) : []
  } catch {
    return []
  }
}

export function toggleCompare(ids: string[], id: string): { ids: string[]; full: boolean } {
  if (ids.includes(id)) return { ids: ids.filter((x) => x !== id), full: false }
  if (ids.length >= MAX_COMPARE) return { ids, full: true }
  return { ids: [...ids, id], full: false }
}

export function memoryStore(): KeyValueStore & { dump(): Record<string, string> } {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  }
}
