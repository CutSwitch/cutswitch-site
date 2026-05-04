export const runtime = "nodejs";
export const maxDuration = 180;

import { getUserFromBearerToken } from "@/lib/auth";
import {
  SocialReelsDiscoveryError,
  discoverSocialReelsCandidates,
  getSocialReelsOpenAIMode,
} from "@/lib/openaiSocialReels";
import { readJsonBody } from "@/lib/request";
import { enforceRateLimit, noStoreJson } from "@/lib/security";
import { getSafeSocialReelsIssues, socialReelsRequestSchema } from "@/lib/socialReelsSchema";
import { TRIAL_EDITING_SECONDS } from "@/lib/subscriptions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const MAX_BODY_BYTES = 2 * 1024 * 1024;

type UsageEvent = {
  billable_seconds: number | null;
};

type SubscriptionRow = {
  status: string | null;
  plan_id: string | null;
};

type RouteDiagnostics = {
  request_id: string;
  mode: "mock" | "live";
  request_received_at: string;
  payload_parse_ms: number | null;
  schema_validation_ms: number | null;
  segment_count: number | null;
  approximate_total_text_chars: number | null;
  requested_candidate_count: number | null;
  duration_preferences: string[] | null;
  openai_request_started_at: string | null;
  openai_elapsed_ms: number | null;
  response_parse_ms: number | null;
  total_elapsed_ms: number;
  timeout_stage: string | null;
  provider: string | null;
  model: string | null;
};

function safePayloadShape(value: unknown) {
  if (!value || typeof value !== "object") {
    return {
      segment_count: null,
      approximate_total_text_chars: null,
      requested_candidate_count: null,
      duration_preferences: null,
    };
  }

  const record = value as Record<string, unknown>;
  const segments = Array.isArray(record.segments) ? record.segments : [];
  const approximateTextChars = segments.reduce((sum, segment) => {
    if (!segment || typeof segment !== "object") return sum;
    const text = (segment as Record<string, unknown>).text;
    return sum + (typeof text === "string" ? text.length : 0);
  }, 0);
  const durationPreferences = Array.isArray(record.duration_preferences)
    ? record.duration_preferences.filter((preference): preference is string => typeof preference === "string").slice(0, 12)
    : null;

  return {
    segment_count: Array.isArray(record.segments) ? segments.length : null,
    approximate_total_text_chars: Array.isArray(record.segments) ? approximateTextChars : null,
    requested_candidate_count:
      typeof record.requested_candidate_count === "number" && Number.isFinite(record.requested_candidate_count)
        ? record.requested_candidate_count
        : null,
    duration_preferences: durationPreferences,
  };
}

function createDiagnostics(input: {
  requestId: string;
  mode: "mock" | "live";
  requestReceivedAt: string;
  routeStartedMs: number;
  payloadParseMs: number | null;
  schemaValidationMs: number | null;
  shape: ReturnType<typeof safePayloadShape>;
  timeoutStage?: string | null;
  provider?: string | null;
  model?: string | null;
  openaiRequestStartedAt?: string | null;
  openaiElapsedMs?: number | null;
  responseParseMs?: number | null;
}): RouteDiagnostics {
  return {
    request_id: input.requestId,
    mode: input.mode,
    request_received_at: input.requestReceivedAt,
    payload_parse_ms: input.payloadParseMs,
    schema_validation_ms: input.schemaValidationMs,
    segment_count: input.shape.segment_count,
    approximate_total_text_chars: input.shape.approximate_total_text_chars,
    requested_candidate_count: input.shape.requested_candidate_count,
    duration_preferences: input.shape.duration_preferences,
    openai_request_started_at: input.openaiRequestStartedAt ?? null,
    openai_elapsed_ms: input.openaiElapsedMs ?? null,
    response_parse_ms: input.responseParseMs ?? null,
    total_elapsed_ms: Date.now() - input.routeStartedMs,
    timeout_stage: input.timeoutStage ?? null,
    provider: input.provider ?? null,
    model: input.model ?? null,
  };
}

