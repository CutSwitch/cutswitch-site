import { NextResponse } from "next/server"

export const runtime = "nodejs"

type MachineItem = {
  id: string
  name: string | null
  fingerprint: string | null
  created_at: string | null
  last_seen: string | null
}

type MachinesResponse =
  | {
      ok: true
      machines_count: number
      max_machines: number | undefined
      machines: MachineItem[]
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
    name?: string | null
    fingerprint?: string | null
    created?: string | null
    created_at?: string | null
    createdAt?: string | null
    last_seen?: string | null
    last_seen_at?: string | null
    lastSeen?: string | null
    lastSeenAt?: string | null
    updated?: string | null
    updated_at?: string | null
    updatedAt?: string | null
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

function safeStr(v: unknown): string | null {
  if (typeof v !== "string") return null
  const s = v.trim()
  return s.length ? s : null
}

function pickIsoTimestamp(attrs: KeygenMachine["attributes"] | undefined, keys: string[]): string | null {
  if (!attrs) return null
  for (const k of keys) {
    const v = (attrs as any)[k]
    const s = safeStr(v)
    if (s) return s
  }
  return null
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

function toMachineItem(m: KeygenMachine): MachineItem {
  const attrs = m.attributes
  const created = pickIsoTimestamp(attrs, ["created_at", "createdAt", "created"]) ?? null
  const lastSeen =
    pickIsoTimestamp(attrs, ["last_seen", "last_seen_at", "lastSeen", "lastSeenAt"]) ??
    pickIsoTimestamp(attrs, ["updated_at", "updatedAt", "updated"]) ??
    null

  return {
    id: String(m.id),
    name: safeStr(attrs?.name) ?? null,
    fingerprint: safeStr(attrs?.fingerprint) ?? null,
    created_at: created,
    last_seen: lastSeen,
  }
}

export async function POST(req: Request) {
  let licenseKeyForRedaction = ""

  try {
    const account = env("KEYGEN_ACCOUNT_ID")
    const token = env("KEYGEN_API_TOKEN")

    const body = (await req.json().catch(() => ({}))) as { license_key?: unknown }
    const licenseKey = String(body.license_key ?? "").trim()
    licenseKeyForRedaction = licenseKey

    if (licenseKey.length === 0) {
      return NextResponse.json<MachinesResponse>({ ok: false, error: "Missing license_key" }, { status: 400 })
    }

    const [rawMachines, maxMachines] = await Promise.all([
      listMachinesByKey({ account, token, licenseKey }),
      getMaxMachinesBestEffort({ account, token, licenseKey }),
    ])

    const machines = rawMachines.map(toMachineItem)

    return NextResponse.json<MachinesResponse>({
      ok: true,
      machines_count: machines.length,
      max_machines: maxMachines,
      machines,
    })
  } catch (err: any) {
    const msg = redactLicenseKey(err?.message ?? "Unknown error", licenseKeyForRedaction)
    return NextResponse.json<MachinesResponse>({ ok: false, error: msg }, { status: 500 })
  }
}
