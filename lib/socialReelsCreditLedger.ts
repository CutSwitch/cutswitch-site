import crypto from "crypto";

export const SOCIAL_REELS_SOURCE_MINUTE_CREDIT_UNIT = "source_media_minute" as const;
export const SOCIAL_REELS_CREDIT_REASON_CODES = [
  "insufficient_credits",
  "credit_account_missing",
  "credit_reservation_failed",
  "credit_grant_failed",
  "credit_capture_failed",
  "credit_release_failed",
  "credit_refund_failed",
  "idempotency_key_conflict",
  "job_failed_openai",
  "job_failed_schema",
  "job_failed_timeout",
  "cache_hit_no_charge",
  "invalid_source_duration",
  "invalid_duration_bucket",
  "unsafe_metadata",
  "unknown_stripe_price",
] as const;

export const SOCIAL_REELS_CREDIT_DURATION_BUCKETS = ["15s", "30s", "60s", "90s", "mixed"] as const;

export type SocialReelsCreditReasonCode = (typeof SOCIAL_REELS_CREDIT_REASON_CODES)[number];
export type SocialReelsCreditDurationBucket = (typeof SOCIAL_REELS_CREDIT_DURATION_BUCKETS)[number];
export type CreditLedgerEntryType =
  | "grant"
  | "reserve"
  | "capture"
  | "debit"
  | "refund"
  | "release"
  | "adjustment"
  | "overage";
export type CreditBalanceEffect = "increase_available" | "decrease_available" | "increase_reserved" | "decrease_reserved" | "none";
export type SourceAnalysisJobStatus =
  | "created"
  | "checking_credits"
  | "reserved"
  | "running"
  | "succeeded"
  | "failed"
  | "refunded"
  | "cached"
  | "cancelled";

export type JsonSafeValue = null | boolean | number | string | JsonSafeValue[] | { [key: string]: JsonSafeValue };

export type CreditAccountRow = {
  id: string;
  owner_user_id: string | null;
  account_type: "user" | "organization";
  organization_id: string | null;
  status: "active" | "suspended" | "closed";
  current_subscription_id: string | null;
  plan_id: string | null;
  metadata_json: Record<string, JsonSafeValue>;
  created_at?: string;
  updated_at?: string;
};

export type CreditLedgerEntryRow = {
  id: string;
  credit_account_id: string;
  user_id: string | null;
  source_analysis_job_id: string | null;
  entry_type: CreditLedgerEntryType;
  credits: number;
  balance_effect: CreditBalanceEffect;
  reservation_entry_id: string | null;
  idempotency_key: string;
  source: string;
  metadata_json: Record<string, JsonSafeValue>;
  created_at?: string;
};

export type SourceAnalysisJobRow = {
  id: string;
  credit_account_id: string;
  user_id: string | null;
  status: SourceAnalysisJobStatus;
  idempotency_key: string;
  source_fingerprint: string;
  transcript_normalization_hash: string;
  source_duration_seconds: number;
  credits_required: number;
  duration_buckets: SocialReelsCreditDurationBucket[];
  reservation_ledger_entry_id: string | null;
  capture_ledger_entry_id: string | null;
  cache_entry_id: string | null;
  analysis_mode: string;
  prompt_version: string | null;
  schema_version: string | null;
  provider: string | null;
  model: string | null;
  candidate_count: number;
  error_code: string | null;
  error_message: string | null;
  metadata_json: Record<string, JsonSafeValue>;
  created_at?: string;
  started_at?: string | null;
  completed_at?: string | null;
  updated_at?: string;
};

export type SourceAnalysisCandidateInsert = {
  source_analysis_job_id: string;
  candidate_id: string;
  rank?: number | null;
  duration_bucket?: SocialReelsCreditDurationBucket | null;
  title?: string | null;
  summary?: string | null;
  source_start_word_id?: string | null;
  source_end_word_id?: string | null;
  metadata_json?: Record<string, JsonSafeValue>;
};

export type SourceAnalysisCandidateRow = SourceAnalysisCandidateInsert & {
  id: string;
  created_at?: string;
};

export type AnalysisCacheEntryRow = {
  id: string;
  credit_account_id: string;
  source_fingerprint: string;
  transcript_normalization_hash: string;
  analysis_mode: string;
  prompt_version: string;
  schema_version: string;
  duration_buckets: SocialReelsCreditDurationBucket[];
  source_duration_seconds: number;
  candidate_count: number;
  status: "ready" | "stale" | "invalidated";
  latest_source_analysis_job_id: string | null;
  metadata_json: Record<string, JsonSafeValue>;
  created_at?: string;
  updated_at?: string;
  last_used_at?: string | null;
};

export type AnalysisCacheEntryInsert = Omit<AnalysisCacheEntryRow, "id" | "created_at" | "updated_at" | "last_used_at"> & {
  last_used_at?: string | null;
};

export type AtomicCreditLedgerMutationResult = {
  entry: CreditLedgerEntryRow;
  idempotent: boolean;
};

