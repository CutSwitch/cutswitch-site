export const runtime = 'nodejs'

import { jsonError, jsonOk } from '@/lib/api'
import { getEntitlementStatus } from '@/lib/entitlement'
import { rateLimit } from '@/lib/rateLimit'
import { getIpHash } from '@/lib/request'
import { normalizeAppVersion, normalizeDeviceId, parseBooleanParam } from '@/lib/validation'

// Canonical entitlement endpoint:
//   GET /api/entitlement/status?device_id=...&app_version=...&force=1
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
  const rl = await rateLimit(`rl:entitlement_status:${ipHash}:${deviceId}`, 600, 60 * 60)
  if (!rl.allowed) {
    const retryAfter = Math.max(1, rl.reset_seconds ?? 60)
    return jsonError(429, 'rate_limited', 'Too many requests.', {
      headers: { 'Retry-After': String(retryAfter) },
    })
  }

  const status = await getEntitlementStatus(deviceId, { appVersion, forceValidate })

  // Small private cache to reduce spam; client should obey next_check_after.
  const maxAge = Math.min(60, Math.max(5, status.validation.ttl_seconds))
  return jsonOk(status, {
    headers: {
      'Cache-Control': `private, max-age=${maxAge}`,
    },
  })
}
