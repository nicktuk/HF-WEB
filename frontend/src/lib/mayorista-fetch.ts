import { cookies } from 'next/headers'
import { MAYORISTA_COOKIE_NAME } from './mayorista-jwt'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'

/** Fetch server-side con el JWT del mayorista en Authorization header. */
export async function mayoristFetch(path: string, init?: RequestInit) {
  const cookieStore = cookies()
  const token = cookieStore.get(MAYORISTA_COOKIE_NAME)?.value ?? ''

  return fetch(`${API}/mayoristas${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  })
}
