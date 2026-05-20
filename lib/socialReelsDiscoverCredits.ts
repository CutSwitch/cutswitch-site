import crypto from "crypto";

import { isEnabledEnv } from "@/lib/security";
import {
  buildCacheHitNoChargeUsageMetadata,
  canonicalizeDurationBuckets,
  captureReservedCredits,
  createSupabaseSocialReelsCreditStore,
  estimateCreditsForSource,
  getCreditBalance,
  getOrCreateCreditAccount,
  markSourceAnalysisJobFailedAndReleaseOrRefund,
  markSourceAnalysisJobSucceeded,
  recordSourceAnalysisJob,
  reserveCredits,
  sanitizeCreditMetadata,
  type AnalysisCacheEntryRow,
  type CreditBalance,
  type SourceAnalysisCandidateInsert,
  type SourceAnalysisCandidateRow,
  type SocialReelsCreditDurationBucket,
  type SocialReelsCreditReasonCode,
  SocialReelsCreditLedgerError,
  type SocialReelsCreditStore,
} from "@/lib/socialReelsCreditLedger";
import type { DiscoverSocialReelsResult, SocialReelsDiscoveryError } from "@/lib/openaiSocialReels";
import {
  SOCIAL_REELS_DURATION_FIRST_SCHEMA_VERSION,
  durationFirstTargetToConcreteDurationBucket,
} from "@/lib/socialReelsDurationFirstManifest";
import type { SocialReelsRequest } from "@/lib/socialReelsSchema";

export const SOCIAL_REELS_DISCOVER_CREDITS_FEATURE_ENV = "ENABLE_SOCIAL_REELS_DISCOVER_CREDITS";
export const SOCIAL_REELS_DISCOVER_CREDIT_PROMPT_VERSION = "social_reels_discover_credit_v1";

type RawDiscoverPayload = Record<string, unknown>;
type DiscoverFn = (input: SocialReelsRequest) => Promise<DiscoverSocialReelsResult>;

export type SocialReelsCreditBillingMetadata = {
  creditUnit: "source_media_minute";
  creditsRequired: number;
  creditsRequiredForFullRun: number;
  creditsReserved: number;
  creditsCharged: number;
  creditsRefunded: number;
  cacheStatus: "disabled" | "miss" | "stale" | "hit" | "idempotent_replay";
  noFullSourceMinuteCharge: boolean;
  idempotent: boolean;
  creditAccountId: string;
  reservationLedgerEntryId: string | null;
  captureLedgerEntryId: string | null;
  availableCreditsAfter: number | null;
  reservedCreditsAfter: number | null;
  regenerationPolicy: "full_source_minute_charge" | "free_cached_regeneration";
};

export type SocialReelsCandidateGroup = {
  durationBucket: string;
  candidates: unknown[];
};

export type SocialReelsCreditAwareDiscoverOutcome = {
  discoverResult: DiscoverSocialReelsResult | null;
  jobId: string | null;
  status: "cached" | "succeeded";
  billing: SocialReelsCreditBillingMetadata;
  groups: SocialReelsCandidateGroup[];
  cachedCandidates: unknown[] | null;
};

