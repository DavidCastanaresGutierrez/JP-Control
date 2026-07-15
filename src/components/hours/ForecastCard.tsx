import { useMemo } from 'react'
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Entry } from '../../types'
import { forecastPresupuesto } from '../../lib/metrics'
import { fmtEur, fmtFecha, fmtMes } from '../../lib/format'
import { emoji } from '../../lib/emoji'
import { EmojiIcon } from '../../lib/EmojiIcon'
import { CHART_AXIS, CHART_GRID, TOOLTIP_STYLE } from './theme'

function fmtFechaProyeccion(mes: string): string {
  const match = mes.match(/^(\d{4})-(\d{2})-q([1-4])$/)
  if (!match) return fmtMes(mes)

  const y = Number(match[1])
  const m = Number(match[2])
  const cuarto = Number(match[3])
  const ultimoDia = new Date(y, m, 0).getDate()
  const dia = cuarto === 4 ? ultimoDia : Math.round((ultimoDia * cuarto) / 4)
  return fmtFecha(`${y}-${String(m).padStart(2, '0')}-${String(dia).padStart(2, '0')}`)
}

const diasHasta = (iso: string) =>
  Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 86400000))

/** Prediccion de agotamiento de presupuesto */
export function ForecastCard({
  entries,
  presupuesto,
}: {
  entries: Entry[]
  presupuesto: number | undefined
}) {
  const forecast = useMemo(() => forecastPresupuesto(entries, presupuesto), [entries, presupuesto])
  const escenarioPrincipal = forecast?.escenarios.find((e) => e.id === 'r3')
  const marca80 = useMemo(() => {
    if (!forecast || !escenarioPrincipal) return null
    const objetivo = forecast.presupuesto * 0.8
    if (forecast.consumido >= objetivo) return { estado: 'superado' as const, fecha: null }
    if (escenarioPrincipal.ritmoMensual <= 0) return { estado: 'sinRitmo' as const, fecha: null }

    const puntosReales = forecast.chart.filter((p) => p.real !== null)
    const ultimoMes = puntosReales[puntosReales.length - 1]?.mes
    if (!ultimoMes) return null

    const [y, m] = ultimoMes.split('-').map(Number)
    const finUltimoMes = new Date(Date.UTC(y, m, 0))
    const dias = ((objetivo - forecast.consumido) / escenarioPrincipal.ritmoMensual) * 30.44
    if (dias > 365 * 5) return { estado: 'lejos' as const, fecha: null }

    return {
      estado: 'fecha' as const,
      fecha: new Date(finUltimoMes.getTime() + dias * 86400000).toISOString().slice(0, 10),
    }
  }, [forecast, escenarioPrincipal])

  return (
    <div className="bg-surface rounded-[24px] shadow-soft border border-line p-4 sm:p-6">
      <h3 className="font-bold text-ink text-lg">
        Prediccion: cuando se agota el presupuesto?
      </h3>
      <p className="text-xs text-ink-soft mb-4">
        Proyeccion del importe consumido (el mayor entre facturado y gasto acumulado, igual que en
        el Panel) manteniendo el ritmo medio de los ultimos 3 meses.
      </p>

      {!forecast ? (
        <p className="text-sm text-ink-soft">
          Define el presupuesto de coste (o el importe de contrato) en la pestana Configuracion para
          calcular la prediccion.
        </p>
      ) : forecast.agotado ? (
        <p className="text-sm rounded-[14px] px-4 py-2.5 bg-danger/10 text-danger font-semibold">
          <EmojiIcon>{emoji.alert}</EmojiIcon> El presupuesto ya esta agotado: consumidos {fmtEur(forecast.consumido)} de{' '}
          {fmtEur(forecast.presupuesto)} ({fmtEur(-forecast.restante)} de exceso).
        </p>
      ) : (
        <>
          <div className="grid sm:grid-cols-3 gap-4 mb-4">
            <div
              className={`rounded-[14px] p-4 ${
                escenarioPrincipal?.fecha && diasHasta(escenarioPrincipal.fecha) < 60
                  ? 'bg-danger/10'
                  : 'bg-accent-300/30'
              }`}
            >
              <div className="text-xs font-bold text-ink-muted uppercase tracking-wide">
                Fecha estimada de agotamiento
              </div>
              <div className="text-2xl font-extrabold text-ink mt-1">
                {escenarioPrincipal?.fecha ? fmtFecha(escenarioPrincipal.fecha) : '> 5 anos'}
              </div>
              {escenarioPrincipal?.fecha && (
                <div className="text-xs text-ink-soft mt-0.5">
                  quedan aprox. {diasHasta(escenarioPrincipal.fecha)} dias
                </div>
              )}
              {marca80 && (
                <div className="text-xs text-ink-soft mt-2 pt-2 border-t border-primary-900/10">
                  80% presupuesto ({fmtEur(forecast.presupuesto * 0.8)}):{' '}
                  <span className="font-bold text-ink">
                    {marca80.estado === 'superado'
                      ? 'ya superado'
                      : marca80.fecha
                        ? fmtFecha(marca80.fecha)
                        : marca80.estado === 'sinRitmo'
                          ? 'sin ritmo de gasto'
                          : '> 5 anos'}
                  </span>
                </div>
              )}
            </div>
            <div className="rounded-[14px] p-4 bg-surface-muted">
              <div className="text-xs font-bold text-ink-muted uppercase tracking-wide">
                Presupuesto restante
              </div>
              <div className="text-2xl font-extrabold text-ink mt-1">
                {fmtEur(forecast.restante)}
              </div>
              <div className="text-xs text-ink-soft mt-0.5">
                de {fmtEur(forecast.presupuesto)}
              </div>
            </div>
            <div className="rounded-[14px] p-4 bg-surface-muted">
              <div className="text-xs font-bold text-ink-muted uppercase tracking-wide">
                Ritmo de consumo
              </div>
              <div className="text-2xl font-extrabold text-ink mt-1">
                {fmtEur(escenarioPrincipal?.ritmoMensual ?? 0)}
                <span className="text-sm font-semibold text-ink-soft">/mes</span>
              </div>
              <div className="text-xs text-ink-soft mt-0.5">media de los ultimos 3 meses</div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={forecast.chart} margin={{ top: 28, right: 88, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
              <XAxis
                dataKey="mes"
                tick={CHART_AXIS}
                tickFormatter={(v) => {
                  const mes = String(v)
                  if (mes.endsWith('-q4')) return fmtMes(mes.slice(0, 7))
                  if (mes.includes('-q')) return ''
                  return fmtMes(mes)
                }}
              />
              <YAxis tick={CHART_AXIS} tickFormatter={(v) => fmtEur(v)} width={90} />
              <Tooltip
                formatter={(v) => fmtEur(Number(v))}
                labelFormatter={(label) => fmtFechaProyeccion(String(label))}
                contentStyle={TOOLTIP_STYLE}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine
                y={forecast.presupuesto}
                stroke="#E05A47"
                strokeDasharray="6 4"
                label={{
                  value: `Presupuesto ${fmtEur(forecast.presupuesto)}`,
                  position: 'insideTopRight',
                  fill: '#E05A47',
                  fontSize: 12,
                  dx: -8,
                  dy: -20,
                }}
              />
              <ReferenceLine
                y={forecast.presupuesto * 0.8}
                stroke="#F2B84B"
                strokeDasharray="4 4"
                label={{
                  value: `80% presupuesto ${fmtEur(forecast.presupuesto * 0.8)}`,
                  position: 'insideTopRight',
                  fill: '#8A5A00',
                  fontSize: 12,
                  dx: -8,
                  dy: 14,
                }}
              />
              <Line
                type="monotone"
                dataKey="real"
                name="Consumido"
                stroke="#143A45"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="proyeccion"
                name="Proyeccion"
                stroke="#143A45"
                strokeWidth={2}
                strokeDasharray="6 5"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>

          <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-xs text-ink-soft">
            {forecast.escenarios
              .filter((e) => e.id !== 'r3')
              .map((e) => (
                <span key={e.id}>
                  {e.label} ({fmtEur(e.ritmoMensual)}/mes):{' '}
                  <span className="font-bold text-ink">
                    {e.fecha ? fmtFecha(e.fecha) : e.ritmoMensual <= 0 ? 'sin consumo' : '> 5 anos'}
                  </span>
                </span>
              ))}
          </div>
        </>
      )}
    </div>
  )
}
