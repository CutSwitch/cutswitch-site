import type Stripe from "stripe";

import { APP_PLAN_IDS, getAppPlan, type AppPlanId } from "@/lib/plans";
import {
  getCreditBalance,
  getOrCreateCreditAccount,
  grantCredits,
  SocialReelsCreditLedgerError,
  type CreditBalance,
  type CreditLedgerEntryRow,
  type SocialReelsCreditStore,
} from "@/lib/socialReelsCreditLedger";
import { getAppPlanIdForPrice, getStripeAppPrice } from "@/lib/stripe";

const SOCIAL_REELS_TRIAL_EDITING_SECONDS = 4 * 60 * 60;

type StripeCreditSubscriptionRecord = {
  user_id: string;
  plan_id: AppPlanId;
  stripe_customer_id: string | null;
  stripe_subscription_id: string;
  status: Stripe.Subscription.Status;
  current_period_start: string | null;
  current_period_end: string | null;
};

export type SocialReelsPlanCreditMapping = {
  planId: AppPlanId;
  stripePriceEnvName: string;
  stripePriceId: string | null;
  includedMonthlyCredits: number;
  overageEnabled: false;
};

export type StripeCreditGrantKind = "monthly_included" | "trial";

export type StripeCreditGrantResult =
  | {
      granted: true;
      kind: StripeCreditGrantKind;
      entry: CreditLedgerEntryRow;
      balance: CreditBalance;
      idempotent: boolean;
      credits: number;
      creditAccountId: string;
      idempotencyKey: string;
    }
  | {
      granted: false;
      reason:
        | "subscription_not_account_backed"
        | "subscription_status_no_credit_grant"
        | "plan_has_no_credit_mapping"
        | "zero_credit_grant";
      balance?: CreditBalance;
      creditAccountId?: string;
    };

export function getIncludedMonthlyCreditsForPlan(planId: AppPlanId): number {
  const plan = getAppPlan(planId);
  if (!plan) {
    throw new SocialReelsCreditLedgerError("unknown_stripe_price", "Unknown plan for credit mapping.", 400);
  }
  return plan.transcriptHours * 60;
}

export function getTrialIncludedCredits(): number {
  return Math.ceil(SOCIAL_REELS_TRIAL_EDITING_SECONDS / 60);
}

export function getSocialReelsPlanCreditMappings(): Record<AppPlanId, SocialReelsPlanCreditMapping> {
  return Object.fromEntries(
    APP_PLAN_IDS.map((planId) => {
      const price = getStripeAppPrice(planId);
      return [
        planId,
        {
          planId,
          stripePriceEnvName: price.envName,
          stripePriceId: price.priceId,
          includedMonthlyCredits: getIncludedMonthlyCreditsForPlan(planId),
          overageEnabled: false,
        },
      ];
    })
  ) as Record<AppPlanId, SocialReelsPlanCreditMapping>;
}

export function getSocialReelsPlanCreditMappingForStripePrice(priceId: string | null | undefined): SocialReelsPlanCreditMapping {
  const planId = getAppPlanIdForPrice(priceId);
  if (!planId) {
    throw new SocialReelsCreditLedgerError("unknown_stripe_price", "Stripe price is not mapped to a Social Reels credit plan.", 400, {
      stripePriceIdPresent: Boolean(priceId),
    });
  }

  return getSocialReelsPlanCreditMappings()[planId];
}

function toPeriodKeyPart(value: string | null, fallback: string) {
  return value || fallback;
}

export function buildStripeCreditGrantIdempotencyKey(input: {
  record: StripeCreditSubscriptionRecord;
  kind: StripeCreditGrantKind;
  stripeEventId: string;
}): string {
  if (input.kind === "trial") {
    return `stripe:credits:trial:${input.record.stripe_subscription_id}:${input.record.plan_id}`;
  }

  const periodStart = toPeriodKeyPart(input.record.current_period_start, `event:${input.stripeEventId}`);
  return `stripe:credits:monthly:${input.record.stripe_subscription_id}:${periodStart}:${input.record.plan_id}`;
}

export function getPrimarySubscriptionPriceId(subscription: Stripe.Subscription): string | null {
  const price = subscription.items.data[0]?.price;
  return typeof price?.id === "string" ? price.id : null;
}

function timestampToIso(timestamp: number | null | undefined): string | null {
  return typeof timestamp === "number" ? new Date(timestamp * 1000).toISOString() : null;
}

