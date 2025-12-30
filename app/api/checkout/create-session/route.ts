import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/env";
import { getCheckoutPlan, findPromotionCodeId } from "@/lib/billing";
import { stripe } from "@/lib/stripe";
import type { PlanKey } from "@/lib/site";

export const runtime = "nodejs";

type Body = {
  plan?: PlanKey;
  couponCode?: string;
  referral?: string;
  acknowledgedNoRefunds?: boolean;
};

function isPlanKey(value: unknown): value is PlanKey {
  return value === "monthly" || value === "yearly" || value === "lifetime";
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    if (!isPlanKey(body.plan)) {
      return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
    }

    if (!body.acknowledgedNoRefunds) {
      return NextResponse.json({ error: "No-refunds acknowledgement is required." }, { status: 400 });
    }

    const baseUrl = getBaseUrl();
    const plan = getCheckoutPlan(body.plan);

    const referral = typeof body.referral === "string" ? body.referral.trim() : "";
    const couponCode = typeof body.couponCode === "string" ? body.couponCode.trim() : "";

    const promoId = couponCode ? await findPromotionCodeId(couponCode) : null;

    const sessionMetadata: Record<string, string> = {
      plan: plan.key,
      no_refunds_ack: "true",
    };
    if (referral) sessionMetadata.referral = referral;

    const common: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      mode: plan.mode,
      line_items: [{ price: plan.priceId, quantity: 1 }],
      success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/checkout/canceled`,
      automatic_tax: { enabled: true },
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },

      // If we pre-apply a promo code, we disable additional code entry to prevent stacking.
      allow_promotion_codes: promoId ? false : true,

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

    if (promoId) {
      common.discounts = [{ promotion_code: promoId }];
    }

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
    console.error("create-session error", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
