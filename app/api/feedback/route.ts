export const runtime = "nodejs";

import { z } from "zod";

import { getUserFromBearerToken } from "@/lib/auth";
import { emitLifecycleEvent } from "@/lib/lifecycle";
import { readJsonBody } from "@/lib/request";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const feedbackSchema = z.object({
  type: z.enum(["bug", "idea", "confusion", "praise", "pricing", "onboarding", "performance", "export", "account"]),
  message: z.string().trim().min(3).max(5000),
  screen: z.string().trim().max(120).optional().nullable(),
  context: z.record(z.unknown()).optional().default({}),
  severity: z.enum(["low", "normal", "high", "urgent"]).optional().default("normal"),
});

const NO_STORE = { "Cache-Control": "no-store" };

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: NO_STORE });
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

  const { type, message, screen, context, severity } = parsed.data;
  const { data, error } = await supabaseAdmin
    .from("feedback_events")
    .insert({
      user_id: user.id,
      type,
      message,
      screen: screen || null,
      context_json: context,
      severity,
      status: "new",
      source: "app",
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

  return json({ ok: true });
}
