import assert from "node:assert/strict";
import type Stripe from "stripe";

import type {
  CreditAccountRow,
  CreditLedgerEntryRow,
  JsonSafeValue,
  SocialReelsCreditStore,
  SourceAnalysisCandidateInsert,
  SourceAnalysisJobRow,
} from "../lib/socialReelsCreditLedger";

process.env.STRIPE_SECRET_KEY ||= "sk_test_social_reels_credit_mapping";
process.env.STRIPE_PRICE_STARTER ||= "price_test_starter";
process.env.STRIPE_PRICE_CREATOR_PRO ||= "price_test_creator_pro";
process.env.STRIPE_PRICE_STUDIO ||= "price_test_studio";

const creditLedger = await import("../lib/socialReelsCreditLedger");
const stripeCredits = await import("../lib/socialReelsStripeCredits");

class InMemoryCreditStore implements SocialReelsCreditStore {
  accounts: CreditAccountRow[] = [];
  ledgerEntries: CreditLedgerEntryRow[] = [];
  jobs: SourceAnalysisJobRow[] = [];
  candidates: SourceAnalysisCandidateInsert[] = [];
  private nextId = 1;

  private id(prefix: string) {
    return `${prefix}_${String(this.nextId++).padStart(4, "0")}`;
  }

  async findCreditAccountByUserId(userId: string) {
    return this.accounts.find((account) => account.owner_user_id === userId && account.account_type === "user") || null;
  }

