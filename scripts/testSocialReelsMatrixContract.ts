import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  socialReelsDiscoveryMatrixResponseSchema,
  socialReelsRequestSchema,
} from "../lib/socialReelsSchema";

const REQUEST_FIXTURE_PATH = resolve(process.cwd(), "tests/fixtures/social_reels_discovery_matrix_request.redacted.json");
const RESPONSE_FIXTURE_PATH = resolve(process.cwd(), "artifacts/social-reels-matrix-contract/latest/social_reels_matrix_response.backend_fixture.json");
const PROMPT_WINDOWS_PATH = resolve(process.cwd(), "artifacts/social-reels-matrix-contract/latest/social_reels_matrix_prompt_windows.redacted.json");
const REPORT_PATH = resolve(process.cwd(), "artifacts/social-reels-matrix-contract/latest/backend_matrix_contract_report.md");
const PRIVATE_PATTERN = /(?:\/Users\/|file:\/\/|\.fcpxml\b|cache_path|media_path|OPENAI_API_KEY|access_token|refresh_token|Bearer\s+|wordAlignment|word_timing|words_aligned)/i;

let failed = false;

function assert(condition: unknown, message: string) {
  if (condition) return;
  failed = true;
  console.error(`FAIL: ${message}`);
}

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function privacyCheck(path: string) {
  const content = readFileSync(path, "utf8");
  assert(!PRIVATE_PATTERN.test(content), `${path} should not contain private paths, secrets, or raw word JSON keys.`);
}

const request = socialReelsRequestSchema.parse(readJson(REQUEST_FIXTURE_PATH));
const responseEnvelope = readJson(RESPONSE_FIXTURE_PATH) as {
  ok?: boolean;
  fixture_kind?: string;
  response_schema?: string;
  moments?: unknown;
  buckets?: unknown;
  modelNotes?: unknown;
};
const response = socialReelsDiscoveryMatrixResponseSchema.parse({
  moments: responseEnvelope.moments,
  buckets: responseEnvelope.buckets,
  model_notes: responseEnvelope.modelNotes,
});
const promptWindows = readJson(PROMPT_WINDOWS_PATH) as {
  transcript_source?: string;
  requested_targets?: unknown[];
  duration_windows?: unknown[];
  response_schema_summary?: {
    bucket_field_name?: string;
    moment_id_field_name?: string;
  };
};
const report = readFileSync(REPORT_PATH, "utf8");

assert(request.discovery_matrix !== null, "Matrix request fixture should parse as a discovery matrix request.");
assert(request.utterances.length > 0, "Matrix request fixture should include transcript v2 utterances.");
assert(request.requested_targets.length >= 4, "Matrix request should include multiple target buckets.");
assert(request.dedupe_shared_moments === true, "Matrix request should preserve dedupe_shared_moments.");
assert(request.max_per_bucket <= 20, "Matrix max_per_bucket should be capped to 20.");
assert(responseEnvelope.ok === true, "Backend matrix fixture envelope should be ok.");
assert(responseEnvelope.response_schema === "discovery_matrix", "Backend fixture should identify discovery_matrix schema.");
assert(Array.isArray(responseEnvelope.moments), "Backend fixture should use moments[] as canonical moment array.");
assert(Array.isArray(responseEnvelope.buckets), "Backend fixture should use buckets[] as canonical bucket array.");
assert(response.moments.length >= 5, "Backend fixture should include multiple moment examples.");
assert(response.buckets.length >= 4, "Backend fixture should include multiple bucket examples.");
assert(response.moments.some((moment) => moment.buckets.length > 1), "At least one moment should appear in multiple buckets.");
assert(response.moments.some((moment) => moment.review_flags.length === 0 && moment.raw_score >= 0.78), "Fixture should include at least one Ready example.");
assert(response.moments.some((moment) => moment.review_flags.length > 0 && moment.raw_score >= 0.55), "Fixture should include at least one Needs Review example.");
assert(response.moments.some((moment) => moment.review_flags.includes("weak_hook") || moment.raw_score < 0.55), "Fixture should include at least one Rejected example.");
assert(
  response.buckets.some((bucket) => bucket.style === "emotional" && bucket.duration === "30s"),
  "Fixture should include emotional / 30s bucket."
);
assert(
  response.buckets.some((bucket) => bucket.style === "educational" && bucket.duration === "30s"),
  "Fixture should include educational / 30s bucket."
);
assert(response.buckets.some((bucket) => bucket.style === "story" && bucket.duration === "90s"), "Fixture should include story / 90s bucket.");
assert(
  response.buckets.some((bucket) => bucket.style === "hookFirst" || bucket.style === "controversial"),
  "Fixture should include hookFirst or controversial style bucket."
);
assert(response.buckets.some((bucket) => bucket.duration === "15s"), "Fixture should include 15s duration bucket.");
assert(response.buckets.some((bucket) => bucket.duration === "30s"), "Fixture should include 30s duration bucket.");
assert(response.buckets.some((bucket) => bucket.duration === "90s"), "Fixture should include 90s duration bucket.");
assert(response.buckets.some((bucket) => bucket.duration === "5-10m"), "Fixture should include deepCut5To10m normalized to 5-10m.");

