export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rateLimit } from "@/lib/rateLimit";
import { getIpHash } from "@/lib/request";

const UnsubscribeSchema = z.object({
  email: z.string().trim().email().max(254),
  reason: z.string().trim().max(160).optional(),
});

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(req: Request) {
  try {
    try {
      const ipHash = getIpHash(req);
      const rl = await rateLimit(`rl:unsubscribe:${ipHash}`, 20, 60 * 60);
      if (!rl.allowed) {
        return json({ ok: false, error: "rate_limited", message: "Too many requests." }, 429);
      }
    } catch {
      // KV may be unavailable in local/dev. Do not block unsubscribe for that.
    }

    const raw = await req.json().catch(() => null);
    const parsed = UnsubscribeSchema.safeParse(raw);
    if (!parsed.success) {
      return json({ ok: false, error: "invalid_email", message: "Enter a valid email address." }, 400);
    }

    const email = parsed.data.email.toLowerCase();
    const reason = parsed.data.reason || "unsubscribe";

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("email_suppressions")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existingError) {
      console.error("[unsubscribe] lookup failed", { code: existingError.code });
      return json({ ok: false, error: "server_error", message: "Unable to save preference." }, 500);
    }

    if (existing) {
      return json({ ok: true });
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    const { error } = await supabaseAdmin.from("email_suppressions").insert({
      email,
      user_id: user?.id || null,
      reason,
      source: "public_unsubscribe",
    });

    if (error) {
      console.error("[unsubscribe] insert failed", { code: error.code });
      return json({ ok: false, error: "server_error", message: "Unable to save preference." }, 500);
    }

    return json({ ok: true });
  } catch (err) {
    console.error("[unsubscribe] error", { message: err instanceof Error ? err.message : "unknown" });
    return json({ ok: false, error: "server_error", message: "Unable to save preference." }, 500);
  }
}