async function getEntitlement(userId: string) {
  const { data: subscription, error: subscriptionError } = await supabaseAdmin
    .from("subscriptions")
    .select("status,plan_id")
    .eq("user_id", userId)
    .in("status", ["trialing", "active"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<SubscriptionRow>();

  if (subscriptionError && subscriptionError.code !== "PGRST116") {
    throw subscriptionError;
  }

  if (!subscription) {
    return {
      allowed: false,
      status: null,
      plan: null,
      remainingSeconds: null,
      reason: "no_current_subscription" as const,
    };
  }

  if (subscription.status !== "trialing") {
    return {
      allowed: true,
      status: subscription.status,
      plan: subscription.plan_id,
      remainingSeconds: null,
      reason: null,
    };
  }

  const { data: usageEvents, error: usageError } = await supabaseAdmin
    .from("usage_events")
    .select("billable_seconds")
    .eq("user_id", userId)
    .eq("event_type", "transcript_succeeded")
    .returns<UsageEvent[]>();

  if (usageError) throw usageError;

  const totalUsedSeconds = usageEvents?.reduce((sum, e) => sum + (e.billable_seconds || 0), 0) || 0;
  const remainingSeconds = Math.max(0, TRIAL_EDITING_SECONDS - totalUsedSeconds);

  return {
    allowed: remainingSeconds > 0,
    status: subscription.status,
    plan: subscription.plan_id,
    remainingSeconds,
    reason: remainingSeconds > 0 ? null : ("trial_exhausted" as const),
  };
}

export async function POST(req: Request) {
  const routeStartedMs = Date.now();
  const requestId = crypto.randomUUID();
  const requestReceivedAt = new Date(routeStartedMs).toISOString();
  const mode = getSocialReelsOpenAIMode();
  let payloadParseMs: number | null = null;
  let schemaValidationMs: number | null = null;
  let payloadShape = safePayloadShape(null);

  const ipRateLimited = await enforceRateLimit(req, [], 60, 60 * 60, "social_reels_discover_ip");
  if (ipRateLimited) return ipRateLimited;

  const { user, error: authError } = await getUserFromBearerToken(req);

  if (authError === "missing_token") {
    return noStoreJson({ error: "Missing Authorization bearer token" }, 401);
  }

  if (authError || !user) {
    return noStoreJson({ error: "Invalid or expired token" }, 401);
  }

  const userRateLimited = await enforceRateLimit(req, [user.id], 30, 60 * 60, "social_reels_discover_user");
  if (userRateLimited) return userRateLimited;

  const payloadParseStartedMs = Date.now();
  const parsedBody = await readJsonBody(req, MAX_BODY_BYTES);
  payloadParseMs = Date.now() - payloadParseStartedMs;
  if (!parsedBody.ok) {
    const diagnostics = createDiagnostics({
      requestId,
      mode,
      requestReceivedAt,
      routeStartedMs,
      payloadParseMs,
      schemaValidationMs,
      shape: payloadShape,
      timeoutStage: "route_before_openai",
    });
    console.warn("[social-reels] body parse failed", diagnostics);
    return noStoreJson({ error: parsedBody.message || "Invalid request.", request_id: requestId }, parsedBody.status);
  }

  payloadShape = safePayloadShape(parsedBody.data);
  const validationStartedMs = Date.now();
  const parsed = socialReelsRequestSchema.safeParse(parsedBody.data);
  schemaValidationMs = Date.now() - validationStartedMs;
  if (!parsed.success) {
    const issues = getSafeSocialReelsIssues(parsed.error);
    const diagnostics = createDiagnostics({
      requestId,
      mode,
      requestReceivedAt,
      routeStartedMs,
      payloadParseMs,
      schemaValidationMs,
      shape: payloadShape,
      timeoutStage: "route_before_openai",
    });
    console.warn("[social-reels] invalid payload", { issues, diagnostics });
    return noStoreJson({ error: "Invalid social reels payload", issues, request_id: requestId }, 400);
  }
  payloadShape = safePayloadShape(parsed.data);

  let entitlement: Awaited<ReturnType<typeof getEntitlement>>;
  try {
    entitlement = await getEntitlement(user.id);
  } catch (error) {
    console.error("[social-reels] entitlement lookup failed", {
      diagnostics: createDiagnostics({
        requestId,
        mode,
        requestReceivedAt,
        routeStartedMs,
        payloadParseMs,
        schemaValidationMs,
        shape: payloadShape,
        timeoutStage: "route_before_openai",
      }),
    });
    return noStoreJson({ error: "Entitlement lookup failed.", request_id: requestId }, 500);
  }

  if (!entitlement.allowed) {
    if (entitlement.reason === "trial_exhausted") {
      return noStoreJson({ error: "Trial editing time exhausted" }, 402);
    }

    return noStoreJson({ error: "Active plan required." }, 403);
  }

  try {
    const result = await discoverSocialReelsCandidates(parsed.data);
    const diagnostics = createDiagnostics({
      requestId,
      mode: result.diagnostics.mode,
      requestReceivedAt,
      routeStartedMs,
      payloadParseMs,
      schemaValidationMs,
      shape: payloadShape,
      provider: result.diagnostics.provider,
      model: result.diagnostics.model || result.model,
      openaiRequestStartedAt: result.diagnostics.openaiRequestStartedAt,
      openaiElapsedMs: result.diagnostics.openaiElapsedMs,
      responseParseMs: result.diagnostics.responseParseMs,
    });

    console.info("[social-reels] discovery completed", diagnostics);

    return noStoreJson({
      ok: true,
      request_id: requestId,
      candidates: result.response.candidates,
      modelNotes: result.response.model_notes,
      usage: result.usage,
      providerResponseId: result.providerResponseId,
      model: result.model,
      mock: result.mock,
      entitlement: {
        status: entitlement.status,
        plan: entitlement.plan,
        remainingSeconds: entitlement.remainingSeconds,
      },
      diagnostics,
    });
  } catch (error) {
    const stage = error instanceof SocialReelsDiscoveryError ? error.stage : "unknown";
    const elapsedMs = error instanceof SocialReelsDiscoveryError ? error.elapsedMs : null;
    const diagnostics = createDiagnostics({
      requestId,
      mode,
      requestReceivedAt,
      routeStartedMs,
      payloadParseMs,
      schemaValidationMs,
      shape: payloadShape,
      timeoutStage: stage,
      openaiElapsedMs: elapsedMs,
      provider: mode === "live" ? "openai" : "mock",
    });

    console.error("[social-reels] discovery failed", {
      message: error instanceof SocialReelsDiscoveryError ? error.message : "unknown",
      diagnostics,
    });

    if (stage === "openai_fetch_timeout" || stage === "route_timeout") {
      return noStoreJson(
        {
          error: "Social reels discovery timed out",
          stage,
          request_id: requestId,
          elapsed_ms: diagnostics.openai_elapsed_ms ?? diagnostics.total_elapsed_ms,
        },
        504
      );
    }

    return noStoreJson(
      {
        error: "Unable to discover social reel candidates.",
        stage,
        request_id: requestId,
      },
      500
    );
  }
}
