/**
 * Cliente de la API en la nube (opcional). El código de acceso (APP_TOKEN) se
 * guarda en localStorage y se manda en la cabecera Authorization. Sin token
 * configurado, `nubeConfigurada()` es false y la app funciona solo en local.
 */
import type { DB } from '../types.ts'

const TOKEN_KEY = 'vc-token'

export function leerToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

export function guardarToken(token: string): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // localStorage no disponible: la app sigue en modo local
  }
}

export function nubeConfigurada(): boolean {
  return leerToken().length > 0
}

function cabeceras(): HeadersInit {
  const token = leerToken()
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) h.Authorization = `Bearer ${token}`
  return h
}

export interface EstadoRemoto {
  data: DB | null
  version: number
}

export type ResultadoPush =
  | { estado: 'ok'; version: number }
  | { estado: 'conflicto'; version: number; data: DB }
  | { estado: 'error'; mensaje: string }

/** Descarga el documento remoto. Lanza si la respuesta no es válida. */
export async function descargarEstado(): Promise<EstadoRemoto> {
  const res = await fetch('/api/state', { headers: cabeceras() })
  if (res.status === 401) throw new Error('Código de acceso incorrecto.')
  if (!res.ok) throw new Error(await mensajeError(res))
  const json = (await res.json()) as { data: DB | null; version: number }
  return { data: json.data ?? null, version: Number(json.version) || 0 }
}

/** Sube el documento con bloqueo optimista. En 409 devuelve la versión remota vigente. */
export async function subirEstado(data: DB, baseVersion: number): Promise<ResultadoPush> {
  try {
    const res = await fetch('/api/state', {
      method: 'PUT',
      headers: cabeceras(),
      body: JSON.stringify({ data, baseVersion }),
    })
    if (res.status === 409) {
      const json = (await res.json()) as { data: DB; version: number }
      return { estado: 'conflicto', version: Number(json.version) || 0, data: json.data }
    }
    if (!res.ok) return { estado: 'error', mensaje: await mensajeError(res) }
    const json = (await res.json()) as { version: number }
    return { estado: 'ok', version: Number(json.version) || 0 }
  } catch (err) {
    return { estado: 'error', mensaje: err instanceof Error ? err.message : 'Error de red.' }
  }
}

async function mensajeError(res: Response): Promise<string> {
  try {
    const json = (await res.json()) as { error?: string }
    if (json.error) return json.error
  } catch {
    // respuesta sin JSON
  }
  return `Error ${res.status}`
}
