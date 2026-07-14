import { useState } from 'react'
import type { AppUser, NivelContrato, Role } from '../lib/adminApi'
import type { Project } from '../types'
import { DEPARTAMENTOS_REALES } from '../types'
import { repairMojibake } from '../lib/format'

const ROLE_LABELS: Record<Role, string> = {
  lectura: 'Lectura',
  edicion: 'Edicion (JP)',
  director_departamento: 'Director de departamento',
  contrato: 'Acceso a un contrato',
  administracion: 'Administracion',
}

const ROLE_HINTS: Record<Role, string> = {
  lectura: 'Puede ver todos los proyectos pero no modificarlos. Sin acceso a Control por Departamento.',
  edicion: 'Puede ver y modificar todos los proyectos. Sin acceso a Control por Departamento.',
  director_departamento:
    'Puede ver y modificar todos los proyectos, y ademas ve y edita el departamento que tenga asignado.',
  contrato: 'Solo ve el contrato asignado, con el nivel de acceso (lectura o edicion) que se le indique.',
  administracion:
    'Acceso completo a todos los proyectos y a todos los departamentos, y puede gestionar los roles de otros usuarios.',
}

function formatFecha(iso: string | null): string {
  if (!iso) return 'Nunca'
  try {
    return new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function normalizarBusqueda(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/** Buscador con desplegable para elegir un contrato entre muchos, en vez de un select gigante. */
function ContratoPicker({
  projects,
  value,
  onSelect,
}: {
  projects: Project[]
  value: string | null
  onSelect: (code: string) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const seleccionado = projects.find((p) => p.code === value)
  const q = normalizarBusqueda(query)
  const filtrados = q
    ? projects.filter(
        (p) => normalizarBusqueda(p.code).includes(q) || normalizarBusqueda(p.name).includes(q),
      )
    : projects

  return (
    <div className="relative">
      <input
        value={open ? query : seleccionado ? `${seleccionado.code} - ${seleccionado.name}` : ''}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => {
          setQuery('')
          setOpen(true)
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Buscar contrato por codigo o nombre"
        className="w-full border border-line rounded-[10px] px-3 py-2 text-sm bg-surface text-ink focus:ring-2 focus:ring-accent-500/40 focus:border-accent-500 outline-none"
      />
      {open && (
        <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-[10px] border border-line bg-surface shadow-soft">
          {filtrados.length === 0 && <div className="px-3 py-2 text-xs text-ink-muted">Sin resultados</div>}
          {filtrados.slice(0, 50).map((p) => (
            <button
              key={p.code}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(p.code)
                setQuery('')
                setOpen(false)
              }}
              className={`block w-full truncate px-3 py-2 text-left text-sm hover:bg-surface-muted ${
                p.code === value ? 'font-bold text-ink' : 'text-ink-soft'
              }`}
              title={`${p.code} - ${p.name}`}
            >
              {p.code} - {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function AdminPanel({
  meEmail,
  users,
  projects,
  onChangeRole,
}: {
  meEmail: string
  users: AppUser[]
  projects: Project[]
  onChangeRole: (
    email: string,
    role: Role,
    opts?: { departamento?: string | null; proyectoAsignado?: string | null; nivelContrato?: NivelContrato | null },
  ) => void
}) {
  const [busqueda, setBusqueda] = useState('')
  const query = normalizarBusqueda(busqueda)
  const usuariosFiltrados = users.filter((u) => {
    if (!query) return true
    return (
      normalizarBusqueda(repairMojibake(u.name)).includes(query) || normalizarBusqueda(u.email).includes(query)
    )
  })

  return (
    <div className="max-w-4xl p-4 sm:p-8">
      <h2 className="font-display text-2xl font-extrabold text-ink">Administracion de usuarios</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Asigna el rol de cada persona que ha iniciado sesion en la aplicacion. Lectura solo permite ver
        los proyectos; Edicion (JP) permite modificarlos; Director de departamento anade el departamento
        que dirige; Acceso a un contrato limita a un unico proyecto con el nivel que elijas; Administracion
        permite ademas gestionar estos roles. Solo un administrador puede cambiar el rol de otros usuarios.
      </p>

      <label className="relative mt-4 block max-w-sm">
        <span className="sr-only">Buscar persona</span>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o email"
          className="h-11 w-full rounded-lg border border-line bg-surface px-4 pr-9 text-sm text-ink outline-none shadow-soft focus:border-accent-500"
        />
        {busqueda && (
          <button
            type="button"
            onClick={() => setBusqueda('')}
            aria-label="Limpiar busqueda"
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-sm font-black text-ink-muted hover:bg-surface-muted hover:text-ink"
          >
            x
          </button>
        )}
      </label>

      <div className="mt-4 overflow-x-auto rounded-[24px] border border-line bg-surface shadow-soft">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs font-bold uppercase tracking-wider text-ink-soft">
              <th className="px-5 py-3">Usuario</th>
              <th className="px-5 py-3">Ultimo acceso</th>
              <th className="px-5 py-3">Rol</th>
              <th className="px-5 py-3">Alcance</th>
            </tr>
          </thead>
          <tbody>
            {usuariosFiltrados.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-center text-ink-soft">
                  {users.length === 0 ? 'Todavia no hay usuarios registrados.' : 'Ninguna persona coincide con la busqueda.'}
                </td>
              </tr>
            )}
            {usuariosFiltrados.map((user) => (
              <tr key={user.email} className="border-b border-line last:border-0 align-top">
                <td className="px-5 py-3">
                  <div className="font-semibold text-ink">{repairMojibake(user.name) || user.email}</div>
                  <div className="text-xs text-ink-soft">{user.email}</div>
                </td>
                <td className="px-5 py-3 text-ink-soft whitespace-nowrap">{formatFecha(user.lastLoginAt)}</td>
                <td className="px-5 py-3">
                  <select
                    value={user.role}
                    onChange={(e) => {
                      const role = e.target.value as Role
                      if (role === 'director_departamento') {
                        onChangeRole(user.email, role, { departamento: DEPARTAMENTOS_REALES[0] })
                      } else if (role === 'contrato') {
                        onChangeRole(user.email, role, {
                          proyectoAsignado: null,
                          nivelContrato: 'lectura',
                        })
                      } else {
                        onChangeRole(user.email, role)
                      }
                    }}
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
                <td className="px-5 py-3 min-w-[14rem]">
                  {user.role === 'director_departamento' && (
                    <select
                      value={user.departamento ?? ''}
                      onChange={(e) => onChangeRole(user.email, user.role, { departamento: e.target.value })}
                      className="w-full border border-line rounded-[10px] px-3 py-2 text-sm bg-surface text-ink focus:ring-2 focus:ring-accent-500/40 focus:border-accent-500 outline-none"
                    >
                      {DEPARTAMENTOS_REALES.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  )}
                  {user.role === 'contrato' && (
                    <div className="flex flex-col gap-1.5">
                      <ContratoPicker
                        projects={projects}
                        value={user.proyectoAsignado}
                        onSelect={(code) =>
                          onChangeRole(user.email, user.role, {
                            proyectoAsignado: code,
                            nivelContrato: user.nivelContrato ?? 'lectura',
                          })
                        }
                      />
                      <div className="flex rounded-full border border-line p-0.5 text-xs w-fit">
                        {(['lectura', 'edicion'] as const).map((nivel) => (
                          <button
                            key={nivel}
                            type="button"
                            onClick={() =>
                              onChangeRole(user.email, user.role, {
                                proyectoAsignado: user.proyectoAsignado,
                                nivelContrato: nivel,
                              })
                            }
                            className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${
                              (user.nivelContrato ?? 'lectura') === nivel
                                ? 'bg-accent-500 text-primary-950'
                                : 'text-ink-soft hover:bg-surface-muted'
                            }`}
                          >
                            {nivel === 'lectura' ? 'Lectura' : 'Edicion'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {user.role !== 'director_departamento' && user.role !== 'contrato' && (
                    <span className="text-xs text-ink-muted">-</span>
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
