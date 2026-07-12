import type { NeonQueryFunction } from '@neondatabase/serverless'

export type Role = 'lectura' | 'edicion' | 'director_departamento' | 'administracion'
export const ROLES: Role[] = ['lectura', 'edicion', 'director_departamento', 'administracion']

/** Roles con acceso al modulo de Control por Departamento. */
export function puedeAccederDepartamento(role: Role): boolean {
  return role === 'administracion' || role === 'director_departamento'
}

export interface AppUser {
  email: string
  name: string
  role: Role
  lastLoginAt: string
}

type Sql = NeonQueryFunction<false, false>

let usersTableReady: Promise<unknown> | null = null

export function ensureUsersTable(sql: Sql) {
  usersTableReady ??= sql`
    CREATE TABLE IF NOT EXISTS jp_users (
      email text PRIMARY KEY,
      name text NOT NULL DEFAULT '',
      role text NOT NULL DEFAULT 'edicion',
      last_login_at timestamptz NOT NULL DEFAULT now()
    )`
  return usersTableReady.catch((err) => {
    usersTableReady = null
    throw err
  })
}

/** Direcciones que siempre son administradoras, configurables via ADMIN_EMAILS
 *  (lista separada por comas). Se reafirma en cada login para autocorregir el rol
 *  si alguien lo hubiera cambiado a mano en la base de datos. */
function bootstrapAdminEmails(): Set<string> {
  const fromEnv = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return new Set(fromEnv.length > 0 ? fromEnv : ['dcastanares@typsa.es'])
}

function isBootstrapAdmin(email: string): boolean {
  return bootstrapAdminEmails().has(email.toLowerCase())
}

/** Da de alta (o actualiza el nombre/ultimo acceso de) el usuario que inicia sesion y devuelve su rol. */
export async function registerLogin(sql: Sql, email: string, name: string): Promise<Role> {
  if (isBootstrapAdmin(email)) {
    const rows = (await sql`
      INSERT INTO jp_users (email, name, role, last_login_at)
      VALUES (${email}, ${name}, 'administracion', now())
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = 'administracion', last_login_at = now()
      RETURNING role`) as { role: Role }[]
    return rows[0].role
  }
  const rows = (await sql`
    INSERT INTO jp_users (email, name, role, last_login_at)
    VALUES (${email}, ${name}, 'edicion', now())
    ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, last_login_at = now()
    RETURNING role`) as { role: Role }[]
  return rows[0].role
}

export { isBootstrapAdmin }

export async function getUserRole(sql: Sql, email: string): Promise<Role> {
  const rows = (await sql`SELECT role FROM jp_users WHERE email = ${email}`) as { role: Role }[]
  return rows[0]?.role ?? 'edicion'
}

export async function listUsers(sql: Sql): Promise<AppUser[]> {
  const rows = (await sql`
    SELECT email, name, role, last_login_at FROM jp_users ORDER BY last_login_at DESC`) as {
    email: string
    name: string
    role: Role
    last_login_at: string
  }[]
  return rows.map((r) => ({ email: r.email, name: r.name, role: r.role, lastLoginAt: r.last_login_at }))
}

export async function setUserRole(sql: Sql, email: string, role: Role): Promise<AppUser | null> {
  const rows = (await sql`
    UPDATE jp_users SET role = ${role} WHERE email = ${email}
    RETURNING email, name, role, last_login_at`) as {
    email: string
    name: string
    role: Role
    last_login_at: string
  }[]
  const row = rows[0]
  if (!row) return null
  return { email: row.email, name: row.name, role: row.role, lastLoginAt: row.last_login_at }
}
