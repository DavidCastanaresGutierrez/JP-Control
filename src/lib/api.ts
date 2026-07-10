import type { Project } from '../types'
import { apiFetch } from './http'

export type RemoteProjects =
  | { estado: 'ok'; projects: Record<string, Project> }
  | { estado: 'auth' }
  | { estado: 'sin-nube' }

async function call(path: string, init?: RequestInit): Promise<Response | 'sin-nube'> {
  const res = await apiFetch(path, init)
  if (!res || res.status === 404 || res.status === 503) return 'sin-nube'
  return res
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

