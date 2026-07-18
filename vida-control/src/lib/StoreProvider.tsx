import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { DB } from '../types.ts'
import { dbVacia, normalizarDb } from '../types.ts'
import { idbGuardar, idbLeer } from './idb.ts'
import { descargarEstado, nubeConfigurada, subirEstado } from './api.ts'
import { fusionarDB, planificarCarga } from './cloudSync.ts'
import { StoreContext, CLAVE_DB, CLAVE_META } from './store.ts'
import type { EstadoNube, Meta, StoreCtx } from './store.ts'

const RETARDO_SYNC_MS = 1200

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(dbVacia)
  const [cargando, setCargando] = useState(true)
  const [estadoNube, setEstadoNube] = useState<EstadoNube>('local')
  const [aviso, setAviso] = useState<string | null>(null)

  const dbRef = useRef<DB>(db)
  const versionRef = useRef(0)
  const sucioRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const iniciadoRef = useRef(false)

  const persistirMeta = useCallback(async () => {
    const meta: Meta = { version: versionRef.current, sucio: sucioRef.current }
    await idbGuardar(CLAVE_META, meta)
  }, [])

  const aplicarDb = useCallback((next: DB) => {
    dbRef.current = next
    setDb(next)
  }, [])

  const empujar = useCallback(async () => {
    if (!nubeConfigurada()) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setEstadoNube('offline')
      return
    }
    setEstadoNube('sincronizando')
    const r = await subirEstado(dbRef.current, versionRef.current)
    if (r.estado === 'ok') {
      versionRef.current = r.version
      sucioRef.current = false
      await persistirMeta()
      setEstadoNube('sincronizado')
      return
    }
    if (r.estado === 'conflicto') {
      // Otro dispositivo guardó antes: se fusiona por id y se reintenta una vez.
      const fusion = fusionarDB(dbRef.current, normalizarDb(r.data))
      aplicarDb(fusion)
      await idbGuardar(CLAVE_DB, fusion)
      const r2 = await subirEstado(fusion, r.version)
      if (r2.estado === 'ok') {
        versionRef.current = r2.version
        sucioRef.current = false
        await persistirMeta()
        setEstadoNube('sincronizado')
        setAviso('Se combinaron cambios hechos en otro dispositivo.')
      } else {
        versionRef.current = r.version
        sucioRef.current = true
        await persistirMeta()
        setEstadoNube('error')
      }
      return
    }
    setEstadoNube('error')
    setAviso(r.mensaje)
  }, [aplicarDb, persistirMeta])

  const programarSync = useCallback(() => {
    if (!nubeConfigurada()) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void empujar()
    }, RETARDO_SYNC_MS)
  }, [empujar])

  const update = useCallback(
    (fn: (db: DB) => DB) => {
      const next = fn(dbRef.current)
      aplicarDb(next)
      sucioRef.current = true
      void idbGuardar(CLAVE_DB, next)
      void persistirMeta()
      programarSync()
    },
    [aplicarDb, persistirMeta, programarSync],
  )

  const reemplazar = useCallback(
    (next: DB) => {
      const limpio = normalizarDb(next)
      aplicarDb(limpio)
      sucioRef.current = true
      void idbGuardar(CLAVE_DB, limpio)
      void persistirMeta()
      programarSync()
    },
    [aplicarDb, persistirMeta, programarSync],
  )

  const sincronizarAhora = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    void empujar()
  }, [empujar])

  // Carga inicial + primera sincronización (una sola vez, aun en StrictMode).
  useEffect(() => {
    if (iniciadoRef.current) return
    iniciadoRef.current = true

    void (async () => {
      const localGuardado = await idbLeer<DB>(CLAVE_DB)
      const meta = (await idbLeer<Meta>(CLAVE_META)) ?? { version: 0, sucio: false }
      const local = normalizarDb(localGuardado)
      aplicarDb(local)
      versionRef.current = meta.version
      sucioRef.current = meta.sucio

      if (!nubeConfigurada()) {
        setEstadoNube('local')
        setCargando(false)
        return
      }

      setEstadoNube('sincronizando')
      try {
        const remoto = await descargarEstado()
        const accion = planificarCarga({
          local,
          hayLocal: localGuardado !== undefined,
          ultimaVersion: meta.version,
          localSucio: meta.sucio,
          remoto: remoto.data,
          versionRemota: remoto.version,
        })
        if (accion.tipo === 'adoptar-remoto') {
          aplicarDb(accion.data)
          versionRef.current = accion.version
          sucioRef.current = false
          await idbGuardar(CLAVE_DB, accion.data)
          await persistirMeta()
          setEstadoNube('sincronizado')
        } else if (accion.tipo === 'sin-cambios') {
          versionRef.current = accion.version
          await persistirMeta()
          setEstadoNube('sincronizado')
        } else if (accion.tipo === 'fusionar-y-subir') {
          aplicarDb(accion.data)
          await idbGuardar(CLAVE_DB, accion.data)
          versionRef.current = accion.baseVersion
          sucioRef.current = true
          await persistirMeta()
          setAviso('Se combinaron cambios hechos en otro dispositivo.')
          setCargando(false)
          void empujar()
          return
        } else {
          // subir-local
          versionRef.current = accion.baseVersion
          if (sucioRef.current || accion.baseVersion === 0) {
            setCargando(false)
            void empujar()
            return
          }
          setEstadoNube('sincronizado')
        }
      } catch (err) {
        setEstadoNube(err instanceof Error && err.message.includes('red') ? 'offline' : 'error')
        if (err instanceof Error) setAviso(err.message)
      }
      setCargando(false)
    })()
  }, [aplicarDb, empujar, persistirMeta])

  // Reintenta al recuperar conexión.
  useEffect(() => {
    const onOnline = () => {
      if (sucioRef.current) void empujar()
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [empujar])

  const ctx: StoreCtx = {
    db,
    cargando,
    estadoNube,
    aviso,
    descartarAviso: () => setAviso(null),
    update,
    reemplazar,
    sincronizarAhora,
  }

  return <StoreContext.Provider value={ctx}>{children}</StoreContext.Provider>
}
