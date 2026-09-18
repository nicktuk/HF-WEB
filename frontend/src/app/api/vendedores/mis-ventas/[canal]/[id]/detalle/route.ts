import { NextRequest, NextResponse } from 'next/server'
import { vendedorFetch } from '@/lib/vendedor-fetch'

export async function GET(request: NextRequest, { params }: { params: { canal: string; id: string } }) {
  const res = await vendedorFetch(`/mis-ventas/${params.canal}/${params.id}/detalle`)
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
