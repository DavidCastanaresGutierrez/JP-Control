import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
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
  comparativaOcupacion,
  dashboardDepartamento,
  dedicacionPorPersona,
  distribucionPorProyecto,
  distribucionPorTipoActividad,
  evolucionFacturabilidadPersona,
  evolucionTemporalDepartamento,
  mesesDisponibles,
  mesVencido,
  personasActivas,
  posiblesBajas,
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

function normalizarBusqueda(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function truncarEtiqueta(value: string, max = 26): string {
  return value.length > max ? `${value.slice(0, max - 1)}\u2026` : value
}

function ToggleMesHistorico({
  modo,
  onChange,
}: {
  modo: 'curso' | 'vencido'
  onChange: (modo: 'curso' | 'vencido') => void
}) {
  return (
    <div className="flex rounded-full border border-line p-0.5 text-xs">
      <button
        onClick={() => onChange('curso')}
        className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${
          modo === 'curso' ? 'bg-accent-500 text-primary-950' : 'text-ink-soft hover:bg-surface-muted'
        }`}
      >
        Mes en curso
      </button>
      <button
        onClick={() => onChange('vencido')}
        title="No incluye el mes en curso, y da unos d\u00edas de margen tras acabar el mes anterior antes de darlo por cerrado"
        className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${
          modo === 'vencido' ? 'bg-accent-500 text-primary-950' : 'text-ink-soft hover:bg-surface-muted'
        }`}
      >
        Mes vencido
      </button>
    </div>
  )
}

