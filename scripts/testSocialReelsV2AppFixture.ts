import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildSocialReelsOpenAIPromptInput } from "../lib/socialReelsOpenAIPrompt";
import {
  buildSocialReelsLiveDurationWindows,
  buildSocialReelsLivePromptWindows,
  type SocialReelsDurationWindow,
} from "../lib/socialReelsDurationWindows";
import { socialReelsRequestSchema, type SocialReelsRequest } from "../lib/socialReelsSchema";

const FIXTURES = [
  {
    name: "redacted",
    path: resolve(process.cwd(), "tests/fixtures/social_reels_transcript_v2_outbound_request.redacted.json"),
    expectedLabels: ["Layla", "Fabienne", "Jef"],
    allowTooShortForRequestedBucket: true,
  },
  {
    name: "real_local",
    path: resolve(process.cwd(), "tests/fixtures/social_reels_transcript_v2_real_request.local.json"),
    expectedLabels: [] as string[],
    allowTooShortForRequestedBucket: false,
  },
];
const RAW_SPEAKER_LABEL_PATTERN = /\bSPEAKER[_\s-]*\d+\b/i;
const PRIVATE_PATH_PATTERN = /(?:\/Users\/|file:\/\/|\.fcpxml\b|\.xml\b|cache_path|media_path)/i;
const RAW_WORD_ALIGNMENT_KEYS = new Set([
  "wordAlignment",
  "word_alignment",
  "word_timings",
  "wordTimestamps",
  "word_timestamps",
  "words",
  "whisper",
  "pyannote",
]);

let failed = false;

function assert(condition: unknown, message: string) {
  if (condition) return;
  failed = true;
  console.error(`FAIL: ${message}`);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function collectKeys(value: unknown, keys = new Set<string>()) {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
    return keys;
  }

  if (!value || typeof value !== "object") return keys;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    keys.add(key);
    collectKeys(child, keys);
  }

  return keys;
}

