import Stripe from "stripe";
import { requireEnv } from "@/lib/env";
import { APP_PLAN_IDS, isAppPlanId, type AppPlanId } from "@/lib/plans";

export { isAppPlanId, type AppPlanId };

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

export const STRIPE_APP_PRICE_ENV: Record<AppPlanId, string> = {
  starter: "STRIPE_PRICE_STARTER",
  creator_pro: "STRIPE_PRICE_CREATOR_PRO",
  studio: "STRIPE_PRICE_STUDIO",
};

export function getStripeAppPrice(planId: AppPlanId) {
  const envName = STRIPE_APP_PRICE_ENV[planId];
  const priceId = process.env[envName]?.trim() || null;

  return { envName, priceId };
}

export function getStripeAppPrices(): Record<AppPlanId, string> {
  return Object.fromEntries(
    APP_PLAN_IDS.map((planId) => {
      const { envName, priceId } = getStripeAppPrice(planId);
      if (!priceId) {
        throw new Error(`Missing Stripe price env for plan: ${envName}`);
      }

      return [planId, priceId];
    })
  ) as Record<AppPlanId, string>;
}

export function getAppPlanIdForPrice(priceId: string | null | undefined): AppPlanId | null {
  if (!priceId) return null;

  const match = APP_PLAN_IDS.find((planId) => getStripeAppPrice(planId).priceId === priceId);
  return match ?? null;
}

export function getStripeWebhookSecret() {
  return requireEnv("STRIPE_WEBHOOK_SECRET");
}
