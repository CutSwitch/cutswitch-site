export const runtime = 'nodejs'

import crypto from 'crypto'

import { jsonError, jsonOk } from '@/lib/api'
import { getEntitlementStatus } from '@/lib/entitlement'
import {
  getLicense,
  getLicenseKeyIndex,
  getTrial,
  putLicense,
  putLicenseKeyIndex,
  putTrial,
  removeDeviceFromLicenseKeyIndex,
  upsertDeviceSeen,
} from '@/lib/kv'
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

function getAllowlistKeys(): string[] {
  const raw = process.env.TEST_LICENSE_KEYS ?? ''
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function getMaxDevices(): number {
  const raw = process.env.LICENSE_MAX_DEVICES ?? '2'
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return 2
  return Math.min(50, Math.floor(n))
}

type ValidateLicenseResult =
  | {
      ok: true
      source: 'keygen' | 'allowlist'
      licenseId?: string
      expiresAt?: string | null
      suspended?: boolean
    }
  | {
      ok: false
      code: 'invalid_license_key' | 'license_not_found' | 'validation_error'
      message: string
    }

async function validateLicenseKeyDetailed(
  licenseKey: string,
  fingerprint: string
): Promise<ValidateLicenseResult> {
  // Allowlist fallback (for testing / emergency)
  const allowlist = getAllowlistKeys()
  if (allowlist.includes(licenseKey)) {
    return { ok: true, source: 'allowlist' }
  }

  const keygenAccount = process.env.KEYGEN_ACCOUNT_ID
  const keygenToken = process.env.KEYGEN_API_TOKEN || process.env.KEYGEN_API_KEY

  if (!keygenAccount) {
    return {
      ok: false,
      code: 'validation_error',
      message: 'License activation is not configured on the server.',
    }
  }

  const validateUrl = `https://api.keygen.sh/v1/accounts/${keygenAccount}/licenses/actions/validate-key`

  try {
    // 1) Validate with fingerprint scope
    const res = await fetch(validateUrl, {
      method: 'POST',
      headers: {
        ...(keygenToken ? { Authorization: `Bearer ${keygenToken}` } : {}),
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
    console.log('Keygen validate status:', res.status)
    console.log('Keygen validate body:', rawText)

    let json: any = {}
    try {
      json = JSON.parse(rawText)
    } catch {
      // non-JSON response (still logged above)
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
    const code = typeof json?.meta?.code === 'string' ? json.meta.code : undefined

    // Keygen may return either a single resource or an array. Handle both.
    const data = Array.isArray(json?.data) ? json.data[0] : json?.data
    const licenseId = typeof data?.id === 'string' ? data.id : undefined
    const expiresAt =
      typeof data?.attributes?.expiry === 'string' ? data.attributes.expiry : null
    const suspended =
      typeof data?.attributes?.suspended === 'boolean'
        ? data.attributes.suspended
        : undefined

    // 2) If NOT valid because there are no machines for this fingerprint,
    //    create a machine for this fingerprint + license.
    if (
      !valid &&
      (code === 'NO_MACHINES' || code === 'FINGERPRINT_SCOPE_MISMATCH')
    ) {
      if (!licenseId) {
        return {
          ok: false,
          code: 'validation_error',
          message: 'License ID missing from Keygen validation response.',
        }
      }

      const machineUrl = `https://api.keygen.sh/v1/accounts/${keygenAccount}/machines`

      const mRes = await fetch(machineUrl, {
        method: 'POST',
        headers: {
          ...(keygenToken ? { Authorization: `Bearer ${keygenToken}` } : {}),
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
          },
        }),
      })

      const mText = await mRes.text()
      console.log('Keygen machine status:', mRes.status)
      console.log('Keygen machine body:', mText)

      if (!mRes.ok) {
        let mJson: any = null
        try {
          mJson = JSON.parse(mText)
        } catch {
          mJson = null
        }
        return {
          ok: false,
          code: 'validation_error',
          message:
            mJson?.errors?.[0]?.detail ||
            mJson?.errors?.[0]?.title ||
            mText ||
            'Unable to activate machine.',
        }
      }

      // 3) Re-validate after machine creation
      const res2 = await fetch(validateUrl, {
        method: 'POST',
        headers: {
          ...(keygenToken ? { Authorization: `Bearer ${keygenToken}` } : {}),
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

      const raw2 = await res2.text()
      console.log('Keygen revalidate status:', res2.status)
      console.log('Keygen revalidate body:', raw2)

      let json2: any = {}
      try {
        json2 = JSON.parse(raw2)
      } catch {
        json2 = {}
      }

      if (!res2.ok || !Boolean(json2?.meta?.valid)) {
        return {
          ok: false,
          code: 'invalid_license_key',
          message:
            json2?.meta?.detail ??
            'License could not be validated after machine activation.',
        }
      }

      const data2 = Array.isArray(json2?.data) ? json2.data[0] : json2?.data
      const licenseId2 = typeof data2?.id === 'string' ? data2.id : licenseId
      const expiresAt2 =
        typeof data2?.attributes?.expiry === 'string'
          ? data2.attributes.expiry
          : expiresAt
      const suspended2 =
        typeof data2?.attributes?.suspended === 'boolean'
          ? data2.attributes.suspended
          : suspended

      return { ok: true, source: 'keygen', licenseId: licenseId2, expiresAt: expiresAt2, suspended: suspended2 }
    }

    // 4) If it is valid already, great
    if (valid) {
      return { ok: true, source: 'keygen', licenseId, expiresAt, suspended }
    }

    return {
      ok: false,
      code: 'invalid_license_key',
      message: json?.meta?.detail ?? 'Invalid license key.',
    }
  } catch (e: any) {
    return { ok: false, code: 'validation_error', message: e?.message ?? 'License validation error.' }
  }
}

export async function POST(req: Request) {
  const ipHash = getIpHash(req)

  // Abuse prevention
  const rlIp = await rateLimit(`rl:entitlement_activate:ip:${ipHash}`, 60, 60 * 60)
  if (!rlIp.allowed) {
    return jsonError(429, 'rate_limited', 'Too many requests.', {
      headers: { 'Retry-After': String(Math.max(1, rlIp.reset_seconds ?? 60)) },
    })
  }

  const parsed = await readJsonBody<Partial<ActivateBody>>(req, 8 * 1024)
  if (!parsed.ok) {
    return jsonError(parsed.status, parsed.error, parsed.message)
  }

  const deviceId = normalizeDeviceId(parsed.data.device_id)
  const licenseKey = normalizeLicenseKey(parsed.data.license_key)
  const fingerprintRaw = parsed.data.fingerprint ?? parsed.data.device_id
  const fingerprint = normalizeDeviceId(fingerprintRaw) // reuse deviceId normalizer
  const appVersion = normalizeAppVersion(parsed.data.app_version)

  if (!deviceId || !licenseKey || !fingerprint) {
    return jsonError(
      400,
      'invalid_payload',
      'device_id, license_key, and fingerprint are required (8-128 chars).'
    )
  }

  const rlDevice = await rateLimit(`rl:entitlement_activate:device:${deviceId}`, 20, 60 * 60)
  if (!rlDevice.allowed) {
    return jsonError(429, 'rate_limited', 'Too many requests.', {
      headers: { 'Retry-After': String(Math.max(1, rlDevice.reset_seconds ?? 60)) },
    })
  }

  const now = new Date().toISOString()
  await upsertDeviceSeen(deviceId, now, appVersion)

  // ✅ validate + (if needed) activate machine for this fingerprint
  const validation = await validateLicenseKeyDetailed(licenseKey, fingerprint)
  if (!validation.ok) {
    return jsonError(403, validation.code, validation.message)
  }

  const keyHash = sha256Hex(licenseKey)
  const last4 = licenseKey.slice(-4)

  // If device previously activated with another key, remove it from the old license index
  const existingLic = await getLicense(deviceId)
  if (existingLic && existingLic.license_key_hash && existingLic.license_key_hash !== keyHash) {
    await removeDeviceFromLicenseKeyIndex(existingLic.license_key_hash, deviceId)
  }

  // Enforce max devices per license (server-side)
  const maxDevices = getMaxDevices()
  const idxExisting = await getLicenseKeyIndex(keyHash)
  const deviceIds = new Set(idxExisting?.device_ids ?? [])

  if (!deviceIds.has(deviceId) && deviceIds.size >= maxDevices) {
    return jsonError(409, 'license_device_limit', 'This license is already active on too many devices.')
  }

  deviceIds.add(deviceId)
  await putLicenseKeyIndex({
    license_key_hash: keyHash,
    device_ids: Array.from(deviceIds),
    updated_at: now,
  })

  // Store server-side revalidation schedule.
  const ttlSeconds = validation.source === 'keygen' ? 6 * 60 * 60 : 12 * 60 * 60
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
    source: validation.source,
    activated_at: existingLic?.activated_at ?? now,
    last_seen_at: now,
    app_version: appVersion,
  })

  // Touch trial record if it exists (analytics only, no enforcement).
  const trial = await getTrial(deviceId)
  if (trial) {
    await putTrial({ ...trial, last_seen_at: now, app_version: appVersion ?? trial.app_version })
  }

  // Return canonical entitlement status after activation.
  const status = await getEntitlementStatus(deviceId, { appVersion, forceValidate: false })

  return jsonOk({
    device_id: deviceId,
    activated: true,
    status,
  })
}