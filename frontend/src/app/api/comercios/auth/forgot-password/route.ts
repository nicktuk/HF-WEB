import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limiter'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'
const MAX = 5
const WINDOW = 15 * 60 * 1000 // 15 min

const MENSAJE_GENERICO = 'Si el usuario existe, te enviamos un mail con instrucciones para reestablecer tu contraseña.'
const MENSAJE_SIN_EMAIL = 'No tenés un email registrado en tu cuenta. Le avisamos a HEFA para que te ayuden a resolver esto.'
const TOO_MANY = 'Demasiados intentos. Probá de nuevo en unos minutos.'

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const body = await request.json().catch(() => ({}))
  const { usuario } = body as { usuario?: string }

  if (!usuario) {
    return NextResponse.json({ error: 'Ingresá tu usuario.' }, { status: 422 })
  }

  if (!checkRateLimit(`forgot:ip:${ip}`, MAX, WINDOW) || !checkRateLimit(`forgot:user:${usuario}`, MAX, WINDOW)) {
    return NextResponse.json({ error: TOO_MANY }, { status: 429 })
  }

  let res: Response
  try {
    res = await fetch(`${API}/public/comercios/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario }),
    })
  } catch {
    return NextResponse.json({ error: 'Error de conexión. Intentá de nuevo.' }, { status: 503 })
  }

  if (!res.ok) {
    return NextResponse.json({ error: 'Error de conexión. Intentá de nuevo.' }, { status: 503 })
  }

  const data = await res.json().catch(() => ({})) as { estado?: string }

  // 'no_encontrado' y 'enviado' comparten el mismo mensaje genérico para no
  // revelar si el usuario existe. 'sin_email' es el único caso que se
  // distingue (decisión de negocio: avisarle al comercio que contacte a HEFA).
  const mensaje = data.estado === 'sin_email' ? MENSAJE_SIN_EMAIL : MENSAJE_GENERICO
  return NextResponse.json({ mensaje })
}
