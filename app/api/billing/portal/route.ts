export const runtime = "nodejs";

import { getUserFromBearerToken } from "@/lib/auth";
import { getBaseUrl } from "@/lib/env";
import { enforceRateLimit, noStoreJson } from "@/lib/security";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const rateLimited = await enforceRateLimit(req, [], 30, 60 * 60, "billing_portal");
  if (rateLimited) return rateLimited;

  const { user, error: authError } = await getUserFromBearerToken(req);

  if (authError === "missing_token") {
    return noStoreJson({ error: "Missing Authorization bearer token" }, 401);
  }

  if (authError || !user) {
    return noStoreJson({ error: "Invalid or expired token" }, 401);
  }

  const { data: subscription, error } = await supabaseAdmin
    .from("subscriptions")
    .select("stripe_customer_id,current_period_end")
    .eq("user_id", user.id)
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[billing:portal] Subscription lookup failed", { message: error.message });
    return noStoreJson({ error: "Subscription lookup failed" }, 500);
  }

  if (!subscription?.stripe_customer_id) {
    return noStoreJson({ error: "No active billing account found." }, 400);
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${getBaseUrl()}/account`,
    });

    return noStoreJson({ portalUrl: session.url });
  } catch (error) {
    const stripeError = error as { type?: string; code?: string; message?: string };
    console.error("[billing:portal] Stripe billing portal failed", {
      type: stripeError?.type,
      code: stripeError?.code,
      message: stripeError?.message || (error instanceof Error ? error.message : "Unknown error"),
    });
    return noStoreJson({ error: "Unable to create billing portal session." }, 500);
  }
}
