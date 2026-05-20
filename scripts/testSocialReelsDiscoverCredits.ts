import assert from "node:assert/strict";
import crypto from "node:crypto";

import {
  SOCIAL_REELS_DISCOVER_CREDITS_FEATURE_ENV,
  isSocialReelsDiscoverCreditsEnabled,
  runCreditAwareSocialReelsDiscovery,
} from "../lib/socialReelsDiscoverCredits";
import {
  calculateCreditBalance,
  grantCredits,
  SocialReelsCreditLedgerError,
  type AnalysisCacheEntryInsert,
  type AnalysisCacheEntryRow,
  type CreditLedgerEntryRow,
  type SourceAnalysisCandidateInsert,
  type SourceAnalysisCandidateRow,
  type SourceAnalysisJobRow,
  type SocialReelsCreditStore,
} from "../lib/socialReelsCreditLedger";
import { SocialReelsDiscoveryError, type DiscoverSocialReelsResult } from "../lib/openaiSocialReels";
import { socialReelsRequestSchema, type SocialReelsRequest } from "../lib/socialReelsSchema";

class FakeCreditStore implements SocialReelsCreditStore {
  accounts: Awaited<ReturnType<SocialReelsCreditStore["createCreditAccount"]>>[] = [];
  ledgerEntries: CreditLedgerEntryRow[] = [];
  jobs: SourceAnalysisJobRow[] = [];
  candidates: SourceAnalysisCandidateRow[] = [];
  cacheEntries: AnalysisCacheEntryRow[] = [];

  async findCreditAccountByUserId(userId: string) {
    return this.accounts.find((account) => account.owner_user_id === userId) || null;
  }

  async createCreditAccount(input: Parameters<SocialReelsCreditStore["createCreditAccount"]>[0]) {
    const account = {
      id: crypto.randomUUID(),
      owner_user_id: input.owner_user_id,
      account_type: "user" as const,
      organization_id: null,
      status: "active" as const,
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
    const entry = { ...input, id: crypto.randomUUID(), created_at: new Date().toISOString() };
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
    const job = {
      ...input,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.jobs.push(job);
    return job;
  }

  async updateSourceAnalysisJob(jobId: string, patch: Partial<Omit<SourceAnalysisJobRow, "id" | "created_at">>) {
    const index = this.jobs.findIndex((job) => job.id === jobId);
    assert(index >= 0, "job should exist");
    this.jobs[index] = { ...this.jobs[index], ...patch, updated_at: new Date().toISOString() };
    return this.jobs[index];
  }

  async insertSourceAnalysisCandidates(input: SourceAnalysisCandidateInsert[]) {
    for (const candidate of input) {
      const existing = this.candidates.find(
        (row) => row.source_analysis_job_id === candidate.source_analysis_job_id && row.candidate_id === candidate.candidate_id
      );
      if (existing) continue;
      this.candidates.push({
        ...candidate,
        id: crypto.randomUUID(),
        metadata_json: candidate.metadata_json || {},
        created_at: new Date().toISOString(),
      });
    }
  }

  async listSourceAnalysisCandidates(sourceAnalysisJobId: string) {
    return this.candidates
      .filter((candidate) => candidate.source_analysis_job_id === sourceAnalysisJobId)
      .sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999));
  }

  async findAnalysisCacheEntry(input: Parameters<NonNullable<SocialReelsCreditStore["findAnalysisCacheEntry"]>>[0]) {
    return (
      this.cacheEntries.find(
        (entry) =>
          entry.credit_account_id === input.creditAccountId &&
          entry.source_fingerprint === input.sourceFingerprint &&
          entry.transcript_normalization_hash === input.transcriptNormalizationHash &&
          entry.analysis_mode === input.analysisMode &&
          entry.prompt_version === input.promptVersion &&
          entry.schema_version === input.schemaVersion &&
          entry.status === "ready" &&
          JSON.stringify(entry.duration_buckets) === JSON.stringify(input.durationBuckets)
      ) || null
    );
  }

