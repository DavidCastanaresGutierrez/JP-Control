import { useRef } from 'react'
import type { ReactNode } from 'react'

function Badge({ kind, children }: { kind: 'required' | 'optional'; children: string }) {
  return (
    <span
      className={`rounded-md px-2 py-1 text-[11px] font-extrabold uppercase ${
        kind === 'required' ? 'bg-accent-500 text-primary-950' : 'bg-surface text-ink-muted'
      }`}
    >
      {children}
    </span>
  )
}

function ImportCard({
  step,
  title,
  badge,
  badgeKind,
  children,
  action,
  onClick,
}: {
  step: string
  title: string
  badge: string
  badgeKind: 'required' | 'optional'
  children: ReactNode
  action: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-full flex-col justify-between rounded-lg border p-5 text-left transition-colors ${
        badgeKind === 'required'
          ? 'border-accent-500 bg-accent-300/20 hover:bg-accent-300/35'
          : 'border-line bg-surface-muted hover:border-accent-300 hover:bg-accent-300/20'
      }`}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-extrabold text-ink">{step}</div>
            <div className="text-lg font-extrabold leading-tight text-ink">{title}</div>
          </div>
          <Badge kind={badgeKind}>{badge}</Badge>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">{children}</p>
      </div>
      <div className="mt-4 text-sm font-bold text-primary-900">{action}</div>
    </button>
  )
}

export function ConcostImportModal({
  title,
  description,
  onClose,
  onExplotacionFiles,
  onHorasFiles,
}: {
  title: string
  description: string
  onClose: () => void
  onExplotacionFiles: (files: File[]) => void
  onHorasFiles: (files: File[]) => void
}) {
  const explotacionInputRef = useRef<HTMLInputElement>(null)
  const horasEmpleadoInputRef = useRef<HTMLInputElement>(null)
  const horasTareasInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = (
    files: FileList | null,
    handler: (files: File[]) => void,
    input: HTMLInputElement,
  ) => {
    if (files && files.length > 0) handler([...files])
    input.value = ''
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary-950/45 p-4">
      <div className="w-full max-w-4xl rounded-xl border border-line bg-surface shadow-hover">
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <h2 className="font-display text-2xl font-extrabold text-ink">{title}</h2>
            <p className="mt-1 text-sm text-ink-soft">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-lg font-bold text-ink-soft hover:bg-surface-muted"
            aria-label="Cerrar"
          >
            x
          </button>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-3">
          <ImportCard
            step="1."
            title="Explotacion"
            badge="Obligatorio"
            badgeKind="required"
            action="Subir explotacion-detalle-*.xlsx"
            onClick={() => explotacionInputRef.current?.click()}
          >
            En Concost: pestana <b>Explotacion</b>, marcar <b>Detalle por contrato</b> y exportar el
            Excel. Crea o actualiza facturacion, gasto y movimientos.
          </ImportCard>

          <ImportCard
            step="2."
            title="Horas por empleado"
            badge="Opcional"
            badgeKind="optional"
            action="Subir horas-empleado-detalle-*.xlsx"
            onClick={() => horasEmpleadoInputRef.current?.click()}
          >
            En Concost: pestana <b>Horas</b>, seleccionar <b>Por Empleados</b> y marcar{' '}
            <b>Detalle</b>. Actualiza participantes, horas y ocupacion.
          </ImportCard>

          <ImportCard
            step="3."
            title="Horas por tareas"
            badge="Opcional"
            badgeKind="optional"
            action="Subir exportacion de horas por tareas"
            onClick={() => horasTareasInputRef.current?.click()}
          >
            En Concost: pestana <b>Horas</b>, seleccionar <b>Por Tareas</b> y marcar{' '}
            <b>Detalle</b>. Lee la columna <b>Tarea del contrato</b> para agrupar coste, horas y
            personas por tarea.
          </ImportCard>
        </div>

        <input
          ref={explotacionInputRef}
          type="file"
          accept=".xlsx,.xls"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files, onExplotacionFiles, e.currentTarget)}
        />
        <input
          ref={horasEmpleadoInputRef}
          type="file"
          accept=".xlsx,.xls"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files, onHorasFiles, e.currentTarget)}
        />
        <input
          ref={horasTareasInputRef}
          type="file"
          accept=".xlsx,.xls"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files, onHorasFiles, e.currentTarget)}
        />
      </div>
    </div>
  )
}
