import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Project } from '../types'
import {
  controlDepartamentos,
  costeHorasMensual,
  forecastPresupuesto,
  horasJornadaMes,
  matrizHoras,
  SIN_DEPT,
  tareasContrato,
} from '../lib/metrics'
import { fmtEur, fmtFecha, fmtMes, fmtNum, fmtPct } from '../lib/format'
import { UploadZone } from './UploadZone'

// Paleta cualitativa para hasta 10 participantes, derivada del sistema de diseno
const LINE_COLORS = [
  '#1FAE7A', '#143A45', '#3A8DFF', '#F2B84B', '#E05A47',
  '#7CE7C8', '#5C6F75', '#1B4A55', '#9AF2D6', '#8A5A00',
]
const CHART_GRID = '#E2ECE9'
const CHART_AXIS = { fontSize: 12, fill: '#8A9A9E' }
const TOOLTIP_STYLE = { borderRadius: 12, border: '1px solid #DDE7E4', fontSize: 12 }

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

const ANOMALIA_STYLE: Record<string, string> = {
  pico: 'bg-danger/12 text-danger ring-1 ring-danger/30',
  caida: 'bg-warning/16 text-[#8A5A00] ring-1 ring-warning/40',
  nuevo: 'bg-info/10 text-info ring-1 ring-info/30',
  hueco: 'bg-surface-muted text-ink-muted ring-1 ring-line-strong',
}

