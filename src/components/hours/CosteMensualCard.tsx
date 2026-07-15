import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Entry } from '../../types'
import { costeHorasMensual } from '../../lib/metrics'
import { fmtEur, fmtMes } from '../../lib/format'
import { CHART_AXIS, CHART_GRID, TOOLTIP_STYLE } from './theme'

/** Coste mensual de horas (cuenta 9101 de la explotacion) */
export function CosteMensualCard({ entries }: { entries: Entry[] }) {
  const coste = useMemo(() => costeHorasMensual(entries), [entries])

  return (
    <div className="bg-surface rounded-[24px] shadow-soft border border-line p-4 sm:p-6">
      <h3 className="font-bold text-ink text-lg">Coste mensual de horas de oficina (9101)</h3>
      <p className="text-xs text-ink-soft mb-4">
        Del detalle de explotacion. Un salto brusco de un mes a otro suele indicar cambios de
        dedicacion del equipo.
      </p>
      {coste.length > 0 ? (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={coste.map((c) => ({ ...c, mesLabel: fmtMes(c.mes) }))}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
            <XAxis dataKey="mesLabel" tick={CHART_AXIS} />
            <YAxis tick={CHART_AXIS} tickFormatter={(v) => fmtEur(v)} width={80} />
            <Tooltip formatter={(v) => fmtEur(Number(v))} contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="coste" name="Coste horas" fill="#1B4A55" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="text-sm text-ink-soft">Sin apuntes en la cuenta 9101.</div>
      )}
    </div>
  )
}
