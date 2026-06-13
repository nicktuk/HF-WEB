import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

export interface MayoristaJwtPayload extends JWTPayload {
  mayorista_id: number
  estado: string
}

const COOKIE_NAME = 'hefa_mayorista_session'
const ALG = 'HS256'

function getSecret(): Uint8Array {
  const secret = process.env.MAYORISTA_JWT_SECRET
  if (!secret) throw new Error('MAYORISTA_JWT_SECRET no configurado')
  return new TextEncoder().encode(secret)
}

export async function signMayoristaToken(payload: Omit<MayoristaJwtPayload, keyof JWTPayload>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret())
}

export async function verifyMayoristaToken(token: string): Promise<MayoristaJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload as MayoristaJwtPayload
  } catch {
    return null
  }
}

export { COOKIE_NAME as MAYORISTA_COOKIE_NAME }
