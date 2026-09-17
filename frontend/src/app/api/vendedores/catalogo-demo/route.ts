import { NextResponse } from 'next/server'
import { vendedorFetch } from '@/lib/vendedor-fetch'

export async function GET() {
  const res = await vendedorFetch('/catalogo-demo')
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
