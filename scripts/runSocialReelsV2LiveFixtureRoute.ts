import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { SOCIAL_REELS_DURATION_BUCKETS, socialReelsRequestSchema } from "../lib/socialReelsSchema";
import { getSocialReelsLiveDurationCompliance } from "../lib/socialReelsShortlist";

type JsonRecord = Record<string, unknown>;
type DurationBucket = (typeof SOCIAL_REELS_DURATION_BUCKETS)[number];

const ARTIFACT_DIR = resolve(process.cwd(), "artifacts/social-reels-v2-fixture-review/latest");
const FIXTURE_PATH = resolve(process.cwd(), "tests/fixtures/social_reels_transcript_v2_real_request.local.json");
const REQUIRED_GATE = "RUN_SOCIAL_REELS_V2_LIVE_FIXTURE";
const DEFAULT_BASE_URL = "http://127.0.0.1:3131";
const SERVICE_TRANSPORT = "service";
const PRIVATE_PATTERN = /(?:\/Users\/|file:\/\/|\.fcpxml\b|cache_path|media_path|OPENAI_API_KEY|access_token|refresh_token|Bearer\s+)/i;

function loadDotEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  const envFile = readFileSync(envPath, "utf8");
  for (const line of envFile.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    const value = valueParts.join("=").replace(/^[']|[']$/g, "").replace(/^["]|["]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function readResponse(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function fail(message: string): never {
  throw new Error(message);
}

function scoreToFive(value: unknown, fallback = 3) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(5, Math.round(value * 5)));
}

function asDurationBucket(value: unknown): DurationBucket {
  return typeof value === "string" && SOCIAL_REELS_DURATION_BUCKETS.includes(value as DurationBucket)
    ? (value as DurationBucket)
    : "30s";
}

function nearestTimecode(parsed: ReturnType<typeof socialReelsRequestSchema.parse>, seconds: number, kind: "start" | "end") {
  const sorted = [...parsed.utterances].sort((a, b) => {
    const aSeconds = kind === "start" ? a.start_seconds : a.end_seconds;
    const bSeconds = kind === "start" ? b.start_seconds : b.end_seconds;
    return Math.abs(aSeconds - seconds) - Math.abs(bSeconds - seconds);
  });
  const closest = sorted[0];
  return kind === "start" ? closest?.start_timecode ?? null : closest?.end_timecode ?? null;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b));
}

function speakersForCandidate(parsed: ReturnType<typeof socialReelsRequestSchema.parse>, startSeconds: number, endSeconds: number) {
  return uniqueStrings(
    parsed.utterances
      .filter((utterance) => utterance.end_seconds >= startSeconds && utterance.start_seconds <= endSeconds)
      .map((utterance) => utterance.speaker_label)
  );
}

function candidateScores(candidate: JsonRecord) {
  const scores = asRecord(candidate.scores);
  return {
    hook: scoreToFive(scores.hook_strength ?? candidate.score),
    standalone_clarity: scoreToFive(scores.standalone_clarity ?? candidate.score),
    emotional_tension: scoreToFive(scores.emotional_charge ?? candidate.score),
    payoff_reframe: scoreToFive(scores.payoff_strength ?? candidate.score),
    boundary_cleanliness: scoreToFive(scores.editability ?? candidate.score),
    platform_suitability: scoreToFive(scores.shareability ?? candidate.score),
    editability: scoreToFive(scores.editability ?? candidate.score),
    overall_human_taste: scoreToFive(scores.overall ?? candidate.score),
  };
}

function statusForCandidate(candidate: JsonRecord) {
  const score = typeof candidate.score === "number" ? candidate.score : 0;
  const flags = [
    ...(Array.isArray(candidate.risk_flags) ? candidate.risk_flags : []),
    ...(Array.isArray(candidate.rejection_risk_flags) ? candidate.rejection_risk_flags : []),
  ].map(String);
  const seriousFlags = new Set(["unsafe_or_policy_risk", "weak_hook", "missing_payoff", "too_context_dependent", "low_editability"]);
  if (flags.some((flag) => seriousFlags.has(flag)) || score < 0.55) return "Reject";
  if (score >= 0.78 && !flags.includes("sensitive_topic")) return "Ready";
  return "Needs Review";
}

