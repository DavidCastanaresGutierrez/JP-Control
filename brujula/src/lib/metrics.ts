/** Cálculos puros sobre el documento. Sin dependencias de React: fáciles de testear. */
import type {
  Comida,
  Entreno,
  MedidaCorporal,
  RegistroHabito,
  SnapshotPatrimonio,
  Transaccion,
} from '../types.ts'
import { diasEntre, hoy, mesDe, sumarDias } from './date.ts'

// ─── Economía ────────────────────────────────────────────────────────────────

export interface ResumenEconomico {
  ingresos: number
  gastos: number
  balance: number
}

export function resumenMes(trans: Transaccion[], mes: string): ResumenEconomico {
  let ingresos = 0
  let gastos = 0
  for (const t of trans) {
    if (mesDe(t.fecha) !== mes) continue
    if (t.tipo === 'ingreso') ingresos += t.importe
    else gastos += t.importe
  }
  return { ingresos, gastos, balance: ingresos - gastos }
}

export interface GastoCategoria {
  categoria: string
  total: number
}

export function gastoPorCategoria(trans: Transaccion[], mes?: string): GastoCategoria[] {
  const mapa = new Map<string, number>()
  for (const t of trans) {
    if (t.tipo !== 'gasto') continue
    if (mes && mesDe(t.fecha) !== mes) continue
    mapa.set(t.categoria, (mapa.get(t.categoria) ?? 0) + t.importe)
  }
  return [...mapa.entries()]
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total)
}

export interface PuntoMensual {
  mes: string
  ingresos: number
  gastos: number
  balance: number
}

/** Serie mensual ordenada de ingresos/gastos, útil para la gráfica de evolución. */
export function serieMensual(trans: Transaccion[]): PuntoMensual[] {
  const mapa = new Map<string, PuntoMensual>()
  for (const t of trans) {
    const mes = mesDe(t.fecha)
    const p = mapa.get(mes) ?? { mes, ingresos: 0, gastos: 0, balance: 0 }
    if (t.tipo === 'ingreso') p.ingresos += t.importe
    else p.gastos += t.importe
    p.balance = p.ingresos - p.gastos
    mapa.set(mes, p)
  }
  return [...mapa.values()].sort((a, b) => a.mes.localeCompare(b.mes))
}

export function patrimonioNeto(snap: SnapshotPatrimonio): number {
  return Object.values(snap.saldos).reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0)
}

export interface PuntoPatrimonio {
  fecha: string
  total: number
}

export function seriePatrimonio(snaps: SnapshotPatrimonio[]): PuntoPatrimonio[] {
  return [...snaps]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((s) => ({ fecha: s.fecha, total: patrimonioNeto(s) }))
}

// ─── Salud ───────────────────────────────────────────────────────────────────

export interface PuntoSerie {
  fecha: string
  valor: number
}

/** Serie temporal ordenada de un campo numérico de las medidas corporales. */
export function serieMedida(medidas: MedidaCorporal[], campo: 'peso' | 'grasa' | 'musculo' | 'cintura'): PuntoSerie[] {
  return [...medidas]
    .filter((m) => typeof m[campo] === 'number')
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((m) => ({ fecha: m.fecha, valor: m[campo] as number }))
}

export interface ResumenNutricion {
  kcal: number
  proteina: number
  carbos: number
  grasa: number
}

export function resumenDia(comidas: Comida[], fecha: string): ResumenNutricion {
  const r: ResumenNutricion = { kcal: 0, proteina: 0, carbos: 0, grasa: 0 }
  for (const c of comidas) {
    if (c.fecha !== fecha) continue
    r.kcal += c.kcal ?? 0
    r.proteina += c.proteina ?? 0
    r.carbos += c.carbos ?? 0
    r.grasa += c.grasa ?? 0
  }
  return r
}

export function serieCaloriasDiarias(comidas: Comida[]): PuntoSerie[] {
  const mapa = new Map<string, number>()
  for (const c of comidas) mapa.set(c.fecha, (mapa.get(c.fecha) ?? 0) + (c.kcal ?? 0))
  return [...mapa.entries()]
    .map(([fecha, valor]) => ({ fecha, valor }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
}

/** Volumen de un entreno = suma de reps × peso de todas las series. */
export function volumenEntreno(e: Entreno): number {
  let v = 0
  for (const ej of e.ejercicios) for (const s of ej.series) v += s.reps * s.peso
  return v
}

export function serieVolumen(entrenos: Entreno[]): PuntoSerie[] {
  return [...entrenos]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((e) => ({ fecha: e.fecha, valor: volumenEntreno(e) }))
}

// ─── Hábitos ─────────────────────────────────────────────────────────────────

/** Conjunto de fechas cumplidas de un hábito (para consultas O(1)). */
export function fechasCumplidas(registros: RegistroHabito[], habitoId: string): Set<string> {
  const set = new Set<string>()
  for (const r of registros) if (r.habitoId === habitoId) set.add(r.fecha)
  return set
}

export function cumplidoEn(registros: RegistroHabito[], habitoId: string, fecha: string): boolean {
  return registros.some((r) => r.habitoId === habitoId && r.fecha === fecha)
}

/**
 * Racha actual (días consecutivos cumplidos hasta hoy). Si hoy aún no está
 * marcado pero ayer sí, la racha sigue viva y cuenta desde ayer.
 */
export function rachaActual(registros: RegistroHabito[], habitoId: string, referencia: string = hoy()): number {
  const set = fechasCumplidas(registros, habitoId)
  let cursor = referencia
  if (!set.has(cursor)) {
    cursor = sumarDias(referencia, -1)
    if (!set.has(cursor)) return 0
  }
  let racha = 0
  while (set.has(cursor)) {
    racha++
    cursor = sumarDias(cursor, -1)
  }
  return racha
}

/** Nº de días cumplidos en los últimos `dias` (incluye hoy). */
export function cumplidosRecientes(
  registros: RegistroHabito[],
  habitoId: string,
  dias: number,
  referencia: string = hoy(),
): number {
  const set = fechasCumplidas(registros, habitoId)
  let n = 0
  for (let i = 0; i < dias; i++) if (set.has(sumarDias(referencia, -i))) n++
  return n
}

export interface CeldaHeatmap {
  fecha: string
  cumplido: boolean
}

/**
 * Últimos `dias` de un hábito como celdas para el heatmap, de más antiguo a más
 * reciente. `dias` por defecto ~ 15 semanas.
 */
export function heatmap(
  registros: RegistroHabito[],
  habitoId: string,
  dias = 105,
  referencia: string = hoy(),
): CeldaHeatmap[] {
  const set = fechasCumplidas(registros, habitoId)
  const celdas: CeldaHeatmap[] = []
  const inicio = -(dias - 1)
  for (let i = inicio; i <= 0; i++) {
    const fecha = sumarDias(referencia, i)
    celdas.push({ fecha, cumplido: set.has(fecha) })
  }
  return celdas
}

/** % de días cumplidos desde que se creó el hábito (tope hoy). */
export function porcentajeCumplimiento(
  registros: RegistroHabito[],
  habitoId: string,
  desde: string,
  referencia: string = hoy(),
): number {
  const total = Math.max(1, diasEntre(desde, referencia) + 1)
  const cumplidos = fechasCumplidas(registros, habitoId).size
  return Math.min(100, Math.round((cumplidos / total) * 100))
}
