import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useStore } from '../../lib/store.ts'
import type { TipoMovimiento, Transaccion } from '../../types.ts'
import { uid } from '../../lib/id.ts'
import { hoy, mesDe, etiquetaMes, etiquetaFecha } from '../../lib/date.ts'
import { euros, eurosExactos } from '../../lib/format.ts'
import { gastoPorCategoria, resumenMes, serieMensual } from '../../lib/metrics.ts'
import { colorCategoria, COLOR } from '../../lib/theme.ts'
import { boton, Campo, Card, EmptyState, inputBase, KpiCard, Modal, SectionTitle } from '../common/ui.tsx'

const CATEGORIAS_GASTO = [
  'Alimentación',
  'Vivienda',
  'Transporte',
  'Ocio',
  'Salud',
  'Ropa',
  'Suscripciones',
  'Restaurantes',
  'Educación',
  'Otros',
]
const CATEGORIAS_INGRESO = ['Nómina', 'Extra', 'Inversiones', 'Reembolso', 'Otros']

export function GastosTab() {
  const { db, update } = useStore()
  const [modal, setModal] = useState(false)

  const meses = useMemo(() => {
    const set = new Set(db.transacciones.map((t) => mesDe(t.fecha)))
    set.add(mesDe(hoy()))
    return [...set].sort((a, b) => b.localeCompare(a))
  }, [db.transacciones])

  const [mes, setMes] = useState(mesDe(hoy()))
  const mesSel = meses.includes(mes) ? mes : meses[0]

  const resumen = resumenMes(db.transacciones, mesSel)
  const porCategoria = gastoPorCategoria(db.transacciones, mesSel)
  const serie = serieMensual(db.transacciones).slice(-12).map((p) => ({ ...p, etiqueta: etiquetaMes(p.mes) }))

  const movimientosMes = db.transacciones
    .filter((t) => mesDe(t.fecha) === mesSel)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))

  const eliminar = (id: string) =>
    update((d) => ({ ...d, transacciones: d.transacciones.filter((t) => t.id !== id) }))

  const anadir = (t: Transaccion) => update((d) => ({ ...d, transacciones: [...d.transacciones, t] }))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select value={mesSel} onChange={(e) => setMes(e.target.value)} className={`${inputBase} w-auto`}>
          {meses.map((m) => (
            <option key={m} value={m}>
              {etiquetaMes(m)}
            </option>
          ))}
        </select>
        <button className={boton.eco} onClick={() => setModal(true)}>
          ＋ Añadir movimiento
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Ingresos" value={euros(resumen.ingresos)} tone="success" />
        <KpiCard label="Gastos" value={euros(resumen.gastos)} tone="eco" />
        <KpiCard label="Balance" value={euros(resumen.balance)} tone={resumen.balance >= 0 ? 'success' : 'danger'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <SectionTitle>Evolución mensual</SectionTitle>
          {serie.length === 0 ? (
            <EmptyState titulo="Sin datos todavía" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={serie} margin={{ left: -12, right: 8, top: 8 }}>
                <XAxis dataKey="etiqueta" tick={{ fontSize: 11, fill: COLOR.inkSoft }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: COLOR.inkSoft }} axisLine={false} tickLine={false} width={48} />
                <Tooltip formatter={(v) => euros(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="ingresos" name="Ingresos" fill={COLOR.success} radius={[4, 4, 0, 0]} />
                <Bar dataKey="gastos" name="Gastos" fill={COLOR.eco} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-4">
          <SectionTitle>Gasto por categoría · {etiquetaMes(mesSel)}</SectionTitle>
          {porCategoria.length === 0 ? (
            <EmptyState titulo="Sin gastos este mes" />
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={porCategoria} dataKey="total" nameKey="categoria" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {porCategoria.map((_, i) => (
                      <Cell key={i} fill={colorCategoria(i)} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => euros(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="w-full space-y-1 text-sm">
                {porCategoria.slice(0, 6).map((c, i) => (
                  <li key={c.categoria} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: colorCategoria(i) }} />
                      {c.categoria}
                    </span>
                    <span className="tabular-nums font-medium">{euros(c.total)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <SectionTitle>Movimientos · {etiquetaMes(mesSel)}</SectionTitle>
        {movimientosMes.length === 0 ? (
          <EmptyState titulo="No hay movimientos este mes">Añade el primero con el botón de arriba.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {movimientosMes.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{t.categoria}</span>
                    {t.cuenta && <span className="text-xs text-ink-muted">· {t.cuenta}</span>}
                  </div>
                  <div className="text-xs text-ink-muted">
                    {etiquetaFecha(t.fecha)}
                    {t.nota ? ` · ${t.nota}` : ''}
                  </div>
                </div>
                <span className={`tabular-nums font-semibold ${t.tipo === 'ingreso' ? 'text-success' : 'text-ink'}`}>
                  {t.tipo === 'ingreso' ? '+' : '−'}
                  {eurosExactos(t.importe)}
                </span>
                <button onClick={() => eliminar(t.id)} className="text-ink-muted hover:text-danger" aria-label="Eliminar">
                  🗑
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {modal && <ModalMovimiento onClose={() => setModal(false)} onGuardar={anadir} />}
    </div>
  )
}

function ModalMovimiento({ onClose, onGuardar }: { onClose: () => void; onGuardar: (t: Transaccion) => void }) {
  const [tipo, setTipo] = useState<TipoMovimiento>('gasto')
  const [fecha, setFecha] = useState(hoy())
  const [categoria, setCategoria] = useState(CATEGORIAS_GASTO[0])
  const [importe, setImporte] = useState('')
  const [cuenta, setCuenta] = useState('')
  const [nota, setNota] = useState('')

  const categorias = tipo === 'gasto' ? CATEGORIAS_GASTO : CATEGORIAS_INGRESO

  const guardar = () => {
    const n = Number(importe.replace(',', '.'))
    if (!Number.isFinite(n) || n <= 0) return
    onGuardar({
      id: uid(),
      fecha,
      tipo,
      categoria: categoria.trim() || 'Otros',
      importe: Math.abs(n),
      cuenta: cuenta.trim() || undefined,
      nota: nota.trim() || undefined,
    })
    onClose()
  }

  return (
    <Modal titulo="Nuevo movimiento" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            className={tipo === 'gasto' ? boton.eco : boton.suave}
            onClick={() => {
              setTipo('gasto')
              setCategoria(CATEGORIAS_GASTO[0])
            }}
          >
            Gasto
          </button>
          <button
            className={tipo === 'ingreso' ? `${boton.primario} bg-success` : boton.suave}
            onClick={() => {
              setTipo('ingreso')
              setCategoria(CATEGORIAS_INGRESO[0])
            }}
          >
            Ingreso
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Fecha">
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputBase} />
          </Campo>
          <Campo label="Importe (€)">
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={importe}
              onChange={(e) => setImporte(e.target.value)}
              placeholder="0,00"
              className={inputBase}
              autoFocus
            />
          </Campo>
        </div>
        <Campo label="Categoría">
          <input
            list="categorias-eco"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className={inputBase}
          />
          <datalist id="categorias-eco">
            {categorias.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Cuenta (opcional)">
            <input value={cuenta} onChange={(e) => setCuenta(e.target.value)} className={inputBase} placeholder="Banco, tarjeta…" />
          </Campo>
          <Campo label="Nota (opcional)">
            <input value={nota} onChange={(e) => setNota(e.target.value)} className={inputBase} />
          </Campo>
        </div>
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
