export const runtime = 'nodejs'

import { NextResponse } from 'next/server'

import { stripe } from '@/lib/stripe'
import { sendEmail } from '@/lib/email'
import { getBaseUrl } from '@/lib/env'
import { siteConfig } from '@/lib/site'
import { rateLimit } from '@/lib/rateLimit'
import { getIpHash, readJsonBody } from '@/lib/request'

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function POST(req: Request) {
  try {
    const ipHash = getIpHash(req)
    const rl = await rateLimit(`rl:portal_link:${ipHash}`, 5, 60 * 60)
    if (!rl.allowed) {
      return NextResponse.json(
        { ok: false, error: 'rate_limited', message: 'Too many requests.' },
        { status: 429, headers: { 'Retry-After': String(Math.max(1, rl.reset_seconds ?? 60)) } }
      )
    }

    const parsed = await readJsonBody<{ email?: unknown }>(req, 2 * 1024)
    if (!parsed.ok) {
      return NextResponse.json(
        { ok: false, error: parsed.error, message: parsed.message ?? 'Invalid request.' },
        { status: parsed.status }
      )
    }

    const email = typeof parsed.data.email === 'string' ? parsed.data.email.trim().toLowerCase() : ''
    if (!isEmail(email)) {
      return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 })
    }

    const baseUrl = getBaseUrl()

    // Don't leak whether the email exists; always respond ok.
    const customers = await stripe.customers.list({ email, limit: 1 })
    const customer = customers.data[0]

    if (!customer) {
      return NextResponse.json({
        ok: true,
        message: "If an account exists for that email, you'll receive a secure link to manage your subscription.",
      })
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${baseUrl}/account`,
    })

    const html = `
      <div>
        <p>Here is your secure link to manage your CutSwitch subscription:</p>
        <p><a href="${portalSession.url}">${portalSession.url}</a></p>
        <p>If you did not request this, you can ignore this email.</p>
      </div>
    `

    await sendEmail({
      to: email,
      subject: 'Your CutSwitch manage link',
      html,
      text: `Manage your subscription: ${portalSession.url}`,
      replyTo: siteConfig.emails.support,
    })

    return NextResponse.json({
      ok: true,
      message: "If an account exists for that email, you'll receive a secure link to manage your subscription.",
    })
  } catch (err: any) {
    console.error('[send-portal-link] error', err?.message || err)
    // Still avoid leaking details.
    return NextResponse.json({
      ok: true,
      message: "If an account exists for that email, you'll receive a secure link to manage your subscription.",
    })
  }
}
