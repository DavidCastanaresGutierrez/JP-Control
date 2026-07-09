import * as XLSX from 'xlsx'
import type { Entry, ParsedExplotacion } from '../types.ts'
import { parseFechaES, serialToISO } from './format.ts'

type Cell = string | number | null
type Row = Cell[]

/**
 * Parsea la hoja "Detalle de Explotación" exportada del ERP.
 * Estructura: bloques por cuenta (fila con "NNNN Nombre cuenta" en col B),
 * fila de cabecera ("Asiento | Fecha | Concepto | ..."), líneas de apunte
 * y fila de subtotal (sin fecha, con importes).
 */
export function parseExplotacion(data: ArrayBuffer, fileName: string): ParsedExplotacion {
  const wb = XLSX.read(data, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows: Row[] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })

  const warnings: string[] = []
  let code = ''
  let name = ''
  let director: string | undefined
  let fechaAlta: string | undefined
  let hasta: string | undefined
  let totalDebe: number | undefined
  let totalHaber: number | undefined
  const entries: Entry[] = []

  let cuenta: string | null = null
  let cuentaCodigo = ''

  for (const r of rows) {
    const c0 = r[0]
    const c1 = r[1]

    if (typeof c0 === 'string' && c0.startsWith('Proyecto:')) {
      const m = c0.match(/Proyecto:\s*(\S+)\s*-\s*(.+)/)
      if (m) {
        code = m[1].trim()
        name = m[2].trim()
      } else {
        code = c0.replace('Proyecto:', '').trim()
        name = code
      }
      continue
    }
    if (typeof c0 === 'string' && c0.startsWith('Detalle de Explotación')) {
      const h = typeof r[2] === 'string' ? parseFechaES(r[2]) : undefined
      if (h) hasta = h
      continue
    }
    if (typeof c0 === 'string' && c0.startsWith('Fecha Alta')) {
      if (typeof r[1] === 'number') fechaAlta = serialToISO(r[1])
      if (typeof r[3] === 'string') director = r[3].trim()
      continue
    }
    if (typeof c1 === 'string' && c1.startsWith('Contabilizado desde')) {
      if (typeof r[5] === 'number') totalDebe = r[5]
      if (typeof r[6] === 'number') totalHaber = r[6]
      continue
    }
    // Cabecera de bloque de cuenta: "6070 Trab. otras emp.(GENERAL)"
    if (typeof c1 === 'string' && /^\d{3,4}\s+\S/.test(c1)) {
      cuenta = c1.trim()
      cuentaCodigo = c1.match(/^(\d{3,4})/)![1]
      continue
    }
    if (c1 === 'Asiento') continue // fila de cabecera de columnas
    // Línea de apunte: tiene fecha (serial) e importes
    if (cuenta && typeof r[2] === 'number' && (typeof r[5] === 'number' || typeof r[6] === 'number')) {
      const fecha = serialToISO(r[2])
      const debe = typeof r[5] === 'number' ? r[5] : 0
      const haber = typeof r[6] === 'number' ? r[6] : 0
      const concepto = typeof r[3] === 'string' ? r[3].trim() : ''
      const asiento = typeof c1 === 'string' && c1 ? c1.trim() : null
      entries.push({
        id: `${cuentaCodigo}|${asiento ?? ''}|${fecha}|${concepto}|${debe}|${haber}`,
        asiento,
        fecha,
        mes: fecha.slice(0, 7),
        concepto,
        area: typeof r[4] === 'string' && r[4] ? r[4].trim() : null,
        cuenta,
        cuentaCodigo,
        debe,
        haber,
      })
    }
  }

  if (!code) {
    // Último recurso: código de proyecto del nombre de fichero
    const m = fileName.match(/explotacion-detalle-(.+?)-\d{8}/)
    if (m) code = m[1]
  }
  if (!code) throw new Error('No se encontró el código de proyecto en el fichero.')
  if (entries.length === 0) throw new Error('No se encontró ningún apunte en el fichero. ¿Es un "Detalle de Explotación"?')

  if (!hasta) {
    const m = fileName.match(/(\d{4})(\d{2})(\d{2})/)
    if (m) hasta = `${m[1]}-${m[2]}-${m[3]}`
  }

  const sumDebe = entries.reduce((s, e) => s + e.debe, 0)
  const sumHaber = entries.reduce((s, e) => s + e.haber, 0)
  if (totalDebe !== undefined && Math.abs(sumDebe - totalDebe) > 0.01) {
    warnings.push(
      `El total debe leído (${sumDebe.toFixed(2)}) no cuadra con el del fichero (${totalDebe.toFixed(2)}).`,
    )
  }
  if (totalHaber !== undefined && Math.abs(sumHaber - totalHaber) > 0.01) {
    warnings.push(
      `El total haber leído (${sumHaber.toFixed(2)}) no cuadra con el del fichero (${totalHaber.toFixed(2)}).`,
    )
  }

  return { code, name, fileName, director, fechaAlta, hasta, entries, totalDebe, totalHaber, warnings }
}
