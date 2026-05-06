import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildSocialReelsOpenAIPromptInput } from "../lib/socialReelsOpenAIPrompt";
import {
  buildSocialReelsLiveDurationWindows,
  buildSocialReelsLivePromptWindows,
  estimateSocialReelsPromptWindowCharCount,
  getSocialReelsLiveWindowCount,
  getSocialReelsWindowQualityRange,
  scoreSocialReelsDurationWindows,
  selectSocialReelsLiveDurationWindows,
  summarizeSocialReelsWindowQuality,
} from "../lib/socialReelsDurationWindows";
import { socialReelsRequestSchema } from "../lib/socialReelsSchema";
import {
  getEffectiveLiveShortlistCandidateCount,
  openAISocialReelsShortlistResponseFormat,
} from "../lib/socialReelsShortlist";

const GOLDEN_FIXTURE_PATH = resolve(process.cwd(), "tests/fixtures/social-reels/10-10-app-request.json");
const GOLDEN_LIVE_CANDIDATE_COUNT = "10";
const GOLDEN_LIVE_WINDOW_COUNT = "18";
const GOLDEN_PROMPT_CONTEXT_CHAR_CAP = 35_000;
const RAW_SPEAKER_LABEL = /\bSPEAKER[_\s-]*\d+\b/i;
const POLLUTED_PROJECT_EPISODE_SUFFIX =
  /\s(?:[-–—|]|::)\s.*(?:project|episode|social\s*reels|evaluation|packet|debug|\.fcpxml|\.xml)\b/i;

let failed = false;

function assert(condition: unknown, message: string) {
  if (condition) return;
  failed = true;
  console.error(`FAIL: ${message}`);
}

function uniqueSpeakerLabels(segments: Array<{ speaker?: string | null }>) {
  return [
    ...new Set(
      segments
        .map((segment) => (typeof segment.speaker === "string" ? segment.speaker.replace(/\s+/g, " ").trim() : ""))
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b));
}

function validateResponseSchemaShape(schema: ReturnType<typeof openAISocialReelsShortlistResponseFormat>) {
  const roundTripped = JSON.parse(JSON.stringify(schema)) as typeof schema;
  assert(roundTripped.type === "json_schema", "Live shortlist response format should use JSON schema mode.");
  assert(roundTripped.strict === true, "Live shortlist response format should be strict.");
  assert(roundTripped.schema.additionalProperties === false, "Top-level response schema should disallow additional properties.");
  assert(roundTripped.schema.required.includes("candidates"), "Response schema should require candidates.");
  assert(roundTripped.schema.required.includes("model_notes"), "Response schema should require model_notes.");

  const candidatesSchema = roundTripped.schema.properties.candidates;
  const candidateSchema = candidatesSchema.items;
  const candidateRequired = candidateSchema.required as readonly string[];
  const candidateProperties = candidateSchema.properties as Record<string, unknown>;
  const expectedCandidateFields = [
    "candidate_id",
    "title",
    "hook_title",
    "summary",
    "duration_bucket",
    "segment_id",
    "start_seconds",
    "end_seconds",
    "duration_seconds",
    "start_anchor_quote",
    "end_anchor_quote",
    "clip_type",
    "topic_tag",
    "why_it_works",
    "viral_atoms",
    "core_question",
    "payoff",
    "context_dependency",
    "sensitivity_level",
    "rejection_risk_flags",
    "score",
    "scores",
  ];

  assert(candidatesSchema.minItems === 3, "Live shortlist schema should allow a minimum of 3 returned candidates.");
  assert(candidatesSchema.maxItems === 10, "Live shortlist schema should cap at 10 returned candidates.");
  assert(candidateSchema.additionalProperties === false, "Candidate schema should disallow additional properties.");

  for (const field of expectedCandidateFields) {
    assert(candidateRequired.includes(field), `Candidate schema should require ${field}.`);
    assert(field in candidateProperties, `Candidate schema should define ${field}.`);
  }

  assert(!candidateRequired.includes("title_options"), "Reduced live shortlist schema should not require title_options.");
  assert(!("title_options" in candidateProperties), "Reduced live shortlist schema should not define title_options.");
}

