import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { DB, DepartmentModule, Project } from '../types'
import {
  cargarMetaSync,
  crearPersistState,
  guardarMetaSync,
  loadDBAsync,
  persistDB,
  sanearDepartamentos,
  sanearProjects,
} from '../lib/store'
import {
  crearEntradaPendiente,
  metaDesdeMapa,
  planificarSync,
  sincronizarEntidades,
} from '../lib/cloudSync'
import type { MapaSync, MetaSync } from '../lib/cloudSync'
import {
  deleteRemoteDepartment,
  deleteRemoteProject,
  fetchRemoteDepartmentVersions,
  fetchRemoteDepartments,
  fetchRemoteProjectVersions,
  fetchRemoteProjects,
  patchDepartment,
  patchProject,
  pushDepartment,
  pushProject,
} from '../lib/api'
import type { AuthSession } from '../lib/auth'
import { clearAuthSession, getAuthSession, isSsoEnabled } from '../lib/auth'
import type { ToastKind } from './useToasts'

export type SyncEstado = 'cargando' | 'nube' | 'local' | 'auth' | 'error'

/**
 * Ciclo de vida completo de los datos de la app:
 *  1. carga asincrona de la cache local (IndexedDB) — `dbReady` la señala
 *  2. conexion con la nube y fusion del estado remoto (saneado) con el local
 *  3. persistencia local incremental en cada cambio
 *  4. sincronizacion con la nube con bloqueo optimista: en conflicto gana la
 *     version remota, se adopta localmente y se avisa por toast
 */
