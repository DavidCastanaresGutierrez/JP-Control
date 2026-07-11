import { useCallback, useEffect, useRef, useState } from 'react'
import type { DB, Project } from './types'
import {
  deleteProject,
  loadDB,
  mergeHours,
  saveDB,
  updateProject,
  upsertExplotacion,
} from './lib/store'
import { deleteRemoteProject, fetchRemoteProjects, pushProject } from './lib/api'
import { fetchUsers, updateUserRole } from './lib/adminApi'
import type { AppUser, Role } from './lib/adminApi'
import { repairMojibake } from './lib/format'
import type { AuthSession } from './lib/auth'
import { clearAuthSession, getAuthSession, isSsoEnabled, logoutSso } from './lib/auth'
import { EmojiIcon, emoji } from './lib/emoji'
import { parseExplotacion } from './lib/parseExplotacion'
import { parseHoras } from './lib/parseHoras'
import { Sidebar } from './components/Sidebar'
import { Overview } from './components/Overview'
import { ProjectDashboard } from './components/ProjectDashboard'
import { AdminPanel } from './components/AdminPanel'
import { LoginCallback } from './components/LoginCallback'
import { LoginView } from './components/LoginView'

interface Toast {
  id: number
  kind: 'ok' | 'error' | 'warn'
  text: string
}

let toastId = 0

type SyncEstado = 'cargando' | 'nube' | 'local' | 'auth' | 'error'
type ProjectArchiveFilter = 'active' | 'archived' | 'all'
type ProjectScope = 'mine' | 'all'

const PROJECT_ORDER_KEY = 'jp-control-project-order-v1'

