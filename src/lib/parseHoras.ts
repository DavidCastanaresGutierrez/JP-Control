import * as XLSX from 'xlsx'
import type { HoursRecord } from '../types.ts'
import { serialToISO } from './format.ts'

type Cell = string | number | null
type Row = Cell[]

const SEP = '\u001f'

export interface ParsedHoras {
  records: HoursRecord[]
  /** Codigo de proyecto si el fichero lo declara (exporte del ERP) */
  code?: string
  /** Departamento sugerido por persona (Area tecnica del ERP) */
  areaPorPersona?: Record<string, string>
  warnings: string[]
}

const MESES: Record<string, number> = {
  ene: 1,
  enero: 1,
  feb: 2,
  febrero: 2,
  mar: 3,
  marzo: 3,
  abr: 4,
  abril: 4,
  may: 5,
  mayo: 5,
  jun: 6,
  junio: 6,
  jul: 7,
  julio: 7,
  ago: 8,
  agosto: 8,
  sep: 9,
  sept: 9,
  septiembre: 9,
  oct: 10,
  octubre: 10,
  nov: 11,
  noviembre: 11,
  dic: 12,
  diciembre: 12,
}

/** Intenta convertir un valor de celda (serial, "03/2026", "mar-26", "2026-03", fecha) a yyyy-mm */
function toMes(v: Cell): string | null {
  if (typeof v === 'number') {
    if (v > 20000 && v < 80000) return serialToISO(v).slice(0, 7)
    return null
  }
  if (typeof v !== 'string') return null
  const s = v.trim().toLowerCase()
  let m = s.match(/^(\d{4})[-/](\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}`
  m = s.match(/^(\d{1,2})[-/](\d{4})$/)
  if (m) return `${m[2]}-${m[1].padStart(2, '0')}`
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}`
  m = s.match(/^([a-zñ]+)[\s.-]*(\d{2,4})$/)
  if (m && MESES[m[1]]) {
    const y = m[2].length === 2 ? `20${m[2]}` : m[2]
    return `${y}-${String(MESES[m[1]]).padStart(2, '0')}`
  }
  return null
}

const RE_PERSONA = /empleado|nombre|persona|recurso|participante|trabajador/i
const RE_FECHA = /fecha|mes|periodo|month/i
const RE_HORAS = /^horas?$|n[ºo°.]?\s*horas|horas\s/i

type Acc = Map<string, number>

const keyOf = (persona: string, mes: string, tarea?: string) => [persona, mes, tarea ?? ''].join(SEP)

const addAcc = (acc: Acc, persona: string, mes: string, horas: number, tarea?: string) => {
  const key = keyOf(persona, mes, tarea)
  acc.set(key, (acc.get(key) ?? 0) + horas)
}

const accToRecords = (acc: Acc): HoursRecord[] =>
  [...acc.entries()]
    .map(([key, horas]) => {
      const [persona, mes, tarea = ''] = key.split(SEP)
      return {
        persona,
        mes,
        horas: Math.round(horas * 100) / 100,
        tarea: tarea || undefined,
      }
    })
    .sort(
      (a, b) =>
        a.mes.localeCompare(b.mes) ||
        a.persona.localeCompare(b.persona) ||
        (a.tarea ?? '').localeCompare(b.tarea ?? ''),
    )

/**
 * Formato "Detalle de horas por empleado" del ERP: cabecera con
 * "Nro. | Nombre | Fecha | H. Normales | H. Extra | Coste | ... | Nombre | ID de empleado".
 * Las filas de detalle diario llevan la fecha (serial) en col C y el nombre
 * del empleado repetido en col K; la tarea del contrato viene en col H.
 */
function parseDetalleEmpleado(rows: Row[]): ParsedHoras | null {
  const headerIdx = rows.findIndex(
    (r) => (r ?? []).some((c) => typeof c === 'string' && /h\.?\s*normales/i.test(c)),
  )
  if (headerIdx < 0) return null

  const warnings: string[] = []
  let code: string | undefined
  let totalFichero: number | undefined
  let totalCosteFichero: number | undefined
  const acc: Acc = new Map()
  const costeAcc: Acc = new Map()
  const areaPorPersona: Record<string, string> = {}

  for (const r of rows) {
    const c0 = r?.[0]
    if (typeof c0 === 'string' && c0.startsWith('Proyecto:')) {
      const m = c0.match(/Proyecto:\s*(\S+)/)
      if (m) code = m[1]
    }
  }

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] ?? []
    if (typeof r[1] === 'string' && /^total\s+proyecto/i.test(r[1].trim())) {
      if (typeof r[3] === 'number') {
        totalFichero = r[3] + (typeof r[4] === 'number' ? r[4] : 0)
      }
      if (typeof r[5] === 'number') totalCosteFichero = r[5]
      continue
    }
    if (typeof r[2] !== 'number' || r[2] < 20000 || r[2] > 80000) continue
    const persona = typeof r[10] === 'string' && r[10].trim() ? r[10].trim() : null
    if (!persona) continue
    const horas = (typeof r[3] === 'number' ? r[3] : 0) + (typeof r[4] === 'number' ? r[4] : 0)
    if (horas === 0) continue
    const mes = serialToISO(r[2]).slice(0, 7)
    const tarea = typeof r[7] === 'string' && r[7].trim() ? r[7].trim() : 'Sin tarea'
    addAcc(acc, persona, mes, horas, tarea)
    addAcc(costeAcc, persona, mes, typeof r[5] === 'number' ? r[5] : 0, tarea)
    const area = typeof r[8] === 'string' ? r[8].trim() : ''
    if (area && !areaPorPersona[persona]) areaPorPersona[persona] = area
  }

  if (acc.size === 0) return null

  const records = accToRecords(acc).map((rec) => ({
    ...rec,
    coste: Math.round((costeAcc.get(keyOf(rec.persona, rec.mes, rec.tarea)) ?? 0) * 100) / 100,
  }))
  const suma = records.reduce((s, r) => s + r.horas, 0)
  if (totalFichero !== undefined && Math.abs(suma - totalFichero) > 0.01) {
    warnings.push(
      `Las horas leidas (${suma.toFixed(1)}) no cuadran con el total del fichero (${totalFichero.toFixed(1)}).`,
    )
  }
  const sumaCoste = records.reduce((s, r) => s + (r.coste ?? 0), 0)
  if (totalCosteFichero !== undefined && Math.abs(sumaCoste - totalCosteFichero) > 0.5) {
    warnings.push(
      `El coste leido (${sumaCoste.toFixed(0)} €) no cuadra con el total del fichero (${totalCosteFichero.toFixed(0)} €).`,
    )
  }
  return { records, code, areaPorPersona, warnings }
}

