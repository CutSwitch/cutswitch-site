export const runtime = "nodejs";

import { z } from "zod";

import { getUserFromBearerToken } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { getBaseUrl } from "@/lib/env";
import { emitLifecycleEvent } from "@/lib/lifecycle";
import { rateLimit } from "@/lib/rateLimit";
import { readJsonBody } from "@/lib/request";
import { siteConfig } from "@/lib/site";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const feedbackSchema = z.object({
  type: z.enum(["bug", "idea", "confusion", "praise", "pricing", "onboarding", "performance", "export", "account"]),
  title: z.string().trim().max(180).optional().nullable(),
  message: z.string().trim().min(3).max(5000),
  screen: z.string().trim().max(120).optional().nullable(),
  current_page: z.string().trim().max(240).optional().nullable(),
  app_area: z.string().trim().max(120).optional().nullable(),
  context: z.record(z.unknown()).optional().default({}),
  severity: z.enum(["low", "normal", "high", "urgent"]).optional().default("normal"),
});

const NO_STORE = { "Cache-Control": "no-store" };

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: NO_STORE });
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sanitizeContext(value: Record<string, unknown>) {
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (/token|secret|password|path|filename|file_name|fcpxml|transcript|audio|provider/i.test(key)) {
      output[key] = "[redacted]";
    } else if (typeof entry === "string") {
      output[key] = entry.slice(0, 500);
    } else if (entry === null || typeof entry === "number" || typeof entry === "boolean") {
      output[key] = entry;
    }
  }
  return output;
}

async function maybeRateLimitFeedback(userId: string) {
  try {
    const rl = await rateLimit(`rl:feedback:${userId}`, 10, 60 * 60);
    return rl.allowed;
  } catch (error) {
    console.warn("[feedback] rate limit unavailable", { message: error instanceof Error ? error.message : "unknown" });
    return true;
  }
}

async function notifyFeedbackInbox(input: {
  id: string;
  userEmail: string | null;
  title: string;
  message: string;
  submittedAt: string;
}) {
  const adminUrl = `${getBaseUrl()}/admin/feedback?q=${encodeURIComponent(input.id)}`;
  const email = input.userEmail || "Unknown user";

  try {
    await sendEmail({
      to: siteConfig.emails.feedback,
      replyTo: input.userEmail || undefined,
      subject: `New CutSwitch feedback: ${input.title}`,
      html: `
        <div>
          <p><strong>User:</strong> ${escapeHtml(email)}</p>
          <p><strong>Title:</strong> ${escapeHtml(input.title)}</p>
          <p><strong>Submitted:</strong> ${escapeHtml(input.submittedAt)}</p>
          <p><strong>Admin:</strong> <a href="${escapeHtml(adminUrl)}">${escapeHtml(adminUrl)}</a></p>
          <hr />
          <pre style="white-space:pre-wrap;font-family:ui-monospace,Menlo,monospace;">${escapeHtml(input.message)}</pre>
        </div>
      `,
      text: `User: ${email}\nTitle: ${input.title}\nSubmitted: ${input.submittedAt}\nAdmin: ${adminUrl}\n\n${input.message}`,
    });
  } catch (error) {
    console.error("[feedback] notification failed", { message: error instanceof Error ? error.message : "unknown" });
  }
}

export async function POST(req: Request) {
  const { user, error: authError } = await getUserFromBearerToken(req);

  if (authError === "missing_token") {
    return json({ error: "Missing Authorization bearer token" }, 401);
  }

  if (authError || !user) {
    return json({ error: "Invalid or expired token" }, 401);
  }

  const parsedBody = await readJsonBody(req, 16 * 1024);
  if (!parsedBody.ok) {
    return json({ error: parsedBody.message || "Invalid request." }, parsedBody.status);
  }

  const parsed = feedbackSchema.safeParse(parsedBody.data);
  if (!parsed.success) {
    return json({ error: "Invalid feedback payload." }, 400);
  }

  const rateLimitAllowed = await maybeRateLimitFeedback(user.id);
  if (!rateLimitAllowed) {
    return json({ error: "Too many feedback submissions. Please try again later." }, 429);
  }

  const { type, message, screen, context, severity } = parsed.data;
  const title = (parsed.data.title || "").trim() || message.split("\n").find(Boolean)?.slice(0, 120) || "Untitled feedback";
  const currentPage = parsed.data.current_page || (typeof context.page === "string" ? context.page.slice(0, 240) : null);
  const appArea = parsed.data.app_area || screen || null;
  const createdAt = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("feedback_events")
    .insert({
      user_id: user.id,
      user_email: user.email || null,
      type,
      title,
      message,
      screen: screen || null,
      current_page: currentPage,
      app_area: appArea,
      context_json: sanitizeContext(context),
      severity,
      status: "new",
      source: currentPage ? "website" : "app",
      created_at: createdAt,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    console.error("[feedback] insert failed", { code: error.code, message: error.message });
    return json({ error: "Unable to record feedback." }, 500);
  }

  if (type === "praise") {
    await emitLifecycleEvent({
      user,
      eventName: "feedback_praise_received",
      properties: {
        feedback_id: data.id,
        screen: screen || null,
        severity,
      },
      dedupeKey: `feedback_praise_received:${data.id}`,
    });
  }

  await notifyFeedbackInbox({
    id: data.id,
    userEmail: user.email || null,
    title,
    message,
    submittedAt: createdAt,
  });

  return json({ ok: true });
}
