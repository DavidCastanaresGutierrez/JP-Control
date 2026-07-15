import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import type { DB, Project } from '../types.ts'
import {
  loadMiDepartamento,
  loadProjectOrder,
  moveCode,
  orderProjects,
  persistMiDepartamento,
  persistProjectOrder,
} from './prefs.ts'

// Node no trae localStorage: un doble mínimo compartido por todos los tests
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

test('orderProjects: respeta el orden guardado y añade el resto por nombre', () => {
  const result = orderProjects(projects, ['C'])
  assert.deepEqual(
    result.map((p) => p.code),
    ['C', 'B', 'A'], // C fijado; Alfa (B) antes que Zeta (A)
  )
})

test('orderProjects: ignora códigos guardados que ya no existen', () => {
  const result = orderProjects(projects, ['X', 'A'])
  assert.deepEqual(
    result.map((p) => p.code),
    ['A', 'B', 'C'],
  )
})

test('moveCode: mueve el código arrastrado a la posición del destino', () => {
  assert.deepEqual(moveCode(['A', 'B', 'C'], 'C', 'A'), ['C', 'A', 'B'])
  assert.deepEqual(moveCode(['A', 'B', 'C'], 'A', 'C'), ['B', 'C', 'A'])
})

test('moveCode: devuelve la lista intacta si algún código no existe', () => {
  const codes = ['A', 'B']
  assert.equal(moveCode(codes, 'X', 'A'), codes)
  assert.equal(moveCode(codes, 'A', 'A'), codes)
})

test('project order: persiste y recupera; JSON roto devuelve lista vacía', () => {
  persistProjectOrder(['B', 'A'])
  assert.deepEqual(loadProjectOrder(), ['B', 'A'])

  store.set('jp-control-project-order-v1', 'no-es-json{')
  assert.deepEqual(loadProjectOrder(), [])
})

test('mi departamento: persiste, recupera y se borra con null', () => {
  persistMiDepartamento('Desarrollo de software')
  assert.equal(loadMiDepartamento(), 'Desarrollo de software')

  persistMiDepartamento(null)
  assert.equal(loadMiDepartamento(), null)
})
