import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const COOKIE = 'hefa_comercio_session'
const MAYORISTA_LOGIN = '/comercios'
const CAMBIAR_PASSWORD = '/comercios/cambiar-password'

function getSecret() {
  return new TextEncoder().encode(process.env.COMERCIO_JWT_SECRET ?? '')
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(COOKIE)?.value

  if (!token) {
    return NextResponse.redirect(new URL(MAYORISTA_LOGIN, request.url))
  }

  try {
    const { payload } = await jwtVerify(token, getSecret())

    // El estado viene en el JWT. Si no es activo, limpiar cookie y redirigir.
    // Para detectar suspensiones recientes la página llama a /api/comercios/auth/me
    // que revalida contra DB y renueva el JWT con el estado actualizado.
    if (payload.estado !== 'activo') {
      const res = NextResponse.redirect(new URL(MAYORISTA_LOGIN, request.url))
      res.cookies.delete(COOKIE)
      return res
    }

    // Comercio con OTP asignada por admin: forzar cambio antes de dejarlo
    // pasar a cualquier otra ruta protegida.
    if (payload.debe_cambiar_password && request.nextUrl.pathname !== CAMBIAR_PASSWORD) {
      return NextResponse.redirect(new URL(CAMBIAR_PASSWORD, request.url))
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
    // /comercios/catalogo queda fuera: sin sesión muestra un preview sin
    // precios/stock en vez de redirigir (ver app/comercios/catalogo/page.tsx).
    '/comercios/carrito/:path*',
    '/comercios/pedidos/:path*',
    '/comercios/pedido/:path*',
    '/comercios/producto/:path*',
    '/comercios/cambiar-password',
  ],
}
