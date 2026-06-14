import { NextResponse } from 'next/server'
import { COMERCIO_COOKIE_NAME } from '@/lib/comercio-jwt'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete(COMERCIO_COOKIE_NAME)
  return response
}
