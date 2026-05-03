export const runtime = "nodejs";

import { getUserFromBearerToken } from "@/lib/auth";
import { discoverSocialReelsCandidates } from "@/lib/openaiSocialReels";
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

  const parsedBody = await readJsonBody(req, MAX_BODY_BYTES);
  if (!parsedBody.ok) {
    return noStoreJson({ error: parsedBody.message || "Invalid request." }, parsedBody.status);
  }

  const parsed = socialReelsRequestSchema.safeParse(parsedBody.data);
  if (!parsed.success) {
    const issues = getSafeSocialReelsIssues(parsed.error);
    console.warn("[social-reels] invalid payload", { issues });
    return noStoreJson({ error: "Invalid social reels payload", issues }, 400);
  }

  let entitlement: Awaited<ReturnType<typeof getEntitlement>>;
  try {
    entitlement = await getEntitlement(user.id);
  } catch (error) {
    console.error("[social-reels] entitlement lookup failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return noStoreJson({ error: "Entitlement lookup failed." }, 500);
  }

  if (!entitlement.allowed) {
    if (entitlement.reason === "trial_exhausted") {
      return noStoreJson({ error: "Trial editing time exhausted" }, 402);
    }

    return noStoreJson({ error: "Active plan required." }, 403);
  }

  try {
    const result = await discoverSocialReelsCandidates(parsed.data);

    return noStoreJson({
      ok: true,
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
    });
  } catch (error) {
    console.error("[social-reels] discovery failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return noStoreJson({ error: "Unable to discover social reel candidates." }, 500);
  }
}
