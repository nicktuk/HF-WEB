import { NextRequest, NextResponse } from 'next/server'
import { verifyComercioToken, COMERCIO_COOKIE_NAME } from '@/lib/comercio-jwt'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'

export async function GET(request: NextRequest) {
  const token = request.cookies.get(COMERCIO_COOKIE_NAME)?.value ?? ''
  const payload = await verifyComercioToken(token)
  if (!payload) return NextResponse.json({ error: 'no_session' }, { status: 401 })

  const res = await fetch(`${API}/comercios/pricing-config`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
