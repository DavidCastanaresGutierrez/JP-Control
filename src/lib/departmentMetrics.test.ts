import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { DepartmentModule, HoraProduccion } from '../types.ts'
import {
  clasificarActividad,
  dashboardDepartamento,
  distribucionPorTipoActividad,
  esActividadFacturable,
  tablaOcupacion,
} from './departmentMetrics.ts'

const hora = (proyecto: string, horas: number, persona = 'GARCIA LOPEZ, MARIA'): HoraProduccion => ({
  persona,
  proyecto,
  fecha: '2026-06-10',
  mes: '2026-06',
  horas,
  coste: horas * 35,
})

const modulo = (horas: HoraProduccion[]): DepartmentModule => ({
  departamento: 'Desarrollo de software',
  roster: { 'GARCIA LOPEZ, MARIA': { activo: true, jornadaPct: 100 } },
  horas,
})

test('clasificarActividad: detecta cada tipo por palabras clave', () => {
  assert.equal(clasificarActividad('DSES.DE3423ESP.TYES - ATLAS Plataforma'), 'facturable')
  assert.equal(clasificarActividad('DS.ID0001 - I+D+i Plataforma interna'), 'innovacion')
  assert.equal(clasificarActividad('DSES.SD1332ESP.TYES - Soporte aplicaciones'), 'soporte')
  assert.equal(clasificarActividad('DS.FO0001 - Formación técnica'), 'formacion')
  assert.equal(clasificarActividad('DS.AV0000MAG - LABORES NO ASIGNABLES'), 'gestion')
  assert.equal(clasificarActividad('DS.VA0001 - VACACIONES Y PERMISOS'), 'vacaciones')
})

test('esActividadFacturable: innovación y soporte facturan; formación, gestión y vacaciones no', () => {
  assert.equal(esActividadFacturable('facturable'), true)
  assert.equal(esActividadFacturable('innovacion'), true)
  assert.equal(esActividadFacturable('soporte'), true)
  assert.equal(esActividadFacturable('formacion'), false)
  assert.equal(esActividadFacturable('gestion'), false)
  assert.equal(esActividadFacturable('vacaciones'), false)
})

test('tablaOcupacion: las horas de innovación y soporte cuentan como facturables', () => {
  const m = modulo([
    hora('DSES.DE3423ESP.TYES - ATLAS Plataforma', 100),
    hora('DS.ID0001 - I+D+i Plataforma interna', 40),
    hora('DSES.SD1332ESP.TYES - Soporte aplicaciones', 20),
    hora('DS.FO0001 - Formación técnica', 10),
    hora('DS.AV0000MAG - LABORES NO ASIGNABLES', 10),
  ])
  const [fila] = tablaOcupacion(m, '2026-06')
  assert.equal(fila.horasImputadas, 180)
  assert.equal(fila.horasFacturables, 160) // 100 cliente + 40 innovación + 20 soporte
  assert.ok(Math.abs((fila.facturablePct ?? 0) - (160 / 180) * 100) < 0.01)
})

test('distribucionPorTipoActividad: siempre devuelve los seis tipos en orden fijo, con 0 h si no hay horas', () => {
  const m = modulo([
    hora('DSES.DE3423ESP.TYES - ATLAS Plataforma', 60),
    hora('DS.FO0001 - Formación técnica', 40),
  ])
  const dist = distribucionPorTipoActividad(m, '2026-06')
  assert.deepEqual(
    dist.map((d) => d.tipo),
    ['facturable', 'innovacion', 'soporte', 'formacion', 'gestion', 'vacaciones'],
  )
  assert.equal(dist[0].horas, 60) // facturable
  assert.equal(dist[3].horas, 40) // formacion
  assert.equal(dist[5].horas, 0) // vacaciones sin horas: presente, a cero
  assert.equal(dist[0].pct, 60)
})

test('dashboardDepartamento: el % de facturabilidad incluye innovación y soporte', () => {
  const m = modulo([
    hora('DSES.DE3423ESP.TYES - ATLAS Plataforma', 60),
    hora('DS.ID0001 - I+D+i Plataforma interna', 30),
    hora('DS.AV0000MAG - LABORES NO ASIGNABLES', 10),
  ])
  const d = dashboardDepartamento(m, '2026-06')
  assert.equal(d.horasImputadas, 100)
  assert.equal(d.horasFacturables, 90)
  assert.ok(Math.abs((d.facturabilidadPct ?? 0) - 90) < 0.01)
  // El desglose por tipo se mantiene informativo, sin mezclarse
  assert.equal(d.horasInnovacion, 30)
  assert.equal(d.horasInternas, 10)
})
