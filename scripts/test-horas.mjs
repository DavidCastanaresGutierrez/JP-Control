// Prueba del importador de horas:
//   node scripts/test-horas.mjs                  -> ficheros sintéticos (largo y ancho)
//   node scripts/test-horas.mjs <ruta.xlsx>      -> fichero real del ERP
import * as XLSX from 'xlsx'
import { readFileSync } from 'node:fs'

const { parseHoras } = await import('../src/lib/parseHoras.ts')

if (process.argv[2]) {
  const buf = readFileSync(process.argv[2])
  const parsed = parseHoras(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
  const total = parsed.records.reduce((s, r) => s + r.horas, 0)
  const personas = [...new Set(parsed.records.map((r) => r.persona))]
  console.log(JSON.stringify({ code: parsed.code, total, nPersonas: personas.length, warnings: parsed.warnings }, null, 2))
  for (const p of personas) {
    const porMes = parsed.records.filter((r) => r.persona === p).map((r) => `${r.mes}: ${r.horas}h`)
    console.log(' ', p, '->', porMes.join(', '))
  }
  process.exit(0)
}

const toBuf = (wb) => {
  const b = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
}

// Formato largo
const wb1 = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(
  wb1,
  XLSX.utils.aoa_to_sheet([
    ['Empleado', 'Mes', 'Horas'],
    ['García López, María', 'mar-26', 120],
    ['García López, María', 'abr-26', 130],
    ['Pérez Ruiz, Antonio', '2026-03', 80],
    ['Pérez Ruiz, Antonio', '04/2026', 85],
    ['Total', '', 415],
  ]),
)
console.log('LARGO:', JSON.stringify(parseHoras(toBuf(wb1)).records))

// Formato ancho
const wb2 = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(
  wb2,
  XLSX.utils.aoa_to_sheet([
    ['Nombre', 'ene-26', 'feb-26', 'mar-26'],
    ['García López, María', 100, 110, 95],
    ['Castañares Gutiérrez, David', 20, 0, 35],
  ]),
)
console.log('ANCHO:', JSON.stringify(parseHoras(toBuf(wb2)).records))
