import { describe, expect, it } from 'vitest'
import type { Entry, HoursRecord, Project } from '../types.ts'
import {
  controlDepartamentos,
  enAlerta,
  forecastPresupuesto,
  horasDePersonas,
  horasJornadaMes,
  kpis,
  matrizHoras,
  monthlySeries,
  partidasExternas,
} from './metrics.ts'

let seq = 0
const entry = (over: Partial<Entry>): Entry => ({
  id: `e${++seq}`,
  asiento: null,
  fecha: '2026-01-15',
  mes: '2026-01',
  concepto: 'Apunte',
  area: null,
  cuenta: '6070 Trab. otras emp.(GENERAL)',
  cuentaCodigo: '6070',
  debe: 0,
  haber: 0,
  ...over,
})
const facturacion = (mes: string, haber: number): Entry =>
  entry({ mes, fecha: `${mes}-15`, cuenta: '9990 Facturación', cuentaCodigo: '9990', haber })
const gasto = (mes: string, debe: number, cuentaCodigo = '6070'): Entry =>
  entry({ mes, fecha: `${mes}-15`, cuentaCodigo, cuenta: `${cuentaCodigo} Cuenta`, debe })

const project = (over: Partial<Project>): Project => ({
  code: 'DSES.TEST',
  name: 'Proyecto de prueba',
  entries: [],
  hours: [],
  ...over,
})

describe('horasJornadaMes', () => {
  it('dias laborables x 8', () => {
    expect(horasJornadaMes('2026-02')).toBe(160) // feb 2026: 20 laborables
    expect(horasJornadaMes('2026-01')).toBe(176) // ene 2026: 22 laborables
  })
})

describe('kpis', () => {
  it('calcula gasto, facturacion y desvios sobre contrato/presupuesto', () => {
    const k = kpis(
      project({
        entries: [facturacion('2026-01', 1000), gasto('2026-01', 400)],
        contractValue: 2000,
        budget: 1000,
        progress: 60,
      }),
    )
    expect(k.gasto).toBe(400)
    expect(k.facturacion).toBe(1000)
    expect(k.resultado).toBe(600)
    expect(k.margenPct).toBe(60)
    expect(k.facturadoPct).toBe(50) // 1000 / 2000
    expect(k.consumoPct).toBe(40) // 400 / 1000
    expect(k.desvioFacturacion).toBe(-10) // 50 - 60
    expect(k.desvioGasto).toBe(-20) // 40 - 60
    expect(k.ratioAvanceFacturacion).toBeCloseTo(1.2) // 60 / 50
  })

  it('devuelve nulls sin contrato/presupuesto/avance', () => {
    const k = kpis(project({ entries: [gasto('2026-01', 100)] }))
    expect(k.facturadoPct).toBeNull()
    expect(k.consumoPct).toBeNull()
    expect(k.desvioFacturacion).toBeNull()
    expect(k.margenPct).toBeNull() // sin facturacion
  })

  it('enAlerta salta con mas de 10 puntos de retraso de facturacion', () => {
    expect(enAlerta({ ...kpis(project({})), desvioFacturacion: -10 })).toBe(false)
    expect(enAlerta({ ...kpis(project({})), desvioFacturacion: -10.1 })).toBe(true)
  })
})

describe('monthlySeries', () => {
  it('rellena meses sin apuntes y acumula', () => {
    const serie = monthlySeries([gasto('2026-01', 100), facturacion('2026-03', 500)])
    expect(serie.map((s) => s.mes)).toEqual(['2026-01', '2026-02', '2026-03'])
    expect(serie[1]).toEqual({ mes: '2026-02', gasto: 0, facturacion: 0, gastoAcum: 100, facturacionAcum: 0 })
    expect(serie[2].facturacionAcum).toBe(500)
  })
})

describe('horasDePersonas', () => {
  it('descarta encabezados del ERP, ceros y valores imposibles', () => {
    const limpio = horasDePersonas([
      { persona: 'García López, María', mes: '2026-01', horas: 120 },
      { persona: 'Total Proyecto', mes: '2026-01', horas: 200 },
      { persona: 'Fecha Alta:', mes: '2026-01', horas: 8 },
      { persona: 'Pérez Ruiz, Antonio', mes: '2026-01', horas: 0 },
      { persona: 'Colado, Serial', mes: '2026-01', horas: 45000 }, // serial de fecha leido como horas
    ])
    expect(limpio.map((h) => h.persona)).toEqual(['García López, María'])
  })
})

describe('matrizHoras', () => {
  const h = (persona: string, mes: string, horas: number): HoursRecord => ({ persona, mes, horas })

  it('marca picos y huecos frente a la mediana del participante', () => {
    const { meses, filas } = matrizHoras([
      h('A', '2026-01', 40),
      h('A', '2026-02', 40),
      h('A', '2026-04', 120),
      h('B', '2026-02', 50),
      h('B', '2026-03', 50),
      h('B', '2026-04', 50),
    ])
    expect(meses).toEqual(['2026-01', '2026-02', '2026-03', '2026-04'])
    const filaA = filas.find((f) => f.persona === 'A')!
    expect(filaA.celdas[3].anomalia).toBe('pico') // 120 frente a mediana 40
    expect(filaA.celdas[2].anomalia).toBe('hueco') // mes vacio entre meses con horas
    const filaB = filas.find((f) => f.persona === 'B')!
    expect(filaB.celdas[1].anomalia).toBe('nuevo') // se incorpora tras el primer mes global
    expect(filaB.nAnomalias).toBe(0) // "nuevo" es informativo
  })

  it('con dos meses marca caida si baja a menos de la mitad', () => {
    const { filas } = matrizHoras([h('A', '2026-01', 40), h('A', '2026-02', 10)])
    expect(filas[0].celdas[1].anomalia).toBe('caida')
  })
})