/**
 * Formato "Detalle de horas por tareas" del ERP: cabecera con
 * "Nro. | Nombre | Descripción | Fecha | H. Normales | H. Extra | Coste |
 * Tarea del contrato | ID de empleado".
 *
 * En este informe la persona no se repite en cada linea diaria: aparece como
 * una fila de agrupacion y las lineas de detalle posteriores cuelgan de ella.
 */
function parseDetalleTareas(rows: Row[]): ParsedHoras | null {
  const headerIdx = rows.findIndex((r) => {
    const cells = r ?? []
    return (
      cells.some((c) => typeof c === 'string' && /tarea\s+del\s+contrato/i.test(c)) &&
      cells.some((c) => typeof c === 'string' && /h\.?\s*normales/i.test(c)) &&
      cells.some((c) => typeof c === 'string' && /id\s+de\s+empleado/i.test(c))
    )
  })
  if (headerIdx < 0) return null

  const warnings: string[] = []
  let code: string | undefined
  let totalFichero: number | undefined
  let totalCosteFichero: number | undefined
  const acc: Acc = new Map()
  const costeAcc: Acc = new Map()
  const areaPorPersona: Record<string, string> = {}
  let currentArea = ''
  let currentPersona = ''
  let currentTask = ''

  for (const r of rows) {
    const c0 = r?.[0]
    if (typeof c0 === 'string' && c0.startsWith('Proyecto:')) {
      const m = c0.match(/Proyecto:\s*(\S+)/)
      if (m) code = m[1]
    }
  }

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] ?? []

    if (typeof r[1] === 'string' && /^total\s+proyecto/i.test(r[1].trim())) {
      if (typeof r[4] === 'number') {
        totalFichero = r[4] + (typeof r[5] === 'number' ? r[5] : 0)
      }
      if (typeof r[6] === 'number') totalCosteFichero = r[6]
      continue
    }

    if (typeof r[0] === 'string' && r[0].trim() && r[1] === null && r[3] === null) {
      currentTask = r[0].trim()
      currentPersona = ''
      continue
    }

    if (typeof r[0] === 'number' && typeof r[1] === 'string' && r[1].trim() && r[3] === null) {
      const name = r[1].trim()
      if (name.includes(',')) {
        currentPersona = name
        if (currentArea && !areaPorPersona[currentPersona]) areaPorPersona[currentPersona] = currentArea
      } else {
        currentArea = name
        currentPersona = ''
      }
      continue
    }

    if (typeof r[0] === 'string' && /^grupo$/i.test(r[0].trim())) {
      currentPersona = ''
      continue
    }

    if (r[0] === null && typeof r[1] === 'string' && r[1].trim() && r[3] === null) {
      currentPersona = r[1].trim()
      if (currentArea && !areaPorPersona[currentPersona]) areaPorPersona[currentPersona] = currentArea
      continue
    }

    if (typeof r[3] !== 'number' || r[3] < 20000 || r[3] > 80000) continue
    if (!currentPersona) continue

    const horas = (typeof r[4] === 'number' ? r[4] : 0) + (typeof r[5] === 'number' ? r[5] : 0)
    if (horas === 0) continue

    const mes = serialToISO(r[3]).slice(0, 7)
    const tarea =
      typeof r[7] === 'string' && r[7].trim() ? r[7].trim() : currentTask || 'Sin tarea'
    addAcc(acc, currentPersona, mes, horas, tarea)
    addAcc(costeAcc, currentPersona, mes, typeof r[6] === 'number' ? r[6] : 0, tarea)
    if (currentArea && !areaPorPersona[currentPersona]) areaPorPersona[currentPersona] = currentArea
  }

  if (acc.size === 0) return null

  const records = accToRecords(acc).map((rec) => ({
    ...rec,
    coste: Math.round((costeAcc.get(keyOf(rec.persona, rec.mes, rec.tarea)) ?? 0) * 100) / 100,
  }))
  const suma = records.reduce((s, r) => s + r.horas, 0)
  if (totalFichero !== undefined && Math.abs(suma - totalFichero) > 0.01) {
    warnings.push(
      `Las horas leidas (${suma.toFixed(1)}) no cuadran con el total del fichero (${totalFichero.toFixed(1)}).`,
    )
  }
  const sumaCoste = records.reduce((s, r) => s + (r.coste ?? 0), 0)
  if (totalCosteFichero !== undefined && Math.abs(sumaCoste - totalCosteFichero) > 0.5) {
    warnings.push(
      `El coste leido (${sumaCoste.toFixed(0)} €) no cuadra con el total del fichero (${totalCosteFichero.toFixed(0)} €).`,
    )
  }
  return { records, code, areaPorPersona, warnings }
}

