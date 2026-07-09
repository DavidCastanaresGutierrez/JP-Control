import { useState } from 'react'
import type { Project } from '../types'
import { enAlerta, kpis } from '../lib/metrics'
import { ConcostImportModal } from './ConcostImportModal'

export function Sidebar({
  projects,
  selected,
  onSelect,
  onImportConcost,
  userEmail,
  onLogout,
}: {
  projects: Project[]
  selected: string | null
  onSelect: (code: string | null) => void
  onImportConcost?: (files: File[]) => void
  userEmail?: string
  onLogout?: () => void
}) {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <aside className="flex w-[17rem] shrink-0 flex-col bg-primary-950 text-white/72">
      <div className="border-b border-white/10 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-500 font-black text-primary-950">
            JP
          </div>
          <div className="min-w-0">
            <div className="font-display text-lg font-extrabold tracking-tight text-white">JP Control</div>
            <div className="mt-0.5 truncate text-xs text-white/45">Seguimiento economico</div>
          </div>
        </div>
      </div>

      {selected && (
        <div className="px-3 pt-4">
          <button
            onClick={() => setModalOpen(true)}
            className="flex h-11 w-full items-center rounded-lg bg-accent-500 px-3.5 text-sm font-bold text-primary-950 shadow-soft transition-colors hover:bg-accent-400"
          >
            <span className="inline-flex w-5 shrink-0 items-center justify-center text-base leading-none">+</span>
            Actualizar datos Concost
          </button>
        </div>
      )}

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        <button
          onClick={() => onSelect(null)}
          className={`flex h-11 w-full items-center rounded-lg px-3.5 text-sm font-semibold transition-colors ${
            selected === null ? 'bg-accent-500 text-primary-950' : 'text-white/72 hover:bg-white/8 hover:text-white'
          }`}
        >
          <span className="inline-flex w-5 shrink-0 items-center justify-center text-base leading-none">[]</span>
          Resumen general
        </button>

        <div className="px-3.5 pb-1 pt-4 text-[11px] font-bold uppercase tracking-wider text-white/40">
          Proyectos ({projects.length})
        </div>
        {projects.map((p) => {
          const alerta = enAlerta(kpis(p))
          const active = selected === p.code
          return (
            <button
              key={p.code}
              onClick={() => onSelect(p.code)}
              className={`w-full rounded-lg px-3.5 py-2.5 text-left transition-colors ${
                active ? 'bg-accent-500 text-primary-950' : 'text-white/72 hover:bg-white/8 hover:text-white'
              }`}
            >
              <div className="flex truncate text-sm font-semibold">
                {alerta && <span title="Facturacion por detras del avance">!&nbsp;</span>}
                <span className="truncate">{p.name}</span>
              </div>
              <div className={`truncate text-[11px] ${active ? 'text-primary-900/70' : 'text-white/40'}`}>
                {p.code}
              </div>
            </button>
          )
        })}
        {projects.length === 0 && (
          <div className="px-3.5 py-3 text-xs text-white/40">
            Importa un fichero de explotacion para empezar.
          </div>
        )}
      </nav>

      {userEmail && (
        <div className="border-t border-white/10 px-4 py-4">
          <div className="truncate text-[11px] font-bold uppercase tracking-wider text-white/35">Sesion TYPSA</div>
          <div className="mt-1 truncate text-xs font-semibold text-white/75">{userEmail}</div>
          {onLogout && (
            <button
              onClick={onLogout}
              className="mt-3 flex h-9 w-full items-center justify-center rounded-lg border border-white/15 px-3 text-xs font-bold text-white/80 transition-colors hover:bg-white/8 hover:text-white"
            >
              Salir
            </button>
          )}
        </div>
      )}

      {selected && modalOpen && (
        <ConcostImportModal
          title="Actualizar datos Concost"
          description="El proyecto ya esta cargado. Importa Explotacion para actualizar facturacion, gasto y movimientos, o Horas para actualizar participantes y ocupacion."
          onClose={() => setModalOpen(false)}
          onExplotacionFiles={(files) => onImportConcost?.(files)}
          onHorasFiles={(files) => onImportConcost?.(files)}
        />
      )}
    </aside>
  )
}
