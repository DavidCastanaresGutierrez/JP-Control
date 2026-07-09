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
import type { Project } from '../types'
import { controlDepartamentos, enAlerta, kpis, monthlySeries } from '../lib/metrics'
import { fmtEur, fmtFecha, fmtMes, fmtPct, fmtRatio } from '../lib/format'
import { KpiCard } from './KpiCard'
import { EntriesTable } from './EntriesTable'
import { HoursView } from './HoursView'
import { Ajustes } from './Ajustes'

// Paleta de gráficos derivada del sistema de diseño (mint + petróleo + estados)
const PIE_COLORS = ['#7CE7C8', '#143A45', '#3A8DFF', '#F2B84B', '#E05A47', '#1B4A55', '#5C6F75']
const CHART_GRID = '#E2ECE9'
const CHART_AXIS = { fontSize: 12, fill: '#8A9A9E' }

type Tab = 'panel' | 'horas' | 'movimientos' | 'ajustes'

export function ProjectDashboard({
  project,
  onUpdate,
  onDelete,
  onImportHours,
}: {
  project: Project
  onUpdate: (patch: Partial<Project>) => void
  onDelete: () => void
  onImportHours: (files: File[]) => void
}) {
  const [tab, setTab] = useState<Tab>('panel')
  const k = useMemo(() => kpis(project), [project])
  const serie = useMemo(() => monthlySeries(project.entries), [project.entries])
  const control = useMemo(
    () => controlDepartamentos(project),
    [project],
  )
  const gastoPorDept = useMemo(
    () => control.filas.filter((f) => f.coste > 0).map((f) => ({ name: f.dept, value: f.coste })),
    [control],
  )

  const budget = project.budget ?? project.contractValue
  const contrato = project.contractValue ?? project.budget
  const alerta = enAlerta(k)
  const atencion =
    k.desvioFacturacion !== null && k.desvioFacturacion < 0 && k.desvioFacturacion >= -10
  const alertaGasto = k.desvioGasto !== null && k.desvioGasto > 10

  // Barra principal: facturado / importe de contrato, con marca de dónde debería ir según el
  // avance técnico.
  const consumido = k.facturacion
  const facturasExt = control.filas.reduce((s, f) => s + f.costeExterno, 0)
  const consumidoPct = contrato && contrato > 0 ? (consumido / contrato) * 100 : null
  const avance = k.avancePct
  const sobreAvance = consumidoPct !== null && avance !== null ? consumidoPct - avance : null
  const consumoEstado =
    sobreAvance === null ? 'sin' : sobreAvance > 5 ? 'exceso' : sobreAvance > 0 ? 'atencion' : 'ok'

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'panel', label: 'Panel' },
    { id: 'horas', label: 'Horas' },
    { id: 'movimientos', label: 'Facturas' },
    { id: 'ajustes', label: 'Configuración' },
  ]

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-extrabold text-ink tracking-tight">
            {project.name}
          </h1>
          <div className="text-sm text-ink-soft mt-0.5">
            {project.code}
            {project.director && <> · Dir.: {project.director}</>}
            {project.hasta && <> · Datos hasta {fmtFecha(project.hasta)}</>}
          </div>
        </div>
        <div className="flex rounded-full border border-line bg-surface p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 h-9 text-sm font-semibold rounded-full transition-colors ${
                tab === t.id ? 'bg-accent-500 text-primary-950' : 'text-ink-soft hover:bg-surface-muted'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'panel' && (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label="Facturado"
              value={fmtEur(k.facturacion)}
              icon="🧾"
              accent="emerald"
              sub={
                contrato
                  ? `${k.facturadoPct !== null ? fmtPct(k.facturadoPct) : ''} de ${fmtEur(contrato)} de contrato`
                  : 'sin importe de contrato definido'
              }
            />
            <KpiCard
              label="Avance / Facturación"
              value={k.ratioAvanceFacturacion !== null ? fmtRatio(k.ratioAvanceFacturacion) : '—'}
              icon={alerta ? '⚠️' : atencion ? '👀' : '✅'}
              accent={alerta ? 'rose' : atencion ? 'amber' : 'emerald'}
              sub={
                k.ratioAvanceFacturacion !== null
                  ? `avance ${fmtPct(k.avancePct!)} / facturado ${fmtPct(k.facturadoPct!)} — ${
                      k.ratioAvanceFacturacion > 1
                        ? 'trabajo pendiente de facturar'
                        : 'facturación al día'
                    }`
                  : 'define contrato y avance en Configuración'
              }
            />
            <KpiCard
              label="Gasto acumulado"
              value={fmtEur(k.gasto)}
              icon="💸"
              accent={alertaGasto ? 'rose' : 'indigo'}
              sub={
                <>
                  {k.consumoPct !== null
                    ? `${fmtPct(k.consumoPct)} de ${fmtEur(budget!)} presupuestados`
                    : 'sin presupuesto definido'}
                  {facturasExt > 0 && (
                    <>
                      <br />
                      personal {fmtEur(k.gasto - facturasExt)} + facturas {fmtEur(facturasExt)}
                    </>
                  )}
                </>
              }
            />
            <KpiCard
              label="Resultado"
              value={fmtEur(k.resultado)}
              icon={k.resultado >= 0 ? '📈' : '📉'}
              accent={k.resultado >= 0 ? 'emerald' : 'rose'}
              sub={k.margenPct !== null ? `margen ${fmtPct(k.margenPct)}` : undefined}
            />
          </div>

          {/* Consumo sobre presupuesto (barra principal unificada) */}
          <div className="bg-surface rounded-[24px] shadow-soft border border-line p-6">
            <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
              <div>
                <h3 className="font-bold text-ink text-lg">Facturado sobre contrato</h3>
                <p className="text-xs text-ink-soft mt-0.5">
                  Facturado / importe de contrato. La marca indica dónde debería ir según el
                  avance.
                </p>
              </div>
              {consumidoPct !== null && (
                <div className="text-right">
                  <div
                    className={`font-display text-4xl font-extrabold leading-none tabular-nums ${
                      consumoEstado === 'exceso'
                        ? 'text-danger'
                        : consumoEstado === 'atencion'
                          ? 'text-warning'
                          : 'text-success'
                    }`}
                  >
                    {fmtPct(consumidoPct)}
                  </div>
                  <div className="text-xs text-ink-soft mt-1">
                    {fmtEur(consumido)} de {fmtEur(contrato!)}
                  </div>
                </div>
              )}
            </div>

            {consumidoPct !== null ? (
              <>
                {/* Barra grande con marca de avance */}
                <div className="relative h-14 rounded-2xl bg-surface-muted overflow-hidden shadow-[inset_0_1px_3px_rgba(16,42,50,0.08)]">
                  <div
                    className={`h-full rounded-2xl transition-all shadow-soft ${
                      consumoEstado === 'exceso'
                        ? 'bg-danger'
                        : consumoEstado === 'atencion'
                          ? 'bg-warning'
                          : 'bg-success'
                    }`}
                    style={{ width: `${Math.min(100, consumidoPct)}%` }}
                  />
                  {/* Marca del avance objetivo, alineada con la barra */}
                  {avance !== null && (
                    <div
                      className="absolute top-0 h-full w-[3px] bg-primary-950/80 rounded-full"
                      style={{ left: `calc(${Math.min(100, avance)}% - 1.5px)` }}
                    />
                  )}
                </div>
                {avance !== null && (
                  <div className="relative h-6 mt-1.5">
                    <div
                      className="absolute -translate-x-1/2 whitespace-nowrap text-[11px] font-bold text-ink bg-surface border border-line rounded-full px-2 py-0.5 shadow-soft"
                      style={{ left: `${Math.min(100, Math.max(6, avance))}%` }}
                    >
                      Objetivo por avance: {fmtPct(avance)}
                    </div>
                  </div>
                )}

                {/* Resumen compacto de los tres importes */}
                <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                  <div className="rounded-[14px] bg-surface-muted py-3">
                    <div className="text-[11px] text-ink-muted">Facturado</div>
                    <div className="text-sm font-bold text-ink tabular-nums">
                      {fmtEur(k.facturacion)}
                    </div>
                  </div>
                  <div className="rounded-[14px] bg-surface-muted py-3">
                    <div className="text-[11px] text-ink-muted">Gasto acumulado</div>
                    <div className="text-sm font-bold text-ink tabular-nums">{fmtEur(k.gasto)}</div>
                  </div>
                  <div className="rounded-[14px] bg-surface-muted py-3">
                    <div className="text-[11px] text-ink-muted">Avance técnico</div>
                    <div className="text-sm font-bold text-ink tabular-nums">
                      {avance !== null ? fmtPct(avance) : '—'}
                    </div>
                  </div>
                </div>

                <p
                  className={`text-sm rounded-[14px] px-4 py-2.5 mt-4 font-medium ${
                    consumoEstado === 'exceso'
                      ? 'bg-danger/10 text-danger'
                      : consumoEstado === 'atencion'
                        ? 'bg-warning/15 text-[#8A5A00]'
                        : 'bg-success/10 text-success'
                  }`}
                >
                  {avance === null
                    ? `Has facturado el ${fmtPct(consumidoPct)} del contrato. Define el % de avance en Configuración para compararlo.`
                    : consumoEstado === 'exceso'
                      ? `⚠ La facturación (${fmtPct(consumidoPct)}) va ${fmtPct(sobreAvance!)} por delante del avance (${fmtPct(avance)}): a este ritmo el contrato se queda corto.`
                      : consumoEstado === 'atencion'
                        ? `La facturación (${fmtPct(consumidoPct)}) va ligeramente por delante del avance (${fmtPct(avance)}). Vigilar.`
                        : `La facturación (${fmtPct(consumidoPct)}) va en línea o por debajo del avance (${fmtPct(avance)}). Vas bien.`}
                </p>
              </>
            ) : (
              <p className="text-sm text-ink-soft">
                Define el importe de contrato (y el % de avance) en la pestaña{' '}
                <button
                  className="text-primary-800 font-semibold underline hover:text-primary-900"
                  onClick={() => setTab('ajustes')}
                >
                  Configuración
                </button>{' '}
                para ver esta barra.
              </p>
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            {/* Gasto por departamento */}
            <div className="bg-surface rounded-[24px] shadow-soft border border-line p-6">
              <h3 className="font-bold text-ink text-lg mb-1">Gasto por departamento</h3>
              <p className="text-xs text-ink-soft mb-3">
                Coste de personal más facturas de externos asignadas a cada departamento. La
                asignación se configura en Configuración.
              </p>
              {gastoPorDept.length > 0 ? (
                <div className="space-y-4">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={gastoPorDept}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={2}
                      >
                        {gastoPorDept.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v) => fmtEur(Number(v))}
                        contentStyle={{ borderRadius: 12, border: '1px solid #DDE7E4', fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {gastoPorDept.map((d, i) => {
                      const total = gastoPorDept.reduce((s, x) => s + x.value, 0)
                      return (
                        <div key={d.name} className="flex items-center gap-2 text-sm">
                          <span
                            className="w-3 h-3 rounded-sm shrink-0"
                            style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                          />
                          <span className="flex-1 truncate text-ink-soft">{d.name}</span>
                          <span className="text-ink-muted text-xs tabular-nums">
                            {total > 0 ? fmtPct((d.value / total) * 100) : ''}
                          </span>
                          <span className="font-bold text-ink tabular-nums">{fmtEur(d.value)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-ink-soft">
                  Asigna personas y facturas a departamentos en{' '}
                  <button
                    className="text-primary-800 font-semibold underline hover:text-primary-900"
                    onClick={() => setTab('ajustes')}
                  >
                    Configuración
                  </button>{' '}
                  para ver este reparto.
                </p>
              )}
            </div>

            {/* Evolución mensual */}
            <div className="bg-surface rounded-[24px] shadow-soft border border-line p-6">
              <h3 className="font-bold text-ink text-lg mb-4">Evolución mensual</h3>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={serie.map((s) => ({ ...s, mesLabel: fmtMes(s.mes) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                  <XAxis dataKey="mesLabel" tick={CHART_AXIS} />
                  <YAxis tick={CHART_AXIS} tickFormatter={(v) => fmtEur(v)} width={90} />
                  <Tooltip
                    formatter={(v) => fmtEur(Number(v))}
                    contentStyle={{ borderRadius: 12, border: '1px solid #DDE7E4', fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="gasto" name="Gasto mes" fill="#1B4A55" fillOpacity={0.55} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="facturacion" name="Facturación mes" fill="#B9F8E5" radius={[4, 4, 0, 0]} />
                  <Line
                    type="monotone"
                    dataKey="gastoAcum"
                    name="Gasto acumulado"
                    stroke="#143A45"
                    strokeWidth={2.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="facturacionAcum"
                    name="Facturación acumulada"
                    stroke="#1FAE7A"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {tab === 'horas' && (
        <HoursView project={project} onImportHours={onImportHours} onUpdate={onUpdate} />
      )}
      {tab === 'movimientos' && <EntriesTable entries={project.entries} />}
      {tab === 'ajustes' && (
        <Ajustes project={project} onUpdate={onUpdate} onDelete={onDelete} />
      )}
    </div>
  )
}
