// Genera un JSON de base de datos a partir de un fichero de explotación (para pruebas)
import { readFileSync, writeFileSync } from 'node:fs'

const { parseExplotacion } = await import('../src/lib/parseExplotacion.ts')

const file = process.argv[2]
const out = process.argv[3]
const buf = readFileSync(file)
const p = parseExplotacion(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), file)

// Horas de ejemplo por participante (con anomalías) para probar la vista de horas
const hours = []
const personas = [
  { n: 'Castañares Gutiérrez, David', base: 40 },
  { n: 'García López, María', base: 120 },
  { n: 'Pérez Ruiz, Antonio', base: 80 },
]
const meses = ['2026-03', '2026-04', '2026-05', '2026-06']
for (const per of personas) {
  meses.forEach((mes, i) => {
    let h = per.base + (i * 7) % 12
    if (per.n.startsWith('García') && mes === '2026-06') h = per.base * 2.1 // pico
    if (per.n.startsWith('Pérez') && mes === '2026-04') h = 0 // hueco
    if (h > 0) hours.push({ persona: per.n, mes, horas: h })
  })
}

const db = {
  projects: {
    [p.code]: {
      code: p.code,
      name: p.name,
      director: p.director,
      fechaAlta: p.fechaAlta,
      hasta: p.hasta,
      lastImport: '2026-07-07T08:00:00.000Z',
      entries: p.entries,
      hours,
      budget: 60000,
      contractValue: 85000,
      progress: 35,
    },
  },
}
writeFileSync(out, JSON.stringify(db))
console.log('OK', out)
