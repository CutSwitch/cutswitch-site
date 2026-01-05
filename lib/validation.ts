export type DurationBucket = '<30m' | '30-60m' | '60-120m' | '>120m'

const DEVICE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/
// Keygen keys are typically URL-safe-ish. Keep this permissive while still blocking garbage.
const LICENSE_KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{9,127}$/
const VERSION_RE = /^[A-Za-z0-9._-]{1,32}$/
const ERROR_CODE_RE = /^[A-Za-z0-9._-]{1,64}$/

export function normalizeDeviceId(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const v = input.trim()
  if (!DEVICE_ID_RE.test(v)) return null
  return v
}

export function normalizeLicenseKey(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const v = input.trim()
  if (!LICENSE_KEY_RE.test(v)) return null
  return v
}

export function normalizeAppVersion(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined
  const v = input.trim()
  if (!v) return undefined
  if (!VERSION_RE.test(v)) return undefined
  return v
}

export function normalizeEngineVersion(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined
  const v = input.trim()
  if (!v) return undefined
  if (!VERSION_RE.test(v)) return undefined
  return v
}

export function normalizeErrorCode(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined
  const v = input.trim()
  if (!v) return undefined
  if (!ERROR_CODE_RE.test(v)) return undefined
  return v
}

export function normalizeWarningsCount(input: unknown): number | undefined {
  if (input === null || input === undefined) return undefined
  if (typeof input !== 'number' || !Number.isFinite(input)) return undefined
  const n = Math.floor(input)
  if (n < 0 || n > 1000) return undefined
  return n
}

export function normalizeDurationBucket(input: unknown): DurationBucket | undefined {
  if (typeof input !== 'string') return undefined
  const v = input.trim() as DurationBucket
  if (v === '<30m' || v === '30-60m' || v === '60-120m' || v === '>120m') return v
  return undefined
}

export function parseBooleanParam(input: string | null): boolean {
  if (!input) return false
  const v = input.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}
