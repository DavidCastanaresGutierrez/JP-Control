import { useState } from 'react'
import { Tabs } from '../common/Tabs.tsx'
import { CorporalTab } from './CorporalTab.tsx'
import { DietaTab } from './DietaTab.tsx'
import { GymTab } from './GymTab.tsx'

export function SaludView() {
  const [tab, setTab] = useState('corporal')
  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-salud">
          <span>❤️</span> Salud
        </h1>
        <p className="text-sm text-ink-soft">Valores corporales, dieta y rutinas de gimnasio.</p>
      </header>

      <Tabs
        tabs={[
          { id: 'corporal', etiqueta: 'Corporal' },
          { id: 'dieta', etiqueta: 'Dieta' },
          { id: 'gym', etiqueta: 'Gimnasio' },
        ]}
        activo={tab}
        onChange={setTab}
      />

      {tab === 'corporal' ? <CorporalTab /> : tab === 'dieta' ? <DietaTab /> : <GymTab />}
    </div>
  )
}
