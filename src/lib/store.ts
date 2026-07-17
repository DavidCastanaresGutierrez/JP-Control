import type { DB, DepartmentModule, HoraProduccion, HoursRecord, ParsedExplotacion, Project } from '../types.ts'
import { idbAplicar, idbCargarStore, idbDisponible } from './idb.ts'

const KEY = 'jp-control-db-v1'

const DEPT_OLD = 'Servicios'
const DEPT_NEW = 'Gestión'

function migrateProjectDepartments(project: Project): Project {
  const remap = <T,>(obj?: Record<string, T>) => {
    if (!obj || !(DEPT_OLD in obj)) return obj
    const next = { ...obj }
    const oldValue = next[DEPT_OLD]
    delete next[DEPT_OLD]
    if (!(DEPT_NEW in next)) next[DEPT_NEW] = oldValue
    return next
  }

  return {
    ...project,
    personDept: remap(project.personDept),
    extDept: remap(project.extDept),
    deptShare: remap(project.deptShare),
  }
}

/** Carga la copia legacy de localStorage (versiones anteriores de la app). */
function loadDBLegacy(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DB
      return {
        projects: parsed.projects ?? {},
        departamentos: parsed.departamentos ?? {},
      }
    }
  } catch {
    // localStorage corrupto: empezamos de cero
  }
  return { projects: {}, departamentos: {} }
}

/**
 * Saneado de fronteras: los datos que llegan de IndexedDB, de la copia legacy
 * de localStorage o de la API se castean sin validacion runtime; un esquema
 * viejo o una fila corrupta reventaria lejos del origen (p.ej. en metrics).
 * Se garantizan los campos minimos con defaults en vez de confiar en el cast.
 */
export function sanearProject(code: string, valor: unknown): Project {
  const raw = (valor && typeof valor === 'object' ? valor : {}) as Partial<Project>
  return migrateProjectDepartments({
    ...raw,
    code: typeof raw.code === 'string' && raw.code ? raw.code : code,
    name: typeof raw.name === 'string' && raw.name ? raw.name : code,
    entries: Array.isArray(raw.entries) ? raw.entries : [],
    hours: Array.isArray(raw.hours) ? raw.hours : [],
  })
}

export function sanearDepartamento(nombre: string, valor: unknown): DepartmentModule {
  const raw = (valor && typeof valor === 'object' ? valor : {}) as Partial<DepartmentModule>
  return {
    ...raw,
    departamento: typeof raw.departamento === 'string' && raw.departamento ? raw.departamento : nombre,
    roster: raw.roster && typeof raw.roster === 'object' ? raw.roster : {},
    horas: Array.isArray(raw.horas) ? raw.horas : [],
  }
}

export function sanearProjects(projects: Record<string, unknown>): Record<string, Project> {
  return Object.fromEntries(Object.entries(projects).map(([code, p]) => [code, sanearProject(code, p)]))
}

export function sanearDepartamentos(
  departamentos: Record<string, unknown>,
): Record<string, DepartmentModule> {
  return Object.fromEntries(
    Object.entries(departamentos).map(([nombre, m]) => [nombre, sanearDepartamento(nombre, m)]),
  )
}

function aplicarMigraciones(db: DB): DB {
  return {
    projects: sanearProjects(db.projects),
    departamentos: sanearDepartamentos(db.departamentos),
  }
}

/**
 * Carga la cache local desde IndexedDB. La primera vez migra la copia antigua
 * de localStorage (y la elimina, liberando su cuota de ~5MB). Si el navegador
 * no ofrece IndexedDB, cae a la copia de localStorage sin migrar.
 */
