/**
 * Sincronización de un único documento con la nube (bloqueo optimista por
 * versión). A diferencia de un equipo, aquí hay un solo usuario en varios
 * dispositivos, así que el caso real de conflicto es "he añadido cosas en el
 * móvil y en el portátil": la fusión une los arrays por `id` en vez de que un
 * lado pise al otro. Para ids presentes en ambos lados gana el remoto (ya
 * persistido), y el llamador avisa de que se adoptó la versión de la nube.
 */
import type { DB } from '../types.ts'
import { normalizarDb } from '../types.ts'

interface ConId {
  id: string
}

/** Une dos listas por `id`: todos los elementos de ambas; en empate gana `remoto`. */
export function unirPorId<T extends ConId>(local: T[], remoto: T[]): T[] {
  const mapa = new Map<string, T>()
  for (const it of local) mapa.set(it.id, it)
  for (const it of remoto) mapa.set(it.id, it) // el remoto sobrescribe en empate
  return [...mapa.values()]
}

/**
 * Fusiona dos documentos completos uniendo cada array por id. El resultado
 * contiene el trabajo de ambos lados; nunca se pierden altas hechas offline.
 */
export function fusionarDB(local: DB, remoto: DB): DB {
  return {
    transacciones: unirPorId(local.transacciones, remoto.transacciones),
    activos: unirPorId(local.activos, remoto.activos),
    patrimonio: unirPorId(local.patrimonio, remoto.patrimonio),
    medidas: unirPorId(local.medidas, remoto.medidas),
    comidas: unirPorId(local.comidas, remoto.comidas),
    entrenos: unirPorId(local.entrenos, remoto.entrenos),
    habitos: unirPorId(local.habitos, remoto.habitos),
    registrosHabito: unirPorId(local.registrosHabito, remoto.registrosHabito),
  }
}

export type AccionCarga =
  | { tipo: 'adoptar-remoto'; data: DB; version: number }
  | { tipo: 'fusionar-y-subir'; data: DB; baseVersion: number }
  | { tipo: 'subir-local'; baseVersion: number }
  | { tipo: 'sin-cambios'; version: number }

/**
 * Decide qué hacer al arrancar comparando lo local con lo que hay en la nube:
 * - sin remoto todavía → subir lo local como versión inicial
 * - versión remota == última sincronizada → local manda; sube si hay cambios
 * - versión remota nueva y local sin cambios → adoptar lo remoto
 * - versión remota nueva y local con cambios → fusionar y subir sobre la nueva
 */
export function planificarCarga(opts: {
  local: DB
  hayLocal: boolean
  ultimaVersion: number
  localSucio: boolean
  remoto: DB | null
  versionRemota: number
}): AccionCarga {
  const { local, hayLocal, ultimaVersion, localSucio, remoto, versionRemota } = opts

  if (!remoto || versionRemota === 0) {
    return { tipo: 'subir-local', baseVersion: 0 }
  }
  if (!hayLocal) {
    return { tipo: 'adoptar-remoto', data: normalizarDb(remoto), version: versionRemota }
  }
  if (versionRemota === ultimaVersion) {
    if (localSucio) return { tipo: 'subir-local', baseVersion: versionRemota }
    return { tipo: 'sin-cambios', version: versionRemota }
  }
  // La nube cambió en otro dispositivo desde nuestra última sincronización.
  if (!localSucio) {
    return { tipo: 'adoptar-remoto', data: normalizarDb(remoto), version: versionRemota }
  }
  return { tipo: 'fusionar-y-subir', data: fusionarDB(local, normalizarDb(remoto)), baseVersion: versionRemota }
}
