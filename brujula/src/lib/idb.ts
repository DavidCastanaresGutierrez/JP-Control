/**
 * Envoltorio mínimo de IndexedDB (sin dependencias) para la caché local.
 * Brújula guarda un único documento `db` más algo de metadatos de sync,
 * así que basta un store clave-valor.
 */

const DB_NAME = 'brujula'
const DB_VERSION = 1
const STORE = 'app'

let dbPromise: Promise<IDBDatabase> | null = null

export function idbDisponible(): boolean {
  return typeof indexedDB !== 'undefined'
}

function abrir(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => {
      req.result.onversionchange = () => {
        req.result.close()
        dbPromise = null
      }
      resolve(req.result)
    }
    req.onerror = () => {
      dbPromise = null
      reject(req.error ?? new Error('No se pudo abrir IndexedDB'))
    }
  })
  return dbPromise
}

export async function idbLeer<T>(clave: string): Promise<T | undefined> {
  if (!idbDisponible()) return undefined
  const db = await abrir()
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(clave)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

export async function idbGuardar(clave: string, valor: unknown): Promise<void> {
  if (!idbDisponible()) return
  const db = await abrir()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(valor, clave)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function idbBorrar(clave: string): Promise<void> {
  if (!idbDisponible()) return
  const db = await abrir()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(clave)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
