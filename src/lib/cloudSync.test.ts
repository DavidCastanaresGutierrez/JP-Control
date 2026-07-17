import { describe, expect, it, vi } from 'vitest'
import { crearEntradaPendiente, crearMapaSync, diferenciasSuperficiales, fusionarTresVias, hashJson, metaDesdeMapa, planificarSync, sincronizarEntidades } from './cloudSync.ts'
import type { PushResult } from './cloudSync.ts'

type Doc = { nombre: string; valor: number }

const doc = (nombre: string, valor: number): Doc => ({ nombre, valor })

const pushOk = (version: number) =>
  vi.fn(async (): Promise<PushResult<Doc>> => ({ estado: 'ok', version }))

describe('crearMapaSync', () => {
  it('guarda objeto, json y version remota por clave', () => {
    const a = doc('a', 1)
    const mapa = crearMapaSync({ a }, { a: 7 })
    expect(mapa.get('a')).toEqual({ obj: a, json: JSON.stringify(a), version: 7 })
  })

  it('sin version conocida queda null (entidad aun no versionada)', () => {
    const mapa = crearMapaSync({ a: doc('a', 1) }, {})
    expect(mapa.get('a')!.version).toBeNull()
  })
})

describe('sincronizarEntidades', () => {
  it('no sube nada si la identidad no ha cambiado', async () => {
    const a = doc('a', 1)
    const mapa = crearMapaSync({ a }, { a: 1 })
    const push = pushOk(2)
    const resultado = await sincronizarEntidades({ actuales: { a }, mapa, push, remove: vi.fn() })
    expect(resultado).toEqual({ estado: 'ok', conflictos: [] })
    expect(push).not.toHaveBeenCalled()
  })

  it('objeto nuevo con el mismo contenido: refresca la referencia sin subir', async () => {
    const mapa = crearMapaSync({ a: doc('a', 1) }, { a: 1 })
    const clon = doc('a', 1)
    const push = pushOk(2)
    await sincronizarEntidades({ actuales: { a: clon }, mapa, push, remove: vi.fn() })
    expect(push).not.toHaveBeenCalled()
    expect(mapa.get('a')!.obj).toBe(clon) // la proxima pasada compara por identidad
  })

  it('sube los cambios con la version base conocida y adopta la nueva version', async () => {
    const mapa = crearMapaSync({ a: doc('a', 1) }, { a: 3 })
    const cambiado = doc('a', 99)
    const push = pushOk(4)
    const resultado = await sincronizarEntidades({ actuales: { a: cambiado }, mapa, push, remove: vi.fn() })
    expect(push).toHaveBeenCalledWith('a', cambiado, 3)
    expect(mapa.get('a')!.version).toBe(4)
    expect(resultado.conflictos).toEqual([])
  })

  it('una entidad nueva se sube con baseVersion null', async () => {
    const mapa = crearMapaSync<Doc>({}, {})
    const nuevo = doc('b', 1)
    const push = pushOk(1)
    await sincronizarEntidades({ actuales: { b: nuevo }, mapa, push, remove: vi.fn() })
    expect(push).toHaveBeenCalledWith('b', nuevo, null)
  })

  it('en conflicto adopta la version remota, avisa y no corta el resto del ciclo', async () => {
    const mapa = crearMapaSync({ a: doc('a', 1), b: doc('b', 1) }, { a: 1, b: 1 })
    const remoto = doc('a', 42)
    const push = vi.fn(async (key: string): Promise<PushResult<Doc>> =>
      key === 'a' ? { estado: 'conflicto', version: 5, data: remoto } : { estado: 'ok', version: 2 },
    )
    const resultado = await sincronizarEntidades({
      actuales: { a: doc('a', 2), b: doc('b', 2) },
      mapa,
      push,
      remove: vi.fn(),
    })
    expect(resultado.estado).toBe('ok')
    // Ambos tocaron 'valor': no hay nada local que conservar, gana lo remoto
    expect(resultado.conflictos).toEqual([
      { key: 'a', remoto, version: 5, fusionado: false, camposPisados: ['valor'] },
    ])
    expect(mapa.get('a')).toEqual({ obj: remoto, json: JSON.stringify(remoto), version: 5 })
    expect(mapa.get('b')!.version).toBe(2) // b se ha subido igualmente
  })

  it('un error de red corta el ciclo y devuelve estado error', async () => {
    const mapa = crearMapaSync({ a: doc('a', 1) }, { a: 1 })
    const push = vi.fn(async (): Promise<PushResult<Doc>> => ({ estado: 'error' }))
    const resultado = await sincronizarEntidades({
      actuales: { a: doc('a', 2) },
      mapa,
      push,
      remove: vi.fn(),
    })
    expect(resultado.estado).toBe('error')
    expect(mapa.get('a')!.version).toBe(1) // sin cambios: se reintentara
  })

  it('borra en remoto lo que ya no existe en local', async () => {
    const mapa = crearMapaSync({ a: doc('a', 1) }, { a: 1 })
    const remove = vi.fn(async () => true)
    const resultado = await sincronizarEntidades({ actuales: {}, mapa, push: pushOk(2), remove })
    expect(remove).toHaveBeenCalledWith('a')
    expect(mapa.has('a')).toBe(false)
    expect(resultado.estado).toBe('ok')
  })

  it('si el borrado remoto falla devuelve error y conserva la entrada para reintentar', async () => {
    const mapa = crearMapaSync({ a: doc('a', 1) }, { a: 1 })
    const remove = vi.fn(async () => false)
    const resultado = await sincronizarEntidades({ actuales: {}, mapa, push: pushOk(2), remove })
    expect(resultado.estado).toBe('error')
    expect(mapa.has('a')).toBe(true)
  })
})

