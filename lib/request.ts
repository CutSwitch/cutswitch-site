import crypto from 'crypto'

/**
 * Best-effort client IP extraction behind proxies (Vercel, Cloudflare, etc.).
 *
 * NOTE: We purposely don't attempt perfect parsing, only the common headers.
 */
export function getClientIp(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    // May contain a list: client, proxy1, proxy2
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }

  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp.trim()

  const cfIp = req.headers.get('cf-connecting-ip')
  if (cfIp) return cfIp.trim()

  return null
}

function getHashSecret(): string {
  // Prefer a stable secret. ENTITLEMENT_SIGNING_KEY already exists in your Vercel env.
  return (
    process.env.ENTITLEMENT_SIGNING_KEY ||
    process.env.KV_REST_API_TOKEN ||
    process.env.KEYGEN_API_TOKEN ||
    process.env.KEYGEN_API_KEY ||
    'cutswitch-dev'
  )
}

export function hashToken(input: string): string {
  const secret = getHashSecret()
  const h = crypto.createHmac('sha256', secret).update(input).digest('base64url')
  // Keep KV keys short-ish
  return h.slice(0, 32)
}

/**
 * Returns a hashed IP string suitable for use in KV keys.
 * Never returns the raw IP address.
 */
export function getIpHash(req: Request): string {
  const ip = getClientIp(req) ?? 'unknown'
  return hashToken(ip)
}

/**
 * Read and parse JSON with a payload size limit.
 */
export async function readJsonBody<T = unknown>(
  req: Request,
  maxBytes: number
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string; message?: string }> {
  const contentLength = req.headers.get('content-length')
  if (contentLength) {
    const n = Number(contentLength)
    if (Number.isFinite(n) && n > maxBytes) {
      return { ok: false, status: 413, error: 'payload_too_large', message: 'Payload too large.' }
    }
  }

  const text = await req.text()
  const byteLen = Buffer.byteLength(text, 'utf8')
  if (byteLen > maxBytes) {
    return { ok: false, status: 413, error: 'payload_too_large', message: 'Payload too large.' }
  }

  try {
    const json = JSON.parse(text) as T
    return { ok: true, data: json }
  } catch {
    return { ok: false, status: 400, error: 'invalid_json', message: 'Invalid JSON.' }
  }
}
