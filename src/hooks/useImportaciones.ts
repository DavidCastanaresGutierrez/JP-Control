import type { Dispatch, SetStateAction } from 'react'
import type { DB } from '../types'
import { mergeHours, setHorasProduccion, upsertExplotacion } from '../lib/store'
import { parseExplotacionAsync, parseHorasAsync, parseHorasProduccionAsync } from '../lib/parseInWorker'
import type { ParsedHoras } from '../lib/parseHoras'
import type { ToastKind } from './useToasts'

/**
 * Flujos de importacion de ficheros de Concost (explotacion, horas por
 * proyecto y horas de produccion por departamento). El parseo corre en el
 * Web Worker; aqui viven la validacion contra el estado actual y los avisos.
 */
export function useImportaciones(opts: {
  db: DB
  setDb: Dispatch<SetStateAction<DB>>
  selected: string | null
  setSelected: (code: string | null) => void
  miDepartamento: string | null
  toast: (kind: ToastKind, text: string) => void
}) {
  const { db, setDb, selected, setSelected, miDepartamento, toast } = opts

  /** Incorpora unas horas parseadas al proyecto `code` y emite el resumen/avisos. */
  const aplicarHorasImportadas = (base: DB, code: string, f: File, parsed: ParsedHoras): DB => {
    const next = mergeHours(base, code, parsed.records, parsed.areaPorPersona)
    const personas = new Set(parsed.records.map((r) => r.persona)).size
    const total = parsed.records.reduce((s, r) => s + r.horas, 0)
    toast('ok', `${f.name}: ${total.toLocaleString('es-ES')} h de ${personas} participantes importadas.`)
    parsed.warnings.forEach((w) => toast('warn', `${f.name}: ${w}`))
    return next
  }

  const handleExplotacionFiles = async (files: File[]) => {
    let next = db
    let lastCode: string | null = null
    for (const f of files) {
      try {
        const parsed = await parseExplotacionAsync(f)
        const res = upsertExplotacion(next, parsed)
        if (res.skipped) {
          toast('warn', `${f.name}: ya hay datos mas recientes de ${parsed.code}; no se ha importado.`)
          continue
        }
        next = res.db
        lastCode = parsed.code
        toast('ok', `${parsed.code}: ${parsed.entries.length} apuntes importados.`)
        parsed.warnings.forEach((w) => toast('warn', `${parsed.code}: ${w}`))
      } catch (err) {
        toast('error', `${f.name}: ${err instanceof Error ? err.message : 'error al leer el fichero'}`)
      }
    }
    setDb(next)
    if (lastCode) setSelected(lastCode)
  }

  const handleConcostFiles = async (files: File[]) => {
    if (!selected) return

    let next = db
    for (const f of files) {
      const name = f.name.toLowerCase()
      try {
        if (name.includes('explotacion')) {
          const parsed = await parseExplotacionAsync(f)
          if (parsed.code !== selected) {
            toast('error', `${f.name}: es del proyecto ${parsed.code}, no de ${selected}; no se ha importado.`)
            continue
          }
          const res = upsertExplotacion(next, parsed)
          if (res.skipped) {
            toast('warn', `${f.name}: ya hay datos mas recientes de ${parsed.code}; no se ha importado.`)
            continue
          }
          next = res.db
          toast('ok', `${parsed.code}: explotacion actualizada con ${parsed.entries.length} apuntes.`)
          parsed.warnings.forEach((w) => toast('warn', `${parsed.code}: ${w}`))
          continue
        }

        const parsed = await parseHorasAsync(f)
        if (parsed.code && parsed.code !== selected) {
          toast('error', `${f.name}: es del proyecto ${parsed.code}, no de ${selected}; no se ha importado.`)
          continue
        }
        next = aplicarHorasImportadas(next, selected, f, parsed)
      } catch (err) {
        toast('error', `${f.name}: ${err instanceof Error ? err.message : 'error al leer el fichero'}`)
      }
    }
    setDb(next)
  }

  const handleOverviewHoursFiles = async (files: File[]) => {
    let next = db
    for (const f of files) {
      try {
        const parsed = await parseHorasAsync(f)
        if (!parsed.code) {
          toast('error', `${f.name}: no se ha podido identificar el proyecto. Sube primero el fichero de Explotacion.`)
          continue
        }
        if (!next.projects[parsed.code]) {
          toast('error', `${f.name}: primero importa Explotacion para crear el proyecto ${parsed.code}.`)
          continue
        }
        next = aplicarHorasImportadas(next, parsed.code, f, parsed)
      } catch (err) {
        toast('error', `${f.name}: ${err instanceof Error ? err.message : 'error al leer el fichero'}`)
      }
    }
    setDb(next)
  }

  const handleImportHorasProduccion = async (file: File) => {
    if (!miDepartamento) return
    try {
      const parsed = await parseHorasProduccionAsync(file)
      setDb((d) => setHorasProduccion(d, miDepartamento, parsed.horas, file.name))
      toast(
        'ok',
        `${file.name}: ${parsed.horas.length.toLocaleString('es-ES')} apuntes de ${parsed.personas.length} personas importados.`,
      )
      parsed.warnings.forEach((w) => toast('warn', w))
    } catch (err) {
      toast('error', `${file.name}: ${err instanceof Error ? err.message : 'error al leer el fichero'}`)
    }
  }

  return { handleExplotacionFiles, handleConcostFiles, handleOverviewHoursFiles, handleImportHorasProduccion }
}
