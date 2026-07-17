import { withDb } from './_db.js'
import type { Sql } from './_db.js'
import { puedeAccederDepartamentoConcreto } from './_roles.js'

async function init(sql: Sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS jp_departments (
      nombre text PRIMARY KEY,
      data jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`
  await sql`ALTER TABLE jp_departments ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1`
  // Soft-delete: el DELETE marca la fila en vez de destruirla (recuperable)
  await sql`ALTER TABLE jp_departments ADD COLUMN IF NOT EXISTS deleted_at timestamptz`
}

export default withDb({ init }, async ({ req, res, sql, me }) => {
  if (me && me.role !== 'administracion' && me.role !== 'director_departamento') {
    return res.status(403).json({ error: 'No tienes acceso al modulo de Control por Departamento.' })
  }

  if (req.method === 'GET') {
    const rows = await sql`SELECT nombre, data, version FROM jp_departments WHERE deleted_at IS NULL`
    const departamentos: Record<string, unknown> = {}
    const versions: Record<string, number> = {}
    for (const r of rows) {
      const nombre = r.nombre as string
      if (!me || puedeAccederDepartamentoConcreto(me.role, me.departamento, nombre)) {
        departamentos[nombre] = r.data
        versions[nombre] = Number(r.version)
      }
    }
    return res.status(200).json({ departamentos, versions })
  }

  if (req.method === 'PUT') {
    const { nombre, data, baseVersion } = (req.body ?? {}) as {
      nombre?: string
      data?: unknown
      baseVersion?: number | null
    }
    if (!nombre || typeof nombre !== 'string' || !data) {
      return res.status(400).json({ error: 'Faltan nombre o data en el cuerpo.' })
    }
    if (me && !puedeAccederDepartamentoConcreto(me.role, me.departamento, nombre)) {
      return res.status(403).json({ error: 'No tienes acceso a este departamento.' })
    }
    const json = JSON.stringify(data)

    // Cliente antiguo (sin baseVersion): upsert incondicional, como antes
    if (baseVersion === undefined) {
      const rows = await sql`
        INSERT INTO jp_departments (nombre, data, updated_at)
        VALUES (${nombre}, ${json}::jsonb, now())
        ON CONFLICT (nombre) DO UPDATE SET data = EXCLUDED.data, updated_at = now(), version = jp_departments.version + 1, deleted_at = NULL
        RETURNING version`
      return res.status(200).json({ ok: true, version: Number(rows[0].version) })
    }

    if (baseVersion === null) {
      const rows = await sql`
        INSERT INTO jp_departments (nombre, data, updated_at)
        VALUES (${nombre}, ${json}::jsonb, now())
        ON CONFLICT (nombre) DO UPDATE SET data = EXCLUDED.data, updated_at = now(), version = jp_departments.version + 1, deleted_at = NULL
        WHERE jp_departments.deleted_at IS NOT NULL
        RETURNING version`
      if (rows.length > 0) return res.status(200).json({ ok: true, version: Number(rows[0].version) })
    } else {
      const rows = await sql`
        UPDATE jp_departments
        SET data = ${json}::jsonb, updated_at = now(), version = version + 1, deleted_at = NULL
        WHERE nombre = ${nombre} AND version = ${baseVersion}
        RETURNING version`
      if (rows.length > 0) return res.status(200).json({ ok: true, version: Number(rows[0].version) })
      const recreated = await sql`
        INSERT INTO jp_departments (nombre, data, updated_at)
        VALUES (${nombre}, ${json}::jsonb, now())
        ON CONFLICT (nombre) DO UPDATE SET data = EXCLUDED.data, updated_at = now(), version = jp_departments.version + 1, deleted_at = NULL
        WHERE jp_departments.deleted_at IS NOT NULL
        RETURNING version`
      if (recreated.length > 0) return res.status(200).json({ ok: true, version: Number(recreated[0].version) })
    }

    const current = await sql`SELECT data, version FROM jp_departments WHERE nombre = ${nombre} AND deleted_at IS NULL`
    return res.status(409).json({
      error: 'Otro usuario ha guardado una version mas reciente de este departamento.',
      data: current[0]?.data ?? null,
      version: current[0] ? Number(current[0].version) : null,
    })
  }

  if (req.method === 'DELETE') {
    const nombre = typeof req.query.nombre === 'string' ? req.query.nombre : ''
    if (!nombre) return res.status(400).json({ error: 'Falta el parametro nombre.' })
    if (me && !puedeAccederDepartamentoConcreto(me.role, me.departamento, nombre)) {
      return res.status(403).json({ error: 'No tienes acceso a este departamento.' })
    }
    await sql`UPDATE jp_departments SET deleted_at = now(), updated_at = now() WHERE nombre = ${nombre}`
    return res.status(200).json({ ok: true })
  }

  res.setHeader('Allow', 'GET, PUT, DELETE')
  return res.status(405).json({ error: 'Metodo no permitido.' })
})
