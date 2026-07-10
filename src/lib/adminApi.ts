import { apiFetch } from './http'

export type Role = 'lectura' | 'edicion' | 'administracion'

export interface AppUser {
  email: string
  name: string
  role: Role
  lastLoginAt: string
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

export async function updateUserRole(email: string, role: Role): Promise<{ ok: true } | { ok: false; error?: string }> {
  const res = await apiFetch('/api/users', { method: 'PUT', body: JSON.stringify({ email, role }) })
  if (!res) return { ok: false }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    return { ok: false, error: body.error }
  }
  return { ok: true }
}