  async upsertAnalysisCacheEntry(input: AnalysisCacheEntryInsert) {
    const existingIndex = this.cacheEntries.findIndex(
      (entry) =>
        entry.credit_account_id === input.credit_account_id &&
        entry.source_fingerprint === input.source_fingerprint &&
        entry.transcript_normalization_hash === input.transcript_normalization_hash &&
        entry.analysis_mode === input.analysis_mode &&
        entry.prompt_version === input.prompt_version &&
        entry.schema_version === input.schema_version &&
        JSON.stringify(entry.duration_buckets) === JSON.stringify(input.duration_buckets)
    );
    const entry: AnalysisCacheEntryRow = {
      ...input,
      id: existingIndex >= 0 ? this.cacheEntries[existingIndex].id : crypto.randomUUID(),
      created_at: existingIndex >= 0 ? this.cacheEntries[existingIndex].created_at : new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_used_at: input.last_used_at ?? new Date().toISOString(),
    };
    if (existingIndex >= 0) this.cacheEntries[existingIndex] = entry;
    else this.cacheEntries.push(entry);
    return entry;
  }

  async touchAnalysisCacheEntry(cacheEntryId: string) {
    const entry = this.cacheEntries.find((candidate) => candidate.id === cacheEntryId);
    if (entry) entry.last_used_at = new Date().toISOString();
  }

  async grant(creditAccountId: string, credits: number) {
    return grantCredits({
      store: this,
      creditAccountId,
      userId: "user-1",
      credits,
      idempotencyKey: `grant:${creditAccountId}:${credits}`,
      source: "test_credit_grant",
      metadata: { test_grant: true },
    });
  }
}

function makeRequest(overrides: Record<string, unknown> = {}) {
  return {
    project_hash: "project-hash-1",
    project_fingerprint: "source-fingerprint-1",
    source_duration_seconds: 120,
    duration_preferences: ["15s", "30s"],
    requested_candidate_count: 30,
    style: "balanced",
    layout: "vertical",
    caption_style: "bold",
    episode_metadata: { title: "Credit discover test" },
    context: { platform: "social" },
    segments: [
      {
        segment_id: "seg-1",
        start_seconds: 0,
        end_seconds: 180,
        speaker: "Speaker 1",
        text: "The strongest clip starts with a clear claim, builds tension, and lands a payoff the viewer can understand.",
      },
    ],
    sourceMediaId: "source-media-1",
    sourceMediaFingerprint: "source-fingerprint-1",
    transcriptHash: "normalized-transcript-hash-1",
    durationBuckets: ["30s", "15s"],
    idempotencyKey: "discover:test:1",
    useCache: true,
    ...overrides,
  };
}

function parseRequest(payload: Record<string, unknown>) {
  return socialReelsRequestSchema.parse(payload);
}

