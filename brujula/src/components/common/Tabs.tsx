export interface TabDef {
  id: string
  etiqueta: string
}

export function Tabs({
  tabs,
  activo,
  onChange,
}: {
  tabs: TabDef[]
  activo: string
  onChange: (id: string) => void
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-surface-muted p-1 text-sm">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${
            activo === t.id ? 'bg-surface text-ink shadow-soft' : 'text-ink-soft hover:text-ink'
          }`}
        >
          {t.etiqueta}
        </button>
      ))}
    </div>
  )
}
