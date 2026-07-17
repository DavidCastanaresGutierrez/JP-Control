import { withDb } from './_db.js'
import type { Sql } from './_db.js'

/**
 * Fila con version para el bloqueo optimista: el cliente guarda la version que
 * conoce de cada proyecto y la manda en el PUT; si en la base de datos hay una
 * version distinta (otro usuario guardo mientras tanto) se responde 409 con la
 * version actual en vez de pisarla en silencio.
 */

async function init(sql: Sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS jp_projects (
      code text PRIMARY KEY,
      data jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`
  await sql`ALTER TABLE jp_projects ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1`
  // Soft-delete: el DELETE marca la fila en vez de destruirla, para poder
  // recuperar un proyecto borrado por error (basta reimportarlo o restaurar
  // deleted_at a NULL a mano). El GET solo devuelve filas vivas.
  await sql`ALTER TABLE jp_projects ADD COLUMN IF NOT EXISTS deleted_at timestamptz`
}

export default withDb({ init }, async ({ req, res, sql, me }) => {
  if (req.method === 'GET') {
    const rows = await sql`SELECT code, data, version FROM jp_projects WHERE deleted_at IS NULL`
    const projects: Record<string, unknown> = {}
    const versions: Record<string, number> = {}
    for (const r of rows) {
      const code = r.code as string
      if (!me || me.role !== 'contrato' || me.proyectoAsignado === code) {
        projects[code] = r.data
        versions[code] = Number(r.version)
      }
    }
    return res.status(200).json({ projects, versions })
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
    const { code, data, baseVersion } = (req.body ?? {}) as {
      code?: string
      data?: unknown
      baseVersion?: number | null
    }
    if (!code || typeof code !== 'string' || !data) {
      return res.status(400).json({ error: 'Faltan code o data en el cuerpo.' })
    }
    const json = JSON.stringify(data)

    // Cliente antiguo (sin baseVersion): upsert incondicional, como antes
    if (baseVersion === undefined) {
      const rows = await sql`
        INSERT INTO jp_projects (code, data, updated_at)
        VALUES (${code}, ${json}::jsonb, now())
        ON CONFLICT (code) DO UPDATE SET data = EXCLUDED.data, updated_at = now(), version = jp_projects.version + 1, deleted_at = NULL
        RETURNING version`
      return res.status(200).json({ ok: true, version: Number(rows[0].version) })
    }

    if (baseVersion === null) {
      // El cliente cree que el proyecto es nuevo: insertar si no existe, o
      // revivir la fila si estaba borrada (soft-delete)
      const rows = await sql`
        INSERT INTO jp_projects (code, data, updated_at)
        VALUES (${code}, ${json}::jsonb, now())
        ON CONFLICT (code) DO UPDATE SET data = EXCLUDED.data, updated_at = now(), version = jp_projects.version + 1, deleted_at = NULL
        WHERE jp_projects.deleted_at IS NOT NULL
        RETURNING version`
      if (rows.length > 0) return res.status(200).json({ ok: true, version: Number(rows[0].version) })
    } else {
      // Actualizacion condicionada a la version que el cliente conoce (revive
      // la fila si estaba borrada: reimportar un proyecto lo recupera)
      const rows = await sql`
        UPDATE jp_projects
        SET data = ${json}::jsonb, updated_at = now(), version = version + 1, deleted_at = NULL
        WHERE code = ${code} AND version = ${baseVersion}
        RETURNING version`
      if (rows.length > 0) return res.status(200).json({ ok: true, version: Number(rows[0].version) })
      // Sin fila: o la version no coincide, o la fila no existe (se recrea)
      const recreated = await sql`
        INSERT INTO jp_projects (code, data, updated_at)
        VALUES (${code}, ${json}::jsonb, now())
        ON CONFLICT (code) DO UPDATE SET data = EXCLUDED.data, updated_at = now(), version = jp_projects.version + 1, deleted_at = NULL
        WHERE jp_projects.deleted_at IS NOT NULL
        RETURNING version`
      if (recreated.length > 0) return res.status(200).json({ ok: true, version: Number(recreated[0].version) })
    }

    // Conflicto: otro usuario guardo una version mas reciente
    const current = await sql`SELECT data, version FROM jp_projects WHERE code = ${code} AND deleted_at IS NULL`
    return res.status(409).json({
      error: 'Otro usuario ha guardado una version mas reciente de este proyecto.',
      data: current[0]?.data ?? null,
      version: current[0] ? Number(current[0].version) : null,
    })
  }

  if (req.method === 'DELETE') {
    const code = typeof req.query.code === 'string' ? req.query.code : ''
    if (!code) return res.status(400).json({ error: 'Falta el parametro code.' })
    // Soft-delete: la fila queda marcada (recuperable reimportando el proyecto
    // o poniendo deleted_at a NULL en la base de datos)
    await sql`UPDATE jp_projects SET deleted_at = now(), updated_at = now() WHERE code = ${code}`
    return res.status(200).json({ ok: true })
  }

  res.setHeader('Allow', 'GET, PUT, DELETE')
  return res.status(405).json({ error: 'Metodo no permitido.' })
})
