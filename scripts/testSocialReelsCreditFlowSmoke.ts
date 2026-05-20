import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type JsonObject = Record<string, unknown>;

const FIXTURES = {
  success: "docs/contracts/social_reels_discover_credit_flow_success.backend_fixture.json",
  cached: "docs/contracts/social_reels_discover_credit_flow_cached.backend_fixture.json",
  insufficient: "docs/contracts/social_reels_discover_credit_flow_insufficient_credits.backend_fixture.json",
  failedReleased: "docs/contracts/social_reels_discover_credit_flow_failed_released.backend_fixture.json",
} as const;

const FORBIDDEN_FIELD_OR_SECRET_PATTERNS = [
  /platformRisk/,
  /riskReason/,
  /highRiskHighReward/,
  /advertiserSafety/,
  /brandSafety/,
  /sexualRisk/,
  /controversyRisk/,
  /contentSafetyScore/,
  /content[-_ ]?topic[-_ ]?rejection/i,
  /Authorization/i,
  /access_token/i,
  /refresh_token/i,
  /Bearer\s+/i,
  /\/Users\//,
  /file:\/\//i,
  /raw[_ -]?transcript/i,
  /raw[_ -]?word/i,
  /wordJson/i,
  /media[_ -]?path/i,
  /cache[_ -]?path/i,
  /OPENAI_API_KEY/i,
  /Whisper/i,
  /pyannote/i,
];

function readJson(path: string): JsonObject {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8")) as JsonObject;
}

function serialized(value: unknown) {
  return JSON.stringify(value);
}

function assertClean(value: unknown, label: string) {
  const text = serialized(value);
  for (const pattern of FORBIDDEN_FIELD_OR_SECRET_PATTERNS) {
    assert(!pattern.test(text), `${label} should not contain forbidden risk/private data pattern ${pattern}.`);
  }
}

function requiredString(record: JsonObject, key: string) {
  assert.equal(typeof record[key], "string", `${key} should be a string.`);
  return record[key] as string;
}

function assertBilling(record: JsonObject, expected: { cacheStatus: string; creditsCharged: number; noFullSourceMinuteCharge: boolean }) {
  assert(record.billing && typeof record.billing === "object", "Success/cached response should include top-level billing.");
  const billing = record.billing as JsonObject;
  assert.equal(billing.creditUnit, "source_media_minute");
  assert.equal(typeof billing.sourceDurationSeconds, "number");
  assert.equal(typeof billing.creditsRequired, "number");
  assert.equal(typeof billing.creditsRequiredForFullRun, "number");
  assert.equal(typeof billing.creditsReserved, "number");
  assert.equal(billing.creditsCharged, expected.creditsCharged);
  assert.equal(typeof billing.creditsRefunded, "number");
  assert.equal(billing.cacheStatus, expected.cacheStatus);
  assert.equal(billing.noFullSourceMinuteCharge, expected.noFullSourceMinuteCharge);
  assert.equal(typeof billing.regenerationPolicy, "string");

  for (const snakeCaseBillingKey of [
    "source_duration_seconds",
    "credits_required",
    "credits_required_for_full_run",
    "credits_charged",
    "cache_status",
    "no_full_source_minute_charge",
  ]) {
    assert.equal(billing[snakeCaseBillingKey], undefined, `Billing should keep current camelCase key ${snakeCaseBillingKey}.`);
  }
}

function assertCandidate(candidate: JsonObject, label: string) {
  requiredString(candidate, "candidate_id");
  requiredString(candidate, "duration_bucket");
  assert.notEqual(candidate.duration_bucket, "mixed", `${label} should use concrete duration buckets for candidates.`);
  requiredString(candidate, "title");
  requiredString(candidate, "summary");

  assert.equal(candidate.candidateId, undefined, `${label} should keep snake_case candidate_id.`);
  assert.equal(candidate.durationBucket, undefined, `${label} should keep snake_case candidate duration_bucket.`);
  assert.equal(candidate.sourceStartWordId, undefined, `${label} should keep snake_case source_start_word_id.`);
  assert.equal(candidate.sourceEndWordId, undefined, `${label} should keep snake_case source_end_word_id.`);

  if ("source_start_word_id" in candidate || "source_end_word_id" in candidate) {
    requiredString(candidate, "source_start_word_id");
    requiredString(candidate, "source_end_word_id");
  }
}

