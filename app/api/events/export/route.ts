export const runtime = 'nodejs'

import { jsonError, jsonOk } from '@/lib/api'
import { rateLimit } from '@/lib/rateLimit'
import { getIpHash, readJsonBody } from '@/lib/request'
import { recordExportTelemetryEvent } from '@/lib/telemetry'
import {
  normalizeAppVersion,
  normalizeDeviceId,
  normalizeDurationBucket,
  normalizeEngineVersion,
  normalizeErrorCode,
  normalizeWarningsCount,
} from '@/lib/validation'

type ExportEventBody = {
  device_id: unknown
  app_version?: unknown
  engine_version?: unknown
  export_success: unknown
  warnings_count?: unknown
  error_code?: unknown
  duration_bucket?: unknown
}

export async function POST(req: Request) {
  const ipHash = getIpHash(req)

  // Soft telemetry, but still protect the endpoint from abuse.
  const rlIp = await rateLimit(`rl:telemetry_export:ip:${ipHash}`, 1000, 60 * 60)
  if (!rlIp.allowed) {
    return jsonError(429, 'rate_limited', 'Too many requests.', {
      headers: { 'Retry-After': String(Math.max(1, rlIp.reset_seconds ?? 60)) },
    })
  }

  const parsed = await readJsonBody<ExportEventBody>(req, 8 * 1024)
  if (!parsed.ok) {
    return jsonError(parsed.status, parsed.error, parsed.message)
  }

  const deviceId = normalizeDeviceId(parsed.data.device_id)
  if (!deviceId) {
    return jsonError(400, 'invalid_device_id', 'device_id is required and must be 8-128 URL-safe characters.')
  }

  const rlDevice = await rateLimit(`rl:telemetry_export:device:${deviceId}`, 240, 60 * 60)
  if (!rlDevice.allowed) {
    return jsonError(429, 'rate_limited', 'Too many requests.', {
      headers: { 'Retry-After': String(Math.max(1, rlDevice.reset_seconds ?? 60)) },
    })
  }

  if (typeof parsed.data.export_success !== 'boolean') {
    return jsonError(400, 'invalid_payload', 'export_success must be a boolean.')
  }

  const appVersion = normalizeAppVersion(parsed.data.app_version)
  const engineVersion = normalizeEngineVersion(parsed.data.engine_version)
  const warningsCount = normalizeWarningsCount(parsed.data.warnings_count)
  const errorCode = normalizeErrorCode(parsed.data.error_code)
  const durationBucket = normalizeDurationBucket(parsed.data.duration_bucket)

  const serverTime = new Date().toISOString()

  try {
    await recordExportTelemetryEvent({
      device_id: deviceId,
      app_version: appVersion,
      engine_version: engineVersion,
      server_time: serverTime,
      export_success: parsed.data.export_success,
      ...(warningsCount !== undefined ? { warnings_count: warningsCount } : {}),
      ...(errorCode ? { error_code: errorCode } : {}),
      ...(durationBucket ? { duration_bucket: durationBucket } : {}),
    })

    return jsonOk({ stored: true, server_time: serverTime })
  } catch {
    return jsonError(500, 'telemetry_store_error', 'Unable to store telemetry event.')
  }
}