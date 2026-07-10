import type { AppUser, Role } from '../lib/adminApi'
import { repairMojibake } from '../lib/format'

const ROLE_LABELS: Record<Role, string> = {
  lectura: 'Lectura',
  edicion: 'Edicion',
  administracion: 'Administracion',
}

const ROLE_HINTS: Record<Role, string> = {
  lectura: 'Puede ver los proyectos pero no modificarlos.',
  edicion: 'Puede ver y modificar los proyectos.',
  administracion: 'Ademas puede gestionar los roles de otros usuarios.',
}

function formatFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

export function AdminPanel({
  meEmail,
  users,
  onChangeRole,
}: {
  meEmail: string
  users: AppUser[]
  onChangeRole: (email: string, role: Role) => void
}) {
  return (
    <div className="max-w-4xl p-4 sm:p-8">
      <h2 className="font-display text-2xl font-extrabold text-ink">Administracion de usuarios</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Asigna el rol de cada persona que ha iniciado sesion en la aplicacion. Lectura solo permite ver los
        proyectos; Edicion permite modificarlos; Administracion permite ademas gestionar estos roles.
      </p>

      <div className="mt-6 overflow-x-auto rounded-[24px] border border-line bg-surface shadow-soft">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs font-bold uppercase tracking-wider text-ink-soft">
              <th className="px-5 py-3">Usuario</th>
              <th className="px-5 py-3">Ultimo acceso</th>
              <th className="px-5 py-3">Rol</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-6 text-center text-ink-soft">
                  Todavia no hay usuarios registrados.
                </td>
              </tr>
            )}
            {users.map((user) => (
              <tr key={user.email} className="border-b border-line last:border-0">
                <td className="px-5 py-3">
                  <div className="font-semibold text-ink">{repairMojibake(user.name) || user.email}</div>
                  <div className="text-xs text-ink-soft">{user.email}</div>
                </td>
                <td className="px-5 py-3 text-ink-soft">{formatFecha(user.lastLoginAt)}</td>
                <td className="px-5 py-3">
                  <select
                    value={user.role}
                    onChange={(e) => onChangeRole(user.email, e.target.value as Role)}
                    title={ROLE_HINTS[user.role]}
                    className="border border-line rounded-[10px] px-3 py-2 text-sm bg-surface text-ink focus:ring-2 focus:ring-accent-500/40 focus:border-accent-500 outline-none"
                  >
                    {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                  {user.email.toLowerCase() === meEmail.toLowerCase() && (
                    <span className="ml-2 text-xs text-ink-soft">(tu)</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