function mockDiscoverResult(candidates: Array<Record<string, unknown>> = []): DiscoverSocialReelsResult {
  const responseCandidates = candidates.length > 0 ? candidates : [
    {
      candidate_id: "candidate-15s-1",
      duration_bucket: "15s",
      title: "The Clear Claim",
      hook: "The strongest clip starts with a clear claim.",
      summary: "A short clip with a complete hook and payoff.",
      start_seconds: 10,
      end_seconds: 25,
      duration_seconds: 15,
      score: 0.88,
    },
    {
      candidate_id: "candidate-30s-1",
      duration_bucket: "30s",
      title: "The Payoff",
      hook: "Build tension before the answer lands.",
      summary: "A longer clip that includes tension and payoff.",
      start_seconds: 30,
      end_seconds: 60,
      duration_seconds: 30,
      score: 0.9,
    },
  ];

  return {
    response: { candidates: responseCandidates as never, model_notes: null },
    matrixResponse: null,
    durationFirstManifest: null,
    editorialWordIdResponse: null,
    usage: null,
    providerResponseId: null,
    model: "mock",
    mock: true,
    requestedCandidateCount: 30,
    effectiveCandidateCount: 30,
    returnedCandidateCount: responseCandidates.length,
    filteredCandidateCount: 0,
    eligibleDurationWindowCount: null,
    windowsAfterQualityFilter: null,
    excludedWindowReasonCounts: null,
    averageWindowQualityScore: null,
    demotedWindowReasonCounts: null,
    selectedWindowQualityRange: null,
    selectedWindowQualityDistribution: null,
    selectedWindowReasonCounts: null,
    durationWindowCountSentToModel: null,
    promptContextCharCountSentToModel: null,
    liveFilterReasons: { duration_outside_bucket: 0 },
    returnedDurationSecondsRange: { min: 15, max: 30 },
    discoveryMode: "mock_full_pool",
    diagnostics: {
      mode: "mock",
      openaiRequestStartedAt: null,
      openaiElapsedMs: null,
      responseParseMs: null,
      provider: "mock",
      model: "mock",
      providerResponseId: null,
      durationWindowCountSentToModel: null,
      promptContextCharCountSentToModel: null,
      windowsAfterQualityFilter: null,
      excludedWindowReasonCounts: null,
      averageWindowQualityScore: null,
      demotedWindowReasonCounts: null,
      selectedWindowQualityRange: null,
      selectedWindowQualityDistribution: null,
      selectedWindowReasonCounts: null,
    },
  };
}

async function makeFundedStore(userId = "user-1", credits = 10) {
  const store = new FakeCreditStore();
  const account = await store.createCreditAccount({ owner_user_id: userId, metadata_json: {} });
  await store.grant(account.id, credits);
  return { store, account };
}

async function runWithStore(input: {
  store: FakeCreditStore;
  payload: Record<string, unknown>;
  request?: SocialReelsRequest;
  discover?: () => Promise<DiscoverSocialReelsResult>;
}) {
  const request = input.request ?? parseRequest(input.payload);
  return runCreditAwareSocialReelsDiscovery({
    rawPayload: input.payload,
    request,
    userId: "user-1",
    planId: "studio",
    store: input.store,
    discover: input.discover ?? (async () => mockDiscoverResult()),
  });
}

async function expectCreditError(code: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    assert.fail(`Expected ${code}`);
  } catch (error) {
    assert(error instanceof SocialReelsCreditLedgerError, `Expected SocialReelsCreditLedgerError for ${code}`);
    assert.equal(error.code, code);
  }
}

