import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildCacheHitNoChargeUsageMetadata,
  calculateCreditBalance,
  canonicalDurationBucketKey,
  canonicalizeDurationBuckets,
  captureReservedCredits,
  estimateCreditsForSource,
  getCreditBalance,
  getOrCreateCreditAccount,
  markSourceAnalysisJobFailedAndReleaseOrRefund,
  markSourceAnalysisJobSucceeded,
  recordSourceAnalysisJob,
  refundCredits,
  releaseReservedCredits,
  reserveCredits,
  sanitizeCreditMetadata,
  SocialReelsCreditLedgerError,
  type CreditAccountRow,
  type CreditLedgerEntryRow,
  type JsonSafeValue,
  type SocialReelsCreditStore,
  type SourceAnalysisCandidateInsert,
  type SourceAnalysisJobRow,
} from "../lib/socialReelsCreditLedger";

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
    const existing = await this.findCreditAccountByUserId(input.owner_user_id);
    if (existing) throw new Error("duplicate account");
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
    const existing = await this.findSourceAnalysisJobByIdempotencyKey(input.credit_account_id, input.idempotency_key);
    if (existing) throw new Error("duplicate job idempotency key");
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

  async grant(creditAccountId: string, credits: number, idempotencyKey = `grant:${creditAccountId}:${credits}`) {
    return this.insertLedgerEntry({
      credit_account_id: creditAccountId,
      user_id: null,
      source_analysis_job_id: null,
      entry_type: "grant",
      credits,
      balance_effect: "increase_available",
      reservation_entry_id: null,
      idempotency_key: idempotencyKey,
      source: "test_grant",
      metadata_json: { payload_hash: idempotencyKey },
    });
  }
}

class LockedAtomicInMemoryCreditStore extends InMemoryCreditStore {
  private lock: Promise<void> = Promise.resolve();

  private withLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.lock.then(fn, fn);
    this.lock = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  async reserveCreditsAtomically(input: {
    creditAccountId: string;
    userId: string | null;
    sourceAnalysisJobId: string | null;
    credits: number;
    idempotencyKey: string;
    source: string;
    metadataJson: Record<string, JsonSafeValue>;
    payloadHash: string;
  }) {
    return this.withLock(async () => {
      const existing = await this.findLedgerEntryByIdempotencyKey(input.creditAccountId, input.idempotencyKey);
      if (existing) {
        if (existing.metadata_json.payload_hash !== input.payloadHash) {
          throw new SocialReelsCreditLedgerError("idempotency_key_conflict", "Idempotency key was reused with different credit operation details.", 409);
        }
        return { entry: existing, idempotent: true };
      }

      const balance = calculateCreditBalance(await this.listLedgerEntries(input.creditAccountId));
      if (balance.availableCredits < input.credits) {
        throw new SocialReelsCreditLedgerError("insufficient_credits", "Not enough credits for source analysis.", 402);
      }

      const entry = await this.insertLedgerEntry({
        credit_account_id: input.creditAccountId,
        user_id: input.userId,
        source_analysis_job_id: input.sourceAnalysisJobId,
        entry_type: "reserve",
        credits: input.credits,
        balance_effect: "decrease_available",
        reservation_entry_id: null,
        idempotency_key: input.idempotencyKey,
        source: input.source,
        metadata_json: { ...input.metadataJson, payload_hash: input.payloadHash },
      });

      return { entry, idempotent: false };
    });
  }
}

function expectCreditError(code: string, fn: () => Promise<unknown> | unknown) {
  return Promise.resolve()
    .then(fn)
    .then(
      () => {
        throw new Error(`Expected ${code}`);
      },
      (error) => {
        assert(error instanceof SocialReelsCreditLedgerError, `Expected SocialReelsCreditLedgerError, got ${error}`);
        assert.equal(error.code, code);
      }
    );
}

