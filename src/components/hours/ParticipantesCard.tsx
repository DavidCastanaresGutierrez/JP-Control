import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { MatrizHoras } from '../../lib/metrics'
import { fmtEur, fmtMes, fmtNum } from '../../lib/format'
import { emoji } from '../../lib/emoji'
import { EmojiIcon } from '../../lib/EmojiIcon'
import { ANOMALIA_STYLE, CHART_AXIS, CHART_GRID, TOOLTIP_STYLE } from './theme'

export type Medida = 'horas' | 'ocupacion' | 'coste'
export type OrdenMes = { mes: string; dir: 'desc' | 'asc' } | null

/** Horas por participante: grafica de evolucion + matriz persona x mes con anomalias */
export function ParticipantesCard({
  hayHoras,
  nAnomalias,
  matrizParticipantes,
  personasSel,
  personasBuscadas,
  chartData,
  medida,
  onMedida,
  busquedaPersona,
  onBusquedaPersona,
  ordenMes,
  onOrdenMes,
  seleccion,
  onTogglePersona,
  onLimpiar,
  colorFor,
  ocupacion,
  jornadaMes,
  sinTarifa,
}: {
  hayHoras: boolean
  nAnomalias: number
  matrizParticipantes: MatrizHoras
  personasSel: MatrizHoras['filas']
  personasBuscadas: MatrizHoras['filas']
  chartData: Array<Record<string, number | string>>
  medida: Medida
  onMedida: (medida: Medida) => void
  busquedaPersona: string
  onBusquedaPersona: (value: string) => void
  ordenMes: OrdenMes
  onOrdenMes: (update: (prev: OrdenMes) => OrdenMes) => void
  seleccion: Set<string>
  onTogglePersona: (persona: string) => void
  onLimpiar: () => void
  colorFor: (persona: string) => string
  ocupacion: (horas: number | null, i: number) => number
  jornadaMes: number[]
  sinTarifa: MatrizHoras['filas']
}) {
  return (
    <div className="bg-surface rounded-[24px] shadow-soft border border-line p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-bold text-ink text-lg">Horas por participante</h3>
          <p className="text-xs text-ink-soft">
            El detalle de explotacion no desglosa por persona: importa aqui el listado de horas
            por empleado y mes. Haz clic en un participante, un departamento o una tarea para
            ver su evolucion en la grafica.
          </p>
        </div>
        {(
          <span
            className={`text-xs font-bold rounded-full px-3 py-1 ${
              nAnomalias > 0 ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'
            }`}
          >
            {nAnomalias === 0
              ? 'Sin anomalias'
              : nAnomalias === 1
                ? '1 anomalia detectada'
                : `${nAnomalias} anomalias detectadas`}
          </span>
        )}
      </div>

      {hayHoras && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-ink-soft">
              {personasSel.length === 0 ? (
                'Haz clic en un participante de la tabla para ver su evolucion de horas.'
              ) : (
                <>
                  Mostrando{' '}
                  <span className="font-bold text-ink">
                    {personasSel.length === 1
                      ? personasSel[0].persona
                      : `${personasSel.length} participantes`}
                  </span>
                  . Haz clic en una persona para filtrar sus tareas y departamento.
                </>
              )}
            </p>
            <div className="flex items-center gap-2 text-xs">
              <input
                type="text"
                value={busquedaPersona}
                onChange={(e) => onBusquedaPersona(e.target.value)}
                placeholder="Buscar persona..."
                className="border border-line rounded-full px-3 py-1 text-ink placeholder:text-ink-muted focus:ring-2 focus:ring-accent-500/40 focus:border-accent-500 outline-none"
              />
              <div className="flex rounded-full border border-line p-0.5">
                {(['horas', 'ocupacion', 'coste'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => onMedida(m)}
                    className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${
                      medida === m ? 'bg-accent-500 text-primary-950' : 'text-ink-soft hover:bg-surface-muted'
                    }`}
                  >
                    {m === 'horas' ? 'Horas' : m === 'ocupacion' ? '% ocupacion' : 'Coste'}
                  </button>
                ))}
              </div>
              <button
                onClick={onLimpiar}
                className="border border-line rounded-full px-2.5 py-1 text-ink-soft hover:bg-surface-muted transition-colors"
              >
                Limpiar
              </button>
            </div>
          </div>

          {personasSel.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="mes" tick={CHART_AXIS} />
                <YAxis
                  tick={CHART_AXIS}
                  unit={medida === 'ocupacion' ? ' %' : medida === 'horas' ? ' h' : undefined}
                  tickFormatter={(v) => (medida === 'coste' ? fmtEur(Number(v)) : String(v))}
                  width={55}
                />
                <Tooltip
                  formatter={(v) =>
                    medida === 'ocupacion'
                      ? `${fmtNum(Number(v))} %`
                      : medida === 'coste'
                        ? fmtEur(Number(v))
                        : `${fmtNum(Number(v))} h`
                  }
                  contentStyle={TOOLTIP_STYLE}
                />
                {personasSel.map((f) => (
                  <Line
                    key={f.persona}
                    type="monotone"
                    dataKey={f.persona}
                    stroke={colorFor(f.persona)}
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center rounded-[14px] border border-dashed border-line-strong text-sm text-ink-muted">
              Selecciona una persona, un departamento o una tarea para dibujar su carga mensual.
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-ink-muted uppercase tracking-wide">
                  <th className="text-left px-3 py-2 font-bold sticky left-0 bg-surface border-b border-line">
                    Participante
                  </th>
                  {matrizParticipantes.meses.map((m) => (
                    <th
                      key={m}
                      className="text-right px-3 py-2 font-bold whitespace-nowrap border-b border-line"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          onOrdenMes((prev) => ({
                            mes: m,
                            dir: prev?.mes === m && prev.dir === 'desc' ? 'asc' : 'desc',
                          }))
                        }
                        className={`inline-flex items-center justify-end gap-1 rounded px-1 py-0.5 uppercase transition-colors hover:bg-surface-muted ${
                          ordenMes?.mes === m ? 'text-primary-900' : ''
                        }`}
                        title={`Ordenar por ${fmtMes(m)} ${
                          ordenMes?.mes === m && ordenMes.dir === 'desc'
                            ? 'de menor a mayor'
                            : 'de mayor a menor'
                        }`}
                      >
                        <span>{fmtMes(m)}</span>
                        {ordenMes?.mes === m && (
                          <span aria-hidden="true">{ordenMes.dir === 'desc' ? 'v' : '^'}</span>
                        )}
                      </button>
                    </th>
                  ))}
                  <th className="text-right px-3 py-2 font-bold border-b border-line">
                    {medida === 'ocupacion' ? 'Media' : 'Total'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {personasBuscadas.length === 0 && (
                  <tr>
                    <td
                      colSpan={matrizParticipantes.meses.length + 2}
                      className="px-3 py-6 text-center text-sm text-ink-soft"
                    >
                      Ninguna persona coincide con &quot;{busquedaPersona}&quot;.
                    </td>
                  </tr>
                )}
                {personasBuscadas.map((f) => {
                  const sel = seleccion.has(f.persona)
                  // Ocupacion media sobre los meses en los que ha imputado
                  let hAct = 0
                  let jAct = 0
                  f.celdas.forEach((c, i) => {
                    if (c.horas && c.horas > 0) {
                      hAct += c.horas
                      jAct += jornadaMes[i]
                    }
                  })
                  const ocupMedia = jAct > 0 ? (hAct / jAct) * 100 : 0
                  return (
                    <tr
                      key={f.persona}
                      onClick={() => onTogglePersona(f.persona)}
                      className="border-t border-line cursor-pointer transition-colors hover:bg-surface-muted"
                    >
                      <td className="px-3 py-1.5 font-semibold sticky left-0 whitespace-nowrap bg-surface">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full align-middle mr-2 ring-1 ring-inset ring-black/10"
                          style={{ backgroundColor: sel ? colorFor(f.persona) : '#DDE7E4' }}
                        />
                        {f.persona}
                        {f.nAnomalias > 0 && (
                          <span className="ml-1.5 text-[10px] text-danger font-bold">
                            *{f.nAnomalias}
                          </span>
                        )}
                      </td>
                      {f.celdas.map((c, i) => (
                        <td key={i} className="px-1.5 py-1 text-right">
                          <span
                            title={
                              c.anomalia
                                ? `${c.anomalia} (mediana ${fmtNum(f.mediana)} h)`
                                : undefined
                            }
                            className={`inline-block min-w-12 rounded px-1.5 py-0.5 tabular-nums ${
                              c.anomalia ? ANOMALIA_STYLE[c.anomalia] : ''
                            }`}
                          >
                            {medida === 'coste'
                              ? c.coste
                                ? fmtEur(c.coste)
                                : '-'
                              : c.horas !== null && c.horas !== 0
                                ? medida === 'ocupacion'
                                  ? `${fmtNum(ocupacion(c.horas, i))}%`
                                  : fmtNum(c.horas)
                                : '-'}
                          </span>
                        </td>
                      ))}
                      <td className="px-3 py-1.5 text-right font-bold tabular-nums text-ink">
                        {medida === 'ocupacion'
                          ? `${fmtNum(ocupMedia)}%`
                          : medida === 'coste'
                            ? fmtEur(f.totalCoste)
                            : fmtNum(f.total)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-3 text-[11px] text-ink-soft">
            <span>
              <span className="inline-block w-3 h-3 rounded bg-danger/12 ring-1 ring-danger/30 align-middle mr-1" />
              Pico (+40% sobre su mediana)
            </span>
            <span>
              <span className="inline-block w-3 h-3 rounded bg-warning/16 ring-1 ring-warning/40 align-middle mr-1" />
              Caida (-40%)
            </span>
            <span>
              <span className="inline-block w-3 h-3 rounded bg-info/10 ring-1 ring-info/30 align-middle mr-1" />
              Se incorpora (informativo)
            </span>
            <span>
              <span className="inline-block w-3 h-3 rounded bg-surface-muted ring-1 ring-line-strong align-middle mr-1" />
              Mes sin imputar entre meses activos
            </span>
          </div>

          {sinTarifa.length > 0 && (
            <p className="text-xs rounded-[14px] px-4 py-2.5 bg-warning/12 text-[#8A5A00]">
              <EmojiIcon>{emoji.alert}</EmojiIcon> <b>{sinTarifa.map((f) => f.persona).join(', ')}</b>{' '}
              {sinTarifa.length === 1 ? 'tiene' : 'tienen'} horas imputadas pero coste 0 EUR en el
              fichero de Concost (probablemente sin tarifa/grupo asignado en el ERP). Su trabajo
              no esta contando en el gasto ni en el control por departamento: corrigelo en
              Concost y reimporta.
            </p>
          )}
        </>
      )}
    </div>
  )
}
