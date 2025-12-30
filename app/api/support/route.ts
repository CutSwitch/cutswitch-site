import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { siteConfig } from "@/lib/site";

export const runtime = "nodejs";

type Payload = {
  name: string;
  email: string;
  topic: string;
  subject: string;
  message: string;
};

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<Payload>;

    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const topic = String(body.topic || "support").trim();
    const subject = String(body.subject || "").trim();
    const message = String(body.message || "").trim();

    if (!name || !email || !subject || !message) {
      return NextResponse.json({ ok: false, error: "Missing required fields." }, { status: 400 });
    }
    if (!isEmail(email)) {
      return NextResponse.json({ ok: false, error: "Invalid email address." }, { status: 400 });
    }

    console.log("[support]", { name, email, topic, subject, message });

    // TODO: Integrate a real provider (Resend/Postmark). Resend is supported via RESEND_API_KEY.
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
          <pre style="white-space:pre-wrap;font-family:ui-monospace,Menlo,monospace;">${escapeHtml(message)}</pre>
        </div>
      `,
      text: `From: ${name} <${email}>\nTopic: ${topic}\nSubject: ${subject}\n\n${message}`,
    });

    return NextResponse.json({
      ok: true,
      message: "Message received. We'll reply as soon as we can.",
    });
  } catch (err: any) {
    console.error("support error", err);
    return NextResponse.json({ ok: false, error: "Server error." }, { status: 500 });
  }
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
