export const runtime = 'nodejs'

import { NextResponse } from 'next/server'

import { jsonError } from '@/lib/api'
import { getEntitlementStatus } from '@/lib/entitlement'
import { rateLimit } from '@/lib/rateLimit'
import { getIpHash } from '@/lib/request'
import { normalizeAppVersion, normalizeDeviceId, parseBooleanParam } from '@/lib/validation'

// Backward-compatible endpoint.
// Historically used by the app. We now return the canonical entitlement payload plus legacy fields.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const deviceId = normalizeDeviceId(url.searchParams.get('device_id'))
  if (!deviceId) {
    return jsonError(
      400,
      'invalid_device_id',
      'device_id is required and must be 8-128 URL-safe characters.'
    )
  }

  const appVersion = normalizeAppVersion(url.searchParams.get('app_version')) ?? undefined
  const forceValidate = parseBooleanParam(url.searchParams.get('force'))

  const ipHash = getIpHash(req)

  // Defend from accidental spam. We limit both by hashed IP and by device.
  const rlIp = await rateLimit(`rl:entitlement:ip:${ipHash}`, 600, 60 * 60)
  if (!rlIp.allowed) {
    const retryAfter = Math.max(1, rlIp.reset_seconds ?? 60)
    return jsonError(429, 'rate_limited', 'Too many requests.', {
      headers: { 'Retry-After': String(retryAfter) },
    })
  }

  const rlDevice = await rateLimit(`rl:entitlement:device:${deviceId}`, 240, 60 * 60)
  if (!rlDevice.allowed) {
    const retryAfter = Math.max(1, rlDevice.reset_seconds ?? 60)
    return jsonError(429, 'rate_limited', 'Too many requests.', {
      headers: { 'Retry-After': String(retryAfter) },
    })
  }

  const status = await getEntitlementStatus(deviceId, { appVersion, forceValidate })

  // Legacy fields (kept to minimize client breakage)
  const legacy = {
    trial_started_at: status.trial.started_at,
    trial_expires_at: status.trial.expires_at,
    trial_active: status.trial.state === 'active',
    license_status: status.license.state === 'active' ? 'active' : 'inactive',
    license_expires_at: status.license.expires_at,
    license_last4: status.license.key_last4,
  }

  const maxAge = Math.min(60, Math.max(5, status.validation.ttl_seconds))
  return NextResponse.json(
    { ...status, ...legacy },
    {
      headers: {
        'Cache-Control': `private, max-age=${maxAge}`,
      },
    }
  )
}
