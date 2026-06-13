import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const COOKIE = 'hefa_mayorista_session'
const MAYORISTA_LOGIN = '/mayoristas'

function getSecret() {
  return new TextEncoder().encode(process.env.MAYORISTA_JWT_SECRET ?? '')
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(COOKIE)?.value

  if (!token) {
    return NextResponse.redirect(new URL(MAYORISTA_LOGIN, request.url))
  }

  try {
    const { payload } = await jwtVerify(token, getSecret())

    // El estado viene en el JWT. Si no es activo, limpiar cookie y redirigir.
    // Para detectar suspensiones recientes la página llama a /api/mayoristas/auth/me
    // que revalida contra DB y renueva el JWT con el estado actualizado.
    if (payload.estado !== 'activo') {
      const res = NextResponse.redirect(new URL(MAYORISTA_LOGIN, request.url))
      res.cookies.delete(COOKIE)
      return res
    }

    return NextResponse.next()
  } catch {
    const res = NextResponse.redirect(new URL(MAYORISTA_LOGIN, request.url))
    res.cookies.delete(COOKIE)
    return res
  }
}

export const config = {
  matcher: [
    '/mayoristas/catalogo/:path*',
    '/mayoristas/carrito/:path*',
    '/mayoristas/pedidos/:path*',
    '/mayoristas/pedido/:path*',
  ],
}
