import { useStore } from '../lib/store.ts'
import type { EstadoNube } from '../lib/store.ts'

const ETIQUETAS: Record<EstadoNube, { texto: string; punto: string }> = {
  local: { texto: 'Solo local', punto: 'bg-ink-muted' },
  sincronizando: { texto: 'Sincronizando…', punto: 'bg-warning animate-pulse' },
  sincronizado: { texto: 'Sincronizado', punto: 'bg-success' },
  error: { texto: 'Error de sincronización', punto: 'bg-danger' },
  offline: { texto: 'Sin conexión', punto: 'bg-ink-muted' },
}

export function BarraSync() {
  const { estadoNube, aviso, descartarAviso, sincronizarAhora } = useStore()
  const info = ETIQUETAS[estadoNube]

  return (
    <div className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
        <div className="lg:hidden font-display font-bold">Brújula</div>
        <div className="ml-auto flex items-center gap-2 text-xs text-ink-soft">
          <span className={`inline-block h-2 w-2 rounded-full ${info.punto}`} />
          <span>{info.texto}</span>
          {(estadoNube === 'error' || estadoNube === 'offline') && (
            <button onClick={sincronizarAhora} className="ml-1 rounded px-1.5 py-0.5 font-medium text-salud hover:underline">
              Reintentar
            </button>
          )}
        </div>
      </div>
      {aviso && (
        <div className="bg-warning/15 px-4 py-2 text-sm text-ink sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
            <span>{aviso}</span>
            <button onClick={descartarAviso} className="text-ink-muted hover:text-ink" aria-label="Descartar">
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
