import { withDb } from './_db.js'
import type { Sql } from './_db.js'

/**
 * Un único documento JSON con su `version` para el bloqueo optimista. El cliente
 * guarda la versión que conoce y la manda en el PUT; si en la base hay otra
 * (se guardó desde otro dispositivo mientras tanto) se responde 409 con la
 * versión vigente en vez de pisarla en silencio. Se usa una fila fija (id=1).
 */

async function init(sql: Sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS vc_state (
      id int PRIMARY KEY,
      data jsonb NOT NULL,
      version bigint NOT NULL DEFAULT 1,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`
}

export default withDb({ init }, async ({ req, res, sql }) => {
  if (req.method === 'GET') {
    const rows = await sql`SELECT data, version FROM vc_state WHERE id = 1`
    if (rows.length === 0) return res.status(200).json({ data: null, version: 0 })
    return res.status(200).json({ data: rows[0].data, version: Number(rows[0].version) })
  }

  if (req.method === 'PUT') {
    const { data, baseVersion } = (req.body ?? {}) as { data?: unknown; baseVersion?: number }
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Falta el campo data en el cuerpo.' })
    }
    const json = JSON.stringify(data)
    const base = typeof baseVersion === 'number' ? baseVersion : 0

    if (base === 0) {
      // Primera escritura: insertar si no existe la fila.
      const rows = await sql`
        INSERT INTO vc_state (id, data, version, updated_at)
        VALUES (1, ${json}::jsonb, 1, now())
        ON CONFLICT (id) DO NOTHING
        RETURNING version`
      if (rows.length > 0) return res.status(200).json({ ok: true, version: Number(rows[0].version) })
      // Ya existía: es un conflicto, hay algo más reciente en la nube.
    } else {
      const rows = await sql`
        UPDATE vc_state
        SET data = ${json}::jsonb, version = version + 1, updated_at = now()
        WHERE id = 1 AND version = ${base}
        RETURNING version`
      if (rows.length > 0) return res.status(200).json({ ok: true, version: Number(rows[0].version) })
    }

    // Conflicto: la versión no coincide (o la fila ya existía en la primera escritura).
    const actual = await sql`SELECT data, version FROM vc_state WHERE id = 1`
    return res.status(409).json({
      error: 'Hay una versión más reciente guardada desde otro dispositivo.',
      data: actual[0]?.data ?? null,
      version: actual[0] ? Number(actual[0].version) : 0,
    })
  }

  res.setHeader('Allow', 'GET, PUT')
  return res.status(405).json({ error: 'Método no permitido.' })
})
