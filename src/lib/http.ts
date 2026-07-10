import { getAuthToken, updateAuthToken } from './auth'

/** Llama a la API con el token de sesion y recoge la renovacion silenciosa del JWT si el backend la envia. */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response | null> {
  try {
    const token = getAuthToken()
    const res = await fetch(path, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    })
    const renewed = res.headers.get('authorization')
    if (renewed?.startsWith('Bearer ')) updateAuthToken(renewed.slice(7))
    return res
  } catch {
    return null
  }
}
