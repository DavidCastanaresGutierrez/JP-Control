import type { NeonQueryFunction } from '@neondatabase/serverless'

export type Role = 'lectura' | 'edicion' | 'director_departamento' | 'contrato' | 'administracion'
export const ROLES: Role[] = ['lectura', 'edicion', 'director_departamento', 'contrato', 'administracion']

export type NivelContrato = 'lectura' | 'edicion'

/** Roles con acceso al modulo de Control por Departamento (en general, sin mirar de cual). */
export function puedeAccederDepartamento(role: Role): boolean {
  return role === 'administracion' || role === 'director_departamento'
}

/** Si puede leer/editar el departamento concreto `nombre`: administracion accede a todos,
 *  director_departamento solo al que tiene asignado. */
export function puedeAccederDepartamentoConcreto(
  role: Role,
  departamentoAsignado: string | null | undefined,
  nombre: string,
): boolean {
  if (role === 'administracion') return true
  if (role === 'director_departamento') return Boolean(departamentoAsignado) && departamentoAsignado === nombre
  return false
}

// --- Coincidencia de JP por nombre/email ---------------------------------
// Copia deliberada de la logica de src/lib/format.ts (repairMojibake,
// normalizarTexto) y src/lib/projectAccess.ts (esJpDelUsuario). No se puede
// importar desde src/ aqui: el frontend se compila con Vite y usa specifiers
// con extension .ts (allowImportingTsExtensions), mientras que la API la
// compila @vercel/node y exige specifiers .js; cruzar ese limite rompe en
// produccion con ERR_MODULE_NOT_FOUND. Si cambia la logica alli, replicarla aqui.

function repairMojibake(value?: string): string {
  const text = (value ?? '').trim()
  if (!/[ÃÂâ]/.test(text)) return text
  try {
    const bytes = Uint8Array.from([...text].map((char) => char.charCodeAt(0) & 0xff))
    return new TextDecoder('utf-8').decode(bytes)
  } catch {
    return text
  }
}

function normalizarTexto(value: string): string {
  return repairMojibake(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
}

function tokensNombre(value: string): string[] {
  return normalizarTexto(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((token) => token.length > 1)
}

/**
 * Determina si el usuario logueado figura como JP del proyecto, cotejando
 * nombre y email. Acepta cualquier objeto con `jp` para poder usarse tambien
 * desde la API (que solo carga ese campo del jsonb).
 */
export function esJpDelUsuario(
  project: { jp?: string | null },
  userName?: string,
  userEmail?: string,
): boolean {
  if (!project.jp) return false
  const jp = new Set(tokensNombre(project.jp))
  if (jp.size === 0) return false

  const usuario = new Set(tokensNombre(userName ?? ''))
  let comunes = 0
  for (const token of jp) if (usuario.has(token)) comunes++
  if (jp.size === 1 ? comunes >= 1 : comunes >= 2) return true

  // Red de seguridad: emails tipo "dcastanares" contienen el apellido del JP.
  const emailLocal = normalizarTexto((userEmail ?? '').split('@')[0]).replace(/[^a-z0-9]+/g, '')
  return emailLocal.length >= 4 && [...jp].some((token) => token.length >= 4 && emailLocal.includes(token))
}

export interface AppUser {
  email: string
  name: string
  role: Role
  /** Departamento que dirige (solo aplica al rol director_departamento). */
  departamento: string | null
  /** Contrato al que tiene acceso en exclusiva (solo aplica al rol contrato). */
  proyectoAsignado: string | null
  /** Nivel de acceso a ese contrato (solo aplica al rol contrato). */
  nivelContrato: NivelContrato | null
  lastLoginAt: string
}

export interface UserInfo {
  role: Role
  departamento: string | null
  proyectoAsignado: string | null
  nivelContrato: NivelContrato | null
}

type Sql = NeonQueryFunction<false, false>

let usersTableReady: Promise<unknown> | null = null

export function ensureUsersTable(sql: Sql) {
  usersTableReady ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS jp_users (
        email text PRIMARY KEY,
        name text NOT NULL DEFAULT '',
        role text NOT NULL DEFAULT 'edicion',
        last_login_at timestamptz NOT NULL DEFAULT now()
      )`
    await sql`ALTER TABLE jp_users ADD COLUMN IF NOT EXISTS departamento text`
    await sql`ALTER TABLE jp_users ADD COLUMN IF NOT EXISTS proyecto_asignado text`
    await sql`ALTER TABLE jp_users ADD COLUMN IF NOT EXISTS nivel_contrato text`
  })()
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

/** Rol + alcance (departamento asignado / contrato asignado) del usuario, para las comprobaciones
 *  de acceso de los endpoints de proyectos y departamentos. */
export async function getUserInfo(sql: Sql, email: string): Promise<UserInfo> {
  const rows = (await sql`
    SELECT role, departamento, proyecto_asignado, nivel_contrato FROM jp_users WHERE email = ${email}`) as {
    role: Role
    departamento: string | null
    proyecto_asignado: string | null
    nivel_contrato: NivelContrato | null
  }[]
  const row = rows[0]
  if (!row) return { role: 'edicion', departamento: null, proyectoAsignado: null, nivelContrato: null }
  return {
    role: row.role,
    departamento: row.departamento,
    proyectoAsignado: row.proyecto_asignado,
    nivelContrato: row.nivel_contrato,
  }
}

export async function listUsers(sql: Sql): Promise<AppUser[]> {
  const rows = (await sql`
    SELECT email, name, role, departamento, proyecto_asignado, nivel_contrato, last_login_at
    FROM jp_users ORDER BY last_login_at DESC`) as {
    email: string
    name: string
    role: Role
    departamento: string | null
    proyecto_asignado: string | null
    nivel_contrato: NivelContrato | null
    last_login_at: string
  }[]
  return rows.map((r) => ({
    email: r.email,
    name: r.name,
    role: r.role,
    departamento: r.departamento,
    proyectoAsignado: r.proyecto_asignado,
    nivelContrato: r.nivel_contrato,
    lastLoginAt: r.last_login_at,
  }))
}

export async function setUserRole(
  sql: Sql,
  email: string,
  role: Role,
  departamento?: string | null,
  proyectoAsignado?: string | null,
  nivelContrato?: NivelContrato | null,
): Promise<AppUser | null> {
  const departamentoFinal = role === 'director_departamento' ? (departamento ?? null) : null
  const proyectoFinal = role === 'contrato' ? (proyectoAsignado ?? null) : null
  const nivelFinal = role === 'contrato' ? (nivelContrato ?? 'lectura') : null
  const rows = (await sql`
    UPDATE jp_users
    SET role = ${role}, departamento = ${departamentoFinal}, proyecto_asignado = ${proyectoFinal}, nivel_contrato = ${nivelFinal}
    WHERE email = ${email}
    RETURNING email, name, role, departamento, proyecto_asignado, nivel_contrato, last_login_at`) as {
    email: string
    name: string
    role: Role
    departamento: string | null
    proyecto_asignado: string | null
    nivel_contrato: NivelContrato | null
    last_login_at: string
  }[]
  const row = rows[0]
  if (!row) return null
  return {
    email: row.email,
    name: row.name,
    role: row.role,
    departamento: row.departamento,
    proyectoAsignado: row.proyecto_asignado,
    nivelContrato: row.nivel_contrato,
    lastLoginAt: row.last_login_at,
  }
}
