import crypto from 'crypto'

import { retrieveLicense } from '@/lib/keygen'
import { getLicense, getTrial, putLicense, putTrial, upsertDeviceSeen } from '@/lib/kv'
import { signEntitlementToken } from '@/lib/signing'

export type LicenseState =
  | 'none'
  | 'active'
  | 'inactive'
  | 'expired'
  | 'suspended'
  | 'revoked'
  | 'unknown'
export type TrialState = 'none' | 'active' | 'expired'
export type EntitlementState = 'licensed' | 'trial' | 'inactive' | 'revoked'

export type LicenseSource = 'keygen' | 'allowlist' | 'unknown'
export type ValidationState = 'fresh' | 'stale' | 'unverified'

export type EntitlementStatusResponse = {
  ok: true
  device_id: string
  server_time: string
  entitlement: {
    state: EntitlementState
    can_export: boolean
    reason: string
  }
  trial: {
    state: TrialState
    started_at: string | null
    expires_at: string | null
    remaining_seconds: number | null
  }
  license: {
    state: LicenseState
    key_last4: string | null
    expires_at: string | null
    keygen_license_id: string | null
    source: LicenseSource
  }
  validation: {
    state: ValidationState
    last_validated_at: string | null
    next_check_after: string
    ttl_seconds: number
    error?: { code: string; message: string }
  }
  token?: string
  token_expires_at?: string
}

// Server-authored policy.
const TTL_ACTIVE_LICENSE_SECONDS = 6 * 60 * 60 // 6h
const TTL_INACTIVE_SECONDS = 12 * 60 * 60 // 12h
const TTL_TRIAL_SECONDS = 60 * 60 // 1h
const TTL_SUSPENDED_SECONDS = 24 * 60 * 60 // 24h
const STALE_GRACE_SECONDS = 24 * 60 * 60 // 24h
const VALIDATION_ERROR_BACKOFF_SECONDS = 15 * 60 // 15m

function nowIso(): string {
  return new Date().toISOString()
}

function parseIsoToMs(iso: string | null | undefined): number | null {
  if (!iso) return null
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : null
}

function msToIso(ms: number): string {
  return new Date(ms).toISOString()
}

function remainingSeconds(nowMs: number, expiresAtIso: string | null): number | null {
  if (!expiresAtIso) return null
  const expiresMs = parseIsoToMs(expiresAtIso)
  if (!expiresMs) return null
  const diff = Math.floor((expiresMs - nowMs) / 1000)
  return diff > 0 ? diff : 0
}

function clampTtlSeconds(ttlSeconds: number): number {
  const ttl = Math.floor(ttlSeconds)
  if (!Number.isFinite(ttl)) return 60
  return Math.max(30, Math.min(ttl, 7 * 24 * 60 * 60))
}

function computeNextCheckAfter(nowMs: number, ttlSeconds: number): { nextCheckAfter: string; ttlSeconds: number } {
  const ttl = clampTtlSeconds(ttlSeconds)
  return { nextCheckAfter: new Date(nowMs + ttl * 1000).toISOString(), ttlSeconds: ttl }
}

function isWithinGrace(nowMs: number, lastValidatedAt: string | null): boolean {
  if (!lastValidatedAt) return false
  const ms = parseIsoToMs(lastValidatedAt)
  if (!ms) return false
  return nowMs - ms <= STALE_GRACE_SECONDS * 1000
}

export type EntitlementStatusOptions = {
  appVersion?: string
  forceValidate?: boolean
}

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

function keygenConfigured(): boolean {
  // lib/keygen.ts requires KEYGEN_POLICY_ID even for retrieval, so treat it as required.
  return (
    Boolean(process.env.KEYGEN_ACCOUNT_ID) &&
    Boolean(process.env.KEYGEN_POLICY_ID) &&
    Boolean(process.env.KEYGEN_API_TOKEN || process.env.KEYGEN_API_KEY)
  )
}

