export function ConcostHelp({ compact = false, dark = false }: { compact?: boolean; dark?: boolean }) {
  const base = dark
    ? 'border-white/10 bg-white/6 text-white/72'
    : 'border-line bg-surface text-ink-soft shadow-soft'
  const title = dark ? 'text-white' : 'text-ink'
  const item = dark ? 'border-white/10 bg-primary-900/60' : 'border-line bg-surface-muted'
  const strong = dark ? 'text-accent-300' : 'text-primary-900'

  return (
    <section className={`rounded-lg border ${base} ${compact ? 'p-3' : 'p-5'}`}>
      <div className={`font-extrabold ${title} ${compact ? 'text-sm' : 'text-base'}`}>
        Ficheros necesarios de Concost
      </div>
      <div className={`mt-3 grid gap-3 ${compact ? 'text-xs' : 'md:grid-cols-3 text-sm'}`}>
        <div className={`rounded-lg border ${item} ${compact ? 'p-3' : 'p-4'}`}>
          <div className={`font-bold ${strong}`}>1. Explotacion</div>
          <p className="mt-1 leading-relaxed">
            En Concost abre la pestana <b>Explotacion</b>, marca <b>Detalle por contrato</b> y
            exporta el Excel. Sirve para crear el proyecto o actualizar facturacion, gasto y
            movimientos.
          </p>
          <div className="mt-2 font-semibold">Archivo esperado: explotacion-detalle-*.xlsx</div>
        </div>
        <div className={`rounded-lg border ${item} ${compact ? 'p-3' : 'p-4'}`}>
          <div className={`font-bold ${strong}`}>2. Horas por empleado</div>
          <p className="mt-1 leading-relaxed">
            En Concost abre la pestana <b>Horas</b>, selecciona <b>Por Empleados</b> y marca
            <b> Detalle</b>. Sirve para actualizar horas, participantes, departamentos y ocupacion.
          </p>
          <div className="mt-2 font-semibold">Archivo esperado: horas-empleado-detalle-*.xlsx</div>
        </div>
        <div className={`rounded-lg border ${item} ${compact ? 'p-3' : 'p-4'}`}>
          <div className={`font-bold ${strong}`}>3. Horas por tareas</div>
          <p className="mt-1 leading-relaxed">
            Si exportas las horas por <b>Tareas</b>, tambien nos vale: leeremos la columna{' '}
            <b>Tarea del contrato</b> para agrupar coste, horas y personas por tarea.
          </p>
          <div className="mt-2 font-semibold">Compatible con exportacion por tareas</div>
        </div>
      </div>
    </section>
  )
}