function safeCandidate(parsed: ReturnType<typeof socialReelsRequestSchema.parse>, candidate: JsonRecord, index: number) {
  const startSeconds = typeof candidate.start_seconds === "number" ? candidate.start_seconds : 0;
  const endSeconds = typeof candidate.end_seconds === "number" ? candidate.end_seconds : startSeconds;
  const durationSeconds = typeof candidate.duration_seconds === "number" ? candidate.duration_seconds : Math.round(endSeconds - startSeconds);
  const durationBucket = asDurationBucket(candidate.duration_bucket);
  const compliance = getSocialReelsLiveDurationCompliance({
    duration_bucket: durationBucket,
    duration_seconds: durationSeconds,
    start_seconds: startSeconds,
    end_seconds: endSeconds,
  });
  const scores = candidateScores(candidate);
  const status = compliance.ok ? statusForCandidate(candidate) : "Reject";

  return {
    rank: index + 1,
    candidate_id: candidate.candidate_id,
    title: candidate.title,
    suggested_human_readable_title: candidate.hook_title || candidate.title,
    suggested_caption_preview_text: candidate.social_caption || candidate.summary || null,
    clip_type: candidate.clip_type,
    topic_tag: candidate.topic_tag,
    duration_bucket: durationBucket,
    start_seconds: startSeconds,
    end_seconds: endSeconds,
    start_timecode: nearestTimecode(parsed, startSeconds, "start"),
    end_timecode: nearestTimecode(parsed, endSeconds, "end"),
    approximate_duration: durationSeconds,
    speakers: speakersForCandidate(parsed, startSeconds, endSeconds),
    raw_score: candidate.score,
    proposed_display_score: typeof candidate.score === "number" ? Math.round(candidate.score * 100) : null,
    status,
    why_it_works: candidate.why_it_works || candidate.rationale || null,
    risks: {
      risk_flags: Array.isArray(candidate.risk_flags) ? candidate.risk_flags : [],
      rejection_risk_flags: Array.isArray(candidate.rejection_risk_flags) ? candidate.rejection_risk_flags : [],
      sensitivity_level: candidate.sensitivity_level ?? null,
      context_dependency: candidate.context_dependency ?? null,
      duration_compliance: compliance,
    },
    boundary_quality: compliance.ok ? "Duration bucket compliant by backend range; app should still word/frame snap." : "Outside backend duration compliance range.",
    standalone_clarity: scores.standalone_clarity >= 4 ? "Strong" : scores.standalone_clarity === 3 ? "Review" : "Weak",
    first_3_seconds_hook: scores.hook >= 4 ? "Strong" : scores.hook === 3 ? "Review" : "Weak",
    ending_satisfaction: scores.payoff_reframe >= 4 ? "Strong" : scores.payoff_reframe === 3 ? "Review" : "Weak",
    quality_scores_1_to_5: scores,
  };
}

