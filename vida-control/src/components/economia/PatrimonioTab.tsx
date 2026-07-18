import { useState } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../../lib/store.ts'
import type { Activo, SnapshotPatrimonio, TipoActivo } from '../../types.ts'
import { uid } from '../../lib/id.ts'
import { hoy, etiquetaFecha } from '../../lib/date.ts'
import { euros } from '../../lib/format.ts'
import { patrimonioNeto, seriePatrimonio } from '../../lib/metrics.ts'
import { COLOR } from '../../lib/theme.ts'
import { boton, Campo, Card, EmptyState, inputBase, KpiCard, Modal, SectionTitle } from '../common/ui.tsx'

const TIPOS: { id: TipoActivo; etiqueta: string }[] = [
  { id: 'banco', etiqueta: 'Cuenta bancaria' },
  { id: 'efectivo', etiqueta: 'Efectivo' },
  { id: 'inversion', etiqueta: 'Inversión' },
  { id: 'inmueble', etiqueta: 'Inmueble' },
  { id: 'deuda', etiqueta: 'Deuda' },
  { id: 'otro', etiqueta: 'Otro' },
]

export function PatrimonioTab() {
  const { db, update } = useStore()
  const [modalActivo, setModalActivo] = useState(false)
  const [modalSnap, setModalSnap] = useState(false)

  const serie = seriePatrimonio(db.patrimonio).map((p) => ({ ...p, etiqueta: etiquetaFecha(p.fecha) }))
  const ordenados = [...db.patrimonio].sort((a, b) => b.fecha.localeCompare(a.fecha))
  const ultimo = ordenados[0]
  const anterior = ordenados[1]
  const neto = ultimo ? patrimonioNeto(ultimo) : 0
  const variacion = ultimo && anterior ? neto - patrimonioNeto(anterior) : null

  const addActivo = (a: Activo) => update((d) => ({ ...d, activos: [...d.activos, a] }))
  const delActivo = (id: string) =>
    update((d) => ({
      ...d,
      activos: d.activos.filter((a) => a.id !== id),
      patrimonio: d.patrimonio.map((s) => {
        const { [id]: _omit, ...resto } = s.saldos
        return { ...s, saldos: resto }
      }),
    }))
  const addSnap = (s: SnapshotPatrimonio) => update((d) => ({ ...d, patrimonio: [...d.patrimonio, s] }))
  const delSnap = (id: string) => update((d) => ({ ...d, patrimonio: d.patrimonio.filter((s) => s.id !== id) }))

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Patrimonio neto" value={ultimo ? euros(neto) : '—'} sub={ultimo?.fecha} tone="ink" />
        <KpiCard
          label="Variación"
          value={variacion === null ? '—' : `${variacion >= 0 ? '+' : ''}${euros(variacion)}`}
          tone={variacion === null ? 'ink' : variacion >= 0 ? 'success' : 'danger'}
          sub="vs. foto anterior"
        />
      </div>

      <Card className="p-4">
        <SectionTitle
          action={
            <button className={boton.eco} onClick={() => setModalSnap(true)} disabled={db.activos.length === 0}>
              ＋ Foto de patrimonio
            </button>
          }
        >
          Evolución del patrimonio
        </SectionTitle>
        {serie.length === 0 ? (
          <EmptyState titulo="Aún no hay fotos de patrimonio">
            Da de alta tus activos y registra una foto para ver la evolución.
          </EmptyState>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={serie} margin={{ left: -8, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="gradNeto" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLOR.eco} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={COLOR.eco} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="etiqueta" tick={{ fontSize: 11, fill: COLOR.inkSoft }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: COLOR.inkSoft }} axisLine={false} tickLine={false} width={56} />
              <Tooltip formatter={(v) => euros(Number(v))} />
              <Area type="monotone" dataKey="total" name="Patrimonio" stroke={COLOR.eco} strokeWidth={2} fill="url(#gradNeto)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <SectionTitle action={<button className={boton.suave} onClick={() => setModalActivo(true)}>＋ Activo</button>}>
            Activos
          </SectionTitle>
          {db.activos.length === 0 ? (
            <EmptyState titulo="Sin activos" />
          ) : (
            <ul className="divide-y divide-line">
              {db.activos.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    <span className="font-medium">{a.nombre}</span>
                    <span className="ml-2 text-xs text-ink-muted">{TIPOS.find((t) => t.id === a.tipo)?.etiqueta}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="tabular-nums text-ink-soft">
                      {ultimo?.saldos[a.id] !== undefined ? euros(ultimo.saldos[a.id]) : '—'}
                    </span>
                    <button onClick={() => delActivo(a.id)} className="text-ink-muted hover:text-danger" aria-label="Eliminar">
                      🗑
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <SectionTitle>Fotos registradas</SectionTitle>
          {ordenados.length === 0 ? (
            <EmptyState titulo="Sin fotos" />
          ) : (
            <ul className="divide-y divide-line">
              {ordenados.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    <span className="font-medium">{etiquetaFecha(s.fecha)}</span>
                    {s.nota && <span className="ml-2 text-xs text-ink-muted">{s.nota}</span>}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="tabular-nums font-semibold">{euros(patrimonioNeto(s))}</span>
                    <button onClick={() => delSnap(s.id)} className="text-ink-muted hover:text-danger" aria-label="Eliminar">
                      🗑
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {modalActivo && <ModalActivo onClose={() => setModalActivo(false)} onGuardar={addActivo} />}
      {modalSnap && (
        <ModalSnapshot activos={db.activos} ultimo={ultimo} onClose={() => setModalSnap(false)} onGuardar={addSnap} />
      )}
    </div>
  )
}

function ModalActivo({ onClose, onGuardar }: { onClose: () => void; onGuardar: (a: Activo) => void }) {
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<TipoActivo>('banco')
  const guardar = () => {
    if (!nombre.trim()) return
    onGuardar({ id: uid(), nombre: nombre.trim(), tipo })
    onClose()
  }
  return (
    <Modal titulo="Nuevo activo" onClose={onClose}>
      <div className="space-y-3">
        <Campo label="Nombre">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputBase} autoFocus placeholder="p.ej. Cuenta nómina" />
        </Campo>
        <Campo label="Tipo">
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoActivo)} className={inputBase}>
            {TIPOS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.etiqueta}
              </option>
            ))}
          </select>
        </Campo>
        <p className="text-xs text-ink-muted">Las deudas se registran con saldo en negativo en cada foto.</p>
        <div className="flex justify-end gap-2 pt-2">
          <button className={boton.suave} onClick={onClose}>
            Cancelar
          </button>
          <button className={boton.eco} onClick={guardar}>
            Guardar
          </button>
        </div>
      </div>
    </Modal>
  )
}

function ModalSnapshot({
  activos,
  ultimo,
  onClose,
  onGuardar,
}: {
  activos: Activo[]
  ultimo?: SnapshotPatrimonio
  onClose: () => void
  onGuardar: (s: SnapshotPatrimonio) => void
}) {
  const [fecha, setFecha] = useState(hoy())
  const [nota, setNota] = useState('')
  const [saldos, setSaldos] = useState<Record<string, string>>(() =>
    Object.fromEntries(activos.map((a) => [a.id, ultimo?.saldos[a.id] !== undefined ? String(ultimo.saldos[a.id]) : ''])),
  )

  const total = activos.reduce((s, a) => s + (Number(saldos[a.id]?.replace(',', '.')) || 0), 0)

  const guardar = () => {
    const limpios: Record<string, number> = {}
    for (const a of activos) {
      const n = Number(saldos[a.id]?.replace(',', '.'))
      if (Number.isFinite(n) && saldos[a.id] !== '') limpios[a.id] = n
    }
    onGuardar({ id: uid(), fecha, saldos: limpios, nota: nota.trim() || undefined })
    onClose()
  }

  return (
    <Modal titulo="Foto de patrimonio" onClose={onClose}>
      <div className="space-y-3">
        <Campo label="Fecha">
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputBase} />
        </Campo>
        <div className="space-y-2">
          {activos.map((a) => (
            <div key={a.id} className="flex items-center gap-3">
              <span className="flex-1 text-sm">{a.nombre}</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={saldos[a.id] ?? ''}
                onChange={(e) => setSaldos((s) => ({ ...s, [a.id]: e.target.value }))}
                className={`${inputBase} w-32`}
                placeholder="0"
              />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-line pt-2 text-sm font-semibold">
          <span>Patrimonio neto</span>
          <span className="tabular-nums">{euros(total)}</span>
        </div>
        <Campo label="Nota (opcional)">
          <input value={nota} onChange={(e) => setNota(e.target.value)} className={inputBase} />
        </Campo>
        <div className="flex justify-end gap-2 pt-2">
          <button className={boton.suave} onClick={onClose}>
            Cancelar
          </button>
          <button className={boton.eco} onClick={guardar}>
            Guardar
          </button>
        </div>
      </div>
    </Modal>
  )
}
