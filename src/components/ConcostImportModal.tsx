import { useRef } from 'react'

export function ConcostImportModal({
  title,
  description,
  explotacionBadge = 'Obligatorio',
  horasBadge = 'Opcional',
  onClose,
  onExplotacionFiles,
  onHorasFiles,
}: {
  title: string
  description: string
  explotacionBadge?: string
  horasBadge?: string
  onClose: () => void
  onExplotacionFiles: (files: File[]) => void
  onHorasFiles: (files: File[]) => void
}) {
  const explotacionInputRef = useRef<HTMLInputElement>(null)
  const horasInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary-950/45 p-4">
      <div className="w-full max-w-3xl rounded-xl border border-line bg-surface shadow-hover">
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <h2 className="font-display text-2xl font-extrabold text-ink">{title}</h2>
            <p className="mt-1 text-sm text-ink-soft">{description}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-lg font-bold text-ink-soft hover:bg-surface-muted"
            aria-label="Cerrar"
          >
            x
          </button>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-3">
          <button
            onClick={() => explotacionInputRef.current?.click()}
            className="text-left rounded-lg border-2 border-accent-500 bg-accent-300/20 p-5 transition-colors hover:bg-accent-300/35"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-lg font-extrabold text-ink">1. Explotación</div>
              <span className="rounded-md bg-accent-500 px-2 py-1 text-[11px] font-extrabold uppercase text-primary-950">
                {explotacionBadge}
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              En Concost: pestaña <b>Explotación</b>, marcar <b>Detalle por contrato</b> y
              exportar el Excel. Crea o actualiza facturación, gasto y movimientos.
            </p>
            <div className="mt-4 text-sm font-bold text-primary-900">
              Subir explotacion-detalle-*.xlsx
            </div>
          </button>

          <button
            onClick={() => horasInputRef.current?.click()}
            className="text-left rounded-lg border border-line bg-surface-muted p-5 transition-colors hover:border-accent-300 hover:bg-accent-300/20"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-lg font-extrabold text-ink">2. Horas</div>
              <span className="rounded-md bg-surface px-2 py-1 text-[11px] font-extrabold uppercase text-ink-muted">
                {horasBadge}
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              En Concost: pestaña <b>Horas</b>, seleccionar <b>Por Empleados</b> y marcar
              <b> Detalle</b>. Actualiza participantes, horas y ocupación.
            </p>
            <div className="mt-4 text-sm font-bold text-primary-900">
              Subir horas-empleado-detalle-*.xlsx
            </div>
          </button>

          <div className="rounded-lg border border-line bg-surface-muted p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-lg font-extrabold text-ink">3. Tareas</div>
              <span className="rounded-md bg-surface px-2 py-1 text-[11px] font-extrabold uppercase text-ink-muted">
                Opcional
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              Si exportas las horas por <b>Tareas</b>, el Excel también sirve: el sistema leerá la
              columna <b>Tarea del contrato</b> para agrupar horas, coste y personas por tarea.
            </p>
            <div className="mt-4 text-sm font-bold text-primary-900">
              Compatible con exportación por tareas
            </div>
          </div>
        </div>

        <input
          ref={explotacionInputRef}
          type="file"
          accept=".xlsx,.xls"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              onExplotacionFiles([...e.target.files])
              onClose()
            }
            e.target.value = ''
          }}
        />
        <input
          ref={horasInputRef}
          type="file"
          accept=".xlsx,.xls"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              onHorasFiles([...e.target.files])
              onClose()
            }
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
