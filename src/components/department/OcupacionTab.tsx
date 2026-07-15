import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DepartmentModule } from '../../types'
import { comparativaOcupacion, tablaOcupacion } from '../../lib/departmentMetrics'
import { fmtMes, fmtNum, fmtPct } from '../../lib/format'
import { CHART_AXIS, CHART_GRID, ESTADO_COLOR, ESTADO_LABEL, CHART_COLORS, TOOLTIP_STYLE } from './theme'
import { SelectorMes } from './SelectorMes'
import { ToggleMesHistorico } from './ToggleMesHistorico'

export type MedidaComparativa = 'ocupacion' | 'horas' | 'facturable'

export function OcupacionTab({
  modulo,
  meses,
  mesActual,
  enMesEnCurso,
  enMesVencido,
  onMesEnCurso,
  onMesVencido,
  onMes,
  hastaMesHistorico,
  modoHistorico,
  onModoHistorico,
  medidaComparativa,
  onMedidaComparativa,
  personasComparativa,
  onPersonasComparativa,
  filtroEstadoOcupacion,
  onFiltroEstadoOcupacion,
  onIrAConfiguracion,
}: {
  modulo: DepartmentModule
  meses: string[]
  mesActual: string | null
  enMesEnCurso: boolean
  enMesVencido: boolean
  onMesEnCurso: () => void
  onMesVencido: () => void
  onMes: (mes: string) => void
  hastaMesHistorico: string | undefined
  modoHistorico: 'curso' | 'vencido'
  onModoHistorico: (modo: 'curso' | 'vencido') => void
  medidaComparativa: MedidaComparativa
  onMedidaComparativa: (medida: MedidaComparativa) => void
  personasComparativa: Set<string> | null
  onPersonasComparativa: (update: (prev: Set<string> | null) => Set<string> | null) => void
  filtroEstadoOcupacion: 'baja' | 'sobre' | null
  onFiltroEstadoOcupacion: (filtro: 'baja' | 'sobre' | null) => void
  onIrAConfiguracion: () => void
}) {
  const ocupacion = useMemo(
    () => (mesActual ? tablaOcupacion(modulo, mesActual) : []),
    [modulo, mesActual],
  )
  const ocupacionFiltrada = useMemo(
    () => (filtroEstadoOcupacion ? ocupacion.filter((f) => f.estado === filtroEstadoOcupacion) : ocupacion),
    [ocupacion, filtroEstadoOcupacion],
  )
  const comparativa = useMemo(
    () => comparativaOcupacion(modulo, undefined, hastaMesHistorico),
    [modulo, hastaMesHistorico],
  )
  const seleccionComparativa = useMemo(() => {
    if (personasComparativa) return personasComparativa
    const enAlerta = ocupacion.filter((f) => f.estado === 'baja' || f.estado === 'sobre').map((f) => f.persona)
    if (enAlerta.length > 0) return new Set(enAlerta)
    return new Set(comparativa.filas.slice(0, 5).map((f) => f.persona))
  }, [personasComparativa, ocupacion, comparativa])
  const colorPersonaComparativa = (persona: string) => {
    const idx = comparativa.filas.findIndex((f) => f.persona === persona)
    return CHART_COLORS[(idx < 0 ? 0 : idx) % CHART_COLORS.length]
  }
  const toggleComparativa = (persona: string) => {
    onPersonasComparativa((prev) => {
      const base = new Set(prev ?? seleccionComparativa)
      if (base.has(persona)) base.delete(persona)
      else base.add(persona)
      return base
    })
  }
  const chartComparativa = useMemo(
    () =>
      comparativa.meses.map((mes, i) => {
        const point: Record<string, number | string> = { mesLabel: fmtMes(mes) }
        comparativa.filas.forEach((f) => {
          if (!seleccionComparativa.has(f.persona)) return
          const c = f.celdas[i]
          point[f.persona] =
            medidaComparativa === 'horas'
              ? c.horasImputadas
              : medidaComparativa === 'facturable'
                ? (c.facturablePct ?? 0)
                : (c.ocupacionPct ?? 0)
        })
        return point
      }),
    [comparativa, seleccionComparativa, medidaComparativa],
  )
  const objetivoPct = modulo.objetivoFacturablePct

  return (
    <div className="space-y-5">
      <div className="bg-surface rounded-[24px] shadow-soft border border-line p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-ink text-lg">Comparativa entre personas</h3>
            <p className="text-xs text-ink-soft mt-1 max-w-xl">
              Cruza a varias personas del equipo para comparar su evolución mes a mes. Haz clic
              en una persona de la tabla para añadirla o quitarla de la gráfica.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <ToggleMesHistorico modo={modoHistorico} onChange={onModoHistorico} />
            <div className="flex rounded-full border border-line p-0.5">
              {(
                [
                  { id: 'ocupacion' as const, label: '% ocupación' },
                  { id: 'horas' as const, label: 'Horas' },
                  { id: 'facturable' as const, label: '% facturable' },
                ]
              ).map((m) => (
                <button
                  key={m.id}
                  onClick={() => onMedidaComparativa(m.id)}
                  className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${
                    medidaComparativa === m.id
                      ? 'bg-accent-500 text-primary-950'
                      : 'text-ink-soft hover:bg-surface-muted'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => onPersonasComparativa(() => new Set(comparativa.filas.map((f) => f.persona)))}
              className="border border-line rounded-full px-2.5 py-1 text-ink-soft hover:bg-surface-muted transition-colors"
            >
              Todos
            </button>
            <button
              onClick={() => onPersonasComparativa(() => new Set())}
              className="border border-line rounded-full px-2.5 py-1 text-ink-soft hover:bg-surface-muted transition-colors"
            >
              Ninguno
            </button>
          </div>
        </div>

        {seleccionComparativa.size > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartComparativa}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
              <XAxis dataKey="mesLabel" tick={CHART_AXIS} />
              <YAxis tick={CHART_AXIS} unit={medidaComparativa === 'horas' ? ' h' : ' %'} width={55} />
              <Tooltip
                formatter={(v) =>
                  medidaComparativa === 'horas' ? `${fmtNum(Number(v))} h` : `${fmtNum(Number(v))} %`
                }
                contentStyle={TOOLTIP_STYLE}
              />
              {comparativa.filas
                .filter((f) => seleccionComparativa.has(f.persona))
                .map((f) => (
                  <Line
                    key={f.persona}
                    type="monotone"
                    dataKey={f.persona}
                    name={f.persona}
                    stroke={colorPersonaComparativa(f.persona)}
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center rounded-[14px] border border-dashed border-line-strong text-sm text-ink-muted">
            Selecciona al menos una persona en la tabla para dibujar la comparativa.
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-ink-muted uppercase tracking-wide">
                <th className="text-left px-3 py-2 font-bold sticky left-0 bg-surface border-b border-line">
                  Persona
                </th>
                {comparativa.meses.map((m) => (
                  <th
                    key={m}
                    className="text-right px-3 py-2 font-bold whitespace-nowrap border-b border-line"
                  >
                    {fmtMes(m)}
                  </th>
                ))}
                <th className="text-right px-3 py-2 font-bold border-b border-line">Media ocup.</th>
              </tr>
            </thead>
            <tbody>
              {comparativa.filas.map((f) => {
                const sel = seleccionComparativa.has(f.persona)
                return (
                  <tr
                    key={f.persona}
                    onClick={() => toggleComparativa(f.persona)}
                    className="border-t border-line cursor-pointer transition-colors hover:bg-surface-muted"
                  >
                    <td className="px-3 py-1.5 font-semibold sticky left-0 whitespace-nowrap bg-surface">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full align-middle mr-2 ring-1 ring-inset ring-black/10"
                        style={{ backgroundColor: sel ? colorPersonaComparativa(f.persona) : '#DDE7E4' }}
                      />
                      {f.persona}
                    </td>
                    {f.celdas.map((c, i) => (
                      <td key={i} className="px-3 py-1.5 text-right tabular-nums text-ink-soft">
                        {medidaComparativa === 'horas'
                          ? c.horasImputadas > 0
                            ? `${fmtNum(c.horasImputadas)} h`
                            : '-'
                          : medidaComparativa === 'facturable'
                            ? c.facturablePct !== null
                              ? fmtPct(c.facturablePct)
                              : '-'
                            : c.ocupacionPct !== null
                              ? fmtPct(c.ocupacionPct)
                              : '-'}
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-right font-bold tabular-nums text-ink">
                      {f.mediaOcupacionPct !== null ? fmtPct(f.mediaOcupacionPct) : '-'}
                    </td>
                  </tr>
                )
              })}
              {comparativa.filas.length === 0 && (
                <tr>
                  <td colSpan={comparativa.meses.length + 2} className="px-4 py-6 text-center text-ink-soft">
                    Sin datos de ocupación todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-surface rounded-[24px] shadow-soft border border-line">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-line">
        <h3 className="font-bold text-ink text-lg">Detalle del mes</h3>
        <SelectorMes
          meses={meses}
          mesActual={mesActual}
          enMesEnCurso={enMesEnCurso}
          enMesVencido={enMesVencido}
          onMesEnCurso={onMesEnCurso}
          onMesVencido={onMesVencido}
          onMes={onMes}
        />
      </div>
      {filtroEstadoOcupacion && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-line bg-surface-muted/60 text-xs">
          <span className="text-ink-soft">
            Mostrando solo personas con{' '}
            <span className="font-bold text-ink">{ESTADO_LABEL[filtroEstadoOcupacion].toLowerCase()}</span>.
          </span>
          <button
            type="button"
            onClick={() => onFiltroEstadoOcupacion(null)}
            className="font-semibold text-primary-800 underline"
          >
            Quitar filtro
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-[11px] text-ink-muted uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3 font-bold">Persona</th>
              <th className="text-right px-4 py-3 font-bold">Horas disp.</th>
              <th className="text-right px-4 py-3 font-bold">Horas imput.</th>
              <th className="text-right px-4 py-3 font-bold">Ocupación</th>
              <th className="text-right px-4 py-3 font-bold">Facturable</th>
              <th className="text-right px-4 py-3 font-bold">Objetivo</th>
              <th className="text-left px-4 py-3 font-bold">Proyecto principal</th>
            </tr>
          </thead>
          <tbody>
            {ocupacionFiltrada.map((f) => (
              <tr key={f.persona} className="border-t border-line">
                <td className="px-4 py-2.5 font-semibold text-ink whitespace-nowrap">{f.persona}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-ink-soft">{fmtNum(f.horasDisponibles)} h</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-ink">{fmtNum(f.horasImputadas)} h</td>
                <td className="px-4 py-2.5 text-right">
                  <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${ESTADO_COLOR[f.estado]}`}>
                    {f.ocupacionPct !== null ? fmtPct(f.ocupacionPct) : ESTADO_LABEL[f.estado]}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-ink-soft">
                  {f.facturablePct !== null ? fmtPct(f.facturablePct) : '-'}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {objetivoPct === undefined ? (
                    <span className="text-ink-muted">sin definir</span>
                  ) : f.facturablePct === null ? (
                    <span className="text-ink-muted">-</span>
                  ) : (
                    <span className={`font-bold ${f.facturablePct >= objetivoPct ? 'text-success' : 'text-danger'}`}>
                      {fmtPct(objetivoPct)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-ink-soft truncate max-w-[16rem]" title={f.proyectoPrincipal ?? ''}>
                  {f.proyectoPrincipal ?? '-'}
                </td>
              </tr>
            ))}
            {ocupacion.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-ink-soft">
                  Sin apuntes de horas para este mes.
                </td>
              </tr>
            )}
            {ocupacion.length > 0 && ocupacionFiltrada.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-ink-soft">
                  Nadie tiene {ESTADO_LABEL[filtroEstadoOcupacion!].toLowerCase()} este mes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {objetivoPct === undefined && (
        <p className="px-4 py-3 text-xs text-ink-soft border-t border-line">
          Define el % de facturabilidad objetivo en{' '}
          <button className="font-semibold text-primary-800 underline" onClick={onIrAConfiguracion}>
            Configuración
          </button>{' '}
          para comparar cada persona con la meta del equipo.
        </p>
      )}
      </div>
    </div>
  )
}
