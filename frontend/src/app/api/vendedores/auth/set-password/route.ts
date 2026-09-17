import { NextRequest, NextResponse } from 'next/server'
import { verifyVendedorToken, signVendedorToken, VENDEDOR_COOKIE_NAME } from '@/lib/vendedor-jwt'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'

export async function POST(request: NextRequest) {
  const token = request.cookies.get(VENDEDOR_COOKIE_NAME)?.value
  if (!token) return NextResponse.json({ error: 'no_session' }, { status: 401 })

  const payload = await verifyVendedorToken(token)
  if (!payload) return NextResponse.json({ error: 'session_invalid' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { password } = body as { password?: string }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, { status: 422 })
  }

  let res: Response
  try {
    res = await fetch(`${API}/vendedores/set-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ password }),
    })
  } catch {
    return NextResponse.json({ error: 'Error de conexión. Intentá de nuevo.' }, { status: 503 })
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { detail?: string }
    return NextResponse.json({ error: data.detail ?? 'No pudimos cambiar tu contraseña.' }, { status: res.status })
  }

  const newToken = await signVendedorToken(
    {
      vendedor_id: payload.vendedor_id,
      activo: payload.activo,
      debe_cambiar_password: false,
    },
    payload.exp,
  )

  const response = NextResponse.json({ ok: true })
  response.cookies.set(VENDEDOR_COOKIE_NAME, newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: Math.max(0, (payload.exp ?? 0) - Math.floor(Date.now() / 1000)),
    path: '/',
  })
  return response
}
