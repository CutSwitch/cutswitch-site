import { getPublicEnv } from "@/lib/env";

export type OutboundEmail = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: {
    filename: string;
    content: string;
    contentType?: string;
  }[];
};

export async function sendEmail(message: OutboundEmail): Promise<void> {
  const apiKey = getPublicEnv("RESEND_API_KEY");
  const from = getPublicEnv("RESEND_FROM") || "CutSwitch <support@cutswitch.com>";

  if (!apiKey) {
    // Safe fallback for local dev: don't throw, just log minimal info (no PII, no secrets).
    const toCount = Array.isArray(message.to) ? message.to.length : 1;
    console.log("[email:log-only]", { from, toCount, subject: message.subject });
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      reply_to: message.replyTo,
      attachments: message.attachments?.length
        ? message.attachments.map((attachment) => ({
            filename: attachment.filename,
            content: attachment.content,
            content_type: attachment.contentType,
          }))
        : undefined,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error (${res.status}): ${body}`);
  }
}
