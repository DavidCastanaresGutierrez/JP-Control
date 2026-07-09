import type { Project } from '../types'

/**
 * Cliente del API de sincronización (/api/projects en Vercel).
 * Si el API no existe (desarrollo local con `vite`) o la base de datos no está
 * configurada, la app sigue funcionando en modo solo-local.
 */

const TOKEN_KEY = 'jp-control-token'

export const getToken = () => localStorage.getItem(TOKEN_KEY) ?? ''
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t)

export type RemoteProjects =
  | { estado: 'ok'; projects: Record<string, Project> }
  | { estado: 'auth' } // requiere código de acceso
  | { estado: 'sin-nube' } // API inexistente o BD sin configurar

async function call(path: string, init?: RequestInit): Promise<Response | 'sin-nube'> {
  try {
    const res = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
        ...init?.headers,
      },
    })
    // 404 = API no desplegada (dev local); 503 = BD sin configurar en Vercel
    if (res.status === 404 || res.status === 503) return 'sin-nube'
    return res
  } catch {
    return 'sin-nube'
  }
}

export async function fetchRemoteProjects(): Promise<RemoteProjects> {
  const res = await call('/api/projects')
  if (res === 'sin-nube') return { estado: 'sin-nube' }
  if (res.status === 401) return { estado: 'auth' }
  if (!res.ok) return { estado: 'sin-nube' }
  // Protección extra: si algo devuelve HTML (fallback SPA), tratar como sin nube
  if (!(res.headers.get('content-type') ?? '').includes('application/json')) {
    return { estado: 'sin-nube' }
  }
  const body = (await res.json()) as { projects?: Record<string, Project> }
  return { estado: 'ok', projects: body.projects ?? {} }
}

export async function pushProject(project: Project): Promise<boolean> {
  const res = await call('/api/projects', {
    method: 'PUT',
    body: JSON.stringify({ code: project.code, data: project }),
  })
  return res !== 'sin-nube' && res.ok
}

export async function deleteRemoteProject(code: string): Promise<boolean> {
  const res = await call(`/api/projects?code=${encodeURIComponent(code)}`, { method: 'DELETE' })
  return res !== 'sin-nube' && res.ok
}