async function main() {
  const previousFlag = process.env[SOCIAL_REELS_DISCOVER_CREDITS_FEATURE_ENV];
  delete process.env[SOCIAL_REELS_DISCOVER_CREDITS_FEATURE_ENV];
  assert.equal(isSocialReelsDiscoverCreditsEnabled(), false, "Credit-aware discover flag should default off.");
  process.env[SOCIAL_REELS_DISCOVER_CREDITS_FEATURE_ENV] = "true";
  assert.equal(isSocialReelsDiscoverCreditsEnabled(), true, "Credit-aware discover flag should enable with true.");
  if (previousFlag === undefined) delete process.env[SOCIAL_REELS_DISCOVER_CREDITS_FEATURE_ENV];
  else process.env[SOCIAL_REELS_DISCOVER_CREDITS_FEATURE_ENV] = previousFlag;

  {
    const store = new FakeCreditStore();
    let discoverCalls = 0;
    await expectCreditError("insufficient_credits", () =>
      runWithStore({
        store,
        payload: makeRequest(),
        discover: async () => {
          discoverCalls += 1;
          return mockDiscoverResult();
        },
      })
    );
    assert.equal(discoverCalls, 0, "Insufficient credits should block provider work.");
  }

  {
    const { store, account } = await makeFundedStore();
    let discoverCalls = 0;
    const outcome = await runWithStore({
      store,
      payload: makeRequest(),
      discover: async () => {
        discoverCalls += 1;
        return mockDiscoverResult();
      },
    });
    assert.equal(discoverCalls, 1);
    assert.equal(outcome.billing.creditsRequired, 2);
    assert.equal(outcome.billing.creditsCharged, 2);
    assert.equal(outcome.groups.length, 2, "Successful generation should return multiple duration groups.");
    const balance = calculateCreditBalance(await store.listLedgerEntries(account.id));
    assert.equal(balance.availableCredits, 8);
    assert.equal(balance.consumedCredits, 2);
    assert.equal(store.ledgerEntries.filter((entry) => entry.entry_type === "capture").length, 1);
  }

  {
    const { store } = await makeFundedStore();
    let discoverCalls = 0;
    await runWithStore({
      store,
      payload: makeRequest({ useCache: false }),
      discover: async () => {
        discoverCalls += 1;
        return mockDiscoverResult();
      },
    });
    const retry = await runWithStore({
      store,
      payload: makeRequest({ useCache: false }),
      discover: async () => {
        discoverCalls += 1;
        return mockDiscoverResult();
      },
    });
    assert.equal(discoverCalls, 1, "Idempotent retry should not call provider twice.");
    assert.equal(retry.billing.cacheStatus, "idempotent_replay");
    assert.equal(store.ledgerEntries.filter((entry) => entry.entry_type === "capture").length, 1);
  }

  {
    const { store, account } = await makeFundedStore();
    let discoverCalls = 0;
    await assert.rejects(
      () =>
        runWithStore({
          store,
          payload: makeRequest({ idempotencyKey: "discover:failure:1", useCache: false }),
          discover: async () => {
            discoverCalls += 1;
            throw new SocialReelsDiscoveryError("Invalid provider schema.", { stage: "openai_invalid_response" });
          },
        }),
      SocialReelsDiscoveryError
    );
    assert.equal(discoverCalls, 1);
    const balance = calculateCreditBalance(await store.listLedgerEntries(account.id));
    assert.equal(balance.availableCredits, 10, "Failed provider work should release reservation.");
    assert.equal(balance.reservedCredits, 0);
    assert.equal(store.ledgerEntries.filter((entry) => entry.entry_type === "release").length, 1);
  }

  {
    const { store } = await makeFundedStore();
    let discoverCalls = 0;
    await runWithStore({
      store,
      payload: makeRequest({ idempotencyKey: "discover:cache-fill:1" }),
      discover: async () => {
        discoverCalls += 1;
        return mockDiscoverResult();
      },
    });
    const cached = await runWithStore({
      store,
      payload: makeRequest({ idempotencyKey: "discover:cache-hit:2" }),
      discover: async () => {
        discoverCalls += 1;
        return mockDiscoverResult();
      },
    });
    assert.equal(discoverCalls, 1, "Cache hit should skip provider work.");
    assert.equal(cached.status, "cached");
    assert.equal(cached.billing.creditsCharged, 0);
    assert.equal(cached.billing.noFullSourceMinuteCharge, true);
  }

  {
    const { store } = await makeFundedStore();
    await runWithStore({ store, payload: makeRequest({ idempotencyKey: "discover:conflict:1", useCache: false }) });
    await expectCreditError("idempotency_key_conflict", () =>
      runWithStore({
        store,
        payload: makeRequest({
          idempotencyKey: "discover:conflict:1",
          sourceDurationSeconds: 180,
          source_duration_seconds: 180,
          useCache: false,
        }),
      })
    );
  }

  {
    const { store } = await makeFundedStore();
    const outcome = await runWithStore({ store, payload: makeRequest({ durationBuckets: ["30s", "15s", "30s"] }) });
    assert.equal(outcome.billing.creditsRequired, 2, "Duration bucket count should not change source-minute charge.");
    const serialized = JSON.stringify(outcome);
    for (const forbidden of ["platformRisk", "brandSafety", "advertiserSafety", "sexualRisk", "controversyRisk"]) {
      assert(!serialized.includes(forbidden), `Credit-aware discover output should not include forbidden field ${forbidden}.`);
    }
  }

  console.log("Social Reels credit-aware discover endpoint tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