export type SocialReelsCreditStore = {
  findCreditAccountByUserId(userId: string): Promise<CreditAccountRow | null>;
  createCreditAccount(input: {
    owner_user_id: string;
    plan_id?: string | null;
    current_subscription_id?: string | null;
    metadata_json?: Record<string, JsonSafeValue>;
  }): Promise<CreditAccountRow>;
  listLedgerEntries(creditAccountId: string): Promise<CreditLedgerEntryRow[]>;
  findLedgerEntryById(ledgerEntryId: string): Promise<CreditLedgerEntryRow | null>;
  findLedgerEntryByIdempotencyKey(creditAccountId: string, idempotencyKey: string): Promise<CreditLedgerEntryRow | null>;
  insertLedgerEntry(input: Omit<CreditLedgerEntryRow, "id" | "created_at">): Promise<CreditLedgerEntryRow>;
  findSourceAnalysisJobById(jobId: string): Promise<SourceAnalysisJobRow | null>;
  findSourceAnalysisJobByIdempotencyKey(creditAccountId: string, idempotencyKey: string): Promise<SourceAnalysisJobRow | null>;
  insertSourceAnalysisJob(input: Omit<SourceAnalysisJobRow, "id" | "created_at" | "updated_at">): Promise<SourceAnalysisJobRow>;
  updateSourceAnalysisJob(jobId: string, patch: Partial<Omit<SourceAnalysisJobRow, "id" | "created_at">>): Promise<SourceAnalysisJobRow>;
  insertSourceAnalysisCandidates(input: SourceAnalysisCandidateInsert[]): Promise<void>;
  listSourceAnalysisCandidates?(sourceAnalysisJobId: string): Promise<SourceAnalysisCandidateRow[]>;
  findAnalysisCacheEntry?(input: {
    creditAccountId: string;
    sourceFingerprint: string;
    transcriptNormalizationHash: string;
    analysisMode: string;
    promptVersion: string;
    schemaVersion: string;
    durationBuckets: SocialReelsCreditDurationBucket[];
  }): Promise<AnalysisCacheEntryRow | null>;
  upsertAnalysisCacheEntry?(input: AnalysisCacheEntryInsert): Promise<AnalysisCacheEntryRow>;
  touchAnalysisCacheEntry?(cacheEntryId: string): Promise<void>;
  reserveCreditsAtomically?(input: {
    creditAccountId: string;
    userId: string | null;
    sourceAnalysisJobId: string | null;
    credits: number;
    idempotencyKey: string;
    source: string;
    metadataJson: Record<string, JsonSafeValue>;
    payloadHash: string;
  }): Promise<AtomicCreditLedgerMutationResult>;
  captureReservedCreditsAtomically?(input: {
    creditAccountId: string;
    reservationEntryId: string;
    credits: number | null;
    idempotencyKey: string;
    metadataJson: Record<string, JsonSafeValue>;
    payloadHash: string;
  }): Promise<AtomicCreditLedgerMutationResult>;
  releaseReservedCreditsAtomically?(input: {
    creditAccountId: string;
    reservationEntryId: string;
    idempotencyKey: string;
    reasonCode: SocialReelsCreditReasonCode;
    metadataJson: Record<string, JsonSafeValue>;
    payloadHash: string;
  }): Promise<AtomicCreditLedgerMutationResult>;
  refundCreditsAtomically?(input: {
    creditAccountId: string;
    captureEntryId: string;
    idempotencyKey: string;
    reasonCode: SocialReelsCreditReasonCode;
    metadataJson: Record<string, JsonSafeValue>;
    payloadHash: string;
  }): Promise<AtomicCreditLedgerMutationResult>;
};

export type CreditBalance = {
  availableCredits: number;
  reservedCredits: number;
  consumedCredits: number;
  grantedCredits: number;
  ledgerEntryCount: number;
};

export class SocialReelsCreditLedgerError extends Error {
  readonly code: SocialReelsCreditReasonCode;
  readonly status: number;
  readonly details?: Record<string, JsonSafeValue>;

  constructor(code: SocialReelsCreditReasonCode, message: string, status = 400, details?: Record<string, JsonSafeValue>) {
    super(message);
    this.name = "SocialReelsCreditLedgerError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const SENSITIVE_METADATA_KEY_PATTERN =
  /authorization|access[_-]?token|refresh[_-]?token|secret|api[_-]?key|raw|transcript|word[_-]?json|wordjson|media[_-]?path|cache[_-]?path|openai|whisper|pyannote/i;
const SENSITIVE_METADATA_VALUE_PATTERN = /\/Users\/|file:\/\/|Bearer\s+|OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|sk-[A-Za-z0-9_-]{12,}/i;

function nowIso() {
  return new Date().toISOString();
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableJson(entryValue)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function stablePayloadHash(value: unknown): string {
  return crypto.createHash("sha256").update(stableJson(value)).digest("hex");
}

function sanitizeMetadataValue(value: unknown, path: string): JsonSafeValue {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new SocialReelsCreditLedgerError("unsafe_metadata", "Metadata must be JSON-safe.", 400, { path });
    }
    return value;
  }
  if (typeof value === "string") {
    if (SENSITIVE_METADATA_VALUE_PATTERN.test(value)) {
      throw new SocialReelsCreditLedgerError("unsafe_metadata", "Metadata contains private or raw payload material.", 400, { path });
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((entry, index) => sanitizeMetadataValue(entry, `${path}[${index}]`));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => {
        if (SENSITIVE_METADATA_KEY_PATTERN.test(key)) {
          throw new SocialReelsCreditLedgerError("unsafe_metadata", "Metadata contains a forbidden key.", 400, { path: path ? `${path}.${key}` : key });
        }
        return [key, sanitizeMetadataValue(entryValue, path ? `${path}.${key}` : key)];
      })
    );
  }

  throw new SocialReelsCreditLedgerError("unsafe_metadata", "Metadata must be JSON-safe.", 400, { path });
}

export function sanitizeCreditMetadata(input: Record<string, unknown> = {}): Record<string, JsonSafeValue> {
  return sanitizeMetadataValue(input, "") as Record<string, JsonSafeValue>;
}

export function estimateCreditsForSource(sourceDurationSeconds: number): number {
  if (!Number.isFinite(sourceDurationSeconds) || sourceDurationSeconds <= 0) {
    throw new SocialReelsCreditLedgerError("invalid_source_duration", "Source duration must be a positive number.", 400);
  }
  return Math.max(1, Math.ceil(sourceDurationSeconds / 60));
}

