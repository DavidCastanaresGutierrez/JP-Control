/** Resultado de un push con bloqueo optimista. En conflicto llega la version remota vigente. */
export type PushResult<T> =
  | { estado: 'ok'; version: number }
  | { estado: 'conflicto'; version: number; data: T }
  | { estado: 'error' }

/**
 * Estado de sincronizacion de una entidad (proyecto o departamento):
 * - obj/json: ultima copia confirmada por el servidor, para detectar cambios
 *   primero por identidad (O(1)) y solo despues por contenido (stringify)
 * - version: version remota conocida, para el bloqueo optimista del PUT
 */
export interface EntradaSync<T> {
  obj: T
  json: string
  version: number | null
}

export type MapaSync<T> = Map<string, EntradaSync<T>>

export function crearMapaSync<T>(
  actuales: Record<string, T>,
  versions: Record<string, number>,
): MapaSync<T> {
  return new Map(
    Object.entries(actuales).map(([key, obj]) => [
      key,
      { obj, json: JSON.stringify(obj), version: versions[key] ?? null },
    ]),
  )
}

export interface ConflictoSync<T> {
  key: string
  /** Version remota vigente que ha ganado el conflicto */
  remoto: T
  version: number
}

export interface ResultadoSync<T> {
  estado: 'ok' | 'error'
  /** Entidades donde otro usuario guardo antes: el llamador debe adoptar `remoto` y avisar */
  conflictos: Array<ConflictoSync<T>>
}

/**
 * Sube al servidor las entidades cambiadas y borra las eliminadas, con
 * bloqueo optimista. La deteccion de cambios es por identidad de objeto
 * (los mutadores del store crean objetos nuevos solo para lo que tocan),
 * con el JSON como confirmacion: no se serializa nada que no haya cambiado.
 *
 * En conflicto (otro usuario guardo una version mas reciente) NO se pisa la
 * version remota: se devuelve en `conflictos` para que el llamador la adopte
 * localmente y avise al usuario, que puede rehacer su cambio sobre lo ultimo.
 */
export async function sincronizarEntidades<T>(opts: {
  actuales: Record<string, T>
  mapa: MapaSync<T>
  push: (key: string, valor: T, baseVersion: number | null) => Promise<PushResult<T>>
  remove: (key: string) => Promise<boolean>
}): Promise<ResultadoSync<T>> {
  const { actuales, mapa, push, remove } = opts
  const conflictos: Array<ConflictoSync<T>> = []

  for (const [key, valor] of Object.entries(actuales)) {
    const entrada = mapa.get(key)
    if (entrada && entrada.obj === valor) continue // identidad intacta: sin cambios
    const json = JSON.stringify(valor)
    if (entrada && entrada.json === json) {
      entrada.obj = valor // mismo contenido con objeto nuevo: refrescar la referencia
      continue
    }
    const resultado = await push(key, valor, entrada?.version ?? null)
    if (resultado.estado === 'ok') {
      mapa.set(key, { obj: valor, json, version: resultado.version })
    } else if (resultado.estado === 'conflicto') {
      mapa.set(key, {
        obj: resultado.data,
        json: JSON.stringify(resultado.data),
        version: resultado.version,
      })
      conflictos.push({ key, remoto: resultado.data, version: resultado.version })
    } else {
      return { estado: 'error', conflictos }
    }
  }

  for (const key of [...mapa.keys()]) {
    if (key in actuales) continue
    if (await remove(key)) mapa.delete(key)
    else return { estado: 'error', conflictos }
  }

  return { estado: 'ok', conflictos }
}