export function isSocialReelsDiscoverCreditsEnabled() {
  return isEnabledEnv(SOCIAL_REELS_DISCOVER_CREDITS_FEATURE_ENV);
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

function stableHash(value: unknown) {
  return crypto.createHash("sha256").update(stableJson(value)).digest("hex");
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readDurationBuckets(rawPayload: RawDiscoverPayload, request: SocialReelsRequest): SocialReelsCreditDurationBucket[] {
  const rawBuckets = Array.isArray(rawPayload.durationBuckets) ? rawPayload.durationBuckets : null;
  const sourceBuckets =
    rawBuckets ??
    (request.requested_duration_buckets.length > 0
      ? request.requested_duration_buckets.map((bucket) => bucket.duration_target)
      : request.duration_preferences.length > 0
        ? request.duration_preferences
        : request.duration_bucket
          ? [request.duration_bucket]
          : ["mixed"]);

  const mapped = sourceBuckets.map((bucket) => {
    if (bucket === "15s" || bucket === "30s" || bucket === "60s" || bucket === "90s" || bucket === "mixed") return bucket;
    if (bucket === "5_to_10m" || bucket === "5-10m" || bucket === "custom") return "mixed";
    return bucket;
  });

  return canonicalizeDurationBuckets(mapped);
}

function readSourceDurationSeconds(rawPayload: RawDiscoverPayload, request: SocialReelsRequest) {
  const rawSourceDuration = rawPayload.sourceDurationSeconds;
  return typeof rawSourceDuration === "number" && Number.isFinite(rawSourceDuration)
    ? rawSourceDuration
    : request.source_duration_seconds;
}

function readSourceFingerprint(rawPayload: RawDiscoverPayload, request: SocialReelsRequest) {
  return (
    asString(rawPayload.sourceMediaFingerprint) ||
    asString(rawPayload.sourceMediaId) ||
    request.project_fingerprint ||
    request.project_hash
  );
}

function readTranscriptNormalizationHash(rawPayload: RawDiscoverPayload, request: SocialReelsRequest) {
  const transcriptHash = asString(rawPayload.transcriptHash);
  const wordJsonHash = asString(rawPayload.wordJsonHash);
  if (transcriptHash && wordJsonHash) {
    return stableHash({ transcriptHash, wordJsonHash });
  }

  return (
    transcriptHash ||
    wordJsonHash ||
    stableHash({
      projectHash: request.project_hash,
      sourceFingerprint: request.project_fingerprint,
      segmentCount: request.segments.length,
      utteranceCount: request.utterances.length,
      wordCount: request.words.length,
    })
  );
}

function readUseCache(rawPayload: RawDiscoverPayload) {
  return rawPayload.useCache !== false;
}

function getDiscoverySchemaVersion(request: SocialReelsRequest) {
  if (request.editorial_word_id) return "social_reels_editorial_word_id_v1";
  if (request.duration_first_manifest) return SOCIAL_REELS_DURATION_FIRST_SCHEMA_VERSION;
  if (request.discovery_matrix) return "social_reels_discovery_matrix_v1";
  return "social_reels_candidates_v1";
}

function getRequestIdempotencyKey(input: {
  rawPayload: RawDiscoverPayload;
  userId: string;
  sourceFingerprint: string;
  transcriptNormalizationHash: string;
  sourceDurationSeconds: number;
  durationBuckets: SocialReelsCreditDurationBucket[];
}) {
  const explicit = asString(input.rawPayload.idempotencyKey);
  if (explicit) return explicit;

  return `social-reels-discover:${stableHash({
    userId: input.userId,
    sourceFingerprint: input.sourceFingerprint,
    transcriptNormalizationHash: input.transcriptNormalizationHash,
    sourceDurationSeconds: Math.ceil(input.sourceDurationSeconds),
    durationBuckets: input.durationBuckets,
  })}`;
}

function balanceFields(balance: CreditBalance | null) {
  return {
    availableCreditsAfter: balance?.availableCredits ?? null,
    reservedCreditsAfter: balance?.reservedCredits ?? null,
  };
}

function groupByDurationBucket(candidates: unknown[]): SocialReelsCandidateGroup[] {
  const groups = new Map<string, unknown[]>();
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const record = candidate as Record<string, unknown>;
    const bucket =
      asString(record.duration_bucket) ||
      asString(record.durationBucket) ||
      asString(record.duration_target) ||
      "mixed";
    if (!groups.has(bucket)) groups.set(bucket, []);
    groups.get(bucket)?.push(candidate);
  }
  return [...groups.entries()].map(([durationBucket, groupedCandidates]) => ({
    durationBucket,
    candidates: groupedCandidates,
  }));
}

function storageDurationBucket(bucket: string | null | undefined): SocialReelsCreditDurationBucket {
  if (bucket === "15s" || bucket === "30s" || bucket === "60s" || bucket === "90s" || bucket === "mixed") return bucket;
  return "mixed";
}

export function buildSocialReelsCandidateGroups(result: DiscoverSocialReelsResult): SocialReelsCandidateGroup[] {
  if (result.response) return groupByDurationBucket(result.response.candidates);

  if (result.matrixResponse) {
    const momentsById = new Map(result.matrixResponse.moments.map((moment) => [moment.moment_id, moment]));
    return result.matrixResponse.buckets.map((bucket) => ({
      durationBucket: bucket.duration,
      candidates: bucket.moment_ids.map((momentId) => momentsById.get(momentId)).filter(Boolean),
    }));
  }

  if (result.durationFirstManifest) {
    const momentsById = new Map(result.durationFirstManifest.moments.map((moment) => [moment.moment_id, moment]));
    return result.durationFirstManifest.duration_buckets.map((bucket) => ({
      durationBucket: bucket.duration_target === "5_to_10m" ? "mixed" : bucket.duration_target,
      candidates: bucket.returned_moment_ids.map((momentId) => momentsById.get(momentId)).filter(Boolean),
    }));
  }

  if (result.editorialWordIdResponse) {
    return [
      {
        durationBucket: "mixed",
        candidates: result.editorialWordIdResponse.reels,
      },
    ];
  }

  return [];
}

function resultCandidatesForStorage(result: DiscoverSocialReelsResult): Array<Omit<SourceAnalysisCandidateInsert, "source_analysis_job_id">> {
  if (result.response) {
    return result.response.candidates.map((candidate, index) => ({
      candidate_id: candidate.candidate_id,
      rank: index + 1,
      duration_bucket: storageDurationBucket(candidate.duration_bucket),
      title: candidate.title,
      summary: candidate.summary,
      metadata_json: sanitizeCreditMetadata({
        discovery_mode: result.discoveryMode,
        score: candidate.score,
        source_start_seconds: candidate.start_seconds,
        source_end_seconds: candidate.end_seconds,
      }),
    }));
  }

  if (result.matrixResponse) {
    return result.matrixResponse.moments.map((moment, index) => ({
      candidate_id: moment.moment_id,
      rank: index + 1,
      duration_bucket: storageDurationBucket(moment.buckets[0]?.duration),
      title: moment.title,
      summary: moment.summary,
      metadata_json: sanitizeCreditMetadata({
        discovery_mode: result.discoveryMode,
        score: moment.raw_score,
        source_start_seconds: moment.start_seconds,
        source_end_seconds: moment.end_seconds,
      }),
    }));
  }

  if (result.durationFirstManifest) {
    return result.durationFirstManifest.moments.map((moment, index) => ({
      candidate_id: moment.moment_id,
      rank: index + 1,
      duration_bucket: storageDurationBucket(
        durationFirstTargetToConcreteDurationBucket(moment.duration_bucket_memberships[0]?.duration_target ?? "5_to_10m")
      ),
      title: moment.display_title,
      summary: moment.display_teaser,
      source_start_word_id: moment.timeline_segments[0]?.word_start_id ?? null,
      source_end_word_id: moment.timeline_segments[moment.timeline_segments.length - 1]?.word_end_id ?? null,
      metadata_json: sanitizeCreditMetadata({
        discovery_mode: result.discoveryMode,
        score: moment.score,
        segment_count: moment.timeline_segments.length,
      }),
    }));
  }

  if (result.editorialWordIdResponse) {
    return result.editorialWordIdResponse.reels.map((reel, index) => ({
      candidate_id: reel.clientMomentId,
      rank: index + 1,
      duration_bucket: "mixed",
      title: reel.title,
      summary: reel.openingLine,
      source_start_word_id: reel.segments[0]?.startWordId ?? null,
      source_end_word_id: reel.segments[reel.segments.length - 1]?.endWordId ?? null,
      metadata_json: sanitizeCreditMetadata({
        discovery_mode: result.discoveryMode,
        editorial_status: reel.editorialStatus,
      }),
    }));
  }

  return [];
}

function cachedCandidateRowsToResponse(rows: SourceAnalysisCandidateRow[]) {
  return rows.map((row) => ({
    candidate_id: row.candidate_id,
    duration_bucket: row.duration_bucket ?? "mixed",
    title: row.title,
    summary: row.summary,
    source_start_word_id: row.source_start_word_id,
    source_end_word_id: row.source_end_word_id,
    metadata: row.metadata_json || {},
  }));
}

async function readCachedCandidates(store: SocialReelsCreditStore, cacheEntry: AnalysisCacheEntryRow) {
  if (!cacheEntry.latest_source_analysis_job_id || !store.listSourceAnalysisCandidates) return null;
  const rows = await store.listSourceAnalysisCandidates(cacheEntry.latest_source_analysis_job_id);
  if (rows.length === 0) return null;
  return cachedCandidateRowsToResponse(rows);
}

function mapDiscoveryFailureReason(error: unknown): Extract<SocialReelsCreditReasonCode, "job_failed_openai" | "job_failed_schema" | "job_failed_timeout"> {
  const stage = (error as SocialReelsDiscoveryError | undefined)?.stage;
  if (stage === "openai_fetch_timeout" || stage === "route_timeout") return "job_failed_timeout";
  if (stage === "openai_invalid_response") return "job_failed_schema";
  return "job_failed_openai";
}

export async function runCreditAwareSocialReelsDiscovery(input: {
  rawPayload: RawDiscoverPayload;
  request: SocialReelsRequest;
  userId: string;
  planId?: string | null;
  store?: SocialReelsCreditStore;
  discover: DiscoverFn;
}): Promise<SocialReelsCreditAwareDiscoverOutcome> {
  const store = input.store || createSupabaseSocialReelsCreditStore();
  const sourceDurationSeconds = readSourceDurationSeconds(input.rawPayload, input.request);
  const durationBuckets = readDurationBuckets(input.rawPayload, input.request);
  const creditsRequired = estimateCreditsForSource(sourceDurationSeconds);
  const sourceFingerprint = readSourceFingerprint(input.rawPayload, input.request);
  const transcriptNormalizationHash = readTranscriptNormalizationHash(input.rawPayload, input.request);
  const idempotencyKey = getRequestIdempotencyKey({
    rawPayload: input.rawPayload,
    userId: input.userId,
    sourceFingerprint,
    transcriptNormalizationHash,
    sourceDurationSeconds,
    durationBuckets,
  });
  const useCache = readUseCache(input.rawPayload);
  const schemaVersion = getDiscoverySchemaVersion(input.request);
  let cacheStatusForRun: SocialReelsCreditBillingMetadata["cacheStatus"] = useCache ? "miss" : "disabled";

  const account = await getOrCreateCreditAccount({
    store,
    userId: input.userId,
    planId: input.planId ?? null,
    metadata: {
      created_by: "social_reels_discover",
      account_scope: "user",
    },
  });

  if (useCache && store?.findAnalysisCacheEntry) {
    const cacheEntry = await store.findAnalysisCacheEntry({
      creditAccountId: account.id,
      sourceFingerprint,
      transcriptNormalizationHash,
      analysisMode: "social_reels",
      promptVersion: SOCIAL_REELS_DISCOVER_CREDIT_PROMPT_VERSION,
      schemaVersion,
      durationBuckets,
      sourceDurationSeconds: Math.ceil(sourceDurationSeconds),
    });

    if (cacheEntry) {
      const cachedCandidates = await readCachedCandidates(store, cacheEntry);
      if (cachedCandidates) {
        if (store.touchAnalysisCacheEntry) await store.touchAnalysisCacheEntry(cacheEntry.id);
        const balance = await getCreditBalance({ store, creditAccountId: account.id });
        const cacheUsage = buildCacheHitNoChargeUsageMetadata({ sourceDurationSeconds, durationBuckets });
        return {
          discoverResult: null,
          jobId: cacheEntry.latest_source_analysis_job_id,
          status: "cached",
          cachedCandidates,
          groups: groupByDurationBucket(cachedCandidates),
          billing: {
            creditUnit: "source_media_minute",
            creditsRequired: cacheUsage.creditsRequired,
            creditsRequiredForFullRun: cacheUsage.creditsRequired,
            creditsReserved: 0,
            creditsCharged: 0,
            creditsRefunded: 0,
            cacheStatus: "hit",
            noFullSourceMinuteCharge: true,
            idempotent: false,
            creditAccountId: account.id,
            reservationLedgerEntryId: null,
            captureLedgerEntryId: null,
            regenerationPolicy: "free_cached_regeneration",
            ...balanceFields(balance),
          },
        };
      }
      cacheStatusForRun = "stale";
    }
  }

  const job = await recordSourceAnalysisJob({
    store,
    creditAccountId: account.id,
    userId: input.userId,
    idempotencyKey: `job:${idempotencyKey}`,
    sourceFingerprint,
    transcriptNormalizationHash,
    sourceDurationSeconds,
    durationBuckets,
    promptVersion: SOCIAL_REELS_DISCOVER_CREDIT_PROMPT_VERSION,
    schemaVersion,
    provider: "social_reels_discovery",
    model: null,
    metadata: {
      request_idempotency_scope: "discover",
      duration_bucket_key: durationBuckets.join(","),
    },
  });

  if (job.idempotent && job.job.status === "succeeded" && store?.listSourceAnalysisCandidates) {
    const rows = await store.listSourceAnalysisCandidates(job.job.id);
    if (rows.length > 0) {
      const cachedCandidates = cachedCandidateRowsToResponse(rows);
      const balance = await getCreditBalance({ store, creditAccountId: account.id });
      return {
        discoverResult: null,
        jobId: job.job.id,
        status: "succeeded",
        cachedCandidates,
        groups: groupByDurationBucket(cachedCandidates),
        billing: {
          creditUnit: "source_media_minute",
          creditsRequired,
          creditsRequiredForFullRun: creditsRequired,
          creditsReserved: 0,
          creditsCharged: 0,
          creditsRefunded: 0,
          cacheStatus: "idempotent_replay",
          noFullSourceMinuteCharge: true,
          idempotent: true,
          creditAccountId: account.id,
          reservationLedgerEntryId: job.job.reservation_ledger_entry_id,
          captureLedgerEntryId: job.job.capture_ledger_entry_id,
          regenerationPolicy: "free_cached_regeneration",
          ...balanceFields(balance),
        },
      };
    }
  }

  let reservationEntryId: string | null = job.job.reservation_ledger_entry_id;
  let captureEntryId: string | null = job.job.capture_ledger_entry_id;

  try {
    const reservation = await reserveCredits({
      store,
      creditAccountId: account.id,
      userId: input.userId,
      sourceAnalysisJobId: job.job.id,
      credits: creditsRequired,
      idempotencyKey: `reserve:${idempotencyKey}`,
      source: "social_reels_source_analysis",
      metadata: {
        duration_bucket_key: durationBuckets.join(","),
        source_duration_seconds: Math.ceil(sourceDurationSeconds),
      },
    });
    reservationEntryId = reservation.entry.id;

    if (store) {
      await store.updateSourceAnalysisJob(job.job.id, {
        status: "running",
        reservation_ledger_entry_id: reservationEntryId,
        started_at: new Date().toISOString(),
      });
    }

    const discoverResult = await input.discover(input.request);
    const candidates = resultCandidatesForStorage(discoverResult);
    if (candidates.length === 0) {
      throw new SocialReelsCreditLedgerError("job_failed_schema", "Social Reels discovery returned no valid candidates.", 502);
    }

    const capture = await captureReservedCredits({
      store,
      creditAccountId: account.id,
      reservationEntryId,
      idempotencyKey: `capture:${idempotencyKey}`,
      credits: creditsRequired,
      metadata: {
        candidate_count: candidates.length,
        discovery_mode: discoverResult.discoveryMode,
      },
    });
    captureEntryId = capture.entry.id;

    const succeededJob = await markSourceAnalysisJobSucceeded({
      store,
      jobId: job.job.id,
      captureLedgerEntryId: captureEntryId,
      candidates,
    });

    if (useCache && store?.upsertAnalysisCacheEntry) {
      await store.upsertAnalysisCacheEntry({
        credit_account_id: account.id,
        source_fingerprint: sourceFingerprint,
        transcript_normalization_hash: transcriptNormalizationHash,
        analysis_mode: "social_reels",
        prompt_version: SOCIAL_REELS_DISCOVER_CREDIT_PROMPT_VERSION,
        schema_version: schemaVersion,
        duration_buckets: durationBuckets,
        source_duration_seconds: Math.ceil(sourceDurationSeconds),
        candidate_count: candidates.length,
        status: "ready",
        latest_source_analysis_job_id: succeededJob.id,
        metadata_json: sanitizeCreditMetadata({
          cache_policy: "source_fingerprint_transcript_hash_prompt_schema_duration_buckets",
          cache_key_includes_source_duration: true,
          cache_key_includes_word_hash_when_provided: true,
          discovery_mode: discoverResult.discoveryMode,
        }),
        last_used_at: new Date().toISOString(),
      });
    }

    return {
      discoverResult,
      jobId: succeededJob.id,
      status: "succeeded",
      cachedCandidates: null,
      groups: buildSocialReelsCandidateGroups(discoverResult),
      billing: {
        creditUnit: "source_media_minute",
        creditsRequired,
        creditsRequiredForFullRun: creditsRequired,
        creditsReserved: reservation.idempotent ? 0 : creditsRequired,
        creditsCharged: capture.idempotent ? 0 : creditsRequired,
        creditsRefunded: 0,
        cacheStatus: cacheStatusForRun,
        noFullSourceMinuteCharge: false,
        idempotent: job.idempotent || reservation.idempotent || capture.idempotent,
        creditAccountId: account.id,
        reservationLedgerEntryId: reservationEntryId,
        captureLedgerEntryId: captureEntryId,
        regenerationPolicy: "full_source_minute_charge",
        ...balanceFields(capture.balance),
      },
    };
  } catch (error) {
    if (reservationEntryId && !captureEntryId) {
      await markSourceAnalysisJobFailedAndReleaseOrRefund({
        store,
        jobId: job.job.id,
        reasonCode: error instanceof SocialReelsCreditLedgerError ? "job_failed_schema" : mapDiscoveryFailureReason(error),
        idempotencyKey: `failure:${idempotencyKey}`,
      }).catch(() => null);
    }
    throw error;
  }
}
