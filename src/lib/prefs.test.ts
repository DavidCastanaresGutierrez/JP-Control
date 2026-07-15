import { beforeEach, describe, expect, it } from 'vitest'
import type { DB, Project } from '../types.ts'
import {
  loadMiDepartamento,
  loadProjectOrder,
  moveCode,
  orderProjects,
  persistMiDepartamento,
  persistProjectOrder,
} from './prefs.ts'

// El entorno node de vitest no trae localStorage: un doble mínimo compartido
const store = new Map<string, string>()
;(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
}

beforeEach(() => store.clear())

const proyecto = (code: string, name: string): Project => ({ code, name, entries: [], hours: [] })

const projects: DB['projects'] = {
  A: proyecto('A', 'Zeta'),
  B: proyecto('B', 'Alfa'),
  C: proyecto('C', 'Media'),
}

describe('orderProjects', () => {
  it('respeta el orden guardado y añade el resto por nombre', () => {
    expect(orderProjects(projects, ['C']).map((p) => p.code)).toEqual(['C', 'B', 'A']) // C fijado; Alfa (B) antes que Zeta (A)
  })

  it('ignora códigos guardados que ya no existen', () => {
    expect(orderProjects(projects, ['X', 'A']).map((p) => p.code)).toEqual(['A', 'B', 'C'])
  })
})

describe('moveCode', () => {
  it('mueve el código arrastrado a la posición del destino', () => {
    expect(moveCode(['A', 'B', 'C'], 'C', 'A')).toEqual(['C', 'A', 'B'])
    expect(moveCode(['A', 'B', 'C'], 'A', 'C')).toEqual(['B', 'C', 'A'])
  })

  it('devuelve la lista intacta si algún código no existe', () => {
    const codes = ['A', 'B']
    expect(moveCode(codes, 'X', 'A')).toBe(codes)
    expect(moveCode(codes, 'A', 'A')).toBe(codes)
  })
})

describe('persistencia de preferencias', () => {
  it('project order: persiste y recupera; JSON roto devuelve lista vacía', () => {
    persistProjectOrder(['B', 'A'])
    expect(loadProjectOrder()).toEqual(['B', 'A'])

    store.set('jp-control-project-order-v1', 'no-es-json{')
    expect(loadProjectOrder()).toEqual([])
  })

  it('mi departamento: persiste, recupera y se borra con null', () => {
    persistMiDepartamento('Desarrollo de software')
    expect(loadMiDepartamento()).toBe('Desarrollo de software')

    persistMiDepartamento(null)
    expect(loadMiDepartamento()).toBeNull()
  })
})
