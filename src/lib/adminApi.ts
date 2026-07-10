import { apiFetch } from './http'

export type Role = 'lectura' | 'edicion' | 'administracion'

export interface AppUser {
  email: string
  name: string
  role: Role
  lastLoginAt: string | null
}

type PutUserResult = { ok: true; user: AppUser } | { ok: false; error?: string }

async function putUser(body: { email: string; role: Role; name?: string }): Promise<PutUserResult> {
  const res = await apiFetch('/api/users', { method: 'PUT', body: JSON.stringify(body) })
  if (!res) return { ok: false }
  const data = (await res.json().catch(() => ({}))) as { user?: AppUser; error?: string }
  if (!res.ok || !data.user) return { ok: false, error: data.error }
  return { ok: true, user: data.user }
}

export type UsersResult =
  | { estado: 'ok'; me: { email: string; role: Role }; users?: AppUser[] }
  | { estado: 'no-disponible' }

export async function fetchUsers(): Promise<UsersResult> {
  const res = await apiFetch('/api/users')
  if (!res || !res.ok) return { estado: 'no-disponible' }
  const body = (await res.json().catch(() => ({}))) as {
    me?: { email: string; role: Role }
    users?: AppUser[]
  }
  if (!body.me) return { estado: 'no-disponible' }
  return { estado: 'ok', me: body.me, users: body.users }
}

/** Anade un usuario nuevo con ese rol, o cambia el rol de uno existente: el backend hace upsert. */
export async function saveUserRole(email: string, role: Role): Promise<PutUserResult> {
  return putUser({ email, role })
}