function renderReview(candidates: ReturnType<typeof safeCandidate>[], metadata: JsonRecord) {
  const ready = candidates.filter((candidate) => candidate.status === "Ready");
  const review = candidates.filter((candidate) => candidate.status === "Needs Review");
  const reject = candidates.filter((candidate) => candidate.status === "Reject");
  const lines = [
    "# Live Social Reels Candidate Review",
    "",
    "## Summary",
    `- Provider/model: ${metadata.provider || "unknown"} / ${metadata.model || "unknown"}`,
    `- Discovery mode: ${metadata.discovery_mode || "unknown"}`,
    `- Candidate count returned: ${candidates.length}`,
    `- Status counts: Ready ${ready.length}, Needs Review ${review.length}, Reject ${reject.length}`,
    `- Requested/effective candidates: ${metadata.requested_candidate_count ?? "unknown"} / ${metadata.effective_candidate_count ?? "unknown"}`,
    `- Live OpenAI call: exactly one route discovery request was made by this script.`,
    "- Transcript text, raw prompt, tokens, and private paths are not included in this review artifact.",
    "",
    "## Best 5 Candidates",
    ...candidates.slice(0, 5).map((candidate) => `- #${candidate.rank} ${candidate.title} — ${candidate.status}, score ${candidate.proposed_display_score ?? "n/a"}`),
    "",
    "## Weak Candidates",
    ...(reject.length > 0 ? reject.map((candidate) => `- #${candidate.rank} ${candidate.title} — ${candidate.risks.rejection_risk_flags.join(", ") || "duration/quality risk"}`) : ["- None marked Reject by the backend review heuristic."]),
    "",
    "## Duplicate / Theme Overlap",
    "- Review manually in the app UI; this artifact does not include transcript body, so semantic overlap is estimated from titles/topics only.",
    "",
    "## Pool Size / Padding",
    `- Requested ${metadata.requested_candidate_count ?? "unknown"}; effective live shortlist ${metadata.effective_candidate_count ?? "unknown"}; returned ${candidates.length}.`,
    `- ${candidates.length < Number(metadata.effective_candidate_count || candidates.length) ? "The model returned fewer than the effective cap; no obvious padding pressure." : "The model filled the effective cap; inspect lower-ranked candidates for padding."}`,
    "",
    "## Prompt / Display Recommendations",
    "- Do not tune prompt from this artifact alone unless the app preview confirms weak boundaries or mid-thought cuts.",
    "- App display score can continue using backend score as raw input, but human-facing status should account for app validation, duration compliance, and preview quality.",
    "",
  ];

  for (const candidate of candidates) {
    lines.push(
      `## Candidate ${candidate.rank}: ${candidate.title}`,
      "",
      `- Start/end seconds: ${candidate.start_seconds}–${candidate.end_seconds}`,
      `- Start/end timecode: ${candidate.start_timecode || "unknown"}–${candidate.end_timecode || "unknown"}`,
      `- Approximate duration: ${candidate.approximate_duration}s`,
      `- Speakers: ${candidate.speakers.join(", ") || "unknown"}`,
      `- Raw score: ${candidate.raw_score ?? "unknown"}`,
      `- Proposed display score: ${candidate.proposed_display_score ?? "unknown"}`,
      `- Status: ${candidate.status}`,
      `- Why it works: ${candidate.why_it_works || "not provided"}`,
      `- Risks: ${[...candidate.risks.risk_flags, ...candidate.risks.rejection_risk_flags].join(", ") || "none"}`,
      `- Boundary quality: ${candidate.boundary_quality}`,
      `- Standalone clarity: ${candidate.standalone_clarity}`,
      `- First-3-seconds hook: ${candidate.first_3_seconds_hook}`,
      `- Ending satisfaction: ${candidate.ending_satisfaction}`,
      `- Suggested human-readable title: ${candidate.suggested_human_readable_title || candidate.title}`,
      `- Suggested caption preview text: ${candidate.suggested_caption_preview_text || "not provided"}`,
      ""
    );
  }

  return lines.join("\n");
}

