import { NextRequest, NextResponse } from 'next/server'
import { vendedorFetch } from '@/lib/vendedor-fetch'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const res = await vendedorFetch('/clientes', { method: 'POST', body: JSON.stringify(body) })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
