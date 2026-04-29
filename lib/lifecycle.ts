import "server-only";

import type { User } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const LIFECYCLE_EVENT_NAMES = [
  "user_signed_up",
  "trial_started",
  "first_project_imported",
  "first_run_started",
  "first_run_succeeded",
  "trial_never_ran_day_2",
  "trial_exhausted",
  "paid_subscription_started",
  "near_quota",
  "canceled_subscription",
  "feedback_praise_received",
  "repeated_failure",
] as const;

export type LifecycleEventName = (typeof LIFECYCLE_EVENT_NAMES)[number];
export type LifecycleProvider = "none" | "loops" | "customerio";
export type LifecycleStatus = "queued" | "sent" | "skipped" | "failed";

export type LifecycleUser = Pick<User, "id" | "email"> | { id: string; email?: string | null };

type LifecycleInput = {
  user: LifecycleUser;
  eventName: LifecycleEventName;
  properties?: Record<string, unknown>;
  dedupeKey?: string;
};

const SENSITIVE_KEY = /token|secret|password|path|filepath|file_path|filename|file_name|fcpxml|transcript|audio|provider|api_key|provider_key/i;
const RAW_PATH_VALUE = /(^|[\s"'])(~\/|\/Users\/|[A-Za-z]:\\|file:\/\/|.*\\.*|.*\/.*)/;

function isMissingLifecycleSchema(error: { code?: string } | null | undefined) {
  return error?.code === "42P01" || error?.code === "42703" || error?.code === "PGRST204" || error?.code === "PGRST205";
}

function getProvider(): LifecycleProvider {
  const provider = (process.env.LIFECYCLE_PROVIDER || "none").trim().toLowerCase();
  if (provider === "loops" || provider === "customerio") return provider;
  return "none";
}

export function getLifecycleProviderStatus() {
  const provider = getProvider();
  return {
    provider,
    enabled: provider !== "none",
    configured:
      provider === "loops"
        ? Boolean(process.env.LOOPS_API_KEY?.trim())
        : provider === "customerio"
          ? Boolean(process.env.CUSTOMERIO_SITE_ID?.trim() && process.env.CUSTOMERIO_API_KEY?.trim())
          : true,
    unresolved: provider === "customerio" ? "Customer.io adapter is not implemented in Phase 3B." : null,
  };
}

function looksLikeRawPath(value: string) {
  return RAW_PATH_VALUE.test(value) || /\.fcpxml\b/i.test(value);
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 3) return null;
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (looksLikeRawPath(value)) return "[redacted]";
    return value.slice(0, 500);
  }
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1));
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>).slice(0, 50)) {
      const safeKey = key.slice(0, 80);
      output[safeKey] = SENSITIVE_KEY.test(key) ? "[redacted]" : sanitizeValue(entry, depth + 1);
    }
    return output;
  }
  return null;
}

function sanitizeProperties(properties: Record<string, unknown> | undefined, dedupeKey?: string) {
  const sanitized = sanitizeValue(properties || {}) as Record<string, unknown>;
  const withDedupe = dedupeKey ? { ...sanitized, dedupe_key: dedupeKey } : sanitized;
  const json = JSON.stringify(withDedupe);
  if (Buffer.byteLength(json, "utf8") <= 8 * 1024) return withDedupe;
  return { truncated: true, dedupe_key: dedupeKey || undefined };
}

async function getUserEmail(user: LifecycleUser) {
  if (user.email) return user.email;
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("email")
    .eq("id", user.id)
    .maybeSingle<{ email: string | null }>();
  if (error) return null;
  return data?.email || null;
}

async function alreadyEmitted(input: { userId: string; eventName: LifecycleEventName; dedupeKey?: string }) {
  if (!input.dedupeKey) return false;
  const { data, error } = await supabaseAdmin
    .from("lifecycle_events")
    .select("id")
    .eq("user_id", input.userId)
    .eq("event_name", input.eventName)
    .contains("metadata_json", { dedupe_key: input.dedupeKey })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (error) {
    if (isMissingLifecycleSchema(error)) return false;
    console.error("[lifecycle] dedupe lookup failed", { code: error.code, message: error.message });
    return false;
  }
  return Boolean(data);
}

