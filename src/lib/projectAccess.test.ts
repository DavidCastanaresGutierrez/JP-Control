import { describe, expect, it } from 'vitest'
import type { Project } from '../types.ts'
import { esJpDelUsuario, esSeguidoPorUsuario } from './projectAccess.ts'

const proyecto = (extra: Partial<Project>): Project => ({
  code: 'DSES.DE0001ESP.TYES',
  name: 'Proyecto de prueba',
  entries: [],
  hours: [],
  ...extra,
})

describe('esJpDelUsuario', () => {
  it('coincide por nombre con acentos y orden distinto', () => {
    const p = proyecto({ jp: 'CASTAÑARES GUTIERREZ, DAVID' })
    expect(esJpDelUsuario(p, 'David Castañares')).toBe(true)
  })

  it('exige dos tokens comunes cuando el JP tiene varios', () => {
    const p = proyecto({ jp: 'CASTAÑARES GUTIERREZ, DAVID' })
    expect(esJpDelUsuario(p, 'David Fernández')).toBe(false)
  })

  it('con JP de un solo token basta una coincidencia', () => {
    const p = proyecto({ jp: 'Pérez' })
    expect(esJpDelUsuario(p, 'Ana Perez')).toBe(true)
  })

  it('red de seguridad por email tipo "dcastanares"', () => {
    const p = proyecto({ jp: 'CASTAÑARES GUTIERREZ, DAVID' })
    expect(esJpDelUsuario(p, undefined, 'dcastanares@typsa.es')).toBe(true)
  })

  it('sin JP asignado nunca coincide', () => {
    const p = proyecto({})
    expect(esJpDelUsuario(p, 'David Castañares', 'dcastanares@typsa.es')).toBe(false)
  })

  it('otra persona no coincide ni por email', () => {
    const p = proyecto({ jp: 'CASTAÑARES GUTIERREZ, DAVID' })
    expect(esJpDelUsuario(p, 'María López', 'mlopez@typsa.es')).toBe(false)
  })
})

describe('esSeguidoPorUsuario', () => {
  it('coincide ignorando mayúsculas y espacios', () => {
    const p = proyecto({ watchers: ['dcastanares@typsa.es'] })
    expect(esSeguidoPorUsuario(p, '  DCastanares@typsa.es ')).toBe(true)
  })

  it('sin email o sin watchers no sigue', () => {
    expect(esSeguidoPorUsuario(proyecto({ watchers: ['a@b.c'] }), undefined)).toBe(false)
    expect(esSeguidoPorUsuario(proyecto({}), 'a@b.c')).toBe(false)
  })
})
