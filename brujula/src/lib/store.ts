/**
 * Estado global de la app: mantiene el documento `DB`, lo persiste en IndexedDB
 * en cuanto cambia y, con la nube configurada, lo sincroniza con un debounce.
 *
 * Filosofía (heredada de JP Control): local-first. La app es plenamente usable
 * sin conexión ni base de datos; la nube es una capa opcional que hace que los
 * datos te sigan entre dispositivos, con bloqueo optimista para no pisar en
 * silencio los cambios hechos en otro sitio.
 */
import { createContext, useContext } from 'react'
import type { DB } from '../types.ts'

export type EstadoNube = 'local' | 'sincronizando' | 'sincronizado' | 'error' | 'offline'

export interface StoreCtx {
  db: DB
  cargando: boolean
  estadoNube: EstadoNube
  aviso: string | null
  descartarAviso: () => void
  /** Aplica un cambio inmutable al documento, lo persiste y programa la sync. */
  update: (fn: (db: DB) => DB) => void
  /** Reemplaza el documento entero (restaurar copia de seguridad). */
  reemplazar: (db: DB) => void
  /** Fuerza una sincronización inmediata con la nube. */
  sincronizarAhora: () => void
}

export const StoreContext = createContext<StoreCtx | null>(null)

export function useStore(): StoreCtx {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore debe usarse dentro de <StoreProvider>')
  return ctx
}

export interface Meta {
  version: number
  sucio: boolean
}

export const CLAVE_DB = 'db'
export const CLAVE_META = 'meta'
