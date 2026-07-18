import { useState } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../../lib/store.ts'
import type { Comida, TipoComida } from '../../types.ts'
import { uid } from '../../lib/id.ts'
import { hoy, sumarDias, etiquetaFecha } from '../../lib/date.ts'
import { resumenDia, serieCaloriasDiarias } from '../../lib/metrics.ts'
import { COLOR } from '../../lib/theme.ts'
import { boton, Campo, Card, EmptyState, inputBase, KpiCard, Modal, SectionTitle } from '../common/ui.tsx'

const TIPOS: { id: TipoComida; etiqueta: string }[] = [
  { id: 'desayuno', etiqueta: 'Desayuno' },
  { id: 'almuerzo', etiqueta: 'Almuerzo' },
  { id: 'comida', etiqueta: 'Comida' },
  { id: 'merienda', etiqueta: 'Merienda' },
  { id: 'cena', etiqueta: 'Cena' },
  { id: 'snack', etiqueta: 'Snack' },
]

export function DietaTab() {
  const { db, update } = useStore()
  const [fecha, setFecha] = useState(hoy())
  const [modal, setModal] = useState(false)

  const r = resumenDia(db.comidas, fecha)
  const delDia = db.comidas.filter((c) => c.fecha === fecha)
  const serie = serieCaloriasDiarias(db.comidas)
    .slice(-14)
    .map((p) => ({ ...p, etiqueta: etiquetaFecha(p.fecha).replace(/ \d{4}$/, '') }))

  const addComida = (c: Comida) => update((d) => ({ ...d, comidas: [...d.comidas, c] }))
  const delComida = (id: string) => update((d) => ({ ...d, comidas: d.comidas.filter((c) => c.id !== id) }))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button className={boton.suave} onClick={() => setFecha((f) => sumarDias(f, -1))} aria-label="Día anterior">
            ←
          </button>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={`${inputBase} w-auto`} />
          <button
            className={boton.suave}
            onClick={() => setFecha((f) => (f >= hoy() ? f : sumarDias(f, 1)))}
            aria-label="Día siguiente"
          >
            →
          </button>
        </div>
        <button className={boton.salud} onClick={() => setModal(true)}>
          ＋ Añadir comida
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Calorías" value={`${Math.round(r.kcal)}`} sub="kcal" tone="salud" />
        <KpiCard label="Proteína" value={`${Math.round(r.proteina)} g`} tone="ink" />
        <KpiCard label="Carbos" value={`${Math.round(r.carbos)} g`} tone="ink" />
        <KpiCard label="Grasa" value={`${Math.round(r.grasa)} g`} tone="ink" />
      </div>

      <Card className="p-4">
        <SectionTitle>Comidas del día</SectionTitle>
        {delDia.length === 0 ? (
          <EmptyState titulo="Nada registrado este día">Añade tu primera comida.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {delDia.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2.5">
                <span className="rounded-md bg-salud-soft px-2 py-0.5 text-xs font-medium text-salud">
                  {TIPOS.find((t) => t.id === c.tipo)?.etiqueta ?? c.tipo}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{c.descripcion}</div>
                  {(c.proteina || c.carbos || c.grasa) && (
                    <div className="text-xs text-ink-muted">
                      P {c.proteina ?? 0} · C {c.carbos ?? 0} · G {c.grasa ?? 0}
                    </div>
                  )}
                </div>
                <span className="tabular-nums font-semibold">{c.kcal ? `${Math.round(c.kcal)} kcal` : '—'}</span>
                <button onClick={() => delComida(c.id)} className="text-ink-muted hover:text-danger" aria-label="Eliminar">
                  🗑
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <SectionTitle>Calorías · últimos 14 días</SectionTitle>
        {serie.length === 0 ? (
          <EmptyState titulo="Sin datos" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={serie} margin={{ left: -12, right: 8, top: 8 }}>
              <XAxis dataKey="etiqueta" tick={{ fontSize: 10, fill: COLOR.inkSoft }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: COLOR.inkSoft }} axisLine={false} tickLine={false} width={44} />
              <Tooltip formatter={(v) => `${Math.round(Number(v))} kcal`} />
              <Bar dataKey="valor" name="kcal" fill={COLOR.salud} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {modal && <ModalComida fecha={fecha} onClose={() => setModal(false)} onGuardar={addComida} />}
    </div>
  )
}

function ModalComida({ fecha, onClose, onGuardar }: { fecha: string; onClose: () => void; onGuardar: (c: Comida) => void }) {
  const [tipo, setTipo] = useState<TipoComida>('desayuno')
  const [descripcion, setDescripcion] = useState('')
  const [kcal, setKcal] = useState('')
  const [proteina, setProteina] = useState('')
  const [carbos, setCarbos] = useState('')
  const [grasa, setGrasa] = useState('')

  const num = (s: string) => {
    const n = Number(s.replace(',', '.'))
    return s !== '' && Number.isFinite(n) ? n : undefined
  }

  const guardar = () => {
    if (!descripcion.trim()) return
    onGuardar({
      id: uid(),
      fecha,
      tipo,
      descripcion: descripcion.trim(),
      kcal: num(kcal),
      proteina: num(proteina),
      carbos: num(carbos),
      grasa: num(grasa),
    })
    onClose()
  }

  return (
    <Modal titulo="Añadir comida" onClose={onClose}>
      <div className="space-y-3">
        <Campo label="Tipo">
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoComida)} className={inputBase}>
            {TIPOS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.etiqueta}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Descripción">
          <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={inputBase} autoFocus placeholder="p.ej. Avena con plátano" />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Calorías (kcal)">
            <input type="number" inputMode="decimal" value={kcal} onChange={(e) => setKcal(e.target.value)} className={inputBase} />
          </Campo>
          <Campo label="Proteína (g)">
            <input type="number" inputMode="decimal" value={proteina} onChange={(e) => setProteina(e.target.value)} className={inputBase} />
          </Campo>
          <Campo label="Carbos (g)">
            <input type="number" inputMode="decimal" value={carbos} onChange={(e) => setCarbos(e.target.value)} className={inputBase} />
          </Campo>
          <Campo label="Grasa (g)">
            <input type="number" inputMode="decimal" value={grasa} onChange={(e) => setGrasa(e.target.value)} className={inputBase} />
          </Campo>
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
