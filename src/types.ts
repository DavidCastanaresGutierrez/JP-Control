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
}

export interface Project {
  code: string
  name: string
  director?: string
  fechaAlta?: string
  hasta?: string // fecha "hasta" del último fichero importado
  lastImport?: string // ISO timestamp de la importación
  concostFileName?: string
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
}

export interface DB {
  projects: Record<string, Project>
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
