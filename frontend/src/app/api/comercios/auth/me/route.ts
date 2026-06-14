import { NextRequest, NextResponse } from 'next/server'
import { verifyComercioToken, signComercioToken, COMERCIO_COOKIE_NAME } from '@/lib/comercio-jwt'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'

export async function GET(request: NextRequest) {
  const token = request.cookies.get(COMERCIO_COOKIE_NAME)?.value
  if (!token) return NextResponse.json({ error: 'no_session' }, { status: 401 })

  const payload = await verifyComercioToken(token)
  if (!payload) return _clearAndUnauth()

  // Revalidar estado contra DB
  let estado: string
  try {
    const res = await fetch(`${API}/public/comercios/${payload.comercio_id}/estado`)
    if (!res.ok) return _clearAndUnauth()
    const data = await res.json() as { estado: string }
    estado = data.estado
  } catch {
    // Si el backend no responde, confiar en el JWT hasta su expiración
    return NextResponse.json({ comercio_id: payload.comercio_id, estado: payload.estado })
  }

  if (estado !== 'activo') {
    return _clearAndUnauth()
  }

  // Si el estado cambió respecto al JWT, renovar el cookie con el estado actualizado
  if (estado !== payload.estado) {
    const newToken = await signComercioToken({ comercio_id: payload.comercio_id, estado })
    const response = NextResponse.json({ comercio_id: payload.comercio_id, estado })
    response.cookies.set(COMERCIO_COOKIE_NAME, newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    })
    return response
  }

  return NextResponse.json({ comercio_id: payload.comercio_id, estado })
}

function _clearAndUnauth() {
  const response = NextResponse.json({ error: 'session_invalid' }, { status: 401 })
  response.cookies.delete(COMERCIO_COOKIE_NAME)
  return response
}
