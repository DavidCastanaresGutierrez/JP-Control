const eur = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

const eurCents = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const num = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 })

/** Importe en euros sin decimales (para KPIs y ejes). */
export function euros(n: number): string {
  return eur.format(Number.isFinite(n) ? n : 0)
}

/** Importe en euros con dos decimales (para listados de movimientos). */
export function eurosExactos(n: number): string {
  return eurCents.format(Number.isFinite(n) ? n : 0)
}

/** Número con hasta un decimal y separador español. */
export function numero(n: number): string {
  return num.format(Number.isFinite(n) ? n : 0)
}

/** Número con unidad, p.ej. "72,5 kg". Devuelve "—" si no hay valor. */
export function conUnidad(n: number | undefined, unidad: string): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return '—'
  return `${num.format(n)} ${unidad}`
}
