import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { useEffect } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl bg-surface shadow-soft border border-line/60 ${className}`}>{children}</div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h2 className="text-lg font-semibold text-ink">{children}</h2>
      {action}
    </div>
  )
}

export function KpiCard({
  label,
  value,
  sub,
  tone = 'ink',
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: 'ink' | 'eco' | 'salud' | 'habito' | 'danger' | 'success'
}) {
  const color: Record<string, string> = {
    ink: 'text-ink',
    eco: 'text-eco',
    salud: 'text-salud',
    habito: 'text-habito',
    danger: 'text-danger',
    success: 'text-success',
  }
  return (
    <Card className="p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${color[tone]}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-soft">{sub}</div>}
    </Card>
  )
}

const BOTON_BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed'

export const boton = {
  primario: `${BOTON_BASE} bg-ink text-white hover:bg-ink/90`,
  eco: `${BOTON_BASE} bg-eco text-white hover:brightness-95`,
  salud: `${BOTON_BASE} bg-salud text-white hover:brightness-95`,
  habito: `${BOTON_BASE} bg-habito text-white hover:brightness-95`,
  suave: `${BOTON_BASE} bg-surface-muted text-ink-soft hover:bg-line`,
  peligro: `${BOTON_BASE} bg-danger/10 text-danger hover:bg-danger/20`,
}

export const inputBase =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-salud focus:outline-none'

export function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  )
}

export function EmptyState({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong bg-surface/50 p-8 text-center">
      <p className="font-medium text-ink-soft">{titulo}</p>
      {children && <p className="mt-1 text-sm text-ink-muted">{children}</p>}
    </div>
  )
}

export function Modal({
  titulo,
  onClose,
  children,
}: {
  titulo: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-surface p-5 shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{titulo}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-ink-muted hover:bg-surface-muted" aria-label="Cerrar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
