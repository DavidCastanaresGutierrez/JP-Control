import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Entry, HoursRecord, Project } from '../types.ts'
import { enAlerta, horasDePersonas, kpis, monthlySeries } from './metrics.ts'

let nextId = 0
const apunte = (extra: Partial<Entry>): Entry => ({
  id: `e${++nextId}`,
  asiento: null,
  fecha: '2026-01-15',
  mes: '2026-01',
  concepto: 'Apunte de prueba',
  area: null,
  cuenta: '9101 Horas trabajo personal oficina',
  cuentaCodigo: '9101',
  debe: 0,
  haber: 0,
  ...extra,
})

const gasto = (mes: string, debe: number) => apunte({ mes, debe })
const factura = (mes: string, haber: number) =>
  apunte({ mes, haber, cuenta: '9990 Facturacion', cuentaCodigo: '9990' })

const proyecto = (extra: Partial<Project>): Project => ({
  code: 'X',
  name: 'X',
  entries: [],
  hours: [],
  ...extra,
})

test('kpis: separa gasto y facturación por cuenta y calcula porcentajes', () => {
  const p = proyecto({
    entries: [gasto('2026-01', 600), factura('2026-01', 500)],
    contractValue: 1000,
    budget: 2000,
    progress: 40,
  })
  const k = kpis(p)
  assert.equal(k.gasto, 600)
  assert.equal(k.facturacion, 500)
  assert.equal(k.resultado, -100)
  assert.equal(k.facturadoPct, 50) // 500 / 1000
  assert.equal(k.consumoPct, 30) // 600 / 2000
  assert.equal(k.desvioFacturacion, 10) // facturado 50 - avance 40
})

test('kpis: sin importes de contrato los porcentajes quedan a null', () => {
  const k = kpis(proyecto({ entries: [gasto('2026-01', 100)] }))
  assert.equal(k.facturadoPct, null)
  assert.equal(k.consumoPct, null)
  assert.equal(k.desvioFacturacion, null)
})

test('enAlerta: salta solo con facturación más de 10 puntos por detrás del avance', () => {
  const base = { entries: [factura('2026-01', 100)], contractValue: 1000 } // facturado 10%
  assert.equal(enAlerta(kpis(proyecto({ ...base, progress: 21 }))), true) // desvío -11
  assert.equal(enAlerta(kpis(proyecto({ ...base, progress: 20 }))), false) // desvío -10 justo
})

test('monthlySeries: rellena meses sin datos y acumula', () => {
  const serie = monthlySeries([gasto('2026-01', 100), factura('2026-03', 300)])
  assert.deepEqual(
    serie.map((s) => s.mes),
    ['2026-01', '2026-02', '2026-03'],
  )
  assert.equal(serie[1].gasto, 0)
  assert.equal(serie[2].gastoAcum, 100)
  assert.equal(serie[2].facturacionAcum, 300)
})

test('horasDePersonas: descarta encabezados del ERP y valores imposibles', () => {
  const h = (persona: string, horas: number): HoursRecord => ({ persona, mes: '2026-01', horas })
  const limpio = horasDePersonas([
    h('GARCIA LOPEZ, ANA', 120),
    h('Total Proyecto', 500),
    h('Fecha Alta:', 8),
    h('SIN HORAS, PERSONA', 0),
    h('SERIAL COLADO', 45000), // un serial de fecha leído como horas
  ])
  assert.deepEqual(
    limpio.map((r) => r.persona),
    ['GARCIA LOPEZ, ANA'],
  )
})