export async function getEntitlementStatus(
  deviceId: string,
  opts: EntitlementStatusOptions = {}
): Promise<EntitlementStatusResponse> {
  const now = nowIso()
  const nowMs = Date.parse(now)

  // Best-effort device heartbeat.
  try {
    await upsertDeviceSeen(deviceId, now, opts.appVersion)
  } catch {
    // ignore
  }

  const trial = await getTrial(deviceId)
  const lic = await getLicense(deviceId)

  // ----- Trial state -----
  let trialState: TrialState = 'none'
  let trialStartedAt: string | null = null
  let trialExpiresAt: string | null = null

  if (trial) {
    trialStartedAt = trial.trial_started_at
    trialExpiresAt = trial.trial_expires_at
    const expMs = parseIsoToMs(trialExpiresAt)
    trialState = expMs && expMs > nowMs ? 'active' : 'expired'

    // keep last_seen fresh
    await putTrial({ ...trial, last_seen_at: now, app_version: opts.appVersion ?? trial.app_version })
  }

  // ----- License state -----
  let licenseState: LicenseState = 'none'
  let licenseSource: LicenseSource = 'unknown'
  let licenseLast4: string | null = lic?.license_last4 ?? null
  let licenseExpiresAt: string | null = (lic?.license_expires_at ?? null) as string | null
  let keygenLicenseId: string | null = lic?.keygen_license_id ?? null

  let validationState: ValidationState = 'unverified'
  let lastValidatedAt: string | null = lic?.last_validated_at ?? null
  let validationError: { code: string; message: string } | undefined
  let nextCheckAfterIso: string | null = lic?.next_check_after ?? null
  const canUseKeygen = keygenConfigured()

  if (lic) {
    // Always keep last_seen fresh
    await putLicense({ ...lic, last_seen_at: now, app_version: opts.appVersion ?? lic.app_version })

    // Production: rely on Keygen only. If a legacy allowlist record is encountered,
    // treat it as Keygen-backed (or unknown if Keygen isn't configured).
    if (lic.source === 'allowlist') {
      licenseSource = canUseKeygen ? 'keygen' : 'unknown'
    } else {
      licenseSource = lic.source ?? (canUseKeygen ? 'keygen' : 'unknown')
    }

    // Determine whether we should validate now (or respect next_check_after)
    const cachedNextMs = nextCheckAfterIso ? parseIsoToMs(nextCheckAfterIso) : null
    const shouldValidateNow = Boolean(opts.forceValidate) || !cachedNextMs || nowMs >= cachedNextMs

    // 1) Keygen revalidation path (requires stored license id)
    if (canUseKeygen && keygenLicenseId && shouldValidateNow) {
      try {
        const data = await retrieveLicense(keygenLicenseId)
        const suspended = Boolean(data.attributes?.suspended)
        const expiry = data.attributes?.expiry ?? null

        if (suspended) {
          licenseState = 'suspended'
        } else if (expiry) {
          const expiryMs = parseIsoToMs(expiry)
          licenseState = expiryMs && expiryMs <= nowMs ? 'expired' : 'active'
        } else {
          licenseState = 'active'
        }

        const ttl = licenseState === 'active' ? TTL_ACTIVE_LICENSE_SECONDS : TTL_INACTIVE_SECONDS
        const nc = computeNextCheckAfter(nowMs, licenseState === 'suspended' ? TTL_SUSPENDED_SECONDS : ttl)
        nextCheckAfterIso = nc.nextCheckAfter

        await putLicense({
          ...lic,
          keygen_license_id: data.id,
          license_suspended: suspended,
          license_expires_at: expiry,
          last_seen_at: now,
          last_validated_at: now,
          next_check_after: nc.nextCheckAfter,
          source: 'keygen',
          app_version: opts.appVersion ?? lic.app_version,
        })

        lastValidatedAt = now
        licenseExpiresAt = expiry
        keygenLicenseId = data.id
        validationState = 'fresh'
      } catch {
        validationError = {
          code: 'keygen_unavailable',
          message: 'Unable to validate license with Keygen.',
        }
        const backoff = computeNextCheckAfter(nowMs, VALIDATION_ERROR_BACKOFF_SECONDS)
        nextCheckAfterIso = backoff.nextCheckAfter
        await putLicense({
          ...lic,
          next_check_after: backoff.nextCheckAfter,
          last_seen_at: now,
          app_version: opts.appVersion ?? lic.app_version,
        })

        // Derive from cached fields only if within grace.
        const cachedSuspended = Boolean(lic.license_suspended)
        if (cachedSuspended) {
          licenseState = 'suspended'
        } else if (licenseExpiresAt) {
          const expMs = parseIsoToMs(licenseExpiresAt)
          licenseState = expMs && expMs <= nowMs ? 'expired' : 'active'
        } else {
          licenseState = 'active'
        }

        validationState = isWithinGrace(nowMs, lastValidatedAt) && licenseState === 'active' ? 'stale' : 'unverified'
        if (validationState === 'unverified') {
          licenseState = 'unknown'
        }
      }
    }

    // 2) Allowlist entitlement is disabled (Option B). Legacy allowlist records are
    // treated as Keygen-backed when possible; no special revoked handling here.

    // 3) If Keygen is configured but we cannot validate (missing id), do NOT grant permanent active.
    if (licenseState === 'none' && canUseKeygen && !keygenLicenseId) {
      licenseSource = 'keygen'
      licenseState = 'unknown'
      validationState = 'unverified'

      // Encourage frequent re-check (client may prompt re-activation).
      const nc = computeNextCheckAfter(nowMs, VALIDATION_ERROR_BACKOFF_SECONDS)
      nextCheckAfterIso = nc.nextCheckAfter
      await putLicense({
        ...lic,
        next_check_after: nc.nextCheckAfter,
        last_seen_at: now,
        app_version: opts.appVersion ?? lic.app_version,
      })

      validationError = {
        code: 'license_unverified',
        message: 'License requires re-activation to enable server-side validation.',
      }
    }

    // 4) If we didn't validate now (not due), use cached fields.
    if (licenseState === 'none') {
      const suspended = Boolean(lic.license_suspended)
      if (suspended) {
        licenseState = 'suspended'
      } else if (licenseExpiresAt) {
        const expMs = parseIsoToMs(licenseExpiresAt)
        licenseState = expMs && expMs <= nowMs ? 'expired' : 'active'
      } else {
        // Without expiry, treat as active but require validation cadence.
        licenseState = 'active'
      }

      validationState = lic.last_validated_at ? 'fresh' : 'unverified'
    }
  }

  // If we had a validation failure but have recent last validation, allow stale active.
  if (licenseState === 'unknown' && isWithinGrace(nowMs, lastValidatedAt)) {
    licenseState = 'active'
    validationState = 'stale'
    if (!validationError) {
      validationError = { code: 'stale_cache', message: 'Using cached license state due to validation failure.' }
    }
  }

  // ----- Entitlement reconciliation -----
  let entitlementState: EntitlementState = 'inactive'
  let canExport = false
  let reason = 'no_entitlement'

	// Keygen-only: we rely on Keygen policy enforcement.
	// Treat suspended as revoked for entitlement purposes.
	if (licenseState === 'suspended') {
		entitlementState = 'revoked'
		canExport = false
		reason = 'license_revoked'
	} else if (licenseState === 'active') {
    entitlementState = 'licensed'
    canExport = true
    reason = validationState === 'stale' ? 'license_active_stale' : 'license_active'
  } else if (trialState === 'active') {
    entitlementState = 'trial'
    canExport = true
    reason = 'trial_active'
  } else {
    entitlementState = 'inactive'
    canExport = false
    if (trialState === 'expired') reason = 'trial_expired'
    else if (licenseState === 'expired') reason = 'license_expired'
    else if (licenseState === 'unknown') reason = 'license_unverified'
  }

  // TTL policy
  let ttlSeconds = TTL_INACTIVE_SECONDS
  if (entitlementState === 'licensed') ttlSeconds = TTL_ACTIVE_LICENSE_SECONDS
  else if (entitlementState === 'trial') ttlSeconds = TTL_TRIAL_SECONDS
  else if (entitlementState === 'revoked') ttlSeconds = TTL_SUSPENDED_SECONDS

  // If trial is active, never suggest a next check after the trial expiry.
  if (trialState === 'active' && trialExpiresAt) {
    const expMs = parseIsoToMs(trialExpiresAt)
    if (expMs) {
      const secondsToExpiry = Math.floor((expMs - nowMs) / 1000)
      ttlSeconds = Math.min(ttlSeconds, Math.max(30, secondsToExpiry))
    }
  }

  const policyNc = computeNextCheckAfter(nowMs, ttlSeconds)

  // Choose the earlier between cached next_check_after and policy next_check_after,
  // so polling doesn't push the validation window forever.
  const cachedMs = nextCheckAfterIso ? parseIsoToMs(nextCheckAfterIso) : null
  const policyMs = parseIsoToMs(policyNc.nextCheckAfter)
  let nextCheckAfter = policyNc.nextCheckAfter
  let ttlSecondsFinal = policyNc.ttlSeconds

  if (cachedMs && policyMs) {
    const finalMs = Math.min(cachedMs, policyMs)
    nextCheckAfter = msToIso(finalMs)
    ttlSecondsFinal = Math.max(0, Math.floor((finalMs - nowMs) / 1000))
  } else if (cachedMs) {
    nextCheckAfter = nextCheckAfterIso as string
    ttlSecondsFinal = Math.max(0, Math.floor((cachedMs - nowMs) / 1000))
  }

  // Signed token for clients to cache (server is still authoritative).
  const tokenTtlSeconds = Math.max(60, Math.min(6 * 60 * 60, ttlSecondsFinal))
  const tokenInfo = signEntitlementToken(
    {
      device_id: deviceId,
      entitlement: entitlementState,
      can_export: canExport,
      next_check_after: nextCheckAfter,
    },
    tokenTtlSeconds
  )

  const lastValidated = lic ? lastValidatedAt : now

  return {
    ok: true,
    device_id: deviceId,
    server_time: now,
    entitlement: { state: entitlementState, can_export: canExport, reason },
    trial: {
      state: trialState,
      started_at: trialStartedAt,
      expires_at: trialExpiresAt,
      remaining_seconds: trialState === 'active' ? remainingSeconds(nowMs, trialExpiresAt) : null,
    },
    license: {
      state: lic ? licenseState : 'none',
      key_last4: licenseLast4,
      expires_at: licenseExpiresAt,
      keygen_license_id: keygenLicenseId,
      source: lic ? licenseSource : 'unknown',
    },
    validation: {
      state: lic ? validationState : 'fresh',
      last_validated_at: lastValidated,
      next_check_after: nextCheckAfter,
      ttl_seconds: ttlSecondsFinal,
      ...(validationError ? { error: validationError } : {}),
    },
    ...(tokenInfo ? { token: tokenInfo.token, token_expires_at: tokenInfo.token_expires_at } : {}),
  }
}
