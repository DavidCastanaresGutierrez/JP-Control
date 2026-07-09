import type { ReactNode } from 'react'

export function KpiCard({
  label,
  value,
  sub,
  accent = 'indigo',
  icon,
}: {
  label: string
  value: string
  sub?: ReactNode
  accent?: 'indigo' | 'emerald' | 'rose' | 'amber' | 'slate'
  icon?: ReactNode
}) {
  const accents: Record<string, string> = {
    indigo: 'bg-surface-muted text-primary-900',
    emerald: 'bg-success/10 text-success',
    rose: 'bg-danger/10 text-danger',
    amber: 'bg-warning/15 text-[#8A5A00]',
    slate: 'bg-surface-muted text-ink-muted',
  }
  return (
    <div className="bg-surface rounded-lg shadow-soft border border-line p-4 flex items-start gap-3 hover:shadow-hover transition-shadow">
      {icon && (
        <div className={`rounded-md w-10 h-10 shrink-0 flex items-center justify-center text-lg leading-none ${accents[accent]}`}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <div className="text-[11px] font-bold text-ink-muted uppercase tracking-wide">{label}</div>
        <div className="text-[22px] leading-tight font-extrabold text-ink mt-1 truncate tabular-nums">{value}</div>
        {sub && <div className="text-xs leading-snug text-ink-soft mt-1">{sub}</div>}
      </div>
    </div>
  )
}
