import { useMemo, useState } from 'react'
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DepartmentModule } from '../types'
import { DEPARTAMENTOS_REALES } from '../types'
import {
  clasificarActividad,
  dashboardDepartamento,
  dedicacionPorPersona,
  distribucionPorProyecto,
  distribucionPorTipoActividad,
  evolucionFacturabilidadPersona,
  evolucionTemporalDepartamento,
  mesesDisponibles,
  personasActivas,
  tablaOcupacion,
  TIPO_ACTIVIDAD_LABEL,
  todasLasPersonas,
  ultimoMesConDatos,
} from '../lib/departmentMetrics'
import { fmtFecha, fmtMes, fmtNum, fmtPct } from '../lib/format'
import { EmojiIcon, emoji } from '../lib/emoji'
import { KpiCard } from './KpiCard'
import { UploadZone } from './UploadZone'

type Tab = 'panel' | 'ocupacion' | 'evolucion' | 'persona' | 'dedicacion' | 'configuracion'

const CHART_GRID = '#E2ECE9'
const CHART_AXIS = { fontSize: 12, fill: '#8A9A9E' }
const TOOLTIP_STYLE = { borderRadius: 12, border: '1px solid #DDE7E4', fontSize: 12 }
const PIE_COLORS = ['#7CE7C8', '#143A45', '#3A8DFF', '#F2B84B', '#E05A47', '#1B4A55', '#5C6F75', '#9AF2D6']

const ESTADO_COLOR: Record<string, string> = {
  ok: 'bg-success/10 text-success',
  baja: 'bg-warning/15 text-[#8A5A00]',
  sobre: 'bg-danger/10 text-danger',
  'sin-datos': 'bg-surface-muted text-ink-muted',
}

const ESTADO_LABEL: Record<string, string> = {
  ok: 'Ocupación correcta',
  baja: 'Baja ocupación',
  sobre: 'Sobreocupación',
  'sin-datos': 'Sin datos',
}

