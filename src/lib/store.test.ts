import { describe, expect, it } from 'vitest'
import { sanearDepartamento, sanearProject, sanearProjects } from './store.ts'

describe('sanearProject', () => {
  it('garantiza los campos minimos con defaults', () => {
    const p = sanearProject('DSES.X', {})
    expect(p).toMatchObject({ code: 'DSES.X', name: 'DSES.X', entries: [], hours: [] })
  })

  it('repara arrays corruptos sin tocar el resto de campos', () => {
    const p = sanearProject('DSES.X', {
      code: 'DSES.X',
      name: 'Obra',
      entries: 'no-es-array',
      hours: null,
      budget: 500,
    })
    expect(p.entries).toEqual([])
    expect(p.hours).toEqual([])
    expect(p.budget).toBe(500)
    expect(p.name).toBe('Obra')
  })

  it('aplica la migracion de departamentos renombrados (Servicios -> Gestión)', () => {
    const p = sanearProject('DSES.X', {
      code: 'DSES.X',
      name: 'Obra',
      entries: [],
      hours: [],
      deptShare: { Servicios: 40 },
    })
    expect(p.deptShare).toEqual({ 'Gestión': 40 })
  })

  it('tolera valores no-objeto (fila corrupta en la cache o en la nube)', () => {
    expect(sanearProject('DSES.X', null)).toMatchObject({ code: 'DSES.X', entries: [], hours: [] })
    expect(sanearProject('DSES.X', 'basura')).toMatchObject({ code: 'DSES.X', entries: [], hours: [] })
  })
})

describe('sanearDepartamento', () => {
  it('garantiza roster y horas', () => {
    const m = sanearDepartamento('Gestión', { horas: undefined, roster: null })
    expect(m).toMatchObject({ departamento: 'Gestión', roster: {}, horas: [] })
  })
})

describe('sanearProjects', () => {
  it('usa la clave del registro como codigo de respaldo', () => {
    const saneados = sanearProjects({ 'DSES.A': { name: 'A', entries: [], hours: [] } })
    expect(saneados['DSES.A'].code).toBe('DSES.A')
  })
})
