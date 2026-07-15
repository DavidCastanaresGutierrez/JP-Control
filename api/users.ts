import { withDb } from './_db.js'
import { ROLES, isBootstrapAdmin, listUsers, setUserRole } from './_roles.js'
import type { NivelContrato, Role } from './_roles.js'

function esEmailTypsaValido(email: string): boolean {
  return /^[^\s@]+@(typsa\.es|typsa\.com)$/i.test(email)
}

const NIVELES_CONTRATO: NivelContrato[] = ['lectura', 'edicion']

export default withDb(
  {
    requireEmailError: 'La gestion de usuarios requiere sesion SSO.',
    registerLogin: true,
  },
  async ({ req, res, sql, email, me }) => {
    if (!me) return res.status(403).json({ error: 'La gestion de usuarios requiere sesion SSO.' })

    if (req.method === 'GET') {
      if (me.role !== 'administracion') {
        return res.status(200).json({ me: { email, ...me } })
      }
      const users = await listUsers(sql)
      return res.status(200).json({ me: { email, ...me }, users })
    }

    if (req.method === 'PUT') {
      if (me.role !== 'administracion') {
        return res.status(403).json({ error: 'Solo un administrador puede cambiar roles.' })
      }
      const {
        email: targetEmail,
        role,
        departamento,
        proyectoAsignado,
        nivelContrato,
      } = (req.body ?? {}) as {
        email?: string
        role?: string
        departamento?: string | null
        proyectoAsignado?: string | null
        nivelContrato?: string | null
      }
      const normalized = String(targetEmail ?? '').trim().toLowerCase()
      if (!normalized || !ROLES.includes(role as Role)) {
        return res.status(400).json({ error: 'Faltan email o role validos.' })
      }
      if (!esEmailTypsaValido(normalized)) {
        return res.status(400).json({ error: 'El email debe ser una cuenta @typsa.es o @typsa.com.' })
      }
      if (normalized === email && role !== 'administracion') {
        return res.status(400).json({ error: 'No puedes quitarte a ti mismo el rol de administracion.' })
      }
      if (isBootstrapAdmin(normalized) && role !== 'administracion') {
        return res.status(400).json({ error: 'Este usuario es administrador fijo de la aplicacion y no se le puede quitar el rol.' })
      }
      if (role === 'director_departamento' && !departamento) {
        return res.status(400).json({ error: 'Falta el departamento a asignar.' })
      }
      if (role === 'contrato') {
        if (!proyectoAsignado) {
          return res.status(400).json({ error: 'Falta el contrato a asignar.' })
        }
        if (nivelContrato && !NIVELES_CONTRATO.includes(nivelContrato as NivelContrato)) {
          return res.status(400).json({ error: 'Nivel de acceso al contrato no valido.' })
        }
      }
      const updated = await setUserRole(
        sql,
        normalized,
        role as Role,
        departamento,
        proyectoAsignado,
        (nivelContrato as NivelContrato) ?? 'lectura',
      )
      if (!updated) return res.status(404).json({ error: 'Usuario no encontrado.' })
      return res.status(200).json({ user: updated })
    }

    res.setHeader('Allow', 'GET, PUT')
    return res.status(405).json({ error: 'Metodo no permitido.' })
  },
)
