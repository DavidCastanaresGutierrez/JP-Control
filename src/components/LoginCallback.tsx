import { useEffect, useState } from 'react'
import type { AuthSession } from '../lib/auth'
import { completeSsoLogin } from '../lib/auth'

export function LoginCallback({ onSuccess }: { onSuccess: (session: AuthSession) => void }) {
  const [error, setError] = useState('')

  useEffect(() => {
    completeSsoLogin(window.location.search).then(onSuccess).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'No se ha podido completar SSO.')
    })
  }, [onSuccess])

  return (
    <div className="flex min-h-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-7 text-center shadow-hover">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-accent-500 font-black text-primary-950">
          JP
        </div>
        <h1 className="font-display text-2xl font-extrabold text-ink">
          {error ? 'No se pudo iniciar sesion' : 'Completando SSO'}
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          {error || 'Estamos validando tu identidad y creando la sesion de la aplicacion.'}
        </p>
        {error && (
          <a
            href="/"
            className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-accent-500 px-4 text-sm font-extrabold text-primary-950"
          >
            Volver al login
          </a>
        )}
      </div>
    </div>
  )
}