  async createCreditAccount(input: {
    owner_user_id: string;
    plan_id?: string | null;
    current_subscription_id?: string | null;
    metadata_json?: Record<string, JsonSafeValue>;
  }) {
    const account: CreditAccountRow = {
      id: this.id("acct"),
      owner_user_id: input.owner_user_id,
      account_type: "user",
      organization_id: null,
      status: "active",
      current_subscription_id: input.current_subscription_id ?? null,
      plan_id: input.plan_id ?? null,
      metadata_json: input.metadata_json || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.accounts.push(account);
    return account;
  }

  async listLedgerEntries(creditAccountId: string) {
    return this.ledgerEntries.filter((entry) => entry.credit_account_id === creditAccountId);
  }

  async findLedgerEntryById(ledgerEntryId: string) {
    return this.ledgerEntries.find((entry) => entry.id === ledgerEntryId) || null;
  }

  async findLedgerEntryByIdempotencyKey(creditAccountId: string, idempotencyKey: string) {
    return this.ledgerEntries.find((entry) => entry.credit_account_id === creditAccountId && entry.idempotency_key === idempotencyKey) || null;
  }

  async insertLedgerEntry(input: Omit<CreditLedgerEntryRow, "id" | "created_at">) {
    const existing = await this.findLedgerEntryByIdempotencyKey(input.credit_account_id, input.idempotency_key);
    if (existing) throw new Error("duplicate ledger idempotency key");
    const entry: CreditLedgerEntryRow = {
      ...input,
      id: this.id("ledger"),
      created_at: new Date().toISOString(),
    };
    this.ledgerEntries.push(entry);
    return entry;
  }

  async findSourceAnalysisJobById(jobId: string) {
    return this.jobs.find((job) => job.id === jobId) || null;
  }

  async findSourceAnalysisJobByIdempotencyKey(creditAccountId: string, idempotencyKey: string) {
    return this.jobs.find((job) => job.credit_account_id === creditAccountId && job.idempotency_key === idempotencyKey) || null;
  }

  async insertSourceAnalysisJob(input: Omit<SourceAnalysisJobRow, "id" | "created_at" | "updated_at">) {
    const job: SourceAnalysisJobRow = {
      ...input,
      id: this.id("job"),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.jobs.push(job);
    return job;
  }

  async updateSourceAnalysisJob(jobId: string, patch: Partial<Omit<SourceAnalysisJobRow, "id" | "created_at">>) {
    const job = await this.findSourceAnalysisJobById(jobId);
    if (!job) throw new Error("missing job");
    Object.assign(job, patch, { updated_at: new Date().toISOString() });
    return job;
  }

  async insertSourceAnalysisCandidates(input: SourceAnalysisCandidateInsert[]) {
    this.candidates.push(...input);
  }
}

function makeSubscription(input: {
  id?: string;
  priceId?: string;
  userId?: string;
  status?: Stripe.Subscription.Status;
  periodStart?: number;
  periodEnd?: number;
}): Stripe.Subscription {
  return {
    id: input.id || "sub_test_001",
    customer: "cus_test_001",
    status: input.status || "active",
    metadata: {
      userId: input.userId || "user_test_001",
      planId: "starter",
      stripe_price_id: input.priceId || process.env.STRIPE_PRICE_STARTER,
    },
    current_period_start: input.periodStart ?? 1_770_000_000,
    current_period_end: input.periodEnd ?? 1_772_592_000,
    items: {
      data: [
        {
          price: {
            id: input.priceId || process.env.STRIPE_PRICE_STARTER,
          },
        },
      ],
    },
  } as unknown as Stripe.Subscription;
}

async function expectCreditError(code: string, fn: () => Promise<unknown> | unknown) {
  try {
    await fn();
  } catch (error) {
    assert(error instanceof creditLedger.SocialReelsCreditLedgerError, `Expected SocialReelsCreditLedgerError, got ${error}`);
    assert.equal(error.code, code);
    return;
  }
  throw new Error(`Expected ${code}`);
}

const starterMapping = stripeCredits.getSocialReelsPlanCreditMappingForStripePrice(process.env.STRIPE_PRICE_STARTER);
assert.equal(starterMapping.planId, "starter");
assert.equal(starterMapping.includedMonthlyCredits, 15 * 60);
assert.equal(starterMapping.overageEnabled, false);
assert.equal(stripeCredits.getSocialReelsPlanCreditMappings().creator_pro.includedMonthlyCredits, 50 * 60);
assert.equal(stripeCredits.getSocialReelsPlanCreditMappings().studio.includedMonthlyCredits, 120 * 60);
assert.equal(stripeCredits.getTrialIncludedCredits(), 240);

await expectCreditError("unknown_stripe_price", () => stripeCredits.getSocialReelsPlanCreditMappingForStripePrice("price_unknown"));

const unknownStore = new InMemoryCreditStore();
const unknownResult = await stripeCredits.grantStripeSubscriptionCredits({
  store: unknownStore,
  stripeEventId: "evt_unknown_price",
  subscription: makeSubscription({ priceId: "price_unknown" }),
});
assert.equal(unknownResult.granted, false);
assert.equal(unknownResult.reason, "subscription_not_account_backed");
assert.equal(unknownStore.ledgerEntries.length, 0);

const store = new InMemoryCreditStore();
const subscription = makeSubscription({});
const firstGrant = await stripeCredits.grantStripeSubscriptionCredits({
  store,
  stripeEventId: "evt_monthly_created",
  subscription,
});
assert.equal(firstGrant.granted, true);
assert.equal(firstGrant.credits, 900);
assert.equal(firstGrant.entry.entry_type, "grant");
assert.equal(firstGrant.entry.balance_effect, "increase_available");
assert.equal(firstGrant.entry.metadata_json.stripe_event_id, "evt_monthly_created");
assert.equal(firstGrant.entry.metadata_json.overage_enabled, false);
assert.equal(firstGrant.balance.availableCredits, 900);

const replayGrant = await stripeCredits.grantStripeSubscriptionCredits({
  store,
  stripeEventId: "evt_monthly_created",
  subscription,
});
assert.equal(replayGrant.granted, true);
assert.equal(replayGrant.idempotent, true);
assert.equal(store.ledgerEntries.length, 1, "Webhook replay should not duplicate a monthly grant.");

const samePeriodDifferentEvent = await stripeCredits.grantStripeSubscriptionCredits({
  store,
  stripeEventId: "evt_invoice_paid_same_period",
  subscription,
});
assert.equal(samePeriodDifferentEvent.granted, true);
assert.equal(samePeriodDifferentEvent.idempotent, true);
assert.equal(store.ledgerEntries.length, 1, "Invoice plus subscription events for the same period should not double-grant.");

const nextPeriod = await stripeCredits.grantStripeSubscriptionCredits({
  store,
  stripeEventId: "evt_invoice_paid_next_period",
  subscription: makeSubscription({ periodStart: 1_772_592_001, periodEnd: 1_775_184_001 }),
});
assert.equal(nextPeriod.granted, true);
assert.equal(nextPeriod.idempotent, false);
assert.equal(store.ledgerEntries.length, 2, "A new subscription period should grant included monthly credits.");
assert.equal(nextPeriod.balance.availableCredits, 1800);

const trialStore = new InMemoryCreditStore();
const trialSubscription = makeSubscription({ id: "sub_trial_001", status: "trialing" });
const trialGrant = await stripeCredits.grantStripeSubscriptionCredits({
  store: trialStore,
  stripeEventId: "evt_trial_created",
  subscription: trialSubscription,
});
assert.equal(trialGrant.granted, true);
assert.equal(trialGrant.kind, "trial");
assert.equal(trialGrant.credits, 240);
assert.equal(trialGrant.balance.availableCredits, 240);

const trialReplay = await stripeCredits.grantStripeSubscriptionCredits({
  store: trialStore,
  stripeEventId: "evt_trial_updated",
  subscription: trialSubscription,
});
assert.equal(trialReplay.granted, true);
assert.equal(trialReplay.idempotent, true);
assert.equal(trialStore.ledgerEntries.length, 1, "Trial credit grant should be idempotent across trial subscription events.");

const metadataJson = JSON.stringify([...store.ledgerEntries, ...trialStore.ledgerEntries].map((entry) => entry.metadata_json));
for (const forbidden of ["/Users/", "file://", "Bearer ", "OPENAI_API_KEY", "rawTranscript", "raw_word_json", "refresh_token", "access_token"]) {
  assert(!metadataJson.includes(forbidden), `Grant metadata should not include ${forbidden}`);
}

const balance = creditLedger.calculateCreditBalance(store.ledgerEntries);
assert.equal(balance.availableCredits, 1800);
assert.equal(balance.grantedCredits, 1800);

console.log("Social Reels Stripe credit mapping tests passed.");