/** Formato generico largo: columnas [persona, mes/fecha, horas] */
function parseLargo(rows: Row[], headerIdx: number, personaCol: number): Acc | null {
  const header = rows[headerIdx]
  const horasCol = header.findIndex((c) => typeof c === 'string' && RE_HORAS.test(c.trim()))
  const fechaCol = header.findIndex((c) => typeof c === 'string' && RE_FECHA.test(c))
  if (horasCol < 0 || fechaCol < 0) return null

  const acc: Acc = new Map()
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] ?? []
    const rawPersona = r[personaCol]
    if (typeof rawPersona !== 'string' || !rawPersona.trim()) continue
    const persona = rawPersona.trim()
    if (/^total/i.test(persona)) continue
    const mes = toMes(r[fechaCol])
    const horas = r[horasCol]
    if (mes && typeof horas === 'number' && horas !== 0) addAcc(acc, persona, mes, horas)
  }
  return acc.size > 0 ? acc : null
}

/** Formato generico ancho: columna persona + una columna por mes */
function parseAncho(rows: Row[], headerIdx: number, personaCol: number): Acc | null {
  const header = rows[headerIdx]
  const mesCols: Array<{ col: number; mes: string }> = []
  header.forEach((c, idx) => {
    if (idx === personaCol) return
    const mes = toMes(c)
    if (mes) mesCols.push({ col: idx, mes })
  })
  if (mesCols.length === 0) return null

  const acc: Acc = new Map()
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] ?? []
    const rawPersona = r[personaCol]
    if (typeof rawPersona !== 'string' || !rawPersona.trim()) continue
    const persona = rawPersona.trim()
    if (/^total/i.test(persona)) continue
    for (const { col, mes } of mesCols) {
      const horas = r[col]
      if (typeof horas === 'number' && horas !== 0) addAcc(acc, persona, mes, horas)
    }
  }
  return acc.size > 0 ? acc : null
}

/**
 * Importacion de horas por participante. Reconoce, por este orden:
 *  1. El "Detalle de horas por empleado" del ERP (horas-empleado-detalle-*.xlsx)
 *  2. Formato largo: columnas [persona, mes/fecha, horas]
 *  3. Formato ancho: columna persona + una columna por mes
 * Devuelve registros agregados por persona, mes y, si existe, tarea.
 */
export function parseHoras(data: ArrayBuffer): ParsedHoras {
  const wb = XLSX.read(data, { type: 'array' })

  for (const sheetName of wb.SheetNames) {
    const rows: Row[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
      header: 1,
      defval: null,
      raw: true,
    })

    const tareas = parseDetalleTareas(rows)
    if (tareas) return tareas

    const erp = parseDetalleEmpleado(rows)
    if (erp) return erp

    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const r = rows[i] ?? []
      const personaCol = r.findIndex((c) => typeof c === 'string' && RE_PERSONA.test(c))
      if (personaCol < 0) continue
      const acc = parseLargo(rows, i, personaCol) ?? parseAncho(rows, i, personaCol)
      if (acc) return { records: accToRecords(acc), warnings: [] }
      break
    }
  }

  throw new Error(
    'No se han podido leer horas. Se admite el "Detalle de horas por empleado" del ERP o un Excel con columna de persona (Empleado/Nombre) y columnas Mes/Horas (o una columna por mes).',
  )
}
