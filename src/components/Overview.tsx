import { useState } from 'react'
import type { Project } from '../types'
import { enAlerta, kpis } from '../lib/metrics'
import { fmtEur, fmtFecha, fmtPct } from '../lib/format'
import { ConcostImportModal } from './ConcostImportModal'
import { KpiCard } from './KpiCard'

function Barra({ pct, color }: { pct: number | null; color: string }) {
  return (
    <div className="h-2 rounded-full bg-surface-muted overflow-hidden">
      <div
        className={`h-full rounded-full ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, pct ?? 0))}%` }}
      />
    </div>
  )
}

const MS_DIA = 24 * 60 * 60 * 1000

function diasDesdeConcost(p: Project): number | null {
  if (!p.lastImport) return null

  const hoy = new Date()
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()
  const fechaUltimoExcel = new Date(p.lastImport)
  if (Number.isNaN(fechaUltimoExcel.getTime())) return null

  const inicioUltimoExcel = new Date(
    fechaUltimoExcel.getFullYear(),
    fechaUltimoExcel.getMonth(),
    fechaUltimoExcel.getDate(),
  ).getTime()
  return Math.max(0, Math.floor((inicioHoy - inicioUltimoExcel) / MS_DIA))
}

const fmtDias = (dias: number) => `${dias} ${dias === 1 ? 'día' : 'días'}`
const fmtFechaImportacion = (iso: string) => fmtFecha(iso.slice(0, 10))