function assertGroupedEnvelope(record: JsonObject, label: string) {
  assert.equal(record.ok, true, `${label} should be a successful envelope.`);
  assert.equal(typeof record.response_schema, "string", `${label} should expose response_schema.`);
  assert(Array.isArray(record.candidates), `${label} should expose top-level candidates.`);
  assert(Array.isArray(record.groups), `${label} should expose top-level groups.`);

  const candidates = record.candidates as JsonObject[];
  assert(candidates.length > 0, `${label} should include candidates.`);
  for (const candidate of candidates) assertCandidate(candidate, `${label} candidates`);

  const groups = record.groups as JsonObject[];
  assert(groups.length > 0, `${label} should include grouped duration results.`);
  for (const group of groups) {
    requiredString(group, "durationBucket");
    assert.equal(group.duration_bucket, undefined, `${label} groups should keep durationBucket in current mixed casing.`);
    assert(Array.isArray(group.candidates), `${label} group candidates should be embedded arrays.`);
    for (const candidate of group.candidates as JsonObject[]) assertCandidate(candidate, `${label} group candidates`);
  }
}

const success = readJson(FIXTURES.success);
assertGroupedEnvelope(success, FIXTURES.success);
assert.equal(success.response_schema, "social_reels_candidates_v1");
assertBilling(success, { cacheStatus: "miss", creditsCharged: 2, noFullSourceMinuteCharge: false });
assertClean(success, FIXTURES.success);

const cached = readJson(FIXTURES.cached);
assertGroupedEnvelope(cached, FIXTURES.cached);
assert.equal(cached.response_schema, "cached_candidates");
assertBilling(cached, { cacheStatus: "hit", creditsCharged: 0, noFullSourceMinuteCharge: true });
assertClean(cached, FIXTURES.cached);

const insufficient = readJson(FIXTURES.insufficient);
assert.equal(insufficient.response_schema, "social_reels_error_v1");
assert.equal(insufficient.error, "insufficient_credits");
assert.equal(insufficient.reason_code, "insufficient_credits");
assert.equal(insufficient.billing, undefined);
assert.equal(insufficient.groups, undefined);
assertClean(insufficient, FIXTURES.insufficient);

const failedReleased = readJson(FIXTURES.failedReleased);
assert.equal(failedReleased.response_schema, "social_reels_error_v1");
assert.equal(failedReleased.code, "schema_mismatch");
assert.equal(typeof failedReleased.reason_code, "string");
assert.equal(failedReleased.billing, undefined);
assert.equal(failedReleased.groups, undefined);
assertClean(failedReleased, FIXTURES.failedReleased);

const routeSource = readFileSync(resolve(process.cwd(), "app/api/social-reels/discover/route.ts"), "utf8");
assert(routeSource.includes('SOCIAL_REELS_CREDIT_SUCCESS_RESPONSE_SCHEMA = "social_reels_candidates_v1"'));
assert(routeSource.includes('SOCIAL_REELS_ERROR_RESPONSE_SCHEMA = "social_reels_error_v1"'));
assert(routeSource.includes('reason_code: "auth_required"'), "Auth errors should remain distinct from cloud failures.");
assert(routeSource.includes('reason_code: "cloud_unavailable_after_auth"'), "Cloud failures should remain post-auth specific.");
assert(routeSource.includes("isSocialReelsDiscoverCreditsEnabled()"), "Credit-aware path should remain feature-flag guarded.");

console.log("Social Reels credit flow smoke tests passed.");
