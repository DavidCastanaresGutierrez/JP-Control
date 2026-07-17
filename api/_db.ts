import { neon } from '@neondatabase/serverless'
import type { NeonQueryFunction } from '@neondatabase/serverless'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireProjectAuth } from './_sso.js'
import { ensureUsersTable, getUserInfo, registerLogin } from './_roles.js'
import type { UserInfo } from './_roles.js'

export type Sql = NeonQueryFunction<false, false>

export interface DbContext {
  req: VercelRequest
  res: VercelResponse
  sql: Sql
  /** Email de la sesion SSO en minusculas ('' en modo APP_TOKEN legacy) */
  email: string
  /** Nombre del usuario segun el token SSO ('' si no lo trae) */
  nombre: string
  /** Rol y alcance del usuario; null en modo APP_TOKEN legacy (acceso completo) */
  me: UserInfo | null
}

export interface WithDbOptions {
  /** DDL perezoso del recurso (CREATE TABLE IF NOT EXISTS ...); se ejecuta una vez por instancia y se reintenta si fallo */
  init?: (sql: Sql) => Promise<unknown>
  /** Mensaje de error 403 si el endpoint exige sesion SSO con email (p.ej. gestion de usuarios) */
  requireEmailError?: string
  /** Da de alta / refresca el ultimo acceso del usuario ANTES de leer su rol (necesario para el admin bootstrap en el primer login) */
  registerLogin?: boolean
}

/**
 * Envuelve un endpoint con el boilerplate comun a toda la API: comprobacion de
 * DATABASE_URL, autenticacion, DDL perezoso del recurso, carga del rol del
 * usuario y manejo de errores. Los controles de rol especificos de cada
 * recurso se quedan en su handler.
 */
export function withDb(options: WithDbOptions, handler: (ctx: DbContext) => Promise<unknown>) {
  let initPromise: Promise<unknown> | null = null

  return async function (req: VercelRequest, res: VercelResponse) {
    const dbUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? ''
    if (!dbUrl) {
      return res.status(503).json({ error: 'Base de datos no configurada: falta DATABASE_URL en Vercel.' })
    }

    const auth = await requireProjectAuth(req, res)
    if (!auth) return

    const email = String(auth.email ?? '').trim().toLowerCase()
    if (options.requireEmailError && !email) {
      return res.status(403).json({ error: options.requireEmailError })
    }

    const sql = neon(dbUrl)
    try {
      if (options.init) {
        initPromise ??= options.init(sql)
        await initPromise
      }
      let me: UserInfo | null = null
      if (email) {
        await ensureUsersTable(sql)
        if (options.registerLogin) await registerLogin(sql, email, String(auth.name ?? email))
        me = await getUserInfo(sql, email)
      }
      return await handler({ req, res, sql, email, nombre: String(auth.name ?? ''), me })
    } catch (err) {
      initPromise = null
      return res.status(500).json({ error: err instanceof Error ? err.message : 'Error de base de datos.' })
    }
  }
}
