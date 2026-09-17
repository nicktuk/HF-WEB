import { NextRequest, NextResponse } from 'next/server'
import { verifyVendedorToken, signVendedorToken, VENDEDOR_COOKIE_NAME } from '@/lib/vendedor-jwt'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'

export async function GET(request: NextRequest) {
  const token = request.cookies.get(VENDEDOR_COOKIE_NAME)?.value
  if (!token) return NextResponse.json({ error: 'no_session' }, { status: 401 })

  const payload = await verifyVendedorToken(token)
  if (!payload) return _clearAndUnauth()

  // Revalidar estado contra DB
  let activo: boolean
  try {
    const res = await fetch(`${API}/public/vendedores/${payload.vendedor_id}/estado`)
    if (!res.ok) return _clearAndUnauth()
    const data = await res.json() as { activo: boolean }
    activo = data.activo
  } catch {
    // Si el backend no responde, confiar en el JWT hasta su expiración
    return NextResponse.json({ vendedor_id: payload.vendedor_id, activo: payload.activo })
  }

  if (!activo) {
    return _clearAndUnauth()
  }

  // Si el estado cambió respecto al JWT, renovar el cookie con el estado actualizado.
  // La sesión es fija desde el login original: se conserva el mismo `exp`
  // en vez de reiniciar el conteo a 24hs.
  if (activo !== payload.activo) {
    const newToken = await signVendedorToken(
      {
        vendedor_id: payload.vendedor_id,
        activo,
        debe_cambiar_password: payload.debe_cambiar_password,
      },
      payload.exp,
    )
    const remaining = Math.max(0, (payload.exp ?? 0) - Math.floor(Date.now() / 1000))
    const response = NextResponse.json({ vendedor_id: payload.vendedor_id, activo })
    response.cookies.set(VENDEDOR_COOKIE_NAME, newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: remaining,
      path: '/',
    })
    return response
  }

  return NextResponse.json({ vendedor_id: payload.vendedor_id, activo })
}

function _clearAndUnauth() {
  const response = NextResponse.json({ error: 'session_invalid' }, { status: 401 })
  response.cookies.delete(VENDEDOR_COOKIE_NAME)
  return response
}
