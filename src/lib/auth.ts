export interface AuthSession {
  token: string
  email: string
  username: string
}

const APP_TOKEN_KEY = 'jp-control-app-token'
const APP_USER_KEY = 'jp-control-app-user'
const COGNITO_ID_TOKEN_KEY = 'typsa_cognito_token'
const COGNITO_REFRESH_TOKEN_KEY = 'typsa_refresh_token'

export const ssoUrl = import.meta.env.VITE_TYPSA_SSO_URL as string | undefined
export const isSsoEnabled = Boolean(ssoUrl)

function decodeJwtPayload(token: string): Record<string, unknown> {
  const [, payload] = token.split('.')
  if (!payload) return {}
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
  const json = atob(normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '='))
  return JSON.parse(json) as Record<string, unknown>
}

export function getAuthToken(): string {
  return localStorage.getItem(APP_TOKEN_KEY) ?? localStorage.getItem('jp-control-token') ?? ''
}

export function getAuthSession(): AuthSession | null {
  const token = getAuthToken()
  if (!token) return null
  try {
    const user = JSON.parse(localStorage.getItem(APP_USER_KEY) ?? '{}') as Partial<AuthSession>
    return {
      token,
      email: user.email ?? '',
      username: user.username ?? user.email ?? 'Usuario TYPSA',
    }
  } catch {
    return { token, email: '', username: 'Usuario TYPSA' }
  }
}

export function updateAuthToken(token: string) {
  if (token) localStorage.setItem(APP_TOKEN_KEY, token)
}

export function saveAuthSession(session: AuthSession) {
  localStorage.setItem(APP_TOKEN_KEY, session.token)
  localStorage.setItem(APP_USER_KEY, JSON.stringify({ email: session.email, username: session.username }))
}

export function clearAuthSession() {
  localStorage.removeItem(APP_TOKEN_KEY)
  localStorage.removeItem(APP_USER_KEY)
  localStorage.removeItem(COGNITO_ID_TOKEN_KEY)
  localStorage.removeItem(COGNITO_REFRESH_TOKEN_KEY)
  localStorage.removeItem('jp-control-token')
}

export function beginSsoLogin(email: string, redirectUri?: string) {
  if (!ssoUrl) throw new Error('Falta VITE_TYPSA_SSO_URL')
  const url = new URL(ssoUrl)
  url.searchParams.set('email', email.trim())
  url.searchParams.set('redirect_uri', redirectUri ?? `${window.location.origin}/login-success`)
  window.location.href = url.toString()
}

export async function completeSsoLogin(search: string): Promise<AuthSession> {
  const params = new URLSearchParams(search)
  const error = params.get('error')
  if (error) throw new Error(`SSO ha devuelto error: ${error}`)

  const idToken = params.get('id_token') ?? ''
  const refreshToken = params.get('refresh_token') ?? ''
  if (!idToken || !refreshToken) throw new Error('La respuesta SSO no trae id_token o refresh_token.')

  const payload = decodeJwtPayload(idToken)
  const email = String(payload.email ?? '').trim().toLowerCase()
  const username = String(payload.name ?? email)
  if (!email) throw new Error('No se ha podido leer el email del token SSO.')

  localStorage.setItem(COGNITO_ID_TOKEN_KEY, idToken)
  localStorage.setItem(COGNITO_REFRESH_TOKEN_KEY, refreshToken)

  const response = await fetch('/api/auth/login/sso', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'x-cognito-id-token': idToken,
      'x-cognito-refresh-token': refreshToken,
    },
    body: JSON.stringify({ mail: email, username }),
  })

  const body = (await response.json().catch(() => ({}))) as {
    token?: string
    email?: string
    username?: string
    error?: string
  }
  if (!response.ok || !body.token) {
    throw new Error(body.error ?? 'No se ha podido crear la sesion de la aplicacion.')
  }

  const session = {
    token: body.token,
    email: body.email ?? email,
    username: body.username ?? username,
  }
  saveAuthSession(session)
  window.history.replaceState({}, document.title, '/')
  return session
}

export async function logoutSso() {
  const token = getAuthToken()
  await fetch('/api/auth/logout/sso', {
    method: 'POST',
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  }).catch(() => undefined)
  clearAuthSession()
}