export function DepartmentDashboard({
  departamento,
  modulo,
  onChooseDepartamento,
  onImportFile,
  onUpdateRoster,
  onSetObjetivo,
}: {
  departamento: string | null
  modulo: DepartmentModule | undefined
  onChooseDepartamento: (nombre: string) => void
  onImportFile: (file: File) => void
  onUpdateRoster: (roster: DepartmentModule['roster']) => void
  onSetObjetivo: (pct: number | undefined) => void
}) {
  const [tab, setTab] = useState<Tab>('panel')
  const [mesSel, setMesSel] = useState<string | null>(null)
  const [personaSel, setPersonaSel] = useState<string | null>(null)

  const meses = useMemo(() => (modulo ? mesesDisponibles(modulo) : []), [modulo])
  const mesActual = mesSel ?? (modulo ? ultimoMesConDatos(modulo) : null)

  const dashboard = useMemo(
    () => (modulo && mesActual ? dashboardDepartamento(modulo, mesActual) : null),
    [modulo, mesActual],
  )
  const ocupacion = useMemo(
    () => (modulo && mesActual ? tablaOcupacion(modulo, mesActual) : []),
    [modulo, mesActual],
  )
  const dedicacion = useMemo(() => (modulo ? dedicacionPorPersona(modulo) : []), [modulo])
  const equipoActivo = useMemo(() => (modulo ? personasActivas(modulo) : []), [modulo])
  const personaVista = personaSel ?? equipoActivo[0] ?? null
  const evolucionPersona = useMemo(
    () => (modulo && personaVista ? evolucionFacturabilidadPersona(modulo, personaVista) : []),
    [modulo, personaVista],
  )
  const distProyecto = useMemo(
    () => (modulo && mesActual ? distribucionPorProyecto(modulo, mesActual) : []),
    [modulo, mesActual],
  )
  const distTipo = useMemo(
    () => (modulo && mesActual ? distribucionPorTipoActividad(modulo, mesActual) : []),
    [modulo, mesActual],
  )
  const evolucionEquipo = useMemo(
    () => (modulo ? evolucionTemporalDepartamento(modulo) : []),
    [modulo],
  )
  const objetivoPct = modulo?.objetivoFacturablePct

  if (!departamento) {
    return (
      <div className="p-4 sm:p-6 max-w-xl">
        <h1 className="font-display text-[26px] font-extrabold text-ink tracking-tight sm:text-[30px]">
          Mi departamento
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Elige el departamento que diriges para ver su ocupación, dedicación y carga de trabajo.
        </p>
        <div className="mt-6 space-y-2">
          {DEPARTAMENTOS_REALES.map((d) => (
            <button
              key={d}
              onClick={() => onChooseDepartamento(d)}
              className="flex h-12 w-full items-center rounded-lg border border-line bg-surface px-4 text-left text-sm font-semibold text-ink shadow-soft transition-colors hover:border-accent-300 hover:bg-accent-300/10"
            >
              {d}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const personas = todasLasPersonas(modulo ?? { departamento, roster: {}, horas: [] })
  const todasPersonasImportadas = modulo
    ? [...new Set(modulo.horas.map((h) => h.persona))].sort((a, b) => a.localeCompare(b, 'es'))
    : []

  const sinDatos = !modulo || modulo.horas.length === 0

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'panel', label: 'Panel' },
    { id: 'ocupacion', label: 'Ocupación' },
    { id: 'evolucion', label: 'Evolución' },
    { id: 'persona', label: 'Por persona' },
    { id: 'dedicacion', label: 'Dedicación' },
    { id: 'configuracion', label: 'Configuración' },
  ]

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[22px] sm:text-[28px] font-extrabold text-ink tracking-tight truncate">
            {departamento}
          </h1>
          <div className="text-sm text-ink-soft mt-0.5">
            {personas.length} personas en el equipo
            {modulo?.lastImport && <> · datos importados {fmtFecha(modulo.lastImport.slice(0, 10))}</>}
          </div>
        </div>
        <div className="-mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0">
          <div className="flex w-max rounded-full border border-line bg-surface p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 h-9 text-sm font-semibold rounded-full transition-colors whitespace-nowrap ${
                  tab === t.id ? 'bg-accent-500 text-primary-950' : 'text-ink-soft hover:bg-surface-muted'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {sinDatos && tab !== 'configuracion' && (
        <div className="rounded-[20px] border border-dashed border-line-strong bg-surface p-6 text-sm text-ink-soft">
          Todavía no has importado datos de horas. Ve a la pestaña{' '}
          <button className="font-semibold text-primary-800 underline" onClick={() => setTab('configuracion')}>
            Configuración
          </button>{' '}
          para subir el Excel de producción completa y elegir el equipo.
        </div>
      )}

      {tab === 'panel' && !sinDatos && dashboard && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-bold text-ink text-lg">Resumen del mes</h3>
            <select
              value={mesActual ?? ''}
              onChange={(e) => setMesSel(e.target.value)}
              className="h-9 rounded-[10px] border border-line bg-surface px-3 text-sm font-semibold text-ink outline-none focus:border-accent-500"
            >
              {meses.map((m) => (
                <option key={m} value={m}>
                  {fmtMes(m)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-2">Plantilla</div>
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
              <KpiCard
                label="Personas del equipo"
                value={String(dashboard.personasTotal)}
                icon={<EmojiIcon>{emoji.home}</EmojiIcon>}
                accent="slate"
                sub={`${dashboard.personasActivas} activas`}
              />
              <KpiCard
                label="Ocupación media"
                value={dashboard.ocupacionMediaPct !== null ? fmtPct(dashboard.ocupacionMediaPct) : '-'}
                icon={<EmojiIcon>{emoji.chart}</EmojiIcon>}
                accent={
                  dashboard.ocupacionMediaPct !== null && dashboard.ocupacionMediaPct > 110
                    ? 'rose'
                    : dashboard.ocupacionMediaPct !== null && dashboard.ocupacionMediaPct < 70
                      ? 'amber'
                      : 'emerald'
                }
              />
            </div>
          </div>

          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-2">Horas y facturabilidad</div>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              <KpiCard
                label="Horas imputadas"
                value={`${fmtNum(dashboard.horasImputadas)} h`}
                icon={<EmojiIcon>{emoji.document}</EmojiIcon>}
                accent="slate"
              />
              <KpiCard
                label="Horas facturables"
                value={`${fmtNum(dashboard.horasFacturables)} h`}
                icon={<EmojiIcon>{emoji.money}</EmojiIcon>}
                accent="emerald"
              />
              <KpiCard
                label="% de facturabilidad"
                value={dashboard.facturabilidadPct !== null ? fmtPct(dashboard.facturabilidadPct) : '-'}
                icon={<EmojiIcon>{emoji.trend}</EmojiIcon>}
                accent="indigo"
              />
              <KpiCard
                label="Capacidad libre"
                value={`${fmtNum(dashboard.capacidadLibre)} h`}
                icon={<EmojiIcon>{emoji.check}</EmojiIcon>}
                accent={dashboard.capacidadLibre > 0 ? 'emerald' : 'amber'}
              />
            </div>
          </div>

          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-2">
              Reparto de horas no facturables
            </div>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              <KpiCard label="Horas internas / gestión" value={`${fmtNum(dashboard.horasInternas)} h`} accent="slate" />
              <KpiCard label="Horas de soporte" value={`${fmtNum(dashboard.horasSoporte)} h`} accent="slate" />
              <KpiCard label="Horas de innovación" value={`${fmtNum(dashboard.horasInnovacion)} h`} accent="slate" />
              <KpiCard label="Horas de formación" value={`${fmtNum(dashboard.horasFormacion)} h`} accent="slate" />
            </div>
          </div>

          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-2">Alertas de carga</div>
            <div className="grid grid-cols-2 gap-4">
              <KpiCard
                label="Personas sobreocupadas"
                value={String(dashboard.personasSobreocupadas)}
                icon={<EmojiIcon>{dashboard.personasSobreocupadas > 0 ? emoji.alert : emoji.check}</EmojiIcon>}
                accent={dashboard.personasSobreocupadas > 0 ? 'rose' : 'emerald'}
              />
              <KpiCard
                label="Personas infraocupadas"
                value={String(dashboard.personasInfraocupadas)}
                icon={<EmojiIcon>{dashboard.personasInfraocupadas > 0 ? emoji.alert : emoji.check}</EmojiIcon>}
                accent={dashboard.personasInfraocupadas > 0 ? 'amber' : 'emerald'}
              />
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <div className="min-w-0 bg-surface rounded-[24px] shadow-soft border border-line p-4 sm:p-6">
              <h3 className="font-bold text-ink text-lg mb-1">Distribución del esfuerzo por proyecto</h3>
              <p className="text-xs text-ink-soft mb-3">
                En qué proyectos y actividades se ha ido el tiempo del equipo este mes.
              </p>
              {distProyecto.length > 0 ? (
                <div className="space-y-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={distProyecto.slice(0, 8)}
                        dataKey="horas"
                        nameKey="clave"
                        innerRadius={50}
                        outerRadius={82}
                        paddingAngle={2}
                      >
                        {distProyecto.slice(0, 8).map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => `${fmtNum(Number(v))} h`} contentStyle={TOOLTIP_STYLE} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {distProyecto.slice(0, 8).map((d, i) => (
                      <div key={d.clave} className="flex items-center gap-2 text-sm">
                        <span
                          className="w-3 h-3 rounded-sm shrink-0"
                          style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                        />
                        <span className="flex-1 min-w-0 truncate text-ink-soft" title={d.clave}>
                          {d.clave}
                        </span>
                        <span className="shrink-0 text-ink-muted text-xs tabular-nums">{fmtPct(d.pct)}</span>
                        <span className="shrink-0 font-bold text-ink tabular-nums">{fmtNum(d.horas)} h</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-ink-soft">Sin datos para este mes.</p>
              )}
            </div>

            <div className="min-w-0 bg-surface rounded-[24px] shadow-soft border border-line p-4 sm:p-6">
              <h3 className="font-bold text-ink text-lg mb-1">Distribución por tipo de actividad</h3>
              <p className="text-xs text-ink-soft mb-3">
                Facturable frente a innovación, soporte, formación y gestión interna.
              </p>
              {distTipo.length > 0 ? (
                <div className="space-y-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={distTipo} dataKey="horas" nameKey="clave" innerRadius={50} outerRadius={82} paddingAngle={2}>
                        {distTipo.map((d, i) => (
                          <Cell
                            key={i}
                            fill={d.tipo === 'facturable' ? '#7CE7C8' : PIE_COLORS[(i + 2) % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => `${fmtNum(Number(v))} h`} contentStyle={TOOLTIP_STYLE} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {distTipo.map((d, i) => (
                      <div key={d.clave} className="flex items-center gap-2 text-sm">
                        <span
                          className="w-3 h-3 rounded-sm shrink-0"
                          style={{ backgroundColor: d.tipo === 'facturable' ? '#7CE7C8' : PIE_COLORS[(i + 2) % PIE_COLORS.length] }}
                        />
                        <span className="flex-1 min-w-0 truncate text-ink-soft">{d.clave}</span>
                        <span className="shrink-0 text-ink-muted text-xs tabular-nums">{fmtPct(d.pct)}</span>
                        <span className="shrink-0 font-bold text-ink tabular-nums">{fmtNum(d.horas)} h</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-ink-soft">Sin datos para este mes.</p>
              )}
            </div>
          </div>
        </>
      )}

      {tab === 'ocupacion' && !sinDatos && (
        <div className="bg-surface rounded-[24px] shadow-soft border border-line">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-line">
            <h3 className="font-bold text-ink text-lg">Ocupación del equipo</h3>
            <select
              value={mesActual ?? ''}
              onChange={(e) => setMesSel(e.target.value)}
              className="h-9 rounded-[10px] border border-line bg-surface px-3 text-sm font-semibold text-ink outline-none focus:border-accent-500"
            >
              {meses.map((m) => (
                <option key={m} value={m}>
                  {fmtMes(m)}
                </option>
              ))}
            </select>
          </div>
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
                {ocupacion.map((f) => (
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
              </tbody>
            </table>
          </div>
          {objetivoPct === undefined && (
            <p className="px-4 py-3 text-xs text-ink-soft border-t border-line">
              Define el % de facturabilidad objetivo en{' '}
              <button className="font-semibold text-primary-800 underline" onClick={() => setTab('configuracion')}>
                Configuración
              </button>{' '}
              para comparar cada persona con la meta del equipo.
            </p>
          )}
        </div>
      )}

      {tab === 'evolucion' && !sinDatos && (
        <div className="bg-surface rounded-[24px] shadow-soft border border-line p-4 sm:p-6">
          <h3 className="font-bold text-ink text-lg mb-1">Evolución mensual del equipo</h3>
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
      )}

      {tab === 'dedicacion' && !sinDatos && (
        <div className="space-y-4">
          <p className="text-xs text-ink-soft">
            Reparto de horas por proyecto/actividad de cada persona, sobre todo el periodo importado.
          </p>
          {dedicacion.map((d) => (
            <div key={d.persona} className="bg-surface rounded-[20px] shadow-soft border border-line p-5">
              <div className="flex items-baseline justify-between gap-3 mb-3">
                <h4 className="font-bold text-ink">{d.persona}</h4>
                <span className="text-xs text-ink-muted">{fmtNum(d.totalHoras)} h totales</span>
              </div>
              <div className="space-y-2">
                {d.reparto.slice(0, 8).map((r) => {
                  const tipo = clasificarActividad(r.proyecto)
                  return (
                    <div key={r.proyecto}>
                      <div className="flex items-center justify-between gap-3 text-xs mb-1">
                        <span className="truncate text-ink-soft" title={r.proyecto}>
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
                          className={`h-full rounded-full ${tipo === 'facturable' ? 'bg-success' : 'bg-info'}`}
                          style={{ width: `${Math.min(100, r.pct)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          {dedicacion.length === 0 && (
            <div className="rounded-[20px] border border-line bg-surface p-8 text-center text-sm text-ink-soft">
              Sin datos de dedicación todavía.
            </div>
          )}
        </div>
      )}

      {tab === 'persona' && !sinDatos && (
        <div className="bg-surface rounded-[24px] shadow-soft border border-line p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
            <h3 className="font-bold text-ink text-lg">Evolución mensual por persona</h3>
            <select
              value={personaVista ?? ''}
              onChange={(e) => setPersonaSel(e.target.value)}
              className="h-9 rounded-[10px] border border-line bg-surface px-3 text-sm font-semibold text-ink outline-none focus:border-accent-500"
            >
              {equipoActivo.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
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
      )}

      {tab === 'configuracion' && (
        <DepartmentConfig
          departamento={departamento}
          modulo={modulo}
          todasPersonasImportadas={todasPersonasImportadas}
          onImportFile={onImportFile}
          onUpdateRoster={onUpdateRoster}
          onSetObjetivo={onSetObjetivo}
        />
      )}
    </div>
  )
}

function DepartmentConfig({
  modulo,
  todasPersonasImportadas,
  onImportFile,
  onUpdateRoster,
  onSetObjetivo,
}: {
  departamento: string
  modulo: DepartmentModule | undefined
  todasPersonasImportadas: string[]
  onImportFile: (file: File) => void
  onUpdateRoster: (roster: DepartmentModule['roster']) => void
  onSetObjetivo: (pct: number | undefined) => void
}) {
  const roster = modulo?.roster ?? {}
  const seleccionadas = new Set(Object.keys(roster).filter((p) => roster[p].activo))

  const toggle = (persona: string) => {
    const next = { ...roster }
    if (next[persona]?.activo) delete next[persona]
    else next[persona] = { activo: true, jornadaPct: next[persona]?.jornadaPct ?? 100 }
    onUpdateRoster(next)
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="bg-surface rounded-[24px] shadow-soft border border-line p-4 sm:p-6">
        <h3 className="font-bold text-ink text-lg mb-1">Importar producción completa</h3>
        <p className="text-xs text-ink-soft mb-3">
          Sube el "Detalle de horas por empleado" de toda la producción (todas las personas, todos los
          proyectos) exportado de Concost. Cada nueva importación sustituye a la anterior.
        </p>
        <UploadZone
          label="Subir Excel de produccion completa"
          hint="produccionhorasempleadodetalle*.xlsx"
          onFiles={(files) => files[0] && onImportFile(files[0])}
        />
      </div>

      <div className="bg-surface rounded-[24px] shadow-soft border border-line p-4 sm:p-6">
        <h3 className="font-bold text-ink text-lg mb-1">Equipo del departamento</h3>
        <p className="text-xs text-ink-soft mb-3">
          Marca qué personas (de las que aparecen en el Excel importado) forman parte de tu equipo.
        </p>
        {todasPersonasImportadas.length === 0 ? (
          <p className="text-sm text-ink-soft">Importa antes el Excel de producción completa.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 max-h-[28rem] overflow-y-auto pr-1">
            {todasPersonasImportadas.map((persona) => (
              <label key={persona} className="flex items-center gap-2 py-1 text-sm text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={seleccionadas.has(persona)}
                  onChange={() => toggle(persona)}
                  className="h-4 w-4 rounded border-line accent-accent-500"
                />
                <span className="truncate">{persona}</span>
              </label>
            ))}
          </div>
        )}
        <div className="mt-3 text-xs text-ink-muted">{seleccionadas.size} personas seleccionadas</div>
      </div>

      <div className="bg-surface rounded-[24px] shadow-soft border border-line p-4 sm:p-6">
        <h3 className="font-bold text-ink text-lg mb-1">Objetivo de facturabilidad</h3>
        <p className="text-xs text-ink-soft mb-3">
          % de horas facturables que se espera de cada persona. Se usa para comparar el real de cada
          uno en la pestaña Ocupación.
        </p>
        <label className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={100}
            step="any"
            value={modulo?.objetivoFacturablePct ?? ''}
            onChange={(e) =>
              onSetObjetivo(e.target.value === '' ? undefined : Number(e.target.value))
            }
            className="w-24 border border-line rounded-[10px] px-3 py-2 text-sm text-ink focus:ring-2 focus:ring-accent-500/40 focus:border-accent-500 outline-none"
          />
          <span className="text-sm text-ink-soft">%</span>
        </label>
      </div>
    </div>
  )
}
