import { useEffect, useMemo, useRef, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Entry } from '../types'
import { fmtEur2, fmtFecha, fmtPct } from '../lib/format'
import { CHART_COLORS, TOOLTIP_STYLE } from '../lib/chartTheme'

type SortState = { key: 'fecha' | 'cuenta'; dir: 'asc' | 'desc' }

export function EntriesTable({ entries }: { entries: Entry[] }) {
  const [cuenta, setCuenta] = useState<string>('todas')
  const [q, setQ] = useState('')
  const [sortState, setSortState] = useState<SortState>({ key: 'fecha', dir: 'desc' })
  const [selectedCuenta, setSelectedCuenta] = useState<string | null>(null)

  const cuentas = useMemo(() => [...new Set(entries.map((e) => e.cuenta))].sort(), [entries])

  const base = useMemo(() => {
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
  }, [entries, cuenta, q])

  const chartData = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of base) {
      const importe = Math.abs(e.debe - e.haber)
      if (importe <= 0) continue
      map.set(e.cuenta, (map.get(e.cuenta) ?? 0) + importe)
    }
    return [...map.entries()]
      .map(([cuenta, value]) => ({ cuenta, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value || a.cuenta.localeCompare(b.cuenta))
  }, [base])

  const visible = useMemo(() => {
    if (!selectedCuenta) return base
    return base.filter((e) => e.cuenta === selectedCuenta)
  }, [base, selectedCuenta])

  const rows = useMemo(() => {
    const out = [...visible]
    if (sortState.key === 'fecha') {
      out.sort((a, b) =>
        sortState.dir === 'desc' ? b.fecha.localeCompare(a.fecha) : a.fecha.localeCompare(b.fecha),
      )
      return out
    }

    out.sort((a, b) => {
      const diff =
        sortState.dir === 'asc'
          ? a.cuenta.localeCompare(b.cuenta)
          : b.cuenta.localeCompare(a.cuenta)
      if (diff !== 0) return diff
      return b.fecha.localeCompare(a.fecha)
    })
    return out
  }, [visible, sortState])

  useEffect(() => {
    if (!selectedCuenta) return
    if (!chartData.some((c) => c.cuenta === selectedCuenta)) setSelectedCuenta(null)
  }, [chartData, selectedCuenta])

  // Virtualizacion: con miles de apuntes solo se montan en el DOM las filas
  // visibles (mas un margen), en vez de la tabla entera.
  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 41,
    overscan: 12,
  })
  const virtualRows = virtualizer.getVirtualItems()
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0
  const paddingBottom =
    virtualRows.length > 0 ? virtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end : 0

  const totalDistribuido = chartData.reduce((s, c) => s + c.value, 0)
  const totalVisibleDebe = rows.reduce((s, e) => s + e.debe, 0)
  const totalVisibleHaber = rows.reduce((s, e) => s + e.haber, 0)

  const toggleSort = (key: SortState['key']) => {
    setSortState((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'fecha' ? 'desc' : 'asc' },
    )
  }

  const toggleCuentaSeleccionada = (cuenta: string) => {
    setSelectedCuenta((prev) => (prev === cuenta ? null : cuenta))
  }

  return (
    <div className="bg-surface rounded-[24px] shadow-soft border border-line">
      <div className="p-4 space-y-4 border-b border-line">
        {chartData.length > 0 && (
          <div className="rounded-[20px] border border-line bg-surface-muted/30 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="text-sm font-bold text-ink">Distribucion por cuenta</div>
                <div className="text-[11px] text-ink-muted">
                  Clica un sector para resaltar sus facturas en la tabla.
                </div>
              </div>
              {selectedCuenta && (
                <button
                  type="button"
                  onClick={() => setSelectedCuenta(null)}
                  className="text-xs font-semibold text-ink-soft hover:text-ink underline"
                >
                  Limpiar seleccion
                </button>
              )}
            </div>

            <div className="grid lg:grid-cols-[minmax(0,1.45fr)_320px] gap-4 items-start">
              <div className="rounded-[18px] bg-surface p-2">
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="cuenta"
                      innerRadius={72}
                      outerRadius={120}
                      paddingAngle={2}
                      onClick={(_, index) => {
                        const item = chartData[index]
                        if (item) toggleCuentaSeleccionada(item.cuenta)
                      }}
                    >
                      {chartData.map((d, i) => (
                        <Cell
                          key={d.cuenta}
                          fill={CHART_COLORS[i % CHART_COLORS.length]}
                          stroke={selectedCuenta === d.cuenta ? '#143A45' : 'transparent'}
                          strokeWidth={selectedCuenta === d.cuenta ? 2 : 0}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [fmtEur2(Number(value)), String(name)]}
                      contentStyle={TOOLTIP_STYLE}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-[18px] border border-line bg-surface p-3">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="text-sm font-bold text-ink">Porcentaje por cuenta</div>
                  <div className="text-[11px] text-ink-muted">{fmtEur2(totalDistribuido)}</div>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {chartData.map((d, i) => {
                    const pct = totalDistribuido > 0 ? (d.value / totalDistribuido) * 100 : 0
                    const active = selectedCuenta === d.cuenta
                    return (
                      <button
                        key={d.cuenta}
                        type="button"
                        onClick={() => toggleCuentaSeleccionada(d.cuenta)}
                        className={`w-full flex items-center gap-2 rounded-[12px] px-2 py-2 text-left transition-colors ${
                          active ? 'bg-accent-300/25' : 'hover:bg-surface-muted'
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-sm shrink-0"
                          style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                        />
                        <span className="flex-1 min-w-0">
                          <span className="block truncate text-sm font-medium text-ink">
                            {d.cuenta}
                          </span>
                          <span className="block text-[11px] text-ink-muted">{fmtEur2(d.value)}</span>
                        </span>
                        <span className="text-xs font-bold tabular-nums text-ink">{fmtPct(pct)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3 items-center">
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
            placeholder="Buscar concepto, asiento, area..."
            className="text-sm border border-line rounded-[10px] px-3 py-1.5 flex-1 min-w-48 text-ink focus:ring-2 focus:ring-accent-500/40 focus:border-accent-500 outline-none"
          />
          <div className="text-xs text-ink-muted">{base.length} apuntes</div>
        </div>
      </div>

      <div ref={scrollRef} className="overflow-x-auto max-h-[32rem] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface-muted text-[11px] text-ink-muted uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3 font-bold">
                <button
                  type="button"
                  onClick={() => toggleSort('fecha')}
                  className="inline-flex items-center gap-1 hover:text-primary-900"
                  title="Ordenar por fecha"
                >
                  Fecha
                  {sortState.key === 'fecha' && (
                    <span aria-hidden="true">{sortState.dir === 'desc' ? 'v' : '^'}</span>
                  )}
                </button>
              </th>
              <th className="text-left px-4 py-3 font-bold">Asiento</th>
              <th className="text-left px-4 py-3 font-bold">Concepto</th>
              <th className="text-left px-4 py-3 font-bold">Area</th>
              <th className="text-left px-4 py-3 font-bold">
                <button
                  type="button"
                  onClick={() => toggleSort('cuenta')}
                  className="inline-flex items-center gap-1 hover:text-primary-900"
                  title="Ordenar por cuenta"
                >
                  Cuenta
                  {sortState.key === 'cuenta' && (
                    <span aria-hidden="true">{sortState.dir === 'asc' ? '^' : 'v'}</span>
                  )}
                </button>
              </th>
              <th className="text-right px-4 py-3 font-bold">Debe</th>
              <th className="text-right px-4 py-3 font-bold">Haber</th>
            </tr>
          </thead>
          <tbody>
            {paddingTop > 0 && (
              <tr aria-hidden="true">
                <td colSpan={7} style={{ height: paddingTop, padding: 0, border: 0 }} />
              </tr>
            )}
            {virtualRows.map((vi) => {
              const e = rows[vi.index]
              const active = selectedCuenta === e.cuenta
              return (
                <tr
                  key={e.id}
                  ref={virtualizer.measureElement}
                  data-index={vi.index}
                  className={`border-t border-line transition-colors ${
                    active ? 'bg-accent-300/25' : 'hover:bg-surface-muted'
                  }`}
                >
                  <td className="px-4 py-2.5 whitespace-nowrap text-ink">{fmtFecha(e.fecha)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-ink-muted text-xs">
                    {e.asiento ?? '-'}
                  </td>
                  <td className="px-4 py-2.5 text-ink">{e.concepto}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{e.area ?? '-'}</td>
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleCuentaSeleccionada(e.cuenta)}
                      className={`text-left hover:underline ${
                        active ? 'font-bold text-primary-900' : 'text-ink-muted'
                      }`}
                    >
                      {e.cuenta}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap text-ink tabular-nums">
                    {e.debe ? fmtEur2(e.debe) : '-'}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap text-success tabular-nums">
                    {e.haber ? fmtEur2(e.haber) : '-'}
                  </td>
                </tr>
              )
            })}
            {paddingBottom > 0 && (
              <tr aria-hidden="true">
                <td colSpan={7} style={{ height: paddingBottom, padding: 0, border: 0 }} />
              </tr>
            )}
          </tbody>
          <tfoot className="sticky bottom-0 bg-surface-muted font-bold">
            <tr className="border-t border-line-strong">
              <td className="px-4 py-3 text-ink" colSpan={5}>
                Total filtrado
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap text-ink tabular-nums">
                {fmtEur2(totalVisibleDebe)}
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap text-success tabular-nums">
                {fmtEur2(totalVisibleHaber)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
