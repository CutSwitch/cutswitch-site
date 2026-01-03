import crypto from 'crypto'
import { headers } from 'next/headers'
import {
  getLicense,
  putLicense,
  getLicenseKeyIndex,
  putLicenseKeyIndex,
  getTrial,
  putTrial,
  upsertDeviceSeen,
} from '@/lib/kv'
import { rateLimit } from '@/lib/rateLimit'
import { signEntitlementToken } from '@/lib/signing'

function getClientIp(): string {
  const h = headers()
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() ?? 'unknown'
  return h.get('x-real-ip') ?? 'unknown'
}

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

function allowlistKeys(): string[] {
  const raw = process.env.TEST_LICENSE_KEYS ?? ''
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

async function validateLicenseKey(licenseKey: string, deviceId: string): Promise<{ valid: boolean; message?: string }> {
  const keygenAccount = process.env.KEYGEN_ACCOUNT_ID
  // NOTE: validate-key is a public Keygen endpoint, so you don't *need* an admin token.
  // If you *do* provide one, accept either KEYGEN_API_TOKEN or KEYGEN_API_KEY for convenience.
  const keygenToken = process.env.KEYGEN_API_TOKEN || process.env.KEYGEN_API_KEY

  // If Keygen account is configured, use it.
  if (keygenAccount) {
    try {
      // Keygen JSON:API validate-key action (best-effort implementation)
      const url = `https://api.keygen.sh/v1/accounts/${keygenAccount}/licenses/actions/validate-key`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          ...(keygenToken ? { Authorization: `Bearer ${keygenToken}` } : {}),
          'Content-Type': 'application/vnd.api+json',
          Accept: 'application/vnd.api+json',
        },
        body: JSON.stringify({
          meta: {
            key: licenseKey,
            scope: { fingerprint: deviceId },
          },
        }),
      })

      const json: any = await res.json().catch(() => ({}))

      const valid = Boolean(json?.meta?.valid)
      if (valid) return { valid: true }
      return { valid: false, message: json?.meta?.detail ?? 'Invalid license key.' }
    } catch (e: any) {
      return { valid: false, message: e?.message ?? 'License validation error.' }
    }
  }

  // Otherwise fall back to allowlist keys.
  const allowed = allowlistKeys()
  if (allowed.length === 0) {
    return { valid: false, message: 'License activation is not configured on the server.' }
  }

  if (allowed.includes(licenseKey)) {
    return { valid: true }
  }

  return { valid: false, message: 'Invalid license key.' }
}

export async function POST(req: Request) {
  const now = new Date()
  const nowIso = now.toISOString()

  try {
    const body = await req.json()
    const deviceId = body?.device_id as string | undefined
    const licenseKey = body?.license_key as string | undefined
    const appVersion = body?.app_version as string | undefined

    if (!deviceId || !licenseKey) {
      return Response.json({ ok: false, error: 'missing_fields', message: 'device_id and license_key are required.' }, { status: 400 })
    }

    // Rate limit: IP + device_id
    const ip = getClientIp()
    const rl = await rateLimit(`rl:entitlement_activate:${ip}:${deviceId}`, 20, 60 * 60) // 20/hour
    if (!rl.allowed) {
      return Response.json({ ok: false, error: 'rate_limited', message: 'Too many requests. Try again later.' }, { status: 429 })
    }

    await upsertDeviceSeen(deviceId, nowIso, appVersion)

    const trimmed = licenseKey.trim()
    const validation = await validateLicenseKey(trimmed, deviceId)
    if (!validation.valid) {
      return Response.json(
        { ok: false, error: 'invalid_license', license_status: 'inactive', message: validation.message ?? 'Invalid license key.' },
        { status: 403 }
      )
    }

    const keyHash = sha256Hex(trimmed)
    const last4 = trimmed.slice(-4)

    const maxDevices = Number(process.env.LICENSE_MAX_DEVICES ?? '2')
    const idxExisting = await getLicenseKeyIndex(keyHash)
    const deviceIds = new Set(idxExisting?.device_ids ?? [])

    if (!deviceIds.has(deviceId) && deviceIds.size >= maxDevices) {
      return Response.json(
        { ok: false, error: 'device_limit', license_status: 'inactive', message: 'This license is already active on too many devices.' },
        { status: 403 }
      )
    }

    deviceIds.add(deviceId)
    await putLicenseKeyIndex({
      license_key_hash: keyHash,
      device_ids: Array.from(deviceIds),
      updated_at: nowIso,
    })

    // Upsert license record for this device
    const existingLic = await getLicense(deviceId)
    await putLicense({
      device_id: deviceId,
      license_key_hash: keyHash,
      license_last4: last4,
      license_expires_at: existingLic?.license_expires_at ?? null,
      activated_at: existingLic?.activated_at ?? nowIso,
      last_seen_at: nowIso,
      app_version: appVersion,
    })

    // Also touch trial record if it exists (for nicer telemetry)
    const trial = await getTrial(deviceId)
    if (trial) {
      await putTrial({ ...trial, last_seen_at: nowIso, app_version: appVersion ?? trial.app_version })
    }

    const trial_started_at = trial?.trial_started_at ?? null
    const trial_expires_at = trial?.trial_expires_at ?? null

    const tokenInfo = signEntitlementToken(
      {
        device_id: deviceId,
        license_status: 'active',
        trial_expires_at,
      },
      30 * 60
    )

    return Response.json({
      ok: true,
      device_id: deviceId,
      server_time: nowIso,
      trial_started_at,
      trial_expires_at,
      license_status: 'active',
      license_expires_at: existingLic?.license_expires_at ?? null,
      license_last4: last4,
      message: 'Activated.',
      ...(tokenInfo ? { token: tokenInfo.token, token_expires_at: tokenInfo.token_expires_at } : {}),
    })
  } catch (e: any) {
    return Response.json({ ok: false, error: 'bad_request', message: e?.message ?? 'Invalid request' }, { status: 400 })
  }
}