describe('forecastPresupuesto', () => {
  const tresMeses = [gasto('2026-01', 100), gasto('2026-02', 100), gasto('2026-03', 100)]

  it('null sin presupuesto o sin datos', () => {
    expect(forecastPresupuesto(tresMeses, undefined)).toBeNull()
    expect(forecastPresupuesto([], 1000)).toBeNull()
  })

  it('proyecta el consumo al ritmo de los ultimos meses', () => {
    const f = forecastPresupuesto(tresMeses, 600)!
    expect(f.consumido).toBe(300)
    expect(f.restante).toBe(300)
    expect(f.agotado).toBe(false)
    for (const esc of f.escenarios) {
      expect(esc.ritmoMensual).toBe(100)
      expect(esc.fecha).not.toBeNull()
    }
    // La proyeccion del grafico termina al alcanzar el presupuesto
    const ultima = f.chart[f.chart.length - 1]
    expect(ultima.proyeccion).toBeGreaterThanOrEqual(600)
  })

  it('marca agotado cuando el consumido supera el presupuesto', () => {
    const f = forecastPresupuesto(tresMeses, 200)!
    expect(f.agotado).toBe(true)
    expect(f.escenarios.every((e) => e.fecha === null)).toBe(true)
  })
})

describe('partidasExternas', () => {
  it('agrupa por cuenta+concepto y excluye personal (9101) y facturacion (9990)', () => {
    const partidas = partidasExternas([
      gasto('2026-01', 300),
      entry({ mes: '2026-01', cuentaCodigo: '6070', cuenta: '6070 Cuenta', concepto: 'Apunte', debe: 200 }),
      gasto('2026-01', 900, '9101'),
      facturacion('2026-01', 1000),
    ])
    expect(partidas).toHaveLength(1)
    expect(partidas[0]).toMatchObject({ tipoCodigo: '6070', concepto: 'Apunte', coste: 500 })
  })
})

describe('controlDepartamentos', () => {
  const horasConCoste: HoursRecord[] = [
    { persona: 'García López, María', mes: '2026-01', horas: 30, coste: 300 },
    { persona: 'Pérez Ruiz, Antonio', mes: '2026-01', horas: 10, coste: 100 },
  ]

  it('usa el coste real por persona y reparte por departamento', () => {
    const ctrl = controlDepartamentos(
      project({
        hours: horasConCoste,
        personDept: { 'García López, María': 'Gestión' },
        deptShare: { Gestión: 50 },
        budget: 1000,
      }),
    )
    expect(ctrl.costeEstimado).toBe(false)
    const gestion = ctrl.filas.find((f) => f.dept === 'Gestión')!
    expect(gestion.coste).toBe(300)
    expect(gestion.asignado).toBe(500)
    expect(gestion.consumidoPct).toBe(60)
    expect(gestion.estado).toBe('ok')
    const sinAsignar = ctrl.filas.find((f) => f.dept === 'Sin asignar')!
    expect(sinAsignar.personas).toEqual(['Pérez Ruiz, Antonio'])
    expect(ctrl.costeTotal).toBe(400)
  })

  it('sin coste por persona estima repartiendo la cuenta 9101 por horas', () => {
    const ctrl = controlDepartamentos(
      project({
        hours: [
          { persona: 'García López, María', mes: '2026-01', horas: 60 },
          { persona: 'Pérez Ruiz, Antonio', mes: '2026-01', horas: 30 },
        ],
        entries: [gasto('2026-01', 900, '9101')],
        personDept: { 'García López, María': 'Gestión', 'Pérez Ruiz, Antonio': 'Oficina del dato' },
      }),
    )
    expect(ctrl.costeEstimado).toBe(true)
    expect(ctrl.filas.find((f) => f.dept === 'Gestión')!.coste).toBe(600)
    expect(ctrl.filas.find((f) => f.dept === 'Oficina del dato')!.coste).toBe(300)
  })

  it('asigna las facturas de externos a "Otros Gastos" por defecto y marca excesos', () => {
    const ctrl = controlDepartamentos(
      project({
        hours: [{ persona: 'García López, María', mes: '2026-01', horas: 10, coste: 600 }],
        entries: [gasto('2026-01', 400)],
        personDept: { 'García López, María': 'Gestión' },
        deptShare: { Gestión: 50 },
        budget: 1000,
      }),
    )
    expect(ctrl.filas.find((f) => f.dept === 'Otros Gastos')!.costeExterno).toBe(400)
    const gestion = ctrl.filas.find((f) => f.dept === 'Gestión')!
    expect(gestion.consumidoPct).toBe(120) // 600 sobre 500 asignado
    expect(gestion.estado).toBe('exceso')
  })
})
