import type { ControlDepartamentos } from '../../lib/metrics'
import { SIN_DEPT } from '../../lib/metrics'
import { fmtEur, fmtNum, fmtPct } from '../../lib/format'

/** Control por departamento: reparto del presupuesto y consumo real */
export function ControlDepartamentosCard({
  control,
  filasControlVisibles,
  totalControlVisible,
  departamentoSeleccionado,
  onSeleccionarDepartamento,
  onSetShare,
  estaFiltrado,
  nPersonasVisibles,
  deptSeleccionadosTexto,
  personaSeleccionada,
  tareaSeleccionada,
}: {
  control: ControlDepartamentos
  filasControlVisibles: ControlDepartamentos['filas']
  totalControlVisible: { asignado: number; share: number; coste: number; horas: number }
  departamentoSeleccionado: string | null
  onSeleccionarDepartamento: (dept: string) => void
  onSetShare: (dept: string, pct: number | undefined) => void
  estaFiltrado: boolean
  nPersonasVisibles: number
  deptSeleccionadosTexto: string
  personaSeleccionada: string | null
  tareaSeleccionada: string | null
}) {
  return (
    <div className="bg-surface rounded-[24px] shadow-soft border border-line p-4 sm:p-6 space-y-5">
      <div>
        <h3 className="font-bold text-ink text-lg">Control por departamento</h3>
        <p className="text-xs text-ink-soft">
          Asigna a cada persona su departamento y que % del presupuesto le corresponde. La
          ultima columna es <b>presupuesto consumido / asignado</b>: por debajo de 100 % va
          dentro de su parte; por encima (rojo) se esta pasando.
        </p>
        {estaFiltrado && (
          <p className="mt-1 text-[11px] font-medium text-ink-soft">
            Filtrado por <span className="font-bold text-ink">{nPersonasVisibles} personas</span>
            {deptSeleccionadosTexto && (
              <>
                {' '}
                de <span className="font-bold text-ink">{deptSeleccionadosTexto}</span>
              </>
            )}
            {personaSeleccionada && (
              <>
                {' '}
                para <span className="font-bold text-ink">{personaSeleccionada}</span>
              </>
            )}
            {tareaSeleccionada && (
              <>
                {' '}
                con tarea <span className="font-bold text-ink">{tareaSeleccionada}</span>
              </>
            )}
            .
          </p>
        )}
      </div>

      {/* Tabla de reparto y control */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] text-ink-muted uppercase tracking-wide">
              <th className="text-left px-3 py-2 font-bold border-b border-line">Departamento</th>
              <th className="text-right px-3 py-2 font-bold border-b border-line">% del total</th>
              <th className="text-right px-3 py-2 font-bold border-b border-line">Presup. asignado</th>
              <th className="text-right px-3 py-2 font-bold border-b border-line">
                Coste real{control.costeEstimado ? ' *' : ''}
              </th>
              <th className="text-right px-3 py-2 font-bold border-b border-line">Horas</th>
              <th className="text-right px-3 py-2 font-bold border-b border-line">% real</th>
              <th className="px-3 py-2 font-bold w-56 border-b border-line">Coste real / asignado</th>
            </tr>
          </thead>
          <tbody>
            {filasControlVisibles.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-ink-soft">
                  No hay departamentos con personas para esta combinacion de filtros.
                </td>
              </tr>
            )}
            {filasControlVisibles.map((f) => {
              const barColor =
                f.estado === 'exceso'
                  ? 'bg-danger'
                  : f.estado === 'atencion'
                    ? 'bg-warning'
                    : 'bg-success'
              const estadoTexto =
                f.estado === 'exceso'
                  ? 'text-danger'
                  : f.estado === 'atencion'
                    ? 'text-[#8A5A00]'
                    : 'text-success'
              return (
                <tr
                  key={f.dept}
                  className={`border-t border-line transition-colors ${
                    departamentoSeleccionado === f.dept ? 'bg-accent-300/18' : ''
                  }`}
                >
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onSeleccionarDepartamento(f.dept)}
                      className="text-left w-full group"
                    >
                      <div className="font-semibold text-ink group-hover:underline">
                        {f.dept}
                        {f.estado === 'exceso' && <span className="ml-1.5">!</span>}
                      </div>
                      <div className="text-[11px] text-ink-muted">
                        {f.personas.length} {f.personas.length === 1 ? 'persona' : 'personas'}
                      </div>
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {f.dept === SIN_DEPT ? (
                      <span className="text-ink-muted">-</span>
                    ) : (
                      <div className="inline-flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="any"
                          value={f.share ?? ''}
                          onChange={(e) =>
                            onSetShare(
                              f.dept,
                              e.target.value === '' ? undefined : Number(e.target.value),
                            )
                          }
                          className="w-16 text-right border border-line rounded-[10px] px-2 py-1 text-ink focus:ring-2 focus:ring-accent-500/40 focus:border-accent-500 outline-none"
                        />
                        <span className="text-ink-muted">%</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-soft">
                    {f.asignado !== null ? fmtEur(f.asignado) : '-'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-ink">
                    {control.hayCoste ? fmtEur(f.coste) : <span className="text-ink-muted">-</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-ink">
                    {fmtNum(f.horas)} h
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-soft">
                    {f.pctCosteReal !== null ? fmtPct(f.pctCosteReal) : '-'}
                  </td>
                  <td className="px-3 py-2">
                    {f.consumidoPct !== null ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2.5 rounded-full bg-surface-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full ${barColor}`}
                            style={{ width: `${Math.min(100, f.consumidoPct)}%` }}
                          />
                        </div>
                        <span className={`text-xs font-bold tabular-nums ${estadoTexto}`}>
                          {fmtPct(f.consumidoPct)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-ink-muted">
                        {f.dept === SIN_DEPT
                          ? 'gasto sin departamento'
                          : f.share === null
                            ? 'define su %'
                            : f.share === 0
                              ? '0 % asignado'
                              : 'define presupuesto y horas'}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-line-strong font-bold text-ink">
              <td className="px-3 py-2">
                Total
                <span
                  className={`ml-2 text-[11px] font-medium ${
                    totalControlVisible.share > 0 && Math.abs(totalControlVisible.share - 100) > 0.5
                      ? 'text-[#8A5A00]'
                      : 'text-ink-muted'
                  }`}
                >
                  ({fmtPct(totalControlVisible.share)} asignado)
                </span>
              </td>
              <td />
              <td className="px-3 py-2 text-right tabular-nums text-ink-soft">
                {totalControlVisible.asignado > 0 ? fmtEur(totalControlVisible.asignado) : '-'}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {control.hayCoste ? fmtEur(totalControlVisible.coste) : <span className="text-ink-muted">-</span>}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtNum(totalControlVisible.horas)} h</td>
              <td />
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {control.costeEstimado && (
        <p className="text-xs rounded-[14px] px-4 py-2.5 bg-surface-muted text-ink-soft">
          <b>*</b> Las horas cargadas no traen coste por persona, asi que el consumido se{' '}
          <b>estima</b> repartiendo el coste de personal del proyecto (cuenta 9101 de la
          explotacion) segun las horas de cada departamento. Para el consumo exacto por persona,
          reimporta el "Detalle de horas por empleado" del ERP (trae la columna Coste).
        </p>
      )}
      {!control.hayCoste && (
        <p className="text-xs rounded-[14px] px-4 py-2.5 bg-surface-muted text-ink-soft">
          Para calcular el consumido por departamento hace falta el coste de personal: importa el
          detalle de explotacion (cuenta 9101) y las horas por empleado.
        </p>
      )}
      {control.presupuesto === null && (
        <p className="text-xs rounded-[14px] px-4 py-2.5 bg-surface-muted text-ink-soft">
          Define el presupuesto de coste (o el importe de contrato) en la pestana Configuracion para
          ver el presupuesto asignado y el % de consumo por departamento.
        </p>
      )}
      {control.hayShares && Math.abs(control.sumaShares - 100) > 0.5 && (
        <p className="text-xs rounded-[14px] px-4 py-2.5 bg-warning/12 text-[#8A5A00]">
          Los porcentajes asignados suman {fmtPct(control.sumaShares)}. Ajustalos hasta 100 %
          para repartir todo el presupuesto.
        </p>
      )}

      <p className="text-xs text-ink-muted">
        La asignacion de personas y facturas a departamentos se hace en la pestana Configuracion.
      </p>
    </div>
  )
}
