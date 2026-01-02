import { kv } from '@vercel/kv'

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  limit: number
  reset_seconds: number | null
}

/**
 * Simple Redis/KV-backed fixed-window rate limit.
 * Not perfect, but practical and low-friction for early access.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  // incr is atomic in Redis (Upstash)
  const count = await kv.incr(key)

  // First hit: set expiry
  if (count === 1) {
    await kv.expire(key, windowSeconds)
  }

  // ttl returns seconds remaining (or -1 / -2 depending on state)
  let ttl: number | null = null
  try {
    const raw = await kv.ttl(key)
    ttl = raw >= 0 ? raw : null
  } catch {
    ttl = null
  }

  const remaining = Math.max(0, limit - count)
  return {
    allowed: count <= limit,
    remaining,
    limit,
    reset_seconds: ttl,
  }
}
