import Stripe from "stripe";

import { getAppPlanIdForPrice, type AppPlanId } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const PLAN_SECONDS: Record<AppPlanId, number> = {
  starter: 2 * 60 * 60,
  creator_pro: 10 * 60 * 60,
  studio: 40 * 60 * 60,
};

export type SubscriptionRecord = {
  user_id: string;
  plan_id: AppPlanId;
  stripe_customer_id: string | null;
  stripe_subscription_id: string;
  status: Stripe.Subscription.Status;
  current_period_start: string | null;
  current_period_end: string | null;
};

export function getPlan(planId: string | null | undefined) {
  if (!planId || !(planId in PLAN_SECONDS)) return null;

  return {
    id: planId as AppPlanId,
    includedSeconds: PLAN_SECONDS[planId as AppPlanId],
  };
}

function timestampToIso(timestamp: number | null | undefined): string | null {
  return typeof timestamp === "number" ? new Date(timestamp * 1000).toISOString() : null;
}

function getPrimaryPriceId(subscription: Stripe.Subscription): string | null {
  const price = subscription.items.data[0]?.price;
  return typeof price?.id === "string" ? price.id : null;
}

export function subscriptionRecordFromStripe(
  subscription: Stripe.Subscription,
  userIdOverride?: string | null
): SubscriptionRecord | null {
  const priceId = getPrimaryPriceId(subscription);
  const planId = getAppPlanIdForPrice(priceId);
  const userId = userIdOverride || subscription.metadata?.userId || subscription.metadata?.user_id;

  if (!planId || !userId) {
    return null;
  }

  return {
    user_id: userId,
    plan_id: planId,
    stripe_customer_id:
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
    stripe_subscription_id: subscription.id,
    status: subscription.status,
    current_period_start: timestampToIso(subscription.current_period_start),
    current_period_end: timestampToIso(subscription.current_period_end),
  };
}

export async function upsertSubscriptionRecord(record: SubscriptionRecord) {
  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("stripe_subscription_id", record.stripe_subscription_id)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  if (existing) {
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update(record)
      .eq("stripe_subscription_id", record.stripe_subscription_id);

    if (error) throw error;
    return;
  }

  const { error } = await supabaseAdmin.from("subscriptions").insert(record);
  if (error) throw error;
}
