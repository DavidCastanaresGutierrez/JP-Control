import type { DepartmentModule, HoraProduccion, TipoActividad } from '../types.ts'
import { horasJornadaMes } from './metrics.ts'
import { monthRange } from './format.ts'

const RE_INNOVACION = /i\+d\+i/i
const RE_SOPORTE = /soporte/i
const RE_FORMACION = /formaci[oó]n/i
const RE_GESTION = /labores no asignables|tareas transversales|ofertas/i

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
}

/** Personas activas del roster (excluye las marcadas como baja) */
export function personasActivas(modulo: DepartmentModule): string[] {
  return Object.entries(modulo.roster)
    .filter(([, r]) => r.activo)
    .map(([persona]) => persona)
}

export function todasLasPersonas(modulo: DepartmentModule): string[] {
  return Object.keys(modulo.roster)
}

/** Horas del departamento: solo las de personas que están en el roster (activas o no) */
export function horasDelDepartamento(modulo: DepartmentModule): HoraProduccion[] {
  const roster = new Set(Object.keys(modulo.roster))
  return modulo.horas.filter((h) => roster.has(h.persona))
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

  return personasActivas(modulo)
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
    personasActivas: personasActivas(modulo).length,
    horasImputadas: 0,
    horasFacturables: 0,
    facturabilidadPct: null,
    ocupacionMediaPct: null,
    horasInternas: 0,
    horasSoporte: 0,
    horasInnovacion: 0,
    horasFormacion: 0,
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
  const activos = new Set(personasActivas(modulo))
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

export interface MesDepartamento {
  mes: string
  horasImputadas: number
  horasFacturables: number
  horasInternas: number
  horasSoporte: number
  horasInnovacion: number
  horasFormacion: number
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
      facturabilidadPct: d.facturabilidadPct,
      ocupacionMediaPct: d.ocupacionMediaPct,
    }
  })
}
