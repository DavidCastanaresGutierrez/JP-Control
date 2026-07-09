// Prueba rápida del parser contra un fichero real:
//   node scripts/test-parser.mjs <ruta.xlsx>
import { readFileSync } from 'node:fs'

// Node 24 elimina los tipos de .ts al importar
const { parseExplotacion } = await import('../src/lib/parseExplotacion.ts')

const file = process.argv[2]
const buf = readFileSync(file)
const parsed = parseExplotacion(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), file)

const gasto = parsed.entries.filter((e) => e.cuentaCodigo !== '9990').reduce((s, e) => s + e.debe - e.haber, 0)
const fact = parsed.entries.filter((e) => e.cuentaCodigo === '9990').reduce((s, e) => s + e.haber - e.debe, 0)

console.log(JSON.stringify({
  code: parsed.code,
  name: parsed.name,
  director: parsed.director,
  fechaAlta: parsed.fechaAlta,
  hasta: parsed.hasta,
  apuntes: parsed.entries.length,
  gasto: Math.round(gasto * 100) / 100,
  facturacion: Math.round(fact * 100) / 100,
  totalDebeFichero: parsed.totalDebe,
  totalHaberFichero: parsed.totalHaber,
  warnings: parsed.warnings,
}, null, 2))
console.log('\nPrimeros apuntes:')
parsed.entries.slice(0, 5).forEach((e) => console.log(' ', e.fecha, e.cuentaCodigo, e.concepto.slice(0, 40), e.debe, e.haber))