describe('hashJson', () => {
  it('es estable y distingue contenidos', () => {
    expect(hashJson('{"a":1}')).toBe(hashJson('{"a":1}'))
    expect(hashJson('{"a":1}')).not.toBe(hashJson('{"a":2}'))
  })
})

describe('planificarSync', () => {
  const local = doc('a', 1)
  const json = JSON.stringify(local)
  const huella = { version: 3, hash: hashJson(json) }

  it('version y hash iguales: linea base local, sin descargas', () => {
    const plan = planificarSync({ a: local }, { a: huella }, { a: 3 })
    expect(plan.descargar).toEqual([])
    expect(plan.pendientes).toEqual([])
    expect(plan.base).toEqual([{ key: 'a', obj: local, json, version: 3 }])
  })

  it('version remota distinta: descargar (lo remoto manda)', () => {
    const plan = planificarSync({ a: local }, { a: huella }, { a: 4 })
    expect(plan.descargar).toEqual(['a'])
    expect(plan.base).toEqual([])
  })

  it('sin huella local (primer arranque tras migrar): descargar', () => {
    const plan = planificarSync({ a: local }, {}, { a: 3 })
    expect(plan.descargar).toEqual(['a'])
  })

  it('remoto conocido pero cache local vaciada: descargar', () => {
    const plan = planificarSync<Doc>({}, { a: huella }, { a: 3 })
    expect(plan.descargar).toEqual(['a'])
  })

  it('misma version pero hash distinto: edicion offline pendiente de subir', () => {
    const editado = doc('a', 99)
    const plan = planificarSync({ a: editado }, { a: huella }, { a: 3 })
    expect(plan.descargar).toEqual([])
    expect(plan.pendientes).toEqual([{ key: 'a', version: 3 }])
  })

  it('solo local (no existe en remoto): pendiente como nuevo', () => {
    const plan = planificarSync({ b: doc('b', 1) }, {}, {})
    expect(plan.pendientes).toEqual([{ key: 'b', version: null }])
  })
})

describe('metaDesdeMapa', () => {
  it('genera huellas y omite entradas pendientes', () => {
    const a = doc('a', 1)
    const mapa = crearMapaSync({ a }, { a: 2 })
    mapa.set('b', crearEntradaPendiente<Doc>(null))
    const meta = metaDesdeMapa(mapa)
    expect(meta).toEqual({ a: { version: 2, hash: hashJson(JSON.stringify(a)) } })
  })
})

describe('crearEntradaPendiente', () => {
  it('nunca casa ni por identidad ni por JSON: fuerza el push', async () => {
    const mapa = new Map([['a', crearEntradaPendiente<Doc>(5)]])
    const push = vi.fn(async (): Promise<PushResult<Doc>> => ({ estado: 'ok', version: 6 }))
    await sincronizarEntidades({ actuales: { a: doc('a', 1) }, mapa, push, remove: vi.fn() })
    expect(push).toHaveBeenCalledWith('a', doc('a', 1), 5)
  })
})

