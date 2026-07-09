import type { Entry, HoursRecord, Project } from '../types.ts'
import { monthRange } from './format.ts'

export const CUENTA_FACTURACION = '9990'

/** Horas de jornada completa de un mes: días laborables (L-V) x 8 h */
export function horasJornadaMes(mes: string): number {
  const [y, m] = mes.split('-').map(Number)
  const diasMes = new Date(y, m, 0).getDate()
  let laborables = 0
  for (let d = 1; d <= diasMes; d++) {
    const wd = new Date(y, m - 1, d).getDay() // 0=domingo … 6=sábado
    if (wd >= 1 && wd <= 5) laborables++
  }
  return laborables * 8
}

export interface MonthPoint {
  mes: string
  gasto: number
  facturacion: number
  gastoAcum: number
  facturacionAcum: number
}

export interface ProjectKpis {
  gasto: number
  facturacion: number
  resultado: number
  margenPct: number | null
  /** facturado / importe de contrato */
  facturadoPct: number | null
  /** gasto / presupuesto de coste */
  consumoPct: number | null
  avancePct: number | null
  /** facturado - avance (puntos): negativo = trabajo hecho sin facturar */
  desvioFacturacion: number | null
  /** avance % / facturado %: >1 = trabajo hecho pendiente de facturar */
  ratioAvanceFacturacion: number | null
  /** consumo de gasto - avance (puntos): positivo = gasto por delante del avance */
  desvioGasto: number | null
}

export const esGasto = (e: Entry) => e.cuentaCodigo !== CUENTA_FACTURACION

export function kpis(p: Project): ProjectKpis {
  let gasto = 0
  let facturacion = 0
  for (const e of p.entries) {
    if (esGasto(e)) gasto += e.debe - e.haber
    else facturacion += e.haber - e.debe
  }
  const resultado = facturacion - gasto
  const margenPct = facturacion > 0 ? (resultado / facturacion) * 100 : null
  const contrato = p.contractValue ?? p.budget
  const presupuesto = p.budget ?? p.contractValue
  const facturadoPct = contrato && contrato > 0 ? (facturacion / contrato) * 100 : null
  const consumoPct = presupuesto && presupuesto > 0 ? (gasto / presupuesto) * 100 : null
  const avancePct = p.progress ?? null
  const desvioFacturacion =
    facturadoPct !== null && avancePct !== null ? facturadoPct - avancePct : null
  const desvioGasto = consumoPct !== null && avancePct !== null ? consumoPct - avancePct : null
  const ratioAvanceFacturacion =
    facturadoPct !== null && facturadoPct > 0 && avancePct !== null
      ? avancePct / facturadoPct
      : null
  return {
    gasto,
    facturacion,
    resultado,
    margenPct,
    facturadoPct,
    consumoPct,
    avancePct,
    desvioFacturacion,
    desvioGasto,
    ratioAvanceFacturacion,
  }
}

/** Alerta principal: facturación por detrás del avance en más de 10 puntos */
export const enAlerta = (k: ProjectKpis) =>
  k.desvioFacturacion !== null && k.desvioFacturacion < -10

export function monthlySeries(entries: Entry[]): MonthPoint[] {
  const byMes = new Map<string, { gasto: number; facturacion: number }>()
  for (const e of entries) {
    const cur = byMes.get(e.mes) ?? { gasto: 0, facturacion: 0 }
    if (esGasto(e)) cur.gasto += e.debe - e.haber
    else cur.facturacion += e.haber - e.debe
    byMes.set(e.mes, cur)
  }
  const meses = monthRange([...byMes.keys()])
  let gAcum = 0
  let fAcum = 0
  return meses.map((mes) => {
    const v = byMes.get(mes) ?? { gasto: 0, facturacion: 0 }
    gAcum += v.gasto
    fAcum += v.facturacion
    return {
      mes,
      gasto: Math.round(v.gasto * 100) / 100,
      facturacion: Math.round(v.facturacion * 100) / 100,
      gastoAcum: Math.round(gAcum * 100) / 100,
      facturacionAcum: Math.round(fAcum * 100) / 100,
    }
  })
}

