import { useRef, useState } from 'react'
import type { Project } from '../types'
import { enAlerta, kpis } from '../lib/metrics'
import { fmtEur, fmtFecha, fmtPct } from '../lib/format'
import { EmojiIcon, emoji } from '../lib/emoji'
import { ConcostImportModal } from './ConcostImportModal'
import { KpiCard } from './KpiCard'

function Barra({ pct, color }: { pct: number | null; color: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
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

const fmtDias = (dias: number) => `${dias} ${dias === 1 ? 'dia' : 'dias'}`
const fmtFechaImportacion = (iso: string) => fmtFecha(iso.slice(0, 10))

function normalizarBusqueda(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function proyectoCoincide(project: Project, query: string) {
  if (!query) return true
  const campos = [project.name, project.code, project.director ?? '']
  return campos.some((campo) => normalizarBusqueda(campo).includes(query))
}

export function Overview({
  projects,
  onSelect,
  onReorder,
  onFiles,
  onHoursFiles,
}: {
  projects: Project[]
  onSelect: (code: string) => void
  onReorder: (draggedCode: string, targetCode: string) => void
  onFiles: (files: File[]) => void
  onHoursFiles: (files: File[]) => void
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [draggingCode, setDraggingCode] = useState<string | null>(null)
  const [dragOverCode, setDragOverCode] = useState<string | null>(null)
  const draggedCodeRef = useRef<string | null>(null)
  const dragMovedRef = useRef(false)
  const query = normalizarBusqueda(busqueda)
  const visibleProjects = projects.filter((project) => proyectoCoincide(project, query))
  const buscando = query.length > 0

  const proyectosDesactualizados = visibleProjects
    .map((project) => ({ project, dias: diasDesdeConcost(project) }))
    .filter((item): item is { project: Project; dias: number } => item.dias !== null && item.dias > 30)
  const diasConcost = visibleProjects
    .map((p) => diasDesdeConcost(p))
    .filter((dias): dias is number => dias !== null)
  const diasConcostMax = diasConcost.length > 0 ? Math.max(...diasConcost) : null
  const proyectosDesactualizadosTexto = proyectosDesactualizados
    .slice(0, 2)
    .map(({ project, dias }) => `${project.name} (${fmtDias(dias)})`)
    .join(', ')
  const resumenDesactualizados =
    proyectosDesactualizados.length > 2
      ? `${proyectosDesactualizadosTexto} y ${proyectosDesactualizados.length - 2} mas`
      : proyectosDesactualizadosTexto
  const totales = visibleProjects.reduce(
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
  const hayAlertaFacturacion = visibleProjects.some((p) => enAlerta(kpis(p)))

  const endDrag = () => {
    draggedCodeRef.current = null
    setDraggingCode(null)
    setDragOverCode(null)
    window.setTimeout(() => {
      dragMovedRef.current = false
    }, 250)
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-[18rem] flex-1">
          <h1 className="font-display text-[30px] font-extrabold leading-tight tracking-tight text-ink">
            Resumen general
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Cartera de proyectos: facturacion frente a avance, con el gasto como referencia.
          </p>
        </div>
        <div className="flex min-w-[18rem] flex-1 flex-wrap items-center justify-end gap-3">
          <label className="relative min-w-[16rem] max-w-md flex-1">
            <span className="sr-only">Buscar proyecto</span>
            <input
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              className="h-11 w-full rounded-lg border border-line bg-surface px-4 pr-10 text-sm font-semibold text-ink outline-none shadow-soft transition-colors placeholder:font-medium placeholder:text-ink-muted focus:border-accent-500"
              placeholder="Buscar por nombre o numero de contrato"
            />
            {busqueda ? (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-sm font-black text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
                aria-label="Limpiar busqueda"
              >
                x
              </button>
            ) : null}
          </label>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-accent-500 px-5 text-sm font-extrabold text-primary-950 shadow-soft transition-colors hover:bg-accent-400"
            >
            <span className="text-base leading-none">+</span>
            Anadir proyecto
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Proyectos"
          value={String(visibleProjects.length)}
          icon={<EmojiIcon>{emoji.folder}</EmojiIcon>}
          accent="slate"
          sub={buscando ? `Filtrados de ${projects.length}` : undefined}
        />
        <KpiCard
          label="Facturado"
          value={fmtEur(totales.facturacion)}
          icon={<EmojiIcon>{emoji.document}</EmojiIcon>}
          accent="emerald"
        />
        <KpiCard
          label="Gasto acumulado"
          value={fmtEur(totales.gasto)}
          icon={<EmojiIcon>{emoji.money}</EmojiIcon>}
          accent={proyectosDesactualizados.length > 0 ? 'amber' : 'indigo'}
          sub={
            diasConcostMax !== null
              ? `Actualizado de Concost hace: ${fmtDias(diasConcostMax)}`
              : 'Sin fecha de actualizacion Concost'
          }
        />
        <KpiCard
          label="Proyectos en alerta"
          value={String(totales.alertas)}
          icon={<EmojiIcon>{totales.alertas > 0 ? emoji.alert : emoji.check}</EmojiIcon>}
          accent={hayAlertaFacturacion ? 'rose' : proyectosDesactualizados.length > 0 ? 'amber' : 'emerald'}
          sub={
            proyectosDesactualizados.length > 0 ? (
              <>
                Necesitan actualizacion Concost:{' '}
                <span className="font-bold text-ink">{resumenDesactualizados}</span>
              </>
            ) : (
              'Facturacion > 10 pts por detras del avance'
            )
          }
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleProjects.map((p) => {
          const k = kpis(p)
          const alerta = enAlerta(k)
          const diasActualizacion = diasDesdeConcost(p)
          const necesitaActualizacion = diasActualizacion !== null && diasActualizacion > 30
          const isDragging = draggingCode === p.code
          const isDropTarget = dragOverCode === p.code && draggingCode !== p.code

          return (
            <div
              key={p.code}
              role="button"
              tabIndex={0}
              draggable
              onClick={() => {
                if (dragMovedRef.current) {
                  dragMovedRef.current = false
                  return
                }
                onSelect(p.code)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelect(p.code)
                }
              }}
              onDragStart={(event) => {
                draggedCodeRef.current = p.code
                dragMovedRef.current = false
                setDraggingCode(p.code)
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', p.code)
              }}
              onDragOver={(event) => {
                event.preventDefault()
                const draggedCode = draggedCodeRef.current || event.dataTransfer.getData('text/plain')
                if (draggedCode && draggedCode !== p.code) {
                  dragMovedRef.current = true
                  setDragOverCode(p.code)
                  event.dataTransfer.dropEffect = 'move'
                }
              }}
              onDragEnter={(event) => {
                event.preventDefault()
                const draggedCode = draggedCodeRef.current
                if (draggedCode && draggedCode !== p.code) setDragOverCode(p.code)
              }}
              onDragLeave={() => {
                if (dragOverCode === p.code) setDragOverCode(null)
              }}
              onDrop={(event) => {
                event.preventDefault()
                const draggedCode = event.dataTransfer.getData('text/plain') || draggedCodeRef.current
                if (draggedCode && draggedCode !== p.code) {
                  dragMovedRef.current = true
                  onReorder(draggedCode, p.code)
                }
                endDrag()
              }}
              onDragEnd={endDrag}
              className={`rounded-lg border bg-surface p-5 text-left shadow-soft transition-all hover:border-accent-300 hover:shadow-hover ${
                isDropTarget ? 'translate-y-0.5 border-accent-500 ring-2 ring-accent-300/70' : 'border-line'
              } ${isDragging ? 'scale-[0.99] opacity-60' : ''} cursor-grab active:cursor-grabbing`}
              title="Arrastra para ordenar o haz clic para abrir"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-bold text-ink">{p.name}</div>
                  <div className="text-xs text-ink-muted">{p.code}</div>
                </div>
                {necesitaActualizacion ? (
                  <span className="shrink-0 rounded-md bg-warning/15 px-2 py-0.5 text-[11px] font-bold text-[#8A5A00]">
                    Actualizar Concost {fmtDias(diasActualizacion)}
                  </span>
                ) : alerta ? (
                  <span className="shrink-0 rounded-md bg-danger/10 px-2 py-0.5 text-[11px] font-bold text-danger">
                    <EmojiIcon>{emoji.alert}</EmojiIcon> Sin facturar {fmtPct(-k.desvioFacturacion!)}
                  </span>
                ) : (
                  <span className="shrink-0 rounded-md bg-success/10 px-2 py-0.5 text-[11px] font-bold text-success">
                    <EmojiIcon>{emoji.check}</EmojiIcon> OK
                  </span>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
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
                  <span>Avance tecnico</span>
                  <span>{k.avancePct !== null ? fmtPct(k.avancePct) : 'sin datos'}</span>
                </div>
                <Barra pct={k.avancePct} color="bg-info" />
                <div className="flex justify-between text-[11px] text-ink-muted">
                  <span>Gasto s/ presupuesto</span>
                  <span>{k.consumoPct !== null ? fmtPct(k.consumoPct) : 'sin presupuesto'}</span>
                </div>
                <Barra pct={k.consumoPct} color="bg-primary-800" />
              </div>

              <div className="mt-3 space-y-0.5 text-[11px] text-ink-muted">
                <div className="flex items-center justify-between gap-3">
                  <span>Actualizacion Concost:</span>
                  <span className="font-bold text-ink">
                    {p.lastImport ? fmtFechaImportacion(p.lastImport) : 'sin fecha'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 truncate" title={p.concostFileName}>
                  <span>Archivo Explotacion:</span>
                  <span className="truncate font-semibold text-ink-soft">
                    {p.concostFileName ?? 'no registrado'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Datos hasta:</span>
                  <span className="font-bold text-ink">{p.hasta ? fmtFecha(p.hasta) : 'sin fecha'}</span>
                </div>
              </div>
            </div>
          )
        })}

        {projects.length === 0 && (
          <div className="rounded-lg border border-line bg-surface p-8 text-center md:col-span-2 xl:col-span-3">
            <div className="text-lg font-extrabold text-ink">Todavia no hay proyectos importados</div>
            <p className="mt-1 text-sm text-ink-soft">
              Anade primero el fichero de Explotacion de Concost para crear el proyecto.
            </p>
          </div>
        )}

        {projects.length > 0 && visibleProjects.length === 0 && (
          <div className="rounded-lg border border-line bg-surface p-8 text-center md:col-span-2 xl:col-span-3">
            <div className="text-lg font-extrabold text-ink">No hay proyectos que coincidan</div>
            <p className="mt-1 text-sm text-ink-soft">
              Prueba con otro nombre de proyecto o numero de contrato.
            </p>
            <button
              type="button"
              onClick={() => setBusqueda('')}
              className="mt-4 inline-flex h-10 items-center justify-center rounded-lg border border-line px-4 text-sm font-bold text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
            >
              Limpiar busqueda
            </button>
          </div>
        )}
      </div>

      {modalOpen && (
        <ConcostImportModal
          title="Anadir proyecto"
          description="Para crear un proyecto nuevo necesitas importar primero el Excel de Explotacion. El fichero de Horas es opcional y se puede cargar despues."
          onClose={() => setModalOpen(false)}
          onExplotacionFiles={onFiles}
          onHorasFiles={onHoursFiles}
        />
      )}
    </div>
  )
}
