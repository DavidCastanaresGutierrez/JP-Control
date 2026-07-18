import { describe, expect, it } from 'vitest'
import { dbVacia } from '../types.ts'
import type { DB, Transaccion } from '../types.ts'
import { fusionarDB, planificarCarga, unirPorId } from './cloudSync.ts'

const tx = (id: string): Transaccion => ({ id, fecha: '2026-07-01', tipo: 'gasto', categoria: 'x', importe: 1 })

describe('unirPorId', () => {
  it('une por id y el remoto gana en empate', () => {
    const local = [tx('a'), { ...tx('b'), importe: 10 }]
    const remoto = [{ ...tx('b'), importe: 99 }, tx('c')]
    const r = unirPorId(local, remoto)
    expect(r.map((x) => x.id).sort()).toEqual(['a', 'b', 'c'])
    expect(r.find((x) => x.id === 'b')?.importe).toBe(99)
  })
})

describe('fusionarDB', () => {
  it('combina altas hechas en ambos dispositivos sin perder ninguna', () => {
    const local: DB = { ...dbVacia(), transacciones: [tx('a')] }
    const remoto: DB = { ...dbVacia(), transacciones: [tx('b')] }
    expect(fusionarDB(local, remoto).transacciones.map((t) => t.id).sort()).toEqual(['a', 'b'])
  })
})

describe('planificarCarga', () => {
  const local: DB = { ...dbVacia(), transacciones: [tx('a')] }
  const remoto: DB = { ...dbVacia(), transacciones: [tx('b')] }

  it('sube lo local cuando no hay nada en la nube', () => {
    const a = planificarCarga({ local, hayLocal: true, ultimaVersion: 0, localSucio: true, remoto: null, versionRemota: 0 })
    expect(a.tipo).toBe('subir-local')
  })

  it('adopta lo remoto en un dispositivo nuevo sin datos locales', () => {
    const a = planificarCarga({ local: dbVacia(), hayLocal: false, ultimaVersion: 0, localSucio: false, remoto, versionRemota: 5 })
    expect(a).toMatchObject({ tipo: 'adoptar-remoto', version: 5 })
  })

  it('no hace nada si la versión remota coincide y no hay cambios locales', () => {
    const a = planificarCarga({ local, hayLocal: true, ultimaVersion: 5, localSucio: false, remoto, versionRemota: 5 })
    expect(a).toMatchObject({ tipo: 'sin-cambios', version: 5 })
  })

  it('adopta lo remoto si cambió en la nube y no hay cambios locales', () => {
    const a = planificarCarga({ local, hayLocal: true, ultimaVersion: 3, localSucio: false, remoto, versionRemota: 5 })
    expect(a.tipo).toBe('adoptar-remoto')
  })

  it('fusiona y sube si ambos lados cambiaron', () => {
    const a = planificarCarga({ local, hayLocal: true, ultimaVersion: 3, localSucio: true, remoto, versionRemota: 5 })
    expect(a.tipo).toBe('fusionar-y-subir')
    if (a.tipo === 'fusionar-y-subir') {
      expect(a.data.transacciones.map((t) => t.id).sort()).toEqual(['a', 'b'])
      expect(a.baseVersion).toBe(5)
    }
  })
})
