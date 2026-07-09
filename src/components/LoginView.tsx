import { useState } from 'react'
import type { FormEvent } from 'react'
import microsoftLogo from '../assets/microsoft-logo.svg'
import typsaDigitalLogo from '../assets/typsa-digital.png'
import { beginSsoLogin } from '../lib/auth'

export function LoginView() {
  const [email, setEmail] = useState('')
  const [localError, setLocalError] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const value = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setLocalError('Introduce tu email corporativo.')
      return
    }
    try {
      beginSsoLogin(value)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'No se ha podido iniciar SSO.')
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-7 shadow-hover">
        <div className="mb-6">
          <img
            src={typsaDigitalLogo}
            alt="TYPSA Digital Solutions"
            className="mb-5 h-16 w-auto object-contain"
          />
          <h1 className="font-display text-2xl font-extrabold text-ink">JP Control</h1>
          <p className="mt-1 text-sm text-ink-soft">Acceso con SSO TYPSA.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-bold text-ink">
            <span className="inline-flex items-center gap-2">
              <img src={microsoftLogo} alt="" className="h-4 w-4" aria-hidden="true" />
              Email corporativo
            </span>
            <span className="relative mt-2 block">
              <img
                src={microsoftLogo}
                alt=""
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-11 w-full rounded-lg border border-line bg-surface pl-10 pr-3 text-sm outline-none focus:border-accent-500"
                placeholder="usuario@typsa.com"
                autoComplete="email"
              />
            </span>
          </label>
          {localError && (
            <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">
              {localError}
            </div>
          )}
          <button
            type="submit"
            className="flex h-11 w-full items-center justify-center rounded-lg bg-accent-500 px-4 text-sm font-extrabold text-primary-950 transition-colors hover:bg-accent-400"
          >
            Entrar con SSO
          </button>
        </form>
      </div>
    </div>
  )
}