function maxUtteranceSpanSeconds(utterances: Array<{ start_seconds: number; end_seconds: number }>) {
  if (utterances.length === 0) return 0;
  const starts = utterances.map((utterance) => utterance.start_seconds);
  const ends = utterances.map((utterance) => utterance.end_seconds);
  return Math.max(...ends) - Math.min(...starts);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasEmbeddedSpeakerPrefix(text: string, speakerLabels: string[]) {
  return speakerLabels.some((label) => new RegExp(`\\b${escapeRegExp(label)}\\s*:`).test(text));
}

function makeFixturePromptWindow(parsed: SocialReelsRequest): SocialReelsDurationWindow | null {
  const segment = parsed.segments.find((candidate) => candidate.utterance_ids.length > 1) ?? parsed.segments.find((candidate) => candidate.utterance_ids.length > 0);
  if (!segment) return null;

  const durationSeconds = Math.max(1, Math.round(segment.end_seconds - segment.start_seconds));
  return {
    window_id: "fixture-v2-utterance-window",
    segment_id: segment.id,
    transcript_source: "utterances",
    utterance_ids: segment.utterance_ids,
    speakers: segment.speakers ?? [],
    start_timecode: segment.start_timecode ?? null,
    end_timecode: segment.end_timecode ?? null,
    duration_bucket: "15s",
    start_seconds: segment.start_seconds,
    end_seconds: segment.end_seconds,
    duration_seconds: durationSeconds,
    start_anchor_hint: "Use an exact quote near the first utterance boundary.",
    end_anchor_hint: "Use an exact quote near the final utterance boundary.",
  };
}

function validateFixture(fixture: (typeof FIXTURES)[number]) {
  assert(existsSync(fixture.path), `${fixture.name} fixture should exist.`);
  const rawText = readFileSync(fixture.path, "utf8");
  assert(rawText.trim().length > 0, `${fixture.name} fixture must be non-empty JSON.`);
  const rawFixture = JSON.parse(rawText) as unknown;
  const rawRecord = asRecord(rawFixture);
  const rawKeys = collectKeys(rawFixture);
  const parsed = socialReelsRequestSchema.parse(rawFixture);
  const speakerLabels = [
    ...new Set(
      parsed.utterances
        .map((utterance) => utterance.speaker_label)
        .filter((label): label is string => typeof label === "string" && label.length > 0)
    ),
  ].sort();
  const segmentsWithUtteranceIds = parsed.segments.filter((segment) => segment.utterance_ids.length > 0);
  const requestedDurationWindows = buildSocialReelsLiveDurationWindows({ ...parsed, requested_candidate_count: 10 }, 10);
  const fixturePromptWindow = makeFixturePromptWindow(parsed);
  const promptWindows = fixturePromptWindow ? buildSocialReelsLivePromptWindows(parsed, [fixturePromptWindow]) : [];
  const promptInput = buildSocialReelsOpenAIPromptInput(
    { ...parsed, requested_candidate_count: 10 },
    {
      discoveryMode: "live_shortlist",
      requestedCandidateCount: parsed.requested_candidate_count,
      effectiveCandidateCount: 10,
      durationWindows: promptWindows,
    }
  );
  const systemPrompt = String(promptInput[0].content);
  const userPrompt = String(promptInput[1].content);
  const promptWindowJson = JSON.stringify(promptWindows);
  const fixtureJson = JSON.stringify(rawFixture);

  assert(Array.isArray(rawRecord.utterances), `${fixture.name} raw fixture should contain top-level utterances[].`);
  assert(parsed.utterances.length > 0, `${fixture.name} backend schema should parse top-level utterances[].`);
  assert(segmentsWithUtteranceIds.length > 0, `${fixture.name} fixture should include segments with utterance_ids.`);
  for (const label of fixture.expectedLabels) {
    assert(speakerLabels.includes(label), `${fixture.name} parsed utterances should preserve clean speaker label: ${label}.`);
    assert(userPrompt.includes(label), `${fixture.name} rendered prompt should include clean speaker label: ${label}.`);
  }
  assert(!speakerLabels.some((label) => RAW_SPEAKER_LABEL_PATTERN.test(label)), `${fixture.name} parsed speaker labels should not contain raw SPEAKER labels.`);
  assert(!RAW_SPEAKER_LABEL_PATTERN.test(userPrompt), `${fixture.name} rendered prompt should not contain raw SPEAKER labels.`);
  assert(!parsed.utterances.some((utterance) => hasEmbeddedSpeakerPrefix(utterance.text, speakerLabels)), `${fixture.name} utterance text should not contain embedded speaker-label prefixes.`);
  assert(userPrompt.includes('"transcript_source":"utterances"'), `${fixture.name} rendered user prompt should mark transcript_source as utterances.`);
  assert(systemPrompt.includes("utterances[] as the transcript source of truth"), `${fixture.name} system prompt should instruct OpenAI to use utterances[] first.`);
  assert(systemPrompt.includes("do not flatten back to legacy segments[].text"), `${fixture.name} system prompt should keep legacy segments as fallback only.`);
  assert(promptWindows.length > 0, `${fixture.name} prompt fixture should build bounded utterance-level context from segment utterance_ids.`);
  assert(promptWindowJson.includes('"utterance_ids"'), `${fixture.name} prompt windows should include utterance_ids.`);
  assert(promptWindowJson.includes('"utterances"'), `${fixture.name} prompt windows should include bounded utterance-level context.`);
  assert(promptWindowJson.includes('"start_timecode"') && promptWindowJson.includes('"end_timecode"'), `${fixture.name} prompt windows should include HH:MM:SS:FF timecodes.`);
  assert(promptWindowJson.includes('"start_seconds"') && promptWindowJson.includes('"end_seconds"'), `${fixture.name} prompt windows should include seconds.`);
  assert(!speakerLabels.some((label) => userPrompt.includes(`${label}:`)), `${fixture.name} rendered prompt should not rely on embedded speaker-label prefixes.`);
  assert(!PRIVATE_PATH_PATTERN.test(userPrompt), `${fixture.name} rendered prompt should not include local/private paths.`);
  assert(!PRIVATE_PATH_PATTERN.test(fixtureJson), `${fixture.name} fixture should not include local/private paths.`);
  for (const key of RAW_WORD_ALIGNMENT_KEYS) {
    assert(!rawKeys.has(key), `${fixture.name} fixture should not include raw word-aligned payload key: ${key}.`);
    assert(!userPrompt.includes(`"${key}"`), `${fixture.name} rendered user prompt should not include raw word-aligned payload key: ${key}.`);
  }

  const requestedDurationGenerationStatus = requestedDurationWindows.length > 0
    ? "pass"
    : fixture.allowTooShortForRequestedBucket && maxUtteranceSpanSeconds(parsed.utterances) < 22 && parsed.duration_preferences.includes("30s")
      ? "skipped_redacted_fixture_too_short_for_30s_window"
      : "fail";
  assert(
    requestedDurationGenerationStatus !== "fail",
    `${fixture.name} fixture should generate requested duration windows unless it is the intentionally short redacted fixture.`
  );

  return {
    fixture: fixture.name,
    fixture_path: fixture.path.replace(process.cwd() + "/", ""),
    fixture_size_bytes: rawText.length,
    top_level_utterances: parsed.utterances.length,
    segments: parsed.segments.length,
    segments_with_utterance_ids: segmentsWithUtteranceIds.length,
    clean_speaker_label_count: speakerLabels.length,
    clean_speaker_labels: speakerLabels.slice(0, 12),
    raw_requested_candidate_count: typeof rawRecord.requested_candidate_count === "number" ? rawRecord.requested_candidate_count : null,
    backend_requested_candidate_count: parsed.requested_candidate_count,
    transcript_source: parsed.utterances.length > 0 ? "utterances" : "segments",
    requested_duration_window_count: requestedDurationWindows.length,
    requested_duration_generation_status: requestedDurationGenerationStatus,
    prompt_window_count: promptWindows.length,
    prompt_uses_utterance_context: promptWindowJson.includes('"utterances"'),
    openai_call_made: false,
  };
}

const summaries = FIXTURES.map(validateFixture);

console.log(JSON.stringify({ fixtures: summaries }, null, 2));

if (!failed) {
  console.log("PASS: social reels transcript v2 app fixture acceptance passed without a live OpenAI call.");
}

process.exitCode = failed ? 1 : 0;
