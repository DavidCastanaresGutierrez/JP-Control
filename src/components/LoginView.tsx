import { useState } from 'react'
import type { FormEvent } from 'react'
import tdsLogoWhite from '../assets/tds-logo-white.svg'
import { beginSsoLogin } from '../lib/auth'

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <path d="M3 3l18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M10.6 10.7a2 2 0 0 0 2.7 2.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M7.4 7.8C5.4 8.9 4 10.5 3.2 12c1.8 3.4 5 5.5 8.8 5.5 1.6 0 3.1-.4 4.4-1.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20.8 12c-.8-1.5-2.1-2.9-3.8-4-1.5-1-3.2-1.5-5-1.5-.8 0-1.6.1-2.3.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <path
        d="M3.2 12c1.8-3.4 5-5.5 8.8-5.5s7 2.1 8.8 5.5c-1.8 3.4-5 5.5-8.8 5.5S5 15.4 3.2 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

export function LoginView() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
      <form onSubmit={submit} className="w-full max-w-[345px]">
        <img
          src={tdsLogoWhite}
          alt="TYPSA Digital Solutions"
          className="mx-auto mb-7 h-20 w-auto object-contain"
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

        <label className="mt-3 block">
          <span className="mb-2 block text-base font-bold text-white">Contrase&ntilde;a</span>
          <span className="relative block">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-10 w-full rounded-full border border-transparent bg-[#E9F1FF] px-4 pr-12 text-base font-semibold text-black outline-none transition placeholder:text-black/50 focus:border-accent-300 focus:ring-4 focus:ring-accent-300/25"
              placeholder="************"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-black transition hover:text-primary-800"
              aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
            >
              {showPassword ? <EyeIcon /> : <EyeOffIcon />}
            </button>
          </span>
        </label>

        <button
          type="button"
          className="mt-5 block w-full text-center text-sm font-bold text-white transition hover:text-accent-300"
        >
          Has olvidado tu contrase&ntilde;a?
        </button>

        {localError && (
          <div className="mt-4 rounded-full bg-white/90 px-4 py-2 text-center text-sm font-bold text-danger">
            {localError}
          </div>
        )}

        <button
          type="submit"
          className="mt-5 flex h-10 w-full items-center justify-center rounded-full bg-[#9AD8BD] px-4 text-base font-extrabold text-[#102A32] transition hover:bg-[#B4E6D0] focus:outline-none focus:ring-4 focus:ring-white/30"
        >
          Acceso
        </button>
      </form>
    </div>
  )
}
