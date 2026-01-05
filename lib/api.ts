import { NextResponse } from 'next/server'

export type ApiErrorResponse = {
  ok: false
  error: string
  message?: string
}

export function jsonOk<T extends Record<string, unknown>>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, ...data }, init)
}

export function jsonError(status: number, error: string, message?: string, init?: ResponseInit) {
  const body: ApiErrorResponse = { ok: false, error, ...(message ? { message } : {}) }
  return NextResponse.json(body, { status, ...(init ?? {}) })
}
