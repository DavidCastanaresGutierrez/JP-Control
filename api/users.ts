import { neon } from '@neondatabase/serverless'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireProjectAuth } from './_sso.js'
import { ROLES, ensureUsersTable, isBootstrapAdmin, listUsers, registerLogin, setUserRole, type Role } from './_roles.js'

const DB_URL = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? ''

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!DB_URL) {
    return res.status(503).json({ error: 'Base de datos no configurada: falta DATABASE_URL en Vercel.' })
  }

  const auth = await requireProjectAuth(req, res)
  if (!auth) return
  const email = String(auth.email ?? '').trim().toLowerCase()
  if (!email) {
    return res.status(403).json({ error: 'La gestion de usuarios requiere sesion SSO.' })
  }

  const sql = neon(DB_URL)
  try {
    await ensureUsersTable(sql)
    const myRole = await registerLogin(sql, email, String(auth.name ?? email))

    if (req.method === 'GET') {
      if (myRole !== 'administracion') {
        return res.status(200).json({ me: { email, role: myRole } })
      }
      const users = await listUsers(sql)
      return res.status(200).json({ me: { email, role: myRole }, users })
    }

    if (req.method === 'PUT') {
      if (myRole !== 'administracion') {
        return res.status(403).json({ error: 'Solo un administrador puede cambiar roles.' })
      }
      const { email: targetEmail, role } = (req.body ?? {}) as { email?: string; role?: string }
      const normalized = String(targetEmail ?? '').trim().toLowerCase()
      if (!normalized || !ROLES.includes(role as Role)) {
        return res.status(400).json({ error: 'Faltan email o role validos.' })
      }
      if (normalized === email && role !== 'administracion') {
        return res.status(400).json({ error: 'No puedes quitarte a ti mismo el rol de administracion.' })
      }
      if (isBootstrapAdmin(normalized) && role !== 'administracion') {
        return res.status(400).json({ error: 'Este usuario es administrador fijo de la aplicacion y no se le puede quitar el rol.' })
      }
      const updated = await setUserRole(sql, normalized, role as Role)
      if (!updated) return res.status(404).json({ error: 'Usuario no encontrado.' })
      return res.status(200).json({ user: updated })
    }

    res.setHeader('Allow', 'GET, PUT')
    return res.status(405).json({ error: 'Metodo no permitido.' })
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Error de base de datos.' })
  }
}
