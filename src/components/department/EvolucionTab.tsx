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
import { evolucionTemporalDepartamento } from '../../lib/departmentMetrics'
import { fmtMes, fmtNum } from '../../lib/format'
import { CHART_AXIS, CHART_GRID, TOOLTIP_STYLE } from './theme'
import { ToggleMesHistorico } from './ToggleMesHistorico'

export function EvolucionTab({
  modulo,
  hastaMesHistorico,
  modoHistorico,
  onModoHistorico,
}: {
  modulo: DepartmentModule
  hastaMesHistorico: string | undefined
  modoHistorico: 'curso' | 'vencido'
  onModoHistorico: (modo: 'curso' | 'vencido') => void
}) {
  const evolucionEquipo = useMemo(
    () => evolucionTemporalDepartamento(modulo, undefined, hastaMesHistorico),
    [modulo, hastaMesHistorico],
  )

  return (
    <div className="bg-surface rounded-[24px] shadow-soft border border-line p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <h3 className="font-bold text-ink text-lg">Evolución mensual del equipo</h3>
        <ToggleMesHistorico modo={modoHistorico} onChange={onModoHistorico} />
      </div>
      <p className="text-xs text-ink-soft mb-4">
        Horas imputadas, horas facturables, % de facturabilidad y ocupación media, mes a mes,
        para detectar tendencias.
      </p>
      {evolucionEquipo.length > 0 ? (
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={evolucionEquipo.map((m) => ({ ...m, mesLabel: fmtMes(m.mes) }))}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
            <XAxis dataKey="mesLabel" tick={CHART_AXIS} />
            <YAxis yAxisId="horas" tick={CHART_AXIS} unit=" h" width={55} />
            <YAxis yAxisId="pct" orientation="right" tick={CHART_AXIS} unit=" %" width={55} domain={[0, 'auto']} />
            <Tooltip
              formatter={(v, name) =>
                name === '% facturable' || name === 'Ocupación media'
                  ? `${fmtNum(Number(v))} %`
                  : `${fmtNum(Number(v))} h`
              }
              contentStyle={TOOLTIP_STYLE}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="horas" dataKey="horasImputadas" name="Horas imputadas" fill="#1B4A55" fillOpacity={0.55} radius={[4, 4, 0, 0]} />
            <Bar yAxisId="horas" dataKey="horasFacturables" name="Horas facturables" fill="#7CE7C8" radius={[4, 4, 0, 0]} />
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="facturabilidadPct"
              name="% facturable"
              stroke="#3A8DFF"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              connectNulls
            />
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="ocupacionMediaPct"
              name="Ocupación media"
              stroke="#E05A47"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-sm text-ink-soft">Sin datos todavía.</p>
      )}
    </div>
  )
}
