/** Utilidades de fecha sobre cadenas ISO `yyyy-mm-dd` (sin husos horarios). */

/** Fecha de hoy en formato ISO local yyyy-mm-dd. */
export function hoy(): string {
  return isoDeFecha(new Date())
}

/** Convierte un Date a yyyy-mm-dd usando la fecha local (no UTC). */
export function isoDeFecha(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parsea yyyy-mm-dd a un Date en hora local (mediodía, para evitar saltos de día). */
export function fechaDeIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0)
}

/** Mes yyyy-mm de una fecha ISO. */
export function mesDe(iso: string): string {
  return iso.slice(0, 7)
}

/** Suma (o resta) días a una fecha ISO y devuelve otra fecha ISO. */
export function sumarDias(iso: string, dias: number): string {
  const d = fechaDeIso(iso)
  d.setDate(d.getDate() + dias)
  return isoDeFecha(d)
}

/** Días de diferencia entre dos fechas ISO (b - a). */
export function diasEntre(a: string, b: string): number {
  const ma = fechaDeIso(a).getTime()
  const mb = fechaDeIso(b).getTime()
  return Math.round((mb - ma) / 86_400_000)
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Etiqueta legible de un mes yyyy-mm, p.ej. "mar 2026". */
export function etiquetaMes(mes: string): string {
  const [y, m] = mes.split('-').map(Number)
  return `${MESES_CORTOS[(m ?? 1) - 1]} ${y}`
}

/** Etiqueta legible de una fecha ISO, p.ej. "15 mar 2026". */
export function etiquetaFecha(iso: string): string {
  const d = fechaDeIso(iso)
  return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}`
}

/** Nombre del día de la semana (L, M, X, J, V, S, D) de una fecha ISO. */
const DIAS = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
export function inicialDiaSemana(iso: string): string {
  return DIAS[fechaDeIso(iso).getDay()]
}
