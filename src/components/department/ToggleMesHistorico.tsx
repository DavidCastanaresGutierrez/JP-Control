export function ToggleMesHistorico({
  modo,
  onChange,
}: {
  modo: 'curso' | 'vencido'
  onChange: (modo: 'curso' | 'vencido') => void
}) {
  return (
    <div className="flex rounded-full border border-line p-0.5 text-xs">
      <button
        onClick={() => onChange('curso')}
        className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${
          modo === 'curso' ? 'bg-accent-500 text-primary-950' : 'text-ink-soft hover:bg-surface-muted'
        }`}
      >
        Mes en curso
      </button>
      <button
        onClick={() => onChange('vencido')}
        title="No incluye el mes en curso, y da unos días de margen tras acabar el mes anterior antes de darlo por cerrado"
        className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${
          modo === 'vencido' ? 'bg-accent-500 text-primary-950' : 'text-ink-soft hover:bg-surface-muted'
        }`}
      >
        Mes vencido
      </button>
    </div>
  )
}