function writeLiveArtifacts(
  parsed: ReturnType<typeof socialReelsRequestSchema.parse>,
  bodyRecord: JsonRecord,
  httpStatus: number
) {
  const candidates = Array.isArray(bodyRecord.candidates) ? bodyRecord.candidates.map(asRecord) : [];
  const safeCandidates = candidates.map((candidate, index) => safeCandidate(parsed, candidate, index));
  const metadata = {
    request_id: bodyRecord.request_id || null,
    provider: bodyRecord.provider || null,
    model: bodyRecord.model || null,
    provider_response_id: bodyRecord.providerResponseId || null,
    discovery_mode: bodyRecord.discovery_mode || null,
    requested_candidate_count: bodyRecord.requested_candidate_count || null,
    effective_candidate_count: bodyRecord.effective_candidate_count || null,
    returned_candidate_count: bodyRecord.returned_candidate_count || candidates.length,
    filtered_candidate_count: bodyRecord.filtered_candidate_count || null,
    live_filter_reasons: bodyRecord.live_filter_reasons || null,
    returned_duration_seconds_range: bodyRecord.returned_duration_seconds_range || null,
    eligible_duration_window_count: bodyRecord.eligible_duration_window_count || null,
    duration_window_count_sent_to_model: bodyRecord.duration_window_count_sent_to_model || null,
    prompt_context_char_count_sent_to_model: bodyRecord.prompt_context_char_count_sent_to_model || null,
    windows_after_quality_filter: bodyRecord.windows_after_quality_filter || null,
    usage: bodyRecord.usage || null,
    diagnostics: asRecord(bodyRecord.diagnostics),
    utterances_used: parsed.utterances.length > 0,
    utterance_count: parsed.utterances.length,
    segment_count: parsed.segments.length,
    speaker_labels: uniqueStrings(parsed.utterances.map((utterance) => utterance.speaker_label)),
    live_openai_call_count_from_this_script: 1,
  };

  mkdirSync(ARTIFACT_DIR, { recursive: true });
  writeJson(resolve(ARTIFACT_DIR, "live_candidate_output.json"), {
    ok: true,
    http_status: httpStatus,
    metadata,
    candidates: safeCandidates,
  });
  writeJson(resolve(ARTIFACT_DIR, "live_candidate_output_quality_matrix.json"), {
    metadata: {
      request_id: metadata.request_id,
      provider: metadata.provider,
      model: metadata.model,
      candidate_count: safeCandidates.length,
    },
    candidates: safeCandidates.map((candidate) => ({
      rank: candidate.rank,
      candidate_id: candidate.candidate_id,
      title: candidate.title,
      status: candidate.status,
      quality_scores_1_to_5: candidate.quality_scores_1_to_5,
    })),
  });
  writeFileSync(resolve(ARTIFACT_DIR, "live_candidate_output_human_review.md"), renderReview(safeCandidates, metadata));
  writeJson(resolve(ARTIFACT_DIR, "live_prompt_metadata_redacted.json"), {
    ...metadata,
    diagnostics: {
      mode: asRecord(metadata.diagnostics).mode || null,
      provider: asRecord(metadata.diagnostics).provider || null,
      model: asRecord(metadata.diagnostics).model || null,
      openai_elapsed_ms: asRecord(metadata.diagnostics).openaiElapsedMs || asRecord(metadata.diagnostics).openai_elapsed_ms || null,
      response_parse_ms: asRecord(metadata.diagnostics).responseParseMs || asRecord(metadata.diagnostics).response_parse_ms || null,
      total_elapsed_ms: asRecord(metadata.diagnostics).total_elapsed_ms || null,
      timeout_stage: asRecord(metadata.diagnostics).timeout_stage || null,
    },
  });

  for (const path of [
    "live_candidate_output.json",
    "live_candidate_output_quality_matrix.json",
    "live_candidate_output_human_review.md",
    "live_prompt_metadata_redacted.json",
  ]) {
    const artifactText = readFileSync(resolve(ARTIFACT_DIR, path), "utf8");
    if (PRIVATE_PATTERN.test(artifactText)) fail(`Privacy check failed for ${path}.`);
  }

  return { safeCandidates, metadata };
}

