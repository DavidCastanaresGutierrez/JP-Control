import { useMemo } from 'react'
import type { Project } from '../types'
import { DEPARTAMENTOS, horasDePersonas, OTROS_GASTOS, partidasExternas } from '../lib/metrics'
import { fmtEur, fmtNum } from '../lib/format'

/**
 * Asignación de personas y facturas de externos a departamentos.
 * Es configuración (se hace una vez), por eso vive en Ajustes.
 */
export function DeptAssignment({
  project,
  onUpdate,
}: {
  project: Project
  onUpdate: (patch: Partial<Project>) => void
}) {
  const porPersona = useMemo(() => {
    const m = new Map<string, { coste: number; horas: number }>()
    for (const h of horasDePersonas(project.hours)) {
      const a = m.get(h.persona) ?? { coste: 0, horas: 0 }
      a.coste += h.coste ?? 0
      a.horas += h.horas
      m.set(h.persona, a)
    }
    return m
  }, [project.hours])
  const hayCoste = [...porPersona.values()].some((v) => v.coste > 0)
  const medidaPersona = (persona: string) => {
    const v = porPersona.get(persona)
    if (!v) return '—'
    return hayCoste ? fmtEur(v.coste) : `${fmtNum(v.horas)} h`
  }
  const personas = useMemo(
    () =>
      [...porPersona.keys()].sort((a, b) => {
        const va = porPersona.get(a)!
        const vb = porPersona.get(b)!
        return hayCoste ? vb.coste - va.coste : vb.horas - va.horas
      }),
    [porPersona, hayCoste],
  )

  const partidas = useMemo(() => partidasExternas(project.entries), [project.entries])
  const partidasPorTipo = useMemo(() => {
    const g = new Map<string, typeof partidas>()
    for (const p of partidas) {
      if (!g.has(p.tipo)) g.set(p.tipo, [])
      g.get(p.tipo)!.push(p)
    }
    return [...g.entries()]
  }, [partidas])

  const setDept = (persona: string, dept: string) => {
    const next = { ...(project.personDept ?? {}) }
    if (dept.trim()) next[persona] = dept.trim()
    else delete next[persona]
    onUpdate({ personDept: next })
  }
  const setExtDept = (id: string, dept: string) => {
    const next = { ...(project.extDept ?? {}) }
    if (dept.trim() && dept !== OTROS_GASTOS) next[id] = dept.trim()
    else delete next[id]
    onUpdate({ extDept: next })
  }

  if (personas.length === 0 && partidas.length === 0) {
    return (
      <div className="bg-surface rounded-[24px] shadow-soft border border-line p-6">
        <h3 className="font-bold text-ink text-lg">Departamentos</h3>
        <p className="text-sm text-ink-soft mt-1">
          Importa las horas por empleado y el detalle de explotación para asignar personas y
          facturas a departamentos.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-surface rounded-[24px] shadow-soft border border-line p-6 space-y-6">
      <div>
        <h3 className="font-bold text-ink text-lg">Departamentos</h3>
        <p className="text-xs text-ink-soft mt-0.5">
          Asocia cada persona y cada factura de externo a su departamento. Se usa para el control de
          gasto por departamento del Panel y la pestaña Horas.
        </p>
      </div>

      {/* Personas */}
      {personas.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-ink mb-2">Departamento de cada persona</h4>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
            {personas.map((persona) => {
              const actual = project.personDept?.[persona] ?? ''
              const esOtro = actual !== '' && !DEPARTAMENTOS.includes(actual as never)
              return (
                <div key={persona} className="flex items-center gap-2">
                  <span className="flex-1 truncate text-sm text-ink-soft" title={persona}>
                    {persona}
                  </span>
                  <span className="text-xs text-ink-muted tabular-nums w-20 text-right">
                    {medidaPersona(persona)}
                  </span>
                  <select
                    value={actual}
                    onChange={(e) => setDept(persona, e.target.value)}
                    className="w-48 text-sm border border-line rounded-[10px] px-2 py-1 bg-surface text-ink focus:ring-2 focus:ring-accent-500/40 focus:border-accent-500 outline-none"
                  >
                    <option value="">— Sin asignar —</option>
                    {DEPARTAMENTOS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                    {esOtro && <option value={actual}>{actual} (otro)</option>}
                  </select>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Facturas de externos */}
      {partidas.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-ink mb-1">
            Facturas de externos por departamento
          </h4>
          <p className="text-xs text-ink-soft mb-2">
            Cada factura de externo cuenta como coste del departamento al que la asignes. Sin asignar
            van a «Otros Gastos». Agrupadas por tipo de factura.
          </p>
          <div className="space-y-4">
            {partidasPorTipo.map(([tipo, items]) => (
              <div key={tipo}>
                <div className="text-[11px] font-bold uppercase tracking-wide text-ink-muted mb-1">
                  {tipo}
                </div>
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                  {items.map((p) => {
                    const asignado = project.extDept?.[p.id] ?? ''
                    const actual = asignado || OTROS_GASTOS
                    const esOtro = asignado !== '' && !DEPARTAMENTOS.includes(asignado as never)
                    return (
                      <div key={p.id} className="flex items-center gap-2">
                        <span className="flex-1 truncate text-sm text-ink-soft" title={p.concepto}>
                          {p.concepto}
                        </span>
                        <span className="text-xs text-ink-muted tabular-nums w-20 text-right">
                          {fmtEur(p.coste)}
                        </span>
                        <select
                          value={actual}
                          onChange={(e) => setExtDept(p.id, e.target.value)}
                          className="w-48 text-sm border border-line rounded-[10px] px-2 py-1 bg-surface text-ink focus:ring-2 focus:ring-accent-500/40 focus:border-accent-500 outline-none"
                        >
                          <option value={OTROS_GASTOS}>{OTROS_GASTOS}</option>
                          {DEPARTAMENTOS.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                          {esOtro && <option value={asignado}>{asignado} (otro)</option>}
                        </select>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
