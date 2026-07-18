import { useState } from 'react'
import { useStore } from '../../lib/store.ts'
import type { DB, Habito } from '../../types.ts'
import { uid } from '../../lib/id.ts'
import { hoy, sumarDias, inicialDiaSemana, etiquetaFecha } from '../../lib/date.ts'
import { cumplidosRecientes, heatmap, porcentajeCumplimiento, rachaActual } from '../../lib/metrics.ts'
import { boton, Campo, Card, EmptyState, inputBase, Modal } from '../common/ui.tsx'

const EMOJIS = ['💪', '📚', '🧘', '💧', '🏃', '🥗', '😴', '🚭', '🧹', '✍️', '🎯', '☀️']
const COLORES = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#14b8a6', '#6366f1']

function alternarRegistro(d: DB, habitoId: string, fecha: string): DB {
  const id = `${habitoId}:${fecha}`
  const existe = d.registrosHabito.some((r) => r.id === id)
  return {
    ...d,
    registrosHabito: existe
      ? d.registrosHabito.filter((r) => r.id !== id)
      : [...d.registrosHabito, { id, habitoId, fecha }],
  }
}

export function HabitosView() {
  const { db, update } = useStore()
  const [modal, setModal] = useState(false)

  const activos = [...db.habitos]
    .filter((h) => !h.archivado)
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.creado.localeCompare(b.creado))

  const cumplidosHoy = new Set(db.registrosHabito.filter((r) => r.fecha === hoy()).map((r) => r.habitoId))

  const toggle = (habitoId: string, fecha: string) => update((d) => alternarRegistro(d, habitoId, fecha))
  const addHabito = (h: Habito) => update((d) => ({ ...d, habitos: [...d.habitos, h] }))
  const delHabito = (id: string) =>
    update((d) => ({
      ...d,
      habitos: d.habitos.filter((h) => h.id !== id),
      registrosHabito: d.registrosHabito.filter((r) => r.habitoId !== id),
    }))

  const ultimos7 = Array.from({ length: 7 }, (_, i) => sumarDias(hoy(), i - 6))

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-habito">
            <span>✅</span> Hábitos
          </h1>
          <p className="text-sm text-ink-soft">
            {activos.length > 0 ? `${cumplidosHoy.size}/${activos.length} cumplidos hoy` : 'Crea tu primer hábito.'}
          </p>
        </div>
        <button className={boton.habito} onClick={() => setModal(true)}>
          ＋ Nuevo hábito
        </button>
      </header>

      {activos.length === 0 ? (
        <EmptyState titulo="Sin hábitos todavía">Empieza con uno o dos hábitos que quieras consolidar.</EmptyState>
      ) : (
        <div className="space-y-3">
          {activos.map((h) => {
            const racha = rachaActual(db.registrosHabito, h.id)
            const color = h.color ?? '#f59e0b'
            const celdas = heatmap(db.registrosHabito, h.id)
            const pct = porcentajeCumplimiento(db.registrosHabito, h.id, h.creado)
            const semana = cumplidosRecientes(db.registrosHabito, h.id, 7)
            return (
              <Card key={h.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-xl"
                      style={{ background: `${color}22` }}
                    >
                      {h.emoji ?? '🎯'}
                    </span>
                    <div>
                      <div className="font-semibold">{h.nombre}</div>
                      <div className="text-xs text-ink-muted">
                        🔥 {racha} {racha === 1 ? 'día' : 'días'} · {semana}/7 esta semana · {pct}% histórico
                      </div>
                    </div>
                  </div>
                  <button onClick={() => delHabito(h.id)} className="text-ink-muted hover:text-danger" aria-label="Eliminar hábito">
                    🗑
                  </button>
                </div>

                {/* Últimos 7 días */}
                <div className="mt-3 flex justify-between gap-1">
                  {ultimos7.map((f) => {
                    const done = db.registrosHabito.some((r) => r.habitoId === h.id && r.fecha === f)
                    const esHoy = f === hoy()
                    return (
                      <button
                        key={f}
                        onClick={() => toggle(h.id, f)}
                        className={`flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-xs transition ${
                          esHoy ? 'ring-1 ring-line-strong' : ''
                        }`}
                        title={etiquetaFecha(f)}
                      >
                        <span className="text-ink-muted">{inicialDiaSemana(f)}</span>
                        <span
                          className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold"
                          style={done ? { background: color, color: 'white' } : { background: 'var(--color-surface-muted)' }}
                        >
                          {done ? '✓' : ''}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Heatmap ~15 semanas */}
                <div className="mt-3 overflow-x-auto">
                  <div className="grid grid-flow-col grid-rows-7 gap-1" style={{ width: 'max-content' }}>
                    {celdas.map((c) => (
                      <button
                        key={c.fecha}
                        onClick={() => toggle(h.id, c.fecha)}
                        title={`${etiquetaFecha(c.fecha)}${c.cumplido ? ' · cumplido' : ''}`}
                        className="h-3 w-3 rounded-[3px]"
                        style={{ background: c.cumplido ? color : 'var(--color-surface-muted)' }}
                      />
                    ))}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {modal && <ModalHabito orden={activos.length} onClose={() => setModal(false)} onGuardar={addHabito} />}
    </div>
  )
}

function ModalHabito({ orden, onClose, onGuardar }: { orden: number; onClose: () => void; onGuardar: (h: Habito) => void }) {
  const [nombre, setNombre] = useState('')
  const [emoji, setEmoji] = useState(EMOJIS[0])
  const [color, setColor] = useState(COLORES[0])
  const [objetivo, setObjetivo] = useState('7')

  const guardar = () => {
    if (!nombre.trim()) return
    onGuardar({
      id: uid(),
      nombre: nombre.trim(),
      emoji,
      color,
      objetivoSemanal: Math.min(7, Math.max(1, Number(objetivo) || 7)),
      creado: hoy(),
      orden,
    })
    onClose()
  }

  return (
    <Modal titulo="Nuevo hábito" onClose={onClose}>
      <div className="space-y-3">
        <Campo label="Nombre">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputBase} autoFocus placeholder="p.ej. Leer 20 minutos" />
        </Campo>
        <Campo label="Emoji">
          <div className="flex flex-wrap gap-1.5">
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg ${
                  emoji === e ? 'bg-habito-soft ring-1 ring-habito' : 'bg-surface-muted'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </Campo>
        <Campo label="Color">
          <div className="flex flex-wrap gap-2">
            {COLORES.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`h-8 w-8 rounded-full ${color === c ? 'ring-2 ring-offset-2 ring-ink' : ''}`}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
          </div>
        </Campo>
        <Campo label="Objetivo semanal (días)">
          <input type="number" min={1} max={7} value={objetivo} onChange={(e) => setObjetivo(e.target.value)} className={inputBase} />
        </Campo>
        <div className="flex justify-end gap-2 pt-2">
          <button className={boton.suave} onClick={onClose}>
            Cancelar
          </button>
          <button className={boton.habito} onClick={guardar}>
            Guardar
          </button>
        </div>
      </div>
    </Modal>
  )
}
