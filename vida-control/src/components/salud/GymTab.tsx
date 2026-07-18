import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../../lib/store.ts'
import type { EjercicioSesion, Entreno } from '../../types.ts'
import { uid } from '../../lib/id.ts'
import { hoy, etiquetaFecha } from '../../lib/date.ts'
import { numero } from '../../lib/format.ts'
import { serieVolumen, volumenEntreno } from '../../lib/metrics.ts'
import { COLOR } from '../../lib/theme.ts'
import { boton, Campo, Card, EmptyState, inputBase, KpiCard, Modal, SectionTitle } from '../common/ui.tsx'

export function GymTab() {
  const { db, update } = useStore()
  const [modal, setModal] = useState(false)

  const ordenados = [...db.entrenos].sort((a, b) => b.fecha.localeCompare(a.fecha))
  const serie = serieVolumen(db.entrenos)
    .slice(-14)
    .map((p) => ({ ...p, etiqueta: etiquetaFecha(p.fecha).replace(/ \d{4}$/, '') }))
  const ultimo = ordenados[0]

  const addEntreno = (e: Entreno) => update((d) => ({ ...d, entrenos: [...d.entrenos, e] }))
  const delEntreno = (id: string) => update((d) => ({ ...d, entrenos: d.entrenos.filter((e) => e.id !== id) }))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink-soft">Rutinas de gimnasio</h2>
        <button className={boton.salud} onClick={() => setModal(true)}>
          ＋ Nueva sesión
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Sesiones" value={db.entrenos.length} tone="salud" />
        <KpiCard label="Último volumen" value={ultimo ? `${numero(volumenEntreno(ultimo))} kg` : '—'} tone="ink" />
        <KpiCard label="Última sesión" value={ultimo ? etiquetaFecha(ultimo.fecha).replace(/ \d{4}$/, '') : '—'} tone="ink" />
      </div>

      <Card className="p-4">
        <SectionTitle>Volumen por sesión (reps × peso)</SectionTitle>
        {serie.length === 0 ? (
          <EmptyState titulo="Sin sesiones registradas" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={serie} margin={{ left: -4, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLOR.line} vertical={false} />
              <XAxis dataKey="etiqueta" tick={{ fontSize: 10, fill: COLOR.inkSoft }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: COLOR.inkSoft }} axisLine={false} tickLine={false} width={56} />
              <Tooltip formatter={(v) => `${numero(Number(v))} kg`} />
              <Line type="monotone" dataKey="valor" name="Volumen" stroke={COLOR.salud} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="space-y-3">
        {ordenados.length === 0 ? (
          <EmptyState titulo="Aún no has registrado entrenos" />
        ) : (
          ordenados.map((e) => (
            <Card key={e.id} className="p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <div className="font-semibold">{e.nombre}</div>
                  <div className="text-xs text-ink-muted">{etiquetaFecha(e.fecha)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-md bg-salud-soft px-2 py-0.5 text-xs font-medium text-salud">
                    {numero(volumenEntreno(e))} kg
                  </span>
                  <button onClick={() => delEntreno(e.id)} className="text-ink-muted hover:text-danger" aria-label="Eliminar">
                    🗑
                  </button>
                </div>
              </div>
              <ul className="space-y-1 text-sm">
                {e.ejercicios.map((ej, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-x-2">
                    <span className="font-medium">{ej.nombre}</span>
                    <span className="text-ink-muted">
                      {ej.series.map((s) => `${s.reps}×${s.peso}kg`).join('  ·  ')}
                    </span>
                  </li>
                ))}
              </ul>
              {e.nota && <p className="mt-2 text-xs text-ink-muted">{e.nota}</p>}
            </Card>
          ))
        )}
      </div>

      {modal && <ModalEntreno onClose={() => setModal(false)} onGuardar={addEntreno} />}
    </div>
  )
}

interface BorradorEjercicio {
  nombre: string
  series: { reps: string; peso: string }[]
}

function ModalEntreno({ onClose, onGuardar }: { onClose: () => void; onGuardar: (e: Entreno) => void }) {
  const [fecha, setFecha] = useState(hoy())
  const [nombre, setNombre] = useState('')
  const [nota, setNota] = useState('')
  const [ejercicios, setEjercicios] = useState<BorradorEjercicio[]>([
    { nombre: '', series: [{ reps: '', peso: '' }] },
  ])

  const setEj = (i: number, patch: Partial<BorradorEjercicio>) =>
    setEjercicios((arr) => arr.map((e, j) => (j === i ? { ...e, ...patch } : e)))

  const setSerie = (i: number, k: number, patch: Partial<{ reps: string; peso: string }>) =>
    setEjercicios((arr) =>
      arr.map((e, j) => (j === i ? { ...e, series: e.series.map((s, l) => (l === k ? { ...s, ...patch } : s)) } : e)),
    )

  const addSerie = (i: number) =>
    setEjercicios((arr) => arr.map((e, j) => (j === i ? { ...e, series: [...e.series, { reps: '', peso: '' }] } : e)))

  const guardar = () => {
    if (!nombre.trim()) return
    const limpios: EjercicioSesion[] = []
    for (const e of ejercicios) {
      if (!e.nombre.trim()) continue
      const series = e.series
        .map((s) => ({ reps: Number(s.reps.replace(',', '.')) || 0, peso: Number(s.peso.replace(',', '.')) || 0 }))
        .filter((s) => s.reps > 0)
      if (series.length > 0) limpios.push({ nombre: e.nombre.trim(), series })
    }
    if (limpios.length === 0) return
    onGuardar({ id: uid(), fecha, nombre: nombre.trim(), ejercicios: limpios, nota: nota.trim() || undefined })
    onClose()
  }

  return (
    <Modal titulo="Nueva sesión de gimnasio" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Fecha">
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputBase} />
          </Campo>
          <Campo label="Nombre de la rutina">
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputBase} placeholder="Empuje, Pierna…" />
          </Campo>
        </div>

        <div className="space-y-3">
          {ejercicios.map((ej, i) => (
            <div key={i} className="rounded-lg border border-line p-3">
              <div className="mb-2 flex items-center gap-2">
                <input
                  value={ej.nombre}
                  onChange={(e) => setEj(i, { nombre: e.target.value })}
                  className={inputBase}
                  placeholder={`Ejercicio ${i + 1} (p.ej. Press banca)`}
                />
                {ejercicios.length > 1 && (
                  <button
                    onClick={() => setEjercicios((arr) => arr.filter((_, j) => j !== i))}
                    className="text-ink-muted hover:text-danger"
                    aria-label="Quitar ejercicio"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {ej.series.map((s, k) => (
                  <div key={k} className="flex items-center gap-2 text-sm">
                    <span className="w-6 text-ink-muted">{k + 1}.</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={s.reps}
                      onChange={(e) => setSerie(i, k, { reps: e.target.value })}
                      className={`${inputBase} w-20`}
                      placeholder="reps"
                    />
                    <span className="text-ink-muted">×</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={s.peso}
                      onChange={(e) => setSerie(i, k, { peso: e.target.value })}
                      className={`${inputBase} w-24`}
                      placeholder="kg"
                    />
                  </div>
                ))}
                <button onClick={() => addSerie(i)} className="text-xs font-medium text-salud hover:underline">
                  ＋ Añadir serie
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={() => setEjercicios((arr) => [...arr, { nombre: '', series: [{ reps: '', peso: '' }] }])}
            className={boton.suave}
          >
            ＋ Añadir ejercicio
          </button>
        </div>

        <Campo label="Nota (opcional)">
          <input value={nota} onChange={(e) => setNota(e.target.value)} className={inputBase} />
        </Campo>

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
