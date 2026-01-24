import { NextResponse } from "next/server"

export const runtime = "nodejs"

type DeactivateResponse =
  | {
      ok: true
      deactivated: boolean
      machines_count: number
      max_machines: number | undefined
      message?: string
    }
  | {
      ok: false
      error: string
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
    fingerprint?: string | null
  }
}

type KeygenLicense = {
  id: string
  type: string
  attributes?: Record<string, unknown>
}

const KEYGEN_BASE = "https://api.keygen.sh/v1"

function env(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

function keygenHeaders(token: string): HeadersInit {
  return {
    Accept: "application/vnd.api+json",
    "Content-Type": "application/vnd.api+json",
    Authorization: `Bearer ${token}`,
  }
}

function normalizeNextUrl(next: string | null | undefined): string | null {
  if (!next) return null
  const s = String(next).trim()
  if (s.length === 0) return null
  if (s.startsWith("http://") || s.startsWith("https://")) return s
  if (s.startsWith("/")) return `${KEYGEN_BASE}${s}`
  return `${KEYGEN_BASE}/${s}`
}

function redactLicenseKey(message: string, licenseKey: string): string {
  const m = String(message ?? "")
  const k = String(licenseKey ?? "").trim()
  if (!k) return m
  return m.split(k).join("[REDACTED]")
}

async function listMachinesByKey(args: {
  account: string
  token: string
  licenseKey: string
}): Promise<KeygenMachine[]> {
  const { account, token, licenseKey } = args

  const machines: KeygenMachine[] = []
  let nextUrl: string | null = `${KEYGEN_BASE}/accounts/${encodeURIComponent(account)}/machines?limit=100&key=${encodeURIComponent(licenseKey)}`

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      method: "GET",
      headers: keygenHeaders(token),
      cache: "no-store",
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`Keygen list machines failed (${res.status}): ${text}`)
    }

    const json = (await res.json()) as KeygenListResponse<KeygenMachine>
    for (const m of json.data ?? []) machines.push(m)
    nextUrl = normalizeNextUrl(json.links?.next)
  }

  return machines
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
      method: "GET",
      headers: keygenHeaders(token),
      cache: "no-store",
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`Keygen list machines failed (${res.status}): ${text}`)
    }

    const json = (await res.json()) as KeygenListResponse<KeygenMachine>
    for (const m of json.data ?? []) machines.push(m)
    nextUrl = normalizeNextUrl(json.links?.next)
  }

  return machines
}

async function getMaxMachinesBestEffort(args: {
  account: string
  token: string
  licenseKey: string
}): Promise<number | undefined> {
  const { account, token, licenseKey } = args

  const url = `${KEYGEN_BASE}/accounts/${encodeURIComponent(account)}/licenses?limit=1&key=${encodeURIComponent(licenseKey)}`
  const res = await fetch(url, {
    method: "GET",
    headers: keygenHeaders(token),
    cache: "no-store",
  })

  if (!res.ok) return undefined

  const json = (await res.json()) as KeygenListResponse<KeygenLicense>
  const lic = (json.data ?? [])[0]
  if (!lic?.attributes) return undefined

  const attrs = lic.attributes as any
  const candidates: unknown[] = [
    attrs.maxMachines,
    attrs.max_machines,
    attrs.maxmachines,
    attrs.policy?.maxMachines,
    attrs.policy?.max_machines,
  ]
  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c)) return c
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
    method: "DELETE",
    headers: keygenHeaders(token),
    cache: "no-store",
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Keygen deactivate failed (${res.status}): ${text}`)
  }
}

export async function POST(req: Request) {
  let licenseKeyForRedaction = ""

  try {
    const account = env("KEYGEN_ACCOUNT_ID")
    const token = env("KEYGEN_API_TOKEN")

    const body = (await req.json().catch(() => ({}))) as {
      license_key?: unknown
      fingerprint?: unknown
      device_id?: unknown
      machine_id?: unknown
    }

    const licenseKey = String(body.license_key ?? "").trim()
    licenseKeyForRedaction = licenseKey

    const machineId = String(body.machine_id ?? "").trim()
    const fingerprint = String(body.fingerprint ?? body.device_id ?? "").trim()

    if (licenseKey.length === 0) {
      return NextResponse.json<DeactivateResponse>({ ok: false, error: "Missing license_key" }, { status: 400 })
    }

    if (machineId.length === 0 && fingerprint.length === 0) {
      return NextResponse.json<DeactivateResponse>(
        { ok: false, error: "Missing machine_id or fingerprint (or device_id)" },
        { status: 400 }
      )
    }

    if (machineId.length > 0) {
      const machinesForLicense = await listMachinesByKey({ account, token, licenseKey })
      const match = machinesForLicense.find((m) => String(m.id) === machineId)

      if (!match) {
        const [machinesCount, maxMachines] = await Promise.all([
          Promise.resolve(machinesForLicense.length),
          getMaxMachinesBestEffort({ account, token, licenseKey }),
        ])

        return NextResponse.json<DeactivateResponse>({
          ok: true,
          deactivated: false,
          machines_count: machinesCount,
          max_machines: maxMachines,
          message: "Machine not found for this license.",
        })
      }

      await deactivateMachineById({ account, token, machineId })

      const [machinesAfter, maxMachines] = await Promise.all([
        listMachinesByKey({ account, token, licenseKey }),
        getMaxMachinesBestEffort({ account, token, licenseKey }),
      ])

      return NextResponse.json<DeactivateResponse>({
        ok: true,
        deactivated: true,
        machines_count: machinesAfter.length,
        max_machines: maxMachines,
        message: "Deactivated",
      })
    }

    const machines = await listMachinesByKeyAndFingerprint({ account, token, licenseKey, fingerprint })

    if (machines.length === 0) {
      const [machinesAll, maxMachines] = await Promise.all([
        listMachinesByKey({ account, token, licenseKey }).catch(() => [] as KeygenMachine[]),
        getMaxMachinesBestEffort({ account, token, licenseKey }),
      ])

      return NextResponse.json<DeactivateResponse>({
        ok: true,
        deactivated: false,
        machines_count: machinesAll.length,
        max_machines: maxMachines,
        message: "This Mac is not activated for this license.",
      })
    }

    for (const m of machines) {
      await deactivateMachineById({ account, token, machineId: m.id })
    }

    const [machinesAfter, maxMachines] = await Promise.all([
      listMachinesByKey({ account, token, licenseKey }),
      getMaxMachinesBestEffort({ account, token, licenseKey }),
    ])

    return NextResponse.json<DeactivateResponse>({
      ok: true,
      deactivated: true,
      machines_count: machinesAfter.length,
      max_machines: maxMachines,
      message: "Deactivated",
    })
  } catch (err: any) {
    const msg = redactLicenseKey(err?.message ?? "Unknown error", licenseKeyForRedaction)
    return NextResponse.json<DeactivateResponse>({ ok: false, error: msg }, { status: 500 })
  }
}