export function canonicalizeDurationBuckets(input: readonly unknown[]): SocialReelsCreditDurationBucket[] {
  const allowed = new Set<string>(SOCIAL_REELS_CREDIT_DURATION_BUCKETS);
  const seen = new Set<SocialReelsCreditDurationBucket>();
  for (const value of input) {
    if (typeof value !== "string" || !allowed.has(value)) {
      throw new SocialReelsCreditLedgerError("invalid_duration_bucket", "Unsupported Social Reels duration bucket.", 400);
    }
    seen.add(value as SocialReelsCreditDurationBucket);
  }

  return SOCIAL_REELS_CREDIT_DURATION_BUCKETS.filter((bucket) => seen.has(bucket));
}

export function canonicalDurationBucketKey(input: readonly unknown[]): string {
  return canonicalizeDurationBuckets(input).join(",");
}

export function calculateCreditBalance(entries: readonly CreditLedgerEntryRow[]): CreditBalance {
  let availableCredits = 0;
  let consumedCredits = 0;
  let grantedCredits = 0;
  const reserveEntries = new Map<string, CreditLedgerEntryRow>();
  const finalizedReservationIds = new Set<string>();

  for (const entry of entries) {
    if (entry.balance_effect === "increase_available") availableCredits += entry.credits;
    if (entry.balance_effect === "decrease_available") availableCredits -= entry.credits;

    if (entry.entry_type === "grant") grantedCredits += entry.credits;
    if (entry.entry_type === "reserve") reserveEntries.set(entry.id, entry);
    if ((entry.entry_type === "capture" || entry.entry_type === "release") && entry.reservation_entry_id) {
      finalizedReservationIds.add(entry.reservation_entry_id);
    }
    if (entry.entry_type === "capture" || entry.entry_type === "debit" || entry.entry_type === "overage") {
      consumedCredits += entry.credits;
    }
    if (entry.entry_type === "refund") {
      consumedCredits -= entry.credits;
    }
  }

  let reservedCredits = 0;
  for (const [id, entry] of reserveEntries) {
    if (!finalizedReservationIds.has(id)) reservedCredits += entry.credits;
  }

  return {
    availableCredits,
    reservedCredits,
    consumedCredits: Math.max(0, consumedCredits),
    grantedCredits,
    ledgerEntryCount: entries.length,
  };
}

export async function getCreditBalance(input: { store?: SocialReelsCreditStore; creditAccountId: string }): Promise<CreditBalance> {
  const store = input.store || createSupabaseSocialReelsCreditStore();
  const entries = await store.listLedgerEntries(input.creditAccountId);
  return calculateCreditBalance(entries);
}

function entryPayloadHash(input: Record<string, JsonSafeValue>) {
  return stablePayloadHash(input);
}

function assertIdempotentPayload(existing: { metadata_json: Record<string, JsonSafeValue> }, payloadHash: string) {
  if (existing.metadata_json.payload_hash !== payloadHash) {
    throw new SocialReelsCreditLedgerError("idempotency_key_conflict", "Idempotency key was reused with different credit operation details.", 409);
  }
}

async function existingTerminalReservationEntry(store: SocialReelsCreditStore, creditAccountId: string, reservationEntryId: string, type: "capture" | "release") {
  const entries = await store.listLedgerEntries(creditAccountId);
  return entries.find((entry) => entry.entry_type === type && entry.reservation_entry_id === reservationEntryId) || null;
}

