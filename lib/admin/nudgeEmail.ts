import { getBaseUrl } from "@/lib/env";

export type NudgeEmailInput = {
  to: string;
  subject: string;
  message: string;
};

export type AdminEmailInput = NudgeEmailInput & {
  kind?: "nudge" | "campaign" | "test";
};

function getFromEmail() {
  const from = process.env.RESEND_FROM_EMAIL || process.env.RESEND_FROM;
  if (!from?.trim()) return null;
  // Allow either "Name <email@domain.com>" or bare email.
  const emailMatch = from.match(/<([^>]+)>/)?.[1] || from;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailMatch.trim())) return null;
  return from.trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function emailFooter() {
  const baseUrl = getBaseUrl();
  return {
    text: `\n\n---\nYou're receiving this because you use CutSwitch. Need help or want to opt out? Contact support: ${baseUrl}/support`,
    html: `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" /><p style="color:#6b7280;font-size:13px;line-height:20px">You're receiving this because you use CutSwitch. Need help or want to opt out? <a href="${baseUrl}/support">Contact support</a>.</p>`,
  };
}

function campaignFooter() {
  const baseUrl = getBaseUrl();
  return {
    text: `\n\n---\nYou're receiving this CutSwitch update because you use CutSwitch. Need help or want to opt out? Contact support: ${baseUrl}/support`,
    html: `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" /><p style="color:#6b7280;font-size:13px;line-height:20px">You're receiving this CutSwitch update because you use CutSwitch. Need help or want to opt out? <a href="${baseUrl}/support">Contact support</a>.</p>`,
  };
}

function markdownToHtml(value: string) {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\n/g, "<br />");
}

export async function sendAdminEmail(input: AdminEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey?.trim()) {
    return { ok: false as const, error: "Email sending is not configured." };
  }

  const from = getFromEmail();
  if (!from) {
    return { ok: false as const, error: "RESEND_FROM_EMAIL is missing or invalid." };
  }

  const footer = input.kind === "campaign" ? campaignFooter() : emailFooter();
  const text = `${input.message}${footer.text}`;
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;line-height:1.6;max-width:620px"><p>${markdownToHtml(input.message)}</p>${footer.html}</div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      text,
      html,
    }),
  });

  const body = (await res.json().catch(() => null)) as { id?: string; message?: string; name?: string } | null;
  if (!res.ok) {
    console.error("[admin:email] resend failed", { status: res.status, name: body?.name, message: body?.message, kind: input.kind || "nudge" });
    return { ok: false as const, error: "Resend email send failed." };
  }

  console.log("[admin:email] sent", { provider: "resend", idPresent: Boolean(body?.id), kind: input.kind || "nudge" });
  return { ok: true as const, providerId: body?.id || null };
}

export async function sendNudgeEmail(input: NudgeEmailInput) {
  return sendAdminEmail({ ...input, kind: "nudge" });
}

export async function sendCampaignEmail(input: NudgeEmailInput) {
  return sendAdminEmail({ ...input, kind: "campaign" });
}