const momentIds = new Set(response.moments.map((moment) => moment.moment_id));
for (const bucket of response.buckets) {
  assert(bucket.moment_ids.length <= request.max_per_bucket, `Bucket ${bucket.style}/${bucket.duration} should honor max_per_bucket.`);
  for (const momentId of bucket.moment_ids) {
    assert(momentIds.has(momentId), `Bucket references unknown moment ID: ${momentId}.`);
  }
}
for (const moment of response.moments) {
  assert(moment.speakers.length > 0, `Moment ${moment.moment_id} should include clean speaker labels.`);
  assert(moment.start_seconds < moment.end_seconds, `Moment ${moment.moment_id} should include valid timing.`);
  assert(moment.start_timecode !== undefined && moment.end_timecode !== undefined, `Moment ${moment.moment_id} should include timecode fields.`);
}

assert(promptWindows.transcript_source === "utterances", "Prompt window artifact should mark utterances as source of truth.");
assert(Array.isArray(promptWindows.duration_windows), "Prompt window artifact should include duration_windows.");
assert(promptWindows.response_schema_summary?.bucket_field_name === "buckets", "Prompt window artifact should document canonical bucket field.");
assert(promptWindows.response_schema_summary?.moment_id_field_name === "moment_id", "Prompt window artifact should document moment ID field.");
assert(report.includes("Live OpenAI call made: no"), "Contract report should state no live OpenAI call was made.");

for (const path of [RESPONSE_FIXTURE_PATH, PROMPT_WINDOWS_PATH, REPORT_PATH]) {
  privacyCheck(path);
}

console.log(
  JSON.stringify(
    {
      fixture: "artifacts/social-reels-matrix-contract/latest/social_reels_matrix_response.backend_fixture.json",
      response_schema: responseEnvelope.response_schema,
      moments: response.moments.length,
      buckets: response.buckets.length,
      shared_bucket_moment: response.moments.some((moment) => moment.buckets.length > 1),
      ready_examples: response.moments.filter((moment) => moment.review_flags.length === 0 && moment.raw_score >= 0.78).length,
      needs_review_examples: response.moments.filter((moment) => moment.review_flags.length > 0 && moment.raw_score >= 0.55).length,
      rejected_examples: response.moments.filter((moment) => moment.review_flags.includes("weak_hook") || moment.raw_score < 0.55).length,
      transcript_source: promptWindows.transcript_source,
      live_openai_call_made: false,
    },
    null,
    2
  )
);

if (!failed) {
  console.log("PASS: social reels matrix contract fixture passed without a live OpenAI call.");
}

process.exitCode = failed ? 1 : 0;
