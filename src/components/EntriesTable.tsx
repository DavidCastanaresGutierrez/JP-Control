import { useMemo, useState } from 'react'
import type { Entry } from '../types'
import { fmtEur2, fmtFecha } from '../lib/format'

export function EntriesTable({ entries }: { entries: Entry[] }) {
  const [cuenta, setCuenta] = useState<string>('todas')
  const [q, setQ] = useState('')

  const cuentas = useMemo(
    () => [...new Set(entries.map((e) => e.cuenta))].sort(),
    [entries],
  )

  const filtered = useMemo(() => {
    const ql = q.toLowerCase()
    return entries
      .filter((e) => cuenta === 'todas' || e.cuenta === cuenta)
      .filter(
        (e) =>
          !ql ||
          e.concepto.toLowerCase().includes(ql) ||
          (e.asiento ?? '').toLowerCase().includes(ql) ||
          (e.area ?? '').toLowerCase().includes(ql),
      )
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [entries, cuenta, q])

  const totalDebe = filtered.reduce((s, e) => s + e.debe, 0)
  const totalHaber = filtered.reduce((s, e) => s + e.haber, 0)

  return (
    <div className="bg-surface rounded-[24px] shadow-soft border border-line">
      <div className="p-4 flex flex-wrap gap-3 items-center border-b border-line">
        <select
          value={cuenta}
          onChange={(e) => setCuenta(e.target.value)}
          className="text-sm border border-line rounded-[10px] px-3 py-1.5 bg-surface text-ink focus:ring-2 focus:ring-accent-500/40 focus:border-accent-500 outline-none"
        >
          <option value="todas">Todas las cuentas</option>
          {cuentas.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar concepto, asiento, área…"
          className="text-sm border border-line rounded-[10px] px-3 py-1.5 flex-1 min-w-48 text-ink focus:ring-2 focus:ring-accent-500/40 focus:border-accent-500 outline-none"
        />
        <div className="text-xs text-ink-muted">{filtered.length} apuntes</div>
      </div>
      <div className="overflow-x-auto max-h-[32rem] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface-muted text-[11px] text-ink-muted uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3 font-bold">Fecha</th>
              <th className="text-left px-4 py-3 font-bold">Asiento</th>
              <th className="text-left px-4 py-3 font-bold">Concepto</th>
              <th className="text-left px-4 py-3 font-bold">Área</th>
              <th className="text-left px-4 py-3 font-bold">Cuenta</th>
              <th className="text-right px-4 py-3 font-bold">Debe</th>
              <th className="text-right px-4 py-3 font-bold">Haber</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} className="border-t border-line hover:bg-surface-muted transition-colors">
                <td className="px-4 py-2.5 whitespace-nowrap text-ink">{fmtFecha(e.fecha)}</td>
                <td className="px-4 py-2.5 whitespace-nowrap text-ink-muted text-xs">
                  {e.asiento ?? '—'}
                </td>
                <td className="px-4 py-2.5 text-ink">{e.concepto}</td>
                <td className="px-4 py-2.5 text-ink-soft">{e.area ?? '—'}</td>
                <td className="px-4 py-2.5 text-xs text-ink-muted whitespace-nowrap">{e.cuenta}</td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap text-ink tabular-nums">
                  {e.debe ? fmtEur2(e.debe) : '—'}
                </td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap text-success tabular-nums">
                  {e.haber ? fmtEur2(e.haber) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 bg-surface-muted font-bold">
            <tr className="border-t border-line-strong">
              <td className="px-4 py-3 text-ink" colSpan={5}>
                Total filtrado
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap text-ink tabular-nums">
                {fmtEur2(totalDebe)}
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap text-success tabular-nums">
                {fmtEur2(totalHaber)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
