import { Link } from 'react-router-dom'
import { useStore } from '../lib/store.ts'
import { hoy, mesDe, etiquetaMes } from '../lib/date.ts'
import { euros, conUnidad } from '../lib/format.ts'
import {
  patrimonioNeto,
  rachaActual,
  resumenDia,
  resumenMes,
  serieMedida,
} from '../lib/metrics.ts'
import { Card, KpiCard } from './common/ui.tsx'

export function Dashboard() {
  const { db } = useStore()
  const mes = mesDe(hoy())

  const eco = resumenMes(db.transacciones, mes)
  const ultimoPatrimonio = [...db.patrimonio].sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
  const neto = ultimoPatrimonio ? patrimonioNeto(ultimoPatrimonio) : null

  const pesos = serieMedida(db.medidas, 'peso')
  const ultimoPeso = pesos.at(-1)?.valor
  const nutricionHoy = resumenDia(db.comidas, hoy())

  const activos = db.habitos.filter((h) => !h.archivado)
  const cumplidosHoy = activos.filter((h) => db.registrosHabito.some((r) => r.habitoId === h.id && r.fecha === hoy())).length
  const mejorRacha = activos.reduce((max, h) => Math.max(max, rachaActual(db.registrosHabito, h.id)), 0)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Resumen</h1>
        <p className="text-sm text-ink-soft">Tus tres pilares de un vistazo · {etiquetaMes(mes)}</p>
      </header>

      <PilarBloque titulo="Economía" emoji="💶" to="/economia" acento="text-eco">
        <KpiCard label="Balance del mes" value={euros(eco.balance)} tone={eco.balance >= 0 ? 'success' : 'danger'} />
        <KpiCard label="Gastos del mes" value={euros(eco.gastos)} tone="eco" />
        <KpiCard label="Patrimonio neto" value={neto === null ? '—' : euros(neto)} sub={ultimoPatrimonio?.fecha} tone="ink" />
      </PilarBloque>

      <PilarBloque titulo="Salud" emoji="❤️" to="/salud" acento="text-salud">
        <KpiCard label="Peso actual" value={conUnidad(ultimoPeso, 'kg')} tone="salud" />
        <KpiCard label="Calorías de hoy" value={nutricionHoy.kcal ? `${Math.round(nutricionHoy.kcal)} kcal` : '—'} tone="salud" />
        <KpiCard label="Entrenos" value={db.entrenos.length} sub="sesiones registradas" tone="ink" />
      </PilarBloque>

      <PilarBloque titulo="Hábitos" emoji="✅" to="/habitos" acento="text-habito">
        <KpiCard label="Hoy" value={`${cumplidosHoy}/${activos.length}`} sub="hábitos cumplidos" tone="habito" />
        <KpiCard label="Mejor racha" value={`${mejorRacha} días`} tone="habito" />
        <KpiCard label="Hábitos activos" value={activos.length} tone="ink" />
      </PilarBloque>
    </div>
  )
}

function PilarBloque({
  titulo,
  emoji,
  to,
  acento,
  children,
}: {
  titulo: string
  emoji: string
  to: string
  acento: string
  children: React.ReactNode
}) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className={`flex items-center gap-2 text-lg font-semibold ${acento}`}>
          <span>{emoji}</span> {titulo}
        </h2>
        <Link to={to} className="text-sm font-medium text-ink-soft hover:text-ink">
          Abrir →
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{children}</div>
    </Card>
  )
}
