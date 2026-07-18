import { NavLink, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useStore } from './lib/store.ts'
import { Dashboard } from './components/Dashboard.tsx'
import { EconomiaView } from './components/economia/EconomiaView.tsx'
import { SaludView } from './components/salud/SaludView.tsx'
import { HabitosView } from './components/habitos/HabitosView.tsx'
import { Ajustes } from './components/Ajustes.tsx'
import { BarraSync } from './components/BarraSync.tsx'

interface Seccion {
  to: string
  etiqueta: string
  emoji: string
  clase: string
}

const SECCIONES: Seccion[] = [
  { to: '/', etiqueta: 'Resumen', emoji: '🏠', clase: 'text-ink' },
  { to: '/economia', etiqueta: 'Economía', emoji: '💶', clase: 'text-eco' },
  { to: '/salud', etiqueta: 'Salud', emoji: '❤️', clase: 'text-salud' },
  { to: '/habitos', etiqueta: 'Hábitos', emoji: '✅', clase: 'text-habito' },
  { to: '/ajustes', etiqueta: 'Ajustes', emoji: '⚙️', clase: 'text-ink' },
]

function Navegacion() {
  return (
    <>
      {SECCIONES.map((s) => (
        <NavLink
          key={s.to}
          to={s.to}
          end={s.to === '/'}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              isActive ? 'bg-surface-muted text-ink shadow-soft' : 'text-ink-soft hover:bg-surface-muted/60'
            }`
          }
        >
          <span className="text-lg">{s.emoji}</span>
          <span>{s.etiqueta}</span>
        </NavLink>
      ))}
    </>
  )
}

function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full lg:flex">
      {/* Barra lateral (escritorio) */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-0 border-r border-line bg-surface px-3 py-5">
        <div className="mb-6 flex items-center gap-2 px-2">
          <img src="/favicon.svg" alt="" className="h-8 w-8" />
          <div>
            <div className="font-display text-base font-bold leading-tight">Vida Control</div>
            <div className="text-xs text-ink-muted">3 pilares</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          <Navegacion />
        </nav>
        <div className="mt-auto px-2 pt-4 text-xs text-ink-muted">Local-first · nube opcional</div>
      </aside>

      <div className="lg:pl-60 flex flex-col min-h-full flex-1">
        <BarraSync />
        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8 pb-24 lg:pb-8 max-w-5xl w-full mx-auto">{children}</main>

        {/* Navegación inferior (móvil) */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-line bg-surface/95 backdrop-blur grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
          {SECCIONES.map((s) => (
            <NavLink
              key={s.to}
              to={s.to}
              end={s.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                  isActive ? 'text-ink' : 'text-ink-muted'
                }`
              }
            >
              <span className="text-lg">{s.emoji}</span>
              {s.etiqueta}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}

export default function App() {
  const { cargando } = useStore()

  if (cargando) {
    return (
      <div className="flex min-h-full items-center justify-center text-ink-muted">
        <div className="animate-pulse">Cargando…</div>
      </div>
    )
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/economia" element={<EconomiaView />} />
        <Route path="/salud" element={<SaludView />} />
        <Route path="/habitos" element={<HabitosView />} />
        <Route path="/ajustes" element={<Ajustes />} />
        <Route path="*" element={<Dashboard />} />
      </Routes>
    </Layout>
  )
}
