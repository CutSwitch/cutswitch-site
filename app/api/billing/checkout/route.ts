export const runtime = "nodejs";

import { getUserFromBearerToken } from "@/lib/auth";
import { getBaseUrl } from "@/lib/env";
import { readJsonBody } from "@/lib/request";
import { enforceRateLimit, noStoreJson } from "@/lib/security";
import { isAppPlanId } from "@/lib/plans";
import { getStripeAppPrice, stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { TRIAL_DAYS } from "@/lib/subscriptions";

type CheckoutBody = {
  planId?: unknown;
};

function escapeStripeSearch(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function hasPriorSupabaseSubscription(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error && error.code !== "PGRST116") throw error;
  return Boolean(data);
}

async function hasPriorStripeSubscription(userId: string, email: string | null | undefined) {
  const byMetadata = await stripe.subscriptions.search({
    query: `metadata['userId']:'${escapeStripeSearch(userId)}'`,
    limit: 1,
  });

  if (byMetadata.data.length > 0) return true;

  if (!email) return false;

  const customers = await stripe.customers.list({ email, limit: 10 });
  for (const customer of customers.data) {
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: "all",
      limit: 1,
    });
    if (subscriptions.data.length > 0) return true;
  }

  return false;
}

export async function POST(req: Request) {
  const rateLimited = await enforceRateLimit(req, [], 30, 60 * 60, "billing_checkout");
  if (rateLimited) return rateLimited;

  const { user, error: authError } = await getUserFromBearerToken(req);

  if (authError === "missing_token") {
    return noStoreJson({ error: "Missing Authorization bearer token" }, 401);
  }

  if (authError || !user) {
    return noStoreJson({ error: "Invalid or expired token" }, 401);
  }

  const parsed = await readJsonBody<CheckoutBody>(req, 8 * 1024);
  if (!parsed.ok) {
    return noStoreJson({ error: parsed.message || "Invalid request." }, parsed.status);
  }

  if (!isAppPlanId(parsed.data.planId)) {
    return noStoreJson({ error: "Invalid planId." }, 400);
  }

  const planId = parsed.data.planId;
  const { envName, priceId } = getStripeAppPrice(planId);

  if (!priceId) {
    console.error("[billing:checkout] Missing Stripe price env for plan", { planId, envName });
    return noStoreJson({ error: "Missing Stripe price env for plan" }, 500);
  }

  const baseUrl = getBaseUrl();

  try {
    const hasPriorSubscription =
      (await hasPriorSupabaseSubscription(user.id)) ||
      (await hasPriorStripeSubscription(user.id, user.email));

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/account?checkout=success`,
      cancel_url: `${baseUrl}/account?checkout=canceled`,
      allow_promotion_codes: true,
      customer_email: user.email || undefined,
      client_reference_id: user.id,
      metadata: {
        userId: user.id,
        planId,
        stripe_price_id: priceId,
      },
      subscription_data: {
        ...(hasPriorSubscription ? {} : { trial_period_days: TRIAL_DAYS }),
        metadata: {
          userId: user.id,
          planId,
          stripe_price_id: priceId,
        },
      },
    });

    if (!session.url) {
      return noStoreJson({ error: "Stripe session missing URL." }, 500);
    }

    return noStoreJson({ checkoutUrl: session.url });
  } catch (error) {
    const stripeError = error as { type?: string; code?: string; message?: string };
    console.error("[billing:checkout] Stripe checkout session failed", {
      type: stripeError?.type,
      code: stripeError?.code,
      message: stripeError?.message || (error instanceof Error ? error.message : "Unknown error"),
    });
    return noStoreJson({ error: "Unable to create checkout session." }, 500);
  }
}
