import { useMemo, useState } from 'react'
import type { Project } from '../types'
import { horasDePersonas } from '../lib/metrics'
import { DeptAssignment } from './DeptAssignment'

function NumInput({
  label,
  value,
  onChange,
  suffix,
  hint,
}: {
  label: string
  value: number | undefined
  onChange: (v: number | undefined) => void
  suffix: string
  hint?: string
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-ink">{label}</span>
      {hint && <span className="block text-xs text-ink-soft">{hint}</span>}
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number"
          min={0}
          step="any"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          className="w-48 border border-line rounded-[10px] px-3 py-2 text-sm text-ink focus:ring-2 focus:ring-accent-500/40 focus:border-accent-500 outline-none"
        />
        <span className="text-sm text-ink-soft">{suffix}</span>
      </div>
    </label>
  )
}

export function Ajustes({
  project,
  onUpdate,
  onArchiveToggle,
  onDelete,
}: {
  project: Project
  onUpdate: (patch: Partial<Project>) => void
  onArchiveToggle: () => void
  onDelete: () => void
}) {
  const [confirm, setConfirm] = useState(false)

  const participantes = useMemo(() => {
    const nombres = new Set(horasDePersonas(project.hours).map((h) => h.persona))
    return [...nombres].sort((a, b) => a.localeCompare(b, 'es'))
  }, [project.hours])
  const jpFueraDeLista = Boolean(project.jp) && !participantes.includes(project.jp as string)

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="grid xl:grid-cols-[22rem_1fr] gap-6 items-start">
        <div className="bg-surface rounded-[24px] shadow-soft border border-line p-6 space-y-5">
          <h3 className="font-bold text-ink text-lg">Parametros del proyecto</h3>
          <NumInput
            label="Importe de contrato (honorarios)"
            hint="Contra esto se mide el % facturado, el indicador principal del panel."
            value={project.contractValue}
            onChange={(v) => onUpdate({ contractValue: v })}
            suffix="EUR"
          />
          <NumInput
            label="Presupuesto de coste"
            hint="Coste maximo previsto para ejecutar el trabajo; contra esto se mide el % de gasto (referencia secundaria)."
            value={project.budget}
            onChange={(v) => onUpdate({ budget: v })}
            suffix="EUR"
          />
          <NumInput
            label="Avance tecnico estimado"
            hint="Actualizalo cada mes: es la referencia contra la que se comparan facturacion y gasto."
            value={project.progress}
            onChange={(v) =>
              onUpdate({ progress: v === undefined ? undefined : Math.min(100, Math.max(0, v)) })
            }
            suffix="%"
          />
          <label className="block">
            <span className="text-sm font-semibold text-ink">Jefe de proyecto (JP)</span>
            <span className="block text-xs text-ink-soft">
              Elige el JP entre los participantes. Luego puedes filtrar por su nombre en Tu cartera.
            </span>
            <select
              value={project.jp ?? ''}
              onChange={(e) => onUpdate({ jp: e.target.value || undefined })}
              disabled={participantes.length === 0 && !jpFueraDeLista}
              className="mt-1 w-full border border-line rounded-[10px] px-3 py-2 text-sm bg-surface text-ink focus:ring-2 focus:ring-accent-500/40 focus:border-accent-500 outline-none disabled:opacity-60"
            >
              <option value="">- Sin asignar -</option>
              {participantes.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
              {jpFueraDeLista && <option value={project.jp}>{project.jp}</option>}
            </select>
            {participantes.length === 0 && !jpFueraDeLista && (
              <span className="mt-1 block text-xs text-ink-muted">
                Importa el fichero de Horas para ver los participantes.
              </span>
            )}
          </label>
        </div>

        <DeptAssignment project={project} onUpdate={onUpdate} />
      </div>

      <div className="max-w-2xl">
        <div className="mb-4 rounded-[20px] border border-line bg-surface p-4 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-ink">
                {project.archivedAt ? 'Proyecto archivado' : 'Archivar proyecto'}
              </h3>
              <p className="mt-0.5 text-xs text-ink-soft">
                {project.archivedAt
                  ? 'Este proyecto esta fuera de la vista de activos. Puedes reactivarlo cuando lo necesites.'
                  : 'Mueve el proyecto a Archivados cuando este terminado. No se borran sus datos.'}
              </p>
            </div>
            <button
              onClick={onArchiveToggle}
              className={`inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-bold transition-colors ${
                project.archivedAt
                  ? 'border border-line bg-surface text-ink-soft hover:bg-surface-muted'
                  : 'bg-primary-800 text-white hover:bg-primary-900'
              }`}
            >
              {project.archivedAt ? 'Reactivar proyecto' : 'Archivar proyecto'}
            </button>
          </div>
        </div>

        {confirm ? (
          <div className="bg-danger/8 border border-danger/25 rounded-[20px] p-4">
            <p className="text-sm text-danger font-semibold">
              Seguro que quieres eliminar "{project.name}"?
            </p>
            <p className="text-xs text-danger/75 mt-0.5 mb-3">
              Se borraran el proyecto y todos sus datos de este navegador. No se puede deshacer.
            </p>
            <div className="flex gap-2">
              <button
                onClick={onDelete}
                className="text-sm font-bold bg-danger text-white rounded-full px-4 h-10 hover:opacity-90 transition-opacity"
              >
                Si, eliminar
              </button>
              <button
                onClick={() => setConfirm(false)}
                className="text-sm font-semibold border border-line bg-surface text-ink-soft rounded-full px-4 h-10 hover:bg-surface-muted transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-[20px] border border-line bg-surface p-4 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-ink">Eliminar proyecto</h3>
                <p className="mt-0.5 text-xs text-ink-soft">
                  Borra el proyecto y todos sus datos de este navegador. No se puede deshacer.
                </p>
              </div>
              <button
                onClick={() => setConfirm(true)}
                className="inline-flex h-10 items-center justify-center rounded-full bg-danger px-4 text-sm font-bold text-white transition-opacity hover:opacity-90"
              >
                Eliminar proyecto
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
