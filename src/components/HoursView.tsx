import { useEffect, useMemo, useState } from 'react'
import type { RefObject } from 'react'
import type { Project } from '../types'
import { controlDepartamentos, horasJornadaMes, matrizHoras, tareasContrato } from '../lib/metrics'
import { fmtMes } from '../lib/format'
import { CHART_COLORS } from './hours/theme'
import { normalizarTexto } from '../lib/format'
import { ForecastCard } from './hours/ForecastCard'
import { CosteMensualCard } from './hours/CosteMensualCard'
import { ParticipantesCard } from './hours/ParticipantesCard'
import type { Medida, OrdenMes } from './hours/ParticipantesCard'
import { ControlDepartamentosCard } from './hours/ControlDepartamentosCard'
import { TareasContratoCard } from './hours/TareasContratoCard'

export function HoursView({
  project,
  onUpdate,
  onSelectPersons,
  initialDeptFocus,
}: {
  project: Project
  onUpdate: (patch: Partial<Project>) => void
  onSelectPersons?: (personas: string[]) => void
  /** Departamento a preseleccionar al abrir esta pestana (clic desde el Panel), consumido una sola vez. */
  initialDeptFocus?: RefObject<string | null>
}) {
  const matriz = useMemo(() => matrizHoras(project.hours), [project.hours])
  const tareas = useMemo(() => tareasContrato(project.hours), [project.hours])
  const setShare = (dept: string, pct: number | undefined) => {
    const next = { ...(project.deptShare ?? {}) }
    if (pct === undefined || Number.isNaN(pct)) delete next[dept]
    else {
      const resto = Object.entries(next).reduce((s, [d, v]) => (d === dept ? s : s + (v ?? 0)), 0)
      const maxPermitido = Math.max(0, 100 - resto)
      next[dept] = Math.min(maxPermitido, Math.max(0, pct))
    }
    onUpdate({ deptShare: next })
  }

  // Color estable por persona (segun su orden en la tabla, ordenada por total)
  const colorFor = (persona: string) => {
    const idx = matriz.filas.findIndex((f) => f.persona === persona)
    return CHART_COLORS[(idx < 0 ? 0 : idx) % CHART_COLORS.length]
  }

  // Seleccion para la grafica: por defecto, quien tenga anomalias (o el que mas
  // horas acumula si no hay ninguna)
  const [seleccion, setSeleccion] = useState<Set<string>>(() => {
    const conAnomalias = matriz.filas.filter((f) => f.nAnomalias > 0).map((f) => f.persona)
    if (conAnomalias.length) return new Set(conAnomalias)
    return new Set(matriz.filas.slice(0, 1).map((f) => f.persona))
  })
  const [departamentoSeleccionado, setDepartamentoSeleccionado] = useState<string | null>(() => {
    const dept = initialDeptFocus?.current ?? null
    if (initialDeptFocus) initialDeptFocus.current = null
    return dept
  })
  const [tareaSeleccionada, setTareaSeleccionada] = useState<string | null>(null)
  const [personaSeleccionada, setPersonaSeleccionada] = useState<string | null>(null)

  const toggle = (persona: string) => {
    setPersonaSeleccionada((prev) => (prev === persona ? null : persona))
  }

  const seleccionarDepartamento = (dept: string) => {
    setDepartamentoSeleccionado((prev) => (prev === dept ? null : dept))
  }

  const seleccionarTarea = (tarea: string) => {
    setTareaSeleccionada((prev) => (prev === tarea ? null : tarea))
  }
  const hayFiltrosActivos =
    Boolean(departamentoSeleccionado) || Boolean(tareaSeleccionada) || Boolean(personaSeleccionada)

  // Modo de medida de la grafica/tabla de participantes
  const [medida, setMedida] = useState<Medida>('horas')
  const [ordenMes, setOrdenMes] = useState<OrdenMes>(null)
  const [busquedaPersona, setBusquedaPersona] = useState('')

  const todasPersonas = useMemo(() => matriz.filas.map((fila) => fila.persona), [matriz.filas])
  const personasFiltradas = useMemo(() => {
    const filtroDept = departamentoSeleccionado
      ? new Set(
          matriz.filas
            .filter((fila) => (project.personDept?.[fila.persona] ?? '').trim() === departamentoSeleccionado)
            .map((fila) => fila.persona),
        )
      : null
    const filtroTarea = tareaSeleccionada
      ? new Set(tareas.find((t) => t.tarea === tareaSeleccionada)?.personas ?? [])
      : null

    return todasPersonas.filter((persona) => {
      if (personaSeleccionada && persona !== personaSeleccionada) return false
      if (filtroDept && !filtroDept.has(persona)) return false
      if (filtroTarea && !filtroTarea.has(persona)) return false
      return true
    })
  }, [
    departamentoSeleccionado,
    matriz.filas,
    personaSeleccionada,
    project.personDept,
    tareaSeleccionada,
    tareas,
    todasPersonas,
  ])

  const horasParticipantesFiltradas = useMemo(() => {
    if (!hayFiltrosActivos) return project.hours
    const personasPermitidas = new Set(personasFiltradas)
    return project.hours.filter((h) => {
      if (!personasPermitidas.has(h.persona)) return false
      if (tareaSeleccionada && h.tarea?.trim() !== tareaSeleccionada) return false
      return true
    })
  }, [hayFiltrosActivos, personasFiltradas, project.hours, tareaSeleccionada])
  const matrizParticipantes = useMemo(
    () => (hayFiltrosActivos ? matrizHoras(horasParticipantesFiltradas) : matriz),
    [hayFiltrosActivos, horasParticipantesFiltradas, matriz],
  )

  // Horas de jornada completa por mes (para el % de ocupacion)
  const jornadaMes = useMemo(
    () => matrizParticipantes.meses.map((m) => horasJornadaMes(m)),
    [matrizParticipantes.meses],
  )
  // % de ocupacion de una celda = horas / jornada completa del mes
  const ocupacion = useMemo(
    () => (horas: number | null, i: number) =>
      horas && jornadaMes[i] > 0 ? (horas / jornadaMes[i]) * 100 : 0,
    [jornadaMes],
  )

  const control = useMemo(
    () =>
      controlDepartamentos(
        project,
        hayFiltrosActivos
          ? {
              personas: personasFiltradas,
              tarea: tareaSeleccionada,
              incluirExternos: !tareaSeleccionada,
            }
          : {},
      ),
    [hayFiltrosActivos, personasFiltradas, project, tareaSeleccionada],
  )

  useEffect(() => {
    const next = hayFiltrosActivos ? personasFiltradas : todasPersonas
    setSeleccion((prev) => {
      if (hayFiltrosActivos) return new Set(next)
      if (prev.size === 0) return new Set(next)
      const inter = next.filter((persona) => prev.has(persona))
      return new Set(inter.length > 0 || hayFiltrosActivos ? inter : next)
    })
    onSelectPersons?.(personasFiltradas)
  }, [hayFiltrosActivos, onSelectPersons, personasFiltradas, todasPersonas])

  const chartData = useMemo(() => {
    const activos = matrizParticipantes.filas.filter((f) => seleccion.has(f.persona))
    return matrizParticipantes.meses.map((mes, i) => {
      const point: Record<string, number | string> = { mes: fmtMes(mes) }
      activos.forEach((f) => {
        const h = f.celdas[i].horas ?? 0
        const coste = f.celdas[i].coste ?? 0
        point[f.persona] =
          medida === 'ocupacion'
            ? Math.round(ocupacion(h, i) * 10) / 10
            : medida === 'coste'
              ? Math.round(coste * 100) / 100
              : h
      })
      return point
    })
  }, [matrizParticipantes, seleccion, medida, ocupacion])

  const personasSel = matrizParticipantes.filas.filter((f) => seleccion.has(f.persona))
  const tareasVisibles = useMemo(() => {
    if (!departamentoSeleccionado && !tareaSeleccionada && !personaSeleccionada) return tareas

    const personasPermitidas =
      departamentoSeleccionado || personaSeleccionada ? new Set(personasFiltradas) : null
    return tareasContrato(
      project.hours.filter((h) => {
        if (personasPermitidas && !personasPermitidas.has(h.persona)) return false
        if (tareaSeleccionada && h.tarea?.trim() !== tareaSeleccionada) return false
        return true
      }),
    )
  }, [
    departamentoSeleccionado,
    personaSeleccionada,
    personasFiltradas,
    project.hours,
    tareaSeleccionada,
    tareas,
  ])
  const hayTareas = tareas.length > 0
  const nAnomalias = matrizParticipantes.filas.reduce((s, f) => s + f.nAnomalias, 0)
  const deptSeleccionadosTexto = departamentoSeleccionado ?? ''
  const estaFiltrado = hayFiltrosActivos || personasFiltradas.length < matriz.filas.length
  const filasControlVisibles = useMemo(() => {
    if (departamentoSeleccionado) return control.filas.filter((fila) => fila.dept === departamentoSeleccionado)
    if (!tareaSeleccionada && !personaSeleccionada) return control.filas
    const deptasVisibles = new Set<string>()
    const personasVisiblesSet = new Set(personasFiltradas)
    for (const fila of control.filas) {
      if (fila.personas.some((persona) => personasVisiblesSet.has(persona))) deptasVisibles.add(fila.dept)
    }
    return control.filas.filter((fila) => deptasVisibles.has(fila.dept))
  }, [control.filas, departamentoSeleccionado, personaSeleccionada, personasFiltradas, tareaSeleccionada])
  const totalControlVisible = useMemo(() => {
    const asignado = filasControlVisibles.reduce((s, fila) => s + (fila.asignado ?? 0), 0)
    const share = filasControlVisibles.reduce((s, fila) => s + (fila.share ?? 0), 0)
    const coste = filasControlVisibles.reduce((s, fila) => s + fila.coste, 0)
    const horas = filasControlVisibles.reduce((s, fila) => s + fila.horas, 0)
    return {
      asignado,
      share,
      coste: Math.round(coste * 100) / 100,
      horas: Math.round(horas * 100) / 100,
    }
  }, [filasControlVisibles])

  // Personas con horas imputadas pero coste 0 EUR en el fichero de Concost:
  // suele significar que no tienen tarifa/grupo asignado en el ERP.
  const hayCostePersonas = matrizParticipantes.filas.some((f) => f.totalCoste > 0)
  const sinTarifa = hayCostePersonas
    ? matrizParticipantes.filas.filter((f) => f.total > 0 && f.totalCoste === 0)
    : []
  const filasOrdenadas = useMemo(() => {
    const base = [...matrizParticipantes.filas]
    if (ordenMes) {
      const mesIndex = matrizParticipantes.meses.indexOf(ordenMes.mes)
      if (mesIndex >= 0) {
        const valorMes = (fila: (typeof matrizParticipantes.filas)[number]) => {
          const celda = fila.celdas[mesIndex]
          const horas = celda?.horas ?? 0
          if (medida === 'coste') return celda?.coste ?? 0
          return medida === 'ocupacion' ? ocupacion(horas, mesIndex) : horas
        }

        base.sort((a, b) => {
          const diff = ordenMes.dir === 'desc' ? valorMes(b) - valorMes(a) : valorMes(a) - valorMes(b)
          if (diff !== 0) return diff
          const totalDiff =
            medida === 'coste' ? b.totalCoste - a.totalCoste : b.total - a.total
          return totalDiff || a.persona.localeCompare(b.persona)
        })
      }
    }

    const seleccionados = base.filter((f) => seleccion.has(f.persona))
    const resto = base.filter((f) => !seleccion.has(f.persona))
    return [...seleccionados, ...resto]
  }, [matrizParticipantes.filas, matrizParticipantes.meses, ordenMes, medida, ocupacion, seleccion])

  const personasVisibles = useMemo(() => {
    const visibles = new Set(personasFiltradas)
    if (!hayFiltrosActivos) return filasOrdenadas
    return filasOrdenadas.filter((f) => visibles.has(f.persona))
  }, [filasOrdenadas, hayFiltrosActivos, personasFiltradas])

  const personasBuscadas = useMemo(() => {
    const q = normalizarTexto(busquedaPersona)
    if (!q) return personasVisibles
    return personasVisibles.filter((f) => normalizarTexto(f.persona).includes(q))
  }, [personasVisibles, busquedaPersona])

  return (
    <div className="space-y-6">
      <ForecastCard entries={project.entries} presupuesto={project.budget ?? project.contractValue} />

      <CosteMensualCard entries={project.entries} />

      <ParticipantesCard
        hayHoras={project.hours.length > 0}
        nAnomalias={nAnomalias}
        matrizParticipantes={matrizParticipantes}
        personasSel={personasSel}
        personasBuscadas={personasBuscadas}
        chartData={chartData}
        medida={medida}
        onMedida={setMedida}
        busquedaPersona={busquedaPersona}
        onBusquedaPersona={setBusquedaPersona}
        ordenMes={ordenMes}
        onOrdenMes={setOrdenMes}
        seleccion={seleccion}
        onTogglePersona={toggle}
        onLimpiar={() => {
          setDepartamentoSeleccionado(null)
          setTareaSeleccionada(null)
          setPersonaSeleccionada(null)
          const all = matriz.filas.map((f) => f.persona)
          setSeleccion(new Set(all))
          onSelectPersons?.(all)
        }}
        colorFor={colorFor}
        ocupacion={ocupacion}
        jornadaMes={jornadaMes}
        sinTarifa={sinTarifa}
      />

      <div className="grid xl:grid-cols-2 gap-5">
        <ControlDepartamentosCard
          control={control}
          filasControlVisibles={filasControlVisibles}
          totalControlVisible={totalControlVisible}
          departamentoSeleccionado={departamentoSeleccionado}
          onSeleccionarDepartamento={seleccionarDepartamento}
          onSetShare={setShare}
          estaFiltrado={estaFiltrado}
          nPersonasVisibles={personasVisibles.length}
          deptSeleccionadosTexto={deptSeleccionadosTexto}
          personaSeleccionada={personaSeleccionada}
          tareaSeleccionada={tareaSeleccionada}
        />
        <TareasContratoCard
          hayTareas={hayTareas}
          nTareasTotal={tareas.length}
          tareasVisibles={tareasVisibles}
          tareaSeleccionada={tareaSeleccionada}
          onSeleccionarTarea={seleccionarTarea}
        />
      </div>
    </div>
  )
}
