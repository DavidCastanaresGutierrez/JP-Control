import * as crypto from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'

type JwtPayload = Record<string, unknown> & {
  exp?: number
  iat?: number
  iss?: string
  sub?: string
  email?: string
  name?: string
  photoUrl?: string
}

const APP_PREFIX = 'jp_control'
type CognitoJwk = crypto.JsonWebKey & { kid?: string }

const jwksCache = new Map<string, { expires: number; keys: CognitoJwk[] }>()

function base64UrlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
  return Buffer.from(padded, 'base64')
}

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function decodeJwt(token: string): { header: Record<string, unknown>; payload: JwtPayload; signingInput: string; signature: Buffer } {
  const [header, payload, signature] = token.split('.')
  if (!header || !payload || !signature) throw new Error('JWT mal formado')
  return {
    header: JSON.parse(base64UrlDecode(header).toString('utf8')) as Record<string, unknown>,
    payload: JSON.parse(base64UrlDecode(payload).toString('utf8')) as JwtPayload,
    signingInput: `${header}.${payload}`,
    signature: base64UrlDecode(signature),
  }
}

function isExpired(payload: JwtPayload): boolean {
  return typeof payload.exp === 'number' && payload.exp <= Math.floor(Date.now() / 1000)
}

function assertUsableTypsaPayload(payload: JwtPayload): JwtPayload {
  if (isExpired(payload)) throw new Error('Token Cognito caducado')
  const email = String(payload.email ?? '').trim().toLowerCase()
  const sub = String(payload.sub ?? '')
  if (!email) throw new Error('Token Cognito sin email')
  if (!sub) throw new Error('Token Cognito sin sub')
  if (!email.endsWith('@typsa.es') && !email.endsWith('@typsa.com')) {
    throw new Error('Dominio de email no permitido')
  }
  return payload
}

function parseCookies(req: VercelRequest): Record<string, string> {
  const header = req.headers.cookie ?? ''
  const cookies: Record<string, string> = {}
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    const key = part.slice(0, idx).trim()
    const value = part.slice(idx + 1).trim()
    if (key) cookies[key] = decodeURIComponent(value)
  }
  return cookies
}

export function encodeEmailToCookieName(email: string): string {
  return base64UrlEncode(email.trim().toLowerCase())
}

function cookieDomain(): string | undefined {
  return process.env.SSO_COOKIE_DOMAIN || undefined
}

function isSecureRequest(req: VercelRequest): boolean {
  return req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production'
}

function serializeCookie(req: VercelRequest, name: string, value: string, options: { httpOnly?: boolean; maxAge?: number } = {}): string {
  const secure = isSecureRequest(req)
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `SameSite=${secure ? 'None' : 'Lax'}`,
    options.maxAge !== undefined ? `Max-Age=${options.maxAge}` : 'Max-Age=31104000',
  ]
  const domain = cookieDomain()
  if (domain) parts.push(`Domain=${domain}`)
  if (secure) parts.push('Secure')
  if (options.httpOnly) parts.push('HttpOnly')
  return parts.join('; ')
}

function clearCookie(req: VercelRequest, name: string): string {
  return serializeCookie(req, name, '', { maxAge: 0 })
}

function durationToSeconds(value: string | undefined): number {
  if (!value) return 24 * 60 * 60
  const match = value.trim().match(/^(\d+)\s*([smhd])?$/i)
  if (!match) return 24 * 60 * 60
  const amount = Number(match[1])
  const unit = (match[2] ?? 's').toLowerCase()
  if (unit === 'm') return amount * 60
  if (unit === 'h') return amount * 60 * 60
  if (unit === 'd') return amount * 24 * 60 * 60
  return amount
}

function appJwtSecret(): string {
  const secret = process.env.JWT_SECRET ?? ''
  if (!secret) throw new Error('Falta JWT_SECRET')
  return secret
}

export function signAppJwt(payload: JwtPayload): string {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + durationToSeconds(process.env.JWT_TOKEN_EXPIRY)
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64UrlEncode(JSON.stringify({ ...payload, iat: now, exp }))
  const signature = crypto.createHmac('sha256', appJwtSecret()).update(`${header}.${body}`).digest()
  return `${header}.${body}.${base64UrlEncode(signature)}`
}

