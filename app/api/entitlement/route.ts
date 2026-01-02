import { headers } from 'next/headers'
import { getTrial, putTrial, getLicense, putLicense, upsertDeviceSeen } from '@/lib/kv'
import { rateLimit } from '@/lib/rateLimit'
import { signEntitlementToken } from '@/lib/signing'

function getClientIp(): string {
  const h = headers()
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() ?? 'unknown'
  return h.get('x-real-ip') ?? 'unknown'
}

export async function GET(req: Request) {
  const now = new Date()
  const nowIso = now.toISOString()

  const url = new URL(req.url)
  const deviceId = url.searchParams.get('device_id') ?? ''
  const appVersion = url.searchParams.get('app_version') ?? undefined

  if (!deviceId) {
    return Response.json({ ok: false, error: 'missing_device_id' }, { status: 400 })
  }

  // Rate limit: IP + device_id
  const ip = getClientIp()
  const rl = await rateLimit(`rl:entitlement:${ip}:${deviceId}`, 240, 60 * 60) // 240/hour
  if (!rl.allowed) {
    return Response.json({ ok: false, error: 'rate_limited', message: 'Too many requests. Try again later.' }, { status: 429 })
  }

  await upsertDeviceSeen(deviceId, nowIso, appVersion)

  // Trial
  const trial = await getTrial(deviceId)
  let trial_started_at: string | null = null
  let trial_expires_at: string | null = null
  if (trial) {
    trial_started_at = trial.trial_started_at
    trial_expires_at = trial.trial_expires_at
    await putTrial({ ...trial, last_seen_at: nowIso, app_version: appVersion ?? trial.app_version })
  }

  // License
  const lic = await getLicense(deviceId)
  let license_status: 'active' | 'inactive' = 'inactive'
  let license_expires_at: string | null = null
  let license_last4: string | null = null
  let message: string | undefined = undefined

  if (lic) {
    license_last4 = lic.license_last4 ?? null
    license_expires_at = lic.license_expires_at ?? null

    const exp = lic.license_expires_at ? new Date(lic.license_expires_at) : null
    if (!exp || exp.getTime() > now.getTime()) {
      license_status = 'active'
    } else {
      license_status = 'inactive'
      message = 'License expired.'
    }

    await putLicense({ ...lic, last_seen_at: nowIso, app_version: appVersion ?? lic.app_version })
  }

  const tokenInfo = signEntitlementToken(
    {
      device_id: deviceId,
      license_status,
      trial_expires_at,
    },
    30 * 60 // 30 minutes
  )

  return Response.json({
    ok: true,
    device_id: deviceId,
    server_time: nowIso,
    trial_started_at,
    trial_expires_at,
    license_status,
    license_expires_at,
    license_last4,
    message,
    ...(tokenInfo ? { token: tokenInfo.token, token_expires_at: tokenInfo.token_expires_at } : {}),
  })
}