export function DepartmentDashboard({
  departamento,
  modulo,
  puedeVerTodosDepartamentos,
  onChooseDepartamento,
  onImportFile,
  onUpdateRoster,
  onSetObjetivo,
  onSetMesInicio,
}: {
  departamento: string | null
  modulo: DepartmentModule | undefined
  /** Si puede volver a elegir cualquier otro departamento (hoy, cualquiera con acceso al módulo). */
  puedeVerTodosDepartamentos: boolean
  onChooseDepartamento: (nombre: string | null) => void
  onImportFile: (file: File) => void
  onUpdateRoster: (roster: DepartmentModule['roster']) => void
  onSetObjetivo: (pct: number | undefined) => void
  onSetMesInicio: (mes: string | undefined) => void
}) {
  const [tab, setTab] = useState<Tab>('panel')
  const [mesSel, setMesSel] = useState<string | null>(null)
  const [personaSel, setPersonaSel] = useState<string | null>(null)
  const [personasComparativa, setPersonasComparativa] = useState<Set<string> | null>(null)
  const [medidaComparativa, setMedidaComparativa] = useState<'ocupacion' | 'horas' | 'facturable'>(
    'ocupacion',
  )
  const [buscadorDedicacion, setBuscadorDedicacion] = useState('')
  const [buscadorPersona, setBuscadorPersona] = useState('')
  const [filtroEstadoOcupacion, setFiltroEstadoOcupacion] = useState<'baja' | 'sobre' | null>(null)
  const [personaDetalleDedicacion, setPersonaDetalleDedicacion] = useState<string | null>(null)
  const [proyectoFiltroDedicacion, setProyectoFiltroDedicacion] = useState<string | null>(null)
  const [modoHistorico, setModoHistorico] = useState<'curso' | 'vencido'>('curso')

  const meses = useMemo(() => (modulo ? mesesDisponibles(modulo) : []), [modulo])
  const mesActual = mesSel ?? (modulo ? ultimoMesConDatos(modulo) : null)
  const mesVencidoCalc = useMemo(() => mesVencido(meses), [meses])
  const enMesEnCurso = mesSel === null
  const enMesVencido = mesSel !== null && mesSel === mesVencidoCalc
  const irAMesEnCurso = () => setMesSel(null)
  const irAMesVencido = () => mesVencidoCalc && setMesSel(mesVencidoCalc)

  const dashboard = useMemo(
    () => (modulo && mesActual ? dashboardDepartamento(modulo, mesActual) : null),
    [modulo, mesActual],
  )
  const ocupacion = useMemo(
    () => (modulo && mesActual ? tablaOcupacion(modulo, mesActual) : []),
    [modulo, mesActual],
  )
  const ocupacionFiltrada = useMemo(
    () => (filtroEstadoOcupacion ? ocupacion.filter((f) => f.estado === filtroEstadoOcupacion) : ocupacion),
    [ocupacion, filtroEstadoOcupacion],
  )
  const dedicacion = useMemo(() => (modulo ? dedicacionPorPersona(modulo) : []), [modulo])
  const equipoActivo = useMemo(() => (modulo ? personasActivas(modulo) : []), [modulo])
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
  const hastaMesHistorico = modoHistorico === 'vencido' ? (mesVencidoCalc ?? undefined) : undefined
  const evolucionPersona = useMemo(
    () =>
      modulo && personaVista
        ? evolucionFacturabilidadPersona(modulo, personaVista, undefined, hastaMesHistorico)
        : [],
    [modulo, personaVista, hastaMesHistorico],
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
    () => (modulo ? evolucionTemporalDepartamento(modulo, undefined, hastaMesHistorico) : []),
    [modulo, hastaMesHistorico],
  )
  const comparativa = useMemo(
    () => (modulo ? comparativaOcupacion(modulo, undefined, hastaMesHistorico) : { meses: [], filas: [] }),
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
    return PIE_COLORS[(idx < 0 ? 0 : idx) % PIE_COLORS.length]
  }
  const toggleComparativa = (persona: string) => {
    setPersonasComparativa((prev) => {
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
  const objetivoPct = modulo?.objetivoFacturablePct

  if (!departamento) {
    if (!puedeVerTodosDepartamentos) {
      return (
        <div className="p-4 sm:p-6 max-w-xl">
          <h1 className="font-display text-[26px] font-extrabold text-ink tracking-tight sm:text-[30px]">
            Control por Departamento
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Todavía no tienes un departamento asignado. Pide a un administrador que te lo asigne en la
            pestaña Administración.
          </p>
        </div>
      )
    }
    return (
      <div className="p-4 sm:p-6 max-w-xl">
        <h1 className="font-display text-[26px] font-extrabold text-ink tracking-tight sm:text-[30px]">
          Control por Departamento
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
          {puedeVerTodosDepartamentos && (
            <button
              type="button"
              onClick={() => onChooseDepartamento(null)}
              className="mb-1 text-xs font-semibold text-ink-soft hover:text-ink hover:underline"
            >
              ← Cambiar departamento
            </button>
          )}
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
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-full border border-line p-0.5 text-xs">
                <button
                  type="button"
                  onClick={irAMesEnCurso}
                  className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${
                    enMesEnCurso ? 'bg-accent-500 text-primary-950' : 'text-ink-soft hover:bg-surface-muted'
                  }`}
                >
                  Mes en curso
                </button>
                <button
                  type="button"
                  onClick={irAMesVencido}
                  title="Último mes ya cerrado, con unos días de margen para que todos terminen de fichar el mes anterior"
                  className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${
                    enMesVencido ? 'bg-accent-500 text-primary-950' : 'text-ink-soft hover:bg-surface-muted'
                  }`}
                >
                  Mes vencido
                </button>
              </div>
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
            <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
              <KpiCard label="Horas internas / gestión" value={`${fmtNum(dashboard.horasInternas)} h`} accent="slate" />
              <KpiCard label="Horas de soporte" value={`${fmtNum(dashboard.horasSoporte)} h`} accent="slate" />
              <KpiCard label="Horas de innovación" value={`${fmtNum(dashboard.horasInnovacion)} h`} accent="slate" />
              <KpiCard label="Horas de formación" value={`${fmtNum(dashboard.horasFormacion)} h`} accent="slate" />
              <KpiCard label="Horas de vacaciones" value={`${fmtNum(dashboard.horasVacaciones)} h`} accent="slate" />
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
                onClick={
                  dashboard.personasSobreocupadas > 0
                    ? () => {
                        setFiltroEstadoOcupacion('sobre')
                        setTab('ocupacion')
                      }
                    : undefined
                }
              />
              <KpiCard
                label="Personas infraocupadas"
                value={String(dashboard.personasInfraocupadas)}
                icon={<EmojiIcon>{dashboard.personasInfraocupadas > 0 ? emoji.alert : emoji.check}</EmojiIcon>}
                accent={dashboard.personasInfraocupadas > 0 ? 'amber' : 'emerald'}
                onClick={
                  dashboard.personasInfraocupadas > 0
                    ? () => {
                        setFiltroEstadoOcupacion('baja')
                        setTab('ocupacion')
                      }
                    : undefined
                }
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
                <ToggleMesHistorico modo={modoHistorico} onChange={setModoHistorico} />
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
                      onClick={() => setMedidaComparativa(m.id)}
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
                  onClick={() => setPersonasComparativa(new Set(comparativa.filas.map((f) => f.persona)))}
                  className="border border-line rounded-full px-2.5 py-1 text-ink-soft hover:bg-surface-muted transition-colors"
                >
                  Todos
                </button>
                <button
                  onClick={() => setPersonasComparativa(new Set())}
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
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-full border border-line p-0.5 text-xs">
                <button
                  type="button"
                  onClick={irAMesEnCurso}
                  className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${
                    enMesEnCurso ? 'bg-accent-500 text-primary-950' : 'text-ink-soft hover:bg-surface-muted'
                  }`}
                >
                  Mes en curso
                </button>
                <button
                  type="button"
                  onClick={irAMesVencido}
                  title="Último mes ya cerrado, con unos días de margen para que todos terminen de fichar el mes anterior"
                  className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${
                    enMesVencido ? 'bg-accent-500 text-primary-950' : 'text-ink-soft hover:bg-surface-muted'
                  }`}
                >
                  Mes vencido
                </button>
              </div>
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
          </div>
          {filtroEstadoOcupacion && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-line bg-surface-muted/60 text-xs">
              <span className="text-ink-soft">
                Mostrando solo personas con{' '}
                <span className="font-bold text-ink">{ESTADO_LABEL[filtroEstadoOcupacion].toLowerCase()}</span>.
              </span>
              <button
                type="button"
                onClick={() => setFiltroEstadoOcupacion(null)}
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
              <button className="font-semibold text-primary-800 underline" onClick={() => setTab('configuracion')}>
                Configuración
              </button>{' '}
              para comparar cada persona con la meta del equipo.
            </p>
          )}
          </div>
        </div>
      )}

      {tab === 'evolucion' && !sinDatos && (
        <div className="bg-surface rounded-[24px] shadow-soft border border-line p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
            <h3 className="font-bold text-ink text-lg">Evolución mensual del equipo</h3>
            <ToggleMesHistorico modo={modoHistorico} onChange={setModoHistorico} />
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
      )}

      {tab === 'dedicacion' && !sinDatos && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-ink-soft">
              Reparto de horas por proyecto/actividad de cada persona, sobre todo el periodo importado.
            </p>
            <label className="relative w-full sm:w-64">
              <span className="sr-only">Buscar persona</span>
              <input
                value={buscadorDedicacion}
                onChange={(e) => setBuscadorDedicacion(e.target.value)}
                placeholder="Buscar persona"
                className="h-9 w-full rounded-[10px] border border-line bg-surface px-3 pr-8 text-sm text-ink outline-none focus:border-accent-500"
              />
              {buscadorDedicacion && (
                <button
                  type="button"
                  onClick={() => setBuscadorDedicacion('')}
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
                onClick={() => setProyectoFiltroDedicacion(null)}
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
                onClick={() => setPersonaDetalleDedicacion(expandida ? null : d.persona)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setPersonaDetalleDedicacion(expandida ? null : d.persona)
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
                    const tipo = clasificarActividad(r.proyecto)
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
                            className={`h-full rounded-full ${tipo === 'facturable' ? 'bg-success' : 'bg-info'}`}
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
                    <ResponsiveContainer width="100%" height={Math.max(160, reparteGrafico.length * 32)}>
                      <BarChart data={reparteGrafico} layout="vertical" margin={{ left: 4, right: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} horizontal={false} />
                        <XAxis type="number" tick={CHART_AXIS} unit=" h" />
                        <YAxis
                          type="category"
                          dataKey="proyecto"
                          tick={{ ...CHART_AXIS, fontSize: 11 }}
                          tickFormatter={(v) => truncarEtiqueta(String(v))}
                          width={190}
                        />
                        <Tooltip
                          formatter={(v) => `${fmtNum(Number(v))} h`}
                          labelFormatter={(label) => truncarEtiqueta(String(label), 30)}
                          contentStyle={{ ...TOOLTIP_STYLE, maxWidth: 200 }}
                          allowEscapeViewBox={{ x: false, y: true }}
                        />
                        <Bar dataKey="horas" radius={[0, 4, 4, 0]}>
                          {reparteGrafico.map((r) => (
                            <Cell
                              key={r.proyecto}
                              fill={clasificarActividad(r.proyecto) === 'facturable' ? '#7CE7C8' : '#3A8DFF'}
                              cursor="pointer"
                              onClick={(e) => {
                                e?.stopPropagation?.()
                                setProyectoFiltroDedicacion((prev) => (prev === r.proyecto ? null : r.proyecto))
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
      )}

      {tab === 'persona' && !sinDatos && (
        <div className="bg-surface rounded-[24px] shadow-soft border border-line p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
            <h3 className="font-bold text-ink text-lg">Evolución mensual por persona</h3>
            <div className="flex flex-wrap items-center gap-2">
              <ToggleMesHistorico modo={modoHistorico} onChange={setModoHistorico} />
              <label className="relative w-full sm:w-56">
                <span className="sr-only">Buscar persona</span>
                <input
                  value={buscadorPersona}
                  onChange={(e) => setBuscadorPersona(e.target.value)}
                  placeholder="Buscar persona"
                  className="h-9 w-full rounded-[10px] border border-line bg-surface px-3 pr-8 text-sm text-ink outline-none focus:border-accent-500"
                />
                {buscadorPersona && (
                  <button
                    type="button"
                    onClick={() => setBuscadorPersona('')}
                    aria-label="Limpiar busqueda"
                    className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-sm font-black text-ink-muted hover:bg-surface-muted hover:text-ink"
                  >
                    x
                  </button>
                )}
              </label>
              <select
                value={personaVista ?? ''}
                onChange={(e) => setPersonaSel(e.target.value)}
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
      )}

      {tab === 'configuracion' && (
        <DepartmentConfig
          departamento={departamento}
          modulo={modulo}
          todasPersonasImportadas={todasPersonasImportadas}
          onImportFile={onImportFile}
          onUpdateRoster={onUpdateRoster}
          onSetObjetivo={onSetObjetivo}
          onSetMesInicio={onSetMesInicio}
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
  onSetMesInicio,
}: {
  departamento: string
  modulo: DepartmentModule | undefined
  todasPersonasImportadas: string[]
  onImportFile: (file: File) => void
  onUpdateRoster: (roster: DepartmentModule['roster']) => void
  onSetObjetivo: (pct: number | undefined) => void
  onSetMesInicio: (mes: string | undefined) => void
}) {
  const roster = modulo?.roster ?? {}
  const seleccionadas = new Set(Object.keys(roster).filter((p) => roster[p].activo))
  const avisosBaja = useMemo(() => (modulo ? posiblesBajas(modulo) : []), [modulo])

  const toggle = (persona: string) => {
    const next = { ...roster }
    if (next[persona]?.activo) delete next[persona]
    else next[persona] = { activo: true, jornadaPct: next[persona]?.jornadaPct ?? 100 }
    onUpdateRoster(next)
  }

  const setFechaBaja = (persona: string, fechaBaja: string | undefined) => {
    const next = { ...roster, [persona]: { ...roster[persona], fechaBaja } }
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
          Marca qué personas (de las que aparecen en el Excel importado) forman parte de tu equipo. Si
          alguien se ha ido de la empresa, ponle la fecha de baja para que deje de contar en Ocupación y
          en las alertas sin perder su histórico.
        </p>
        {avisosBaja.length > 0 && (
          <div className="mb-3 rounded-[14px] border border-warning/40 bg-warning/10 px-4 py-3 text-xs text-[#8A5A00]">
            <p className="font-bold mb-2">
              {avisosBaja.length === 1
                ? '1 persona sin actividad reciente'
                : `${avisosBaja.length} personas sin actividad reciente`}
            </p>
            <p className="mb-2">
              Puede que se hayan ido de la empresa. Se estima la fecha de baja a partir de su último
              mes con actividad real; confírmala si es correcta o corrígela abajo en su fila.
            </p>
            <div className="space-y-1.5">
              {avisosBaja.map((a) => (
                <div key={a.persona} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-semibold">{a.persona}</span>
                    {a.ultimoMesConActividad ? (
                      <> · última actividad real: {fmtMes(a.ultimoMesConActividad)}</>
                    ) : (
                      <> · sin actividad real registrada</>
                    )}
                    {' · baja sugerida: '}
                    <span className="font-semibold">{fmtMes(a.fechaBajaSugerida)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setFechaBaja(a.persona, a.fechaBajaSugerida)}
                    className="shrink-0 rounded-full bg-warning/25 px-2.5 py-1 font-bold text-[#8A5A00] hover:bg-warning/35 transition-colors"
                  >
                    Confirmar baja
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        {todasPersonasImportadas.length === 0 ? (
          <p className="text-sm text-ink-soft">Importa antes el Excel de producción completa.</p>
        ) : (
          <div className="flex flex-col divide-y divide-line/60 max-h-[28rem] overflow-y-auto pr-1">
            {todasPersonasImportadas.map((persona) => (
              <div key={persona} className="flex items-center gap-2 py-1.5">
                <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={seleccionadas.has(persona)}
                    onChange={() => toggle(persona)}
                    className="h-4 w-4 shrink-0 rounded border-line accent-accent-500"
                  />
                  <span className="truncate">{persona}</span>
                </label>
                {seleccionadas.has(persona) && (
                  <div className="flex shrink-0 items-center gap-1">
                    <input
                      type="month"
                      value={roster[persona]?.fechaBaja ?? ''}
                      onChange={(e) => setFechaBaja(persona, e.target.value || undefined)}
                      title="Fecha de baja (opcional): a partir de este mes deja de contar en Ocupación y alertas"
                      className="w-[8.5rem] rounded-md border border-line px-1.5 py-0.5 text-xs text-ink-soft outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/40"
                    />
                    {roster[persona]?.fechaBaja && (
                      <button
                        type="button"
                        onClick={() => setFechaBaja(persona, undefined)}
                        className="text-[11px] font-semibold text-ink-soft underline hover:text-ink"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                )}
              </div>
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

      <div className="bg-surface rounded-[24px] shadow-soft border border-line p-4 sm:p-6">
        <h3 className="font-bold text-ink text-lg mb-1">Mes de inicio del análisis</h3>
        <p className="text-xs text-ink-soft mb-3">
          Descarta el histórico de horas anterior a este mes en todos los cálculos y gráficos (útil
          tras una reestructuración de equipo, por ejemplo). Déjalo en blanco para usar todo el
          histórico importado.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={modulo?.mesInicio ?? ''}
            onChange={(e) => onSetMesInicio(e.target.value || undefined)}
            className="border border-line rounded-[10px] px-3 py-2 text-sm text-ink focus:ring-2 focus:ring-accent-500/40 focus:border-accent-500 outline-none"
          />
          {modulo?.mesInicio && (
            <button
              type="button"
              onClick={() => onSetMesInicio(undefined)}
              className="text-xs font-semibold text-ink-soft underline hover:text-ink"
            >
              Quitar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
