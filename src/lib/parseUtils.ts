/** Tipos y utilidades compartidos por los parsers de Excel del ERP. */

export type Cell = string | number | null
export type Row = Cell[]

/** Busca la fila "Proyecto: CODIGO ..." de los exports del ERP y devuelve el codigo. */
export function extraerCodigoProyecto(rows: Row[]): string | undefined {
  for (const r of rows) {
    const c0 = r?.[0]
    if (typeof c0 === 'string' && c0.startsWith('Proyecto:')) {
      const m = c0.match(/Proyecto:\s*(\S+)/)
      if (m) return m[1]
    }
  }
  return undefined
}
