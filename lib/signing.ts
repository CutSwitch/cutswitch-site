import crypto from 'crypto'

type AnyObject = Record<string, any>

function base64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input)
  // Node 18 supports 'base64url'
  return buf.toString('base64url')
}

/**
 * Minimal HS256 token (JWT-like) without external deps.
 * Returned token can be ignored by the client today; it’s useful for “Phase 3.5”.
 */
export function signEntitlementToken(payload: AnyObject, ttlSeconds: number): { token: string; token_expires_at: string } | null {
  const secret = process.env.ENTITLEMENT_SIGNING_KEY
  if (!secret) return null

  const now = Math.floor(Date.now() / 1000)
  const exp = now + ttlSeconds

  const header = { alg: 'HS256', typ: 'JWT' }
  const fullPayload = { ...payload, iat: now, exp }

  const encodedHeader = base64url(JSON.stringify(header))
  const encodedPayload = base64url(JSON.stringify(fullPayload))
  const signingInput = `${encodedHeader}.${encodedPayload}`

  const sig = crypto.createHmac('sha256', secret).update(signingInput).digest('base64url')
  const token = `${signingInput}.${sig}`

  return {
    token,
    token_expires_at: new Date(exp * 1000).toISOString(),
  }
}
