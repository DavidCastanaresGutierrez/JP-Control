import { useState } from 'react'
import type { FormEvent } from 'react'
import microsoftLogo from '../assets/microsoft-logo.svg'
import tdsLogoWhite from '../assets/tds-logo-white.svg'
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
    <div className="flex min-h-full items-center justify-center bg-[#255B63] px-6 py-10 text-white">
      <div className="w-full max-w-[360px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src={tdsLogoWhite} alt="TYPSA Digital Solutions" className="mb-7 h-16 w-auto" />
          <div className="flex items-center justify-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-black text-[#255B63]">
              JP
            </div>
            <h1 className="font-display text-3xl font-extrabold tracking-normal text-white">
              JP Control
            </h1>
          </div>
          <p className="mt-2 text-sm font-medium text-white/78">Acceso con SSO TYPSA</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-bold text-white">
            <span className="inline-flex items-center gap-2">
              <img src={microsoftLogo} alt="" className="h-4 w-4" aria-hidden="true" />
              Email corporativo
            </span>
            <span className="relative mt-2 block">
              <img
                src={microsoftLogo}
                alt=""
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-11 w-full rounded-full border border-white/40 bg-white pl-11 pr-4 text-sm font-semibold text-ink shadow-soft outline-none transition focus:border-accent-300 focus:ring-4 focus:ring-accent-300/30"
                placeholder="usuario@typsa.com"
                autoComplete="email"
              />
            </span>
          </label>
          {localError && (
            <div className="rounded-full bg-white/92 px-4 py-2 text-sm font-bold text-danger">
              {localError}
            </div>
          )}
          <button
            type="submit"
            className="mt-6 flex h-11 w-full items-center justify-center rounded-full bg-[#9AD8BD] px-4 text-sm font-extrabold text-[#143A45] transition-colors hover:bg-[#B4E6D0] focus:outline-none focus:ring-4 focus:ring-white/30"
          >
            Entrar con SSO
          </button>
        </form>
      </div>
    </div>
  )
}
