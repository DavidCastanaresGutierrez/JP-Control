import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { parseHoras } from './parseHoras.ts'

const resumen = (parsed: ReturnType<typeof parseHoras>) =>
  parsed.records.map(({ persona, mes, horas }) => ({ persona, mes, horas }))

const toBuf = (rows: (string | number)[][]): ArrayBuffer => {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows))
  const b = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer
}

test('parseHoras: formato largo con meses en español, ISO y mm/aaaa; descarta totales', () => {
  const parsed = parseHoras(
    toBuf([
      ['Empleado', 'Mes', 'Horas'],
      ['García López, María', 'mar-26', 120],
      ['García López, María', 'abr-26', 130],
      ['Pérez Ruiz, Antonio', '2026-03', 80],
      ['Pérez Ruiz, Antonio', '04/2026', 85],
      ['Total', '', 415],
    ]),
  )
  assert.deepEqual(resumen(parsed), [
    { persona: 'García López, María', mes: '2026-03', horas: 120 },
    { persona: 'Pérez Ruiz, Antonio', mes: '2026-03', horas: 80 },
    { persona: 'García López, María', mes: '2026-04', horas: 130 },
    { persona: 'Pérez Ruiz, Antonio', mes: '2026-04', horas: 85 },
  ])
})

test('parseHoras: formato ancho (un mes por columna); omite celdas a cero', () => {
  const parsed = parseHoras(
    toBuf([
      ['Nombre', 'ene-26', 'feb-26', 'mar-26'],
      ['García López, María', 100, 110, 95],
      ['Castañares Gutiérrez, David', 20, 0, 35],
    ]),
  )
  assert.deepEqual(resumen(parsed), [
    { persona: 'Castañares Gutiérrez, David', mes: '2026-01', horas: 20 },
    { persona: 'García López, María', mes: '2026-01', horas: 100 },
    { persona: 'García López, María', mes: '2026-02', horas: 110 },
    { persona: 'Castañares Gutiérrez, David', mes: '2026-03', horas: 35 },
    { persona: 'García López, María', mes: '2026-03', horas: 95 },
  ])
})
