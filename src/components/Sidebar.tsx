import { useEffect, useState } from 'react'
import type { Project } from '../types'
import { EmojiIcon, emoji } from '../lib/emoji'
import { repairMojibake } from '../lib/format'
import { ConcostImportModal } from './ConcostImportModal'

function initialsFromUser(name?: string, email?: string): string {
  const source = repairMojibake(name || email || 'Usuario TYPSA')
  const clean = source.includes('@') ? source.split('@')[0].replace(/[._-]+/g, ' ') : source
  const parts = clean.split(/\s+/).filter(Boolean)
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : clean.slice(0, 2)).toUpperCase()
}

export function Sidebar({
  projects,
  selected,
  onSelect,
  onImportConcost,
  scope,
  onScopeChange,
  archiveFilter,
  onArchiveFilterChange,
  userEmail,
  userName,
  userPhotoUrl,
  onLogout,
  showAdmin,
  adminActive,
  onOpenAdmin,
}: {
  projects: Project[]
  selected: string | null
  onSelect: (code: string | null) => void
  onImportConcost?: (files: File[]) => void
  scope: 'mine' | 'all'
  onScopeChange: (scope: 'mine' | 'all') => void
  archiveFilter: 'active' | 'archived' | 'all'
  onArchiveFilterChange: (filter: 'active' | 'archived' | 'all') => void
  userEmail?: string
  userName?: string
  userPhotoUrl?: string
  onLogout?: () => void
  showAdmin?: boolean
  adminActive?: boolean
  onOpenAdmin?: () => void
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [photoError, setPhotoError] = useState(false)
  const displayName = repairMojibake(userName)
  const activeCount = projects.filter((project) => !project.archivedAt).length
  const archivedCount = projects.filter((project) => project.archivedAt).length

  useEffect(() => setPhotoError(false), [userPhotoUrl])

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
            <span className="inline-flex w-5 shrink-0 items-center justify-center text-base leading-none">
              <EmojiIcon>{emoji.refresh}</EmojiIcon>
            </span>
            Actualizar datos Concost
          </button>
        </div>
      )}

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {[
          { id: 'mine' as const, label: 'Mi cartera', icon: emoji.home },
          { id: 'all' as const, label: 'Todos los proyectos', icon: emoji.folder },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => {
              onScopeChange(item.id)
              onSelect(null)
            }}
            className={`flex h-11 w-full items-center rounded-lg px-3.5 text-sm font-semibold transition-colors ${
              selected === null && scope === item.id
                ? 'bg-accent-500 text-primary-950'
                : 'text-white/72 hover:bg-white/8 hover:text-white'
            }`}
          >
            <span className="inline-flex w-5 shrink-0 items-center justify-center text-base leading-none">
              <EmojiIcon>{item.icon}</EmojiIcon>
            </span>
            {item.label}
          </button>
        ))}

        <div className="px-3.5 pb-1 pt-4 text-[11px] font-bold uppercase tracking-wider text-white/40">
          {scope === 'mine' ? 'En mi cartera' : 'Proyectos'}
        </div>
        <div className="mb-2 space-y-1">
          {[
            { id: 'all' as const, label: 'Todos', count: projects.length },
            { id: 'active' as const, label: 'Activos', count: activeCount },
            { id: 'archived' as const, label: 'Archivados', count: archivedCount },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => onArchiveFilterChange(item.id)}
              className={`flex h-9 w-full items-center justify-between rounded-lg px-3.5 text-sm font-semibold transition-colors ${
                archiveFilter === item.id
                  ? 'bg-white/12 text-white'
                  : 'text-white/62 hover:bg-white/8 hover:text-white'
              }`}
            >
              <span>{item.label}</span>
              <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-bold text-white/75">
                {item.count}
              </span>
            </button>
          ))}
        </div>

        {projects.length === 0 && (
          <div className="px-3.5 py-3 text-xs text-white/40">
            {scope === 'mine'
              ? 'No hay proyectos donde figures como JP.'
              : 'Importa un fichero de explotacion para empezar.'}
          </div>
        )}
        {showAdmin && (
          <>
            <div className="px-3.5 pb-1 pt-4 text-[11px] font-bold uppercase tracking-wider text-white/40">
              Aplicacion
            </div>
            <button
              onClick={onOpenAdmin}
              className={`flex h-11 w-full items-center rounded-lg px-3.5 text-sm font-semibold transition-colors ${
                adminActive
                  ? 'bg-accent-500 text-primary-950'
                  : 'text-white/72 hover:bg-white/8 hover:text-white'
              }`}
            >
              <span className="inline-flex w-5 shrink-0 items-center justify-center text-base leading-none">
                <EmojiIcon>{emoji.admin}</EmojiIcon>
              </span>
              Administracion
            </button>
          </>
        )}
      </nav>

      {userEmail && (
        <div className="border-t border-white/10 px-4 py-4">
          <div className="flex items-center gap-3">
            {userPhotoUrl && !photoError ? (
              <img
                src={userPhotoUrl}
                alt={displayName || userEmail}
                className="h-10 w-10 shrink-0 rounded-full border border-white/15 object-cover shadow-soft"
                referrerPolicy="no-referrer"
                onError={() => setPhotoError(true)}
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white font-black text-primary-950 shadow-soft">
                {initialsFromUser(userName, userEmail)}
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-[11px] font-bold uppercase tracking-wider text-white/35">
                Sesion TYPSA
              </div>
              {displayName && (
                <div className="mt-0.5 truncate text-xs font-bold text-white/90">{displayName}</div>
              )}
              <div className="mt-0.5 truncate text-xs font-semibold text-white/75">{userEmail}</div>
            </div>
          </div>
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
