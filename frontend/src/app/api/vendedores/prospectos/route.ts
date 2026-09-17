import { NextRequest, NextResponse } from 'next/server'
import { vendedorFetch } from '@/lib/vendedor-fetch'

export async function GET() {
  const res = await vendedorFetch('/prospectos')
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const res = await vendedorFetch('/prospectos', { method: 'POST', body: JSON.stringify(body) })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
