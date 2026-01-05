export const runtime = 'nodejs'

import { NextResponse } from 'next/server'

import { rateLimit } from '@/lib/rateLimit'
import { getIpHash } from '@/lib/request'

// Optional endpoint for Rewardful webhooks.
// Rewardful typically integrates with Stripe directly, but if you enable webhooks,
// point them here and add REWARDFUL_WEBHOOK_TOKEN.
export async function POST(req: Request) {
  const secretToken = process.env.REWARDFUL_WEBHOOK_TOKEN
  if (!secretToken) {
    // If not configured, don't expose a noisy public collector.
    return new NextResponse('Not Found', { status: 404 })
  }

  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (!token || token !== secretToken) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const ipHash = getIpHash(req)
  const rl = await rateLimit(`rl:webhook_rewardful:ip:${ipHash}`, 300, 60 * 60)
  if (!rl.allowed) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': String(Math.max(1, rl.reset_seconds ?? 60)) },
    })
  }

  const raw = await req.text()
  const maxBytes = 64 * 1024
  if (Buffer.byteLength(raw, 'utf8') > maxBytes) {
    return new NextResponse('Payload Too Large', { status: 413 })
  }

  // Do not log payload contents.
  console.log('[rewardful webhook] received', { bytes: Buffer.byteLength(raw, 'utf8') })

  // TODO: verify signature from Rewardful (if configured) and handle events as needed.
  return NextResponse.json({ received: true })
}
