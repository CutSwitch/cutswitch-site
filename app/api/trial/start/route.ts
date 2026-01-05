export const runtime = 'nodejs'

import { jsonError, jsonOk } from '@/lib/api'
import { getTrial, putTrial, upsertDeviceSeen } from '@/lib/kv'
import { rateLimit } from '@/lib/rateLimit'
import { getIpHash, readJsonBody } from '@/lib/request'
import { normalizeAppVersion, normalizeDeviceId } from '@/lib/validation'

const TRIAL_DAYS = 7

export async function POST(req: Request) {
  const ipHash = getIpHash(req)

  const parsed = await readJsonBody<{ device_id?: unknown; app_version?: unknown }>(req, 4 * 1024)
  if (!parsed.ok) {
    return jsonError(parsed.status, parsed.error, parsed.message)
  }

  const deviceId = normalizeDeviceId(parsed.data.device_id)
  const appVersion = normalizeAppVersion(parsed.data.app_version)

  if (!deviceId) {
    return jsonError(400, 'invalid_device_id', 'device_id is required and must be 8-128 URL-safe characters.')
  }

  const rlIp = await rateLimit(`rl:trial_start:ip:${ipHash}`, 10, 60 * 60)
  if (!rlIp.allowed) {
    return jsonError(429, 'rate_limited', 'Too many requests.', {
      headers: { 'Retry-After': String(Math.max(1, rlIp.reset_seconds ?? 60)) },
    })
  }

  const rlDevice = await rateLimit(`rl:trial_start:device:${deviceId}`, 10, 60 * 60)
  if (!rlDevice.allowed) {
    return jsonError(429, 'rate_limited', 'Too many requests.', {
      headers: { 'Retry-After': String(Math.max(1, rlDevice.reset_seconds ?? 60)) },
    })
  }

  const nowIso = new Date().toISOString()
  await upsertDeviceSeen(deviceId, nowIso, appVersion)

  const existing = await getTrial(deviceId)
  if (existing) {
    await putTrial({ ...existing, last_seen_at: nowIso, app_version: appVersion ?? existing.app_version })
    return jsonOk(
      {
        device_id: deviceId,
        trial_started_at: existing.trial_started_at,
        trial_expires_at: existing.trial_expires_at,
        trial_active: Date.parse(existing.trial_expires_at) > Date.now(),
        server_time: nowIso,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const startedAt = nowIso
  const expiresAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()

  await putTrial({
    device_id: deviceId,
    trial_started_at: startedAt,
    trial_expires_at: expiresAt,
    created_at: nowIso,
    last_seen_at: nowIso,
    ...(appVersion ? { app_version: appVersion } : {}),
  })

  return jsonOk(
    {
      device_id: deviceId,
      trial_started_at: startedAt,
      trial_expires_at: expiresAt,
      trial_active: true,
      server_time: nowIso,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