function normalizarTexto(value: string): string {
  return repairMojibake(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

function tokensNombre(value: string): string[] {
  return normalizarTexto(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((token) => token.length > 1)
}

/** Determina si el usuario logueado figura como JP del proyecto, cotejando nombre y email. */
function esJpDelUsuario(project: Project, userName?: string, userEmail?: string): boolean {
  if (!project.jp) return false
  const jp = new Set(tokensNombre(project.jp))
  if (jp.size === 0) return false

  const usuario = new Set(tokensNombre(userName ?? ''))
  let comunes = 0
  for (const token of jp) if (usuario.has(token)) comunes++
  if (jp.size === 1 ? comunes >= 1 : comunes >= 2) return true

  // Red de seguridad: emails tipo "dcastanares" contienen el apellido del JP.
  const emailLocal = normalizarTexto((userEmail ?? '').split('@')[0]).replace(/[^a-z0-9]+/g, '')
  return emailLocal.length >= 4 && [...jp].some((token) => token.length >= 4 && emailLocal.includes(token))
}

/** El usuario ha marcado el proyecto para seguirlo sin ser su JP. */
function esSeguidoPorUsuario(project: Project, userEmail?: string): boolean {
  const email = (userEmail ?? '').trim().toLowerCase()
  if (!email) return false
  return (project.watchers ?? []).includes(email)
}

function loadProjectOrder(): string[] {
  try {
    const raw = localStorage.getItem(PROJECT_ORDER_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function orderProjects(projects: DB['projects'], order: string[]) {
  const listed = new Set(order)
  const ordered = order.map((code) => projects[code]).filter(Boolean)
  const remaining = Object.values(projects)
    .filter((project) => !listed.has(project.code))
    .sort((a, b) => a.name.localeCompare(b.name))
  return [...ordered, ...remaining]
}

function moveCode(codes: string[], draggedCode: string, targetCode: string) {
  const from = codes.indexOf(draggedCode)
  const to = codes.indexOf(targetCode)
  if (from < 0 || to < 0 || from === to) return codes
  const next = [...codes]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

export default function App() {
  const [db, setDb] = useState<DB>(() => loadDB())
  const [projectOrder, setProjectOrder] = useState<string[]>(() => loadProjectOrder())
  const [selected, setSelected] = useState<string | null>(null)
  const [scope, setScope] = useState<ProjectScope>('mine')
  const [archiveFilter, setArchiveFilter] = useState<ProjectArchiveFilter>('active')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => getAuthSession())
  const [syncEstado, setSyncEstado] = useState<SyncEstado>('cargando')
  const [myRole, setMyRole] = useState<Role | null>(null)
  const [adminUsers, setAdminUsers] = useState<AppUser[] | null>(null)
  const [adminView, setAdminView] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const lastSynced = useRef<Map<string, string>>(new Map())

  const conectar = useCallback(async () => {
    if (isSsoEnabled && !getAuthSession()) {
      setSyncEstado('auth')
      return
    }

    setSyncEstado('cargando')
    const remoto = await fetchRemoteProjects()
    if (remoto.estado === 'auth') {
      clearAuthSession()
      setAuthSession(null)
      setSyncEstado('auth')
      return
    }
    if (remoto.estado === 'sin-nube') {
      setSyncEstado('local')
      return
    }
    lastSynced.current = new Map(
      Object.entries(remoto.projects).map(([code, p]) => [code, JSON.stringify(p)]),
    )
    setDb((local) => ({ projects: { ...local.projects, ...remoto.projects } }))
    setSyncEstado('nube')
  }, [])

  useEffect(() => {
    conectar()
  }, [conectar, authSession])

  useEffect(() => {
    if (isSsoEnabled && !authSession) {
      setMyRole(null)
      setAdminUsers(null)
      return
    }
    fetchUsers().then((result) => {
      if (result.estado !== 'ok') {
        setMyRole(null)
        setAdminUsers(null)
        return
      }
      setMyRole(result.me.role)
      setAdminUsers(result.users ?? null)
    })
  }, [authSession])

  useEffect(() => {
    localStorage.setItem(PROJECT_ORDER_KEY, JSON.stringify(projectOrder))
  }, [projectOrder])

  useEffect(() => {
    saveDB(db)
    if (syncEstado !== 'nube') return
    const timer = setTimeout(async () => {
      for (const [code, project] of Object.entries(db.projects)) {
        const snapshot = JSON.stringify(project)
        if (lastSynced.current.get(code) === snapshot) continue
        if (await pushProject(project)) lastSynced.current.set(code, snapshot)
        else {
          setSyncEstado('error')
          return
        }
      }
      for (const code of [...lastSynced.current.keys()]) {
        if (db.projects[code]) continue
        if (await deleteRemoteProject(code)) lastSynced.current.delete(code)
        else {
          setSyncEstado('error')
          return
        }
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [db, syncEstado])

  const toast = (kind: Toast['kind'], text: string) => {
    const id = ++toastId
    setToasts((t) => [...t, { id, kind, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000)
  }

  const handleExplotacionFiles = async (files: File[]) => {
    let next = db
    let lastCode: string | null = null
    for (const f of files) {
      try {
        const parsed = parseExplotacion(await f.arrayBuffer(), f.name)
        const res = upsertExplotacion(next, parsed)
        if (res.skipped) {
          toast('warn', `${f.name}: ya hay datos mas recientes de ${parsed.code}; no se ha importado.`)
          continue
        }
        next = res.db
        lastCode = parsed.code
        toast('ok', `${parsed.code}: ${parsed.entries.length} apuntes importados.`)
        parsed.warnings.forEach((w) => toast('warn', `${parsed.code}: ${w}`))
      } catch (err) {
        toast('error', `${f.name}: ${err instanceof Error ? err.message : 'error al leer el fichero'}`)
      }
    }
    setDb(next)
    if (lastCode) setSelected(lastCode)
  }

  const handleConcostFiles = async (files: File[]) => {
    if (!selected) return

    let next = db
    for (const f of files) {
      const name = f.name.toLowerCase()
      try {
        if (name.includes('explotacion')) {
          const parsed = parseExplotacion(await f.arrayBuffer(), f.name)
          if (parsed.code !== selected) {
            toast('error', `${f.name}: es del proyecto ${parsed.code}, no de ${selected}; no se ha importado.`)
            continue
          }
          const res = upsertExplotacion(next, parsed)
          if (res.skipped) {
            toast('warn', `${f.name}: ya hay datos mas recientes de ${parsed.code}; no se ha importado.`)
            continue
          }
          next = res.db
          toast('ok', `${parsed.code}: explotacion actualizada con ${parsed.entries.length} apuntes.`)
          parsed.warnings.forEach((w) => toast('warn', `${parsed.code}: ${w}`))
          continue
        }

        const parsed = parseHoras(await f.arrayBuffer())
        if (parsed.code && parsed.code !== selected) {
          toast('error', `${f.name}: es del proyecto ${parsed.code}, no de ${selected}; no se ha importado.`)
          continue
        }
        next = mergeHours(next, selected, parsed.records, parsed.areaPorPersona)
        const personas = new Set(parsed.records.map((r) => r.persona)).size
        const total = parsed.records.reduce((s, r) => s + r.horas, 0)
        toast('ok', `${f.name}: ${total.toLocaleString('es-ES')} h de ${personas} participantes importadas.`)
        parsed.warnings.forEach((w) => toast('warn', `${f.name}: ${w}`))
      } catch (err) {
        toast('error', `${f.name}: ${err instanceof Error ? err.message : 'error al leer el fichero'}`)
      }
    }
    setDb(next)
  }

  const handleOverviewHoursFiles = async (files: File[]) => {
    let next = db
    for (const f of files) {
      try {
        const parsed = parseHoras(await f.arrayBuffer())
        if (!parsed.code) {
          toast('error', `${f.name}: no se ha podido identificar el proyecto. Sube primero el fichero de Explotacion.`)
          continue
        }
        if (!next.projects[parsed.code]) {
          toast('error', `${f.name}: primero importa Explotacion para crear el proyecto ${parsed.code}.`)
          continue
        }
        next = mergeHours(next, parsed.code, parsed.records, parsed.areaPorPersona)
        const personas = new Set(parsed.records.map((r) => r.persona)).size
        const total = parsed.records.reduce((s, r) => s + r.horas, 0)
        toast('ok', `${f.name}: ${total.toLocaleString('es-ES')} h de ${personas} participantes importadas.`)
        parsed.warnings.forEach((w) => toast('warn', `${f.name}: ${w}`))
      } catch (err) {
        toast('error', `${f.name}: ${err instanceof Error ? err.message : 'error al leer el fichero'}`)
      }
    }
    setDb(next)
  }

  const allProjects = orderProjects(db.projects, projectOrder)
  const scopedProjects =
    scope === 'mine'
      ? allProjects.filter(
          (p) =>
            esJpDelUsuario(p, authSession?.username, authSession?.email) ||
            esSeguidoPorUsuario(p, authSession?.email),
        )
      : allProjects
  const projects = scopedProjects.filter((project) => {
    if (archiveFilter === 'all') return true
    const archived = Boolean(project.archivedAt)
    return archiveFilter === 'archived' ? archived : !archived
  })
  const project = selected ? db.projects[selected] : undefined
  const siguiendoProyecto = project ? esSeguidoPorUsuario(project, authSession?.email) : false

  const handleReorderProjects = (draggedCode: string, targetCode: string) => {
    setProjectOrder((current) => {
      const codes = allProjects.map((p) => p.code)
      const base = current.length > 0 ? [...current.filter((code) => db.projects[code])] : codes
      for (const code of codes) {
        if (!base.includes(code)) base.push(code)
      }
      return moveCode(base, draggedCode, targetCode)
    })
  }

  const handleToggleWatch = (code: string) => {
    const email = authSession?.email?.trim().toLowerCase()
    if (!email) {
      toast('warn', 'Inicia sesion para poder marcar proyectos a seguir.')
      return
    }
    setDb((d) => {
      const p = d.projects[code]
      if (!p) return d
      const watchers = new Set(p.watchers ?? [])
      if (watchers.has(email)) watchers.delete(email)
      else watchers.add(email)
      return updateProject(d, code, { watchers: [...watchers] })
    })
  }

  const handleLoginSuccess = useCallback(
    (session: AuthSession) => {
      setAuthSession(session)
      conectar()
    },
    [conectar],
  )

  const handleLogout = useCallback(async () => {
    await logoutSso()
    setAuthSession(null)
    setSelected(null)
    setAdminView(false)
    setSyncEstado('auth')
  }, [])

  const handleChangeRole = async (email: string, role: Role) => {
    const prev = adminUsers
    setAdminUsers((list) => list?.map((u) => (u.email === email ? { ...u, role } : u)) ?? list)
    const result = await updateUserRole(email, role)
    if (!result.ok) {
      setAdminUsers(prev)
      toast('error', result.error ?? `No se ha podido actualizar el rol de ${email}.`)
    }
  }

  const hasSsoCallbackData = (() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('id_token') || params.has('refresh_token') || params.has('error')) return true
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    return hashParams.has('id_token') || hashParams.has('refresh_token') || hashParams.has('error')
  })()

  if (isSsoEnabled && (window.location.pathname === '/login-success' || hasSsoCallbackData)) {
    return <LoginCallback onSuccess={handleLoginSuccess} />
  }

  if (isSsoEnabled && !authSession) {
    return <LoginView />
  }

  return (
    <div className="flex h-full">
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-30 bg-primary-950/50 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar
        projects={scopedProjects}
        selected={selected}
        mobileOpen={mobileNavOpen}
        onRequestClose={() => setMobileNavOpen(false)}
        onSelect={(code) => {
          setAdminView(false)
          setSelected(code)
          setMobileNavOpen(false)
        }}
        onImportConcost={handleConcostFiles}
        scope={scope}
        onScopeChange={(s) => {
          setAdminView(false)
          setScope(s)
          setMobileNavOpen(false)
        }}
        archiveFilter={archiveFilter}
        onArchiveFilterChange={setArchiveFilter}
        userEmail={authSession?.email}
        userName={authSession?.username}
        userPhotoUrl={authSession?.photoUrl}
        onLogout={isSsoEnabled ? handleLogout : undefined}
        showAdmin={myRole === 'administracion'}
        adminActive={adminView}
        onOpenAdmin={() => {
          setSelected(null)
          setAdminView(true)
          setMobileNavOpen(false)
        }}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Abrir menu"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-ink-soft"
          >
            <span className="flex flex-col items-center justify-center gap-[3px]">
              <span className="block h-[2px] w-4 rounded-full bg-current" />
              <span className="block h-[2px] w-4 rounded-full bg-current" />
              <span className="block h-[2px] w-4 rounded-full bg-current" />
            </span>
          </button>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-500 text-xs font-black text-primary-950">
            JP
          </div>
          <div className="truncate font-display text-base font-extrabold tracking-tight text-ink">
            JP Control
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {adminView ? (
            <AdminPanel
              meEmail={authSession?.email ?? ''}
              users={adminUsers ?? []}
              onChangeRole={handleChangeRole}
            />
          ) : project ? (
            <ProjectDashboard
              key={project.code}
              project={project}
              onUpdate={(patch) => setDb((d) => updateProject(d, project.code, patch))}
              onArchiveToggle={() =>
                setDb((d) =>
                  updateProject(d, project.code, {
                    archivedAt: project.archivedAt ? undefined : new Date().toISOString(),
                  }),
                )
              }
              onDelete={() => {
                setDb((d) => deleteProject(d, project.code))
                setSelected(null)
              }}
              isWatching={siguiendoProyecto}
              onToggleWatch={() => handleToggleWatch(project.code)}
            />
          ) : (
            <Overview
              projects={projects}
              scope={scope}
              onSelect={setSelected}
              onReorder={handleReorderProjects}
              onFiles={handleExplotacionFiles}
              onHoursFiles={handleOverviewHoursFiles}
              userEmail={authSession?.email}
              onToggleWatch={handleToggleWatch}
            />
          )}
        </main>
      </div>

      <div className="fixed inset-x-4 bottom-4 z-50 space-y-2 sm:inset-x-auto sm:right-4 sm:max-w-md">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-[14px] px-4 py-2.5 text-sm font-medium shadow-hover ${
              t.kind === 'ok'
                ? 'bg-success text-white'
                : t.kind === 'warn'
                  ? 'bg-warning text-primary-950'
                  : 'bg-danger text-white'
            }`}
          >
            <span className="mr-1.5 align-[-1px]">
              <EmojiIcon>{t.kind === 'ok' ? emoji.check : t.kind === 'warn' ? emoji.alert : emoji.alert}</EmojiIcon>
            </span>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  )
}
