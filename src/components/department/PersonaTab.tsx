import { useMemo } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DepartmentModule } from '../../types'
import { evolucionFacturabilidadPersona, personasActivas } from '../../lib/departmentMetrics'
import { fmtMes, fmtNum } from '../../lib/format'
import { CHART_AXIS, CHART_GRID, TOOLTIP_STYLE, normalizarBusqueda } from './theme'
import { ToggleMesHistorico } from './ToggleMesHistorico'

export function PersonaTab({
  modulo,
  hastaMesHistorico,
  modoHistorico,
  onModoHistorico,
  buscadorPersona,
  onBuscadorPersona,
  personaSel,
  onPersonaSel,
}: {
  modulo: DepartmentModule
  hastaMesHistorico: string | undefined
  modoHistorico: 'curso' | 'vencido'
  onModoHistorico: (modo: 'curso' | 'vencido') => void
  buscadorPersona: string
  onBuscadorPersona: (value: string) => void
  personaSel: string | null
  onPersonaSel: (persona: string) => void
}) {
  const equipoActivo = useMemo(() => personasActivas(modulo), [modulo])
  const queryPersona = normalizarBusqueda(buscadorPersona)
  const equipoFiltrado = useMemo(
    () =>
      queryPersona
        ? equipoActivo.filter((p) => normalizarBusqueda(p).includes(queryPersona))
        : equipoActivo,
    [equipoActivo, queryPersona],
  )
  const personaVista =
    personaSel && equipoFiltrado.includes(personaSel) ? personaSel : (equipoFiltrado[0] ?? null)
  const evolucionPersona = useMemo(
    () =>
      personaVista
        ? evolucionFacturabilidadPersona(modulo, personaVista, undefined, hastaMesHistorico)
        : [],
    [modulo, personaVista, hastaMesHistorico],
  )

  return (
    <div className="bg-surface rounded-[24px] shadow-soft border border-line p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h3 className="font-bold text-ink text-lg">Evolución mensual por persona</h3>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleMesHistorico modo={modoHistorico} onChange={onModoHistorico} />
          <label className="relative w-full sm:w-56">
            <span className="sr-only">Buscar persona</span>
            <input
              value={buscadorPersona}
              onChange={(e) => onBuscadorPersona(e.target.value)}
              placeholder="Buscar persona"
              className="h-9 w-full rounded-[10px] border border-line bg-surface px-3 pr-8 text-sm text-ink outline-none focus:border-accent-500"
            />
            {buscadorPersona && (
              <button
                type="button"
                onClick={() => onBuscadorPersona('')}
                aria-label="Limpiar busqueda"
                className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-sm font-black text-ink-muted hover:bg-surface-muted hover:text-ink"
              >
                x
              </button>
            )}
          </label>
          <select
            value={personaVista ?? ''}
            onChange={(e) => onPersonaSel(e.target.value)}
            className="h-9 rounded-[10px] border border-line bg-surface px-3 text-sm font-semibold text-ink outline-none focus:border-accent-500"
          >
            {equipoFiltrado.length === 0 && <option value="">Sin coincidencias</option>}
            {equipoFiltrado.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-xs text-ink-soft mb-4">
        Horas imputadas, horas facturables y % de facturabilidad mes a mes, para comparar la
        evolución de la persona a lo largo del año.
      </p>

      {evolucionPersona.length > 0 ? (
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={evolucionPersona.map((m) => ({ ...m, mesLabel: fmtMes(m.mes) }))}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
            <XAxis dataKey="mesLabel" tick={CHART_AXIS} />
            <YAxis yAxisId="horas" tick={CHART_AXIS} unit=" h" width={55} />
            <YAxis
              yAxisId="pct"
              orientation="right"
              tick={CHART_AXIS}
              unit=" %"
              width={55}
              domain={[0, 'auto']}
            />
            <Tooltip
              formatter={(v, name) => (name === '% facturable' ? `${fmtNum(Number(v))} %` : `${fmtNum(Number(v))} h`)}
              contentStyle={TOOLTIP_STYLE}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="horas" dataKey="horasImputadas" name="Horas imputadas" fill="#1B4A55" fillOpacity={0.55} radius={[4, 4, 0, 0]} />
            <Bar yAxisId="horas" dataKey="horasFacturables" name="Horas facturables" fill="#7CE7C8" radius={[4, 4, 0, 0]} />
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="facturablePct"
              name="% facturable"
              stroke="#3A8DFF"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-sm text-ink-soft">Sin datos para esta persona.</p>
      )}
    </div>
  )
}
