import * as XLSX from 'xlsx'
import type { HoraProduccion } from '../types.ts'
import { serialToISO } from './format.ts'

type Cell = string | number | null
type Row = Cell[]

export interface ParsedHorasProduccion {
  horas: HoraProduccion[]
  personas: string[]
  warnings: string[]
}

/** Rango de series de fecha Excel razonable (~1995-2064): por debajo caen los
 *  totales de horas por persona (nunca superan unos pocos miles); por encima,
 *  totales en euros u otras cifras que caen por casualidad en esta columna.
 *  La fila "Total" del pie del fichero se descarta aparte por nombre. */
const SERIAL_MIN = 35000
const SERIAL_MAX = 60000

/** Quita el codigo de iniciales entre parentesis: "Abati Catalina, Alicia (ACF)" -> "Abati Catalina, Alicia" */
function limpiarPersona(nombre: string): string {
  return nombre.replace(/\s*\([A-ZÑ0-9]{2,6}\)\s*$/, '').trim()
}

/**
 * Parsea el "Detalle de horas por empleado" de toda la produccion (todas las
 * personas, todos los proyectos/actividades a la vez), a diferencia del
 * detalle por proyecto que ya se importa desde la ficha de cada proyecto.
 *
 * Estructura: por cada persona, una fila de cabecera/subtotal (nombre, horas
 * totales, extra, coste, sin fecha) seguida de una fila por apunte diario
 * (proyecto/actividad, fecha serial, horas, extra, coste, descripcion, tarea).
 */
export function parseHorasProduccion(data: ArrayBuffer): ParsedHorasProduccion {
  const wb = XLSX.read(data, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows: Row[] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })

  const headerIdx = rows.findIndex(
    (r) => (r ?? []).some((c) => typeof c === 'string' && /h\.?\s*normales/i.test(c)),
  )
  if (headerIdx < 0) {
    throw new Error(
      'No se ha reconocido el fichero. Se espera el "Detalle de horas por empleado" de toda la produccion exportado de Concost.',
    )
  }

  const warnings: string[] = []
  const horas: HoraProduccion[] = []
  const personas = new Set<string>()
  let personaActual: string | null = null

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] ?? []
    const c0 = r[0]
    const c1 = r[1]
    const c2 = r[2]
    if (typeof c0 !== 'string' || !c0.trim()) continue
    if (/^total\b/i.test(c0.trim())) continue

    if (typeof c1 === 'number' && c1 >= SERIAL_MIN && c1 <= SERIAL_MAX) {
      // Fila de apunte: proyecto/actividad + fecha serial
      if (!personaActual) continue
      const horasNormales = typeof r[2] === 'number' ? r[2] : 0
      const horasExtra = typeof r[3] === 'number' ? r[3] : 0
      const totalHoras = horasNormales + horasExtra
      if (totalHoras <= 0) continue
      horas.push({
        persona: personaActual,
        proyecto: c0.trim(),
        fecha: serialToISO(c1),
        mes: serialToISO(c1).slice(0, 7),
        horas: Math.round(totalHoras * 100) / 100,
        coste: typeof r[4] === 'number' ? r[4] : 0,
        descripcion: typeof r[5] === 'string' && r[5].trim() ? r[5].trim() : undefined,
        tarea: typeof r[6] === 'string' && r[6].trim() ? r[6].trim() : undefined,
      })
      continue
    }

    // Fila de cabecera/subtotal de una nueva persona: sin fecha (columna B).
    // Segun la exportacion, las horas totales caen en la columna B (formato
    // "toda la produccion") o, si Concost deja la columna Fecha vacia (p.ej.
    // exportaciones filtradas por departamento), en la columna C.
    if (typeof c1 === 'number' || (c1 == null && typeof c2 === 'number')) {
      personaActual = limpiarPersona(c0)
      personas.add(personaActual)
    }
  }

  if (horas.length === 0) {
    throw new Error('No se ha encontrado ningun apunte de horas en el fichero.')
  }

  return { horas, personas: [...personas].sort((a, b) => a.localeCompare(b, 'es')), warnings }
}