describe('fusionarTresVias', () => {
  type Ficha = { nombre: string; valor: number; nota?: string }
  const base: Ficha = { nombre: 'a', valor: 1, nota: 'original' }
  const baseJson = JSON.stringify(base)

  it('conserva el cambio local si lo remoto no toco ese campo', () => {
    const fusion = fusionarTresVias(baseJson, { ...base, valor: 99 }, { ...base, nota: 'remota' })
    expect(fusion.fusionado).toEqual({ nombre: 'a', valor: 99, nota: 'remota' })
    expect(fusion.conservaCambiosLocales).toBe(true)
    expect(fusion.camposPisados).toEqual([])
  })

  it('si ambos tocan el mismo campo gana lo remoto y se informa', () => {
    const fusion = fusionarTresVias(baseJson, { ...base, valor: 99 }, { ...base, valor: 7 })
    expect(fusion.fusionado).toEqual({ ...base, valor: 7 })
    expect(fusion.camposPisados).toEqual(['valor'])
    expect(fusion.conservaCambiosLocales).toBe(false)
  })

  it('un campo borrado en local se respeta si lo remoto no lo toco', () => {
    const sinNota: Ficha = { nombre: 'a', valor: 1 }
    const fusion = fusionarTresVias(baseJson, sinNota, { ...base, valor: 5 })
    expect(fusion.fusionado).toEqual({ nombre: 'a', valor: 5 })
    expect(fusion.conservaCambiosLocales).toBe(true)
  })

  it('sin base comun gana lo remoto entero', () => {
    const fusion = fusionarTresVias('', { ...base, valor: 99 }, { ...base, valor: 7 })
    expect(fusion.fusionado).toEqual({ ...base, valor: 7 })
    expect(fusion.conservaCambiosLocales).toBe(false)
  })
})

describe('sincronizarEntidades con fusion en conflicto', () => {
  type Ficha = { nombre: string; valor: number; nota: string }

  it('cambios en campos distintos: fusiona, reintenta y conserva lo de ambos', async () => {
    const base: Ficha = { nombre: 'a', valor: 1, nota: 'x' }
    const mapa = crearMapaSync({ a: base }, { a: 1 })
    const local: Ficha = { ...base, valor: 99 } // local toca 'valor'
    const remoto: Ficha = { ...base, nota: 'editada' } // remoto toco 'nota'
    const push = vi.fn(async (_key: string, _valor: Ficha, baseVersion: number | null): Promise<PushResult<Ficha>> =>
      baseVersion === 1 ? { estado: 'conflicto', version: 2, data: remoto } : { estado: 'ok', version: 3 },
    )
    const resultado = await sincronizarEntidades({ actuales: { a: local }, mapa, push, remove: vi.fn() })

    expect(push).toHaveBeenCalledTimes(2)
    expect(push).toHaveBeenLastCalledWith('a', { nombre: 'a', valor: 99, nota: 'editada' }, 2)
    expect(resultado.conflictos).toEqual([
      {
        key: 'a',
        remoto: { nombre: 'a', valor: 99, nota: 'editada' },
        version: 3,
        fusionado: true,
        camposPisados: [],
      },
    ])
    expect(mapa.get('a')!.version).toBe(3)
  })

  it('si el reintento vuelve a chocar, adopta lo ultimo del servidor sin insistir', async () => {
    const base: Ficha = { nombre: 'a', valor: 1, nota: 'x' }
    const mapa = crearMapaSync({ a: base }, { a: 1 })
    const remotoFinal: Ficha = { nombre: 'a', valor: 5, nota: 'z' }
    let llamadas = 0
    const push = vi.fn(async (): Promise<PushResult<Ficha>> => {
      llamadas++
      return llamadas === 1
        ? { estado: 'conflicto', version: 2, data: { ...base, nota: 'y' } }
        : { estado: 'conflicto', version: 4, data: remotoFinal }
    })
    const resultado = await sincronizarEntidades({
      actuales: { a: { ...base, valor: 99 } },
      mapa,
      push,
      remove: vi.fn(),
    })
    expect(push).toHaveBeenCalledTimes(2)
    expect(resultado.conflictos[0].remoto).toEqual(remotoFinal)
    expect(resultado.conflictos[0].fusionado).toBe(false)
    expect(mapa.get('a')!.version).toBe(4)
  })
})

describe('planificarSync con tombstones', () => {
  const local = doc('a', 1)
  const json = JSON.stringify(local)
  const huella = { version: 3, hash: hashJson(json) }

  it('borrado en remoto y local sin tocar: eliminar de la cache', () => {
    const plan = planificarSync({ a: local }, { a: huella }, {}, ['a'])
    expect(plan.eliminar).toEqual(['a'])
    expect(plan.pendientes).toEqual([])
  })

  it('borrado en remoto pero con edicion offline: se conserva y se sube (revive)', () => {
    const editado = doc('a', 99)
    const plan = planificarSync({ a: editado }, { a: huella }, {}, ['a'])
    expect(plan.eliminar).toEqual([])
    expect(plan.pendientes).toEqual([{ key: 'a', version: 3 }])
  })

  it('tombstone sin copia local: no hay nada que hacer', () => {
    const plan = planificarSync<Doc>({}, {}, {}, ['a'])
    expect(plan.eliminar).toEqual([])
    expect(plan.pendientes).toEqual([])
  })
})

