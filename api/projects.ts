import { neon } from '@neondatabase/serverless'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// Cadena de conexión: la integración Neon/Vercel Postgres define DATABASE_URL
// (o POSTGRES_URL según la versión de la integración).
const DB_URL = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? ''

// La tabla se crea de forma perezosa una vez por arranque en frío.
let initPromise: Promise<unknown> | null = null

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!DB_URL) {
    return res
      .status(503)
      .json({ error: 'Base de datos no configurada: falta DATABASE_URL en Vercel.' })
  }

  // Código de acceso compartido: si APP_TOKEN está definido en Vercel, se exige.
  const token = process.env.APP_TOKEN
  if (token) {
    const auth = req.headers.authorization ?? ''
    if (auth !== `Bearer ${token}`) {
      return res.status(401).json({ error: 'Código de acceso incorrecto.' })
    }
  }

  const sql = neon(DB_URL)
  try {
    initPromise ??= sql`
      CREATE TABLE IF NOT EXISTS jp_projects (
        code text PRIMARY KEY,
        data jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`
    await initPromise

    if (req.method === 'GET') {
      const rows = await sql`SELECT code, data FROM jp_projects`
      const projects: Record<string, unknown> = {}
      for (const r of rows) projects[r.code as string] = r.data
      return res.status(200).json({ projects })
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
      if (!code) return res.status(400).json({ error: 'Falta el parámetro code.' })
      await sql`DELETE FROM jp_projects WHERE code = ${code}`
      return res.status(200).json({ ok: true })
    }

    res.setHeader('Allow', 'GET, PUT, DELETE')
    return res.status(405).json({ error: 'Método no permitido.' })
  } catch (err) {
    initPromise = null // reintentar la creación de tabla en la siguiente petición
    return res
      .status(500)
      .json({ error: err instanceof Error ? err.message : 'Error de base de datos.' })
  }
}
