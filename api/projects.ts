import { neon } from '@neondatabase/serverless'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireProjectAuth } from './_sso.js'
import { ensureUsersTable, getUserInfo } from './_roles.js'

const DB_URL = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? ''

let initPromise: Promise<unknown> | null = null

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!DB_URL) {
    return res.status(503).json({ error: 'Base de datos no configurada: falta DATABASE_URL en Vercel.' })
  }

  const auth = await requireProjectAuth(req, res)
  if (!auth) return

  const sql = neon(DB_URL)
  try {
    initPromise ??= sql`
      CREATE TABLE IF NOT EXISTS jp_projects (
        code text PRIMARY KEY,
        data jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`
    await initPromise

    const email = String(auth.email ?? '').trim().toLowerCase()
    let me: Awaited<ReturnType<typeof getUserInfo>> | null = null
    if (email) {
      await ensureUsersTable(sql)
      me = await getUserInfo(sql, email)
    }

    if (req.method === 'GET') {
      const rows = await sql`SELECT code, data FROM jp_projects`
      const projects: Record<string, unknown> = {}
      for (const r of rows) {
        const code = r.code as string
        if (!me || me.role !== 'contrato' || me.proyectoAsignado === code) {
          projects[code] = r.data
        }
      }
      return res.status(200).json({ projects })
    }

    if (req.method === 'PUT' || req.method === 'DELETE') {
      const targetCode =
        req.method === 'PUT'
          ? String((req.body as { code?: string } | undefined)?.code ?? '')
          : typeof req.query.code === 'string'
            ? req.query.code
            : ''
      if (me) {
        if (me.role === 'lectura') {
          return res.status(403).json({ error: 'Tu rol es de solo lectura: no puedes modificar proyectos.' })
        }
        if (me.role === 'contrato') {
          if (me.proyectoAsignado !== targetCode) {
            return res.status(403).json({ error: 'Solo tienes acceso al contrato asignado.' })
          }
          if (me.nivelContrato !== 'edicion') {
            return res.status(403).json({ error: 'Tu acceso a este contrato es de solo lectura.' })
          }
        }
      }
    }

    if (req.method === 'PUT') {
      const { code, data } = (req.body ?? {}) as { code?: string; data?: unknown }
      if (!code || typeof code !== 'string' || !data) {
        return res.status(400).json({ error: 'Faltan code o data en el cuerpo.' })
      }
      await sql`
        INSERT INTO jp_projects (code, data, updated_at)
        VALUES (${code}, ${JSON.stringify(data)}::jsonb, now())
        ON CONFLICT (code) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`
      return res.status(200).json({ ok: true })
    }

    if (req.method === 'DELETE') {
      const code = typeof req.query.code === 'string' ? req.query.code : ''
      if (!code) return res.status(400).json({ error: 'Falta el parametro code.' })
      await sql`DELETE FROM jp_projects WHERE code = ${code}`
      return res.status(200).json({ ok: true })
    }

    res.setHeader('Allow', 'GET, PUT, DELETE')
    return res.status(405).json({ error: 'Metodo no permitido.' })
  } catch (err) {
    initPromise = null
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Error de base de datos.' })
  }
}
