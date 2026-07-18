import { neon } from '@neondatabase/serverless'
import type { NeonQueryFunction } from '@neondatabase/serverless'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export type Sql = NeonQueryFunction<false, false>

export interface DbContext {
  req: VercelRequest
  res: VercelResponse
  sql: Sql
}

/**
 * Envuelve un endpoint con el boilerplate común: comprobación de DATABASE_URL,
 * autenticación por código de acceso (APP_TOKEN), DDL perezoso y manejo de
 * errores. Es una versión personal —un solo usuario— sin SSO ni roles.
 */
export function withDb(
  options: { init?: (sql: Sql) => Promise<unknown> },
  handler: (ctx: DbContext) => Promise<unknown>,
) {
  let initPromise: Promise<unknown> | null = null

  return async function (req: VercelRequest, res: VercelResponse) {
    const dbUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? ''
    if (!dbUrl) {
      return res.status(503).json({ error: 'Base de datos no configurada: falta DATABASE_URL en Vercel.' })
    }

    // Código de acceso compartido. Si APP_TOKEN está definido, se exige en la
    // cabecera Authorization: Bearer <token>. Sin él, la API queda abierta.
    const esperado = process.env.APP_TOKEN ?? ''
    if (esperado) {
      const auth = req.headers.authorization ?? ''
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
      if (token !== esperado) {
        return res.status(401).json({ error: 'Código de acceso incorrecto.' })
      }
    }

    const sql = neon(dbUrl)
    try {
      if (options.init) {
        initPromise ??= options.init(sql)
        await initPromise
      }
      return await handler({ req, res, sql })
    } catch (err) {
      initPromise = null
      return res.status(500).json({ error: err instanceof Error ? err.message : 'Error de base de datos.' })
    }
  }
}
