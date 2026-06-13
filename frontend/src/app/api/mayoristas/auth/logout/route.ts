import { NextResponse } from 'next/server'
import { MAYORISTA_COOKIE_NAME } from '@/lib/mayorista-jwt'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete(MAYORISTA_COOKIE_NAME)
  return response
}