async function main() {
  loadDotEnvLocal();
  if (process.env[REQUIRED_GATE] !== "1") fail(`${REQUIRED_GATE}=1 is required for the authorized one-call live fixture run.`);
  if (!process.env.OPENAI_API_KEY) fail("OPENAI_API_KEY is not configured; no live call was made.");

  const baseUrl = (process.env.TEST_BACKEND_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  const fixtureRaw = JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as unknown;
  const parsed = socialReelsRequestSchema.parse(fixtureRaw);

  if (process.env.SOCIAL_REELS_V2_LIVE_FIXTURE_TRANSPORT === SERVICE_TRANSPORT) {
    const serverOnlyStubDir = resolve(process.cwd(), "node_modules/server-only");
    const serverOnlyStubPackage = resolve(serverOnlyStubDir, "package.json");
    if (!existsSync(serverOnlyStubPackage)) {
      mkdirSync(serverOnlyStubDir, { recursive: true });
      writeFileSync(serverOnlyStubPackage, "{\"name\":\"server-only\",\"version\":\"0.0.0\",\"main\":\"index.js\"}\n");
      writeFileSync(resolve(serverOnlyStubDir, "index.js"), "");
    }

    const { discoverSocialReelsCandidates } = await import("../lib/openaiSocialReels");
    // The only OpenAI discovery call in service transport. Do not retry.
    const result = await discoverSocialReelsCandidates(fixtureRaw, { mock: false });
    const requestId = crypto.randomUUID();
    const { safeCandidates, metadata } = writeLiveArtifacts(
      parsed,
      {
        request_id: requestId,
        provider: result.mock ? "mock" : "openai",
        model: result.model,
        providerResponseId: result.providerResponseId,
        discovery_mode: result.discoveryMode,
        requested_candidate_count: result.requestedCandidateCount,
        effective_candidate_count: result.effectiveCandidateCount,
        returned_candidate_count: result.returnedCandidateCount,
        filtered_candidate_count: result.filteredCandidateCount,
        live_filter_reasons: result.liveFilterReasons,
        returned_duration_seconds_range: result.returnedDurationSecondsRange,
        eligible_duration_window_count: result.eligibleDurationWindowCount,
        duration_window_count_sent_to_model: result.durationWindowCountSentToModel,
        prompt_context_char_count_sent_to_model: result.promptContextCharCountSentToModel,
        windows_after_quality_filter: result.windowsAfterQualityFilter,
        usage: result.usage,
        diagnostics: result.diagnostics,
        candidates: result.response?.candidates ?? [],
      },
      200
    );

    console.log(JSON.stringify({
      ok: true,
      transport: SERVICE_TRANSPORT,
      live_openai_call_count_from_this_script: 1,
      http_status: 200,
      request_id: metadata.request_id,
      provider: metadata.provider,
      model: metadata.model,
      discovery_mode: metadata.discovery_mode,
      candidate_count: safeCandidates.length,
      artifact_dir: ARTIFACT_DIR.replace(process.cwd() + "/", ""),
    }, null, 2));
    return;
  }

  if (!process.env.TEST_EMAIL || !process.env.TEST_PASSWORD) fail("TEST_EMAIL/TEST_PASSWORD are required; no live call was made.");

  const login = await fetch(`${baseUrl}/api/app/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.TEST_EMAIL,
      password: process.env.TEST_PASSWORD,
      deviceName: "Codex Social Reels V2 Live Fixture",
      deviceFingerprint: `codex-social-reels-v2-live-${Date.now()}`,
    }),
  });
  const loginBody = await readResponse(login);
  if (!login.ok) fail(`Login failed with status ${login.status}; no live discovery call was made.`);
  const token = asRecord(loginBody).access_token;
  if (typeof token !== "string" || token.length === 0) fail("Login did not return an access token; no live discovery call was made.");

  // The only /api/social-reels/discover request in this script. Do not retry.
  const discover = await fetch(`${baseUrl}/api/social-reels/discover`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(fixtureRaw),
  });
  const body = await readResponse(discover);
  const bodyRecord = asRecord(body);
  if (!discover.ok) {
    mkdirSync(ARTIFACT_DIR, { recursive: true });
    writeJson(resolve(ARTIFACT_DIR, "live_candidate_output.json"), {
      ok: false,
      http_status: discover.status,
      request_id: bodyRecord.request_id || null,
      error: bodyRecord.error || "live_discovery_failed",
      stage: bodyRecord.stage || bodyRecord.timeout_stage || null,
      diagnostics: bodyRecord.diagnostics || null,
    });
    fail(`Live discovery request failed with status ${discover.status}; exactly one discovery request was made.`);
  }

  const { safeCandidates, metadata } = writeLiveArtifacts(parsed, bodyRecord, discover.status);

  console.log(JSON.stringify({
    ok: true,
    live_openai_call_count_from_this_script: 1,
    http_status: discover.status,
    request_id: metadata.request_id,
    provider: metadata.provider,
    model: metadata.model,
    discovery_mode: metadata.discovery_mode,
    candidate_count: safeCandidates.length,
    artifact_dir: ARTIFACT_DIR.replace(process.cwd() + "/", ""),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Live fixture run failed.");
  process.exitCode = 1;
});
