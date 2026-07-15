import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { DepartmentModule } from '../../types'
import { TIPO_ACTIVIDAD_LABEL, dedicacionPorPersona, esActividadFacturable } from '../../lib/departmentMetrics'
import { fmtNum, fmtPct } from '../../lib/format'
import { CHART_AXIS, CHART_GRID, TOOLTIP_STYLE, normalizarBusqueda, truncarEtiqueta } from './theme'
import { EtiquetaProyectoEje } from './EtiquetaProyectoEje'

export function DedicacionTab({
  modulo,
  buscadorDedicacion,
  onBuscadorDedicacion,
  personaDetalleDedicacion,
  onPersonaDetalleDedicacion,
  proyectoFiltroDedicacion,
  onProyectoFiltroDedicacion,
}: {
  modulo: DepartmentModule
  buscadorDedicacion: string
  onBuscadorDedicacion: (value: string) => void
  personaDetalleDedicacion: string | null
  onPersonaDetalleDedicacion: (persona: string | null) => void
  proyectoFiltroDedicacion: string | null
  onProyectoFiltroDedicacion: (update: (prev: string | null) => string | null) => void
}) {
  const dedicacion = useMemo(() => dedicacionPorPersona(modulo), [modulo])
  const queryDedicacion = normalizarBusqueda(buscadorDedicacion)
  const dedicacionFiltrada = useMemo(
    () =>
      dedicacion
        .filter((d) => (queryDedicacion ? normalizarBusqueda(d.persona).includes(queryDedicacion) : true))
        .filter((d) =>
          proyectoFiltroDedicacion ? d.reparto.some((r) => r.proyecto === proyectoFiltroDedicacion) : true,
        ),
    [dedicacion, queryDedicacion, proyectoFiltroDedicacion],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-soft">
          Reparto de horas por proyecto/actividad de cada persona, sobre todo el periodo importado.
        </p>
        <label className="relative w-full sm:w-64">
          <span className="sr-only">Buscar persona</span>
          <input
            value={buscadorDedicacion}
            onChange={(e) => onBuscadorDedicacion(e.target.value)}
            placeholder="Buscar persona"
            className="h-9 w-full rounded-[10px] border border-line bg-surface px-3 pr-8 text-sm text-ink outline-none focus:border-accent-500"
          />
          {buscadorDedicacion && (
            <button
              type="button"
              onClick={() => onBuscadorDedicacion('')}
              aria-label="Limpiar busqueda"
              className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-sm font-black text-ink-muted hover:bg-surface-muted hover:text-ink"
            >
              x
            </button>
          )}
        </label>
      </div>
      {proyectoFiltroDedicacion && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-line bg-surface-muted/60 px-4 py-2.5 text-xs">
          <span className="text-ink-soft">
            Mostrando solo personas con horas en{' '}
            <span className="font-bold text-ink">{proyectoFiltroDedicacion}</span>.
          </span>
          <button
            type="button"
            onClick={() => onProyectoFiltroDedicacion(() => null)}
            className="font-semibold text-primary-800 underline"
          >
            Quitar filtro
          </button>
        </div>
      )}
      {dedicacionFiltrada.map((d) => {
        const expandida = personaDetalleDedicacion === d.persona
        const reparteGrafico = d.reparto.slice(0, 15)
        return (
          <div
            key={d.persona}
            role="button"
            tabIndex={0}
            onClick={() => onPersonaDetalleDedicacion(expandida ? null : d.persona)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onPersonaDetalleDedicacion(expandida ? null : d.persona)
              }
            }}
            className="bg-surface rounded-[20px] shadow-soft border border-line p-5 text-left cursor-pointer transition-colors hover:border-accent-300"
          >
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <h4 className="font-bold text-ink">{d.persona}</h4>
              <span className="text-xs text-ink-muted">{fmtNum(d.totalHoras)} h totales</span>
            </div>
            <div className="space-y-2">
              {d.reparto.slice(0, 8).map((r) => {
                const tipo = r.tipo
                return (
                  <div key={r.proyecto}>
                    <div className="flex items-center justify-between gap-3 text-xs mb-1">
                      <span className="min-w-0 truncate text-ink-soft" title={r.proyecto}>
                        {r.proyecto}
                        {tipo !== 'facturable' && (
                          <span className="ml-1.5 rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold text-ink-muted">
                            {TIPO_ACTIVIDAD_LABEL[tipo]}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 font-bold text-ink tabular-nums">{fmtPct(r.pct)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                      <div
                        className={`h-full rounded-full ${esActividadFacturable(tipo) ? 'bg-success' : 'bg-info'}`}
                        style={{ width: `${Math.min(100, r.pct)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 text-[11px] font-semibold text-primary-800">
              {expandida ? 'Ocultar detalle ▴' : 'Ver detalle ▾'}
            </div>
            {expandida && (
              <div
                className="mt-4 pt-4 border-t border-line overflow-x-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={reparteGrafico} margin={{ top: 8, left: 4, right: 16, bottom: 64 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                    <XAxis
                      dataKey="proyecto"
                      tick={<EtiquetaProyectoEje />}
                      interval={0}
                      height={80}
                    />
                    <YAxis type="number" tick={CHART_AXIS} unit=" h" width={55} />
                    <Tooltip
                      formatter={(v) => `${fmtNum(Number(v))} h`}
                      labelFormatter={(label) => truncarEtiqueta(String(label), 30)}
                      contentStyle={{ ...TOOLTIP_STYLE, maxWidth: 200 }}
                      allowEscapeViewBox={{ x: false, y: true }}
                    />
                    <Bar dataKey="horas" radius={[4, 4, 0, 0]}>
                      {reparteGrafico.map((r) => (
                        <Cell
                          key={r.proyecto}
                          fill={esActividadFacturable(r.tipo) ? '#7CE7C8' : '#3A8DFF'}
                          cursor="pointer"
                          onClick={(e) => {
                            e?.stopPropagation?.()
                            onProyectoFiltroDedicacion((prev) => (prev === r.proyecto ? null : r.proyecto))
                          }}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                {d.reparto.length > reparteGrafico.length && (
                  <p className="mt-2 text-[11px] text-ink-muted">
                    Mostrando los {reparteGrafico.length} proyectos con más horas de{' '}
                    {d.reparto.length} totales.
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}
      {dedicacion.length === 0 && (
        <div className="rounded-[20px] border border-line bg-surface p-8 text-center text-sm text-ink-soft">
          Sin datos de dedicación todavía.
        </div>
      )}
      {dedicacion.length > 0 && dedicacionFiltrada.length === 0 && (
        <div className="rounded-[20px] border border-line bg-surface p-8 text-center text-sm text-ink-soft">
          Ninguna persona coincide con "{buscadorDedicacion}".
        </div>
      )}
    </div>
  )
}
