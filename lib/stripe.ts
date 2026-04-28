import Stripe from "stripe";
import { requireEnv } from "@/lib/env";

export type AppPlanId = "starter" | "creator_pro" | "studio";

// Stripe's Node SDK expects to run in the Node.js runtime (not Edge).
export const stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
  // Pinning apiVersion is recommended. We intentionally omit it here to avoid
  // mismatches with your Stripe account's default version during first setup.
  // apiVersion: "2024-06-20",
});

export function getStripePrices() {
  return {
    monthly: requireEnv("STRIPE_PRICE_ID_MONTHLY"),
    yearly: requireEnv("STRIPE_PRICE_ID_YEARLY"),
    lifetime: requireEnv("STRIPE_PRICE_ID_LIFETIME"),
  } as const;
}

export function getStripeAppPrices(): Record<AppPlanId, string> {
  return {
    starter: requireEnv("STRIPE_PRICE_STARTER"),
    creator_pro: requireEnv("STRIPE_PRICE_CREATOR_PRO"),
    studio: requireEnv("STRIPE_PRICE_STUDIO"),
  };
}

export function isAppPlanId(value: unknown): value is AppPlanId {
  return value === "starter" || value === "creator_pro" || value === "studio";
}

export function getAppPlanIdForPrice(priceId: string | null | undefined): AppPlanId | null {
  if (!priceId) return null;

  const prices = getStripeAppPrices();
  const match = (Object.entries(prices) as Array<[AppPlanId, string]>).find(
    ([, value]) => value === priceId
  );

  return match?.[0] ?? null;
}

export function getStripeWebhookSecret() {
  return requireEnv("STRIPE_WEBHOOK_SECRET");
}
