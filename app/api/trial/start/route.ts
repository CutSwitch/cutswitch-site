import { headers } from 'next/headers'
import { getTrial, putTrial, upsertDeviceSeen } from '@/lib/kv'
import { rateLimit } from '@/lib/rateLimit'

function getClientIp(): string {
  const h = headers()
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() ?? 'unknown'
  return h.get('x-real-ip') ?? 'unknown'
}

export async function POST(req: Request) {
  const nowIso = new Date().toISOString()

  try {
    const body = await req.json()
    const deviceId = body?.device_id as string | undefined
    const appVersion = body?.app_version as string | undefined

    if (!deviceId) {
      return Response.json({ ok: false, error: 'missing_device_id' }, { status: 400 })
    }

    // Rate limit: IP + device_id
    const ip = getClientIp()
    const rl = await rateLimit(`rl:trial_start:${ip}:${deviceId}`, 20, 60 * 60) // 20/hour
    if (!rl.allowed) {
      return Response.json({ ok: false, error: 'rate_limited', message: 'Too many requests. Try again later.' }, { status: 429 })
    }

    // Track basic device heartbeat (no PII)
    await upsertDeviceSeen(deviceId, nowIso, appVersion)

    // Idempotent trial creation: same device_id => same expires_at
    const existing = await getTrial(deviceId)
    if (existing) {
      const updated = { ...existing, last_seen_at: nowIso, app_version: appVersion ?? existing.app_version }
      await putTrial(updated)
      return Response.json({
        ok: true,
        device_id: deviceId,
        trial_started_at: updated.trial_started_at,
        trial_expires_at: updated.trial_expires_at,
        server_time: nowIso,
      })
    }

    const startedAt = nowIso
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const record = {
      device_id: deviceId,
      trial_started_at: startedAt,
      trial_expires_at: expiresAt,
      created_at: nowIso,
      last_seen_at: nowIso,
      app_version: appVersion,
    }

    await putTrial(record)

    return Response.json({
      ok: true,
      device_id: deviceId,
      trial_started_at: startedAt,
      trial_expires_at: expiresAt,
      server_time: nowIso,
    })
  } catch (e: any) {
    return Response.json({ ok: false, error: 'bad_request', message: e?.message ?? 'Invalid request' }, { status: 400 })
  }
}