export async function loadDBAsync(): Promise<DB> {
  if (!idbDisponible()) return aplicarMigraciones(loadDBLegacy())
  try {
    const [projects, departamentos] = await Promise.all([
      idbCargarStore<Project>('projects'),
      idbCargarStore<DepartmentModule>('departamentos'),
    ])
    if (Object.keys(projects).length > 0 || Object.keys(departamentos).length > 0) {
      return aplicarMigraciones({ projects, departamentos })
    }
    // IndexedDB vacio: migrar la copia legacy de localStorage si existe
    const legacy = aplicarMigraciones(loadDBLegacy())
    if (Object.keys(legacy.projects).length > 0 || Object.keys(legacy.departamentos).length > 0) {
      await idbAplicar('projects', Object.entries(legacy.projects), [])
      await idbAplicar('departamentos', Object.entries(legacy.departamentos), [])
      try {
        localStorage.removeItem(KEY)
      } catch {
        // sin permisos de localStorage: la copia legacy queda como esta
      }
    }
    return legacy
  } catch {
    return aplicarMigraciones(loadDBLegacy())
  }
}

/** Huellas del sync incremental (version + hash por entidad), persistidas en el store 'meta'. */
export interface MetaSyncGuardada {
  projects: Record<string, { version: number; hash: string }>
  departamentos: Record<string, { version: number; hash: string }>
}

export async function cargarMetaSync(): Promise<MetaSyncGuardada> {
  const vacia: MetaSyncGuardada = { projects: {}, departamentos: {} }
  if (!idbDisponible()) return vacia
  try {
    const meta = await idbCargarStore<MetaSyncGuardada[keyof MetaSyncGuardada]>('meta')
    return {
      projects: (meta['projects'] as MetaSyncGuardada['projects']) ?? {},
      departamentos: (meta['departamentos'] as MetaSyncGuardada['departamentos']) ?? {},
    }
  } catch {
    return vacia
  }
}

export async function guardarMetaSync(meta: MetaSyncGuardada): Promise<void> {
  if (!idbDisponible()) return
  try {
    await idbAplicar('meta', [
      ['projects', meta.projects],
      ['departamentos', meta.departamentos],
    ], [])
  } catch {
    // sin huellas persistidas el proximo arranque hara una descarga completa; no es critico
  }
}

/** Referencias de la ultima copia persistida, para escribir solo lo que cambia. */
export interface PersistState {
  projects: Map<string, Project>
  departamentos: Map<string, DepartmentModule>
}

export function crearPersistState(db: DB): PersistState {
  return {
    projects: new Map(Object.entries(db.projects)),
    departamentos: new Map(Object.entries(db.departamentos)),
  }
}

function diff<T>(actuales: Record<string, T>, previos: Map<string, T>): {
  puts: Array<[string, T]>
  deletes: string[]
} {
  const puts: Array<[string, T]> = []
  for (const [key, valor] of Object.entries(actuales)) {
    if (previos.get(key) !== valor) puts.push([key, valor])
  }
  const deletes = [...previos.keys()].filter((key) => !(key in actuales))
  return { puts, deletes }
}

/**
 * Persiste en IndexedDB solo las entidades que han cambiado (por identidad de
 * objeto: los mutadores crean objetos nuevos solo para lo que tocan). Devuelve
 * false sin lanzar si la escritura falla, para no tumbar el render.
 */
export async function persistDB(db: DB, state: PersistState): Promise<boolean> {
  if (!idbDisponible()) return saveDBLegacy(db)
  const proyectos = diff(db.projects, state.projects)
  const departamentos = diff(db.departamentos, state.departamentos)
  try {
    await idbAplicar('projects', proyectos.puts, proyectos.deletes)
    await idbAplicar('departamentos', departamentos.puts, departamentos.deletes)
  } catch {
    return false
  }
  state.projects = new Map(Object.entries(db.projects))
  state.departamentos = new Map(Object.entries(db.departamentos))
  return true
}

/**
 * Fallback sin IndexedDB: guarda en localStorage descartando el detalle de
 * horas de departamento (miles de apuntes que superan la cuota de ~5MB).
 */
function saveDBLegacy(db: DB): boolean {
  try {
    const liviano: DB = {
      projects: db.projects,
      departamentos: Object.fromEntries(
        Object.entries(db.departamentos).map(([nombre, modulo]) => [nombre, { ...modulo, horas: [] }]),
      ),
    }
    localStorage.setItem(KEY, JSON.stringify(liviano))
    return true
  } catch {
    return false
  }
}

