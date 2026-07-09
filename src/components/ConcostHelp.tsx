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
      <div className={`mt-3 grid gap-3 ${compact ? 'text-xs' : 'md:grid-cols-2 text-sm'}`}>
        <div className={`rounded-lg border ${item} ${compact ? 'p-3' : 'p-4'}`}>
          <div className={`font-bold ${strong}`}>1. Explotación</div>
          <p className="mt-1 leading-relaxed">
            En Concost abre la pestaña <b>Explotación</b>, marca <b>Detalle por contrato</b> y
            exporta el Excel. Sirve para crear el proyecto o actualizar facturación, gasto y
            movimientos.
          </p>
          <div className="mt-2 font-semibold">Archivo esperado: explotacion-detalle-*.xlsx</div>
        </div>
        <div className={`rounded-lg border ${item} ${compact ? 'p-3' : 'p-4'}`}>
          <div className={`font-bold ${strong}`}>2. Horas</div>
          <p className="mt-1 leading-relaxed">
            En Concost abre la pestaña <b>Horas</b>, selecciona <b>Por Empleados</b> y marca
            <b> Detalle</b>. Sirve para actualizar horas, participantes, departamentos y ocupación.
          </p>
          <div className="mt-2 font-semibold">Archivo esperado: horas-empleado-detalle-*.xlsx</div>
        </div>
      </div>
    </section>
  )
}
