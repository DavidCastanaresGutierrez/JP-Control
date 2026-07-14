import { apiFetch } from './http'

export type Role = 'lectura' | 'edicion' | 'director_departamento' | 'contrato' | 'administracion'
export type NivelContrato = 'lectura' | 'edicion'

export interface AppUser {
  email: string
  name: string
  role: Role
  /** Departamento que dirige (solo rol director_departamento). */
  departamento: string | null
  /** Contrato al que tiene acceso en exclusiva (solo rol contrato). */
  proyectoAsignado: string | null
  /** Nivel de acceso a ese contrato (solo rol contrato). */
  nivelContrato: NivelContrato | null
  lastLoginAt: string
}

export type Me = Pick<AppUser, 'email' | 'role' | 'departamento' | 'proyectoAsignado' | 'nivelContrato'>

export type UsersResult = { estado: 'ok'; me: Me; users?: AppUser[] } | { estado: 'no-disponible' }

export async function fetchUsers(): Promise<UsersResult> {
  const res = await apiFetch('/api/users')
  if (!res || !res.ok) return { estado: 'no-disponible' }
  const body = (await res.json().catch(() => ({}))) as { me?: Me; users?: AppUser[] }
  if (!body.me) return { estado: 'no-disponible' }
  return { estado: 'ok', me: body.me, users: body.users }
}

export async function updateUserRole(
  email: string,
  role: Role,
  opts?: { departamento?: string | null; proyectoAsignado?: string | null; nivelContrato?: NivelContrato | null },
): Promise<{ ok: true } | { ok: false; error?: string }> {
  const res = await apiFetch('/api/users', {
    method: 'PUT',
    body: JSON.stringify({ email, role, ...opts }),
  })
  if (!res) return { ok: false }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    return { ok: false, error: body.error }
  }
  return { ok: true }
}
