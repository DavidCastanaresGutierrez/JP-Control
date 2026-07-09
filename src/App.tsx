import { useCallback, useEffect, useRef, useState } from 'react'
import type { DB } from './types'
import {
  deleteProject,
  exportJSON,
  importJSON,
  loadDB,
  mergeHours,
  saveDB,
  updateProject,
  upsertExplotacion,
} from './lib/store'
import { deleteRemoteProject, fetchRemoteProjects, pushProject, setToken } from './lib/api'
import { parseExplotacion } from './lib/parseExplotacion'
import { parseHoras } from './lib/parseHoras'
import { Sidebar } from './components/Sidebar'
import { Overview } from './components/Overview'
import { ProjectDashboard } from './components/ProjectDashboard'

interface Toast {
  id: number
  kind: 'ok' | 'error' | 'warn'
  text: string
}

let toastId = 0

type SyncEstado = 'cargando' | 'nube' | 'local' | 'auth' | 'error'

export default function App() {
  const [db, setDb] = useState<DB>(() => loadDB())
  const [selected, setSelected] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const backupInputRef = useRef<HTMLInputElement>(null)

  // ---- Sincronización con la nube (API /api/projects en Vercel) ----
  const [syncEstado, setSyncEstado] = useState<SyncEstado>('cargando')
  const [codigoAcceso, setCodigoAcceso] = useState('')
  // Última versión de cada proyecto confirmada en la nube (para subir solo cambios)
  const lastSynced = useRef<Map<string, string>>(new Map())

  const conectar = useCallback(async () => {
    setSyncEstado('cargando')
    const remoto = await fetchRemoteProjects()
    if (remoto.estado === 'auth') {
      setSyncEstado('auth')
      return
    }
    if (remoto.estado === 'sin-nube') {
      setSyncEstado('local')
      return
    }
    // La nube manda por proyecto; los proyectos solo-locales se conservan y se subirán
    lastSynced.current = new Map(
      Object.entries(remoto.projects).map(([code, p]) => [code, JSON.stringify(p)]),
    )
    setDb((local) => ({ projects: { ...local.projects, ...remoto.projects } }))
    setSyncEstado('nube')
  }, [])

  useEffect(() => {
    conectar()
  }, [conectar])

  // Guardado local siempre + subida (con retardo) de los proyectos que cambien
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
          toast('warn', `${f.name}: ya hay datos más recientes de ${parsed.code}; no se ha importado.`)
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

  const handleHoursFiles = async (code: string, files: File[]) => {
    let next = db
    for (const f of files) {
      try {
        const parsed = parseHoras(await f.arrayBuffer())
        if (parsed.code && parsed.code !== code) {
          toast(
            'error',
            `${f.name}: es del proyecto ${parsed.code}, no de ${code}; no se ha importado.`,
          )
          continue
        }
        next = mergeHours(next, code, parsed.records, parsed.areaPorPersona)
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

  const handleConcostFiles = async (files: File[]) => {
    if (!selected) return

    let next = db
    for (const f of files) {
      const name = f.name.toLowerCase()
      try {
        if (name.includes('explotacion')) {
          const parsed = parseExplotacion(await f.arrayBuffer(), f.name)
          if (parsed.code !== selected) {
            toast(
              'error',
              `${f.name}: es del proyecto ${parsed.code}, no de ${selected}; no se ha importado.`,
            )
            continue
          }
          const res = upsertExplotacion(next, parsed)
          if (res.skipped) {
            toast('warn', `${f.name}: ya hay datos más recientes de ${parsed.code}; no se ha importado.`)
            continue
          }
          next = res.db
          toast('ok', `${parsed.code}: explotación actualizada con ${parsed.entries.length} apuntes.`)
          parsed.warnings.forEach((w) => toast('warn', `${parsed.code}: ${w}`))
          continue
        }

        const parsed = parseHoras(await f.arrayBuffer())
        if (parsed.code && parsed.code !== selected) {
          toast(
            'error',
            `${f.name}: es del proyecto ${parsed.code}, no de ${selected}; no se ha importado.`,
          )
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
          toast('error', `${f.name}: no se ha podido identificar el proyecto. Sube primero el fichero de Explotación.`)
          continue
        }
        if (!next.projects[parsed.code]) {
          toast('error', `${f.name}: primero importa Explotación para crear el proyecto ${parsed.code}.`)
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

  const handleBackupExport = () => {
    const blob = new Blob([exportJSON(db)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `jp-control-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const handleBackupImport = async (file: File) => {
    try {
      const next = importJSON(await file.text())
      setDb(next)
      setSelected(null)
      toast('ok', `Copia restaurada: ${Object.keys(next.projects).length} proyectos.`)
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Copia de seguridad no válida.')
    }
  }

  const projects = Object.values(db.projects).sort((a, b) => a.name.localeCompare(b.name))
  const project = selected ? db.projects[selected] : undefined

  return (
    <div className="flex h-full">
      <Sidebar
        projects={projects}
        selected={selected}
        onSelect={setSelected}
        onImportConcost={handleConcostFiles}
      />

      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-background/95 px-6 py-3 text-xs backdrop-blur">
          <div className="flex items-center gap-2 min-w-0">
            {syncEstado === 'nube' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-[11px] font-bold text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" /> Sincronizado con la nube
              </span>
            )}
            {syncEstado === 'local' && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1 text-[11px] font-bold text-ink-muted"
                title="No hay base de datos configurada: los datos solo se guardan en este navegador."
              >
                <span className="h-1.5 w-1.5 rounded-full bg-ink-muted" /> Solo local
              </span>
            )}
            {syncEstado === 'cargando' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1 text-[11px] font-bold text-ink-muted">
                Conectando…
              </span>
            )}
            {syncEstado === 'error' && (
              <span className="inline-flex items-center gap-2 rounded-full bg-danger/10 px-3 py-1 text-[11px] font-bold text-danger">
                Error al sincronizar
                <button onClick={conectar} className="underline">
                  Reintentar
                </button>
              </span>
            )}
            {syncEstado === 'auth' && (
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  setToken(codigoAcceso.trim())
                  conectar()
                }}
              >
                <input
                  type="password"
                  value={codigoAcceso}
                  onChange={(e) => setCodigoAcceso(e.target.value)}
                  placeholder="Código de acceso"
                  className="h-8 w-40 rounded-lg border border-line bg-surface px-2.5 text-xs text-ink focus:border-accent-500 focus:ring-2 focus:ring-accent-500/40 outline-none"
                />
                <button
                  type="submit"
                  className="h-8 rounded-lg bg-accent-500 px-3 text-[11px] font-bold text-primary-950 hover:bg-accent-400 transition-colors"
                >
                  Conectar
                </button>
              </form>
            )}
          </div>
          <div className="flex items-center gap-2">
          <button
            onClick={handleBackupExport}
            className="border border-line bg-surface rounded-lg px-3.5 h-9 font-semibold hover:bg-surface-muted text-primary-900 transition-colors"
          >
            Exportar copia
          </button>
          <button
            onClick={() => backupInputRef.current?.click()}
            className="border border-line bg-surface rounded-lg px-3.5 h-9 font-semibold hover:bg-surface-muted text-primary-900 transition-colors"
          >
            Restaurar copia
          </button>
          </div>
          <input
            ref={backupInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleBackupImport(f)
              e.target.value = ''
            }}
          />
        </div>

        {project ? (
          <ProjectDashboard
            key={project.code}
            project={project}
            onUpdate={(patch) => setDb((d) => updateProject(d, project.code, patch))}
            onDelete={() => {
              setDb((d) => deleteProject(d, project.code))
              setSelected(null)
            }}
            onImportHours={(files) => handleHoursFiles(project.code, files)}
          />
        ) : (
          <Overview
            projects={projects}
            onSelect={setSelected}
            onFiles={handleExplotacionFiles}
            onHoursFiles={handleOverviewHoursFiles}
          />
        )}
      </main>

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 space-y-2 z-50 max-w-md">
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
