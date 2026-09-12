import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limiter'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'
const MAX = 20
const WINDOW = 15 * 60 * 1000 // 15 min

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const body = await request.json().catch(() => ({}))
  const { token, password } = body as { token?: string; password?: string }

  if (!token || !password) {
    return NextResponse.json({ error: 'Faltan datos.' }, { status: 422 })
  }

  if (!checkRateLimit(`reset:ip:${ip}`, MAX, WINDOW)) {
    return NextResponse.json({ error: 'Demasiados intentos. Probá de nuevo en unos minutos.' }, { status: 429 })
  }

  let res: Response
  try {
    res = await fetch(`${API}/public/comercios/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
  } catch {
    return NextResponse.json({ error: 'Error de conexión. Intentá de nuevo.' }, { status: 503 })
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { detail?: string }
    return NextResponse.json(
      { error: data.detail ?? 'El link no es válido o expiró. Pedí uno nuevo.' },
      { status: res.status },
    )
  }

  return NextResponse.json({ ok: true })
}
