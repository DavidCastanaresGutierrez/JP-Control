import { useState } from 'react'
import { Tabs } from '../common/Tabs.tsx'
import { GastosTab } from './GastosTab.tsx'
import { PatrimonioTab } from './PatrimonioTab.tsx'

export function EconomiaView() {
  const [tab, setTab] = useState('gastos')
  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-eco">
          <span>💶</span> Economía
        </h1>
        <p className="text-sm text-ink-soft">Gastos, ingresos y evolución del patrimonio.</p>
      </header>

      <Tabs
        tabs={[
          { id: 'gastos', etiqueta: 'Gastos e ingresos' },
          { id: 'patrimonio', etiqueta: 'Patrimonio' },
        ]}
        activo={tab}
        onChange={setTab}
      />

      {tab === 'gastos' ? <GastosTab /> : <PatrimonioTab />}
    </div>
  )
}
