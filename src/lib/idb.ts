/**
 * Envoltorio minimo de IndexedDB para la cache local (sin dependencias).
 * Sustituye a localStorage como persistencia: sin limite practico de cuota
 * (localStorage se quedaba en ~5MB y obligaba a descartar las horas de
 * departamento), y con escrituras por entidad en vez de todo el blob.
 */

const DB_NAME = 'jp-control'
const DB_VERSION = 1
export const STORES = ['projects', 'departamentos'] as const
export type StoreName = (typeof STORES)[number]

let dbPromise: Promise<IDBDatabase> | null = null

export function idbDisponible(): boolean {
  return typeof indexedDB !== 'undefined'
}

function abrir(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      for (const store of STORES) {
        if (!req.result.objectStoreNames.contains(store)) req.result.createObjectStore(store)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      dbPromise = null
      reject(req.error ?? new Error('No se pudo abrir IndexedDB'))
    }
  })
  return dbPromise
}

function esperarTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Error de IndexedDB'))
    tx.onabort = () => reject(tx.error ?? new Error('Transaccion IndexedDB abortada'))
  })
}

/** Carga todas las entradas de un store como Record<clave, valor>. */
export async function idbCargarStore<T>(store: StoreName): Promise<Record<string, T>> {
  const db = await abrir()
  const tx = db.transaction(store, 'readonly')
  const os = tx.objectStore(store)
  const [claves, valores] = await new Promise<[IDBValidKey[], T[]]>((resolve, reject) => {
    const reqKeys = os.getAllKeys()
    const reqVals = os.getAll()
    let keys: IDBValidKey[] | null = null
    let vals: T[] | null = null
    const check = () => {
      if (keys && vals) resolve([keys, vals])
    }
    reqKeys.onsuccess = () => {
      keys = reqKeys.result
      check()
    }
    reqVals.onsuccess = () => {
      vals = reqVals.result
      check()
    }
    reqKeys.onerror = () => reject(reqKeys.error)
    reqVals.onerror = () => reject(reqVals.error)
  })
  return Object.fromEntries(claves.map((k, i) => [String(k), valores[i]]))
}

/** Escribe/borra varias entradas de un store en una sola transaccion. */
export async function idbAplicar(
  store: StoreName,
  puts: Array<[string, unknown]>,
  deletes: string[],
): Promise<void> {
  if (puts.length === 0 && deletes.length === 0) return
  const db = await abrir()
  const tx = db.transaction(store, 'readwrite')
  const os = tx.objectStore(store)
  for (const [key, value] of puts) os.put(value, key)
  for (const key of deletes) os.delete(key)
  await esperarTx(tx)
}