describe('diferenciasSuperficiales', () => {
  it('detecta campos nuevos, cambiados y eliminados a primer nivel', () => {
    const base = JSON.stringify({ a: 1, b: [1, 2], c: 'x' })
    const diff = diferenciasSuperficiales(base, { a: 1, b: [1, 2, 3], d: true })
    expect(diff).toEqual({ set: { b: [1, 2, 3], d: true }, unset: ['c'] })
  })

  it('sin base comun devuelve null', () => {
    expect(diferenciasSuperficiales('', { a: 1 })).toBeNull()
  })
})

describe('sincronizarEntidades con pushParcial', () => {
  type Ficha = { nombre: string; valor: number; pesado: number[] }
  const esCampoPesado = (c: string) => c === 'pesado'

  it('un cambio solo en campos ligeros viaja como PATCH', async () => {
    const base: Ficha = { nombre: 'a', valor: 1, pesado: [1, 2, 3] }
    const mapa = crearMapaSync({ a: base }, { a: 4 })
    const push = vi.fn()
    const pushParcial = vi.fn(async (): Promise<PushResult<Ficha>> => ({ estado: 'ok', version: 5 }))
    const local = { ...base, valor: 99 }
    await sincronizarEntidades({ actuales: { a: local }, mapa, push, pushParcial, esCampoPesado, remove: vi.fn() })
    expect(pushParcial).toHaveBeenCalledWith('a', { set: { valor: 99 }, unset: [] }, 4)
    expect(push).not.toHaveBeenCalled()
    expect(mapa.get('a')).toEqual({ obj: local, json: JSON.stringify(local), version: 5 })
  })

  it('si el cambio toca un campo pesado va por PUT completo', async () => {
    const base: Ficha = { nombre: 'a', valor: 1, pesado: [1] }
    const mapa = crearMapaSync({ a: base }, { a: 4 })
    const push = vi.fn(async (): Promise<PushResult<Ficha>> => ({ estado: 'ok', version: 5 }))
    const pushParcial = vi.fn()
    const local = { ...base, pesado: [1, 2] }
    await sincronizarEntidades({ actuales: { a: local }, mapa, push, pushParcial, esCampoPesado, remove: vi.fn() })
    expect(pushParcial).not.toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith('a', local, 4)
  })

  it('una entidad nueva (sin version) va por PUT completo', async () => {
    const mapa = crearMapaSync<Ficha>({}, {})
    const push = vi.fn(async (): Promise<PushResult<Ficha>> => ({ estado: 'ok', version: 1 }))
    const pushParcial = vi.fn()
    await sincronizarEntidades({
      actuales: { b: { nombre: 'b', valor: 1, pesado: [] } },
      mapa,
      push,
      pushParcial,
      esCampoPesado,
      remove: vi.fn(),
    })
    expect(pushParcial).not.toHaveBeenCalled()
    expect(push).toHaveBeenCalled()
  })

  it('un conflicto en el PATCH cae en la fusion a tres vias con PUT completo', async () => {
    const base: Ficha = { nombre: 'a', valor: 1, pesado: [1] }
    const mapa = crearMapaSync({ a: base }, { a: 4 })
    const remoto: Ficha = { ...base, nombre: 'renombrada' }
    const pushParcial = vi.fn(async (): Promise<PushResult<Ficha>> => ({ estado: 'conflicto', version: 6, data: remoto }))
    const push = vi.fn(async (): Promise<PushResult<Ficha>> => ({ estado: 'ok', version: 7 }))
    const local = { ...base, valor: 99 }
    const resultado = await sincronizarEntidades({ actuales: { a: local }, mapa, push, pushParcial, esCampoPesado, remove: vi.fn() })
    // La fusion conserva valor=99 local + nombre remoto y reintenta con PUT
    expect(push).toHaveBeenCalledWith('a', { nombre: 'renombrada', valor: 99, pesado: [1] }, 6)
    expect(resultado.conflictos[0].fusionado).toBe(true)
    expect(mapa.get('a')!.version).toBe(7)
  })
})