export function Overview({
  projects,
  onSelect,
  onFiles,
  onHoursFiles,
}: {
  projects: Project[]
  onSelect: (code: string) => void
  onFiles: (files: File[]) => void
  onHoursFiles: (files: File[]) => void
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const proyectosDesactualizados = projects
    .map((project) => ({ project, dias: diasDesdeConcost(project) }))
    .filter((item): item is { project: Project; dias: number } => item.dias !== null && item.dias > 30)
  const diasConcost = projects
    .map((p) => diasDesdeConcost(p))
    .filter((dias): dias is number => dias !== null)
  const diasConcostMax = diasConcost.length > 0 ? Math.max(...diasConcost) : null
  const proyectosDesactualizadosTexto = proyectosDesactualizados
    .slice(0, 2)
    .map(({ project, dias }) => `${project.name} (${fmtDias(dias)})`)
    .join(', ')
  const resumenDesactualizados =
    proyectosDesactualizados.length > 2
      ? `${proyectosDesactualizadosTexto} y ${proyectosDesactualizados.length - 2} más`
      : proyectosDesactualizadosTexto
  const totales = projects.reduce(
    (acc, p) => {
      const k = kpis(p)
      const necesitaActualizacion = (diasDesdeConcost(p) ?? 0) > 30
      acc.gasto += k.gasto
      acc.facturacion += k.facturacion
      acc.alertas += enAlerta(k) || necesitaActualizacion ? 1 : 0
      return acc
    },
    { gasto: 0, facturacion: 0, alertas: 0 },
  )
  const hayAlertaFacturacion = projects.some((p) => enAlerta(kpis(p)))

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[30px] leading-tight font-extrabold text-ink tracking-tight">
            Resumen general
          </h1>
          <p className="text-sm text-ink-soft mt-1">
            Cartera de proyectos: facturación frente a avance, con el gasto como referencia.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-accent-500 px-5 text-sm font-extrabold text-primary-950 shadow-soft transition-colors hover:bg-accent-400"
          >
            <span className="text-base leading-none">+</span>
            Añadir proyecto
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Proyectos" value={String(projects.length)} icon="📁" accent="slate" />
        <KpiCard label="Facturado" value={fmtEur(totales.facturacion)} icon="🧾" accent="emerald" />
        <KpiCard
          label="Gasto acumulado"
          value={fmtEur(totales.gasto)}
          icon="💸"
          accent={proyectosDesactualizados.length > 0 ? 'amber' : 'indigo'}
          sub={
            diasConcostMax !== null
              ? `Actualizado de Concost hace: ${fmtDias(diasConcostMax)}`
              : 'Sin fecha de actualización Concost'
          }
        />
        <KpiCard
          label="Proyectos en alerta"
          value={String(totales.alertas)}
          icon="⚠️"
          accent={hayAlertaFacturacion ? 'rose' : proyectosDesactualizados.length > 0 ? 'amber' : 'emerald'}
          sub={
            proyectosDesactualizados.length > 0 ? (
              <>
                Necesitan actualización Concost:{' '}
                <span className="font-bold text-ink">{resumenDesactualizados}</span>
              </>
            ) : (
              'Facturación > 10 pts por detrás del avance'
            )
          }
        />
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {projects.map((p) => {
          const k = kpis(p)
          const alerta = enAlerta(k)
          const diasActualizacion = diasDesdeConcost(p)
          const necesitaActualizacion = diasActualizacion !== null && diasActualizacion > 30
          return (
            <button
              key={p.code}
              onClick={() => onSelect(p.code)}
              className="text-left bg-surface rounded-lg shadow-soft border border-line p-5 hover:shadow-hover hover:border-accent-300 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-ink truncate">{p.name}</div>
                  <div className="text-xs text-ink-muted">{p.code}</div>
                </div>
                {necesitaActualizacion ? (
                  <span className="shrink-0 text-[11px] font-bold bg-warning/15 text-[#8A5A00] rounded-md px-2 py-0.5">
                    Actualizar Concost {fmtDias(diasActualizacion)}
                  </span>
                ) : alerta ? (
                  <span className="shrink-0 text-[11px] font-bold bg-danger/10 text-danger rounded-md px-2 py-0.5">
                    ⚠ Sin facturar {fmtPct(-k.desvioFacturacion!)}
                  </span>
                ) : (
                  <span className="shrink-0 text-[11px] font-bold bg-success/10 text-success rounded-md px-2 py-0.5">
                    OK
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                <div>
                  <div className="text-xs text-ink-muted">Facturado</div>
                  <div className="font-bold text-ink">{fmtEur(k.facturacion)}</div>
                </div>
                <div>
                  <div className="text-xs text-ink-muted">Gasto</div>
                  <div className="font-bold text-ink">{fmtEur(k.gasto)}</div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-[11px] text-ink-muted">
                  <span>Facturado s/ contrato</span>
                  <span>{k.facturadoPct !== null ? fmtPct(k.facturadoPct) : 'sin importe de contrato'}</span>
                </div>
                <Barra pct={k.facturadoPct} color={alerta ? 'bg-danger' : 'bg-success'} />
                <div className="flex justify-between text-[11px] text-ink-muted">
                  <span>Avance técnico</span>
                  <span>{k.avancePct !== null ? fmtPct(k.avancePct) : 'sin datos'}</span>
                </div>
                <Barra pct={k.avancePct} color="bg-info" />
                <div className="flex justify-between text-[11px] text-ink-muted">
                  <span>Gasto s/ presupuesto</span>
                  <span>{k.consumoPct !== null ? fmtPct(k.consumoPct) : 'sin presupuesto'}</span>
                </div>
                <Barra pct={k.consumoPct} color="bg-primary-800" />
              </div>

              <div className="text-[11px] text-ink-muted mt-3 space-y-0.5">
                <div>
                  Actualización Concost:{' '}
                  <span className="font-semibold text-ink-soft">
                    {p.lastImport ? fmtFechaImportacion(p.lastImport) : 'sin fecha'}
                  </span>
                </div>
                <div className="truncate" title={p.concostFileName}>
                  Archivo Explotación:{' '}
                  <span className="font-semibold text-ink-soft">
                    {p.concostFileName ?? 'no registrado'}
                  </span>
                  {p.hasta && <> · Datos hasta {fmtFecha(p.hasta)}</>}
                </div>
              </div>
            </button>
          )
        })}
        {projects.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3 rounded-lg border border-line bg-surface p-8 text-center">
            <div className="text-lg font-extrabold text-ink">Todavía no hay proyectos importados</div>
            <p className="text-sm text-ink-soft mt-1">
              Añade primero el fichero de Explotación de Concost para crear el proyecto.
            </p>
          </div>
        )}
      </div>

      {modalOpen && (
        <ConcostImportModal
          title="Añadir proyecto"
          description="Para crear un proyecto nuevo necesitas importar primero el Excel de Explotación. El fichero de Horas es opcional y se puede cargar después."
          onClose={() => setModalOpen(false)}
          onExplotacionFiles={onFiles}
          onHorasFiles={onHoursFiles}
        />
      )}
    </div>
  )
}
