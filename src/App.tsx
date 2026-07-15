import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import type { DB, DepartmentModule, Project } from './types'
import {
  crearPersistState,
  deleteDepartamento,
  deleteProject,
  loadDBAsync,
  mergeHours,
  persistDB,
  sanearDepartamentos,
  sanearProjects,
  setHorasProduccion,
  updateDepartamento,
  updateProject,
  upsertExplotacion,
} from './lib/store'
import { crearMapaSync, sincronizarEntidades } from './lib/cloudSync'
import type { MapaSync } from './lib/cloudSync'
import {
  deleteRemoteDepartment,
  deleteRemoteProject,
  fetchRemoteDepartments,
  fetchRemoteProjects,
  pushDepartment,
  pushProject,
} from './lib/api'
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
import { clearAuthSession, getAuthSession, isSsoEnabled, logoutSso } from './lib/auth'
import { emoji } from './lib/emoji'
import { EmojiIcon } from './lib/EmojiIcon'
import { parseExplotacionAsync, parseHorasAsync, parseHorasProduccionAsync } from './lib/parseInWorker'
import type { ParsedHoras } from './lib/parseHoras'
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

interface Toast {
  id: number
  kind: 'ok' | 'error' | 'warn'
  text: string
}

let toastId = 0

type SyncEstado = 'cargando' | 'nube' | 'local' | 'auth' | 'error'
type ProjectArchiveFilter = 'active' | 'archived' | 'all'
type ProjectScope = 'mine' | 'all'