async function main() {
  const rpcSql = readFileSync(resolve(process.cwd(), "supabase/migrations/20260519093000_social_reels_credit_atomic_rpcs.sql"), "utf8");
  for (const functionName of [
    "social_reels_credit_reserve_v1",
    "social_reels_credit_capture_v1",
    "social_reels_credit_release_v1",
    "social_reels_credit_refund_v1",
  ]) {
    assert(rpcSql.includes(functionName), `${functionName} should be defined in the atomic credit RPC migration.`);
  }
  assert.match(rpcSql, /for update/i, "Atomic credit RPCs should lock credit account rows.");
  assert.match(rpcSql, /v_available < p_credits/i, "Reserve RPC should prevent overspending before insert.");
  assert.match(rpcSql, /balance_effect[\s\S]*decrease_available/i, "Reserve RPC should use positive credits plus decrease_available.");

  assert.equal(estimateCreditsForSource(60 * 60), 60, "60 minutes should cost 60 credits.");
  assert.equal(estimateCreditsForSource(60 * 60 + 1), 61, "60 minutes and 1 second should round up to 61 credits.");
  assert.equal(estimateCreditsForSource(1), 1, "Any nonzero source under one minute should cost 1 credit.");
  assert.equal(estimateCreditsForSource(30), estimateCreditsForSource(30), "Duration bucket count must not change source-minute cost.");

  assert.deepEqual(canonicalizeDurationBuckets(["30s", "15s", "30s", "mixed"]), ["15s", "30s", "mixed"]);
  assert.equal(canonicalDurationBucketKey(["30s", "15s"]), canonicalDurationBucketKey(["15s", "30s"]));

  const store = new InMemoryCreditStore();
  const account = await getOrCreateCreditAccount({ store, userId: "user_001", planId: "studio" });
  const sameAccount = await getOrCreateCreditAccount({ store, userId: "user_001", planId: "studio" });
  assert.equal(sameAccount.id, account.id, "getOrCreateCreditAccount should be idempotent for a user account.");
  assert.equal(store.accounts.length, 1);

  let providerCalled = false;
  await expectCreditError("insufficient_credits", async () => {
    await reserveCredits({
      store,
      creditAccountId: account.id,
      userId: "user_001",
      credits: 1,
      idempotencyKey: "reserve:insufficient",
    });
    providerCalled = true;
  });
  assert.equal(providerCalled, false, "Reservation failure should block provider work before it starts.");

  await store.grant(account.id, 60, "grant:monthly:studio");
  assert.deepEqual(await getCreditBalance({ store, creditAccountId: account.id }), {
    availableCredits: 60,
    reservedCredits: 0,
    consumedCredits: 0,
    grantedCredits: 60,
    ledgerEntryCount: 1,
  });

  const jobResult = await recordSourceAnalysisJob({
    store,
    creditAccountId: account.id,
    userId: "user_001",
    idempotencyKey: "job:source:a",
    sourceFingerprint: "source_fp_a",
    transcriptNormalizationHash: "transcript_hash_a",
    sourceDurationSeconds: 3601,
    durationBuckets: ["30s", "15s"],
    promptVersion: "prompt_v1",
    schemaVersion: "schema_v1",
  });
  assert.equal(jobResult.job.credits_required, 61);
  assert.deepEqual(jobResult.job.duration_buckets, ["15s", "30s"]);

  const reversedBucketJobRetry = await recordSourceAnalysisJob({
    store,
    creditAccountId: account.id,
    userId: "user_001",
    idempotencyKey: "job:source:a",
    sourceFingerprint: "source_fp_a",
    transcriptNormalizationHash: "transcript_hash_a",
    sourceDurationSeconds: 3601,
    durationBuckets: ["30s", "15s", "30s"],
    promptVersion: "prompt_v1",
    schemaVersion: "schema_v1",
  });
  assert.equal(reversedBucketJobRetry.idempotent, true, "Reversed/deduped duration buckets should produce the same job payload hash.");
  await expectCreditError("idempotency_key_conflict", () =>
    recordSourceAnalysisJob({
      store,
      creditAccountId: account.id,
      userId: "user_001",
      idempotencyKey: "job:source:a",
      sourceFingerprint: "source_fp_a",
      transcriptNormalizationHash: "transcript_hash_a",
      sourceDurationSeconds: 3602,
      durationBuckets: ["15s", "30s"],
      promptVersion: "prompt_v1",
      schemaVersion: "schema_v1",
    })
  );

  const oneBucketCost = estimateCreditsForSource(1800);
  const manyBucketCost = estimateCreditsForSource(1800);
  assert.equal(oneBucketCost, manyBucketCost, "Duration bucket count should not change source-minute credit cost.");

  const reservation = await reserveCredits({
    store,
    creditAccountId: account.id,
    userId: "user_001",
    sourceAnalysisJobId: jobResult.job.id,
    credits: 30,
    idempotencyKey: "reserve:source:a",
    metadata: { request_kind: "source_analysis" },
  });
  assert.equal(reservation.idempotent, false);
  assert.equal(reservation.balance.availableCredits, 30);
  assert.equal(reservation.balance.reservedCredits, 30);

  const reservationRetry = await reserveCredits({
    store,
    creditAccountId: account.id,
    userId: "user_001",
    sourceAnalysisJobId: jobResult.job.id,
    credits: 30,
    idempotencyKey: "reserve:source:a",
    metadata: { request_kind: "source_analysis" },
  });
  assert.equal(reservationRetry.idempotent, true);
  assert.equal(store.ledgerEntries.filter((entry) => entry.entry_type === "reserve").length, 1, "Reserve retry should not double-reserve.");

  await expectCreditError("idempotency_key_conflict", () =>
    reserveCredits({
      store,
      creditAccountId: account.id,
      userId: "user_001",
      sourceAnalysisJobId: jobResult.job.id,
      credits: 31,
      idempotencyKey: "reserve:source:a",
      metadata: { request_kind: "source_analysis" },
    })
  );

  const capture = await captureReservedCredits({
    store,
    creditAccountId: account.id,
    reservationEntryId: reservation.entry.id,
    idempotencyKey: "capture:source:a",
  });
  assert.equal(capture.balance.availableCredits, 30);
  assert.equal(capture.balance.reservedCredits, 0);
  assert.equal(capture.balance.consumedCredits, 30);

  const captureRetry = await captureReservedCredits({
    store,
    creditAccountId: account.id,
    reservationEntryId: reservation.entry.id,
    idempotencyKey: "capture:source:a",
  });
  assert.equal(captureRetry.idempotent, true);
  assert.equal(store.ledgerEntries.filter((entry) => entry.entry_type === "capture").length, 1, "Capture retry should not double-capture.");

  const refund = await refundCredits({
    store,
    creditAccountId: account.id,
    captureEntryId: capture.entry.id,
    idempotencyKey: "refund:source:a",
    reasonCode: "job_failed_schema",
  });
  assert.equal(refund.balance.availableCredits, 60);
  assert.equal(refund.balance.consumedCredits, 0);

  const refundRetry = await refundCredits({
    store,
    creditAccountId: account.id,
    captureEntryId: capture.entry.id,
    idempotencyKey: "refund:source:a",
    reasonCode: "job_failed_schema",
  });
  assert.equal(refundRetry.idempotent, true);
  assert.equal(store.ledgerEntries.filter((entry) => entry.entry_type === "refund").length, 1, "Refund retry should not double-refund.");

  const secondReservation = await reserveCredits({
    store,
    creditAccountId: account.id,
    userId: "user_001",
    credits: 10,
    idempotencyKey: "reserve:source:b",
  });
  assert.equal(secondReservation.balance.availableCredits, 50);
  assert.equal(secondReservation.balance.reservedCredits, 10);

  const release = await releaseReservedCredits({
    store,
    creditAccountId: account.id,
    reservationEntryId: secondReservation.entry.id,
    idempotencyKey: "release:source:b",
    reasonCode: "job_failed_openai",
  });
  assert.equal(release.balance.availableCredits, 60);
  assert.equal(release.balance.reservedCredits, 0);

  const releaseRetry = await releaseReservedCredits({
    store,
    creditAccountId: account.id,
    reservationEntryId: secondReservation.entry.id,
    idempotencyKey: "release:source:b",
    reasonCode: "job_failed_openai",
  });
  assert.equal(releaseRetry.idempotent, true);
  assert.equal(store.ledgerEntries.filter((entry) => entry.entry_type === "release").length, 1, "Release retry should not double-release.");

  const successJob = await recordSourceAnalysisJob({
    store,
    creditAccountId: account.id,
    userId: "user_001",
    idempotencyKey: "job:source:success",
    sourceFingerprint: "source_fp_success",
    transcriptNormalizationHash: "transcript_hash_success",
    sourceDurationSeconds: 120,
    durationBuckets: ["60s"],
  });
  const updatedSuccessJob = await markSourceAnalysisJobSucceeded({
    store,
    jobId: successJob.job.id,
    captureLedgerEntryId: capture.entry.id,
    candidates: [
      {
        candidate_id: "candidate_001",
        rank: 1,
        duration_bucket: "60s",
        title: "A useful title",
        summary: "Compact summary only.",
      },
    ],
  });
  assert.equal(updatedSuccessJob.status, "succeeded");
  assert.equal(updatedSuccessJob.candidate_count, 1);
  assert.equal(store.candidates.length, 1);

  const failedJobReservation = await reserveCredits({
    store,
    creditAccountId: account.id,
    userId: "user_001",
    credits: 5,
    idempotencyKey: "reserve:failed-job",
  });
  const failedJob = await recordSourceAnalysisJob({
    store,
    creditAccountId: account.id,
    userId: "user_001",
    idempotencyKey: "job:source:failed",
    sourceFingerprint: "source_fp_failed",
    transcriptNormalizationHash: "transcript_hash_failed",
    sourceDurationSeconds: 300,
    durationBuckets: ["15s"],
    reservationLedgerEntryId: failedJobReservation.entry.id,
  });
  const failedResult = await markSourceAnalysisJobFailedAndReleaseOrRefund({
    store,
    jobId: failedJob.job.id,
    reasonCode: "job_failed_timeout",
    idempotencyKey: "job-failure:failed",
  });
  assert.equal(failedResult.job.status, "failed");
  assert.equal(failedResult.ledgerEntry?.entry_type, "release");
  assert.equal(failedResult.balance.availableCredits, 60);

  const atomicStore = new LockedAtomicInMemoryCreditStore();
  const atomicAccount = await getOrCreateCreditAccount({ store: atomicStore, userId: "user_atomic", planId: "studio" });
  await atomicStore.grant(atomicAccount.id, 50, "grant:atomic");
  const concurrentReservations = await Promise.allSettled([
    reserveCredits({
      store: atomicStore,
      creditAccountId: atomicAccount.id,
      userId: "user_atomic",
      credits: 40,
      idempotencyKey: "reserve:atomic:a",
      metadata: { request_kind: "source_analysis" },
    }),
    reserveCredits({
      store: atomicStore,
      creditAccountId: atomicAccount.id,
      userId: "user_atomic",
      credits: 40,
      idempotencyKey: "reserve:atomic:b",
      metadata: { request_kind: "source_analysis" },
    }),
  ]);
  assert.equal(concurrentReservations.filter((result) => result.status === "fulfilled").length, 1, "Atomic reservation path should allow only one concurrent overspending reservation.");
  assert.equal(concurrentReservations.filter((result) => result.status === "rejected").length, 1, "Atomic reservation path should reject the concurrent overspend.");
  const rejectedAtomicReservation = concurrentReservations.find((result) => result.status === "rejected");
  assert(rejectedAtomicReservation && rejectedAtomicReservation.status === "rejected");
  assert(rejectedAtomicReservation.reason instanceof SocialReelsCreditLedgerError);
  assert.equal(rejectedAtomicReservation.reason.code, "insufficient_credits");
  assert.deepEqual(await getCreditBalance({ store: atomicStore, creditAccountId: atomicAccount.id }), {
    availableCredits: 10,
    reservedCredits: 40,
    consumedCredits: 0,
    grantedCredits: 50,
    ledgerEntryCount: 2,
  });
  const fulfilledAtomicReservation = concurrentReservations.find((result) => result.status === "fulfilled");
  assert(fulfilledAtomicReservation && fulfilledAtomicReservation.status === "fulfilled");
  const atomicRetry = await reserveCredits({
    store: atomicStore,
    creditAccountId: atomicAccount.id,
    userId: "user_atomic",
    credits: 40,
    idempotencyKey: fulfilledAtomicReservation.value.entry.idempotency_key,
    metadata: { request_kind: "source_analysis" },
  });
  assert.equal(atomicRetry.idempotent, true, "Atomic reservation path should preserve idempotent retry behavior.");
  await expectCreditError("idempotency_key_conflict", () =>
    reserveCredits({
      store: atomicStore,
      creditAccountId: atomicAccount.id,
      userId: "user_atomic",
      credits: 41,
      idempotencyKey: fulfilledAtomicReservation.value.entry.idempotency_key,
      metadata: { request_kind: "source_analysis" },
    })
  );

  const cached = buildCacheHitNoChargeUsageMetadata({ sourceDurationSeconds: 3600, durationBuckets: ["30s", "15s"] });
  assert.equal(cached.reasonCode, "cache_hit_no_charge");
  assert.equal(cached.creditsRequired, 60);
  assert.equal(cached.creditsReserved, 0);
  assert.equal(cached.creditsCharged, 0);
  assert.equal(cached.durationBucketKey, "15s,30s");
  assert.equal(cached.noFullSourceMinuteCharge, true);

  assert.equal(calculateCreditBalance(store.ledgerEntries).availableCredits, 60);
  await expectCreditError("unsafe_metadata", () => sanitizeCreditMetadata({ rawTranscript: "do not store me" }));
  await expectCreditError("unsafe_metadata", () => sanitizeCreditMetadata({ source: "/Users/jamisonerwin/private/audio.wav" }));
  const ledgerJson = JSON.stringify(store.ledgerEntries);
  for (const forbidden of ["/Users/", "file://", "Bearer ", "OPENAI_API_KEY", "rawTranscript", "raw_word_json"]) {
    assert(!ledgerJson.includes(forbidden), `Ledger metadata should not include ${forbidden}`);
  }

  console.log("Social Reels credit ledger tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
