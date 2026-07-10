const eur0 = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})
const eur2 = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const num1 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 })
const num2 = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const fmtEur = (v: number) => eur0.format(v)
export const fmtEur2 = (v: number) => eur2.format(v)
export const fmtNum = (v: number) => num1.format(v)
export const fmtRatio = (v: number) => num2.format(v)
export const fmtPct = (v: number) => `${num1.format(v)}%`

export function fmtMes(mes: string): string {
  // "2026-03" -> "mar 26"
  const [y, m] = mes.split('-').map(Number)
  const label = new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  )
  return `${label} ${String(y).slice(2)}`
}

export function fmtFecha(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** Repara texto con mojibake (UTF-8 mal decodificado como latin-1), p.ej. "CastaÃ±ares" -> "Castañares". */
export function repairMojibake(value?: string): string {
  const text = (value ?? '').trim()
  if (!/[ÃÂâ]/.test(text)) return text
  try {
    const bytes = Uint8Array.from([...text].map((char) => char.charCodeAt(0) & 0xff))
    return new TextDecoder('utf-8').decode(bytes)
  } catch {
    return text
  }
}

/** Serial de fecha Excel (sistema 1900) a ISO yyyy-mm-dd */
export function serialToISO(n: number): string {
  return new Date(Math.round((n - 25569) * 86400 * 1000)).toISOString().slice(0, 10)
}

export function parseFechaES(s: string): string | undefined {
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!m) return undefined
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

/** Lista ordenada de meses yyyy-mm entre el primero y el último (inclusive) */
export function monthRange(months: string[]): string[] {
  if (months.length === 0) return []
  const sorted = [...months].sort()
  const out: string[] = []
  let [y, m] = sorted[0].split('-').map(Number)
  const last = sorted[sorted.length - 1]
  let cur = sorted[0]
  while (cur <= last) {
    out.push(cur)
    m++
    if (m > 12) {
      m = 1
      y++
    }
    cur = `${y}-${String(m).padStart(2, '0')}`
  }
  return out
}
