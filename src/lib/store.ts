import type { DB, HoursRecord, ParsedExplotacion, Project } from '../types'

const KEY = 'jp-control-db-v1'

export function loadDB(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as DB
  } catch {
    // localStorage corrupto: empezamos de cero
  }
  return { projects: {} }
}

export function saveDB(db: DB) {
  localStorage.setItem(KEY, JSON.stringify(db))
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
    db: { projects: { ...db.projects, [parsed.code]: project } },
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
  const nuevos = new Set(records.map((r) => `${r.persona}|${r.mes}`))
  const hours = [
    ...p.hours.filter((h) => !nuevos.has(`${h.persona}|${h.mes}`)),
    ...records,
  ].sort((a, b) => a.mes.localeCompare(b.mes) || a.persona.localeCompare(b.persona))

  const personDept = { ...(p.personDept ?? {}) }
  if (areaPorPersona) {
    for (const [persona, area] of Object.entries(areaPorPersona)) {
      if (!personDept[persona] && area) personDept[persona] = area
    }
  }
  return { projects: { ...db.projects, [code]: { ...p, hours, personDept } } }
}

export function updateProject(db: DB, code: string, patch: Partial<Project>): DB {
  const p = db.projects[code]
  if (!p) return db
  return { projects: { ...db.projects, [code]: { ...p, ...patch } } }
}

export function deleteProject(db: DB, code: string): DB {
  const projects = { ...db.projects }
  delete projects[code]
  return { projects }
}

export function exportJSON(db: DB): string {
  return JSON.stringify(db, null, 2)
}

export function importJSON(raw: string): DB {
  const parsed = JSON.parse(raw) as DB
  if (!parsed || typeof parsed.projects !== 'object') {
    throw new Error('El fichero no es una copia de seguridad válida.')
  }
  return parsed
}
