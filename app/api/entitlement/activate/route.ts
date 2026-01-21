export const runtime = 'nodejs'

import crypto from 'crypto'

import { jsonError, jsonOk } from '@/lib/api'
import { getEntitlementStatus } from '@/lib/entitlement'
import { getLicense, getTrial, putLicense, putTrial, upsertDeviceSeen } from '@/lib/kv'
import { rateLimit } from '@/lib/rateLimit'
import { getIpHash, readJsonBody } from '@/lib/request'
import { normalizeAppVersion, normalizeDeviceId, normalizeLicenseKey } from '@/lib/validation'

type ActivateBody = {
  device_id: unknown
  license_key: unknown
  fingerprint?: unknown
  app_version?: unknown
}

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

// NOTE: We rely on Keygen machine limits (policy maxMachines) for device enforcement.
// Server-side KV "device index" enforcement is intentionally removed to avoid double-limiting.

type ValidateLicenseResult =
  | {
      ok: true
      licenseId: string
      expiresAt?: string | null
      suspended?: boolean
    }
  | {
      ok: false
      code: 'invalid_license_key' | 'validation_error'
      message: string
    }

async function validateLicenseKeyDetailed(
  licenseKey: string,
  fingerprint: string
): Promise<ValidateLicenseResult> {
  const keygenAccount = process.env.KEYGEN_ACCOUNT_ID
  const keygenToken = process.env.KEYGEN_API_TOKEN || process.env.KEYGEN_API_KEY

  if (!keygenAccount || !keygenToken) {
    return {
      ok: false,
      code: 'validation_error',
      message: 'Keygen is not configured on the server.',
    }
  }

  const validateUrl = `https://api.keygen.sh/v1/accounts/${keygenAccount}/licenses/actions/validate-key`

  try {
    // 1) Validate license with fingerprint scope
    const res = await fetch(validateUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${keygenToken}`,
        'Content-Type': 'application/vnd.api+json',
        Accept: 'application/vnd.api+json',
      },
      body: JSON.stringify({
        meta: {
          key: licenseKey,
          scope: { fingerprint },
        },
      }),
    })

    const rawText = await res.text()

    let json: any = {}
    try {
      json = JSON.parse(rawText)
    } catch {
      json = {}
    }

    if (!res.ok) {
      return {
        ok: false,
        code: 'validation_error',
        message:
          json?.errors?.[0]?.detail ||
          json?.errors?.[0]?.title ||
          'Unable to validate license.',
      }
    }

    const valid = Boolean(json?.meta?.valid)
    const code = json?.meta?.code

    const data = Array.isArray(json?.data) ? json.data[0] : json?.data
    const licenseId = data?.id as string | undefined
    const expiresAt = data?.attributes?.expiry ?? null
    const suspended = data?.attributes?.suspended ?? false

    if (!licenseId) {
      return {
        ok: false,
        code: 'validation_error',
        message: 'License ID missing from Keygen response.',
      }
    }

    // 2) Create machine if needed
    if (!valid && (code === 'NO_MACHINES' || code === 'FINGERPRINT_SCOPE_MISMATCH')) {
      const machineUrl = `https://api.keygen.sh/v1/accounts/${keygenAccount}/machines`

      const mRes = await fetch(machineUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${keygenToken}`,
          'Content-Type': 'application/vnd.api+json',
          Accept: 'application/vnd.api+json',
        },
        body: JSON.stringify({
          data: {
            type: 'machines',
            attributes: {
              fingerprint,
              name: `CutSwitch Mac (${fingerprint.slice(0, 8)})`,
            },
            relationships: {
              license: {
                data: { type: 'licenses', id: licenseId },
              },
            },
          },
        }),
      })

      const mText = await mRes.text()

      if (!mRes.ok) {
        let err: any = {}
        try {
          err = JSON.parse(mText)
        } catch {
          err = {}
        }
        return {
          ok: false,
          code: 'validation_error',
          message:
            err?.errors?.[0]?.detail ||
            err?.errors?.[0]?.title ||
            'Unable to activate machine.',
        }
      }

      // 3) Re-validate after activation
      return await validateLicenseKeyDetailed(licenseKey, fingerprint)
    }

    if (!valid) {
      return {
        ok: false,
        code: 'invalid_license_key',
        message: json?.meta?.detail ?? 'Invalid license key.',
      }
    }

    return { ok: true, licenseId, expiresAt, suspended }
  } catch (e: any) {
    return {
      ok: false,
      code: 'validation_error',
      message: e?.message ?? 'License validation error.',
    }
  }
}

export async function POST(req: Request) {
  const ipHash = getIpHash(req)

  const rlIp = await rateLimit(`rl:entitlement_activate:ip:${ipHash}`, 60, 60 * 60)
  if (!rlIp.allowed) {
    return jsonError(429, 'rate_limited', 'Too many requests.')
  }

  const parsed = await readJsonBody<Partial<ActivateBody>>(req, 8 * 1024)
  if (!parsed.ok) {
    return jsonError(parsed.status, parsed.error, parsed.message)
  }

  const deviceId = normalizeDeviceId(parsed.data.device_id)
  const licenseKey = normalizeLicenseKey(parsed.data.license_key)
  const fingerprintRaw = parsed.data.fingerprint ?? parsed.data.device_id
  const fingerprint = normalizeDeviceId(fingerprintRaw)
  const appVersion = normalizeAppVersion(parsed.data.app_version)

  if (!deviceId || !licenseKey || !fingerprint) {
    return jsonError(400, 'invalid_payload', 'device_id, license_key, and fingerprint are required.')
  }

  const rlDevice = await rateLimit(`rl:entitlement_activate:device:${deviceId}`, 20, 60 * 60)
  if (!rlDevice.allowed) {
    return jsonError(429, 'rate_limited', 'Too many requests.')
  }

  const now = new Date().toISOString()
  await upsertDeviceSeen(deviceId, now, appVersion)

  const validation = await validateLicenseKeyDetailed(licenseKey, fingerprint)
  if (!validation.ok) {
    return jsonError(403, validation.code, validation.message)
  }

  const keyHash = sha256Hex(licenseKey)
  const last4 = licenseKey.slice(-4)

  const existingLic = await getLicense(deviceId)
  // If this device previously activated with another key, we simply overwrite the device's license record.
  // Keygen will enforce the global machine limit per license.

  const ttlSeconds = 6 * 60 * 60
  const nextCheckAfter = new Date(Date.now() + ttlSeconds * 1000).toISOString()

  await putLicense({
    device_id: deviceId,
    license_key_hash: keyHash,
    license_last4: last4,
    license_expires_at: validation.expiresAt ?? null,
    keygen_license_id: validation.licenseId,
    license_suspended: validation.suspended ?? false,
    last_validated_at: now,
    next_check_after: nextCheckAfter,
    source: 'keygen',
    activated_at: existingLic?.activated_at ?? now,
    last_seen_at: now,
    app_version: appVersion,
  })

  const trial = await getTrial(deviceId)
  if (trial) {
    await putTrial({ ...trial, last_seen_at: now, app_version: appVersion ?? trial.app_version })
  }

  const status = await getEntitlementStatus(deviceId, { appVersion, forceValidate: false })

  return jsonOk({
    device_id: deviceId,
    activated: true,
    status,
  })
}