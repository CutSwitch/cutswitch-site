import { headers } from 'next/headers'
import { getTrial, putTrial, upsertDeviceSeen } from '@/lib/kv'
import { rateLimit } from '@/lib/rateLimit'

function getClientIp(): string {
  const h = headers()
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() ?? 'unknown'
  return h.get('x-real-ip') ?? 'unknown'
}

export async function GET(req: Request) {
  const nowIso = new Date().toISOString()

  const url = new URL(req.url)
  const deviceId = url.searchParams.get('device_id') ?? ''
  const appVersion = url.searchParams.get('app_version') ?? undefined

  if (!deviceId) {
    return Response.json({ ok: false, error: 'missing_device_id' }, { status: 400 })
  }

  // Rate limit: IP + device_id
  const ip = getClientIp()
  const rl = await rateLimit(`rl:trial_status:${ip}:${deviceId}`, 120, 60 * 60) // 120/hour
  if (!rl.allowed) {
    return Response.json({ ok: false, error: 'rate_limited', message: 'Too many requests. Try again later.' }, { status: 429 })
  }

  await upsertDeviceSeen(deviceId, nowIso, appVersion)

  const trial = await getTrial(deviceId)
  if (!trial) {
    return Response.json({
      ok: true,
      device_id: deviceId,
      trial_started_at: null,
      trial_expires_at: null,
      server_time: nowIso,
    })
  }

  // Update last_seen_at for analytics/debug, not enforcement.
  const updated = { ...trial, last_seen_at: nowIso, app_version: appVersion ?? trial.app_version }
  await putTrial(updated)

  return Response.json({
    ok: true,
    device_id: deviceId,
    trial_started_at: updated.trial_started_at,
    trial_expires_at: updated.trial_expires_at,
    server_time: nowIso,
  })
}
