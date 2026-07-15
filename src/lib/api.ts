import type { DepartmentModule, Project } from '../types.ts'
import { apiFetch } from './http.ts'
import type { PushResult } from './cloudSync.ts'

export type { PushResult }

export type RemoteProjects =
  | { estado: 'ok'; projects: Record<string, Project>; versions: Record<string, number> }
  | { estado: 'auth' }
  | { estado: 'sin-nube' }

export type RemoteDepartments =
  | { estado: 'ok'; departamentos: Record<string, DepartmentModule>; versions: Record<string, number> }
  | { estado: 'auth' }
  | { estado: 'sin-nube' }

async function call(path: string, init?: RequestInit): Promise<Response | 'sin-nube'> {
  const res = await apiFetch(path, init)
  if (!res || res.status === 404 || res.status === 503) return 'sin-nube'
  return res
}

async function push<T>(path: string, body: Record<string, unknown>): Promise<PushResult<T>> {
  const res = await call(path, { method: 'PUT', body: JSON.stringify(body) })
  if (res === 'sin-nube') return { estado: 'error' }
  if (res.status === 409) {
    const conflict = (await res.json().catch(() => ({}))) as { data?: T; version?: number | null }
    if (conflict.data != null && typeof conflict.version === 'number') {
      return { estado: 'conflicto', version: conflict.version, data: conflict.data }
    }
    return { estado: 'error' }
  }
  if (!res.ok) return { estado: 'error' }
  const body2 = (await res.json().catch(() => ({}))) as { version?: number }
  return { estado: 'ok', version: typeof body2.version === 'number' ? body2.version : 0 }
}

export async function fetchRemoteProjects(): Promise<RemoteProjects> {
  const res = await call('/api/projects')
  if (res === 'sin-nube') return { estado: 'sin-nube' }
  if (res.status === 401) return { estado: 'auth' }
  if (!res.ok) return { estado: 'sin-nube' }
  if (!(res.headers.get('content-type') ?? '').includes('application/json')) {
    return { estado: 'sin-nube' }
  }
  const body = (await res.json()) as {
    projects?: Record<string, Project>
    versions?: Record<string, number>
  }
  return { estado: 'ok', projects: body.projects ?? {}, versions: body.versions ?? {} }
}

export function pushProject(project: Project, baseVersion: number | null): Promise<PushResult<Project>> {
  return push('/api/projects', { code: project.code, data: project, baseVersion })
}

export async function deleteRemoteProject(code: string): Promise<boolean> {
  const res = await call(`/api/projects?code=${encodeURIComponent(code)}`, { method: 'DELETE' })
  return res !== 'sin-nube' && res.ok
}

export async function fetchRemoteDepartments(): Promise<RemoteDepartments> {
  const res = await call('/api/departments')
  if (res === 'sin-nube') return { estado: 'sin-nube' }
  if (res.status === 401) return { estado: 'auth' }
  if (!res.ok) return { estado: 'sin-nube' }
  if (!(res.headers.get('content-type') ?? '').includes('application/json')) {
    return { estado: 'sin-nube' }
  }
  const body = (await res.json()) as {
    departamentos?: Record<string, DepartmentModule>
    versions?: Record<string, number>
  }
  return { estado: 'ok', departamentos: body.departamentos ?? {}, versions: body.versions ?? {} }
}

export function pushDepartment(
  modulo: DepartmentModule,
  baseVersion: number | null,
): Promise<PushResult<DepartmentModule>> {
  return push('/api/departments', { nombre: modulo.departamento, data: modulo, baseVersion })
}

export async function deleteRemoteDepartment(nombre: string): Promise<boolean> {
  const res = await call(`/api/departments?nombre=${encodeURIComponent(nombre)}`, { method: 'DELETE' })
  return res !== 'sin-nube' && res.ok
}
