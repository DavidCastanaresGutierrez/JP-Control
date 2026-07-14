import { neon } from '@neondatabase/serverless'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireProjectAuth } from './_sso.js'
import { ensureUsersTable, getUserInfo, puedeAccederDepartamentoConcreto } from './_roles.js'

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
      CREATE TABLE IF NOT EXISTS jp_departments (
        nombre text PRIMARY KEY,
        data jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`
    await initPromise

    const email = String(auth.email ?? '').trim().toLowerCase()
    let me: Awaited<ReturnType<typeof getUserInfo>> | null = null
    if (email) {
      await ensureUsersTable(sql)
      me = await getUserInfo(sql, email)
      if (me.role !== 'administracion' && me.role !== 'director_departamento') {
        return res.status(403).json({ error: 'No tienes acceso al modulo de Control por Departamento.' })
      }
    }

    if (req.method === 'GET') {
      const rows = await sql`SELECT nombre, data FROM jp_departments`
      const departamentos: Record<string, unknown> = {}
      for (const r of rows) {
        const nombre = r.nombre as string
        if (!me || puedeAccederDepartamentoConcreto(me.role, me.departamento, nombre)) {
          departamentos[nombre] = r.data
        }
      }
      return res.status(200).json({ departamentos })
    }

    if (req.method === 'PUT') {
      const { nombre, data } = (req.body ?? {}) as { nombre?: string; data?: unknown }
      if (!nombre || typeof nombre !== 'string' || !data) {
        return res.status(400).json({ error: 'Faltan nombre o data en el cuerpo.' })
      }
      if (me && !puedeAccederDepartamentoConcreto(me.role, me.departamento, nombre)) {
        return res.status(403).json({ error: 'No tienes acceso a este departamento.' })
      }
      await sql`
        INSERT INTO jp_departments (nombre, data, updated_at)
        VALUES (${nombre}, ${JSON.stringify(data)}::jsonb, now())
        ON CONFLICT (nombre) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`
      return res.status(200).json({ ok: true })
    }

    if (req.method === 'DELETE') {
      const nombre = typeof req.query.nombre === 'string' ? req.query.nombre : ''
      if (!nombre) return res.status(400).json({ error: 'Falta el parametro nombre.' })
      if (me && !puedeAccederDepartamentoConcreto(me.role, me.departamento, nombre)) {
        return res.status(403).json({ error: 'No tienes acceso a este departamento.' })
      }
      await sql`DELETE FROM jp_departments WHERE nombre = ${nombre}`
      return res.status(200).json({ ok: true })
    }

    res.setHeader('Allow', 'GET, PUT, DELETE')
    return res.status(405).json({ error: 'Metodo no permitido.' })
  } catch (err) {
    initPromise = null
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Error de base de datos.' })
  }
}
