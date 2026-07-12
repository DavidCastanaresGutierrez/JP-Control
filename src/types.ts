export interface Entry {
  id: string
  asiento: string | null
  fecha: string // ISO yyyy-mm-dd
  mes: string // yyyy-mm
  concepto: string
  area: string | null
  cuenta: string // "9101 Horas trabajo personal oficina"
  cuentaCodigo: string // "9101"
  debe: number
  haber: number
}

/** Horas mensuales cargadas por un participante (importación opcional) */
export interface HoursRecord {
  persona: string
  mes: string // yyyy-mm
  horas: number
  /** Coste de personal (€) de esas horas, si el fichero lo trae (col Coste del ERP) */
  coste?: number
  /** Tarea del contrato / línea de trabajo del ERP, si el fichero la trae */
  tarea?: string
}

export interface Project {
  code: string
  name: string
  director?: string
  jp?: string // jefe de proyecto asignado (uno de los participantes)
  fechaAlta?: string
  hasta?: string // fecha "hasta" del último fichero importado
  lastImport?: string // ISO timestamp de la importación
  concostFileName?: string
  archivedAt?: string // ISO timestamp si el proyecto esta archivado
  entries: Entry[]
  hours: HoursRecord[]
  /** Presupuesto de coste (lo que se puede gastar) */
  budget?: number
  /** Importe de contrato / honorarios */
  contractValue?: number
  /** % avance técnico estimado 0-100 */
  progress?: number
  /** Departamento asignado a cada persona (persona -> departamento) */
  personDept?: Record<string, string>
  /** Departamento asignado a cada partida externa (id de partida -> departamento) */
  extDept?: Record<string, string>
  /** Corresponsabilidad: % del total asignado a cada departamento (departamento -> 0-100) */
  deptShare?: Record<string, number>
  /** Emails (en minusculas) de usuarios que siguen el proyecto sin ser su JP */
  watchers?: string[]
}

export interface DB {
  projects: Record<string, Project>
  departamentos: Record<string, DepartmentModule>
}

export interface ParsedExplotacion {
  code: string
  name: string
  fileName: string
  director?: string
  fechaAlta?: string
  hasta?: string
  entries: Entry[]
  totalDebe?: number
  totalHaber?: number
  warnings: string[]
}

/** Departamentos reales del organigrama (con su Director de Departamento) */
export const DEPARTAMENTOS_REALES = [
  'Administración',
  'Calidad de producto y soporte',
  'Desarrollo de negocio',
  'Desarrollo de software',
  'IA y Big data',
  'Ingeniería y arquitectura digital',
  'Servicios especializados',
] as const

/** Un apunte de horas de la importación "toda la produccion" (todas las personas, todos los proyectos) */
export interface HoraProduccion {
  persona: string
  /** Proyecto o actividad interna tal cual aparece en Concost, p.ej. "DSES.DE3423ESP.TYES - ATLAS Plataforma BIM-GIS" */
  proyecto: string
  fecha: string // ISO yyyy-mm-dd
  mes: string // yyyy-mm
  horas: number
  coste: number
  descripcion?: string
  tarea?: string
}

export type TipoActividad = 'facturable' | 'innovacion' | 'soporte' | 'formacion' | 'gestion'

export interface RosterPersona {
  activo: boolean
  /** % de jornada de la persona (100 = jornada completa); por defecto 100 */
  jornadaPct?: number
}

export interface DepartmentModule {
  departamento: string
  /** Personas del departamento (nombre -> estado); se eligen de las vistas en la importación */
  roster: Record<string, RosterPersona>
  horas: HoraProduccion[]
  /** Reclasificacion manual de un proyecto/actividad (por defecto se infiere por palabras clave) */
  tipoActividad?: Record<string, TipoActividad>
  lastImport?: string
  fileName?: string
}