async function insertLifecycleEvent(input: {
  userId: string;
  eventName: LifecycleEventName;
  provider: LifecycleProvider;
  status: LifecycleStatus;
  metadata: Record<string, unknown>;
  errorMessage?: string | null;
}) {
  const { data, error } = await supabaseAdmin
    .from("lifecycle_events")
    .insert({
      user_id: input.userId,
      event_name: input.eventName,
      provider: input.provider,
      status: input.status,
      metadata_json: input.metadata,
      error_message: input.errorMessage || null,
      sent_at: input.status === "sent" ? new Date().toISOString() : null,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    if (!isMissingLifecycleSchema(error)) {
      console.error("[lifecycle] insert failed", { eventName: input.eventName, code: error.code, message: error.message });
    }
    return null;
  }
  return data.id;
}

async function updateLifecycleEvent(id: string, status: LifecycleStatus, errorMessage?: string | null) {
  const { error } = await supabaseAdmin
    .from("lifecycle_events")
    .update({
      status,
      error_message: errorMessage || null,
      sent_at: status === "sent" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error && !isMissingLifecycleSchema(error)) {
    console.error("[lifecycle] update failed", { status, code: error.code, message: error.message });
  }
}

async function sendLoopsEvent(input: {
  userId: string;
  email: string | null;
  eventName: LifecycleEventName;
  properties: Record<string, unknown>;
}) {
  const apiKey = process.env.LOOPS_API_KEY;
  if (!apiKey?.trim()) return { ok: false as const, error: "LOOPS_API_KEY is not configured." };
  if (!input.email) return { ok: false as const, error: "Lifecycle user email is missing." };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch("https://app.loops.so/api/v1/events/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: input.email,
        userId: input.userId,
        eventName: input.eventName,
        eventProperties: input.properties,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;
      console.error("[lifecycle] loops send failed", { status: res.status, message: body?.message || body?.error });
      return { ok: false as const, error: "Loops event send failed." };
    }
    return { ok: true as const };
  } catch (error) {
    console.error("[lifecycle] loops send failed", { message: error instanceof Error ? error.message : "Unknown error" });
    return { ok: false as const, error: "Loops event send failed." };
  } finally {
    clearTimeout(timeout);
  }
}

export async function emitLifecycleEvent(input: LifecycleInput) {
  try {
    if (await alreadyEmitted({ userId: input.user.id, eventName: input.eventName, dedupeKey: input.dedupeKey })) {
      return { ok: true as const, skipped: true as const };
    }

    const provider = getProvider();
    const metadata = sanitizeProperties(input.properties, input.dedupeKey);
    const email = await getUserEmail(input.user);

    if (provider === "none") {
      const id = await insertLifecycleEvent({
        userId: input.user.id,
        eventName: input.eventName,
        provider,
        status: "skipped",
        metadata: { ...metadata, no_op: true },
      });
      if (process.env.NODE_ENV !== "production") {
        console.info("[lifecycle] no-op", { eventName: input.eventName, userId: input.user.id, recorded: Boolean(id) });
      }
      return { ok: true as const, skipped: true as const };
    }

    if (provider === "customerio") {
      await insertLifecycleEvent({
        userId: input.user.id,
        eventName: input.eventName,
        provider,
        status: "failed",
        metadata,
        errorMessage: "Customer.io adapter is not implemented.",
      });
      return { ok: false as const, error: "Customer.io adapter is not implemented." };
    }

    const eventId = await insertLifecycleEvent({
      userId: input.user.id,
      eventName: input.eventName,
      provider,
      status: "queued",
      metadata,
    });
    if (!eventId) return { ok: false as const, error: "Lifecycle event could not be recorded." };

    const result = await sendLoopsEvent({ userId: input.user.id, email, eventName: input.eventName, properties: metadata });
    if (!result.ok) {
      await updateLifecycleEvent(eventId, "failed", result.error);
      return result;
    }

    await updateLifecycleEvent(eventId, "sent");
    return { ok: true as const };
  } catch (error) {
    console.error("[lifecycle] event failed", {
      eventName: input.eventName,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return { ok: false as const, error: "Lifecycle event failed." };
  }
}

export async function getLifecycleEvents(limit = 100) {
  const { data, error } = await supabaseAdmin
    .from("lifecycle_events")
    .select("id,user_id,event_name,provider,status,metadata_json,created_at,sent_at,error_message")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<Array<{
      id: string;
      user_id: string | null;
      event_name: LifecycleEventName;
      provider: LifecycleProvider | null;
      status: LifecycleStatus;
      metadata_json: Record<string, unknown> | null;
      created_at: string | null;
      sent_at: string | null;
      error_message: string | null;
      user_email?: string | null;
    }>>();

  if (error) {
    if (isMissingLifecycleSchema(error)) return { rows: [], schemaMissing: true };
    throw error;
  }

  const userIds = [...new Set((data || []).map((row) => row.user_id).filter(Boolean) as string[])];
  const emails = new Map<string, string | null>();
  if (userIds.length) {
    const { data: users, error: usersError } = await supabaseAdmin
      .from("users")
      .select("id,email")
      .in("id", userIds)
      .returns<Array<{ id: string; email: string | null }>>();
    if (usersError) throw usersError;
    for (const user of users || []) emails.set(user.id, user.email);
  }

  return {
    rows: (data || []).map((row) => ({
      ...row,
      user_email: row.user_id ? emails.get(row.user_id) ?? null : null,
    })),
    schemaMissing: false,
  };
}
