import { NextRequest, NextResponse } from 'next/server'
import { vendedorFetch } from '@/lib/vendedor-fetch'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const res = await vendedorFetch(`/mis-ventas/minorista/${params.id}/items/${params.itemId}/pagar`, {
    method: 'POST',
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
