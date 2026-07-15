import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Project } from '../types.ts'
import { esJpDelUsuario, esSeguidoPorUsuario } from './projectAccess.ts'

const proyecto = (extra: Partial<Project>): Project => ({
  code: 'DSES.DE0001ESP.TYES',
  name: 'Proyecto de prueba',
  entries: [],
  hours: [],
  ...extra,
})

test('esJpDelUsuario: coincide por nombre con acentos y orden distinto', () => {
  const p = proyecto({ jp: 'CASTAÑARES GUTIERREZ, DAVID' })
  assert.equal(esJpDelUsuario(p, 'David Castañares'), true)
})

test('esJpDelUsuario: exige dos tokens comunes cuando el JP tiene varios', () => {
  const p = proyecto({ jp: 'CASTAÑARES GUTIERREZ, DAVID' })
  assert.equal(esJpDelUsuario(p, 'David Fernández'), false)
})

test('esJpDelUsuario: con JP de un solo token basta una coincidencia', () => {
  const p = proyecto({ jp: 'Pérez' })
  assert.equal(esJpDelUsuario(p, 'Ana Perez'), true)
})

test('esJpDelUsuario: red de seguridad por email tipo "dcastanares"', () => {
  const p = proyecto({ jp: 'CASTAÑARES GUTIERREZ, DAVID' })
  assert.equal(esJpDelUsuario(p, undefined, 'dcastanares@typsa.es'), true)
})

test('esJpDelUsuario: sin JP asignado nunca coincide', () => {
  const p = proyecto({})
  assert.equal(esJpDelUsuario(p, 'David Castañares', 'dcastanares@typsa.es'), false)
})

test('esJpDelUsuario: otra persona no coincide ni por email', () => {
  const p = proyecto({ jp: 'CASTAÑARES GUTIERREZ, DAVID' })
  assert.equal(esJpDelUsuario(p, 'María López', 'mlopez@typsa.es'), false)
})

test('esSeguidoPorUsuario: coincide ignorando mayúsculas y espacios', () => {
  const p = proyecto({ watchers: ['dcastanares@typsa.es'] })
  assert.equal(esSeguidoPorUsuario(p, '  DCastanares@typsa.es '), true)
})

test('esSeguidoPorUsuario: sin email o sin watchers no sigue', () => {
  assert.equal(esSeguidoPorUsuario(proyecto({ watchers: ['a@b.c'] }), undefined), false)
  assert.equal(esSeguidoPorUsuario(proyecto({}), 'a@b.c'), false)
})
