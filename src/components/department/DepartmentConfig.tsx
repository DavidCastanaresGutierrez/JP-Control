import { useMemo, useState } from 'react'
import type { DepartmentModule } from '../../types'
import { posiblesBajas } from '../../lib/departmentMetrics'
import { fmtMes } from '../../lib/format'
import { UploadZone } from '../UploadZone'

export function DepartmentConfig({
  departamento,
  modulo,
  todasPersonasImportadas,
  onImportFile,
  onUpdateRoster,
  onSetObjetivo,
  onSetMesInicio,
  onDeleteData,
}: {
  departamento: string
  modulo: DepartmentModule | undefined
  todasPersonasImportadas: string[]
  onImportFile: (file: File) => void
  onUpdateRoster: (roster: DepartmentModule['roster']) => void
  onSetObjetivo: (pct: number | undefined) => void
  onSetMesInicio: (mes: string | undefined) => void
  onDeleteData: () => void
}) {
  const roster = modulo?.roster ?? {}
  const seleccionadas = new Set(Object.keys(roster).filter((p) => roster[p].activo))
  const avisosBaja = useMemo(() => (modulo ? posiblesBajas(modulo) : []), [modulo])
  const [confirmEliminar, setConfirmEliminar] = useState(false)

  const toggle = (persona: string) => {
    const next = { ...roster }
    if (next[persona]?.activo) delete next[persona]
    else next[persona] = { activo: true, jornadaPct: next[persona]?.jornadaPct ?? 100 }
    onUpdateRoster(next)
  }

  const setFechaBaja = (persona: string, fechaBaja: string | undefined) => {
    const next = { ...roster, [persona]: { ...roster[persona], fechaBaja } }
    onUpdateRoster(next)
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="bg-surface rounded-[24px] shadow-soft border border-line p-4 sm:p-6">
        <h3 className="font-bold text-ink text-lg mb-1">Importar producción completa</h3>
        <p className="text-xs text-ink-soft mb-3">
          Sube el "Detalle de horas por empleado" de toda la producción (todas las personas, todos los
          proyectos) exportado de Concost. Cada nueva importación sustituye a la anterior.
        </p>
        <UploadZone
          label="Subir Excel de produccion completa"
          hint="produccionhorasempleadodetalle*.xlsx"
          onFiles={(files) => files[0] && onImportFile(files[0])}
        />
      </div>

      <div className="bg-surface rounded-[24px] shadow-soft border border-line p-4 sm:p-6">
        <h3 className="font-bold text-ink text-lg mb-1">Equipo del departamento</h3>
        <p className="text-xs text-ink-soft mb-3">
          Marca qué personas (de las que aparecen en el Excel importado) forman parte de tu equipo. Si
          alguien se ha ido de la empresa, ponle la fecha de baja para que deje de contar en Ocupación y
          en las alertas sin perder su histórico.
        </p>
        {avisosBaja.length > 0 && (
          <div className="mb-3 rounded-[14px] border border-warning/40 bg-warning/10 px-4 py-3 text-xs text-[#8A5A00]">
            <p className="font-bold mb-2">
              {avisosBaja.length === 1
                ? '1 persona sin actividad reciente'
                : `${avisosBaja.length} personas sin actividad reciente`}
            </p>
            <p className="mb-2">
              Puede que se hayan ido de la empresa. Se estima la fecha de baja a partir de su último
              mes con actividad real; confírmala si es correcta o corrígela abajo en su fila.
            </p>
            <div className="space-y-1.5">
              {avisosBaja.map((a) => (
                <div key={a.persona} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-semibold">{a.persona}</span>
                    {a.ultimoMesConActividad ? (
                      <> · última actividad real: {fmtMes(a.ultimoMesConActividad)}</>
                    ) : (
                      <> · sin actividad real registrada</>
                    )}
                    {' · baja sugerida: '}
                    <span className="font-semibold">{fmtMes(a.fechaBajaSugerida)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setFechaBaja(a.persona, a.fechaBajaSugerida)}
                    className="shrink-0 rounded-full bg-warning/25 px-2.5 py-1 font-bold text-[#8A5A00] hover:bg-warning/35 transition-colors"
                  >
                    Confirmar baja
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        {todasPersonasImportadas.length === 0 ? (
          <p className="text-sm text-ink-soft">Importa antes el Excel de producción completa.</p>
        ) : (
          <div className="flex flex-col divide-y divide-line/60 max-h-[28rem] overflow-y-auto pr-1">
            {todasPersonasImportadas.map((persona) => (
              <div key={persona} className="flex items-center gap-2 py-1.5">
                <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={seleccionadas.has(persona)}
                    onChange={() => toggle(persona)}
                    className="h-4 w-4 shrink-0 rounded border-line accent-accent-500"
                  />
                  <span className="truncate">{persona}</span>
                </label>
                {seleccionadas.has(persona) && (
                  <div className="flex shrink-0 items-center gap-1">
                    <input
                      type="month"
                      value={roster[persona]?.fechaBaja ?? ''}
                      onChange={(e) => setFechaBaja(persona, e.target.value || undefined)}
                      title="Fecha de baja (opcional): a partir de este mes deja de contar en Ocupación y alertas"
                      className="w-[8.5rem] rounded-md border border-line px-1.5 py-0.5 text-xs text-ink-soft outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/40"
                    />
                    {roster[persona]?.fechaBaja && (
                      <button
                        type="button"
                        onClick={() => setFechaBaja(persona, undefined)}
                        className="text-[11px] font-semibold text-ink-soft underline hover:text-ink"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 text-xs text-ink-muted">{seleccionadas.size} personas seleccionadas</div>
      </div>

      <div className="bg-surface rounded-[24px] shadow-soft border border-line p-4 sm:p-6">
        <h3 className="font-bold text-ink text-lg mb-1">Objetivo de facturabilidad</h3>
        <p className="text-xs text-ink-soft mb-3">
          % de horas facturables que se espera de cada persona. Se usa para comparar el real de cada
          uno en la pestaña Ocupación.
        </p>
        <label className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={100}
            step="any"
            value={modulo?.objetivoFacturablePct ?? ''}
            onChange={(e) =>
              onSetObjetivo(e.target.value === '' ? undefined : Number(e.target.value))
            }
            className="w-24 border border-line rounded-[10px] px-3 py-2 text-sm text-ink focus:ring-2 focus:ring-accent-500/40 focus:border-accent-500 outline-none"
          />
          <span className="text-sm text-ink-soft">%</span>
        </label>
      </div>

      <div className="bg-surface rounded-[24px] shadow-soft border border-line p-4 sm:p-6">
        <h3 className="font-bold text-ink text-lg mb-1">Mes de inicio del análisis</h3>
        <p className="text-xs text-ink-soft mb-3">
          Descarta el histórico de horas anterior a este mes en todos los cálculos y gráficos (útil
          tras una reestructuración de equipo, por ejemplo). Déjalo en blanco para usar todo el
          histórico importado.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={modulo?.mesInicio ?? ''}
            onChange={(e) => onSetMesInicio(e.target.value || undefined)}
            className="border border-line rounded-[10px] px-3 py-2 text-sm text-ink focus:ring-2 focus:ring-accent-500/40 focus:border-accent-500 outline-none"
          />
          {modulo?.mesInicio && (
            <button
              type="button"
              onClick={() => onSetMesInicio(undefined)}
              className="text-xs font-semibold text-ink-soft underline hover:text-ink"
            >
              Quitar
            </button>
          )}
        </div>
      </div>

      {modulo && (modulo.horas.length > 0 || Object.keys(modulo.roster).length > 0) && (
        <>
          {confirmEliminar ? (
            <div className="bg-danger/8 border border-danger/25 rounded-[20px] p-4">
              <p className="text-sm text-danger font-semibold">
                Seguro que quieres eliminar los datos de "{departamento}"?
              </p>
              <p className="text-xs text-danger/75 mt-0.5 mb-3">
                Se borraran las horas importadas, el equipo y la configuración de este departamento
                (también en la nube, si está sincronizado). No se puede deshacer.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onDeleteData()
                    setConfirmEliminar(false)
                  }}
                  className="text-sm font-bold bg-danger text-white rounded-full px-4 h-10 hover:opacity-90 transition-opacity"
                >
                  Si, eliminar
                </button>
                <button
                  onClick={() => setConfirmEliminar(false)}
                  className="text-sm font-semibold border border-line bg-surface text-ink-soft rounded-full px-4 h-10 hover:bg-surface-muted transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-[20px] border border-line bg-surface p-4 shadow-soft sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-ink">Eliminar datos del departamento</h3>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    Borra las horas importadas, el equipo y la configuración de este departamento. No
                    se puede deshacer.
                  </p>
                </div>
                <button
                  onClick={() => setConfirmEliminar(true)}
                  className="inline-flex h-10 items-center justify-center rounded-full bg-danger px-4 text-sm font-bold text-white transition-opacity hover:opacity-90"
                >
                  Eliminar datos
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
