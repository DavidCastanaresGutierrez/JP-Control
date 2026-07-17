/** Resultado de un push con bloqueo optimista. En conflicto llega la version remota vigente. */
export type PushResult<T> =
  | { estado: 'ok'; version: number }
  | { estado: 'conflicto'; version: number; data: T }
  | { estado: 'error' }

/** Huella de la ultima copia sincronizada de cada entidad, persistida en IndexedDB. */
export type MetaSync = Record<string, { version: number; hash: string }>

/** Hash FNV-1a (32 bits) del JSON de una entidad: suficiente para detectar ediciones offline. */
export function hashJson(json: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}

export interface PlanSync<T> {
  /** Claves cuyo detalle hay que descargar (nuevas o con version remota distinta) */
  descargar: string[]
  /** Entidades locales al dia con la nube: sirven de linea base sin descargar nada */
  base: Array<{ key: string; obj: T; json: string; version: number }>
  /** Entidades locales con cambios sin subir (edicion offline o solo-locales) */
  pendientes: Array<{ key: string; version: number | null }>
  /** Entidades borradas en remoto y sin cambios locales: quitar de la cache */
  eliminar: string[]
}

/**
 * Decide que hace falta descargar de la nube comparando las versiones remotas
 * con la huella local (version + hash de la ultima copia sincronizada):
 * - version igual y hash igual  -> linea base local, no se descarga nada
 * - version igual y hash distinto -> edicion offline: se sube en el primer ciclo
 * - version distinta o sin huella -> descargar el detalle (lo remoto manda)
 * - borrada en remoto (tombstone) y local sin tocar -> eliminar de la cache;
 *   con edicion offline se conserva y se sube (revivira a proposito)
 * - solo local -> pendiente de subir como nuevo
 */
export function planificarSync<T>(
  locales: Record<string, T>,
  meta: MetaSync,
  remotas: Record<string, number>,
  remotasBorradas: string[] = [],
): PlanSync<T> {
  const descargar: string[] = []
  const base: PlanSync<T>['base'] = []
  const pendientes: PlanSync<T>['pendientes'] = []
  const eliminar: string[] = []
  const borradas = new Set(remotasBorradas)

  for (const [key, versionRemota] of Object.entries(remotas)) {
    const huella = meta[key]
    const local = locales[key]
    if (!huella || huella.version !== versionRemota || local === undefined) {
      descargar.push(key)
      continue
    }
    const json = JSON.stringify(local)
    if (hashJson(json) === huella.hash) {
      base.push({ key, obj: local, json, version: versionRemota })
    } else {
      pendientes.push({ key, version: huella.version })
    }
  }

  for (const key of Object.keys(locales)) {
    if (key in remotas) continue
    if (borradas.has(key)) {
      // Borrada en otro dispositivo: se propaga el borrado salvo que aqui
      // haya trabajo sin sincronizar (entonces se conserva y revivira)
      const huella = meta[key]
      const sinCambiosLocales = Boolean(huella) && hashJson(JSON.stringify(locales[key])) === huella!.hash
      if (sinCambiosLocales) eliminar.push(key)
      else pendientes.push({ key, version: huella?.version ?? null })
      continue
    }
    pendientes.push({ key, version: null })
  }

  return { descargar, base, pendientes, eliminar }
}

/** Entrada de mapa para una entidad con cambios sin subir: nunca casa ni por identidad ni por JSON. */
export function crearEntradaPendiente<T>(version: number | null): EntradaSync<T> {
  return { obj: undefined as unknown as T, json: '', version }
}

/** Huellas (version + hash) desde un mapa de sync; omite las entradas pendientes. */
export function metaDesdeMapa<T>(mapa: MapaSync<T>): MetaSync {
  const meta: MetaSync = {}
  for (const [key, entrada] of mapa) {
    if (entrada.json === '' || entrada.version === null) continue
    meta[key] = { version: entrada.version, hash: hashJson(entrada.json) }
  }
  return meta
}

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

export interface ResultadoFusion<T> {
  fusionado: T
  /** Campos editados a la vez en local y en remoto: se ha impuesto lo remoto */
  camposPisados: string[]
  /** true si el fusionado conserva algun cambio local (hay que subirlo) */
  conservaCambiosLocales: boolean
}

/**
 * Fusion a tres vias campo a campo (primer nivel): la base comun es la ultima
 * copia sincronizada (el `json` del mapa de sync). Un campo que solo cambio
 * en local se conserva; uno que solo cambio en remoto se adopta; si ambos lo
 * tocaron gana lo remoto (ya persistido) y se informa en `camposPisados`.
 * Sin base comun no se puede fusionar: gana lo remoto entero.
 */