export async function getOrCreateCreditAccount(input: {
  store?: SocialReelsCreditStore;
  userId: string;
  planId?: string | null;
  currentSubscriptionId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<CreditAccountRow> {
  const store = input.store || createSupabaseSocialReelsCreditStore();
  const existing = await store.findCreditAccountByUserId(input.userId);
  if (existing) return existing;

  try {
    return await store.createCreditAccount({
      owner_user_id: input.userId,
      plan_id: input.planId ?? null,
      current_subscription_id: input.currentSubscriptionId ?? null,
      metadata_json: sanitizeCreditMetadata(input.metadata || {}),
    });
  } catch (error) {
    const retry = await store.findCreditAccountByUserId(input.userId);
    if (retry) return retry;
    throw error;
  }
}

export async function reserveCredits(input: {
  store?: SocialReelsCreditStore;
  creditAccountId: string;
  userId?: string | null;
  sourceAnalysisJobId?: string | null;
  credits: number;
  idempotencyKey: string;
  source?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ entry: CreditLedgerEntryRow; balance: CreditBalance; idempotent: boolean }> {
  const store = input.store || createSupabaseSocialReelsCreditStore();
  const metadata = sanitizeCreditMetadata(input.metadata || {});
  const payloadHash = entryPayloadHash({
    operation: "reserve",
    creditAccountId: input.creditAccountId,
    userId: input.userId ?? null,
    sourceAnalysisJobId: input.sourceAnalysisJobId ?? null,
    credits: input.credits,
    source: input.source || "social_reels_source_analysis",
    metadata,
  });

  if (store.reserveCreditsAtomically) {
    if (!Number.isInteger(input.credits) || input.credits <= 0) {
      throw new SocialReelsCreditLedgerError("credit_reservation_failed", "Reservation credits must be a positive integer.", 400);
    }
    const result = await store.reserveCreditsAtomically({
      creditAccountId: input.creditAccountId,
      userId: input.userId ?? null,
      sourceAnalysisJobId: input.sourceAnalysisJobId ?? null,
      credits: input.credits,
      idempotencyKey: input.idempotencyKey,
      source: input.source || "social_reels_source_analysis",
      metadataJson: metadata,
      payloadHash,
    });
    return {
      entry: result.entry,
      balance: await getCreditBalance({ store, creditAccountId: input.creditAccountId }),
      idempotent: result.idempotent,
    };
  }

  const existing = await store.findLedgerEntryByIdempotencyKey(input.creditAccountId, input.idempotencyKey);
  if (existing) {
    assertIdempotentPayload(existing, payloadHash);
    return { entry: existing, balance: await getCreditBalance({ store, creditAccountId: input.creditAccountId }), idempotent: true };
  }

  if (!Number.isInteger(input.credits) || input.credits <= 0) {
    throw new SocialReelsCreditLedgerError("credit_reservation_failed", "Reservation credits must be a positive integer.", 400);
  }

  const balance = await getCreditBalance({ store, creditAccountId: input.creditAccountId });
  if (balance.availableCredits < input.credits) {
    throw new SocialReelsCreditLedgerError("insufficient_credits", "Not enough credits for source analysis.", 402, {
      availableCredits: balance.availableCredits,
      creditsRequired: input.credits,
    });
  }

  const entry = await store.insertLedgerEntry({
    credit_account_id: input.creditAccountId,
    user_id: input.userId ?? null,
    source_analysis_job_id: input.sourceAnalysisJobId ?? null,
    entry_type: "reserve",
    credits: input.credits,
    balance_effect: "decrease_available",
    reservation_entry_id: null,
    idempotency_key: input.idempotencyKey,
    source: input.source || "social_reels_source_analysis",
    metadata_json: { ...metadata, payload_hash: payloadHash },
  });

  return { entry, balance: await getCreditBalance({ store, creditAccountId: input.creditAccountId }), idempotent: false };
}

export async function grantCredits(input: {
  store?: SocialReelsCreditStore;
  creditAccountId: string;
  userId?: string | null;
  credits: number;
  idempotencyKey: string;
  source?: string;
  metadata?: Record<string, unknown>;
  idempotencyMetadata?: Record<string, unknown>;
}): Promise<{ entry: CreditLedgerEntryRow; balance: CreditBalance; idempotent: boolean }> {
  const store = input.store || createSupabaseSocialReelsCreditStore();
  const metadata = sanitizeCreditMetadata(input.metadata || {});
  const idempotencyMetadata = sanitizeCreditMetadata(input.idempotencyMetadata || input.metadata || {});
  const payloadHash = entryPayloadHash({
    operation: "grant",
    creditAccountId: input.creditAccountId,
    userId: input.userId ?? null,
    credits: input.credits,
    source: input.source || "social_reels_credit_grant",
    metadata: idempotencyMetadata,
  });
  const existing = await store.findLedgerEntryByIdempotencyKey(input.creditAccountId, input.idempotencyKey);
  if (existing) {
    assertIdempotentPayload(existing, payloadHash);
    return { entry: existing, balance: await getCreditBalance({ store, creditAccountId: input.creditAccountId }), idempotent: true };
  }

  if (!Number.isInteger(input.credits) || input.credits <= 0) {
    throw new SocialReelsCreditLedgerError("credit_grant_failed", "Grant credits must be a positive integer.", 400);
  }

  const entry = await store.insertLedgerEntry({
    credit_account_id: input.creditAccountId,
    user_id: input.userId ?? null,
    source_analysis_job_id: null,
    entry_type: "grant",
    credits: input.credits,
    balance_effect: "increase_available",
    reservation_entry_id: null,
    idempotency_key: input.idempotencyKey,
    source: input.source || "social_reels_credit_grant",
    metadata_json: { ...metadata, payload_hash: payloadHash },
  });

  return { entry, balance: await getCreditBalance({ store, creditAccountId: input.creditAccountId }), idempotent: false };
}

export async function captureReservedCredits(input: {
  store?: SocialReelsCreditStore;
  creditAccountId: string;
  reservationEntryId: string;
  idempotencyKey: string;
  credits?: number;
  metadata?: Record<string, unknown>;
}): Promise<{ entry: CreditLedgerEntryRow; balance: CreditBalance; idempotent: boolean }> {
  const store = input.store || createSupabaseSocialReelsCreditStore();
  const reservation = await store.findLedgerEntryById(input.reservationEntryId);
  if (!reservation || reservation.credit_account_id !== input.creditAccountId || reservation.entry_type !== "reserve") {
    throw new SocialReelsCreditLedgerError("credit_capture_failed", "Reservation entry was not found.", 404);
  }

  const credits = input.credits ?? reservation.credits;
  const metadata = sanitizeCreditMetadata(input.metadata || {});
  const payloadHash = entryPayloadHash({ operation: "capture", creditAccountId: input.creditAccountId, reservationEntryId: input.reservationEntryId, credits, metadata });

  if (store.captureReservedCreditsAtomically) {
    const result = await store.captureReservedCreditsAtomically({
      creditAccountId: input.creditAccountId,
      reservationEntryId: input.reservationEntryId,
      credits,
      idempotencyKey: input.idempotencyKey,
      metadataJson: metadata,
      payloadHash,
    });
    return {
      entry: result.entry,
      balance: await getCreditBalance({ store, creditAccountId: input.creditAccountId }),
      idempotent: result.idempotent,
    };
  }

  const existing = await store.findLedgerEntryByIdempotencyKey(input.creditAccountId, input.idempotencyKey);
  if (existing) {
    assertIdempotentPayload(existing, payloadHash);
    return { entry: existing, balance: await getCreditBalance({ store, creditAccountId: input.creditAccountId }), idempotent: true };
  }

  const alreadyCaptured = await existingTerminalReservationEntry(store, input.creditAccountId, input.reservationEntryId, "capture");
  if (alreadyCaptured) {
    return { entry: alreadyCaptured, balance: await getCreditBalance({ store, creditAccountId: input.creditAccountId }), idempotent: true };
  }
  if (await existingTerminalReservationEntry(store, input.creditAccountId, input.reservationEntryId, "release")) {
    throw new SocialReelsCreditLedgerError("credit_capture_failed", "Reservation was already released.", 409);
  }
  if (!Number.isInteger(credits) || credits <= 0 || credits > reservation.credits) {
    throw new SocialReelsCreditLedgerError("credit_capture_failed", "Capture credits must be positive and within the reserved amount.", 400);
  }

  const entry = await store.insertLedgerEntry({
    credit_account_id: input.creditAccountId,
    user_id: reservation.user_id,
    source_analysis_job_id: reservation.source_analysis_job_id,
    entry_type: "capture",
    credits,
    balance_effect: "none",
    reservation_entry_id: input.reservationEntryId,
    idempotency_key: input.idempotencyKey,
    source: reservation.source,
    metadata_json: { ...metadata, payload_hash: payloadHash },
  });

  return { entry, balance: await getCreditBalance({ store, creditAccountId: input.creditAccountId }), idempotent: false };
}

export async function releaseReservedCredits(input: {
  store?: SocialReelsCreditStore;
  creditAccountId: string;
  reservationEntryId: string;
  idempotencyKey: string;
  reasonCode?: SocialReelsCreditReasonCode;
  metadata?: Record<string, unknown>;
}): Promise<{ entry: CreditLedgerEntryRow; balance: CreditBalance; idempotent: boolean }> {
  const store = input.store || createSupabaseSocialReelsCreditStore();
  const reservation = await store.findLedgerEntryById(input.reservationEntryId);
  if (!reservation || reservation.credit_account_id !== input.creditAccountId || reservation.entry_type !== "reserve") {
    throw new SocialReelsCreditLedgerError("credit_release_failed", "Reservation entry was not found.", 404);
  }

  const metadata = sanitizeCreditMetadata(input.metadata || {});
  const payloadHash = entryPayloadHash({
    operation: "release",
    creditAccountId: input.creditAccountId,
    reservationEntryId: input.reservationEntryId,
    credits: reservation.credits,
    reasonCode: input.reasonCode || "job_failed_schema",
    metadata,
  });

  if (store.releaseReservedCreditsAtomically) {
    const result = await store.releaseReservedCreditsAtomically({
      creditAccountId: input.creditAccountId,
      reservationEntryId: input.reservationEntryId,
      idempotencyKey: input.idempotencyKey,
      reasonCode: input.reasonCode || "job_failed_schema",
      metadataJson: metadata,
      payloadHash,
    });
    return {
      entry: result.entry,
      balance: await getCreditBalance({ store, creditAccountId: input.creditAccountId }),
      idempotent: result.idempotent,
    };
  }

  const existing = await store.findLedgerEntryByIdempotencyKey(input.creditAccountId, input.idempotencyKey);
  if (existing) {
    assertIdempotentPayload(existing, payloadHash);
    return { entry: existing, balance: await getCreditBalance({ store, creditAccountId: input.creditAccountId }), idempotent: true };
  }

  const alreadyReleased = await existingTerminalReservationEntry(store, input.creditAccountId, input.reservationEntryId, "release");
  if (alreadyReleased) {
    return { entry: alreadyReleased, balance: await getCreditBalance({ store, creditAccountId: input.creditAccountId }), idempotent: true };
  }
  if (await existingTerminalReservationEntry(store, input.creditAccountId, input.reservationEntryId, "capture")) {
    throw new SocialReelsCreditLedgerError("credit_release_failed", "Reservation was already captured; refund captured credits instead.", 409);
  }

  const entry = await store.insertLedgerEntry({
    credit_account_id: input.creditAccountId,
    user_id: reservation.user_id,
    source_analysis_job_id: reservation.source_analysis_job_id,
    entry_type: "release",
    credits: reservation.credits,
    balance_effect: "increase_available",
    reservation_entry_id: input.reservationEntryId,
    idempotency_key: input.idempotencyKey,
    source: reservation.source,
    metadata_json: { ...metadata, reason_code: input.reasonCode || "job_failed_schema", payload_hash: payloadHash },
  });

  return { entry, balance: await getCreditBalance({ store, creditAccountId: input.creditAccountId }), idempotent: false };
}

export async function refundCredits(input: {
  store?: SocialReelsCreditStore;
  creditAccountId: string;
  captureEntryId: string;
  idempotencyKey: string;
  reasonCode?: SocialReelsCreditReasonCode;
  metadata?: Record<string, unknown>;
}): Promise<{ entry: CreditLedgerEntryRow; balance: CreditBalance; idempotent: boolean }> {
  const store = input.store || createSupabaseSocialReelsCreditStore();
  const capture = await store.findLedgerEntryById(input.captureEntryId);
  if (!capture || capture.credit_account_id !== input.creditAccountId || capture.entry_type !== "capture") {
    throw new SocialReelsCreditLedgerError("credit_refund_failed", "Capture entry was not found.", 404);
  }

  const metadata = sanitizeCreditMetadata(input.metadata || {});
  const payloadHash = entryPayloadHash({
    operation: "refund",
    creditAccountId: input.creditAccountId,
    captureEntryId: input.captureEntryId,
    credits: capture.credits,
    reasonCode: input.reasonCode || "job_failed_schema",
    metadata,
  });

  if (store.refundCreditsAtomically) {
    const result = await store.refundCreditsAtomically({
      creditAccountId: input.creditAccountId,
      captureEntryId: input.captureEntryId,
      idempotencyKey: input.idempotencyKey,
      reasonCode: input.reasonCode || "job_failed_schema",
      metadataJson: metadata,
      payloadHash,
    });
    return {
      entry: result.entry,
      balance: await getCreditBalance({ store, creditAccountId: input.creditAccountId }),
      idempotent: result.idempotent,
    };
  }

  const existing = await store.findLedgerEntryByIdempotencyKey(input.creditAccountId, input.idempotencyKey);
  if (existing) {
    assertIdempotentPayload(existing, payloadHash);
    return { entry: existing, balance: await getCreditBalance({ store, creditAccountId: input.creditAccountId }), idempotent: true };
  }

  const priorRefund = (await store.listLedgerEntries(input.creditAccountId)).find(
    (entry) => entry.entry_type === "refund" && entry.metadata_json.refunded_capture_entry_id === input.captureEntryId
  );
  if (priorRefund) {
    return { entry: priorRefund, balance: await getCreditBalance({ store, creditAccountId: input.creditAccountId }), idempotent: true };
  }

  const entry = await store.insertLedgerEntry({
    credit_account_id: input.creditAccountId,
    user_id: capture.user_id,
    source_analysis_job_id: capture.source_analysis_job_id,
    entry_type: "refund",
    credits: capture.credits,
    balance_effect: "increase_available",
    reservation_entry_id: capture.reservation_entry_id,
    idempotency_key: input.idempotencyKey,
    source: capture.source,
    metadata_json: {
      ...metadata,
      reason_code: input.reasonCode || "job_failed_schema",
      refunded_capture_entry_id: input.captureEntryId,
      payload_hash: payloadHash,
    },
  });

  return { entry, balance: await getCreditBalance({ store, creditAccountId: input.creditAccountId }), idempotent: false };
}

export async function recordSourceAnalysisJob(input: {
  store?: SocialReelsCreditStore;
  creditAccountId: string;
  userId?: string | null;
  idempotencyKey: string;
  sourceFingerprint: string;
  transcriptNormalizationHash: string;
  sourceDurationSeconds: number;
  durationBuckets: readonly unknown[];
  reservationLedgerEntryId?: string | null;
  cacheEntryId?: string | null;
  promptVersion?: string | null;
  schemaVersion?: string | null;
  provider?: string | null;
  model?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ job: SourceAnalysisJobRow; idempotent: boolean }> {
  const store = input.store || createSupabaseSocialReelsCreditStore();
  const durationBuckets = canonicalizeDurationBuckets(input.durationBuckets);
  const creditsRequired = estimateCreditsForSource(input.sourceDurationSeconds);
  const metadata = sanitizeCreditMetadata(input.metadata || {});
  const payloadHash = stablePayloadHash({
    creditAccountId: input.creditAccountId,
    userId: input.userId ?? null,
    sourceFingerprint: input.sourceFingerprint,
    transcriptNormalizationHash: input.transcriptNormalizationHash,
    sourceDurationSeconds: Math.ceil(input.sourceDurationSeconds),
    durationBuckets,
    promptVersion: input.promptVersion ?? null,
    schemaVersion: input.schemaVersion ?? null,
    provider: input.provider ?? null,
    model: input.model ?? null,
    metadata,
  });

  const existing = await store.findSourceAnalysisJobByIdempotencyKey(input.creditAccountId, input.idempotencyKey);
  if (existing) {
    assertIdempotentPayload(existing, payloadHash);
    return { job: existing, idempotent: true };
  }

  const job = await store.insertSourceAnalysisJob({
    credit_account_id: input.creditAccountId,
    user_id: input.userId ?? null,
    status: input.reservationLedgerEntryId ? "reserved" : "created",
    idempotency_key: input.idempotencyKey,
    source_fingerprint: input.sourceFingerprint,
    transcript_normalization_hash: input.transcriptNormalizationHash,
    source_duration_seconds: Math.ceil(input.sourceDurationSeconds),
    credits_required: creditsRequired,
    duration_buckets: durationBuckets,
    reservation_ledger_entry_id: input.reservationLedgerEntryId ?? null,
    capture_ledger_entry_id: null,
    cache_entry_id: input.cacheEntryId ?? null,
    analysis_mode: "social_reels",
    prompt_version: input.promptVersion ?? null,
    schema_version: input.schemaVersion ?? null,
    provider: input.provider ?? null,
    model: input.model ?? null,
    candidate_count: 0,
    error_code: null,
    error_message: null,
    metadata_json: { ...metadata, payload_hash: payloadHash },
    started_at: null,
    completed_at: null,
  });

  return { job, idempotent: false };
}

export async function markSourceAnalysisJobSucceeded(input: {
  store?: SocialReelsCreditStore;
  jobId: string;
  captureLedgerEntryId?: string | null;
  candidates?: Array<Omit<SourceAnalysisCandidateInsert, "source_analysis_job_id">>;
}): Promise<SourceAnalysisJobRow> {
  const store = input.store || createSupabaseSocialReelsCreditStore();
  const job = await store.findSourceAnalysisJobById(input.jobId);
  if (!job) throw new SocialReelsCreditLedgerError("credit_account_missing", "Source analysis job was not found.", 404);

  const candidates = input.candidates || [];
  for (const candidate of candidates) {
    sanitizeCreditMetadata(candidate.metadata_json || {});
  }

  if (candidates.length > 0) {
    await store.insertSourceAnalysisCandidates(
      candidates.map((candidate) => ({
        ...candidate,
        source_analysis_job_id: input.jobId,
        duration_bucket: candidate.duration_bucket ? canonicalizeDurationBuckets([candidate.duration_bucket])[0] : null,
        metadata_json: sanitizeCreditMetadata(candidate.metadata_json || {}),
      }))
    );
  }

  return store.updateSourceAnalysisJob(input.jobId, {
    status: "succeeded",
    capture_ledger_entry_id: input.captureLedgerEntryId ?? job.capture_ledger_entry_id,
    candidate_count: candidates.length || job.candidate_count,
    completed_at: nowIso(),
    error_code: null,
    error_message: null,
  });
}

export async function markSourceAnalysisJobFailedAndReleaseOrRefund(input: {
  store?: SocialReelsCreditStore;
  jobId: string;
  reasonCode: Extract<SocialReelsCreditReasonCode, "job_failed_openai" | "job_failed_schema" | "job_failed_timeout">;
  idempotencyKey: string;
}): Promise<{ job: SourceAnalysisJobRow; ledgerEntry: CreditLedgerEntryRow | null; balance: CreditBalance }> {
  const store = input.store || createSupabaseSocialReelsCreditStore();
  const job = await store.findSourceAnalysisJobById(input.jobId);
  if (!job) throw new SocialReelsCreditLedgerError("credit_account_missing", "Source analysis job was not found.", 404);

  let ledgerEntry: CreditLedgerEntryRow | null = null;
  if (job.capture_ledger_entry_id) {
    const refund = await refundCredits({
      store,
      creditAccountId: job.credit_account_id,
      captureEntryId: job.capture_ledger_entry_id,
      idempotencyKey: `${input.idempotencyKey}:refund`,
      reasonCode: input.reasonCode,
    });
    ledgerEntry = refund.entry;
  } else if (job.reservation_ledger_entry_id) {
    const release = await releaseReservedCredits({
      store,
      creditAccountId: job.credit_account_id,
      reservationEntryId: job.reservation_ledger_entry_id,
      idempotencyKey: `${input.idempotencyKey}:release`,
      reasonCode: input.reasonCode,
    });
    ledgerEntry = release.entry;
  }

  const updated = await store.updateSourceAnalysisJob(input.jobId, {
    status: job.capture_ledger_entry_id ? "refunded" : "failed",
    error_code: input.reasonCode,
    error_message: input.reasonCode,
    completed_at: nowIso(),
  });

  return {
    job: updated,
    ledgerEntry,
    balance: await getCreditBalance({ store, creditAccountId: job.credit_account_id }),
  };
}

export function buildCacheHitNoChargeUsageMetadata(input: { sourceDurationSeconds: number; durationBuckets: readonly unknown[] }) {
  return {
    reasonCode: "cache_hit_no_charge" as const,
    sourceDurationSeconds: Math.ceil(input.sourceDurationSeconds),
    creditsRequired: estimateCreditsForSource(input.sourceDurationSeconds),
    creditsReserved: 0,
    creditsCharged: 0,
    creditsRefunded: 0,
    cacheStatus: "hit" as const,
    noFullSourceMinuteCharge: true,
    durationBucketKey: canonicalDurationBucketKey(input.durationBuckets),
  };
}

type CreditLedgerRpcRow = CreditLedgerEntryRow & {
  idempotent?: boolean;
};

function rpcRowToMutationResult(row: CreditLedgerRpcRow): AtomicCreditLedgerMutationResult {
  return {
    entry: {
      id: row.id,
      credit_account_id: row.credit_account_id,
      user_id: row.user_id,
      source_analysis_job_id: row.source_analysis_job_id,
      entry_type: row.entry_type,
      credits: row.credits,
      balance_effect: row.balance_effect,
      reservation_entry_id: row.reservation_entry_id,
      idempotency_key: row.idempotency_key,
      source: row.source,
      metadata_json: row.metadata_json || {},
      created_at: row.created_at,
    },
    idempotent: Boolean(row.idempotent),
  };
}

function mapCreditRpcError(error: unknown, fallbackCode: SocialReelsCreditReasonCode): SocialReelsCreditLedgerError {
  const message = error && typeof error === "object" && "message" in error ? String((error as { message?: unknown }).message || "") : String(error || "");
  const knownCode = SOCIAL_REELS_CREDIT_REASON_CODES.find((code) => message.includes(code));
  return new SocialReelsCreditLedgerError(knownCode || fallbackCode, knownCode || "Credit ledger RPC failed.", knownCode === "insufficient_credits" ? 402 : knownCode === "idempotency_key_conflict" ? 409 : 500);
}

export function createSupabaseSocialReelsCreditStore(): SocialReelsCreditStore {
  async function client() {
    const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
    return supabaseAdmin;
  }

  return {
    async findCreditAccountByUserId(userId) {
      const supabase = await client();
      const { data, error } = await supabase
        .from("credit_accounts")
        .select("*")
        .eq("owner_user_id", userId)
        .eq("account_type", "user")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as CreditAccountRow | null) || null;
    },
    async createCreditAccount(input) {
      const supabase = await client();
      const { data, error } = await supabase
        .from("credit_accounts")
        .insert({
          owner_user_id: input.owner_user_id,
          account_type: "user",
          organization_id: null,
          status: "active",
          current_subscription_id: input.current_subscription_id ?? null,
          plan_id: input.plan_id ?? null,
          metadata_json: input.metadata_json || {},
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as CreditAccountRow;
    },
    async listLedgerEntries(creditAccountId) {
      const supabase = await client();
      const { data, error } = await supabase
        .from("credit_ledger_entries")
        .select("*")
        .eq("credit_account_id", creditAccountId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as CreditLedgerEntryRow[];
    },
    async findLedgerEntryById(ledgerEntryId) {
      const supabase = await client();
      const { data, error } = await supabase.from("credit_ledger_entries").select("*").eq("id", ledgerEntryId).limit(1).maybeSingle();
      if (error) throw error;
      return (data as CreditLedgerEntryRow | null) || null;
    },
    async findLedgerEntryByIdempotencyKey(creditAccountId, idempotencyKey) {
      const supabase = await client();
      const { data, error } = await supabase
        .from("credit_ledger_entries")
        .select("*")
        .eq("credit_account_id", creditAccountId)
        .eq("idempotency_key", idempotencyKey)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as CreditLedgerEntryRow | null) || null;
    },
    async insertLedgerEntry(input) {
      const supabase = await client();
      const { data, error } = await supabase.from("credit_ledger_entries").insert(input).select("*").single();
      if (error) throw error;
      return data as CreditLedgerEntryRow;
    },
    async findSourceAnalysisJobById(jobId) {
      const supabase = await client();
      const { data, error } = await supabase.from("source_analysis_jobs").select("*").eq("id", jobId).limit(1).maybeSingle();
      if (error) throw error;
      return (data as SourceAnalysisJobRow | null) || null;
    },
    async findSourceAnalysisJobByIdempotencyKey(creditAccountId, idempotencyKey) {
      const supabase = await client();
      const { data, error } = await supabase
        .from("source_analysis_jobs")
        .select("*")
        .eq("credit_account_id", creditAccountId)
        .eq("idempotency_key", idempotencyKey)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as SourceAnalysisJobRow | null) || null;
    },
    async insertSourceAnalysisJob(input) {
      const supabase = await client();
      const { data, error } = await supabase.from("source_analysis_jobs").insert(input).select("*").single();
      if (error) throw error;
      return data as SourceAnalysisJobRow;
    },
    async updateSourceAnalysisJob(jobId, patch) {
      const supabase = await client();
      const { data, error } = await supabase
        .from("source_analysis_jobs")
        .update({ ...patch, updated_at: nowIso() })
        .eq("id", jobId)
        .select("*")
        .single();
      if (error) throw error;
      return data as SourceAnalysisJobRow;
    },
    async insertSourceAnalysisCandidates(input) {
      if (input.length === 0) return;
      const supabase = await client();
      const { error } = await supabase.from("source_analysis_job_candidates").insert(input);
      if (error) throw error;
    },
    async listSourceAnalysisCandidates(sourceAnalysisJobId) {
      const supabase = await client();
      const { data, error } = await supabase
        .from("source_analysis_job_candidates")
        .select("*")
        .eq("source_analysis_job_id", sourceAnalysisJobId)
        .order("rank", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as SourceAnalysisCandidateRow[];
    },
    async findAnalysisCacheEntry(input) {
      const supabase = await client();
      const { data, error } = await supabase
        .from("analysis_cache_entries")
        .select("*")
        .eq("credit_account_id", input.creditAccountId)
        .eq("source_fingerprint", input.sourceFingerprint)
        .eq("transcript_normalization_hash", input.transcriptNormalizationHash)
        .eq("analysis_mode", input.analysisMode)
        .eq("prompt_version", input.promptVersion)
        .eq("schema_version", input.schemaVersion)
        .eq("status", "ready")
        .contains("duration_buckets", input.durationBuckets)
        .containedBy("duration_buckets", input.durationBuckets)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as AnalysisCacheEntryRow | null) || null;
    },
    async upsertAnalysisCacheEntry(input) {
      const supabase = await client();
      const { data, error } = await supabase
        .from("analysis_cache_entries")
        .upsert(
          {
            ...input,
            metadata_json: input.metadata_json || {},
            last_used_at: input.last_used_at ?? nowIso(),
            updated_at: nowIso(),
          },
          {
            onConflict:
              "credit_account_id,source_fingerprint,transcript_normalization_hash,analysis_mode,prompt_version,schema_version,duration_buckets",
          }
        )
        .select("*")
        .single();
      if (error) throw error;
      return data as AnalysisCacheEntryRow;
    },
    async touchAnalysisCacheEntry(cacheEntryId) {
      const supabase = await client();
      const { error } = await supabase
        .from("analysis_cache_entries")
        .update({ last_used_at: nowIso(), updated_at: nowIso() })
        .eq("id", cacheEntryId);
      if (error) throw error;
    },
    async reserveCreditsAtomically(input) {
      const supabase = await client();
      const { data, error } = await supabase
        .rpc("social_reels_credit_reserve_v1", {
          p_credit_account_id: input.creditAccountId,
          p_credits: input.credits,
          p_idempotency_key: input.idempotencyKey,
          p_payload_hash: input.payloadHash,
          p_user_id: input.userId,
          p_source_analysis_job_id: input.sourceAnalysisJobId,
          p_source: input.source,
          p_metadata_json: input.metadataJson,
        })
        .single();
      if (error) throw mapCreditRpcError(error, "credit_reservation_failed");
      if (!data) throw new SocialReelsCreditLedgerError("credit_reservation_failed", "Credit reservation RPC returned no row.", 500);
      return rpcRowToMutationResult(data as CreditLedgerRpcRow);
    },
    async captureReservedCreditsAtomically(input) {
      const supabase = await client();
      const { data, error } = await supabase
        .rpc("social_reels_credit_capture_v1", {
          p_credit_account_id: input.creditAccountId,
          p_reservation_entry_id: input.reservationEntryId,
          p_idempotency_key: input.idempotencyKey,
          p_payload_hash: input.payloadHash,
          p_credits: input.credits,
          p_metadata_json: input.metadataJson,
        })
        .single();
      if (error) throw mapCreditRpcError(error, "credit_capture_failed");
      if (!data) throw new SocialReelsCreditLedgerError("credit_capture_failed", "Credit capture RPC returned no row.", 500);
      return rpcRowToMutationResult(data as CreditLedgerRpcRow);
    },
    async releaseReservedCreditsAtomically(input) {
      const supabase = await client();
      const { data, error } = await supabase
        .rpc("social_reels_credit_release_v1", {
          p_credit_account_id: input.creditAccountId,
          p_reservation_entry_id: input.reservationEntryId,
          p_idempotency_key: input.idempotencyKey,
          p_payload_hash: input.payloadHash,
          p_reason_code: input.reasonCode,
          p_metadata_json: input.metadataJson,
        })
        .single();
      if (error) throw mapCreditRpcError(error, "credit_release_failed");
      if (!data) throw new SocialReelsCreditLedgerError("credit_release_failed", "Credit release RPC returned no row.", 500);
      return rpcRowToMutationResult(data as CreditLedgerRpcRow);
    },
    async refundCreditsAtomically(input) {
      const supabase = await client();
      const { data, error } = await supabase
        .rpc("social_reels_credit_refund_v1", {
          p_credit_account_id: input.creditAccountId,
          p_capture_entry_id: input.captureEntryId,
          p_idempotency_key: input.idempotencyKey,
          p_payload_hash: input.payloadHash,
          p_reason_code: input.reasonCode,
          p_metadata_json: input.metadataJson,
        })
        .single();
      if (error) throw mapCreditRpcError(error, "credit_refund_failed");
      if (!data) throw new SocialReelsCreditLedgerError("credit_refund_failed", "Credit refund RPC returned no row.", 500);
      return rpcRowToMutationResult(data as CreditLedgerRpcRow);
    },
  };
}
