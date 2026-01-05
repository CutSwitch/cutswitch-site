import { kv } from '@vercel/kv'

import type { DurationBucket } from '@/lib/validation'

export type ExportTelemetryEvent = {
  device_id: string
  app_version?: string
  engine_version?: string
  server_time: string
  export_success: boolean
  warnings_count?: number
  error_code?: string
  duration_bucket?: DurationBucket
}

const RETENTION_SECONDS = 60 * 60 * 24 * 180 // 180d

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

export async function recordExportTelemetryEvent(event: ExportTelemetryEvent): Promise<void> {
  const day = dayKey(event.server_time)

  // Global counters (daily)
  const globalCount = `telemetry:export:count:${day}`
  const globalSuccess = `telemetry:export:success:${day}`
  const globalFail = `telemetry:export:fail:${day}`

  await kv.incr(globalCount)
  await kv.expire(globalCount, RETENTION_SECONDS)

  if (event.export_success) {
    await kv.incr(globalSuccess)
    await kv.expire(globalSuccess, RETENTION_SECONDS)
  } else {
    await kv.incr(globalFail)
    await kv.expire(globalFail, RETENTION_SECONDS)
  }

  // Per-device rolling counters
  const deviceBase = `telemetry:export:device:${event.device_id}`
  const deviceCount = `${deviceBase}:count`
  const deviceSuccess = `${deviceBase}:success`
  const deviceFail = `${deviceBase}:fail`
  const deviceLast = `${deviceBase}:last`

  await kv.incr(deviceCount)
  await kv.expire(deviceCount, RETENTION_SECONDS)

  if (event.export_success) {
    await kv.incr(deviceSuccess)
    await kv.expire(deviceSuccess, RETENTION_SECONDS)
  } else {
    await kv.incr(deviceFail)
    await kv.expire(deviceFail, RETENTION_SECONDS)
  }

  // Last event snapshot (minimal, no IP)
  await kv.set(deviceLast, JSON.stringify(event))
  await kv.expire(deviceLast, RETENTION_SECONDS)
}