export function useDbSync(opts: {
  authSession: AuthSession | null
  setAuthSession: Dispatch<SetStateAction<AuthSession | null>>
  toast: (kind: ToastKind, text: string) => void
}) {
  const { authSession, setAuthSession, toast } = opts
  const [db, setDb] = useState<DB>(() => ({ projects: {}, departamentos: {} }))
  const [dbReady, setDbReady] = useState(false)
  const [syncEstado, setSyncEstado] = useState<SyncEstado>('cargando')
  const syncProyectos = useRef<MapaSync<Project>>(new Map())
  const syncDepartamentos = useRef<MapaSync<DepartmentModule>>(new Map())
  const persistState = useRef(crearPersistState({ projects: {}, departamentos: {} }))
  const metaSync = useRef<{ projects: MetaSync; departamentos: MetaSync }>({ projects: {}, departamentos: {} })
  const dbQuotaWarned = useRef(false)
  // Espejo del estado para leerlo desde conectar sin re-crear el callback
  const dbRef = useRef(db)
  dbRef.current = db

  useEffect(() => {
    Promise.all([loadDBAsync(), cargarMetaSync()]).then(([cargado, meta]) => {
      persistState.current = crearPersistState(cargado)
      metaSync.current = meta
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
    // Sync incremental: primero solo las versiones remotas (KBs); el detalle
    // completo se descarga unicamente para lo que no este al dia en la cache
    // local (comparando version + hash de la ultima copia sincronizada).
    const versionesP = await fetchRemoteProjectVersions()
    if (versionesP.estado === 'auth') {
      clearAuthSession()
      setAuthSession(null)
      setSyncEstado('auth')
      return
    }
    if (versionesP.estado === 'sin-nube') {
      setSyncEstado('local')
      return
    }

    const planP = planificarSync(
      dbRef.current.projects,
      metaSync.current.projects,
      versionesP.versions,
      versionesP.borradas,
    )
    const bajadaP =
      planP.descargar.length > 0
        ? await fetchRemoteProjects(planP.descargar)
        : { estado: 'ok' as const, projects: {} as Record<string, Project>, versions: {} as Record<string, number> }
    if (bajadaP.estado !== 'ok') {
      setSyncEstado(bajadaP.estado === 'auth' ? 'auth' : 'local')
      return
    }
    // El JSON remoto se sanea antes de entrar en la app: un proyecto corrupto
    // o de un esquema antiguo no debe reventar las vistas ni el sync.
    const projectsRemotos = sanearProjects(bajadaP.projects)
    const mapaP: MapaSync<Project> = new Map()
    for (const b of planP.base) mapaP.set(b.key, { obj: b.obj, json: b.json, version: b.version })
    for (const [code, p] of Object.entries(projectsRemotos)) {
      mapaP.set(code, { obj: p, json: JSON.stringify(p), version: bajadaP.versions[code] ?? null })
    }
    for (const pend of planP.pendientes) mapaP.set(pend.key, crearEntradaPendiente(pend.version))
    syncProyectos.current = mapaP

    const versionesD = await fetchRemoteDepartmentVersions()
    let departamentosRemotos: Record<string, DepartmentModule> = {}
    let eliminarDepartamentos: string[] = []
    if (versionesD.estado === 'ok') {
      const planD = planificarSync(
        dbRef.current.departamentos,
        metaSync.current.departamentos,
        versionesD.versions,
        versionesD.borradas,
      )
      eliminarDepartamentos = planD.eliminar
      const bajadaD =
        planD.descargar.length > 0
          ? await fetchRemoteDepartments(planD.descargar)
          : {
              estado: 'ok' as const,
              departamentos: {} as Record<string, DepartmentModule>,
              versions: {} as Record<string, number>,
            }
      if (bajadaD.estado === 'ok') {
        departamentosRemotos = sanearDepartamentos(bajadaD.departamentos)
        const mapaD: MapaSync<DepartmentModule> = new Map()
        for (const b of planD.base) mapaD.set(b.key, { obj: b.obj, json: b.json, version: b.version })
        for (const [nombre, d] of Object.entries(departamentosRemotos)) {
          mapaD.set(nombre, { obj: d, json: JSON.stringify(d), version: bajadaD.versions[nombre] ?? null })
        }
        for (const pend of planD.pendientes) mapaD.set(pend.key, crearEntradaPendiente(pend.version))
        syncDepartamentos.current = mapaD
      }
    }

    setDb((local) => {
      const projects = { ...local.projects, ...projectsRemotos }
      const departamentos = { ...local.departamentos, ...departamentosRemotos }
      // Tombstones: lo borrado en otro dispositivo se quita de la cache local
      // (el plan solo lo marca si aqui no hay trabajo sin sincronizar)
      for (const key of planP.eliminar) delete projects[key]
      for (const key of eliminarDepartamentos) delete departamentos[key]
      return { projects, departamentos }
    })
    for (const key of planP.eliminar) {
      toast('warn', `${key}: borrado desde otro dispositivo; se ha quitado tambien de este equipo.`)
    }
    for (const key of eliminarDepartamentos) {
      toast('warn', `Departamento ${key}: borrado desde otro dispositivo; se ha quitado tambien de este equipo.`)
    }
    metaSync.current = {
      projects: metaDesdeMapa(syncProyectos.current),
      departamentos: metaDesdeMapa(syncDepartamentos.current),
    }
    guardarMetaSync(metaSync.current)
    setSyncEstado('nube')
  }, [setAuthSession, toast])

  useEffect(() => {
    if (dbReady) conectar()
  }, [conectar, authSession, dbReady])

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
        // Cambios que no tocan apuntes ni horas viajan como PATCH (KBs)
        pushParcial: patchProject,
        esCampoPesado: (campo) => campo === 'entries' || campo === 'hours',
        remove: deleteRemoteProject,
      })
      const departamentos =
        proyectos.estado === 'ok'
          ? await sincronizarEntidades({
              actuales: db.departamentos,
              mapa: syncDepartamentos.current,
              push: (_nombre, modulo, baseVersion) => pushDepartment(modulo, baseVersion),
              pushParcial: patchDepartment,
              esCampoPesado: (campo) => campo === 'horas',
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
        const avisarConflicto = (prefijo: string, c: (typeof proyectos.conflictos)[number] | (typeof departamentos.conflictos)[number]) => {
          if (c.fusionado && c.camposPisados.length === 0) {
            toast('ok', `${prefijo}${c.key}: tus cambios se han combinado con los de otro usuario.`)
          } else if (c.fusionado) {
            toast('warn', `${prefijo}${c.key}: cambios combinados con los de otro usuario; en ${c.camposPisados.join(', ')} ha prevalecido su edicion.`)
          } else {
            toast('warn', `${prefijo}${c.key}: otro usuario ha guardado una version mas reciente; se ha cargado esa version y tus ultimos cambios no se han aplicado.`)
          }
        }
        for (const c of proyectos.conflictos) avisarConflicto('', c)
        for (const c of departamentos.conflictos) avisarConflicto('Departamento ', c)
      }

      if (proyectos.estado === 'error' || departamentos.estado === 'error') {
        setSyncEstado('error')
      } else {
        // Huellas al dia para que el proximo arranque no descargue lo que ya tiene
        metaSync.current = {
          projects: metaDesdeMapa(syncProyectos.current),
          departamentos: metaDesdeMapa(syncDepartamentos.current),
        }
        guardarMetaSync(metaSync.current)
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [db, dbReady, syncEstado, toast])

  return { db, setDb, dbReady, syncEstado, setSyncEstado, conectar }
}
