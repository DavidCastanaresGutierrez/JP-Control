import type { DepartmentModule, HoraProduccion, TipoActividad } from '../types.ts'
import { horasJornadaMes } from './metrics.ts'
import { monthRange } from './format.ts'

const RE_INNOVACION = /i\+d\+i/i
const RE_SOPORTE = /soporte/i
const RE_FORMACION = /formaci[oó]n/i
const RE_GESTION = /labores no asignables|tareas transversales|ofertas/i
const RE_VACACIONES = /vacaciones|permiso retribuido/i

/**
 * Clasifica un proyecto/actividad por palabras clave de su nombre en Concost.
 * Los codigos internos (sin cliente) empiezan por "DS." en vez de "DSES.".
 * `overrides` permite reclasificar a mano un proyecto concreto.
 */
export function clasificarActividad(
  proyecto: string,
  overrides?: Record<string, TipoActividad>,
): TipoActividad {
  if (overrides?.[proyecto]) return overrides[proyecto]
  if (RE_VACACIONES.test(proyecto)) return 'vacaciones'
  if (RE_INNOVACION.test(proyecto)) return 'innovacion'
  if (RE_SOPORTE.test(proyecto)) return 'soporte'
  if (RE_FORMACION.test(proyecto)) return 'formacion'
  if (RE_GESTION.test(proyecto)) return 'gestion'
  if (proyecto.startsWith('DS.')) return 'gestion'
  return 'facturable'
}

export const TIPO_ACTIVIDAD_LABEL: Record<TipoActividad, string> = {
  facturable: 'Facturable',
  innovacion: 'Innovación',
  soporte: 'Soporte',
  formacion: 'Formación',
  gestion: 'Gestión / interno',
  vacaciones: 'Vacaciones',
}

/** Personas activas del roster (excluye las marcadas como baja del checklist) */
export function personasActivas(modulo: DepartmentModule): string[] {
  return Object.entries(modulo.roster)
    .filter(([, r]) => r.activo)
    .map(([persona]) => persona)
}

/** Si una persona cuenta para un mes concreto: activa en el roster y, si tiene fecha de baja, antes de esa fecha. */
export function activoEnMes(modulo: DepartmentModule, persona: string, mes: string): boolean {
  const r = modulo.roster[persona]
  if (!r?.activo) return false
  return !r.fechaBaja || mes < r.fechaBaja
}

/** Personas activas del roster que además siguen contando en un mes concreto (no se han dado de baja antes de ese mes). */
export function personasActivasEnMes(modulo: DepartmentModule, mes: string): string[] {
  return personasActivas(modulo).filter((persona) => activoEnMes(modulo, persona, mes))
}

export function todasLasPersonas(modulo: DepartmentModule): string[] {
  return Object.keys(modulo.roster)
}

/**
 * Horas del departamento: solo las de personas que están en el roster (activas
 * o no) y, si se ha definido un mes de inicio del análisis, solo desde ese mes
 * en adelante (para descartar histórico previo a una reestructuración, etc.).
 */
export function horasDelDepartamento(modulo: DepartmentModule): HoraProduccion[] {
  const roster = new Set(Object.keys(modulo.roster))
  return modulo.horas.filter(
    (h) => roster.has(h.persona) && (!modulo.mesInicio || h.mes >= modulo.mesInicio),
  )
}

export function mesesDisponibles(modulo: DepartmentModule): string[] {
  const horas = horasDelDepartamento(modulo)
  if (horas.length === 0) return []
  return monthRange([...new Set(horas.map((h) => h.mes))])
}

export function ultimoMesConDatos(modulo: DepartmentModule): string | null {
  const meses = mesesDisponibles(modulo)
  return meses.length > 0 ? meses[meses.length - 1] : null
}

/** Dias de margen tras acabar un mes antes de darlo por "cerrado": la gente
 * suele terminar de fichar el mes anterior en los primeros dias del nuevo. */
const GRACIA_DIAS_CIERRE_MES = 5

/**
 * Ultimo mes ya cerrado (nunca el mes en curso), con un margen de gracia de
 * unos dias para que la gente termine de fichar el mes anterior antes de
 * darlo por definitivo (si no, los primeros dias de fichaje del mes nuevo
 * distorsionarian el numero al tratarlo como cerrado demasiado pronto).
 */
