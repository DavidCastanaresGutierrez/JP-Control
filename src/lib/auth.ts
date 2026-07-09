export interface AuthSession {
  token: string
  email: string
  username: string
  photoUrl?: string
}

const APP_TOKEN_KEY = 'jp-control-app-token'
const APP_USER_KEY = 'jp-control-app-user'
const COGNITO_ID_TOKEN_KEY = 'typsa_cognito_token'
const COGNITO_REFRESH_TOKEN_KEY = 'typsa_refresh_token'
const SSO_ACCESS_TOKEN_KEY = 'typsa_access_token'

export const ssoUrl = import.meta.env.VITE_TYPSA_SSO_URL as string | undefined
export const isSsoEnabled = Boolean(ssoUrl)

function buildSsoLoginUrl(baseUrl: string) {
  const url = new URL(baseUrl)
  if (!url.pathname || url.pathname === '/') {
    url.pathname = '/sso'
  } else if (!url.pathname.endsWith('/sso')) {
    url.pathname = `${url.pathname.replace(/\/$/, '')}/sso`
  }
  return url
}

function readSsoParams(search: string, hash: string): URLSearchParams {
  const fromSearch = new URLSearchParams(search)
  if (fromSearch.has('id_token') || fromSearch.has('refresh_token') || fromSearch.has('error')) {
    return fromSearch
  }
  const rawHash = hash.startsWith('#') ? hash.slice(1) : hash
  const fromHash = new URLSearchParams(rawHash)
  return fromHash
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const [, payload] = token.split('.')
  if (!payload) return {}
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
  const json = atob(normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '='))
  return JSON.parse(json) as Record<string, unknown>
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function fetchMicrosoftPhoto(accessToken: string): Promise<string | undefined> {
  if (!accessToken) return undefined
  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me/photos/48x48/$value', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) return undefined
    const blob = await response.blob()
    if (!blob.type.startsWith('image/')) return undefined
    return blobToDataUrl(blob)
  } catch {
    return undefined
  }
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
      photoUrl: user.photoUrl,
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
  localStorage.setItem(
    APP_USER_KEY,
    JSON.stringify({
      email: session.email,
      username: session.username,
      photoUrl: session.photoUrl,
    }),
  )
}

export function clearAuthSession() {
  localStorage.removeItem(APP_TOKEN_KEY)
  localStorage.removeItem(APP_USER_KEY)
  localStorage.removeItem(COGNITO_ID_TOKEN_KEY)
  localStorage.removeItem(COGNITO_REFRESH_TOKEN_KEY)
  localStorage.removeItem(SSO_ACCESS_TOKEN_KEY)
  localStorage.removeItem('jp-control-token')
}

export function beginSsoLogin(email: string, redirectUri?: string) {
  if (!ssoUrl) throw new Error('Falta VITE_TYPSA_SSO_URL')
  const url = buildSsoLoginUrl(ssoUrl)
  url.searchParams.set('email', email.trim())
  const callback = redirectUri ?? `${window.location.origin}/login-success`
  url.searchParams.set('redirect_uri', callback)
  window.location.href = url.toString()
}

export async function completeSsoLogin(search: string): Promise<AuthSession> {
  const params = readSsoParams(search, window.location.hash)
  const error = params.get('error')
  if (error) throw new Error(`SSO ha devuelto error: ${error}`)

  const idToken = params.get('id_token') ?? ''
  const accessToken = params.get('access_token') ?? ''
  const refreshToken = params.get('refresh_token') ?? ''
  if (!idToken || !refreshToken) throw new Error('La respuesta SSO no trae id_token o refresh_token.')

  const payload = decodeJwtPayload(idToken)
  const email = String(payload.email ?? '').trim().toLowerCase()
  const username = String(payload.name ?? email)
  if (!email) throw new Error('No se ha podido leer el email del token SSO.')

  localStorage.setItem(COGNITO_ID_TOKEN_KEY, idToken)
  localStorage.setItem(COGNITO_REFRESH_TOKEN_KEY, refreshToken)
  if (accessToken) localStorage.setItem(SSO_ACCESS_TOKEN_KEY, accessToken)

  const session = {
    token: idToken,
    email,
    username,
    photoUrl: await fetchMicrosoftPhoto(accessToken),
  }

  try {
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
      photoUrl?: string
      error?: string
    }
    if (response.ok && body.token) {
      session.token = body.token
      session.email = body.email ?? email
      session.username = body.username ?? username
      session.photoUrl = body.photoUrl ?? session.photoUrl
    }
  } catch {
    // Si el intercambio con la API no funciona, seguimos con el id_token de Cognito.
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