export function verifyAppJwt(token: string): JwtPayload {
  const [header, body, signature] = token.split('.')
  if (!header || !body || !signature) throw new Error('JWT mal formado')
  const expected = crypto.createHmac('sha256', appJwtSecret()).update(`${header}.${body}`).digest()
  const provided = base64UrlDecode(signature)
  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
    throw new Error('Firma de JWT invalida')
  }
  const payload = JSON.parse(base64UrlDecode(body).toString('utf8')) as JwtPayload
  if (isExpired(payload)) throw new Error('JWT caducado')
  return payload
}

async function getJwks(jwksUrl: string): Promise<CognitoJwk[]> {
  const cached = jwksCache.get(jwksUrl)
  if (cached && cached.expires > Date.now()) return cached.keys
  const response = await fetch(jwksUrl)
  if (!response.ok) throw new Error('No se pudo descargar JWKS')
  const body = (await response.json()) as { keys?: CognitoJwk[] }
  const keys = body.keys ?? []
  jwksCache.set(jwksUrl, { expires: Date.now() + 60 * 60 * 1000, keys })
  return keys
}

export async function verifyCognitoToken(token: string): Promise<JwtPayload> {
  const decoded = decodeJwt(token)
  const alg = String(decoded.header.alg ?? '')
  const kid = String(decoded.header.kid ?? '')
  if (alg !== 'RS256' || !kid) throw new Error('Token Cognito no soportado')
  if (isExpired(decoded.payload)) throw new Error('Token Cognito caducado')
  const issuer = String(decoded.payload.iss ?? '')
  if (!issuer) throw new Error('Token Cognito sin issuer')
  const expectedIssuer = process.env.COGNITO_ISSUER
  if (expectedIssuer && issuer !== expectedIssuer) throw new Error('Issuer Cognito no permitido')
  const keys = await getJwks(`${issuer.replace(/\/$/u, '')}/.well-known/jwks.json`)
  const jwk = keys.find((key) => key.kid === kid)
  if (!jwk) throw new Error('Clave Cognito no encontrada')
  const verifier = crypto.createVerify('RSA-SHA256')
  verifier.update(decoded.signingInput)
  verifier.end()
  const ok = verifier.verify(crypto.createPublicKey({ key: jwk, format: 'jwk' }), decoded.signature)
  if (!ok) throw new Error('Firma Cognito invalida')
  return decoded.payload
}

function buildSsoEndpointUrl(value: string | undefined, endpoint: string): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    const cleanPath = url.pathname.replace(/\/$/u, '').replace(/\/sso(?:\/.*)?$/u, '')
    url.pathname = `${cleanPath}${endpoint}`
    return url.toString()
  } catch {
    return undefined
  }
}

function profileEmail(profile: Record<string, unknown>): string {
  return String(
    profile.email ??
      profile.mail ??
      profile.userPrincipalName ??
      profile.preferred_username ??
      '',
  )
    .trim()
    .toLowerCase()
}

function profileName(profile: Record<string, unknown>): string {
  return String(profile.displayName ?? profile.name ?? profile.givenName ?? '').trim()
}

function profilePhotoUrl(profile: Record<string, unknown>): string {
  return String(
    profile.photoUrl ??
      profile.photo ??
      profile.picture ??
      profile.avatar ??
      profile.thumbnailPhoto ??
      '',
  ).trim()
}

async function validateCognitoTokenWithTypsaProfile(token: string): Promise<JwtPayload> {
  const profileUrl = buildSsoEndpointUrl(process.env.SSO_AWS_LAMBDA_URL, '/sso/me/profile')
  if (!profileUrl) throw new Error('Falta SSO_AWS_LAMBDA_URL')

  const response = await fetch(profileUrl, { headers: { Authorization: token } })
  if (!response.ok) throw new Error('TYPSA SSO no ha validado el token.')

  const profile = (await response.json().catch(() => ({}))) as Record<string, unknown>
  const payload = assertUsableTypsaPayload(decodeJwt(token).payload)
  const tokenEmail = String(payload.email ?? '').trim().toLowerCase()
  const checkedEmail = profileEmail(profile)
  if (checkedEmail && checkedEmail !== tokenEmail) {
    throw new Error('El perfil TYPSA no coincide con el token SSO.')
  }

  return {
    ...payload,
    email: tokenEmail,
    name: profileName(profile) || payload.name,
    photoUrl: profilePhotoUrl(profile) || payload.photoUrl,
  }
}

export async function getSsoIdentity(token: string): Promise<JwtPayload> {
  try {
    return await verifyCognitoToken(token)
  } catch {
    return validateCognitoTokenWithTypsaProfile(token)
  }
}

