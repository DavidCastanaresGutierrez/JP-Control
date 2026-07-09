import type { VercelRequest, VercelResponse } from '@vercel/node'
import { clearSsoCookies } from '../../_sso'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Metodo no permitido.' })
  }

  clearSsoCookies(req, res)
  return res.status(200).json({ ok: true })
}

