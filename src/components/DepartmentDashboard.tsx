import { useMemo, useState } from 'react'
import type { DepartmentModule } from '../types'
import { DEPARTAMENTOS_REALES } from '../types'
import {
  mesesDisponibles,
  mesVencido,
  todasLasPersonas,
  ultimoMesConDatos,
} from '../lib/departmentMetrics'
import { fmtFecha } from '../lib/format'
import { PanelTab } from './department/PanelTab'
import { OcupacionTab } from './department/OcupacionTab'
import type { MedidaComparativa } from './department/OcupacionTab'
import { EvolucionTab } from './department/EvolucionTab'
import { PersonaTab } from './department/PersonaTab'
import { DedicacionTab } from './department/DedicacionTab'
import { DepartmentConfig } from './department/DepartmentConfig'

type Tab = 'panel' | 'ocupacion' | 'evolucion' | 'persona' | 'dedicacion' | 'configuracion'

export function DepartmentDashboard({
  departamento,
  modulo,
  puedeVerTodosDepartamentos,
  onChooseDepartamento,
  onImportFile,
  onUpdateRoster,
  onSetObjetivo,
  onSetMesInicio,
  onDeleteData,
}: {
  departamento: string | null
  modulo: DepartmentModule | undefined
  /** Si puede volver a elegir cualquier otro departamento (hoy, cualquiera con acceso al módulo). */
  puedeVerTodosDepartamentos: boolean
  onChooseDepartamento: (nombre: string | null) => void
  onImportFile: (file: File) => void
  onUpdateRoster: (roster: DepartmentModule['roster']) => void
  onSetObjetivo: (pct: number | undefined) => void
  onSetMesInicio: (mes: string | undefined) => void
  onDeleteData: () => void
}) {
  // Todo el estado de las pestañas vive aquí para que la selección de cada una
  // (mes, personas comparadas, filtros, búsquedas) persista al cambiar de pestaña.
  const [tab, setTab] = useState<Tab>('panel')
  const [mesSel, setMesSel] = useState<string | null>(null)
  const [personaSel, setPersonaSel] = useState<string | null>(null)
  const [personasComparativa, setPersonasComparativa] = useState<Set<string> | null>(null)
  const [medidaComparativa, setMedidaComparativa] = useState<MedidaComparativa>('ocupacion')
  const [buscadorDedicacion, setBuscadorDedicacion] = useState('')
  const [buscadorPersona, setBuscadorPersona] = useState('')
  const [filtroEstadoOcupacion, setFiltroEstadoOcupacion] = useState<'baja' | 'sobre' | null>(null)
  const [personaDetalleDedicacion, setPersonaDetalleDedicacion] = useState<string | null>(null)
  const [proyectoFiltroDedicacion, setProyectoFiltroDedicacion] = useState<string | null>(null)
  const [modoHistorico, setModoHistorico] = useState<'curso' | 'vencido'>('curso')

  const meses = useMemo(() => (modulo ? mesesDisponibles(modulo) : []), [modulo])
  const mesActual = mesSel ?? (modulo ? ultimoMesConDatos(modulo) : null)
  const mesVencidoCalc = useMemo(() => mesVencido(meses), [meses])
  const enMesEnCurso = mesSel === null
  const enMesVencido = mesSel !== null && mesSel === mesVencidoCalc
  const irAMesEnCurso = () => setMesSel(null)
  const irAMesVencido = () => mesVencidoCalc && setMesSel(mesVencidoCalc)
  const hastaMesHistorico = modoHistorico === 'vencido' ? (mesVencidoCalc ?? undefined) : undefined

  if (!departamento) {
    if (!puedeVerTodosDepartamentos) {
      return (
        <div className="p-4 sm:p-6 max-w-xl">
          <h1 className="font-display text-[26px] font-extrabold text-ink tracking-tight sm:text-[30px]">
            Control por Departamento
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Todavía no tienes un departamento asignado. Pide a un administrador que te lo asigne en la
            pestaña Administración.
          </p>
        </div>
      )
    }
    return (
      <div className="p-4 sm:p-6 max-w-xl">
        <h1 className="font-display text-[26px] font-extrabold text-ink tracking-tight sm:text-[30px]">
          Control por Departamento
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Elige el departamento que diriges para ver su ocupación, dedicación y carga de trabajo.
        </p>
        <div className="mt-6 space-y-2">
          {DEPARTAMENTOS_REALES.map((d) => (
            <button
              key={d}
              onClick={() => onChooseDepartamento(d)}
              className="flex h-12 w-full items-center rounded-lg border border-line bg-surface px-4 text-left text-sm font-semibold text-ink shadow-soft transition-colors hover:border-accent-300 hover:bg-accent-300/10"
            >
              {d}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const personas = todasLasPersonas(modulo ?? { departamento, roster: {}, horas: [] })
  const todasPersonasImportadas = modulo
    ? [...new Set(modulo.horas.map((h) => h.persona))].sort((a, b) => a.localeCompare(b, 'es'))
    : []

  const sinDatos = !modulo || modulo.horas.length === 0

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'panel', label: 'Panel' },
    { id: 'ocupacion', label: 'Ocupación' },
    { id: 'evolucion', label: 'Evolución' },
    { id: 'persona', label: 'Por persona' },
    { id: 'dedicacion', label: 'Dedicación' },
    { id: 'configuracion', label: 'Configuración' },
  ]

  const selectorMesProps = {
    meses,
    mesActual,
    enMesEnCurso,
    enMesVencido,
    onMesEnCurso: irAMesEnCurso,
    onMesVencido: irAMesVencido,
    onMes: (mes: string) => setMesSel(mes),
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {puedeVerTodosDepartamentos && (
            <button
              type="button"
              onClick={() => onChooseDepartamento(null)}
              className="mb-1 text-xs font-semibold text-ink-soft hover:text-ink hover:underline"
            >
              ← Cambiar departamento
            </button>
          )}
          <h1 className="font-display text-[22px] sm:text-[28px] font-extrabold text-ink tracking-tight truncate">
            {departamento}
          </h1>
          <div className="text-sm text-ink-soft mt-0.5">
            {personas.length} personas en el equipo
            {modulo?.lastImport && <> · datos importados {fmtFecha(modulo.lastImport.slice(0, 10))}</>}
          </div>
        </div>
        <div className="-mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0">
          <div className="flex w-max rounded-full border border-line bg-surface p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 h-9 text-sm font-semibold rounded-full transition-colors whitespace-nowrap ${
                  tab === t.id ? 'bg-accent-500 text-primary-950' : 'text-ink-soft hover:bg-surface-muted'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {sinDatos && tab !== 'configuracion' && (
        <div className="rounded-[20px] border border-dashed border-line-strong bg-surface p-6 text-sm text-ink-soft">
          Todavía no has importado datos de horas. Ve a la pestaña{' '}
          <button className="font-semibold text-primary-800 underline" onClick={() => setTab('configuracion')}>
            Configuración
          </button>{' '}
          para subir el Excel de producción completa y elegir el equipo.
        </div>
      )}

      {tab === 'panel' && !sinDatos && (
        <PanelTab
          modulo={modulo}
          {...selectorMesProps}
          onVerAlertaOcupacion={(estado) => {
            setFiltroEstadoOcupacion(estado)
            setTab('ocupacion')
          }}
        />
      )}

      {tab === 'ocupacion' && !sinDatos && (
        <OcupacionTab
          modulo={modulo}
          {...selectorMesProps}
          hastaMesHistorico={hastaMesHistorico}
          modoHistorico={modoHistorico}
          onModoHistorico={setModoHistorico}
          medidaComparativa={medidaComparativa}
          onMedidaComparativa={setMedidaComparativa}
          personasComparativa={personasComparativa}
          onPersonasComparativa={setPersonasComparativa}
          filtroEstadoOcupacion={filtroEstadoOcupacion}
          onFiltroEstadoOcupacion={setFiltroEstadoOcupacion}
          onIrAConfiguracion={() => setTab('configuracion')}
        />
      )}

      {tab === 'evolucion' && !sinDatos && (
        <EvolucionTab
          modulo={modulo}
          hastaMesHistorico={hastaMesHistorico}
          modoHistorico={modoHistorico}
          onModoHistorico={setModoHistorico}
        />
      )}

      {tab === 'dedicacion' && !sinDatos && (
        <DedicacionTab
          modulo={modulo}
          buscadorDedicacion={buscadorDedicacion}
          onBuscadorDedicacion={setBuscadorDedicacion}
          personaDetalleDedicacion={personaDetalleDedicacion}
          onPersonaDetalleDedicacion={setPersonaDetalleDedicacion}
          proyectoFiltroDedicacion={proyectoFiltroDedicacion}
          onProyectoFiltroDedicacion={setProyectoFiltroDedicacion}
        />
      )}

      {tab === 'persona' && !sinDatos && (
        <PersonaTab
          modulo={modulo}
          hastaMesHistorico={hastaMesHistorico}
          modoHistorico={modoHistorico}
          onModoHistorico={setModoHistorico}
          buscadorPersona={buscadorPersona}
          onBuscadorPersona={setBuscadorPersona}
          personaSel={personaSel}
          onPersonaSel={setPersonaSel}
        />
      )}

      {tab === 'configuracion' && (
        <DepartmentConfig
          departamento={departamento}
          modulo={modulo}
          todasPersonasImportadas={todasPersonasImportadas}
          onImportFile={onImportFile}
          onUpdateRoster={onUpdateRoster}
          onSetObjetivo={onSetObjetivo}
          onSetMesInicio={onSetMesInicio}
          onDeleteData={onDeleteData}
        />
      )}
    </div>
  )
}