export function gastoPorCuenta(entries: Entry[]): Array<{ cuenta: string; total: number }> {
  const map = new Map<string, number>()
  for (const e of entries) {
    if (!esGasto(e)) continue
    map.set(e.cuenta, (map.get(e.cuenta) ?? 0) + e.debe - e.haber)
  }
  return [...map.entries()]
    .map(([cuenta, total]) => ({ cuenta, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => b.total - a.total)
}

export function gastoPorArea(entries: Entry[]): Array<{ area: string; total: number }> {
  const map = new Map<string, number>()
  for (const e of entries) {
    if (!esGasto(e)) continue
    // En el export del ERP el coste de personal (9101) no lleva área técnica;
    // lo etiquetamos como tal en vez de dejarlo en el cajón "Sin área".
    const area = e.area ?? (e.cuentaCodigo === '9101' ? 'Horas de personal' : 'Sin área')
    map.set(area, (map.get(area) ?? 0) + e.debe - e.haber)
  }
  return [...map.entries()]
    .map(([area, total]) => ({ area, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => b.total - a.total)
}

// ---------- Predicción de agotamiento de presupuesto ----------

export interface EscenarioForecast {
  id: 'r3' | 'r1' | 'total'
  label: string
  ritmoMensual: number
  /** Fecha estimada de agotamiento (ISO); null si el ritmo no agota el presupuesto en 5 años */
  fecha: string | null
}

export interface ForecastPresupuesto {
  presupuesto: number
  /** Importe consumido: el mayor entre facturado y gasto acumulado (mismo criterio que el Panel) */
  consumido: number
  restante: number
  agotado: boolean
  escenarios: EscenarioForecast[]
  /** Serie para el gráfico: consumido real + proyección al ritmo de los últimos 3 meses */
  chart: Array<{
    mes: string
    real: number | null
    proyeccion: number | null
    tickMes?: string | null
  }>
}

/**
 * Estima cuándo se agota el presupuesto proyectando el importe consumido (el
 * mayor entre facturado y gasto acumulado, mes a mes) a tres ritmos: media de
 * los últimos 3 meses (escenario principal), último mes y media del proyecto.
 */
export function forecastPresupuesto(
  entries: Entry[],
  presupuesto: number | undefined,
): ForecastPresupuesto | null {
  if (!presupuesto || presupuesto <= 0) return null
  const serie = monthlySeries(entries)
  if (serie.length === 0) return null

  // Consumido = el mayor entre facturado y gasto acumulado, mes a mes (mismo
  // criterio que la barra "Consumo sobre presupuesto" del Panel).
  const consumidoSerie = serie.map((s) => Math.max(s.gastoAcum, s.facturacionAcum))
  const consumido = consumidoSerie[consumidoSerie.length - 1]
  const restante = presupuesto - consumido
  // Ritmo mensual: cuánto crece el consumido cada mes
  const ritmos = consumidoSerie.map((v, i) => (i === 0 ? v : v - consumidoSerie[i - 1]))
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length
  const r3 = mean(ritmos.slice(-3))
  const r1 = ritmos[ritmos.length - 1]
  const rTot = mean(ritmos)

  const lastMes = serie[serie.length - 1].mes
  const [ly, lm] = lastMes.split('-').map(Number)
  const finUltimoMes = new Date(Date.UTC(ly, lm, 0)) // último día del último mes con datos

  const fechaAgotamiento = (ritmo: number): string | null => {
    if (ritmo <= 0 || restante <= 0) return null
    const dias = (restante / ritmo) * 30.44
    if (dias > 365 * 5) return null
    return new Date(finUltimoMes.getTime() + dias * 86400000).toISOString().slice(0, 10)
  }

  const escenarios: EscenarioForecast[] = [
    { id: 'r3', label: 'Ritmo de los últimos 3 meses', ritmoMensual: r3, fecha: fechaAgotamiento(r3) },
    { id: 'r1', label: 'Ritmo del último mes', ritmoMensual: r1, fecha: fechaAgotamiento(r1) },
    { id: 'total', label: 'Ritmo medio del proyecto', ritmoMensual: rTot, fecha: fechaAgotamiento(rTot) },
  ]

  const chart: ForecastPresupuesto['chart'] = serie.map((s, i) => ({
    mes: s.mes,
    real: consumidoSerie[i],
    proyeccion: null,
    tickMes: s.mes,
  }))
  if (restante > 0 && r3 > 0) {
    chart[chart.length - 1].proyeccion = consumido // enlaza la proyección con el último dato real
    let acc = consumido
    let [y, m] = lastMes.split('-').map(Number)
    let n = 0
    while (acc < presupuesto && n < 96) {
      m++
      if (m > 12) {
        m = 1
        y++
      }
      const mes = `${y}-${String(m).padStart(2, '0')}`
      for (let cuarto = 1; cuarto <= 4 && acc < presupuesto && n < 96; cuarto++) {
        acc += r3 / 4
        n++
        chart.push({
          mes: `${mes}-q${cuarto}`,
          real: null,
          proyeccion: Math.round(acc * 100) / 100,
          tickMes: cuarto === 4 ? mes : null,
        })
      }
    }
  }

  return {
    presupuesto,
    consumido: Math.round(consumido * 100) / 100,
    restante: Math.round(restante * 100) / 100,
    agotado: restante <= 0,
    escenarios,
    chart,
  }
}

// ---------- Horas por participante y anomalías ----------

export type AnomaliaTipo = 'pico' | 'caida' | 'nuevo' | 'hueco'

export interface CeldaHoras {
  horas: number | null
  coste: number | null
  anomalia: AnomaliaTipo | null
  /** desviación relativa frente a la mediana del participante */
  desv: number | null
}

export interface MatrizHoras {
  meses: string[]
  filas: Array<{
    persona: string
    total: number
    totalCoste: number
    mediana: number
    celdas: CeldaHoras[]
    nAnomalias: number
  }>
}

function mediana(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * Matriz persona x mes con detección de anomalías:
 *  - pico / caida: con >= 3 meses activos, desviación > 40% sobre la mediana del
 *    participante (y > 8 h en absoluto); con 2 meses, salto de más del doble /
 *    menos de la mitad entre ellos
 *  - hueco: mes sin horas entre meses con horas
 *  - nuevo: participante que empieza a imputar (marca informativa, no cuenta
 *    como anomalía: en proyectos en arranque es lo normal)
 */
/** Filas de encabezado/subtotal del ERP que no son personas reales */
const RE_NO_PERSONA = /^(fecha alta|dir\.|total|grupo|proyecto|nro\.?|nombre)\b|:$/i

/** Un mes natural tiene como mucho ~744 h; por encima es un serial de fecha colado */
const HORAS_MAX_MES = 744

/**
 * Descarta registros que no son personas reales: encabezados/subtotales del ERP
 * ("Fecha Alta:", "Total Proyecto"…) o valores imposibles (un serial de fecha
 * leído como horas). Se aplica en todas las vistas de horas.
 */
export function horasDePersonas(hours: HoursRecord[]): HoursRecord[] {
  return hours.filter(
    (h) => !RE_NO_PERSONA.test(h.persona.trim()) && h.horas > 0 && h.horas <= HORAS_MAX_MES,
  )
}

export function matrizHoras(hours: HoursRecord[]): MatrizHoras {
  const limpio = horasDePersonas(hours)
  const meses = monthRange([...new Set(limpio.map((h) => h.mes))])
  const personas = new Map<string, Map<string, number>>()
  const costes = new Map<string, Map<string, number>>()
  for (const h of limpio) {
    if (!personas.has(h.persona)) personas.set(h.persona, new Map())
    const m = personas.get(h.persona)!
    m.set(h.mes, (m.get(h.mes) ?? 0) + h.horas)
    if (h.coste) {
      if (!costes.has(h.persona)) costes.set(h.persona, new Map())
      const c = costes.get(h.persona)!
      c.set(h.mes, (c.get(h.mes) ?? 0) + h.coste)
    }
  }

  const filas = [...personas.entries()].map(([persona, porMes]) => {
    const costePorMes = costes.get(persona) ?? new Map<string, number>()
    const activos = [...porMes.values()].filter((v) => v > 0)
    const med = activos.length ? mediana(activos) : 0
    const idxConHoras = meses
      .map((mes, i) => ((porMes.get(mes) ?? 0) > 0 ? i : -1))
      .filter((i) => i >= 0)
    const primero = idxConHoras[0] ?? -1
    const ultimo = idxConHoras[idxConHoras.length - 1] ?? -1

    let nAnomalias = 0
    const celdas: CeldaHoras[] = meses.map((mes, i) => {
      const v = porMes.get(mes)
      const coste = costePorMes.get(mes)
      if (v === undefined || v === 0) {
        if (i > primero && i < ultimo) {
          nAnomalias++
          return { horas: v ?? null, coste: coste ?? null, anomalia: 'hueco', desv: null }
        }
        return { horas: v ?? null, coste: coste ?? null, anomalia: null, desv: null }
      }
      const desv = med > 0 ? (v - med) / med : null
      let anomalia: AnomaliaTipo | null = null
      if (activos.length >= 3) {
        // Con historial suficiente, comparar contra la mediana del participante
        if (desv !== null && Math.abs(v - med) > 8 && Math.abs(desv) > 0.4) {
          anomalia = desv > 0 ? 'pico' : 'caida'
        }
      } else if (activos.length === 2 && i === ultimo) {
        // Con solo dos meses, marcar el segundo si más que duplica o cae a menos de la mitad
        const anterior = porMes.get(meses[idxConHoras[0]])!
        if (Math.abs(v - anterior) > 8) {
          if (v > anterior * 2) anomalia = 'pico'
          else if (v < anterior * 0.5) anomalia = 'caida'
        }
      }
      if (anomalia) nAnomalias++
      // "Se incorpora" es informativo: se marca pero no cuenta como anomalía
      if (!anomalia && i === primero && primero > 0) anomalia = 'nuevo'
      return { horas: v, coste: coste ?? null, anomalia, desv }
    })

    const total = [...porMes.values()].reduce((s, v) => s + v, 0)
    const totalCoste = [...costePorMes.values()].reduce((s, v) => s + v, 0)
    return {
      persona,
      total: Math.round(total * 100) / 100,
      totalCoste: Math.round(totalCoste * 100) / 100,
      mediana: med,
      celdas,
      nAnomalias,
    }
  })

  filas.sort((a, b) => b.total - a.total)
  return { meses, filas }
}

export interface TareaContratoResumen {
  tarea: string
  horas: number
  coste: number
  personas: string[]
}

/**
 * Resumen de horas/coste por tarea del contrato a partir del detalle horario
 * importado del ERP.
 */
export function tareasContrato(hours: HoursRecord[]): TareaContratoResumen[] {
  const map = new Map<string, { horas: number; coste: number; personas: Set<string> }>()
  for (const h of horasDePersonas(hours)) {
    const tarea = h.tarea?.trim()
    if (!tarea) continue
    const cur = map.get(tarea) ?? { horas: 0, coste: 0, personas: new Set<string>() }
    cur.horas += h.horas
    cur.coste += h.coste ?? 0
    cur.personas.add(h.persona)
    map.set(tarea, cur)
  }
  return [...map.entries()]
    .map(([tarea, v]) => ({
      tarea,
      horas: Math.round(v.horas * 100) / 100,
      coste: Math.round(v.coste * 100) / 100,
      personas: [...v.personas].sort(),
    }))
    .sort((a, b) => b.coste - a.coste || b.horas - a.horas || a.tarea.localeCompare(b.tarea))
}

// ---------- Control por departamento ----------

export const SIN_DEPT = 'Sin asignar'
/** Cajón para facturas de externos que no se asocian a ningún departamento */
export const OTROS_GASTOS = 'Otros Gastos'

export interface PartidaExterna {
  /** clave estable para asignar departamento */
  id: string
  /** tipo de factura = cuenta contable (p.ej. "6070 Trab. otras emp.(GENERAL)") */
  tipo: string
  tipoCodigo: string
  /** concepto de la factura */
  concepto: string
  coste: number
}

/**
 * Facturas / gastos de externos del detalle de explotación: todo gasto que no
 * sea coste de personal propio (9101) ni facturación (9990). Se agrupan por
 * concepto (una línea por factura) y se etiquetan por tipo de factura (cuenta).
 */
export function partidasExternas(entries: Entry[]): PartidaExterna[] {
  const map = new Map<string, PartidaExterna>()
  for (const e of entries) {
    if (!esGasto(e) || e.cuentaCodigo === '9101') continue
    const concepto = e.concepto || e.cuenta
    const id = `${e.cuentaCodigo}|${concepto}`
    const cur =
      map.get(id) ?? { id, tipo: e.cuenta, tipoCodigo: e.cuentaCodigo, concepto, coste: 0 }
    cur.coste += e.debe - e.haber
    map.set(id, cur)
  }
  return [...map.values()]
    .map((p) => ({ ...p, coste: Math.round(p.coste * 100) / 100 }))
    .sort((a, b) => a.tipoCodigo.localeCompare(b.tipoCodigo) || b.coste - a.coste)
}

/** Departamentos estándar disponibles en el desplegable de asignación */
export const DEPARTAMENTOS = [
  'Desarrollo Informático',
  'Ingeniería digital',
  'Gestión',
  'Oficina del dato',
] as const

export interface FilaDepartamento {
  dept: string
  personas: string[]
  /** presupuesto consumido (€) del departamento: personal (real/estimado) + externos */
  coste: number
  /** parte del consumo que son facturas de externos (€) */
  costeExterno: number
  /** horas acumuladas del departamento */
  horas: number
  /** % que ese consumo representa sobre el consumo total */
  pctCosteReal: number | null
  /** % que esas horas representan sobre el total de horas */
  pctHorasReal: number | null
  /** % del presupuesto asignado al departamento (corresponsabilidad) */
  share: number | null
  /** presupuesto asignado en € = share% x presupuesto total */
  asignado: number | null
  /** presupuesto consumido / presupuesto asignado, en % */
  consumidoPct: number | null
  estado: 'ok' | 'atencion' | 'exceso' | 'sin-datos'
}

export interface ControlDepartamentos {
  filas: FilaDepartamento[]
  /** consumo total (€) repartido entre departamentos */
  costeTotal: number
  horasTotal: number
  /** true si hay algún consumo en € que mostrar */
  hayCoste: boolean
  /** true si el consumo se estima repartiendo la 9101 por horas (sin coste por persona) */
  costeEstimado: boolean
  presupuesto: number | null
  /** suma de los % asignados; debería ser 100 */
  sumaShares: number
  hayShares: boolean
}

export interface ControlDepartamentosOptions {
  personas?: Iterable<string>
  tarea?: string | null
  incluirExternos?: boolean
}

/**
 * Calcula, por departamento, el presupuesto consumido frente al asignado.
 * El consumo es el coste de personal: si las horas traen coste por persona
 * (fichero del ERP) se usa directo; si no, se estima repartiendo el coste de
 * personal total del proyecto (cuenta 9101 de la explotación) por horas.
 */
export function controlDepartamentos(
  project: Project,
  options: ControlDepartamentosOptions = {},
): ControlDepartamentos {
  const dept = project.personDept ?? {}
  const share = project.deptShare ?? {}
  const presupuesto = project.budget ?? project.contractValue ?? null
  const personasFiltro = options.personas ? new Set(options.personas) : null
  const tareaFiltro = options.tarea?.trim() || null
  const incluirExternos = options.incluirExternos ?? !tareaFiltro

  // Coste de personal total del proyecto según la explotación (cuenta 9101)
  const costePersonal9101 = project.entries.reduce(
    (s, e) => (e.cuentaCodigo === '9101' ? s + e.debe - e.haber : s),
    0,
  )

  // Coste y horas acumulados por persona (de los registros de horas)
  const porPersona = new Map<string, { coste: number; horas: number }>()
  for (const h of horasDePersonas(project.hours)) {
    if (personasFiltro && !personasFiltro.has(h.persona)) continue
    if (tareaFiltro && h.tarea?.trim() !== tareaFiltro) continue
    const acc = porPersona.get(h.persona) ?? { coste: 0, horas: 0 }
    acc.coste += h.coste ?? 0
    acc.horas += h.horas
    porPersona.set(h.persona, acc)
  }
  const costePorPersonaTotal = [...porPersona.values()].reduce((s, v) => s + v.coste, 0)
  const hayCostePorPersona = costePorPersonaTotal > 0
  // Si no hay coste por persona, estimamos repartiendo la 9101 por horas
  const costeEstimado = !hayCostePorPersona && costePersonal9101 > 0

  const porDept = new Map<
    string,
    { personas: Set<string>; personal: number; horas: number; externo: number }
  >()
  const asegura = (d: string) => {
    if (!porDept.has(d)) porDept.set(d, { personas: new Set(), personal: 0, horas: 0, externo: 0 })
    return porDept.get(d)!
  }
  for (const [persona, v] of porPersona) {
    const acc = asegura(dept[persona]?.trim() || SIN_DEPT)
    acc.personas.add(persona)
    acc.personal += v.coste
    acc.horas += v.horas
  }
  // Facturas de externos asignadas a su departamento; sin asignar -> "Otros Gastos"
  const extDept = project.extDept ?? {}
  if (incluirExternos) {
    for (const p of partidasExternas(project.entries)) {
      asegura(extDept[p.id]?.trim() || OTROS_GASTOS).externo += p.coste
    }
  }
  // Departamentos que existen aunque aún no tengan gente: los estándar y los que
  // tengan % asignado (para poder repartir el presupuesto antes de asignar gente)
  for (const d of [...DEPARTAMENTOS, ...Object.keys(share)]) asegura(d)

  const horasTotal = [...porDept.values()].reduce((s, v) => s + v.horas, 0)

  // Coste de personal (€) por departamento: real por persona, o estimación por horas
  const costePersonalDept = (v: { personal: number; horas: number }) => {
    if (hayCostePorPersona) return v.personal
    if (costeEstimado && horasTotal > 0) return (v.horas / horasTotal) * costePersonal9101
    return 0
  }
  const costeDeptTotal = (v: { personal: number; horas: number; externo: number }) =>
    costePersonalDept(v) + v.externo
  const costeTotal = [...porDept.values()].reduce((s, v) => s + costeDeptTotal(v), 0)
  const hayCoste = costeTotal > 0

  const filas: FilaDepartamento[] = [...porDept.entries()].map(([d, v]) => {
    const coste = Math.round(costeDeptTotal(v) * 100) / 100
    const costeExterno = Math.round(v.externo * 100) / 100
    const horas = Math.round(v.horas * 100) / 100
    const sh = d === SIN_DEPT ? null : (share[d] ?? null)
    const asignado = sh !== null && presupuesto !== null ? (sh / 100) * presupuesto : null
    const consumidoPct = asignado !== null && asignado > 0 ? (coste / asignado) * 100 : null
    let estado: FilaDepartamento['estado'] = 'sin-datos'
    if (consumidoPct !== null) {
      estado = consumidoPct > 100 ? 'exceso' : consumidoPct > 85 ? 'atencion' : 'ok'
    }
    return {
      dept: d,
      personas: [...v.personas].sort(),
      coste,
      costeExterno,
      horas,
      pctCosteReal: costeTotal > 0 ? (coste / costeTotal) * 100 : null,
      pctHorasReal: horasTotal > 0 ? (horas / horasTotal) * 100 : null,
      share: sh,
      asignado,
      consumidoPct,
      estado,
    }
  })

  // Orden: departamentos por consumo desc, luego "Otros Gastos" y "Sin asignar" al final
  const rango = (d: string) => (d === SIN_DEPT ? 2 : d === OTROS_GASTOS ? 1 : 0)
  filas.sort((a, b) => rango(a.dept) - rango(b.dept) || b.coste - a.coste)

  const sharesValidos = Object.entries(share).filter(([d]) => d !== SIN_DEPT)
  const sumaShares = sharesValidos.reduce((s, [, v]) => s + (v || 0), 0)

  return {
    filas,
    costeTotal: Math.round(costeTotal * 100) / 100,
    horasTotal: Math.round(horasTotal * 100) / 100,
    hayCoste,
    costeEstimado,
    presupuesto,
    sumaShares,
    hayShares: sharesValidos.length > 0,
  }
}

/** Serie mensual del coste de horas de oficina (cuenta 9101) del detalle de explotación */
export function costeHorasMensual(entries: Entry[]): Array<{ mes: string; coste: number }> {
  const map = new Map<string, number>()
  for (const e of entries) {
    if (e.cuentaCodigo !== '9101') continue
    map.set(e.mes, (map.get(e.mes) ?? 0) + e.debe - e.haber)
  }
  return monthRange([...map.keys()]).map((mes) => ({
    mes,
    coste: Math.round((map.get(mes) ?? 0) * 100) / 100,
  }))
}
