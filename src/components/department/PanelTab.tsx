import { useMemo } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { DepartmentModule } from '../../types'
import {
  dashboardDepartamento,
  distribucionPorProyecto,
  distribucionPorTipoActividad,
  esActividadFacturable,
} from '../../lib/departmentMetrics'
import { fmtNum, fmtPct } from '../../lib/format'
import { emoji } from '../../lib/emoji'
import { EmojiIcon } from '../../lib/EmojiIcon'
import { KpiCard } from '../KpiCard'
import { PIE_COLORS, TIPO_ACTIVIDAD_COLOR, TOOLTIP_STYLE } from './theme'
import { SelectorMes } from './SelectorMes'

export function PanelTab({
  modulo,
  meses,
  mesActual,
  enMesEnCurso,
  enMesVencido,
  onMesEnCurso,
  onMesVencido,
  onMes,
  onVerAlertaOcupacion,
}: {
  modulo: DepartmentModule
  meses: string[]
  mesActual: string | null
  enMesEnCurso: boolean
  enMesVencido: boolean
  onMesEnCurso: () => void
  onMesVencido: () => void
  onMes: (mes: string) => void
  /** Salta a la pestaña Ocupación filtrando por el estado indicado. */
  onVerAlertaOcupacion: (estado: 'baja' | 'sobre') => void
}) {
  const dashboard = useMemo(
    () => (mesActual ? dashboardDepartamento(modulo, mesActual) : null),
    [modulo, mesActual],
  )
  const distProyecto = useMemo(
    () => (mesActual ? distribucionPorProyecto(modulo, mesActual) : []),
    [modulo, mesActual],
  )
  const distTipo = useMemo(
    () => (mesActual ? distribucionPorTipoActividad(modulo, mesActual) : []),
    [modulo, mesActual],
  )

  if (!dashboard) return null

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-bold text-ink text-lg">Resumen del mes</h3>
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
          Detalle por tipo de actividad
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
              dashboard.personasSobreocupadas > 0 ? () => onVerAlertaOcupacion('sobre') : undefined
            }
          />
          <KpiCard
            label="Personas infraocupadas"
            value={String(dashboard.personasInfraocupadas)}
            icon={<EmojiIcon>{dashboard.personasInfraocupadas > 0 ? emoji.alert : emoji.check}</EmojiIcon>}
            accent={dashboard.personasInfraocupadas > 0 ? 'amber' : 'emerald'}
            onClick={
              dashboard.personasInfraocupadas > 0 ? () => onVerAlertaOcupacion('baja') : undefined
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
            En verdes, los tipos que facturan (trabajo de cliente, innovación y soporte);
            formación, gestión interna y vacaciones no facturan.
          </p>
          {distTipo.some((d) => d.horas > 0) ? (
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={distTipo.filter((d) => d.horas > 0)}
                    dataKey="horas"
                    nameKey="clave"
                    innerRadius={50}
                    outerRadius={82}
                    paddingAngle={2}
                  >
                    {distTipo
                      .filter((d) => d.horas > 0)
                      .map((d) => (
                        <Cell key={d.tipo} fill={TIPO_ACTIVIDAD_COLOR[d.tipo]} />
                      ))}
                  </Pie>
                  <Tooltip formatter={(v) => `${fmtNum(Number(v))} h`} contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {distTipo.map((d) => (
                  <div
                    key={d.clave}
                    className={`flex items-center gap-2 text-sm ${d.horas === 0 ? 'opacity-50' : ''}`}
                  >
                    <span
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{ backgroundColor: TIPO_ACTIVIDAD_COLOR[d.tipo] }}
                    />
                    <span className="flex-1 min-w-0 truncate text-ink-soft">{d.clave}</span>
                    <span className="shrink-0 text-ink-muted text-xs tabular-nums">{fmtPct(d.pct)}</span>
                    <span className="shrink-0 font-bold text-ink tabular-nums">{fmtNum(d.horas)} h</span>
                  </div>
                ))}
              </div>
              {(() => {
                const total = distTipo.reduce((s, d) => s + d.horas, 0)
                const facturableTotal = distTipo
                  .filter((d) => esActividadFacturable(d.tipo))
                  .reduce((s, d) => s + d.horas, 0)
                return (
                  <div className="flex items-center gap-2 border-t border-line pt-3 text-sm">
                    <span className="flex-1 font-semibold text-ink">
                      Facturable total
                      <span className="ml-1.5 font-normal text-xs text-ink-muted">
                        (incluye innovación y soporte)
                      </span>
                    </span>
                    <span className="shrink-0 text-ink-muted text-xs tabular-nums">
                      {fmtPct(total > 0 ? (facturableTotal / total) * 100 : 0)}
                    </span>
                    <span className="shrink-0 font-bold text-ink tabular-nums">
                      {fmtNum(facturableTotal)} h
                    </span>
                  </div>
                )
              })()}
            </div>
          ) : (
            <p className="text-sm text-ink-soft">Sin datos para este mes.</p>
          )}
        </div>
      </div>
    </>
  )
}
