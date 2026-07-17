import { describe, expect, it, vi } from 'vitest'
import { crearEntradaPendiente, crearMapaSync, hashJson, metaDesdeMapa, planificarSync, sincronizarEntidades } from './cloudSync.ts'
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
    expect(resultado.conflictos).toEqual([{ key: 'a', remoto, version: 5 }])
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
