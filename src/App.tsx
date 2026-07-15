import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import type { DepartmentModule } from './types'
import { deleteDepartamento, deleteProject, updateDepartamento, updateProject } from './lib/store'
import { fetchUsers, updateUserRole } from './lib/adminApi'
import type { AppUser, NivelContrato, Role } from './lib/adminApi'
import { esJpDelUsuario, esSeguidoPorUsuario } from './lib/projectAccess'
import {
  loadMiDepartamento,
  loadProjectOrder,
  moveCode,
  orderProjects,
  persistMiDepartamento,
  persistProjectOrder,
} from './lib/prefs'
import type { AuthSession } from './lib/auth'
import { getAuthSession, isSsoEnabled, logoutSso } from './lib/auth'
import { Toasts, useToasts } from './hooks/useToasts'
import { useDbSync } from './hooks/useDbSync'
import { useImportaciones } from './hooks/useImportaciones'
import { Sidebar } from './components/Sidebar'
import { Overview } from './components/Overview'
import { LoginCallback } from './components/LoginCallback'
import { LoginView } from './components/LoginView'

// Las vistas pesadas (arrastran recharts y la mayor parte del codigo de la app)
// se cargan bajo demanda para reducir el bundle inicial. Overview se mantiene
// estatica por ser la vista de aterrizaje.
const ProjectDashboard = lazy(() =>
  import('./components/ProjectDashboard').then((m) => ({ default: m.ProjectDashboard })),
)
const DepartmentDashboard = lazy(() =>
  import('./components/DepartmentDashboard').then((m) => ({ default: m.DepartmentDashboard })),
)
const AdminPanel = lazy(() =>
  import('./components/AdminPanel').then((m) => ({ default: m.AdminPanel })),
)

function VistaCargando() {
  return (
    <div className="flex h-full items-center justify-center p-8 text-sm font-medium text-ink-soft">
      Cargando…
    </div>
  )
}

type ProjectArchiveFilter = 'active' | 'archived' | 'all'
type ProjectScope = 'mine' | 'all'

