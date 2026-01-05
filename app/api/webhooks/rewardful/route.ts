cat > app/api/webhooks/rewardful/route.ts <<'EOF'
// app/api/webhooks/rewardful/route.ts

export const runtime = 'nodejs'

import crypto from 'crypto'
import { NextResponse } from 'next/server'

import { rateLimit } from '@/lib/rateLimit'
import { getIpHash } from '@/lib/request'

/**
 * Rewardful Webhook Endpoint
 *
 * Configure Rewardful to POST to:
 *   https://<your-domain>/api/webhooks/rewardful
 *
 * Set in Vercel (and optionally .env.local for local testing):
 *   REWARDFUL_WEBHOOK_TOKEN=<Rewardful "Signing Secret">
 *
 * Rewardful signs requests with:
 *   X-Rewardful-Signature = hex(HMAC_SHA256(signing_secret, raw_request_body))
 */
export async function POST(req: Request) {
  const signingSecret = process.env.REWARDFUL_WEBHOOK_TOKEN
  if (!signingSecret) {
    return new NextResponse('Not Found', { status: 404 })
  }

  try {
    const ipHash = getIpHash(req)
    const rl = await rateLimit(`rl:rewardful_webhook:${ipHash}`, 300, 60 * 60)
    if (!rl.allowed) {
      return new NextResponse('Too Many Requests', {
        status: 429,
        headers: { 'Retry-After': String(Math.max(1, rl.reset_seconds ?? 60)) },
      })
    }
  } catch (e) {
    console.warn('[rewardful webhook] rateLimit unavailable, continuing', {
      err: e instanceof Error ? e.message : String(e),
    })
  }

  const raw = await req.text()

  const maxBytes = 64 * 1024
  const byteLen = Buffer.byteLength(raw, 'utf8')
  if (byteLen > maxBytes) {
    return new NextResponse('Payload Too Large', { status: 413 })
  }

  const providedSig = req.headers.get('x-rewardful-signature')
  if (!providedSig) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const expectedSig = crypto
    .createHmac('sha256', signingSecret)
    .update(raw)
    .digest('hex')

  const sigOk =
    providedSig.length === expectedSig.length &&
    crypto.timingSafeEqual(Buffer.from(providedSig, 'utf8'), Buffer.from(expectedSig, 'utf8'))

  if (!sigOk) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  let event: any
  try {
    event = JSON.parse(raw)
  } catch {
    return new NextResponse('Bad Request', { status: 400 })
  }

  console.log('[rewardful webhook] verified', {
    bytes: byteLen,
    type: event?.type ?? event?.event ?? 'unknown',
    id: event?.id ?? event?.data?.id ?? null,
  })

  return NextResponse.json({ ok: true })
}
EOF