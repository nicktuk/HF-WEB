import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

export interface VendedorJwtPayload extends JWTPayload {
  vendedor_id: number
  activo: boolean
  debe_cambiar_password: boolean
}

const COOKIE_NAME = 'hefa_vendedor_session'
const ALG = 'HS256'

function getSecret(): Uint8Array {
  const secret = process.env.VENDEDOR_JWT_SECRET
  if (!secret) throw new Error('VENDEDOR_JWT_SECRET no configurado')
  return new TextEncoder().encode(secret)
}

const SESSION_DURATION = '24h'

/**
 * Firma el JWT de sesión del vendedor. Mismo esquema que comercio-jwt.ts:
 * por defecto expira a las 24hs, pero al pasar `expiresAt` (tomado del `exp`
 * de un JWT previo) se conserva ese vencimiento en vez de reiniciar el
 * conteo — la sesión es fija desde el login original.
 */
export async function signVendedorToken(
  payload: Omit<VendedorJwtPayload, keyof JWTPayload>,
  expiresAt?: number,
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(expiresAt ?? SESSION_DURATION)
    .sign(getSecret())
}

export async function verifyVendedorToken(token: string): Promise<VendedorJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload as VendedorJwtPayload
  } catch {
    return null
  }
}

export { COOKIE_NAME as VENDEDOR_COOKIE_NAME }
