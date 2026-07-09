import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setSsoCookies, signAppJwt, verifyCognitoToken } from '../../_sso.js'

function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Metodo no permitido.' })
  }

  if (!process.env.JWT_SECRET) {
    return res.status(503).json({ error: 'SSO no configurado: falta JWT_SECRET en Vercel.' })
  }

  const body = (req.body ?? {}) as { mail?: string; username?: string }
  const mail = (body.mail ?? '').trim().toLowerCase()
  const idToken = headerValue(req.headers['x-cognito-id-token'])
  const refreshToken = headerValue(req.headers['x-cognito-refresh-token'])

  if (!mail || !idToken || !refreshToken) {
    return res.status(400).json({ error: 'Faltan mail, x-cognito-id-token o x-cognito-refresh-token.' })
  }

  try {
    const cognito = await verifyCognitoToken(idToken)
    const tokenEmail = String(cognito.email ?? mail).trim().toLowerCase()
    if (tokenEmail !== mail) return res.status(401).json({ error: 'El email no coincide con el token SSO.' })

    const sub = String(cognito.sub ?? '')
    if (!sub) return res.status(401).json({ error: 'El token SSO no contiene sub.' })

    const username = body.username || String(cognito.name ?? tokenEmail)
    const appToken = signAppJwt({
      sub,
      email: tokenEmail,
      name: username,
      role: 'USER',
    })

    setSsoCookies(req, res, tokenEmail, idToken, refreshToken, sub)
    return res.status(200).json({
      id: sub,
      token: appToken,
      role: 'USER',
      username,
      email: tokenEmail,
    })
  } catch (err) {
    return res.status(401).json({ error: err instanceof Error ? err.message : 'SSO no valido.' })
  }
}

