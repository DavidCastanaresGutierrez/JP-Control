import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DepartmentModule, HoraProduccion } from '../types.ts'
import {
  clasificarActividad,
  dashboardDepartamento,
  distribucionPorTipoActividad,
  esActividadFacturable,
  horasDelDepartamento,
  mesVencido,
  posiblesBajas,
  tablaOcupacion,
} from './departmentMetrics.ts'

const hora = (persona: string, mes: string, horas: number, proyecto = 'DSES.PROJ1 - Cliente'): HoraProduccion => ({
  persona,
  proyecto,
  fecha: `${mes}-15`,
  mes,
  horas,
  coste: 0,
})

const modulo = (over: Partial<DepartmentModule>): DepartmentModule => ({
  departamento: 'Desarrollo Informático',
  roster: {},
  horas: [],
  ...over,
})

describe('clasificarActividad', () => {
  it('clasifica por palabras clave del nombre', () => {
    expect(clasificarActividad('Vacaciones')).toBe('vacaciones')
    expect(clasificarActividad('Proyecto I+D+i Gemelo Digital')).toBe('innovacion')
    expect(clasificarActividad('Soporte a produccion')).toBe('soporte')
    expect(clasificarActividad('Formación interna')).toBe('formacion')
    expect(clasificarActividad('Ofertas 2026')).toBe('gestion')
    expect(clasificarActividad('DS.INTERNO - Herramientas')).toBe('gestion') // codigo interno sin cliente
    expect(clasificarActividad('DSES.DE3423ESP.TYES - ATLAS')).toBe('facturable')
  })

  it('codigo con IDI (regla TYPSA): innovacion, sin confundir palabras del nombre', () => {
    expect(clasificarActividad('DS.IDI0003 - Gemelo digital')).toBe('innovacion')
    expect(clasificarActividad('DSES.IDI21ESP.TYES - Plataforma')).toBe('innovacion')
    // "idi" en minusculas dentro de palabras del nombre NO es innovacion
    expect(clasificarActividad('DSES.DE1ESP.TYES - Estudio de medidas e idiomas')).toBe('facturable')
  })

  it('los overrides manuales mandan sobre las palabras clave', () => {
    expect(clasificarActividad('Vacaciones', { Vacaciones: 'gestion' })).toBe('gestion')
  })

  it('usa descripcion/tarea cuando el codigo de proyecto es opaco', () => {
    expect(clasificarActividad('AV0000', undefined, 'soporte incidencias')).toBe('soporte')
    expect(clasificarActividad('AV0000')).toBe('facturable')
  })
})

describe('horasDelDepartamento', () => {
  it('filtra por roster y por mes de inicio del analisis', () => {
    const m = modulo({
      roster: { A: { activo: true }, B: { activo: false } },
      horas: [hora('A', '2025-12', 8), hora('A', '2026-01', 8), hora('C', '2026-01', 8)],
      mesInicio: '2026-01',
    })
    const horas = horasDelDepartamento(m)
    expect(horas).toHaveLength(1) // C no esta en roster; 2025-12 anterior a mesInicio
    expect(horas[0]).toMatchObject({ persona: 'A', mes: '2026-01' })
  })
})

describe('mesVencido', () => {
  afterEach(() => vi.useRealTimers())
  const meses = ['2026-04', '2026-05', '2026-06', '2026-07']

  it('pasado el margen de gracia, el mes anterior al actual', () => {
    vi.useFakeTimers({ now: new Date(2026, 6, 15) }) // 15 jul 2026
    expect(mesVencido(meses)).toBe('2026-06')
  })

  it('en los primeros dias del mes retrocede un mes mas', () => {
    vi.useFakeTimers({ now: new Date(2026, 6, 3) }) // 3 jul 2026
    expect(mesVencido(meses)).toBe('2026-05')
  })

  it('si solo hay meses futuros devuelve el primero disponible', () => {
    vi.useFakeTimers({ now: new Date(2026, 6, 15) })
    expect(mesVencido(['2026-08', '2026-09'])).toBe('2026-08')
    expect(mesVencido([])).toBeNull()
  })
})

describe('tablaOcupacion', () => {
  // feb 2026: 160 h de jornada completa
  const m = modulo({
    roster: {
      A: { activo: true },
      B: { activo: true, jornadaPct: 50 },
      C: { activo: false },
      D: { activo: true, fechaBaja: '2026-02' },
    },
    horas: [
      hora('A', '2026-02', 120), // facturable
      hora('A', '2026-02', 40, 'DS.INTERNO - Herramientas'), // gestion
      hora('B', '2026-02', 20),
      hora('C', '2026-02', 99),
      hora('D', '2026-01', 50),
    ],
  })

  it('calcula ocupacion y facturabilidad con la jornada de cada persona', () => {
    const filas = tablaOcupacion(m, '2026-02')
    expect(filas.map((f) => f.persona)).toEqual(['A', 'B']) // C inactiva, D de baja desde 2026-02
    const [a, b] = filas
    expect(a).toMatchObject({
      horasDisponibles: 160,
      horasImputadas: 160,
      horasFacturables: 120,
      ocupacionPct: 100,
      facturablePct: 75,
      proyectoPrincipal: 'DSES.PROJ1 - Cliente',
      estado: 'ok',
    })
    expect(b.horasDisponibles).toBe(80) // media jornada
    expect(b.ocupacionPct).toBe(25)
    expect(b.estado).toBe('baja') // < 70%
  })

  it('la persona con fechaBaja cuenta en los meses anteriores a la baja', () => {
    const filas = tablaOcupacion(m, '2026-01')
    expect(filas.map((f) => f.persona)).toContain('D')
  })
})

