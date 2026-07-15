import { fmtMes } from '../../lib/format'

/** Toggle "Mes en curso" / "Mes vencido" + desplegable de mes, compartido por Panel y Ocupación. */
export function SelectorMes({
  meses,
  mesActual,
  enMesEnCurso,
  enMesVencido,
  onMesEnCurso,
  onMesVencido,
  onMes,
}: {
  meses: string[]
  mesActual: string | null
  enMesEnCurso: boolean
  enMesVencido: boolean
  onMesEnCurso: () => void
  onMesVencido: () => void
  onMes: (mes: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-full border border-line p-0.5 text-xs">
        <button
          type="button"
          onClick={onMesEnCurso}
          className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${
            enMesEnCurso ? 'bg-accent-500 text-primary-950' : 'text-ink-soft hover:bg-surface-muted'
          }`}
        >
          Mes en curso
        </button>
        <button
          type="button"
          onClick={onMesVencido}
          title="Último mes ya cerrado, con unos días de margen para que todos terminen de fichar el mes anterior"
          className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${
            enMesVencido ? 'bg-accent-500 text-primary-950' : 'text-ink-soft hover:bg-surface-muted'
          }`}
        >
          Mes vencido
        </button>
      </div>
      <select
        value={mesActual ?? ''}
        onChange={(e) => onMes(e.target.value)}
        className="h-9 rounded-[10px] border border-line bg-surface px-3 text-sm font-semibold text-ink outline-none focus:border-accent-500"
      >
        {meses.map((m) => (
          <option key={m} value={m}>
            {fmtMes(m)}
          </option>
        ))}
      </select>
    </div>
  )
}
