import type { ParsedExplotacion } from '../types.ts'
import type { ParsedHoras } from './parseHoras.ts'
import type { ParsedHorasProduccion } from './parseHorasProduccion.ts'
import type { ParseRequest, ParseResponse } from './parseWorker.ts'

/**
 * Lado cliente del worker de parseo (parseWorker.ts): manda el fichero al
 * worker y devuelve una promesa con el resultado. Si el navegador no puede
 * crear el worker, cae al parser sincrono via import dinamico (asi xlsx y los
 * parsers tampoco entran en el bundle principal).
 */

/** Omit distributivo: conserva la union discriminada por `tipo` */
type SinId<T> = T extends unknown ? Omit<T, 'id'> : never
type ParseJob = SinId<ParseRequest>

let worker: Worker | null = null
let workerRoto = false
let seq = 0
const pendientes = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()

function getWorker(): Worker | null {
  if (workerRoto) return null
  if (worker) return worker
  try {
    worker = new Worker(new URL('./parseWorker.ts', import.meta.url), { type: 'module' })
  } catch {
    workerRoto = true
    return null
  }
  worker.onmessage = (event: MessageEvent<ParseResponse>) => {
    const res = event.data
    const p = pendientes.get(res.id)
    if (!p) return
    pendientes.delete(res.id)
    if (res.ok) p.resolve(res.resultado)
    else p.reject(new Error(res.error))
  }
  worker.onerror = () => {
    // Worker irrecuperable (p.ej. no ha podido cargar el script): rechazar lo
    // pendiente y no volver a usarlo; las siguientes llamadas iran por fallback.
    workerRoto = true
    worker?.terminate()
    worker = null
    const error = new Error('WORKER_ERROR')
    for (const p of pendientes.values()) p.reject(error)
    pendientes.clear()
  }
  return worker
}

async function parsear<T>(req: ParseJob): Promise<T> {
  const w = getWorker()
  if (w) {
    try {
      return await new Promise<T>((resolve, reject) => {
        const id = ++seq
        pendientes.set(id, { resolve: (v) => resolve(v as T), reject })
        // El ArrayBuffer se transfiere (zero-copy); cada fichero trae el suyo
        w.postMessage({ ...req, id }, [req.data])
      })
    } catch (err) {
      if (!(err instanceof Error && err.message === 'WORKER_ERROR')) throw err
      // el worker ha muerto antes de responder: reintentar en sincrono
    }
  }
  return parsearSincrono<T>(req)
}

async function parsearSincrono<T>(req: ParseJob): Promise<T> {
  if (req.tipo === 'explotacion') {
    const { parseExplotacion } = await import('./parseExplotacion.ts')
    return parseExplotacion(req.data, req.fileName) as T
  }
  if (req.tipo === 'horas') {
    const { parseHoras } = await import('./parseHoras.ts')
    return parseHoras(req.data) as T
  }
  const { parseHorasProduccion } = await import('./parseHorasProduccion.ts')
  return parseHorasProduccion(req.data) as T
}

export async function parseExplotacionAsync(file: File): Promise<ParsedExplotacion> {
  return parsear({ tipo: 'explotacion', data: await file.arrayBuffer(), fileName: file.name })
}

export async function parseHorasAsync(file: File): Promise<ParsedHoras> {
  return parsear({ tipo: 'horas', data: await file.arrayBuffer() })
}

export async function parseHorasProduccionAsync(file: File): Promise<ParsedHorasProduccion> {
  return parsear({ tipo: 'horasProduccion', data: await file.arrayBuffer() })
}
