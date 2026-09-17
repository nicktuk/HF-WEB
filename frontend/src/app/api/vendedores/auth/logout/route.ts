import { NextResponse } from 'next/server'
import { VENDEDOR_COOKIE_NAME } from '@/lib/vendedor-jwt'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete(VENDEDOR_COOKIE_NAME)
  return response
}