export function setSsoCookies(
  req: VercelRequest,
  res: VercelResponse,
  email: string,
  idToken: string,
  refreshToken: string,
  cognitoSub: string,
) {
  const safeEmail = encodeEmailToCookieName(email)
  res.setHeader('Set-Cookie', [
    serializeCookie(req, `typsa_refresh_token_${safeEmail}`, refreshToken, { httpOnly: true }),
    serializeCookie(req, `typsa_sub_${safeEmail}`, cognitoSub, { httpOnly: true }),
    serializeCookie(req, `typsa_cognito_token_${safeEmail}`, idToken),
    serializeCookie(req, `${APP_PREFIX}_active_email`, email),
    serializeCookie(req, 'typsa_active_email', email),
  ])
}

export function clearSsoCookies(req: VercelRequest, res: VercelResponse) {
  const cookies = parseCookies(req)
  const names = Object.keys(cookies).filter((name) => name.startsWith('typsa_') || name.endsWith('_active_email'))
  const base = [`${APP_PREFIX}_active_email`, 'typsa_active_email']
  res.setHeader('Set-Cookie', [...new Set([...names, ...base])].map((name) => clearCookie(req, name)))
}

export function getBearerToken(req: VercelRequest): string {
  const auth = req.headers.authorization ?? ''
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
}

function getActiveEmail(cookies: Record<string, string>): string {
  return (cookies[`${APP_PREFIX}_active_email`] ?? cookies['typsa_active_email'] ?? '').trim().toLowerCase()
}

/**
 * Renueva el id_token de Cognito llamando a la Lambda de TYPSA SSO
 * (POST {ssoUrl}/refresh-token) con el refresh token y el sub guardados
 * en cookies httpOnly. Devuelve un nuevo app JWT o null si no es posible.
 */
async function refreshSsoSession(req: VercelRequest, res: VercelResponse): Promise<JwtPayload | null> {
  const lambdaUrl = buildSsoEndpointUrl(process.env.SSO_AWS_LAMBDA_URL, '/sso/refresh-token')
  if (!lambdaUrl) return null

  const cookies = parseCookies(req)
  const email = getActiveEmail(cookies)
  if (!email) return null
  const safeEmail = encodeEmailToCookieName(email)
  const refreshToken = cookies[`typsa_refresh_token_${safeEmail}`]
  const cognitoSub = cookies[`typsa_sub_${safeEmail}`]
  if (!refreshToken || !cognitoSub) return null

  try {
    const response = await fetch(lambdaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken, username: cognitoSub }),
    })
    if (!response.ok) return null
    const body = (await response.json()) as { idToken?: string; id_token?: string }
    const idToken = body.idToken ?? body.id_token
    if (!idToken) return null

    const cognito = await getSsoIdentity(idToken)
    const payload: JwtPayload = {
      sub: String(cognito.sub ?? cognitoSub),
      email: String(cognito.email ?? email),
      name: String(cognito.name ?? email),
      role: 'USER',
    }
    const appToken = signAppJwt(payload)
    setSsoCookies(req, res, email, idToken, refreshToken, cognitoSub)
    res.setHeader('authorization', `Bearer ${appToken}`)
    res.setHeader('x-cognito-new-id-token', idToken)
    return payload
  } catch {
    return null
  }
}

export async function requireProjectAuth(req: VercelRequest, res: VercelResponse): Promise<JwtPayload | null> {
  if (process.env.JWT_SECRET) {
    const bearer = getBearerToken(req)
    try {
      return verifyAppJwt(bearer)
    } catch {
      if (bearer) {
        try {
          const cognito = await getSsoIdentity(bearer)
          return {
            sub: String(cognito.sub ?? ''),
            email: String(cognito.email ?? ''),
            name: String(cognito.name ?? cognito.email ?? ''),
            role: 'USER',
          }
        } catch {
          // token no valido, seguir con la renovacion silenciosa
        }
      }
      // App JWT caducado o ausente: intentar renovacion silenciosa via Lambda SSO
      const refreshed = await refreshSsoSession(req, res)
      if (refreshed) return refreshed
      clearSsoCookies(req, res)
      res.status(401).json({ error: 'Sesion SSO no valida.' })
      return null
    }
  }

  const token = process.env.APP_TOKEN
  if (token) {
    const auth = req.headers.authorization ?? ''
    if (auth !== `Bearer ${token}`) {
      res.status(401).json({ error: 'Codigo de acceso incorrecto.' })
      return null
    }
  }
  return {}
}