export function mesVencido(meses: string[]): string | null {
  if (meses.length === 0) return null
  const hoy = new Date()
  const mesesAtras = hoy.getDate() <= GRACIA_DIAS_CIERRE_MES ? 2 : 1
  const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - mesesAtras, 1)
  const candidato = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
  const disponibles = [...meses].sort()
  const conDatos = disponibles.filter((m) => m <= candidato)
  return conDatos.length > 0 ? conDatos[conDatos.length - 1] : disponibles[0]
}

function capacidadPersona(mes: string, jornadaPct: number | undefined): number {
  return horasJornadaMes(mes) * ((jornadaPct ?? 100) / 100)
}

export interface FilaOcupacion {
  persona: string
  horasDisponibles: number
  horasImputadas: number
  horasFacturables: number
  ocupacionPct: number | null
  facturablePct: number | null
  proyectoPrincipal: string | null
  estado: 'baja' | 'ok' | 'sobre' | 'sin-datos'
}

const UMBRAL_BAJA = 70
const UMBRAL_SOBRE = 110

/** Tabla de ocupación por persona para un mes concreto. */
export function tablaOcupacion(
  modulo: DepartmentModule,
  mes: string,
  overridesActividad?: Record<string, TipoActividad>,
): FilaOcupacion[] {
  const horasMes = horasDelDepartamento(modulo).filter((h) => h.mes === mes)
  const porPersona = new Map<string, HoraProduccion[]>()
  for (const h of horasMes) {
    if (!porPersona.has(h.persona)) porPersona.set(h.persona, [])
    porPersona.get(h.persona)!.push(h)
  }

  return personasActivasEnMes(modulo, mes)
    .map((persona) => {
      const registros = porPersona.get(persona) ?? []
      const horasImputadas = Math.round(registros.reduce((s, h) => s + h.horas, 0) * 100) / 100
      const horasFacturables = Math.round(
        registros
          .filter((h) => clasificarActividad(h.proyecto, overridesActividad) === 'facturable')
          .reduce((s, h) => s + h.horas, 0) * 100,
      ) / 100
      const horasDisponibles = Math.round(capacidadPersona(mes, modulo.roster[persona]?.jornadaPct) * 100) / 100
      const ocupacionPct = horasDisponibles > 0 ? (horasImputadas / horasDisponibles) * 100 : null
      const facturablePct = horasImputadas > 0 ? (horasFacturables / horasImputadas) * 100 : null

      const porProyecto = new Map<string, number>()
      for (const h of registros) porProyecto.set(h.proyecto, (porProyecto.get(h.proyecto) ?? 0) + h.horas)
      const proyectoPrincipal =
        [...porProyecto.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

      let estado: FilaOcupacion['estado'] = 'sin-datos'
      if (ocupacionPct !== null) {
        estado = ocupacionPct < UMBRAL_BAJA ? 'baja' : ocupacionPct > UMBRAL_SOBRE ? 'sobre' : 'ok'
      }

      return {
        persona,
        horasDisponibles,
        horasImputadas,
        horasFacturables,
        ocupacionPct,
        facturablePct,
        proyectoPrincipal,
        estado,
      }
    })
    .sort((a, b) => b.horasImputadas - a.horasImputadas)
}

export interface DashboardDepartamento {
  mes: string | null
  personasTotal: number
  personasActivas: number
  horasImputadas: number
  horasFacturables: number
  facturabilidadPct: number | null
  ocupacionMediaPct: number | null
  horasInternas: number
  horasSoporte: number
  horasInnovacion: number
  horasFormacion: number
  horasVacaciones: number
  capacidadLibre: number
  personasSobreocupadas: number
  personasInfraocupadas: number
}

/** KPIs del dashboard principal para un mes (por defecto el ultimo con datos). */
export function dashboardDepartamento(
  modulo: DepartmentModule,
  mes?: string,
  overridesActividad?: Record<string, TipoActividad>,
): DashboardDepartamento {
  const mesUsado = mes ?? ultimoMesConDatos(modulo)
  const base = {
    mes: mesUsado,
    personasTotal: todasLasPersonas(modulo).length,
    personasActivas: mesUsado ? personasActivasEnMes(modulo, mesUsado).length : personasActivas(modulo).length,
    horasImputadas: 0,
    horasFacturables: 0,
    facturabilidadPct: null,
    ocupacionMediaPct: null,
    horasInternas: 0,
    horasSoporte: 0,
    horasInnovacion: 0,
    horasFormacion: 0,
    horasVacaciones: 0,
    capacidadLibre: 0,
    personasSobreocupadas: 0,
    personasInfraocupadas: 0,
  }
  if (!mesUsado) return base

  const filas = tablaOcupacion(modulo, mesUsado, overridesActividad)
  const horasMes = horasDelDepartamento(modulo).filter((h) => h.mes === mesUsado)

  const porTipo = new Map<TipoActividad, number>()
  for (const h of horasMes) {
    const tipo = clasificarActividad(h.proyecto, overridesActividad)
    porTipo.set(tipo, (porTipo.get(tipo) ?? 0) + h.horas)
  }

  const horasImputadas = filas.reduce((s, f) => s + f.horasImputadas, 0)
  const horasFacturables = filas.reduce((s, f) => s + f.horasFacturables, 0)
  const horasDisponiblesTotal = filas.reduce((s, f) => s + f.horasDisponibles, 0)
  const conOcupacion = filas.filter((f) => f.ocupacionPct !== null)
  const ocupacionMediaPct =
    conOcupacion.length > 0
      ? conOcupacion.reduce((s, f) => s + (f.ocupacionPct ?? 0), 0) / conOcupacion.length
      : null

  return {
    ...base,
    horasImputadas: Math.round(horasImputadas * 100) / 100,
    horasFacturables: Math.round(horasFacturables * 100) / 100,
    facturabilidadPct: horasImputadas > 0 ? (horasFacturables / horasImputadas) * 100 : null,
    ocupacionMediaPct: ocupacionMediaPct !== null ? Math.round(ocupacionMediaPct * 10) / 10 : null,
    horasInternas: Math.round((porTipo.get('gestion') ?? 0) * 100) / 100,
    horasSoporte: Math.round((porTipo.get('soporte') ?? 0) * 100) / 100,
    horasInnovacion: Math.round((porTipo.get('innovacion') ?? 0) * 100) / 100,
    horasFormacion: Math.round((porTipo.get('formacion') ?? 0) * 100) / 100,
    horasVacaciones: Math.round((porTipo.get('vacaciones') ?? 0) * 100) / 100,
    capacidadLibre: Math.round(Math.max(0, horasDisponiblesTotal - horasImputadas) * 100) / 100,
    personasSobreocupadas: filas.filter((f) => f.estado === 'sobre').length,
    personasInfraocupadas: filas.filter((f) => f.estado === 'baja').length,
  }
}

export interface DedicacionPersona {
  persona: string
  totalHoras: number
  reparto: Array<{ proyecto: string; horas: number; pct: number }>
}

/** En que proyectos se reparten las horas de cada persona (todo el periodo importado). */
export function dedicacionPorPersona(modulo: DepartmentModule): DedicacionPersona[] {
  const horas = horasDelDepartamento(modulo)
  const porPersona = new Map<string, Map<string, number>>()
  for (const h of horas) {
    if (!porPersona.has(h.persona)) porPersona.set(h.persona, new Map())
    const m = porPersona.get(h.persona)!
    m.set(h.proyecto, (m.get(h.proyecto) ?? 0) + h.horas)
  }

  return personasActivas(modulo)
    .map((persona) => {
      const porProyecto = porPersona.get(persona) ?? new Map<string, number>()
      const totalHoras = [...porProyecto.values()].reduce((s, v) => s + v, 0)
      const reparto = [...porProyecto.entries()]
        .map(([proyecto, horas]) => ({
          proyecto,
          horas: Math.round(horas * 100) / 100,
          pct: totalHoras > 0 ? (horas / totalHoras) * 100 : 0,
        }))
        .sort((a, b) => b.horas - a.horas)
      return { persona, totalHoras: Math.round(totalHoras * 100) / 100, reparto }
    })
    .filter((d) => d.totalHoras > 0)
    .sort((a, b) => b.totalHoras - a.totalHoras)
}

export interface MesFacturabilidad {
  mes: string
  horasImputadas: number
  horasFacturables: number
  facturablePct: number | null
  ocupacionPct: number | null
}

/** Evolucion mensual de horas y % de facturabilidad de una persona (todo el periodo importado). */
export function evolucionFacturabilidadPersona(
  modulo: DepartmentModule,
  persona: string,
  overridesActividad?: Record<string, TipoActividad>,
): MesFacturabilidad[] {
  const horas = horasDelDepartamento(modulo).filter((h) => h.persona === persona)
  if (horas.length === 0) return []

  const meses = monthRange([...new Set(horas.map((h) => h.mes))])
  const jornadaPct = modulo.roster[persona]?.jornadaPct

  return meses.map((mes) => {
    const delMes = horas.filter((h) => h.mes === mes)
    const horasImputadas = Math.round(delMes.reduce((s, h) => s + h.horas, 0) * 100) / 100
    const horasFacturables = Math.round(
      delMes
        .filter((h) => clasificarActividad(h.proyecto, overridesActividad) === 'facturable')
        .reduce((s, h) => s + h.horas, 0) * 100,
    ) / 100
    const horasDisponibles = capacidadPersona(mes, jornadaPct)
    return {
      mes,
      horasImputadas,
      horasFacturables,
      facturablePct: horasImputadas > 0 ? (horasFacturables / horasImputadas) * 100 : null,
      ocupacionPct: horasDisponibles > 0 ? (horasImputadas / horasDisponibles) * 100 : null,
    }
  })
}

export interface DistribucionItem {
  clave: string
  horas: number
  pct: number
  tipo: TipoActividad
}

/** Horas de un mes concreto de las personas activas del equipo, para vistas agregadas. */
function horasActivosMes(modulo: DepartmentModule, mes: string): HoraProduccion[] {
  const activos = new Set(personasActivasEnMes(modulo, mes))
  return horasDelDepartamento(modulo).filter((h) => h.mes === mes && activos.has(h.persona))
}

/** Distribución del esfuerzo del equipo por proyecto/actividad, para un mes. */
export function distribucionPorProyecto(
  modulo: DepartmentModule,
  mes: string,
  overridesActividad?: Record<string, TipoActividad>,
): DistribucionItem[] {
  const horas = horasActivosMes(modulo, mes)
  const total = horas.reduce((s, h) => s + h.horas, 0)
  const porProyecto = new Map<string, number>()
  for (const h of horas) porProyecto.set(h.proyecto, (porProyecto.get(h.proyecto) ?? 0) + h.horas)
  return [...porProyecto.entries()]
    .map(([proyecto, hrs]) => ({
      clave: proyecto,
      horas: Math.round(hrs * 100) / 100,
      pct: total > 0 ? (hrs / total) * 100 : 0,
      tipo: clasificarActividad(proyecto, overridesActividad),
    }))
    .sort((a, b) => b.horas - a.horas)
}

/** Distribución del esfuerzo del equipo por tipo de actividad, para un mes. */
export function distribucionPorTipoActividad(
  modulo: DepartmentModule,
  mes: string,
  overridesActividad?: Record<string, TipoActividad>,
): DistribucionItem[] {
  const horas = horasActivosMes(modulo, mes)
  const total = horas.reduce((s, h) => s + h.horas, 0)
  const porTipo = new Map<TipoActividad, number>()
  for (const h of horas) {
    const tipo = clasificarActividad(h.proyecto, overridesActividad)
    porTipo.set(tipo, (porTipo.get(tipo) ?? 0) + h.horas)
  }
  return [...porTipo.entries()]
    .map(([tipo, hrs]) => ({
      clave: TIPO_ACTIVIDAD_LABEL[tipo],
      horas: Math.round(hrs * 100) / 100,
      pct: total > 0 ? (hrs / total) * 100 : 0,
      tipo,
    }))
    .sort((a, b) => b.horas - a.horas)
}

export interface CeldaComparativa {
  horasImputadas: number
  ocupacionPct: number | null
  facturablePct: number | null
}

export interface FilaComparativaOcupacion {
  persona: string
  celdas: CeldaComparativa[]
  totalHorasImputadas: number
  mediaOcupacionPct: number | null
}

export interface ComparativaOcupacion {
  meses: string[]
  filas: FilaComparativaOcupacion[]
}

/**
 * Comparativa mensual de ocupación, horas y facturabilidad de todas las
 * personas activas, con los mismos meses en columna, para poder cruzarlas
 * entre sí (igual que la tabla de participantes de un proyecto).
 */
export function comparativaOcupacion(
  modulo: DepartmentModule,
  overridesActividad?: Record<string, TipoActividad>,
  hastaMes?: string,
): ComparativaOcupacion {
  const meses = mesesDisponibles(modulo).filter((mes) => !hastaMes || mes <= hastaMes)
  const horas = horasDelDepartamento(modulo)

  const filas = personasActivas(modulo)
    .map((persona) => {
      const horasPersona = horas.filter((h) => h.persona === persona)
      const jornadaPct = modulo.roster[persona]?.jornadaPct
      const celdas = meses.map((mes) => {
        const delMes = horasPersona.filter((h) => h.mes === mes)
        const horasImputadas = Math.round(delMes.reduce((s, h) => s + h.horas, 0) * 100) / 100
        const horasFacturables = Math.round(
          delMes
            .filter((h) => clasificarActividad(h.proyecto, overridesActividad) === 'facturable')
            .reduce((s, h) => s + h.horas, 0) * 100,
        ) / 100
        const horasDisponibles = capacidadPersona(mes, jornadaPct)
        const activaEsteMes = activoEnMes(modulo, persona, mes)
        return {
          horasImputadas,
          ocupacionPct: activaEsteMes && horasDisponibles > 0 ? (horasImputadas / horasDisponibles) * 100 : null,
          facturablePct: horasImputadas > 0 ? (horasFacturables / horasImputadas) * 100 : null,
        }
      })
      const totalHorasImputadas = Math.round(celdas.reduce((s, c) => s + c.horasImputadas, 0) * 100) / 100
      const ocupaciones = celdas.map((c) => c.ocupacionPct).filter((v): v is number => v !== null)
      const mediaOcupacionPct =
        ocupaciones.length > 0
          ? Math.round((ocupaciones.reduce((s, v) => s + v, 0) / ocupaciones.length) * 10) / 10
          : null
      return { persona, celdas, totalHorasImputadas, mediaOcupacionPct }
    })
    .sort((a, b) => b.totalHorasImputadas - a.totalHorasImputadas)

  return { meses, filas }
}

export interface MesDepartamento {
  mes: string
  horasImputadas: number
  horasFacturables: number
  horasInternas: number
  horasSoporte: number
  horasInnovacion: number
  horasFormacion: number
  horasVacaciones: number
  facturabilidadPct: number | null
  ocupacionMediaPct: number | null
}

/** Evolucion mensual agregada de todo el equipo (activos), a lo largo de todo el periodo importado. */
export function evolucionTemporalDepartamento(
  modulo: DepartmentModule,
  overridesActividad?: Record<string, TipoActividad>,
): MesDepartamento[] {
  return mesesDisponibles(modulo).map((mes) => {
    const d = dashboardDepartamento(modulo, mes, overridesActividad)
    return {
      mes,
      horasImputadas: d.horasImputadas,
      horasFacturables: d.horasFacturables,
      horasInternas: d.horasInternas,
      horasSoporte: d.horasSoporte,
      horasInnovacion: d.horasInnovacion,
      horasFormacion: d.horasFormacion,
      horasVacaciones: d.horasVacaciones,
      facturabilidadPct: d.facturabilidadPct,
      ocupacionMediaPct: d.ocupacionMediaPct,
    }
  })
}

const MESES_SIN_ACTIVIDAD_AVISO = 2

export interface PosibleBaja {
  persona: string
  ultimoMesConActividad: string | null
}

/**
 * Personas del roster (sin fecha de baja ya puesta) sin horas reales (fuera de
 * vacaciones) en los ultimos meses disponibles del departamento: probable
 * indicio de que se han ido y falta marcarles la fecha de baja.
 */
export function posiblesBajas(
  modulo: DepartmentModule,
  overridesActividad?: Record<string, TipoActividad>,
  mesesAviso: number = MESES_SIN_ACTIVIDAD_AVISO,
): PosibleBaja[] {
  const meses = mesesDisponibles(modulo)
  if (meses.length === 0) return []
  const mesesRecientes = new Set(meses.slice(-mesesAviso))
  const horas = horasDelDepartamento(modulo)

  return personasActivas(modulo)
    .filter((persona) => !modulo.roster[persona]?.fechaBaja)
    .map((persona): PosibleBaja | null => {
      const horasPersona = horas.filter((h) => h.persona === persona && h.horas > 0)
      const actividadReciente = horasPersona.some(
        (h) =>
          mesesRecientes.has(h.mes) && clasificarActividad(h.proyecto, overridesActividad) !== 'vacaciones',
      )
      if (actividadReciente) return null
      const ultimoMesConActividad: string | null =
        [...horasPersona].sort((a, b) => b.mes.localeCompare(a.mes))[0]?.mes ?? null
      return { persona, ultimoMesConActividad }
    })
    .filter((p): p is PosibleBaja => p !== null)
}
