import Stripe from "stripe";
import { requireEnv } from "@/lib/env";

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

export function getStripeWebhookSecret() {
  return requireEnv("STRIPE_WEBHOOK_SECRET");
}
