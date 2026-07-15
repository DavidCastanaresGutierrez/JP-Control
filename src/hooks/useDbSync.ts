import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { DB, DepartmentModule, Project } from '../types'
import { crearPersistState, loadDBAsync, persistDB, sanearDepartamentos, sanearProjects } from '../lib/store'
import { crearMapaSync, sincronizarEntidades } from '../lib/cloudSync'
import type { MapaSync } from '../lib/cloudSync'
import {
  deleteRemoteDepartment,
  deleteRemoteProject,
  fetchRemoteDepartments,
  fetchRemoteProjects,
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
  }, [setAuthSession])

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
  }, [db, dbReady, syncEstado, toast])

  return { db, setDb, dbReady, syncEstado, setSyncEstado, conectar }
}
