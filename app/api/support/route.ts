export const runtime = 'nodejs'

import { NextResponse } from 'next/server'

import { sendEmail } from '@/lib/email'
import { siteConfig } from '@/lib/site'
import { rateLimit } from '@/lib/rateLimit'
import { getIpHash, readJsonBody } from '@/lib/request'

type Payload = {
  email: string
  subject: string
  message: string
  name?: string
  topic?: string
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export async function POST(req: Request) {
  try {
    const ipHash = getIpHash(req)
    const rl = await rateLimit(`rl:support:${ipHash}`, 10, 60 * 60)
    if (!rl.allowed) {
      return NextResponse.json(
        { ok: false, error: 'rate_limited', message: 'Too many requests.' },
        { status: 429, headers: { 'Retry-After': String(Math.max(1, rl.reset_seconds ?? 60)) } }
      )
    }

    const parsed = await readJsonBody<Partial<Payload>>(req, 16 * 1024)
    if (!parsed.ok) {
      return NextResponse.json(
        { ok: false, error: parsed.error, message: parsed.message ?? 'Invalid request.' },
        { status: parsed.status }
      )
    }

    const name = String(parsed.data.name || '').trim()
    const email = String(parsed.data.email || '').trim()
    const topic = String(parsed.data.topic || 'support').trim()
    const subject = String(parsed.data.subject || '').trim()
    const message = String(parsed.data.message || '').trim()

    if (!email || !subject || !message) {
      return NextResponse.json(
        { ok: false, error: 'missing_fields', message: 'email, subject, and message are required.' },
        { status: 400 }
      )
    }
    if (!isEmail(email)) {
      return NextResponse.json(
        { ok: false, error: 'invalid_email', message: 'Invalid email address.' },
        { status: 400 }
      )
    }

    // Avoid logging PII-heavy content into provider logs.
    console.log('[support] request', {
      topic,
      subject_len: subject.length,
      message_len: message.length,
      has_name: Boolean(name),
    })

    await sendEmail({
      to: siteConfig.emails.support,
      subject: `[CutSwitch] ${topic.toUpperCase()}: ${subject}`,
      replyTo: email,
      html: `
        <div>
          <p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>
          <p><strong>Topic:</strong> ${escapeHtml(topic)}</p>
          <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
          <hr />
          <pre style="white-space:pre-wrap;font-family:ui-monospace,Menlo,monospace;">${escapeHtml(
            message
          )}</pre>
        </div>
      `,
      text: `From: ${name} <${email}>\nTopic: ${topic}\nSubject: ${subject}\n\n${message}`,
    })

    return NextResponse.json({
      ok: true,
      message: "Message received. We'll reply as soon as we can.",
    })
  } catch (err: any) {
    console.error('[support] error', err?.message || err)
    return NextResponse.json({ ok: false, error: 'server_error', message: 'Server error.' }, { status: 500 })
  }
}
