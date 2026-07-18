import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../../lib/store.ts'
import type { MedidaCorporal } from '../../types.ts'
import { uid } from '../../lib/id.ts'
import { hoy, etiquetaFecha } from '../../lib/date.ts'
import { conUnidad } from '../../lib/format.ts'
import { serieMedida } from '../../lib/metrics.ts'
import { COLOR } from '../../lib/theme.ts'
import { boton, Campo, Card, EmptyState, inputBase, KpiCard, Modal, SectionTitle } from '../common/ui.tsx'

type CampoMedida = 'peso' | 'grasa' | 'musculo' | 'cintura'

const CAMPOS: { id: CampoMedida; etiqueta: string; unidad: string }[] = [
  { id: 'peso', etiqueta: 'Peso', unidad: 'kg' },
  { id: 'grasa', etiqueta: 'Grasa', unidad: '%' },
  { id: 'musculo', etiqueta: 'Músculo', unidad: '%' },
  { id: 'cintura', etiqueta: 'Cintura', unidad: 'cm' },
]

export function CorporalTab() {
  const { db, update } = useStore()
  const [modal, setModal] = useState(false)
  const [campo, setCampo] = useState<CampoMedida>('peso')

  const serie = serieMedida(db.medidas, campo).map((p) => ({ ...p, etiqueta: etiquetaFecha(p.fecha) }))
  const ordenadas = [...db.medidas].sort((a, b) => b.fecha.localeCompare(a.fecha))
  const ultima = ordenadas[0]
  const unidad = CAMPOS.find((c) => c.id === campo)!.unidad

  const addMedida = (m: MedidaCorporal) => update((d) => ({ ...d, medidas: [...d.medidas, m] }))
  const delMedida = (id: string) => update((d) => ({ ...d, medidas: d.medidas.filter((m) => m.id !== id) }))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink-soft">Valores corporales</h2>
        <button className={boton.salud} onClick={() => setModal(true)}>
          ＋ Nueva medición
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CAMPOS.map((c) => (
          <KpiCard key={c.id} label={c.etiqueta} value={conUnidad(ultima?.[c.id], c.unidad)} tone="salud" />
        ))}
      </div>

      <Card className="p-4">
        <SectionTitle
          action={
            <div className="flex gap-1 rounded-lg bg-surface-muted p-1 text-xs">
              {CAMPOS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCampo(c.id)}
                  className={`rounded-md px-2 py-1 font-medium ${campo === c.id ? 'bg-surface text-ink shadow-soft' : 'text-ink-soft'}`}
                >
                  {c.etiqueta}
                </button>
              ))}
            </div>
          }
        >
          Evolución
        </SectionTitle>
        {serie.length === 0 ? (
          <EmptyState titulo="Sin datos para este valor" />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={serie} margin={{ left: -10, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLOR.line} vertical={false} />
              <XAxis dataKey="etiqueta" tick={{ fontSize: 11, fill: COLOR.inkSoft }} axisLine={false} tickLine={false} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11, fill: COLOR.inkSoft }} axisLine={false} tickLine={false} width={44} />
              <Tooltip formatter={(v) => `${Number(v)} ${unidad}`} />
              <Line type="monotone" dataKey="valor" name={campo} stroke={COLOR.salud} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card className="p-4">
        <SectionTitle>Historial</SectionTitle>
        {ordenadas.length === 0 ? (
          <EmptyState titulo="Sin mediciones" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-muted">
                  <th className="py-2 pr-2 font-medium">Fecha</th>
                  {CAMPOS.map((c) => (
                    <th key={c.id} className="py-2 px-2 font-medium text-right">
                      {c.etiqueta}
                    </th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ordenadas.map((m) => (
                  <tr key={m.id}>
                    <td className="py-2 pr-2 whitespace-nowrap">{etiquetaFecha(m.fecha)}</td>
                    {CAMPOS.map((c) => (
                      <td key={c.id} className="py-2 px-2 text-right tabular-nums">
                        {m[c.id] ?? '—'}
                      </td>
                    ))}
                    <td className="py-2 text-right">
                      <button onClick={() => delMedida(m.id)} className="text-ink-muted hover:text-danger" aria-label="Eliminar">
                        🗑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {modal && <ModalMedida onClose={() => setModal(false)} onGuardar={addMedida} />}
    </div>
  )
}

function ModalMedida({ onClose, onGuardar }: { onClose: () => void; onGuardar: (m: MedidaCorporal) => void }) {
  const [fecha, setFecha] = useState(hoy())
  const [vals, setVals] = useState<Record<CampoMedida, string>>({ peso: '', grasa: '', musculo: '', cintura: '' })

  const guardar = () => {
    const m: MedidaCorporal = { id: uid(), fecha }
    let alguno = false
    for (const c of CAMPOS) {
      const n = Number(vals[c.id].replace(',', '.'))
      if (vals[c.id] !== '' && Number.isFinite(n)) {
        m[c.id] = n
        alguno = true
      }
    }
    if (!alguno) return
    onGuardar(m)
    onClose()
  }

  return (
    <Modal titulo="Nueva medición" onClose={onClose}>
      <div className="space-y-3">
        <Campo label="Fecha">
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputBase} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          {CAMPOS.map((c) => (
            <Campo key={c.id} label={`${c.etiqueta} (${c.unidad})`}>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={vals[c.id]}
                onChange={(e) => setVals((v) => ({ ...v, [c.id]: e.target.value }))}
                className={inputBase}
              />
            </Campo>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button className={boton.suave} onClick={onClose}>
            Cancelar
          </button>
          <button className={boton.salud} onClick={guardar}>
            Guardar
          </button>
        </div>
      </div>
    </Modal>
  )
}
