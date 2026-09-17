import { NextRequest, NextResponse } from 'next/server'
import { verifyVendedorToken, VENDEDOR_COOKIE_NAME } from '@/lib/vendedor-jwt'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'

export async function GET(request: NextRequest) {
  const token = request.cookies.get(VENDEDOR_COOKIE_NAME)?.value ?? ''
  const payload = await verifyVendedorToken(token)
  if (!payload) return NextResponse.json({ error: 'no_session' }, { status: 401 })

  const res = await fetch(`${API}/vendedores/info`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
