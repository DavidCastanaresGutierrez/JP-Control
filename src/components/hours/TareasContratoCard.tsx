import type { TareaContratoResumen } from '../../lib/metrics'
import { fmtEur, fmtNum } from '../../lib/format'

/** Tareas del contrato agrupadas desde la columna "Tarea del contrato" del Excel */
export function TareasContratoCard({
  hayTareas,
  nTareasTotal,
  tareasVisibles,
  tareaSeleccionada,
  onSeleccionarTarea,
}: {
  hayTareas: boolean
  nTareasTotal: number
  tareasVisibles: TareaContratoResumen[]
  tareaSeleccionada: string | null
  onSeleccionarTarea: (tarea: string) => void
}) {
  return (
    <div className="bg-surface rounded-[24px] shadow-soft border border-line p-4 sm:p-6 space-y-4">
      <div>
        <h3 className="font-bold text-ink text-lg">Tareas del contrato</h3>
        <p className="text-xs text-ink-soft">
          Agrupadas desde la columna <b>Tarea del contrato</b> del Excel. Haz clic en una
          tarea para seleccionar las personas vinculadas y verlas juntas en la tabla de
          participantes.
        </p>
      </div>

      {hayTareas ? (
        <>
          <div className="flex items-center justify-between gap-2 text-xs text-ink-soft">
            <span>
              {tareasVisibles.length} tareas visibles de {nTareasTotal}
            </span>
            <span>
              {fmtNum(tareasVisibles.reduce((s, t) => s + t.horas, 0))} h -{' '}
              {fmtEur(tareasVisibles.reduce((s, t) => s + t.coste, 0))}
            </span>
          </div>

          <div className="max-h-[560px] overflow-auto rounded-[18px] border border-line">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface">
                <tr className="text-[11px] text-ink-muted uppercase tracking-wide">
                  <th className="text-left px-3 py-2 font-bold border-b border-line">Tarea</th>
                  <th className="text-right px-3 py-2 font-bold border-b border-line">Horas</th>
                  <th className="text-right px-3 py-2 font-bold border-b border-line">Coste</th>
                  <th className="text-right px-3 py-2 font-bold border-b border-line">Personas</th>
                </tr>
              </thead>
              <tbody>
                {tareasVisibles.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-sm text-ink-soft">
                      No hay tareas con personas para esta combinacion de filtros.
                    </td>
                  </tr>
                )}
                {tareasVisibles.map((t) => {
                  const activo = tareaSeleccionada === t.tarea
                  return (
                    <tr
                      key={t.tarea}
                      onClick={() => onSeleccionarTarea(t.tarea)}
                      className={`border-t border-line cursor-pointer transition-colors hover:bg-surface-muted ${
                        activo ? 'bg-accent-300/18' : ''
                      }`}
                    >
                      <td className={`px-3 py-2 ${activo ? 'font-bold' : ''}`}>{t.tarea}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(t.horas)} h</td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold">
                        {fmtEur(t.coste)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-ink-soft">
                        {t.personas.length}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-ink-muted">
            Selecciona una tarea para centrar esas personas en la tabla de participantes y en la
            grafica. Si escoges un departamento o una persona, esta lista se reduce a sus
            tareas.
          </p>
        </>
      ) : (
        <div className="rounded-[18px] border border-dashed border-line p-4 text-sm text-ink-soft bg-surface-muted/40">
          Aun no hay tareas visibles con este proyecto. Si acabas de actualizar la app, vuelve a
          importar el Excel de horas para que se lean las columnas de tarea y aparezca este panel.
        </div>
      )}
    </div>
  )
}
