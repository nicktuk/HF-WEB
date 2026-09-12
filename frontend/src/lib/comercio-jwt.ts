import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

export interface ComercioJwtPayload extends JWTPayload {
  comercio_id: number
  estado: string
}

const COOKIE_NAME = 'hefa_comercio_session'
const ALG = 'HS256'

function getSecret(): Uint8Array {
  const secret = process.env.COMERCIO_JWT_SECRET
  if (!secret) throw new Error('COMERCIO_JWT_SECRET no configurado')
  return new TextEncoder().encode(secret)
}

const SESSION_DURATION = '24h'

/**
 * Firma el JWT de sesión del comercio.
 *
 * Por defecto expira a las 24hs desde este momento. Al pasar `expiresAt`
 * (timestamp absoluto en segundos, tomado del `exp` de un JWT previo) se
 * conserva ese vencimiento en vez de reiniciar el conteo — así la sesión es
 * fija desde el login original, no se extiende por revalidaciones de /me.
 */
export async function signComercioToken(
  payload: Omit<ComercioJwtPayload, keyof JWTPayload>,
  expiresAt?: number,
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(expiresAt ?? SESSION_DURATION)
    .sign(getSecret())
}

export async function verifyComercioToken(token: string): Promise<ComercioJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload as ComercioJwtPayload
  } catch {
    return null
  }
}

export { COOKIE_NAME as COMERCIO_COOKIE_NAME }
