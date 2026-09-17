import { NextResponse } from 'next/server'
import { vendedorFetch } from '@/lib/vendedor-fetch'

export async function GET() {
  const res = await vendedorFetch('/mi-cartera')
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
