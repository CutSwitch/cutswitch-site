import { NextResponse } from "next/server";

import { getCheckoutPlan } from "@/lib/billing";
import { getBaseUrl } from "@/lib/env";
import { getIpHash, readJsonBody } from "@/lib/request";
import { rateLimit, type RateLimitResult } from "@/lib/rateLimit";
import type { PlanKey } from "@/lib/site";
import { stripe } from "@/lib/stripe";
import type Stripe from "stripe";

export const runtime = "nodejs";

type Body = {
  plan?: PlanKey;
  referral?: string;
  acknowledgedNoRefunds?: boolean;
};

function isPlanKey(value: unknown): value is PlanKey {
  return value === "monthly" || value === "yearly" || value === "lifetime";
}

async function safeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  try {
    return await rateLimit(key, limit, windowSeconds);
  } catch {
    // Fail-open: purchases should not be blocked by KV outages.
    console.warn("[checkout:create-session] rateLimit unavailable, continuing");
    return { allowed: true, remaining: limit, limit, reset_seconds: windowSeconds };
  }
}

export async function POST(req: Request) {
  try {
    // Abuse protection: creating Stripe Checkout Sessions is a paid API surface.
    // Keep this generous so it never hits real buyers.
    const ipHash = getIpHash(req);
    const rl = await safeRateLimit(`rl:checkout_create_session:ip:${ipHash}`, 30, 60 * 60);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(1, rl.reset_seconds ?? 60)),
          },
        }
      );
    }

    const parsed = await readJsonBody<Body>(req, 8 * 1024);
    if (!parsed.ok) {
      return NextResponse.json(
        { error: parsed.message || "Invalid request." },
        { status: parsed.status }
      );
    }

    const body = parsed.data;

    if (!isPlanKey(body.plan)) {
      return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
    }

    if (!body.acknowledgedNoRefunds) {
      return NextResponse.json(
        { error: "No-refunds acknowledgement is required." },
        { status: 400 }
      );
    }

    const baseUrl = getBaseUrl();
    const plan = getCheckoutPlan(body.plan);

    const referral = typeof body.referral === "string" ? body.referral.trim() : "";
    if (referral.length > 128) {
      return NextResponse.json({ error: "Invalid referral." }, { status: 400 });
    }

    const sessionMetadata: Record<string, string> = {
      plan: plan.key,
      stripe_price_id: plan.priceId,
      no_refunds_ack: "true",
    };
    if (referral) sessionMetadata.referral = referral;

    // IMPORTANT: Explicit Stripe params type to avoid TS mis-inferring RequestOptions
    const common: Stripe.Checkout.SessionCreateParams = {
      mode: plan.mode,
      line_items: [{ price: plan.priceId, quantity: 1 }],
      success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/checkout/canceled`,
      automatic_tax: { enabled: true },
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      allow_promotion_codes: true,

      // Reduce chargeback risk: make terms acceptance explicit in Checkout.
      consent_collection: { terms_of_service: "required" },
      custom_text: {
        terms_of_service_acceptance: {
          message:
            "By purchasing you agree to our Terms and acknowledge that all sales are final (no refunds).",
        },
        submit: {
          message: "We deliver your license key by email after payment succeeds.",
        },
      },

      metadata: sessionMetadata,
    };

    // Rewardful server-side checkout integration uses Stripe's client_reference_id.
    // Never set it to an empty string.
    if (referral) {
      common.client_reference_id = referral;
    }

    if (plan.mode === "subscription") {
      const subMetadata: Record<string, string> = { ...sessionMetadata };
      common.subscription_data = {
        trial_period_days: plan.trialDays || undefined,
        metadata: subMetadata,
      };
    } else {
      // Ensure a Stripe Customer is created so Rewardful conversion tracking works for one-time purchases.
      common.customer_creation = "always";

      const piMetadata: Record<string, string> = { ...sessionMetadata };
      common.payment_intent_data = { metadata: piMetadata };
    }

    const session = await stripe.checkout.sessions.create(common);

    if (!session.url) {
      return NextResponse.json({ error: "Stripe session missing URL." }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    // Intentionally do not log request payloads (may contain PII).
    console.error("[checkout:create-session] error", err?.message || err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
