import { kv } from '@vercel/kv'

export type TrialRecord = {
  device_id: string
  trial_started_at: string // ISO timestamp
  trial_expires_at: string // ISO timestamp
  created_at: string // ISO timestamp
  last_seen_at: string // ISO timestamp
  app_version?: string
}

export type LicenseRecord = {
  device_id: string
  license_key_hash: string
  license_last4?: string
  license_expires_at?: string | null
  /** Keygen license resource id, if known (preferred for server-side revalidation). */
  keygen_license_id?: string
  /** Cached Keygen suspension state, refreshed periodically server-side. */
  license_suspended?: boolean
  /** Last time the server validated this license with Keygen/allowlist. */
  last_validated_at?: string | null
  /** Server-directed next time this license should be revalidated. */
  next_check_after?: string | null
  /** Where the server validated this license (keygen vs allowlist). */
  source?: 'keygen' | 'allowlist'
  activated_at: string // ISO timestamp
  last_seen_at: string // ISO timestamp
  app_version?: string
}

export type LicenseKeyIndex = {
  license_key_hash: string
  device_ids: string[]
  updated_at: string // ISO timestamp
}

export type DeviceRecord = {
  device_id: string
  created_at: string // ISO timestamp
  last_seen_at: string // ISO timestamp
  app_version?: string
}

const TRIAL_PREFIX = 'trial:'
const LICENSE_PREFIX = 'lic:'
const LICENSE_KEY_PREFIX = 'lickey:'
const DEVICE_PREFIX = 'device:'

export async function getTrial(deviceId: string): Promise<TrialRecord | null> {
  const key = `${TRIAL_PREFIX}${deviceId}`
  return (await kv.get<TrialRecord>(key)) ?? null
}

export async function putTrial(record: TrialRecord): Promise<void> {
  const key = `${TRIAL_PREFIX}${record.device_id}`
  await kv.set(key, record)
}

export async function getLicense(deviceId: string): Promise<LicenseRecord | null> {
  const key = `${LICENSE_PREFIX}${deviceId}`
  return (await kv.get<LicenseRecord>(key)) ?? null
}

export async function putLicense(record: LicenseRecord): Promise<void> {
  const key = `${LICENSE_PREFIX}${record.device_id}`
  await kv.set(key, record)
}

export async function getLicenseKeyIndex(keyHash: string): Promise<LicenseKeyIndex | null> {
  const key = `${LICENSE_KEY_PREFIX}${keyHash}`
  return (await kv.get<LicenseKeyIndex>(key)) ?? null
}

export async function putLicenseKeyIndex(record: LicenseKeyIndex): Promise<void> {
  const key = `${LICENSE_KEY_PREFIX}${record.license_key_hash}`
  await kv.set(key, record)
}

/**
 * Remove a device from a license's activation index (used when a device re-activates with a new license).
 *
 * This keeps our `LICENSE_MAX_DEVICES` enforcement from counting a single device against multiple licenses forever.
 */
export async function removeDeviceFromLicenseKeyIndex(keyHash: string, deviceId: string): Promise<void> {
  const idx = await getLicenseKeyIndex(keyHash)
  if (!idx) return

  const next = (idx.device_ids ?? []).filter((d) => d !== deviceId)
  if (next.length === idx.device_ids.length) return

  await putLicenseKeyIndex({
    license_key_hash: keyHash,
    device_ids: next,
    updated_at: new Date().toISOString(),
  })
}

export async function getDevice(deviceId: string): Promise<DeviceRecord | null> {
  const key = `${DEVICE_PREFIX}${deviceId}`
  return (await kv.get<DeviceRecord>(key)) ?? null
}

export async function upsertDeviceSeen(deviceId: string, nowIso: string, appVersion?: string): Promise<DeviceRecord> {
  const existing = await getDevice(deviceId)
  const next: DeviceRecord = existing
    ? { ...existing, last_seen_at: nowIso, app_version: appVersion ?? existing.app_version }
    : { device_id: deviceId, created_at: nowIso, last_seen_at: nowIso, app_version: appVersion }

  const key = `${DEVICE_PREFIX}${deviceId}`
  await kv.set(key, next)
  return next
}