function creditSubscriptionRecordFromStripe(
  subscription: Stripe.Subscription,
  userIdOverride?: string | null
): StripeCreditSubscriptionRecord | null {
  const priceId = getPrimarySubscriptionPriceId(subscription);
  const planId = getAppPlanIdForPrice(priceId);
  const userId = userIdOverride || subscription.metadata?.userId || subscription.metadata?.user_id;

  if (!planId || !userId) return null;

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

export async function grantStripeSubscriptionCredits(input: {
  store?: SocialReelsCreditStore;
  stripeEventId: string;
  subscription: Stripe.Subscription;
  userIdOverride?: string | null;
}): Promise<StripeCreditGrantResult> {
  const record = creditSubscriptionRecordFromStripe(input.subscription, input.userIdOverride);
  if (!record) {
    return { granted: false, reason: "subscription_not_account_backed" };
  }

  const mapping = getSocialReelsPlanCreditMappings()[record.plan_id];
  if (!mapping) {
    return { granted: false, reason: "plan_has_no_credit_mapping" };
  }

  const account = await getOrCreateCreditAccount({
    store: input.store,
    userId: record.user_id,
    planId: record.plan_id,
    currentSubscriptionId: record.stripe_subscription_id,
    metadata: {
      created_by: "stripe_credit_grant",
      stripe_subscription_id: record.stripe_subscription_id,
      plan_id: record.plan_id,
    },
  });

  if (record.status === "trialing") {
    const credits = getTrialIncludedCredits();
    if (credits <= 0) {
      return {
        granted: false,
        reason: "zero_credit_grant",
        balance: await getCreditBalance({ store: input.store, creditAccountId: account.id }),
        creditAccountId: account.id,
      };
    }

    const idempotencyKey = buildStripeCreditGrantIdempotencyKey({ record, kind: "trial", stripeEventId: input.stripeEventId });
    const grant = await grantCredits({
      store: input.store,
      creditAccountId: account.id,
      userId: record.user_id,
      credits,
      idempotencyKey,
      source: "stripe_trial_credit_grant",
      metadata: {
        grant_kind: "trial",
        stripe_event_id: input.stripeEventId,
        stripe_customer_id: record.stripe_customer_id,
        stripe_subscription_id: record.stripe_subscription_id,
        plan_id: record.plan_id,
        subscription_status: record.status,
        trial_credit_policy: "trial_editing_seconds_as_source_minutes",
      },
      idempotencyMetadata: {
        grant_kind: "trial",
        stripe_subscription_id: record.stripe_subscription_id,
        plan_id: record.plan_id,
        subscription_status: record.status,
        trial_credit_policy: "trial_editing_seconds_as_source_minutes",
      },
    });

    return { granted: true, kind: "trial", credits, creditAccountId: account.id, idempotencyKey, ...grant };
  }

  if (record.status !== "active") {
    return {
      granted: false,
      reason: "subscription_status_no_credit_grant",
      balance: await getCreditBalance({ store: input.store, creditAccountId: account.id }),
      creditAccountId: account.id,
    };
  }

  const credits = mapping.includedMonthlyCredits;
  if (credits <= 0) {
    return {
      granted: false,
      reason: "zero_credit_grant",
      balance: await getCreditBalance({ store: input.store, creditAccountId: account.id }),
      creditAccountId: account.id,
    };
  }

  const idempotencyKey = buildStripeCreditGrantIdempotencyKey({ record, kind: "monthly_included", stripeEventId: input.stripeEventId });
  const grant = await grantCredits({
    store: input.store,
    creditAccountId: account.id,
    userId: record.user_id,
    credits,
    idempotencyKey,
    source: "stripe_monthly_credit_grant",
      metadata: {
        grant_kind: "monthly_included",
        stripe_event_id: input.stripeEventId,
        stripe_customer_id: record.stripe_customer_id,
        stripe_subscription_id: record.stripe_subscription_id,
      plan_id: record.plan_id,
      subscription_status: record.status,
      current_period_start: record.current_period_start,
        current_period_end: record.current_period_end,
        overage_enabled: false,
      },
      idempotencyMetadata: {
        grant_kind: "monthly_included",
        stripe_subscription_id: record.stripe_subscription_id,
        plan_id: record.plan_id,
        subscription_status: record.status,
        current_period_start: record.current_period_start,
        current_period_end: record.current_period_end,
        overage_enabled: false,
      },
    });

  return { granted: true, kind: "monthly_included", credits, creditAccountId: account.id, idempotencyKey, ...grant };
}
