import * as XLSX from 'xlsx'

/** Fecha ISO -> serial Excel (sistema 1900), inverso de serialToISO */
export const toSerial = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / 86400000) + 25569
}

/** Construye un .xlsx en memoria a partir de filas (array-of-arrays), como los ficheros del ERP */
export function aoaToXlsx(rows: Array<Array<string | number | null>>): ArrayBuffer {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows))
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}
