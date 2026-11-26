/** Hooks React sobre el almacén local (sincronizado entre pestañas). */
import { useCallback, useSyncExternalStore } from 'react'
import {
  addItem,
  COMPARE_KEY,
  importJson,
  readCompare,
  readStore,
  removeItem,
  STORE_KEY,
  toggleCompare,
  updateNotes,
  writeStore,
  type KeyValueStore,
  type SavedItem,
  type StoreShape,
} from './storage'

const EVENT = 'offball:storage'

function kv(): KeyValueStore {
  try {
    return window.localStorage
  } catch {
    // Navegación privada estricta: almacenamiento en memoria de la sesión.
    const m = new Map<string, string>()
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) }
  }
}

const store = kv()

let cache: { raw: string | null; value: StoreShape } | null = null
let compareCache: { raw: string | null; value: string[] } | null = null

function snapshot(): StoreShape {
  const raw = store.getItem(STORE_KEY)
  if (!cache || cache.raw !== raw) cache = { raw, value: readStore(store) }
  return cache.value
}

function compareSnapshot(): string[] {
  const raw = store.getItem(COMPARE_KEY)
  if (!compareCache || compareCache.raw !== raw) compareCache = { raw, value: readCompare(store) }
  return compareCache.value
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORE_KEY || e.key === COMPARE_KEY) cb()
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener(EVENT, cb)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(EVENT, cb)
  }
}

function commit(s: StoreShape) {
  writeStore(store, s)
  window.dispatchEvent(new Event(EVENT))
}

export function useSaved() {
  const data = useSyncExternalStore(subscribe, snapshot, snapshot)
  const add = useCallback((item: SavedItem) => {
    const { store: next, result } = addItem(snapshot(), item)
    if (result.added) commit(next)
    return result
  }, [])
  const remove = useCallback((id: string) => {
    commit(removeItem(snapshot(), id))
    const ids = compareSnapshot().filter((x) => x !== id)
    store.setItem(COMPARE_KEY, JSON.stringify(ids))
    window.dispatchEvent(new Event(EVENT))
  }, [])
  const setNotes = useCallback((id: string, notas: string) => commit(updateNotes(snapshot(), id, notas)), [])
  const importBackup = useCallback((text: string) => {
    const r = importJson(snapshot(), text)
    commit(r.store)
    return { added: r.added, skipped: r.skipped }
  }, [])
  return { items: data.items, add, remove, setNotes, importBackup, get: (id: string) => data.items.find((i) => i.id === id) }
}

export function useCompare() {
  const ids = useSyncExternalStore(subscribe, compareSnapshot, compareSnapshot)
  const toggle = useCallback((id: string) => {
    const r = toggleCompare(compareSnapshot(), id)
    if (!r.full) {
      store.setItem(COMPARE_KEY, JSON.stringify(r.ids))
      window.dispatchEvent(new Event(EVENT))
    }
    return r
  }, [])
  const clear = useCallback(() => {
    store.setItem(COMPARE_KEY, '[]')
    window.dispatchEvent(new Event(EVENT))
  }, [])
  return { ids, toggle, clear }
}