export function fusionarTresVias<T extends object>(baseJson: string, local: T, remoto: T): ResultadoFusion<T> {
  if (!baseJson) return { fusionado: remoto, camposPisados: [], conservaCambiosLocales: false }
  const base = JSON.parse(baseJson) as Record<string, unknown>
  const loc = local as Record<string, unknown>
  const rem = remoto as Record<string, unknown>
  const claves = new Set([...Object.keys(base), ...Object.keys(loc), ...Object.keys(rem)])

  const fusionado: Record<string, unknown> = {}
  const camposPisados: string[] = []
  let conservaCambiosLocales = false
  const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

  for (const clave of claves) {
    const cambioLocal = !igual(loc[clave], base[clave])
    const cambioRemoto = !igual(rem[clave], base[clave])
    if (cambioLocal && !cambioRemoto) {
      conservaCambiosLocales = true
      if (clave in loc) fusionado[clave] = loc[clave]
    } else {
      if (cambioLocal && cambioRemoto && !igual(loc[clave], rem[clave])) camposPisados.push(clave)
      if (clave in rem) fusionado[clave] = rem[clave]
    }
  }

  return { fusionado: fusionado as T, camposPisados, conservaCambiosLocales }
}

export interface DiffSuperficial {
  /** Campos de primer nivel con valor nuevo o cambiado */
  set: Record<string, unknown>
  /** Campos de primer nivel eliminados */
  unset: string[]
}

/**
 * Diferencias de primer nivel entre la ultima copia sincronizada (base) y el
 * valor local: la base de los PATCH parciales. Devuelve null sin base comun.
 */
export function diferenciasSuperficiales(baseJson: string, valor: object): DiffSuperficial | null {
  if (!baseJson) return null
  const base = JSON.parse(baseJson) as Record<string, unknown>
  const actual = valor as Record<string, unknown>
  const set: Record<string, unknown> = {}
  const unset: string[] = []
  for (const clave of new Set([...Object.keys(base), ...Object.keys(actual)])) {
    if (!(clave in actual) || actual[clave] === undefined) {
      if (clave in base) unset.push(clave)
    } else if (JSON.stringify(actual[clave]) !== JSON.stringify(base[clave])) {
      set[clave] = actual[clave]
    }
  }
  return { set, unset }
}

export interface ConflictoSync<T> {
  key: string
  /** Version vigente adoptada tras el conflicto (fusionada si fue posible) */
  remoto: T
  version: number
  /** true si se conservaron los cambios locales via fusion a tres vias */
  fusionado: boolean
  /** Campos donde la edicion remota ha pisado la local */
  camposPisados: string[]
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
  /** PATCH parcial para cambios que solo tocan campos ligeros (opcional) */
  pushParcial?: (key: string, diff: DiffSuperficial, baseVersion: number) => Promise<PushResult<T>>
  /** Campos cuyo cambio obliga a subir la entidad completa (p.ej. entries/hours) */
  esCampoPesado?: (campo: string) => boolean
}): Promise<ResultadoSync<T>> {
  const { actuales, mapa, push, remove, pushParcial, esCampoPesado } = opts
  const conflictos: Array<ConflictoSync<T>> = []

  for (const [key, valor] of Object.entries(actuales)) {
    const entrada = mapa.get(key)
    if (entrada && entrada.obj === valor) continue // identidad intacta: sin cambios
    const json = JSON.stringify(valor)
    if (entrada && entrada.json === json) {
      entrada.obj = valor // mismo contenido con objeto nuevo: refrescar la referencia
      continue
    }

    // Si el cambio solo toca campos ligeros, basta un PATCH con esos campos
    // en vez de subir la entidad entera (los imports siguen yendo por PUT).
    let resultado: PushResult<T> | null = null
    if (pushParcial && entrada && entrada.json && entrada.version !== null) {
      const diff = diferenciasSuperficiales(entrada.json, valor as object)
      if (diff) {
        const campos = [...Object.keys(diff.set), ...diff.unset]
        if (campos.length === 0) {
          // Mismo contenido con distinto orden de claves: nada que subir
          mapa.set(key, { obj: valor, json, version: entrada.version })
          continue
        }
        if (!campos.some((c) => esCampoPesado?.(c))) {
          resultado = await pushParcial(key, diff, entrada.version)
        }
      }
    }
    resultado ??= await push(key, valor, entrada?.version ?? null)
    if (resultado.estado === 'ok') {
      mapa.set(key, { obj: valor, json, version: resultado.version })
    } else if (resultado.estado === 'conflicto') {
      // Fusion a tres vias: si el cambio local toca campos que lo remoto no
      // toco, se combina y se reintenta una vez sobre la version nueva.
      const fusion = fusionarTresVias(entrada?.json ?? '', valor as object, resultado.data as object)
      let adoptado = resultado.data
      let versionAdoptada = resultado.version
      let fusionAplicada = false
      if (fusion.conservaCambiosLocales) {
        const reintento = await push(key, fusion.fusionado as T, resultado.version)
        if (reintento.estado === 'ok') {
          adoptado = fusion.fusionado as T
          versionAdoptada = reintento.version
          fusionAplicada = true
        } else if (reintento.estado === 'conflicto') {
          // Doble carrera: adoptar lo ultimo del servidor sin insistir
          adoptado = reintento.data
          versionAdoptada = reintento.version
        } else {
          return { estado: 'error', conflictos }
        }
      }
      mapa.set(key, { obj: adoptado, json: JSON.stringify(adoptado), version: versionAdoptada })
      conflictos.push({
        key,
        remoto: adoptado,
        version: versionAdoptada,
        fusionado: fusionAplicada,
        camposPisados: fusion.camposPisados,
      })
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
