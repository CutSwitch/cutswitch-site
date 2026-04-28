import Stripe from "stripe";

import { getAppPlanIdForPrice } from "@/lib/stripe";
import { APP_PLANS, getAppPlan, type AppPlanId } from "@/lib/plans";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const PLAN_SECONDS: Record<AppPlanId, number> = {
  starter: APP_PLANS.starter.transcriptHours * 60 * 60,
  creator_pro: APP_PLANS.creator_pro.transcriptHours * 60 * 60,
  studio: APP_PLANS.studio.transcriptHours * 60 * 60,
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
  const plan = getAppPlan(planId);
  if (!plan) return null;

  return {
    ...plan,
    includedSeconds: PLAN_SECONDS[plan.id],
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
