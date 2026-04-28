export const runtime = "nodejs";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

type UsageEvent = {
  billable_seconds: number | null;
};

function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  const [scheme, token] = header?.split(" ") ?? [];

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export async function POST(req: Request) {
  const token = getBearerToken(req);

  if (!token) {
    return Response.json({ error: "Missing Authorization bearer token" }, { status: 401 });
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return Response.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const { data: subscription, error: subscriptionError } = await supabaseAdmin
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (subscriptionError && subscriptionError.code !== "PGRST116") {
    return Response.json({ error: "Subscription lookup failed" }, { status: 500 });
  }

  const { data: usageEvents, error: usageError } = await supabaseAdmin
    .from("usage_events")
    .select("billable_seconds")
    .eq("user_id", user.id)
    .returns<UsageEvent[]>();

  if (usageError) {
    return Response.json({ error: "Usage lookup failed" }, { status: 500 });
  }

  const totalUsedSeconds =
    usageEvents?.reduce((sum, e) => sum + (e.billable_seconds || 0), 0) || 0;

  return Response.json({
    subscription,
    totalUsedSeconds,
  });
}
