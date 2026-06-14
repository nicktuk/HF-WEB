import { NextRequest, NextResponse } from 'next/server'
import { signComercioToken, COMERCIO_COOKIE_NAME } from '@/lib/comercio-jwt'
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limiter'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'
const MAX = 5
const WINDOW = 15 * 60 * 1000 // 15 min

const GENERIC_ERROR = 'Usuario o contraseña incorrectos.'
const TOO_MANY = 'Demasiados intentos. Probá de nuevo en unos minutos.'

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const body = await request.json().catch(() => ({}))
  const { usuario, password } = body as { usuario?: string; password?: string }

  if (!usuario || !password) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 })
  }

  // Rate limit por IP y por usuario
  if (!checkRateLimit(`login:ip:${ip}`, MAX, WINDOW) || !checkRateLimit(`login:user:${usuario}`, MAX, WINDOW)) {
    return NextResponse.json({ error: TOO_MANY }, { status: 429 })
  }

  let res: Response
  try {
    res = await fetch(`${API}/public/comercios/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, password }),
    })
  } catch {
    return NextResponse.json({ error: 'Error de conexión. Intentá de nuevo.' }, { status: 503 })
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { detail?: string }
    if (data.detail === 'cuenta_pendiente') {
      return NextResponse.json({ error: 'Tu cuenta todavía no fue activada.' }, { status: 403 })
    }
    if (data.detail === 'cuenta_inactiva') {
      return NextResponse.json({ error: 'No pudimos iniciar sesión. Contactanos por WhatsApp.' }, { status: 403 })
    }
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 })
  }

  const comercio = await res.json()

  resetRateLimit(`login:ip:${ip}`)
  resetRateLimit(`login:user:${usuario}`)

  const token = await signComercioToken({ comercio_id: comercio.id, estado: comercio.estado })

  const response = NextResponse.json({ ok: true, comercio })
  response.cookies.set(COMERCIO_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  })
  return response
}
