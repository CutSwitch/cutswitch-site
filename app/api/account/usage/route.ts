export const runtime = "nodejs";

import { getUserFromBearerToken } from "@/lib/auth";
import { getPlan, TRIAL_EDITING_SECONDS } from "@/lib/subscriptions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type UsageEvent = {
  billable_seconds: number | null;
};

function toPublicSubscription(subscription: {
  plan_id?: string | null;
  status?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  created_at?: string | null;
} | null) {
  if (!subscription) return null;

  return {
    plan_id: subscription.plan_id ?? null,
    status: subscription.status ?? null,
    current_period_start: subscription.current_period_start ?? null,
    current_period_end: subscription.current_period_end ?? null,
    created_at: subscription.created_at ?? null,
  };
}

export async function POST(req: Request) {
  const { user, error: authError } = await getUserFromBearerToken(req);

  if (authError === "missing_token") {
    return Response.json({ error: "Missing Authorization bearer token" }, { status: 401 });
  }

  if (authError || !user) {
    return Response.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const { data: subscription, error: subscriptionError } = await supabaseAdmin
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .in("status", ["trialing", "active"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subscriptionError && subscriptionError.code !== "PGRST116") {
    return Response.json({ error: "Subscription lookup failed" }, { status: 500 });
  }

  const { data: usageEvents, error: usageError } = await supabaseAdmin
    .from("usage_events")
    .select("billable_seconds")
    .eq("user_id", user.id)
    .eq("event_type", "transcript_succeeded")
    .returns<UsageEvent[]>();

  if (usageError) {
    return Response.json({ error: "Usage lookup failed" }, { status: 500 });
  }

  const totalUsedSeconds =
    usageEvents?.reduce((sum, e) => sum + (e.billable_seconds || 0), 0) || 0;
  const planDetails = getPlan(subscription?.plan_id);
  const isTrial = subscription?.status === "trialing";
  const includedSeconds = isTrial ? TRIAL_EDITING_SECONDS : planDetails?.includedSeconds;
  const remainingSeconds = includedSeconds
    ? Math.max(0, includedSeconds - totalUsedSeconds)
    : null;

  return Response.json({
    subscription: toPublicSubscription(subscription),
    plan: subscription?.plan_id ?? null,
    totalUsedSeconds,
    remainingSeconds,
    isTrial,
    ...(isTrial ? { trialIncludedSeconds: TRIAL_EDITING_SECONDS } : {}),
  });
}
