export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { getUserFromBearerToken } from "@/lib/auth";
import { getBaseUrl } from "@/lib/env";
import { readJsonBody } from "@/lib/request";
import { getStripeAppPrices, isAppPlanId } from "@/lib/stripe";
import { stripe } from "@/lib/stripe";

type CheckoutBody = {
  planId?: unknown;
};

export async function POST(req: Request) {
  const { user, error: authError } = await getUserFromBearerToken(req);

  if (authError === "missing_token") {
    return NextResponse.json({ error: "Missing Authorization bearer token" }, { status: 401 });
  }

  if (authError || !user) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const parsed = await readJsonBody<CheckoutBody>(req, 8 * 1024);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message || "Invalid request." }, { status: parsed.status });
  }

  if (!isAppPlanId(parsed.data.planId)) {
    return NextResponse.json({ error: "Invalid planId." }, { status: 400 });
  }

  const planId = parsed.data.planId;
  const priceId = getStripeAppPrices()[planId];
  const baseUrl = getBaseUrl();

  try {
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
        metadata: {
          userId: user.id,
          planId,
          stripe_price_id: priceId,
        },
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe session missing URL." }, { status: 500 });
    }

    return NextResponse.json({ checkoutUrl: session.url });
  } catch (error) {
    console.error("[billing:checkout] Stripe checkout session failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Unable to create checkout session." }, { status: 500 });
  }
}
