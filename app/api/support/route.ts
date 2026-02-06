export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { z } from 'zod'

import { sendEmail } from '@/lib/email'
import { siteConfig } from '@/lib/site'
import { rateLimit } from '@/lib/rateLimit'
import { getIpHash } from '@/lib/request'

const MAX_REQUEST_BYTES = 28 * 1024 * 1024
const MAX_JSON_BYTES = 5 * 1024 * 1024
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_IMAGE_COUNT = 5
const MAX_TOTAL_ATTACHMENT_BYTES = 25 * 1024 * 1024

const TOPICS = new Set(['support', 'feedback', 'billing', 'affiliates'])

const SupportSchema = z.object({
  name: z.string().trim().max(160).optional(),
  email: z.string().trim().email().max(254),
  subject: z.string().trim().min(1).max(180),
  message: z.string().trim().min(1).max(4000),
  topic: z.string().trim().optional(),
})

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

function isFile(value: FormDataEntryValue | null): value is File {
  return Boolean(value) && typeof value === 'object' && 'arrayBuffer' in (value as File)
}

function normalizeFilename(input: string): string {
  const base = input.split(/[/\\]/).pop() || 'attachment'
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)
}

export async function POST(req: Request) {
  try {
    const contentLength = Number(req.headers.get('content-length') || 0)
    if (contentLength && contentLength > MAX_REQUEST_BYTES) {
      return NextResponse.json(
        { ok: false, error: 'payload_too_large', message: 'Payload too large.' },
        { status: 413 }
      )
    }

    const ipHash = getIpHash(req)
    const rl = await rateLimit(`rl:support:${ipHash}`, 5, 10 * 60)
    if (!rl.allowed) {
      return NextResponse.json(
        { ok: false, error: 'rate_limited', message: 'Too many requests.' },
        { status: 429, headers: { 'Retry-After': String(Math.max(1, rl.reset_seconds ?? 60)) } }
      )
    }

    const form = await req.formData()
    const raw = {
      name: String(form.get('name') || '').trim() || undefined,
      email: String(form.get('email') || '').trim(),
      subject: String(form.get('subject') || '').trim(),
      message: String(form.get('message') || '').trim(),
      topic: String(form.get('topic') || 'support').trim(),
    }

    const parsed = SupportSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'invalid_fields', message: 'Please complete the required fields.' },
        { status: 400 }
      )
    }

    const { name, email, subject, message } = parsed.data
    const topicRaw = (parsed.data.topic || 'support').toLowerCase()
    const topic = TOPICS.has(topicRaw) ? topicRaw : 'support'

    if (!isEmail(email)) {
      return NextResponse.json(
        { ok: false, error: 'invalid_email', message: 'Invalid email address.' },
        { status: 400 }
      )
    }

    const cutPlanValue = form.get('cutPlan')
    const cutPlanFile = isFile(cutPlanValue) && cutPlanValue.size > 0 ? cutPlanValue : null
    const screenshotValues = form.getAll('screenshots')
    const screenshotFiles = screenshotValues.filter(isFile).filter((file) => file.size > 0)

    if (cutPlanFile) {
      const isJson =
        cutPlanFile.type === 'application/json' || cutPlanFile.name.toLowerCase().endsWith('.json')
      if (!isJson) {
        return NextResponse.json(
          { ok: false, error: 'invalid_file', message: 'Cut Plan must be a JSON file.' },
          { status: 400 }
        )
      }
      if (cutPlanFile.size > MAX_JSON_BYTES) {
        return NextResponse.json(
          { ok: false, error: 'file_too_large', message: 'Cut Plan JSON must be 5 MB or less.' },
          { status: 400 }
        )
      }
    }

    if (screenshotFiles.length > MAX_IMAGE_COUNT) {
      return NextResponse.json(
        {
          ok: false,
          error: 'too_many_files',
          message: `Up to ${MAX_IMAGE_COUNT} screenshots are allowed.`,
        },
        { status: 400 }
      )
    }

    const allowedImageTypes = new Set(['image/png', 'image/jpeg', 'image/webp'])
    for (const file of screenshotFiles) {
      if (!allowedImageTypes.has(file.type)) {
        return NextResponse.json(
          { ok: false, error: 'invalid_file', message: 'Screenshots must be PNG, JPG, or WEBP.' },
          { status: 400 }
        )
      }
      if (file.size > MAX_IMAGE_BYTES) {
        return NextResponse.json(
          { ok: false, error: 'file_too_large', message: 'Each screenshot must be 5 MB or less.' },
          { status: 400 }
        )
      }
    }

    let totalAttachmentBytes = 0
    if (cutPlanFile) totalAttachmentBytes += cutPlanFile.size
    for (const file of screenshotFiles) totalAttachmentBytes += file.size
    if (totalAttachmentBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          error: 'attachments_too_large',
          message: 'Attachments are too large. Please reduce file sizes.',
        },
        { status: 400 }
      )
    }

    const attachments: Array<{
      filename: string
      content: string
      contentType?: string
      size: number
    }> = []
    if (cutPlanFile) {
      const buffer = Buffer.from(await cutPlanFile.arrayBuffer())
      attachments.push({
        filename: normalizeFilename(cutPlanFile.name || 'cut-plan.json'),
        content: buffer.toString('base64'),
        contentType: cutPlanFile.type || 'application/json',
        size: cutPlanFile.size,
      })
    }

    for (const file of screenshotFiles) {
      const buffer = Buffer.from(await file.arrayBuffer())
      attachments.push({
        filename: normalizeFilename(file.name || 'screenshot.png'),
        content: buffer.toString('base64'),
        contentType: file.type,
        size: file.size,
      })
    }

    // Avoid logging PII-heavy content into provider logs.
    console.log('[support] request', {
      topic,
      subject_len: subject.length,
      message_len: message.length,
      has_name: Boolean(name),
      attachment_count: attachments.length,
    })

    const attachmentList = attachments.length
      ? attachments
          .map((file) => `${file.filename} (${Math.round(file.size / 1024)} KB)`)
          .join(', ')
      : 'None'

    await sendEmail({
      to: siteConfig.emails.support,
      subject: `[CutSwitch] ${topic.toUpperCase()}: ${subject}`,
      replyTo: email,
      html: `
        <div>
          <p><strong>From:</strong> ${escapeHtml(name || 'Anonymous')} &lt;${escapeHtml(email)}&gt;</p>
          <p><strong>Topic:</strong> ${escapeHtml(topic)}</p>
          <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
          <p><strong>Attachments:</strong> ${escapeHtml(attachmentList)}</p>
          <hr />
          <pre style="white-space:pre-wrap;font-family:ui-monospace,Menlo,monospace;">${escapeHtml(
            message
          )}</pre>
        </div>
      `,
      text: `From: ${name || 'Anonymous'} <${email}>\nTopic: ${topic}\nSubject: ${subject}\nAttachments: ${attachmentList}\n\n${message}`,
      attachments: attachments.map(({ filename, content, contentType }) => ({
        filename,
        content,
        contentType,
      })),
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
