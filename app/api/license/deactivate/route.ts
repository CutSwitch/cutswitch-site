import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type DeactivateResponse = {
  ok: boolean
  deactivated?: boolean
  machines_count?: number
  max_machines?: number
  message?: string
  error?: string
}

type KeygenListResponse<T> = {
  data?: T[]
  links?: {
    next?: string | null
  }
}

type KeygenMachine = {
  id: string
  type: string
  attributes?: {
    fingerprint?: string
  }
}

type KeygenLicense = {
  id: string
  type: string
  attributes?: Record<string, unknown>
}

const KEYGEN_BASE = 'https://api.keygen.sh/v1'

function env(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

function keygenHeaders(token: string): HeadersInit {
  return {
    'Accept': 'application/vnd.api+json',
    'Content-Type': 'application/vnd.api+json',
    'Authorization': `Bearer ${token}`,
  }
}

async function listMachinesByKeyAndFingerprint(args: {
  account: string
  token: string
  licenseKey: string
  fingerprint: string
}): Promise<KeygenMachine[]> {
  const { account, token, licenseKey, fingerprint } = args

  const machines: KeygenMachine[] = []
  let nextUrl: string | null = `${KEYGEN_BASE}/accounts/${encodeURIComponent(account)}/machines?limit=100&key=${encodeURIComponent(licenseKey)}&fingerprint=${encodeURIComponent(fingerprint)}`

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      method: 'GET',
      headers: keygenHeaders(token),
      cache: 'no-store',
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Keygen list machines failed (${res.status}): ${text}`)
    }

    const json = (await res.json()) as KeygenListResponse<KeygenMachine>
    for (const m of json.data ?? []) {
      machines.push(m)
    }

    nextUrl = json.links?.next ?? null
  }

  return machines
}

async function listMachinesCountByKey(args: {
  account: string
  token: string
  licenseKey: string
}): Promise<number> {
  const { account, token, licenseKey } = args

  let count = 0
  let nextUrl: string | null = `${KEYGEN_BASE}/accounts/${encodeURIComponent(account)}/machines?limit=100&key=${encodeURIComponent(licenseKey)}`

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      method: 'GET',
      headers: keygenHeaders(token),
      cache: 'no-store',
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Keygen list machines failed (${res.status}): ${text}`)
    }

    const json = (await res.json()) as KeygenListResponse<KeygenMachine>
    count += (json.data ?? []).length
    nextUrl = json.links?.next ?? null
  }

  return count
}

async function getMaxMachinesBestEffort(args: {
  account: string
  token: string
  licenseKey: string
}): Promise<number | undefined> {
  const { account, token, licenseKey } = args

  const url = `${KEYGEN_BASE}/accounts/${encodeURIComponent(account)}/licenses?limit=1&key=${encodeURIComponent(licenseKey)}`

  const res = await fetch(url, {
    method: 'GET',
    headers: keygenHeaders(token),
    cache: 'no-store',
  })

  if (!res.ok) {
    return undefined
  }

  const json = (await res.json()) as KeygenListResponse<KeygenLicense>
  const lic = (json.data ?? [])[0]
  if (!lic?.attributes) return undefined

  const attrs = lic.attributes
  const candidates: unknown[] = [
    (attrs as any).maxMachines,
    (attrs as any).max_machines,
    (attrs as any).maxmachines,
  ]

  for (const c of candidates) {
    if (typeof c === 'number' && Number.isFinite(c)) {
      return c
    }
  }

  return undefined
}

async function deactivateMachineById(args: {
  account: string
  token: string
  machineId: string
}): Promise<void> {
  const { account, token, machineId } = args

  const url = `${KEYGEN_BASE}/accounts/${encodeURIComponent(account)}/machines/${encodeURIComponent(machineId)}`
  const res = await fetch(url, {
    method: 'DELETE',
    headers: keygenHeaders(token),
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Keygen deactivate failed (${res.status}): ${text}`)
  }
}

export async function POST(req: Request) {
  try {
    const account = env('KEYGEN_ACCOUNT_ID')
    const token = env('KEYGEN_API_TOKEN')

    const body = (await req.json().catch(() => ({}))) as {
      license_key?: string
      fingerprint?: string
      device_id?: string
    }

    const licenseKey = String(body.license_key ?? '').trim()
    const fingerprint = String(body.fingerprint ?? body.device_id ?? '').trim()

    if (licenseKey.length === 0) {
      return NextResponse.json<DeactivateResponse>({ ok: false, error: 'Missing license_key' }, { status: 400 })
    }

    if (fingerprint.length === 0) {
      return NextResponse.json<DeactivateResponse>({ ok: false, error: 'Missing fingerprint (or device_id)' }, { status: 400 })
    }

    // Find the machine for this license + fingerprint.
    const machines = await listMachinesByKeyAndFingerprint({
      account,
      token,
      licenseKey,
      fingerprint,
    })

    if (machines.length === 0) {
      const machinesCount = await listMachinesCountByKey({ account, token, licenseKey }).catch(() => undefined)
      const maxMachines = await getMaxMachinesBestEffort({ account, token, licenseKey })

      return NextResponse.json<DeactivateResponse>({
        ok: true,
        deactivated: false,
        message: 'This Mac is not activated for this license.',
        machines_count: machinesCount,
        max_machines: maxMachines,
      })
    }

    // Deactivate all matching machine records (normally 1).
    for (const m of machines) {
      await deactivateMachineById({ account, token, machineId: m.id })
    }

    const machinesCount = await listMachinesCountByKey({ account, token, licenseKey })
    const maxMachines = await getMaxMachinesBestEffort({ account, token, licenseKey })

    return NextResponse.json<DeactivateResponse>({
      ok: true,
      deactivated: true,
      machines_count: machinesCount,
      max_machines: maxMachines,
      message: 'Deactivated',
    })
  } catch (err: any) {
    return NextResponse.json<DeactivateResponse>({
      ok: false,
      error: err?.message ?? 'Unknown error',
    }, { status: 500 })
  }
}
