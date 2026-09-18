import { NextRequest, NextResponse } from 'next/server'
import { vendedorFetch } from '@/lib/vendedor-fetch'

export async function POST(
  request: NextRequest,
  { params }: { params: { canal: string; id: string; itemId: string } }
) {
  const res = await vendedorFetch(`/mis-ventas/${params.canal}/${params.id}/items/${params.itemId}/entregar`, {
    method: 'POST',
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
