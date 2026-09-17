import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const COMERCIO_COOKIE = 'hefa_comercio_session'
const MAYORISTA_LOGIN = '/comercios'
const COMERCIO_CAMBIAR_PASSWORD = '/comercios/cambiar-password'

const VENDEDOR_COOKIE = 'hefa_vendedor_session'
const VENDEDOR_LOGIN = '/vendedores'
const VENDEDOR_CAMBIAR_PASSWORD = '/vendedores/cambiar-password'
// Únicas rutas de /vendedores/* que no requieren sesión.
const VENDEDOR_RUTAS_PUBLICAS = new Set([
  '/vendedores',
  '/vendedores/olvide-password',
  '/vendedores/reset-password',
])

function getComercioSecret() {
  return new TextEncoder().encode(process.env.COMERCIO_JWT_SECRET ?? '')
}

function getVendedorSecret() {
  return new TextEncoder().encode(process.env.VENDEDOR_JWT_SECRET ?? '')
}

async function middlewareComercio(request: NextRequest) {
  const token = request.cookies.get(COMERCIO_COOKIE)?.value

  if (!token) {
    return NextResponse.redirect(new URL(MAYORISTA_LOGIN, request.url))
  }

  try {
    const { payload } = await jwtVerify(token, getComercioSecret())

    // El estado viene en el JWT. Si no es activo, limpiar cookie y redirigir.
    // Para detectar suspensiones recientes la página llama a /api/comercios/auth/me
    // que revalida contra DB y renueva el JWT con el estado actualizado.
    if (payload.estado !== 'activo') {
      const res = NextResponse.redirect(new URL(MAYORISTA_LOGIN, request.url))
      res.cookies.delete(COMERCIO_COOKIE)
      return res
    }

    // Comercio con OTP asignada por admin: forzar cambio antes de dejarlo
    // pasar a cualquier otra ruta protegida.
    if (payload.debe_cambiar_password && request.nextUrl.pathname !== COMERCIO_CAMBIAR_PASSWORD) {
      return NextResponse.redirect(new URL(COMERCIO_CAMBIAR_PASSWORD, request.url))
    }

    return NextResponse.next()
  } catch {
    const res = NextResponse.redirect(new URL(MAYORISTA_LOGIN, request.url))
    res.cookies.delete(COMERCIO_COOKIE)
    return res
  }
}

async function middlewareVendedor(request: NextRequest) {
  const token = request.cookies.get(VENDEDOR_COOKIE)?.value

  if (!token) {
    return NextResponse.redirect(new URL(VENDEDOR_LOGIN, request.url))
  }

  try {
    const { payload } = await jwtVerify(token, getVendedorSecret())

    if (!payload.activo) {
      const res = NextResponse.redirect(new URL(VENDEDOR_LOGIN, request.url))
      res.cookies.delete(VENDEDOR_COOKIE)
      return res
    }

    if (payload.debe_cambiar_password && request.nextUrl.pathname !== VENDEDOR_CAMBIAR_PASSWORD) {
      return NextResponse.redirect(new URL(VENDEDOR_CAMBIAR_PASSWORD, request.url))
    }

    return NextResponse.next()
  } catch {
    const res = NextResponse.redirect(new URL(VENDEDOR_LOGIN, request.url))
    res.cookies.delete(VENDEDOR_COOKIE)
    return res
  }
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/vendedores')) {
    if (VENDEDOR_RUTAS_PUBLICAS.has(request.nextUrl.pathname)) {
      return NextResponse.next()
    }
    return middlewareVendedor(request)
  }
  return middlewareComercio(request)
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
    // Portal de vendedores: todo bajo /vendedores pasa por acá; las rutas
    // públicas (login, recupero) se excluyen dentro de middlewareVendedor
    // vía VENDEDOR_RUTAS_PUBLICAS, así las pantallas nuevas (cartera,
    // catálogo, plata, prospectos, clientes) quedan protegidas sin tener
    // que listar cada subruta acá.
    '/vendedores/:path*',
  ],
}
