export const runtime = 'nodejs'

import { jsonError, jsonOk } from '@/lib/api'
import { getTrial, putTrial, upsertDeviceSeen } from '@/lib/kv'
import { rateLimit } from '@/lib/rateLimit'
import { getIpHash } from '@/lib/request'
import { normalizeAppVersion, normalizeDeviceId } from '@/lib/validation'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const deviceId = normalizeDeviceId(url.searchParams.get('device_id'))
  if (!deviceId) {
    return jsonError(400, 'invalid_device_id', 'device_id is required and must be 8-128 URL-safe characters.')
  }

  const appVersion = normalizeAppVersion(url.searchParams.get('app_version')) ?? undefined

  const ipHash = getIpHash(req)
  const rl = await rateLimit(`rl:trial_status:${ipHash}:${deviceId}`, 120, 60 * 60)
  if (!rl.allowed) {
    return jsonError(429, 'rate_limited', 'Too many requests.', {
      headers: { 'Retry-After': String(Math.max(1, rl.reset_seconds ?? 60)) },
    })
  }

  const nowIso = new Date().toISOString()
  await upsertDeviceSeen(deviceId, nowIso, appVersion)

  const trial = await getTrial(deviceId)
  if (!trial) {
    const maxAge = 60
    return jsonOk(
      {
        device_id: deviceId,
        trial_started_at: null,
        trial_expires_at: null,
        trial_active: false,
        server_time: nowIso,
      },
      { headers: { 'Cache-Control': `private, max-age=${maxAge}` } }
    )
  }

  const active = Date.parse(trial.trial_expires_at) > Date.now()
  await putTrial({ ...trial, last_seen_at: nowIso, app_version: appVersion ?? trial.app_version })

  const maxAge = 30
  return jsonOk(
    {
      device_id: deviceId,
      trial_started_at: trial.trial_started_at,
      trial_expires_at: trial.trial_expires_at,
      trial_active: active,
      server_time: nowIso,
    },
    { headers: { 'Cache-Control': `private, max-age=${maxAge}` } }
  )
}