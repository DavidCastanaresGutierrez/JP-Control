import type { Project } from '../types'
import { repairMojibake } from './format'

function normalizarTexto(value: string): string {
  return repairMojibake(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

function tokensNombre(value: string): string[] {
  return normalizarTexto(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((token) => token.length > 1)
}

/** Determina si el usuario logueado figura como JP del proyecto, cotejando nombre y email. */
export function esJpDelUsuario(project: Project, userName?: string, userEmail?: string): boolean {
  if (!project.jp) return false
  const jp = new Set(tokensNombre(project.jp))
  if (jp.size === 0) return false

  const usuario = new Set(tokensNombre(userName ?? ''))
  let comunes = 0
  for (const token of jp) if (usuario.has(token)) comunes++
  if (jp.size === 1 ? comunes >= 1 : comunes >= 2) return true

  // Red de seguridad: emails tipo "dcastanares" contienen el apellido del JP.
  const emailLocal = normalizarTexto((userEmail ?? '').split('@')[0]).replace(/[^a-z0-9]+/g, '')
  return emailLocal.length >= 4 && [...jp].some((token) => token.length >= 4 && emailLocal.includes(token))
}

/** El usuario ha marcado el proyecto para seguirlo sin ser su JP. */
export function esSeguidoPorUsuario(project: Project, userEmail?: string): boolean {
  const email = (userEmail ?? '').trim().toLowerCase()
  if (!email) return false
  return (project.watchers ?? []).includes(email)
}
