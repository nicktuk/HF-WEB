import { NextRequest, NextResponse } from 'next/server'
import { signVendedorToken, VENDEDOR_COOKIE_NAME } from '@/lib/vendedor-jwt'
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

  if (!checkRateLimit(`vlogin:ip:${ip}`, MAX, WINDOW) || !checkRateLimit(`vlogin:user:${usuario}`, MAX, WINDOW)) {
    return NextResponse.json({ error: TOO_MANY }, { status: 429 })
  }

  let res: Response
  try {
    res = await fetch(`${API}/public/vendedores/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, password }),
    })
  } catch {
    return NextResponse.json({ error: 'Error de conexión. Intentá de nuevo.' }, { status: 503 })
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { detail?: string }
    if (data.detail === 'cuenta_inactiva') {
      return NextResponse.json({ error: 'Tu cuenta no está activa. Contactá a HEFA.' }, { status: 403 })
    }
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 })
  }

  const vendedor = await res.json()

  resetRateLimit(`vlogin:ip:${ip}`)
  resetRateLimit(`vlogin:user:${usuario}`)

  const token = await signVendedorToken({
    vendedor_id: vendedor.id,
    activo: true,
    debe_cambiar_password: Boolean(vendedor.debe_cambiar_password),
  })

  const response = NextResponse.json({ ok: true, vendedor })
  response.cookies.set(VENDEDOR_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60,
    path: '/',
  })
  return response
}
