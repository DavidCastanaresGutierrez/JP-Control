import { useState } from 'react'
import type { FormEvent } from 'react'
import typasaLogo from '../assets/typsa-logo.svg'
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
    <div className="flex min-h-full items-center justify-center bg-[#285F68] px-6 py-10 text-white">
      <form onSubmit={submit} className="w-full max-w-[400px]">
        <img
          src={typasaLogo}
          alt="TYPSA Digital Solutions"
          className="mx-auto mb-10 h-40 w-auto object-contain"
        />

        <label className="block">
          <span className="mb-2 block text-base font-bold text-white">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-10 w-full rounded-full border border-transparent bg-[#E9F1FF] px-4 text-base font-semibold text-black outline-none transition placeholder:text-black/50 focus:border-accent-300 focus:ring-4 focus:ring-accent-300/25"
            placeholder="usuario@typsa.com"
            autoComplete="email"
          />
        </label>

        {localError && (
          <div className="mt-4 rounded-full bg-white/90 px-4 py-2 text-center text-sm font-bold text-danger">
            {localError}
          </div>
        )}

        <button
          type="submit"
          className="mt-6 flex h-10 w-full items-center justify-center rounded-full bg-[#9AD8BD] px-4 text-base font-extrabold text-[#102A32] transition hover:bg-[#B4E6D0] focus:outline-none focus:ring-4 focus:ring-white/30"
        >
          Acceso
        </button>
      </form>
    </div>
  )
}
