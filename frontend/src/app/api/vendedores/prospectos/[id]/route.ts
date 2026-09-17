import { NextRequest, NextResponse } from 'next/server'
import { vendedorFetch } from '@/lib/vendedor-fetch'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => ({}))
  const res = await vendedorFetch(`/prospectos/${params.id}`, { method: 'PATCH', body: JSON.stringify(body) })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
