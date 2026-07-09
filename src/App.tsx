import { useCallback, useEffect, useRef, useState } from 'react'
import type { DB } from './types'
import {
  deleteProject,
  loadDB,
  mergeHours,
  saveDB,
  updateProject,
  upsertExplotacion,
} from './lib/store'
import { deleteRemoteProject, fetchRemoteProjects, pushProject } from './lib/api'
import type { AuthSession } from './lib/auth'
import { clearAuthSession, getAuthSession, isSsoEnabled, logoutSso } from './lib/auth'
import { parseExplotacion } from './lib/parseExplotacion'
import { parseHoras } from './lib/parseHoras'
import { Sidebar } from './components/Sidebar'
import { Overview } from './components/Overview'
import { ProjectDashboard } from './components/ProjectDashboard'
import { LoginCallback } from './components/LoginCallback'
import { LoginView } from './components/LoginView'

interface Toast {
  id: number
  kind: 'ok' | 'error' | 'warn'
  text: string
}

let toastId = 0

type SyncEstado = 'cargando' | 'nube' | 'local' | 'auth' | 'error'

const PROJECT_ORDER_KEY = 'jp-control-project-order-v1'

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
  const [toasts, setToasts] = useState<Toast[]>([])
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => getAuthSession())
  const [syncEstado, setSyncEstado] = useState<SyncEstado>('cargando')
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

  const projects = orderProjects(db.projects, projectOrder)
  const project = selected ? db.projects[selected] : undefined

  const handleReorderProjects = (draggedCode: string, targetCode: string) => {
    setProjectOrder((current) => {
      const codes = projects.map((p) => p.code)
      const base = current.length > 0 ? [...current.filter((code) => db.projects[code])] : codes
      for (const code of codes) {
        if (!base.includes(code)) base.push(code)
      }
      return moveCode(base, draggedCode, targetCode)
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
    setSyncEstado('auth')
  }, [])

  if (isSsoEnabled && window.location.pathname === '/login-success') {
    return <LoginCallback onSuccess={handleLoginSuccess} />
  }

  if (isSsoEnabled && !authSession) {
    return <LoginView error={syncEstado === 'auth' ? undefined : 'La sesion ha caducado. Vuelve a entrar.'} />
  }

  return (
    <div className="flex h-full">
      <Sidebar
        projects={projects}
        selected={selected}
        onSelect={setSelected}
        onImportConcost={handleConcostFiles}
        userEmail={authSession?.email}
        onLogout={isSsoEnabled ? handleLogout : undefined}
      />

      <main className="flex-1 overflow-y-auto">
        {project ? (
          <ProjectDashboard
            key={project.code}
            project={project}
            onUpdate={(patch) => setDb((d) => updateProject(d, project.code, patch))}
            onDelete={() => {
              setDb((d) => deleteProject(d, project.code))
              setSelected(null)
            }}
          />
        ) : (
          <Overview
            projects={projects}
            onSelect={setSelected}
            onReorder={handleReorderProjects}
            onFiles={handleExplotacionFiles}
            onHoursFiles={handleOverviewHoursFiles}
          />
        )}
      </main>

      <div className="fixed bottom-4 right-4 z-50 max-w-md space-y-2">
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
            {t.text}
          </div>
        ))}
      </div>
    </div>
  )
}
