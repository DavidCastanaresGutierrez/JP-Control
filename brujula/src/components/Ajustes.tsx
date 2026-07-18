import { useRef, useState } from 'react'
import { useStore } from '../lib/store.ts'
import { normalizarDb } from '../types.ts'
import { guardarToken, leerToken } from '../lib/api.ts'
import { hoy } from '../lib/date.ts'
import { boton, Campo, Card, inputBase, SectionTitle } from './common/ui.tsx'

export function Ajustes() {
  const { db, reemplazar, estadoNube, sincronizarAhora } = useStore()
  const [token, setToken] = useState(leerToken())
  const [guardado, setGuardado] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const totalRegistros =
    db.transacciones.length +
    db.patrimonio.length +
    db.medidas.length +
    db.comidas.length +
    db.entrenos.length +
    db.habitos.length +
    db.registrosHabito.length

  const guardarNube = () => {
    guardarToken(token.trim())
    setGuardado(true)
    setTimeout(() => setGuardado(false), 2000)
    if (token.trim()) sincronizarAhora()
  }

  const exportar = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `brujula-${hoy()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importar = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result))
        if (!confirm('Esto reemplazará todos los datos actuales por los del fichero. ¿Continuar?')) return
        reemplazar(normalizarDb(parsed))
        alert('Copia restaurada correctamente.')
      } catch {
        alert('El fichero no es una copia válida de Brújula.')
      }
    }
    reader.readAsText(file)
  }

  const borrarTodo = () => {
    if (!confirm('Se borrarán TODOS los datos de este dispositivo. ¿Seguro?')) return
    reemplazar(normalizarDb(null))
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <span>⚙️</span> Ajustes
        </h1>
        <p className="text-sm text-ink-soft">Sincronización, copias de seguridad y datos.</p>
      </header>

      <Card className="p-4">
        <SectionTitle>Sincronización en la nube</SectionTitle>
        <p className="mb-3 text-sm text-ink-soft">
          Introduce el código de acceso (<code>APP_TOKEN</code>) que configuraste en Vercel para que tus datos te sigan
          entre dispositivos. Déjalo vacío para trabajar solo en local.
        </p>
        <Campo label="Código de acceso">
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className={inputBase}
            placeholder="tu código de acceso"
          />
        </Campo>
        <div className="mt-3 flex items-center gap-3">
          <button className={boton.primario} onClick={guardarNube}>
            Guardar
          </button>
          {guardado && <span className="text-sm text-success">Guardado ✓</span>}
          <span className="ml-auto text-xs text-ink-muted">Estado: {estadoNube}</span>
        </div>
      </Card>

      <Card className="p-4">
        <SectionTitle>Copia de seguridad</SectionTitle>
        <p className="mb-3 text-sm text-ink-soft">
          {totalRegistros} registros guardados. Exporta un JSON para cambiar de equipo o guardarlo aparte.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className={boton.suave} onClick={exportar}>
            ⬇ Exportar datos (JSON)
          </button>
          <button className={boton.suave} onClick={() => fileRef.current?.click()}>
            ⬆ Restaurar copia
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) importar(f)
              e.target.value = ''
            }}
          />
        </div>
      </Card>

      <Card className="p-4">
        <SectionTitle>Zona de peligro</SectionTitle>
        <p className="mb-3 text-sm text-ink-soft">Borra todos los datos de este dispositivo. No se puede deshacer.</p>
        <button className={boton.peligro} onClick={borrarTodo}>
          Borrar todos los datos
        </button>
      </Card>

      <p className="text-center text-xs text-ink-muted">Brújula · local-first · nube opcional</p>
    </div>
  )
}