export default function App() {
  const [projectOrder, setProjectOrder] = useState<string[]>(() => loadProjectOrder())
  const [selected, setSelected] = useState<string | null>(null)
  const [scope, setScope] = useState<ProjectScope>('mine')
  const [archiveFilter, setArchiveFilter] = useState<ProjectArchiveFilter>('active')
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => getAuthSession())
  const { toasts, toast } = useToasts()
  const { db, setDb, dbReady, setSyncEstado, conectar } = useDbSync({
    authSession,
    setAuthSession,
    toast,
  })
  const [myRole, setMyRole] = useState<Role | null>(null)
  const [myDepartamento, setMyDepartamento] = useState<string | null>(null)
  const [myProyectoAsignado, setMyProyectoAsignado] = useState<string | null>(null)
  const [myNivelContrato, setMyNivelContrato] = useState<NivelContrato | null>(null)
  const [adminUsers, setAdminUsers] = useState<AppUser[] | null>(null)
  const [adminView, setAdminView] = useState(false)
  const [deptView, setDeptView] = useState(false)
  const [miDepartamento, setMiDepartamento] = useState<string | null>(() => loadMiDepartamento())
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    if (isSsoEnabled && !authSession) {
      setMyRole(null)
      setMyDepartamento(null)
      setMyProyectoAsignado(null)
      setMyNivelContrato(null)
      setAdminUsers(null)
      return
    }
    fetchUsers().then((result) => {
      if (result.estado !== 'ok') {
        setMyRole(null)
        setMyDepartamento(null)
        setMyProyectoAsignado(null)
        setMyNivelContrato(null)
        setAdminUsers(null)
        return
      }
      setMyRole(result.me.role)
      setMyDepartamento(result.me.departamento)
      setMyProyectoAsignado(result.me.proyectoAsignado)
      setMyNivelContrato(result.me.nivelContrato)
      setAdminUsers(result.users ?? null)
    })
  }, [authSession])

  useEffect(() => {
    if (isSsoEnabled && deptView && myRole !== 'administracion' && myRole !== 'director_departamento') {
      setDeptView(false)
    }
  }, [deptView, myRole])

  useEffect(() => {
    if (isSsoEnabled && myRole === 'director_departamento' && myDepartamento && miDepartamento !== myDepartamento) {
      setMiDepartamento(myDepartamento)
    }
  }, [myRole, myDepartamento, miDepartamento])

  useEffect(() => {
    persistProjectOrder(projectOrder)
  }, [projectOrder])

  useEffect(() => {
    persistMiDepartamento(miDepartamento)
  }, [miDepartamento])

  const {
    handleExplotacionFiles,
    handleConcostFiles,
    handleOverviewHoursFiles,
    handleImportHorasProduccion,
  } = useImportaciones({ db, setDb, selected, setSelected, miDepartamento, toast })

  const allProjects = orderProjects(db.projects, projectOrder).filter(
    (p) => myRole !== 'contrato' || p.code === myProyectoAsignado,
  )
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

  const departamentoModulo: DepartmentModule | undefined = miDepartamento
    ? db.departamentos[miDepartamento]
    : undefined
  const puedeAccederDepartamento =
    !isSsoEnabled || myRole === 'administracion' || myRole === 'director_departamento'
  const puedeVerTodosDepartamentos = !isSsoEnabled || myRole === 'administracion'

  const handleUpdateRoster = (roster: DepartmentModule['roster']) => {
    if (!miDepartamento) return
    setDb((d) => updateDepartamento(d, miDepartamento, { roster }))
  }

  const handleSetObjetivo = (pct: number | undefined) => {
    if (!miDepartamento) return
    setDb((d) => updateDepartamento(d, miDepartamento, { objetivoFacturablePct: pct }))
  }

  const handleSetMesInicio = (mes: string | undefined) => {
    if (!miDepartamento) return
    setDb((d) => updateDepartamento(d, miDepartamento, { mesInicio: mes }))
  }

  const handleDeleteDepartamentoData = () => {
    if (!miDepartamento) return
    setDb((d) => deleteDepartamento(d, miDepartamento))
    toast('ok', `Datos de "${miDepartamento}" eliminados.`)
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

  const handleChangeRole = async (
    email: string,
    role: Role,
    opts?: { departamento?: string | null; proyectoAsignado?: string | null; nivelContrato?: NivelContrato | null },
  ) => {
    const prev = adminUsers
    setAdminUsers(
      (list) =>
        list?.map((u) =>
          u.email === email
            ? {
                ...u,
                role,
                departamento: opts?.departamento ?? null,
                proyectoAsignado: opts?.proyectoAsignado ?? null,
                nivelContrato: opts?.nivelContrato ?? null,
              }
            : u,
        ) ?? list,
    )
    const result = await updateUserRole(email, role, opts)
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

  if (!dbReady) {
    return <VistaCargando />
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
          setDeptView(false)
          setSelected(code)
          setMobileNavOpen(false)
        }}
        onImportConcost={handleConcostFiles}
        scope={scope}
        onScopeChange={(s) => {
          setAdminView(false)
          setDeptView(false)
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
          setDeptView(false)
          setAdminView(true)
          setMobileNavOpen(false)
        }}
        showDept={puedeAccederDepartamento}
        departamentoActive={deptView}
        onOpenDepartamento={() => {
          setSelected(null)
          setAdminView(false)
          setDeptView(true)
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
          <Suspense fallback={<VistaCargando />}>
          {adminView ? (
            <AdminPanel
              meEmail={authSession?.email ?? ''}
              users={adminUsers ?? []}
              projects={allProjects}
              onChangeRole={handleChangeRole}
            />
          ) : deptView && puedeAccederDepartamento ? (
            <DepartmentDashboard
              departamento={miDepartamento}
              modulo={departamentoModulo}
              puedeVerTodosDepartamentos={puedeVerTodosDepartamentos}
              onChooseDepartamento={setMiDepartamento}
              onImportFile={handleImportHorasProduccion}
              onUpdateRoster={handleUpdateRoster}
              onSetObjetivo={handleSetObjetivo}
              onSetMesInicio={handleSetMesInicio}
              onDeleteData={handleDeleteDepartamentoData}
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
              soloLectura={myRole === 'lectura' || (myRole === 'contrato' && myNivelContrato !== 'edicion')}
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
          </Suspense>
        </main>
      </div>

      <Toasts toasts={toasts} />
    </div>
  )
}