describe('dashboardDepartamento', () => {
  it('agrega horas por tipo de actividad para el mes', () => {
    const m = modulo({
      roster: { A: { activo: true } },
      horas: [
        hora('A', '2026-02', 100),
        hora('A', '2026-02', 30, 'DS.INTERNO - Herramientas'),
        hora('A', '2026-02', 16, 'Vacaciones'),
      ],
    })
    const d = dashboardDepartamento(m, '2026-02')
    expect(d.horasImputadas).toBe(146)
    expect(d.horasFacturables).toBe(100)
    expect(d.horasInternas).toBe(30)
    expect(d.horasVacaciones).toBe(16)
    expect(d.facturabilidadPct).toBeCloseTo((100 / 146) * 100)
    expect(d.capacidadLibre).toBe(14) // 160 - 146
  })
})

describe('posiblesBajas', () => {
  it('avisa de quien no imputa nada real en los ultimos meses y sugiere fecha de baja', () => {
    const m = modulo({
      roster: { A: { activo: true }, B: { activo: true }, C: { activo: true, fechaBaja: '2026-03' } },
      horas: [
        hora('A', '2026-01', 8),
        hora('A', '2026-04', 8), // actividad reciente -> no es baja
        hora('B', '2026-01', 8),
        hora('B', '2026-04', 8, 'Vacaciones'), // solo vacaciones -> sigue siendo candidata
        hora('C', '2026-01', 8),
      ],
    })
    const bajas = posiblesBajas(m)
    expect(bajas).toHaveLength(1) // A tiene actividad real; C ya tiene fechaBaja
    expect(bajas[0]).toEqual({
      persona: 'B',
      ultimoMesConActividad: '2026-01',
      fechaBajaSugerida: '2026-02',
    })
  })
})

describe('facturabilidad con innovacion y soporte (nueva logica)', () => {
  const horaTipo = (proyecto: string, horas: number): HoraProduccion => ({
    persona: 'García López, María',
    proyecto,
    fecha: '2026-06-10',
    mes: '2026-06',
    horas,
    coste: horas * 35,
  })
  const equipo = (horas: HoraProduccion[]) =>
    modulo({ roster: { 'García López, María': { activo: true, jornadaPct: 100 } }, horas })

  it('esActividadFacturable: innovacion y soporte facturan; formacion, gestion y vacaciones no', () => {
    expect(esActividadFacturable('facturable')).toBe(true)
    expect(esActividadFacturable('innovacion')).toBe(true)
    expect(esActividadFacturable('soporte')).toBe(true)
    expect(esActividadFacturable('formacion')).toBe(false)
    expect(esActividadFacturable('gestion')).toBe(false)
    expect(esActividadFacturable('vacaciones')).toBe(false)
  })

  it('tablaOcupacion: las horas de innovacion y soporte cuentan como facturables', () => {
    const [fila] = tablaOcupacion(
      equipo([
        horaTipo('DSES.DE3423ESP.TYES - ATLAS Plataforma', 100),
        horaTipo('DS.ID0001 - I+D+i Plataforma interna', 40),
        horaTipo('DSES.SD1332ESP.TYES - Soporte aplicaciones', 20),
        horaTipo('DS.FO0001 - Formación técnica', 10),
        horaTipo('DS.AV0000MAG - LABORES NO ASIGNABLES', 10),
      ]),
      '2026-06',
    )
    expect(fila.horasImputadas).toBe(180)
    expect(fila.horasFacturables).toBe(160) // 100 cliente + 40 innovacion + 20 soporte
    expect(fila.facturablePct).toBeCloseTo((160 / 180) * 100)
  })

  it('distribucionPorTipoActividad: siempre devuelve los seis tipos en orden fijo, con 0 h si no hay horas', () => {
    const dist = distribucionPorTipoActividad(
      equipo([
        horaTipo('DSES.DE3423ESP.TYES - ATLAS Plataforma', 60),
        horaTipo('DS.FO0001 - Formación técnica', 40),
      ]),
      '2026-06',
    )
    expect(dist.map((d) => d.tipo)).toEqual([
      'facturable',
      'innovacion',
      'soporte',
      'formacion',
      'gestion',
      'vacaciones',
    ])
    expect(dist[0].horas).toBe(60)
    expect(dist[3].horas).toBe(40)
    expect(dist[5].horas).toBe(0) // vacaciones sin horas: presente, a cero
    expect(dist[0].pct).toBe(60)
  })

  it('dashboardDepartamento: el % de facturabilidad incluye innovacion y soporte', () => {
    const d = dashboardDepartamento(
      equipo([
        horaTipo('DSES.DE3423ESP.TYES - ATLAS Plataforma', 60),
        horaTipo('DS.ID0001 - I+D+i Plataforma interna', 30),
        horaTipo('DS.AV0000MAG - LABORES NO ASIGNABLES', 10),
      ]),
      '2026-06',
    )
    expect(d.horasImputadas).toBe(100)
    expect(d.horasFacturables).toBe(90)
    expect(d.facturabilidadPct).toBeCloseTo(90)
    // El desglose por tipo se mantiene informativo, sin mezclarse
    expect(d.horasInnovacion).toBe(30)
    expect(d.horasInternas).toBe(10)
  })
})
