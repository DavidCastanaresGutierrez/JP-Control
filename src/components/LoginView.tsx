import { useState } from 'react'
import type { FormEvent } from 'react'
import tdsLogoWhite from '../assets/tds-logo-white.svg'
import { beginSsoLogin } from '../lib/auth'

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7">
      <path
        d="M4.5 6.5h15v11h-15v-11Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="m5.2 7.2 6.8 5.4 6.8-5.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7">
      <path
        d="M5 12h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="m13 6 6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7">
      <path
        d="M12 3.5 19 6v5.2c0 4.3-2.8 7.4-7 9.3-4.2-1.9-7-5-7-9.3V6l7-2.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="m8.8 12 2.1 2.1 4.5-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function HelpIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <circle
        cx="12"
        cy="12"
        r="8.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M9.8 9.5a2.3 2.3 0 1 1 3.2 2.1c-.8.4-1 .9-1 1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M12 16.4h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

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
    <div className="relative min-h-full overflow-hidden bg-[#062C31] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(50,125,132,0.48),rgba(6,44,49,0.25)_34%,rgba(1,23,27,0.95)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(124,231,200,0.08),transparent_32%,rgba(124,231,200,0.05)_68%,transparent)]" />

      <div className="pointer-events-none absolute -left-20 top-0 h-[58%] w-72 rounded-[50%] border border-white/10" />
      <div className="pointer-events-none absolute -right-32 bottom-[-8%] h-[48%] w-72 rounded-[50%] border border-white/10" />

      <div className="pointer-events-none absolute right-[14%] top-[10%] h-14 w-14 rounded-md bg-white/6 blur-[0.2px]" />
      <div className="pointer-events-none absolute right-[7%] top-[17%] h-20 w-20 rounded-md bg-white/5" />
      <div className="pointer-events-none absolute right-[20%] top-[25%] h-9 w-9 rounded-md bg-white/5" />
      <div className="pointer-events-none absolute left-[8%] bottom-[9%] h-16 w-16 rounded-md bg-white/5" />
      <div className="pointer-events-none absolute left-[13%] bottom-[18%] h-7 w-7 rounded-md bg-white/5" />

      <main className="relative z-10 flex min-h-full items-center justify-center px-6 py-10">
        <section className="w-full max-w-[520px]">
          <div className="flex flex-col items-center text-center">
            <img
              src={tdsLogoWhite}
              alt="TYPSA Digital Solutions"
              className="mb-14 h-24 w-auto drop-shadow-[0_10px_22px_rgba(0,0,0,0.3)]"
            />

            <div className="mb-16 flex items-center justify-center gap-8">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white text-3xl font-black text-[#0B3B42] shadow-[0_14px_36px_rgba(0,0,0,0.35),inset_0_2px_12px_rgba(255,255,255,0.75)]">
                JP
              </div>
              <h1 className="font-display text-6xl font-extrabold tracking-normal text-white drop-shadow-[0_8px_22px_rgba(0,0,0,0.28)] max-sm:text-5xl">
                JP Control
              </h1>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-8">
            <label className="block">
              <span className="mb-4 block text-2xl font-extrabold text-white max-sm:text-xl">
                Email corporativo
              </span>
              <span className="relative block">
                <span className="pointer-events-none absolute left-9 top-1/2 -translate-y-1/2 text-accent-300">
                  <MailIcon />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-24 w-full rounded-[28px] border border-white/22 bg-white/7 pl-24 pr-8 text-3xl font-semibold text-white shadow-[inset_0_1px_18px_rgba(255,255,255,0.06),0_18px_44px_rgba(0,0,0,0.18)] outline-none backdrop-blur-md transition placeholder:text-white/58 focus:border-accent-300 focus:bg-white/10 focus:ring-4 focus:ring-accent-300/20 max-sm:h-20 max-sm:pl-20 max-sm:text-2xl"
                  placeholder="usuario@typsa.com"
                  autoComplete="email"
                />
              </span>
            </label>

            {localError && (
              <div className="rounded-[22px] border border-danger/40 bg-danger/14 px-5 py-3 text-base font-bold text-white shadow-soft">
                {localError}
              </div>
            )}

            <button
              type="submit"
              className="group flex h-24 w-full items-center justify-center rounded-full bg-[#A8EBCB] px-8 text-3xl font-extrabold text-[#092F36] shadow-[0_18px_42px_rgba(124,231,200,0.24)] transition hover:bg-[#BDF4D8] focus:outline-none focus:ring-4 focus:ring-white/30 max-sm:h-20 max-sm:text-2xl"
            >
              <span className="flex-1 text-center">Acceso</span>
              <span className="transition-transform group-hover:translate-x-1">
                <ArrowIcon />
              </span>
            </button>

            <div className="flex items-center gap-6 pt-4 text-accent-300">
              <div className="h-px flex-1 bg-white/12" />
              <div className="flex items-center gap-3 text-xl font-medium max-sm:text-base">
                <ShieldIcon />
                <span>Conexi&oacute;n segura y protegida</span>
              </div>
              <div className="h-px flex-1 bg-white/12" />
            </div>

            <div className="pt-12 text-center">
              <a
                href="mailto:soporte@typsa.com"
                className="inline-flex items-center gap-3 text-xl font-medium text-accent-300 transition hover:text-white max-sm:text-base"
              >
                <HelpIcon />
                <span>&iquest;Necesitas ayuda?</span>
              </a>
            </div>
          </form>
        </section>
      </main>
    </div>
  )
}
