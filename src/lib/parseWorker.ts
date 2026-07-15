import { parseExplotacion } from './parseExplotacion.ts'
import { parseHoras } from './parseHoras.ts'
import { parseHorasProduccion } from './parseHorasProduccion.ts'

/**
 * Web Worker de parseo de Excel: XLSX.read + sheet_to_json son sincronos y con
 * ficheros grandes congelarian la UI, asi que corren aqui fuera del hilo
 * principal. Ver parseInWorker.ts para el lado cliente.
 */

export type ParseRequest =
  | { id: number; tipo: 'explotacion'; data: ArrayBuffer; fileName: string }
  | { id: number; tipo: 'horas'; data: ArrayBuffer }
  | { id: number; tipo: 'horasProduccion'; data: ArrayBuffer }

export type ParseResponse =
  | { id: number; ok: true; resultado: unknown }
  | { id: number; ok: false; error: string }

// En un worker `self` es DedicatedWorkerGlobalScope, no Window (lib DOM)
declare const self: {
  onmessage: ((event: MessageEvent<ParseRequest>) => void) | null
  postMessage(message: ParseResponse): void
}

self.onmessage = (event: MessageEvent<ParseRequest>) => {
  const req = event.data
  try {
    const resultado =
      req.tipo === 'explotacion'
        ? parseExplotacion(req.data, req.fileName)
        : req.tipo === 'horas'
          ? parseHoras(req.data)
          : parseHorasProduccion(req.data)
    self.postMessage({ id: req.id, ok: true, resultado })
  } catch (err) {
    self.postMessage({
      id: req.id,
      ok: false,
      error: err instanceof Error ? err.message : 'Error al leer el fichero.',
    })
  }
}
