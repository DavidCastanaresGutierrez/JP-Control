import type { DB } from '../types'

const PROJECT_ORDER_KEY = 'jp-control-project-order-v1'
const MI_DEPARTAMENTO_KEY = 'jp-control-mi-departamento-v1'

export function loadProjectOrder(): string[] {
  try {
    const raw = localStorage.getItem(PROJECT_ORDER_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function persistProjectOrder(order: string[]): void {
  try {
    localStorage.setItem(PROJECT_ORDER_KEY, JSON.stringify(order))
  } catch {
    // sin espacio en localStorage: el orden de proyectos no es critico, se ignora
  }
}

export function loadMiDepartamento(): string | null {
  try {
    return localStorage.getItem(MI_DEPARTAMENTO_KEY)
  } catch {
    return null
  }
}

export function persistMiDepartamento(departamento: string | null): void {
  try {
    if (departamento) localStorage.setItem(MI_DEPARTAMENTO_KEY, departamento)
    else localStorage.removeItem(MI_DEPARTAMENTO_KEY)
  } catch {
    // sin espacio en localStorage: no es critico, se ignora
  }
}

export function orderProjects(projects: DB['projects'], order: string[]) {
  const listed = new Set(order)
  const ordered = order.map((code) => projects[code]).filter(Boolean)
  const remaining = Object.values(projects)
    .filter((project) => !listed.has(project.code))
    .sort((a, b) => a.name.localeCompare(b.name))
  return [...ordered, ...remaining]
}

export function moveCode(codes: string[], draggedCode: string, targetCode: string) {
  const from = codes.indexOf(draggedCode)
  const to = codes.indexOf(targetCode)
  if (from < 0 || to < 0 || from === to) return codes
  const next = [...codes]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}