export default function App() {
  // La cache local (IndexedDB) se carga de forma asincrona: hasta que no esta
  // lista no se renderiza la app ni se arranca la sincronizacion con la nube.
  const [db, setDb] = useState<DB>(() => ({ projects: {}, departamentos: {} }))
  const [dbReady, setDbReady] = useState(false)
  const [projectOrder, setProjectOrder] = useState<string[]>(() => loadProjectOrder())
  const [selected, setSelected] = useState<string | null>(null)
  const [scope, setScope] = useState<ProjectScope>('mine')
  const [archiveFilter, setArchiveFilter] = useState<ProjectArchiveFilter>('active')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => getAuthSession())
  const [syncEstado, setSyncEstado] = useState<SyncEstado>('cargando')
  const [myRole, setMyRole] = useState<Role | null>(null)
  const [myDepartamento, setMyDepartamento] = useState<string | null>(null)
  const [myProyectoAsignado, setMyProyectoAsignado] = useState<string | null>(null)
  const [myNivelContrato, setMyNivelContrato] = useState<NivelContrato | null>(null)
  const [adminUsers, setAdminUsers] = useState<AppUser[] | null>(null)
  const [adminView, setAdminView] = useState(false)
  const [deptView, setDeptView] = useState(false)
  const [miDepartamento, setMiDepartamento] = useState<string | null>(() => loadMiDepartamento())
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const syncProyectos = useRef<MapaSync<Project>>(new Map())
  const syncDepartamentos = useRef<MapaSync<DepartmentModule>>(new Map())
  const persistState = useRef(crearPersistState({ projects: {}, departamentos: {} }))
  const dbQuotaWarned = useRef(false)

  useEffect(() => {
    loadDBAsync().then((cargado) => {
      persistState.current = crearPersistState(cargado)
      setDb(cargado)
      setDbReady(true)
    })
  }, [])

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
    // El JSON remoto se sanea antes de entrar en la app: un proyecto corrupto
    // o de un esquema antiguo no debe reventar las vistas ni el sync.
    const projectsRemotos = sanearProjects(remoto.projects)
    syncProyectos.current = crearMapaSync(projectsRemotos, remoto.versions)
    const remotoDept = await fetchRemoteDepartments()
    const departamentosRemotos =
      remotoDept.estado === 'ok' ? sanearDepartamentos(remotoDept.departamentos) : {}
    if (remotoDept.estado === 'ok') {
      syncDepartamentos.current = crearMapaSync(departamentosRemotos, remotoDept.versions)
    }
    setDb((local) => ({
      projects: { ...local.projects, ...projectsRemotos },
      departamentos: { ...local.departamentos, ...departamentosRemotos },
    }))
    setSyncEstado('nube')
  }, [])

  useEffect(() => {
    if (dbReady) conectar()
  }, [conectar, authSession, dbReady])

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
    if (!dbReady) return
    // Persistencia local incremental: solo escribe las entidades cuya
    // referencia ha cambiado (los mutadores del store no tocan el resto).
    persistDB(db, persistState.current).then((ok) => {
      if (!ok && !dbQuotaWarned.current) {
        dbQuotaWarned.current = true
        toast(
          'warn',
          'El navegador no ha podido guardar los datos localmente. ' +
            (syncEstado === 'nube'
              ? 'Se seguira sincronizando con la nube con normalidad.'
              : 'Activa la sincronizacion con la nube para no perder datos al recargar.'),
        )
      }
    })

    if (syncEstado !== 'nube') return
    const timer = setTimeout(async () => {
      const proyectos = await sincronizarEntidades({
        actuales: db.projects,
        mapa: syncProyectos.current,
        push: (_code, project, baseVersion) => pushProject(project, baseVersion),
        remove: deleteRemoteProject,
      })
      const departamentos =
        proyectos.estado === 'ok'
          ? await sincronizarEntidades({
              actuales: db.departamentos,
              mapa: syncDepartamentos.current,
              push: (_nombre, modulo, baseVersion) => pushDepartment(modulo, baseVersion),
              remove: deleteRemoteDepartment,
            })
          : { estado: 'error' as const, conflictos: [] }

      // En conflicto gana la version remota (ya persistida por el otro usuario);
      // se adopta localmente y se avisa para que el cambio propio se pueda rehacer.
      if (proyectos.conflictos.length > 0 || departamentos.conflictos.length > 0) {
        setDb((d) => ({
          projects: {
            ...d.projects,
            ...Object.fromEntries(proyectos.conflictos.map((c) => [c.key, c.remoto])),
          },
          departamentos: {
            ...d.departamentos,
            ...Object.fromEntries(departamentos.conflictos.map((c) => [c.key, c.remoto])),
          },
        }))
        for (const c of proyectos.conflictos) {
          toast('warn', `${c.key}: otro usuario ha guardado una version mas reciente; se ha cargado esa version y tus ultimos cambios no se han aplicado.`)
        }
        for (const c of departamentos.conflictos) {
          toast('warn', `Departamento ${c.key}: otro usuario ha guardado una version mas reciente; se ha cargado esa version y tus ultimos cambios no se han aplicado.`)
        }
      }

      if (proyectos.estado === 'error' || departamentos.estado === 'error') {
        setSyncEstado('error')
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [db, dbReady, syncEstado])

  useEffect(() => {
    persistMiDepartamento(miDepartamento)
  }, [miDepartamento])

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
        const parsed = await parseExplotacionAsync(f)
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

  /** Incorpora unas horas parseadas al proyecto `code` y emite el resumen/avisos. */
  const aplicarHorasImportadas = (base: DB, code: string, f: File, parsed: ParsedHoras): DB => {
    const next = mergeHours(base, code, parsed.records, parsed.areaPorPersona)
    const personas = new Set(parsed.records.map((r) => r.persona)).size
    const total = parsed.records.reduce((s, r) => s + r.horas, 0)
    toast('ok', `${f.name}: ${total.toLocaleString('es-ES')} h de ${personas} participantes importadas.`)
    parsed.warnings.forEach((w) => toast('warn', `${f.name}: ${w}`))
    return next
  }

  const handleConcostFiles = async (files: File[]) => {
    if (!selected) return

    let next = db
    for (const f of files) {
      const name = f.name.toLowerCase()
      try {
        if (name.includes('explotacion')) {
          const parsed = await parseExplotacionAsync(f)
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

        const parsed = await parseHorasAsync(f)
        if (parsed.code && parsed.code !== selected) {
          toast('error', `${f.name}: es del proyecto ${parsed.code}, no de ${selected}; no se ha importado.`)
          continue
        }
        next = aplicarHorasImportadas(next, selected, f, parsed)
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
        const parsed = await parseHorasAsync(f)
        if (!parsed.code) {
          toast('error', `${f.name}: no se ha podido identificar el proyecto. Sube primero el fichero de Explotacion.`)
          continue
        }
        if (!next.projects[parsed.code]) {
          toast('error', `${f.name}: primero importa Explotacion para crear el proyecto ${parsed.code}.`)
          continue
        }
        next = aplicarHorasImportadas(next, parsed.code, f, parsed)
      } catch (err) {
        toast('error', `${f.name}: ${err instanceof Error ? err.message : 'error al leer el fichero'}`)
      }
    }
    setDb(next)
  }

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

  const handleImportHorasProduccion = async (file: File) => {
    if (!miDepartamento) return
    try {
      const parsed = await parseHorasProduccionAsync(file)
      setDb((d) => setHorasProduccion(d, miDepartamento, parsed.horas, file.name))
      toast(
        'ok',
        `${file.name}: ${parsed.horas.length.toLocaleString('es-ES')} apuntes de ${parsed.personas.length} personas importados.`,
      )
      parsed.warnings.forEach((w) => toast('warn', w))
    } catch (err) {
      toast('error', `${file.name}: ${err instanceof Error ? err.message : 'error al leer el fichero'}`)
    }
  }

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
