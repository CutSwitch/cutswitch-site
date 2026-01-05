export const runtime = 'nodejs'

import { jsonError, jsonOk } from '@/lib/api'
import { getEntitlementStatus } from '@/lib/entitlement'
import { rateLimit } from '@/lib/rateLimit'
import { getIpHash } from '@/lib/request'
import { normalizeAppVersion, normalizeDeviceId, parseBooleanParam } from '@/lib/validation'

// Lightweight license-only status endpoint.
// GET /api/license/status?device_id=...&app_version=...&force=1
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
  const rl = await rateLimit(`rl:license_status:${ipHash}:${deviceId}`, 600, 60 * 60)
  if (!rl.allowed) {
    return jsonError(429, 'rate_limited', 'Too many requests.', {
      headers: { 'Retry-After': String(Math.max(1, rl.reset_seconds ?? 60)) },
    })
  }

  const status = await getEntitlementStatus(deviceId, { appVersion, forceValidate })
  const maxAge = Math.min(60, Math.max(5, status.validation.ttl_seconds))

  return jsonOk(
    {
      device_id: status.device_id,
      server_time: status.server_time,
      license: status.license,
      validation: status.validation,
    },
    {
      headers: {
        'Cache-Control': `private, max-age=${maxAge}`,
      },
    }
  )
}