/**
 * Incorpora un fichero de explotación. Los exportes son acumulativos
 * (desde el alta hasta una fecha), así que el más reciente sustituye
 * a los apuntes anteriores del proyecto.
 */
export function upsertExplotacion(db: DB, parsed: ParsedExplotacion): { db: DB; skipped: boolean } {
  const prev = db.projects[parsed.code]
  if (prev?.hasta && parsed.hasta && parsed.hasta < prev.hasta) {
    return { db, skipped: true } // fichero más antiguo que lo ya cargado
  }
  const project: Project = {
    code: parsed.code,
    name: parsed.name || prev?.name || parsed.code,
    director: parsed.director ?? prev?.director,
    fechaAlta: parsed.fechaAlta ?? prev?.fechaAlta,
    hasta: parsed.hasta ?? prev?.hasta,
    lastImport: new Date().toISOString(),
    concostFileName: parsed.fileName,
    archivedAt: prev?.archivedAt,
    entries: parsed.entries,
    hours: prev?.hours ?? [],
    budget: prev?.budget,
    contractValue: prev?.contractValue,
    progress: prev?.progress,
    personDept: prev?.personDept,
    extDept: prev?.extDept,
    deptShare: prev?.deptShare,
  }
  return {
    db: { ...db, projects: { ...db.projects, [parsed.code]: project } },
    skipped: false,
  }
}

/**
 * Añade horas por participante: los pares (persona, mes) importados sustituyen a
 * los existentes. Si el fichero trae área técnica, pre-asigna el departamento de
 * las personas que aún no lo tengan (sin pisar lo que el usuario haya editado).
 */
export function mergeHours(
  db: DB,
  code: string,
  records: HoursRecord[],
  areaPorPersona?: Record<string, string>,
): DB {
  const p = db.projects[code]
  if (!p) return db
  const keyOf = (r: HoursRecord) => [r.persona, r.mes, r.tarea ?? ''].join('|')
  const nuevos = new Set(records.map((r) => keyOf(r)))
  const hours = [
    ...p.hours.filter((h) => !nuevos.has(keyOf(h))),
    ...records,
  ].sort(
    (a, b) =>
      a.mes.localeCompare(b.mes) ||
      a.persona.localeCompare(b.persona) ||
      (a.tarea ?? '').localeCompare(b.tarea ?? ''),
  )

  const personDept = { ...(p.personDept ?? {}) }
  if (areaPorPersona) {
    for (const [persona, area] of Object.entries(areaPorPersona)) {
      if (!personDept[persona] && area) personDept[persona] = area
    }
  }
  return { ...db, projects: { ...db.projects, [code]: { ...p, hours, personDept } } }
}

export function updateProject(db: DB, code: string, patch: Partial<Project>): DB {
  const p = db.projects[code]
  if (!p) return db
  return { ...db, projects: { ...db.projects, [code]: { ...p, ...patch } } }
}

export function deleteProject(db: DB, code: string): DB {
  const projects = { ...db.projects }
  delete projects[code]
  return { ...db, projects }
}

export function updateDepartamento(db: DB, nombre: string, patch: Partial<DepartmentModule>): DB {
  const actual = db.departamentos[nombre] ?? { departamento: nombre, roster: {}, horas: [] }
  return { ...db, departamentos: { ...db.departamentos, [nombre]: { ...actual, ...patch } } }
}

/** Sustituye las horas importadas de "produccion completa" de un departamento. */
export function setHorasProduccion(
  db: DB,
  nombre: string,
  horas: HoraProduccion[],
  fileName: string,
): DB {
  return updateDepartamento(db, nombre, { horas, lastImport: new Date().toISOString(), fileName })
}

/** Borra todos los datos importados de un departamento (horas, equipo, configuracion). */
export function deleteDepartamento(db: DB, nombre: string): DB {
  const departamentos = { ...db.departamentos }
  delete departamentos[nombre]
  return { ...db, departamentos }
}
