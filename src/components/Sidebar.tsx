import { useState } from 'react'
import type { Project } from '../types'
import { enAlerta, kpis } from '../lib/metrics'
import { ConcostImportModal } from './ConcostImportModal'

export function Sidebar({
  projects,
  selected,
  onSelect,
  onImportConcost,
}: {
  projects: Project[]
  selected: string | null
  onSelect: (code: string | null) => void
  onImportConcost?: (files: File[]) => void
}) {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <aside className="w-[17rem] shrink-0 bg-primary-950 text-white/72 flex flex-col">
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-accent-500 text-primary-950 flex items-center justify-center font-black">
            JP
          </div>
          <div className="min-w-0">
            <div className="font-display text-white font-extrabold text-lg tracking-tight">
              JP Control
            </div>
            <div className="text-xs text-white/45 mt-0.5 truncate">Seguimiento económico</div>
          </div>
        </div>
      </div>

      {selected && (
        <div className="px-3 pt-4">
          <button
            onClick={() => setModalOpen(true)}
            className="w-full flex items-center h-11 px-3.5 rounded-lg bg-accent-500 text-primary-950 text-sm font-bold hover:bg-accent-400 transition-colors shadow-soft"
          >
            <span className="inline-flex items-center justify-center w-5 shrink-0 text-base leading-none">
              +
            </span>
            Actualizar datos Concost
          </button>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        <button
          onClick={() => onSelect(null)}
          className={`w-full flex items-center h-11 px-3.5 rounded-lg text-sm font-semibold transition-colors
            ${selected === null ? 'bg-accent-500 text-primary-950' : 'text-white/72 hover:bg-white/8 hover:text-white'}`}
        >
          <span className="inline-flex items-center justify-center w-5 shrink-0 text-base leading-none">
            ▣
          </span>
          Resumen general
        </button>

        <div className="px-3.5 pt-4 pb-1 text-[11px] uppercase tracking-wider text-white/40 font-bold">
          Proyectos ({projects.length})
        </div>
        {projects.map((p) => {
          const alerta = enAlerta(kpis(p))
          const active = selected === p.code
          return (
            <button
              key={p.code}
              onClick={() => onSelect(p.code)}
              className={`w-full text-left py-2.5 px-3.5 rounded-lg transition-colors
                ${active ? 'bg-accent-500 text-primary-950' : 'text-white/72 hover:bg-white/8 hover:text-white'}`}
            >
              <div className="text-sm font-semibold truncate flex items-center gap-1.5">
                {alerta && <span title="Facturación por detrás del avance">⚠️</span>}
                <span className="truncate">{p.name}</span>
              </div>
              <div className={`text-[11px] truncate ${active ? 'text-primary-900/70' : 'text-white/40'}`}>
                {p.code}
              </div>
            </button>
          )
        })}
        {projects.length === 0 && (
          <div className="px-3.5 py-3 text-xs text-white/40">
            Importa un fichero de explotación para empezar.
          </div>
        )}
      </nav>

      <div className="px-5 py-4 border-t border-white/10 text-[11px] text-white/40">
        Copia local en este navegador; con la nube activa, los datos se comparten.
      </div>

      {selected && modalOpen && (
        <ConcostImportModal
          title="Actualizar datos Concost"
          description="El proyecto ya está cargado. Importa Explotación para actualizar facturación, gasto y movimientos, o Horas para actualizar participantes y ocupación."
          explotacionBadge="Actualizar"
          horasBadge="Actualizar"
          onClose={() => setModalOpen(false)}
          onExplotacionFiles={(files) => onImportConcost?.(files)}
          onHorasFiles={(files) => onImportConcost?.(files)}
        />
      )}
    </aside>
  )
}
