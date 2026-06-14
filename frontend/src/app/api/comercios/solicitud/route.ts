import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limiter'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'
const MAX = 3
const WINDOW = 60 * 60 * 1000 // 1 hora

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  if (!checkRateLimit(`solicitud:ip:${ip}`, MAX, WINDOW)) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Probá de nuevo más tarde.' },
      { status: 429 },
    )
  }

  const body = await request.json().catch(() => ({}))

  // Honeypot: si viene con valor, respuesta 200 falsa
  if ((body as { website?: string }).website) {
    return NextResponse.json({ ok: true })
  }

  let res: Response
  try {
    res = await fetch(`${API}/public/comercios/solicitud`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    return NextResponse.json({ error: 'Error de conexión. Intentá de nuevo.' }, { status: 503 })
  }

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    return NextResponse.json(data, { status: res.status })
  }

  return NextResponse.json(data)
}
