import { cookies } from 'next/headers'
import { VENDEDOR_COOKIE_NAME } from './vendedor-jwt'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'

/** Fetch server-side con el JWT del vendedor en Authorization header. */
export async function vendedorFetch(path: string, init?: RequestInit) {
  const cookieStore = cookies()
  const token = cookieStore.get(VENDEDOR_COOKIE_NAME)?.value ?? ''

  return fetch(`${API}/vendedores${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  })
}
