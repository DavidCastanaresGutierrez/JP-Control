import type { Project } from '../types'
import { getAuthToken, updateAuthToken } from './auth'

export type RemoteProjects =
  | { estado: 'ok'; projects: Record<string, Project> }
  | { estado: 'auth' }
  | { estado: 'sin-nube' }

async function call(path: string, init?: RequestInit): Promise<Response | 'sin-nube'> {
  try {
    const token = getAuthToken()
    const res = await fetch(path, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    })
    if (res.status === 404 || res.status === 503) return 'sin-nube'
    // El backend renueva la sesion SSO en silencio y devuelve el nuevo app JWT
    const renewed = res.headers.get('authorization')
    if (renewed?.startsWith('Bearer ')) updateAuthToken(renewed.slice(7))
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