const rawFixture = JSON.parse(readFileSync(GOLDEN_FIXTURE_PATH, "utf8")) as unknown;
const request = socialReelsRequestSchema.parse(rawFixture);
const requestedCandidateCount = request.requested_candidate_count;
const effectiveCandidateCount = getEffectiveLiveShortlistCandidateCount(requestedCandidateCount, GOLDEN_LIVE_CANDIDATE_COUNT);
const liveWindowCount = getSocialReelsLiveWindowCount(GOLDEN_LIVE_WINDOW_COUNT);
const liveShortlistInput = { ...request, requested_candidate_count: effectiveCandidateCount };
const durationWindows = buildSocialReelsLiveDurationWindows(liveShortlistInput, effectiveCandidateCount);
const scoredDurationWindows = scoreSocialReelsDurationWindows(liveShortlistInput, durationWindows);
const qualitySummary = summarizeSocialReelsWindowQuality(scoredDurationWindows);
const selectedWindows = selectSocialReelsLiveDurationWindows(scoredDurationWindows, liveWindowCount);
const selectedWindowQualityRange = getSocialReelsWindowQualityRange(selectedWindows);
const promptWindows = buildSocialReelsLivePromptWindows(liveShortlistInput, selectedWindows);
const promptInput = buildSocialReelsOpenAIPromptInput(liveShortlistInput, {
  discoveryMode: "live_shortlist",
  requestedCandidateCount,
  effectiveCandidateCount,
  durationWindows: promptWindows,
});
const systemPrompt = String(promptInput[0].content);
const userPrompt = String(promptInput[1].content);
const promptContextCharCount = JSON.stringify(promptInput).length;
const responseSchema = openAISocialReelsShortlistResponseFormat(effectiveCandidateCount);
const speakerLabels = uniqueSpeakerLabels(request.segments);
const rawSpeakerLabelsRemain = speakerLabels.some((label) => RAW_SPEAKER_LABEL.test(label)) || RAW_SPEAKER_LABEL.test(userPrompt);
const pollutedSuffixRemain = speakerLabels.some((label) => POLLUTED_PROJECT_EPISODE_SUFFIX.test(label));
const selectedExcludedWindows = selectedWindows.filter((window) => window.window_exclusion_reason);

assert(!rawSpeakerLabelsRemain, "Golden fixture should not contain raw SPEAKER labels in speaker names or rendered prompt.");
assert(speakerLabels.includes("Layla Martin"), "Golden fixture should include clean speaker label Layla Martin.");
assert(speakerLabels.includes("Mama Gena"), "Golden fixture should include clean speaker label Mama Gena.");
assert(!pollutedSuffixRemain, "Golden fixture speaker labels should not contain polluted project/title suffixes.");
assert(durationWindows.length > 0, "Golden fixture should generate eligible duration windows.");
assert(durationWindows.length >= liveWindowCount, "Golden fixture should generate enough eligible windows for live selection.");
assert(qualitySummary.windows_after_quality_filter >= liveWindowCount, "Golden fixture should have enough non-excluded windows.");
assert(selectedWindows.length === liveWindowCount, "Selected live windows should match configured live window count.");
assert(promptWindows.length === selectedWindows.length, "Prompt windows should match selected windows.");
assert(selectedExcludedWindows.length === 0, "Selected windows should not include excluded windows when enough good windows exist.");
assert(selectedWindowQualityRange.min !== null && selectedWindowQualityRange.min >= 0.72, "Selected golden windows should come from the strong quality pool.");
assert(promptContextCharCount < GOLDEN_PROMPT_CONTEXT_CHAR_CAP, "Golden rendered prompt should remain under the configured char cap.");

for (const requiredPromptText of [
  "Question -> Tension -> Answer -> Reframe",
  "pre-show chatter",
  "mic checks",
  "technical setup",
  "sponsor/ad reads",
  "missing payoff",
  "return fewer candidates rather than padding",
]) {
  assert(systemPrompt.includes(requiredPromptText) || userPrompt.includes(requiredPromptText), `Prompt should include: ${requiredPromptText}`);
}
for (const schemaDisallowedField of ["title_options"]) {
  assert(!userPrompt.includes(schemaDisallowedField), `Live shortlist user prompt should not ask for ${schemaDisallowedField}.`);
}
for (const compactField of ["title", "hook_title", "core_question", "payoff", "viral_atoms", "why_it_works"]) {
  assert(userPrompt.includes(compactField), `Live shortlist user prompt should ask for compact field ${compactField}.`);
}

validateResponseSchemaShape(responseSchema);

console.log(
  JSON.stringify(
    {
      fixture: "tests/fixtures/social-reels/10-10-app-request.json",
      speaker_label_count: speakerLabels.length,
      segment_count: request.segments.length,
      requested_candidate_count: requestedCandidateCount,
      effective_candidate_count: effectiveCandidateCount,
      eligible_duration_window_count: durationWindows.length,
      windows_after_quality_filter: qualitySummary.windows_after_quality_filter,
      excluded_window_reason_counts: qualitySummary.excluded_window_reason_counts,
      demoted_window_reason_counts: qualitySummary.demoted_window_reason_counts,
      selected_window_quality_range: selectedWindowQualityRange,
      selected_window_count: selectedWindows.length,
      prompt_context_char_count: promptContextCharCount,
      raw_speaker_labels_remain: rawSpeakerLabelsRemain,
      polluted_suffix_remain: pollutedSuffixRemain,
      openai_call_made: false,
    },
    null,
    2
  )
);

if (!failed) {
  console.log("PASS: social reels golden packet smoke passed without a live OpenAI call.");
}

process.exitCode = failed ? 1 : 0;
