import { NextRequest, NextResponse } from 'next/server'
import { verifyMayoristaToken, MAYORISTA_COOKIE_NAME } from '@/lib/mayorista-jwt'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'

async function getToken(request: NextRequest) {
  return request.cookies.get(MAYORISTA_COOKIE_NAME)?.value ?? ''
}

export async function POST(request: NextRequest) {
  const token = await getToken(request)
  const payload = await verifyMayoristaToken(token)
  if (!payload) return NextResponse.json({ error: 'no_session' }, { status: 401 })

  const body = await request.json()
  const res = await fetch(`${API}/mayoristas/pedidos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

export async function GET(request: NextRequest) {
  const token = await getToken(request)
  const payload = await verifyMayoristaToken(token)
  if (!payload) return NextResponse.json({ error: 'no_session' }, { status: 401 })

  const res = await fetch(`${API}/mayoristas/pedidos`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