export function HoursView({
  project,
  onImportHours,
  onUpdate,
  onSelectPersons,
}: {
  project: Project
  onImportHours: (files: File[]) => void
  onUpdate: (patch: Partial<Project>) => void
  onSelectPersons?: (personas: string[]) => void
}) {
  const coste = useMemo(() => costeHorasMensual(project.entries), [project.entries])
  const matriz = useMemo(() => matrizHoras(project.hours), [project.hours])
  const tareas = useMemo(() => tareasContrato(project.hours), [project.hours])
  const forecast = useMemo(
    () => forecastPresupuesto(project.entries, project.budget ?? project.contractValue),
    [project.entries, project.budget, project.contractValue],
  )
  const control = useMemo(
    () => controlDepartamentos(project),
    [project],
  )

  const setShare = (dept: string, pct: number | undefined) => {
    const next = { ...(project.deptShare ?? {}) }
    if (pct === undefined || Number.isNaN(pct)) delete next[dept]
    else {
      const resto = Object.entries(next).reduce((s, [d, v]) => (d === dept ? s : s + (v ?? 0)), 0)
      const maxPermitido = Math.max(0, 100 - resto)
      next[dept] = Math.min(maxPermitido, Math.max(0, pct))
    }
    onUpdate({ deptShare: next })
  }

  const diasHasta = (iso: string) =>
    Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 86400000))

  // Color estable por persona (segun su orden en la tabla, ordenada por total)
  const colorFor = (persona: string) => {
    const idx = matriz.filas.findIndex((f) => f.persona === persona)
    return LINE_COLORS[(idx < 0 ? 0 : idx) % LINE_COLORS.length]
  }

  // Seleccion para la grafica: por defecto, quien tenga anomalias (o el que mas
  // horas acumula si no hay ninguna)
  const [seleccion, setSeleccion] = useState<Set<string>>(() => {
    const conAnomalias = matriz.filas.filter((f) => f.nAnomalias > 0).map((f) => f.persona)
    if (conAnomalias.length) return new Set(conAnomalias)
    return new Set(matriz.filas.slice(0, 1).map((f) => f.persona))
  })
  const [tareaSeleccionada, setTareaSeleccionada] = useState<string | null>(null)

  const toggle = (persona: string) => {
    setTareaSeleccionada(null)
    setSeleccion((prev) => {
      const next = new Set(prev)
      if (next.has(persona)) next.delete(persona)
      else next.add(persona)
      return next
    })
  }

  const seleccionarDepartamento = (personas: string[]) => {
    setTareaSeleccionada(null)
    setSeleccion(new Set(personas))
    onSelectPersons?.(personas)
  }

  const seleccionarTarea = (tarea: string, personas: string[]) => {
    setTareaSeleccionada(tarea)
    setSeleccion(new Set(personas))
    onSelectPersons?.(personas)
  }

  // Modo de medida de la grafica/tabla de participantes
  const [medida, setMedida] = useState<'horas' | 'ocupacion' | 'coste'>('horas')
  const [ordenMes, setOrdenMes] = useState<{ mes: string; dir: 'desc' | 'asc' } | null>(null)

  // Horas de jornada completa por mes (para el % de ocupacion)
  const jornadaMes = useMemo(
    () => matriz.meses.map((m) => horasJornadaMes(m)),
    [matriz.meses],
  )
  // % de ocupacion de una celda = horas / jornada completa del mes
  const ocupacion = useMemo(
    () => (horas: number | null, i: number) =>
      horas && jornadaMes[i] > 0 ? (horas / jornadaMes[i]) * 100 : 0,
    [jornadaMes],
  )

  const chartData = useMemo(() => {
    const activos = matriz.filas.filter((f) => seleccion.has(f.persona))
    return matriz.meses.map((mes, i) => {
      const point: Record<string, number | string> = { mes: fmtMes(mes) }
      activos.forEach((f) => {
        const h = f.celdas[i].horas ?? 0
        const coste = f.celdas[i].coste ?? 0
        point[f.persona] =
          medida === 'ocupacion'
            ? Math.round(ocupacion(h, i) * 10) / 10
            : medida === 'coste'
              ? Math.round(coste * 100) / 100
              : h
      })
      return point
    })
  }, [matriz, seleccion, medida, ocupacion])

  const personasSel = matriz.filas.filter((f) => seleccion.has(f.persona))
  const hayTareas = tareas.length > 0
  const nAnomalias = matriz.filas.reduce((s, f) => s + f.nAnomalias, 0)
  const deptSeleccionados = useMemo(() => {
    const dept = new Set<string>()
    for (const persona of seleccion) {
      const d = project.personDept?.[persona]?.trim()
      if (d) dept.add(d)
    }
    return dept
  }, [project.personDept, seleccion])

  // Personas con horas imputadas pero coste 0 EUR en el fichero de Concost:
  // suele significar que no tienen tarifa/grupo asignado en el ERP.
  const hayCostePersonas = matriz.filas.some((f) => f.totalCoste > 0)
  const sinTarifa = hayCostePersonas
    ? matriz.filas.filter((f) => f.total > 0 && f.totalCoste === 0)
    : []
  const filasOrdenadas = useMemo(() => {
    const base = [...matriz.filas]
    if (ordenMes) {
      const mesIndex = matriz.meses.indexOf(ordenMes.mes)
      if (mesIndex >= 0) {
        const valorMes = (fila: (typeof matriz.filas)[number]) => {
          const celda = fila.celdas[mesIndex]
          const horas = celda?.horas ?? 0
          if (medida === 'coste') return celda?.coste ?? 0
          return medida === 'ocupacion' ? ocupacion(horas, mesIndex) : horas
        }

        base.sort((a, b) => {
          const diff = ordenMes.dir === 'desc' ? valorMes(b) - valorMes(a) : valorMes(a) - valorMes(b)
          if (diff !== 0) return diff
          const totalDiff =
            medida === 'coste' ? b.totalCoste - a.totalCoste : b.total - a.total
          return totalDiff || a.persona.localeCompare(b.persona)
        })
      }
    }

    const seleccionados = base.filter((f) => seleccion.has(f.persona))
    const resto = base.filter((f) => !seleccion.has(f.persona))
    return [...seleccionados, ...resto]
  }, [matriz.filas, matriz.meses, ordenMes, medida, ocupacion, seleccion])

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
    <div className="space-y-6">
      {/* Prediccion de agotamiento de presupuesto */}
      <div className="bg-surface rounded-[24px] shadow-soft border border-line p-6">
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
            ! El presupuesto ya esta agotado: consumidos {fmtEur(forecast.consumido)} de{' '}
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

      {/* Coste mensual de horas (cuenta 9101 de la explotacion) */}
      <div className="bg-surface rounded-[24px] shadow-soft border border-line p-6">
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

      {/* Horas por participante */}
      <div className="bg-surface rounded-[24px] shadow-soft border border-line p-6 space-y-4">
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

        <UploadZone
          compact
          label="Importar horas por participante (.xlsx)"
          hint='Arrastra el "Detalle de horas por empleado" del ERP (horas-empleado-detalle-*.xlsx). Tambien vale un Excel con columnas Empleado/Mes/Horas o una columna por mes. Los meses reimportados se sobrescriben.'
          onFiles={onImportHours}
        />

        {project.hours.length > 0 && (
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
                    . Haz clic en la tabla para anadir o quitar.
                  </>
                )}
              </p>
              <div className="flex items-center gap-2 text-xs">
                <div className="flex rounded-full border border-line p-0.5">
                  {(['horas', 'ocupacion', 'coste'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMedida(m)}
                      className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${
                        medida === m ? 'bg-accent-500 text-primary-950' : 'text-ink-soft hover:bg-surface-muted'
                      }`}
                    >
                      {m === 'horas' ? 'Horas' : m === 'ocupacion' ? '% ocupacion' : 'Coste'}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setSeleccion(new Set(matriz.filas.map((f) => f.persona)))}
                  className="border border-line rounded-full px-2.5 py-1 text-ink-soft hover:bg-surface-muted transition-colors"
                >
                  Ver todos
                </button>
                <button
                  onClick={() => setSeleccion(new Set())}
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
                  <Legend wrapperStyle={{ fontSize: 12 }} />
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
                Selecciona a alguien en la tabla para dibujar su carga mensual.
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] text-ink-muted uppercase tracking-wide">
                    <th className="text-left px-3 py-2 font-bold sticky left-0 bg-surface border-b border-line">
                      Participante
                    </th>
                    {matriz.meses.map((m) => (
                      <th
                        key={m}
                        className="text-right px-3 py-2 font-bold whitespace-nowrap border-b border-line"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setOrdenMes((prev) => ({
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
                  {filasOrdenadas.map((f) => {
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
                        onClick={() => toggle(f.persona)}
                        className={`border-t border-line cursor-pointer transition-colors ${
                          sel ? 'bg-accent-300/25' : 'hover:bg-surface-muted'
                        }`}
                      >
                        <td
                          className={`px-3 py-1.5 font-semibold sticky left-0 whitespace-nowrap ${
                            sel ? 'bg-accent-300/25' : 'bg-surface'
                          }`}
                        >
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
                ! <b>{sinTarifa.map((f) => f.persona).join(', ')}</b>{' '}
                {sinTarifa.length === 1 ? 'tiene' : 'tienen'} horas imputadas pero coste 0 EUR en el
                fichero de Concost (probablemente sin tarifa/grupo asignado en el ERP). Su trabajo
                no esta contando en el gasto ni en el control por departamento: corrigelo en
                Concost y reimporta.
              </p>
            )}
          </>
        )}
      </div>

      {/* Control por departamento + tareas del contrato */}
      {(
        <div className="grid xl:grid-cols-2 gap-5">
          <div className="bg-surface rounded-[24px] shadow-soft border border-line p-6 space-y-5">
          <div>
            <h3 className="font-bold text-ink text-lg">Control por departamento</h3>
            <p className="text-xs text-ink-soft">
              Asigna a cada persona su departamento y que % del presupuesto le corresponde. La
              ultima columna es <b>presupuesto consumido / asignado</b>: por debajo de 100 % va
              dentro de su parte; por encima (rojo) se esta pasando.
            </p>
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
                {control.filas.map((f) => {
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
                  const deptActivo = deptSeleccionados.has(f.dept)
                  return (
                    <tr
                      key={f.dept}
                      className={`border-t border-line transition-colors ${
                        deptActivo ? 'bg-accent-300/20' : ''
                      }`}
                    >
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => seleccionarDepartamento(f.personas)}
                          className={`text-left w-full group ${
                            deptActivo ? 'font-bold' : ''
                          }`}
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
                                setShare(
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
                        control.hayShares && Math.abs(control.sumaShares - 100) > 0.5
                          ? 'text-[#8A5A00]'
                          : 'text-ink-muted'
                      }`}
                    >
                      ({fmtPct(control.sumaShares)} asignado)
                    </span>
                  </td>
                  <td />
                  <td className="px-3 py-2 text-right tabular-nums text-ink-soft">
                    {control.presupuesto !== null
                      ? fmtEur((control.sumaShares / 100) * control.presupuesto)
                      : '-'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {control.hayCoste ? fmtEur(control.costeTotal) : <span className="text-ink-muted">-</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(control.horasTotal)} h</td>
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
          <div className="bg-surface rounded-[24px] shadow-soft border border-line p-6 space-y-4">
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
                  <span>{tareas.length} tareas detectadas</span>
                  <span>
                    {fmtNum(tareas.reduce((s, t) => s + t.horas, 0))} h -{' '}
                    {fmtEur(tareas.reduce((s, t) => s + t.coste, 0))}
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
                      {tareas.map((t) => {
                        const activo = tareaSeleccionada === t.tarea
                        return (
                          <tr
                            key={t.tarea}
                            onClick={() => seleccionarTarea(t.tarea, t.personas)}
                            className={`border-t border-line cursor-pointer transition-colors ${
                              activo ? 'bg-accent-300/20' : 'hover:bg-surface-muted'
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
                  grafica.
                </p>
              </>
            ) : (
              <div className="rounded-[18px] border border-dashed border-line p-4 text-sm text-ink-soft bg-surface-muted/40">
                Aun no hay tareas visibles con este proyecto. Si acabas de actualizar la app, vuelve a
                importar el Excel de horas para que se lean las columnas de tarea y aparezca este panel.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
