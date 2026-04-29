export const runtime = "nodejs";

import { z } from "zod";

import { getUserFromBearerToken } from "@/lib/auth";
import { emitLifecycleEvent } from "@/lib/lifecycle";
import { PRODUCT_EVENT_TYPES } from "@/lib/productEvents";
import { readJsonBody } from "@/lib/request";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const eventSchema = z.object({
  event_type: z.enum(PRODUCT_EVENT_TYPES),
  screen: z.string().trim().max(120).optional().nullable(),
  app_version: z.string().trim().max(80).optional().nullable(),
  project_fingerprint: z.string().trim().min(1).max(512).optional().nullable(),
  source_duration_seconds: z.number().int().min(0).max(24 * 60 * 60).optional().nullable(),
  metadata_json: z.record(z.unknown()).optional().default({}),
});

const SENSITIVE_KEY = /token|secret|password|path|filepath|file_path|filename|file_name|fcpxml|transcript|audio|provider/i;
const RAW_PATH_VALUE = /(^|[\s"'])(~\/|\/Users\/|[A-Za-z]:\\|file:\/\/|.*\\.*|.*\/.*)/;
const NO_STORE = { "Cache-Control": "no-store" };

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: NO_STORE });
}

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function looksLikeRawPath(value: string) {
  return RAW_PATH_VALUE.test(value) || /\.fcpxml\b/i.test(value);
}

function sanitizeMetadata(value: unknown, depth = 0): unknown {
  if (depth > 3) return null;
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (looksLikeRawPath(value)) return "[redacted]";
    return value.slice(0, 500);
  }
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeMetadata(item, depth + 1));
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>).slice(0, 50)) {
      const safeKey = key.slice(0, 80);
      output[safeKey] = SENSITIVE_KEY.test(key) ? "[redacted]" : sanitizeMetadata(entry, depth + 1);
    }
    return output;
  }
  return null;
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

  const parsed = eventSchema.safeParse(parsedBody.data);
  if (!parsed.success) {
    return json({ error: "Invalid product event payload." }, 400);
  }

  const payload = parsed.data;
  const projectFingerprint = normalizeText(payload.project_fingerprint);
  if (projectFingerprint && looksLikeRawPath(projectFingerprint)) {
    return json({ error: "project_fingerprint must be a privacy-safe fingerprint." }, 400);
  }

  const metadata = sanitizeMetadata(payload.metadata_json || {}) as Record<string, unknown>;
  if (Buffer.byteLength(JSON.stringify(metadata), "utf8") > 4 * 1024) {
    return json({ error: "metadata_json is too large." }, 413);
  }

  const { error } = await supabaseAdmin.from("product_events").insert({
    user_id: user.id,
    event_type: payload.event_type,
    screen: normalizeText(payload.screen),
    app_version: normalizeText(payload.app_version),
    project_fingerprint: projectFingerprint,
    source_duration_seconds: payload.source_duration_seconds ?? null,
    metadata_json: metadata,
  });

  if (error) {
    console.error("[product-events] insert failed", { code: error.code, message: error.message });
    return json({ error: "Unable to record product event." }, 500);
  }

  if (payload.event_type === "project_imported") {
    await emitLifecycleEvent({
      user,
      eventName: "first_project_imported",
      properties: {
        screen: normalizeText(payload.screen),
        app_version: normalizeText(payload.app_version),
        source_duration_seconds: payload.source_duration_seconds ?? null,
      },
      dedupeKey: `first_project_imported:${user.id}`,
    });
  }

  if (payload.event_type === "run_started") {
    await emitLifecycleEvent({
      user,
      eventName: "first_run_started",
      properties: {
        screen: normalizeText(payload.screen),
        app_version: normalizeText(payload.app_version),
        source_duration_seconds: payload.source_duration_seconds ?? null,
      },
      dedupeKey: `first_run_started:${user.id}`,
    });
  }

  return json({ ok: true });
}
