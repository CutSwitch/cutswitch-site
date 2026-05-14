import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  SOCIAL_REELS_CONTEXT_DEPENDENCIES,
  SOCIAL_REELS_DISCOVERY_MATRIX_MAX_PER_BUCKET_CAP,
  SOCIAL_REELS_REJECTION_RISK_FLAGS,
  SOCIAL_REELS_SENSITIVITY_LEVELS,
  SOCIAL_REELS_VIRAL_ATOMS,
  openAISocialReelsDiscoveryMatrixResponseFormat,
  openAISocialReelsResponseFormat,
  socialReelsDiscoveryMatrixResponseSchema,
  socialReelsCandidateSchema,
  socialReelsRequestSchema,
  socialReelsResponseSchema,
} from "../lib/socialReelsSchema";
import { summarizeSocialReelsOutputShape } from "../lib/socialReelsDiagnostics";
import { buildSocialReelsOpenAIPromptInput } from "../lib/socialReelsOpenAIPrompt";
import {
  SOCIAL_REELS_DURATION_FIRST_GENERATED_TAGS,
  SOCIAL_REELS_DURATION_FIRST_MAX_PER_BUCKET,
  SOCIAL_REELS_DURATION_FIRST_MAX_TOTAL_BUCKET_MEMBERSHIPS,
  SOCIAL_REELS_DURATION_FIRST_MAX_UNIQUE_MOMENTS,
  SOCIAL_REELS_DURATION_FIRST_SCHEMA_VERSION,
  SOCIAL_REELS_DURATION_FIRST_TARGETS,
  socialReelsDurationFirstManifestSchema,
} from "../lib/socialReelsDurationFirstManifest";
import {
  SOCIAL_REELS_EDIT_ASSISTANT_SYSTEM_PROMPT,
  buildSocialReelsEditAssistantPromptInput,
  proposeSocialReelsEdit,
  socialReelsEditAssistantRequestSchema,
  socialReelsEditAssistantResponseSchema,
} from "../lib/socialReelsEditAssistant";
import {
  buildSocialReelsLiveDurationWindows,
  buildSocialReelsLivePromptWindows,
  estimateSocialReelsPromptWindowCharCount,
  getSocialReelsLiveWindowCount,
  getSocialReelsWindowQualityRange,
  scoreSocialReelsDurationWindow,
  scoreSocialReelsDurationWindows,
  selectSocialReelsLiveDurationWindows,
  summarizeSocialReelsWindowQuality,
} from "../lib/socialReelsDurationWindows";
import {
  durationFitsSocialReelsLiveBucket,
  getEffectiveLiveShortlistCandidateCount,
  getSocialReelsLiveDurationCompliance,
  hydrateSocialReelsShortlistResponse,
  openAISocialReelsShortlistResponseFormat,
  socialReelsShortlistResponseSchema,
} from "../lib/socialReelsShortlist";

let failed = false;

function assert(condition: unknown, message: string) {
  if (condition) return;
  failed = true;
  console.error(`FAIL: ${message}`);
}

function candidate(index: number, includeViralMethodFields: boolean) {
  const ordinal = index + 1;
  const base = {
    candidate_id: `smoke-reel-${String(ordinal).padStart(2, "0")}`,
    title: `Smoke clip ${ordinal}`,
    hook: "A useful clip starts with a question and lands a clean answer.",
    summary: "A deterministic social reels schema smoke candidate.",
    start_anchor_quote: "A useful clip starts with a question",
    end_anchor_quote: "lands a clean answer for the viewer",
    clip_type: "story_beat",
    topic_tag: "schema smoke",
    hook_title: `Smoke clip ${ordinal}`,
    subtitle_intro: "A useful clip starts with a question",
    social_caption: "A useful clip starts with a question and lands a clean answer.",
    why_it_works: "The candidate has a hook, tension, payoff, and clean edit boundaries.",
    rejection_risk_flags: [],
    risk_flags: [],
    duration_bucket: "30s",
    start_seconds: 10,
    end_seconds: 40,
    duration_seconds: 30,
    score: 0.78,
    scores: {
      hook_strength: 0.8,
      standalone_clarity: 0.82,
      payoff_strength: 0.79,
      emotional_charge: 0.65,
      novelty: 0.7,
      editability: 0.86,
      shareability: 0.77,
      context_independence: 0.81,
      overall: 0.78,
    },
    rationale: "Local schema smoke candidate.",
    segment_ids: ["seg-1"],
    captions: ["A useful clip starts with a question."],
    suggested_platforms: ["social"],
    safety_notes: null,
  };

  if (!includeViralMethodFields) return base;

  return {
    ...base,
    viral_atoms: ["question", "conflict", "clear_answer", "reframe"],
    core_question: "What makes this clip worth watching?",
    conflict: "The setup creates tension before the answer lands.",
    payoff: "The answer reframes the viewer's understanding.",
    title_options: [
      { title: "The Question Behind the Clip", score: 0.82 },
      { title: "Why This Moment Lands", score: 0.78 },
    ],
    title_score: 0.82,
    edit_feasibility_score: 0.86,
    risk_penalty: 0.04,
    context_dependency: "low",
    sensitivity_level: "none",
  };
}

const promptSource = [
  readFileSync(resolve(process.cwd(), "lib/openaiSocialReels.ts"), "utf8"),
  readFileSync(resolve(process.cwd(), "lib/socialReelsOpenAIPrompt.ts"), "utf8"),
  readFileSync(resolve(process.cwd(), "lib/socialReelsEditAssistant.ts"), "utf8"),
].join("\n");
const discoverRouteSource = readFileSync(resolve(process.cwd(), "app/api/social-reels/discover/route.ts"), "utf8");

assert(promptSource.includes("Question -> Tension -> Answer -> Reframe"), "Prompt is missing the viral reel story arc.");
for (const atom of SOCIAL_REELS_VIRAL_ATOMS) {
  assert(promptSource.includes(atom), `Prompt is missing viral atom ${atom}.`);
}

for (const exclusion of [
  "countdowns",
  "pre-show chatter",
  "mic checks",
  "technical setup",
  "sponsor/ad reads",
  "generic motivational filler",
  "purely transitional moments",
  "missing payoff",
]) {
  assert(promptSource.includes(exclusion), `Prompt is missing anti-junk exclusion: ${exclusion}.`);
}
for (const durationConstraint of ["hard constraint", "10-22", "22-42", "45-78", "70-115", "240-660"]) {
  assert(promptSource.includes(durationConstraint), `Prompt is missing duration compliance guidance: ${durationConstraint}.`);
}
for (const durationWindowGuidance of [
  "duration_windows",
  "duration_window_instruction",
  "Choose from duration_windows",
  "backend-generated duration windows",
  "chosen window_id",
  "return fewer candidates rather than padding",
  "window_quality_score",
  "window_quality_reasons",
  "window_exclusion_reason",
  "window_demotion_reasons",
  "audio_check",
  "camera_check",
  "product_promo",
  "meta_editing",
  "book_link_outro",
]) {
  assert(promptSource.includes(durationWindowGuidance), `Prompt is missing duration window guidance: ${durationWindowGuidance}.`);
}
for (const editorialMetadataGuidance of [
  "context_dependency",
  "sensitivity_level",
  "sensitive_topic",
  "unsafe_or_policy_risk",
  "Sexual wellness",
  "promotional housekeeping",
]) {
  assert(promptSource.includes(editorialMetadataGuidance), `Prompt is missing compact editorial metadata guidance: ${editorialMetadataGuidance}.`);
}

assert(
  promptSource.indexOf("if (shouldUseMock(options))") >= 0 &&
    promptSource.indexOf("if (shouldUseMock(options))") < promptSource.indexOf("await fetch(OPENAI_RESPONSES_URL"),
  "Mock mode guard must run before the OpenAI fetch."
);
assert(
  promptSource.includes("buildMockResponse(input)") && promptSource.includes("input.requested_candidate_count"),
  "Mock mode should keep using the requested 30-80 candidate pool."
);
assert(
  promptSource.includes("Array.from({ length: input.requested_candidate_count }"),
  "Mock response builder should return the requested candidate count."
);
assert(
  promptSource.includes("live_shortlist") && promptSource.includes("getSocialReelsLiveCandidateCount"),
  "Live mode should use the capped shortlist path."
);
assert(
  promptSource.includes("requested_candidate_count: effectiveCandidateCount"),
  "Live shortlist prompt input should ask OpenAI for the effective count, not the requested full-pool count."
);
assert(
  promptSource.includes("buildSocialReelsLiveDurationWindows(liveShortlistInput, effectiveCandidateCount)") &&
    promptSource.includes("selectSocialReelsLiveDurationWindows") &&
    promptSource.includes("buildSocialReelsLivePromptWindows"),
  "Live shortlist should select bounded backend-generated duration windows for the OpenAI prompt."
);
assert(promptSource.includes("segments: useLiveWindowInput ? [] : input.segments"), "Live shortlist should not send the full transcript segment blob.");
assert(promptSource.includes("duration_windows_only"), "Live shortlist prompt should identify duration-window-only source input.");
assert(promptSource.includes("compact linear candidates only"), "Live shortlist prompt should not request story edit recipes from the reduced schema.");
assert(promptSource.includes("schema_validation_failed"), "Invalid OpenAI response diagnostics should classify schema validation failures.");
assert(promptSource.includes("malformed_json"), "Invalid OpenAI response diagnostics should classify malformed JSON.");
assert(promptSource.includes("truncated_output"), "Invalid OpenAI response diagnostics should classify truncated output.");
assert(discoverRouteSource.includes("reason_code"), "Invalid OpenAI response route error should expose a sanitized reason_code.");
assert(discoverRouteSource.includes("retry_allowed"), "Invalid OpenAI response route error should expose retry_allowed.");
assert(discoverRouteSource.includes("502"), "Invalid OpenAI response route error should return a recoverable provider error status.");
for (const utterancePromptRule of [
  "utterances[] as the transcript source of truth",
  "Each utterance is a single-speaker timed unit",
  "speaker_label",
  "start_timecode/end_timecode",
  "do not flatten back to legacy segments[].text",
  "Never choose a clip that ends mid-word or mid-thought",
]) {
  assert(promptSource.includes(utterancePromptRule), `Prompt is missing transcript v2 rule: ${utterancePromptRule}.`);
}
for (const matrixPromptRule of [
  "Discovery Matrix mode",
  "requested_targets",
  "moment identities",
  "Layout formats, aspect ratios, caption styles, and export variants are not discovery targets",
  "avoid duplicates across buckets",
  "dedupe_shared_moments",
  "max_per_bucket",
  "max_unique_moments",
]) {
  assert(promptSource.includes(matrixPromptRule), `Prompt is missing discovery matrix rule: ${matrixPromptRule}.`);
}

for (const smartStoryEditRule of [
  "Smart Story Edit rule",
  "prefer a linear contiguous clip when it already has a strong beginning, clear middle, and strong ending",
  "Use story_edit only when moving a later hook or closing line to the front materially improves the reel",
  "maximum of 3 timeline_segments",
  "real utterance_ids",
  "real source_start_timecode/source_end_timecode",
  "Do not reverse meaning",
  "Do not combine unrelated topics",
  "Do not use a cold-open hook unless the reel clearly pays it off",
  "The macOS app will validate and export the recipe",
]) {
  assert(promptSource.includes(smartStoryEditRule), `Prompt is missing Smart Story Edit rule: ${smartStoryEditRule}.`);
}

for (const editAssistantRule of [
  "Social Reel Edit Assistant",
  "non-destructively",
  "Do not invent spoken words",
  "Use existing utterance IDs",
  "word IDs when provided",
  "If the user asks to start with a line",
  "cold_open_hook",
  "Must not cut mid-word or mid-thought",
  "Conversation state is explicit and stateless",
  "The app applies edits only after user confirmation",
]) {
  assert(SOCIAL_REELS_EDIT_ASSISTANT_SYSTEM_PROMPT.includes(editAssistantRule), `Edit assistant prompt is missing rule: ${editAssistantRule}.`);
}

socialReelsCandidateSchema.parse(candidate(0, false));
socialReelsCandidateSchema.parse(candidate(0, true));
const parsedLegacyLinearCandidate = socialReelsCandidateSchema.parse(candidate(1, true));
assert(parsedLegacyLinearCandidate.edit_mode === "linear", "Legacy candidate without timeline_segments should default to linear edit_mode.");
assert(parsedLegacyLinearCandidate.composition_type === "contiguous", "Legacy candidate without composition_type should default to contiguous.");
assert(parsedLegacyLinearCandidate.timeline_segments.length === 0, "Legacy candidate should parse without timeline_segments.");
socialReelsCandidateSchema.parse({
  ...candidate(2, true),
  candidate_id: "story-edit-linear-schema",
  edit_mode: "linear",
  composition_type: "contiguous",
  display_title: "Linear schema candidate",
  display_teaser: "A contiguous source range remains supported.",
  opening_hook: "A useful clip starts with a question",
  closing_line: "lands a clean answer for the viewer",
  coherence_score: 0.88,
  continuity_risk: "low",
  edit_decision_rationale: "The source range already has a strong start, middle, and ending.",
  review_flags: [],
});
socialReelsCandidateSchema.parse({
  ...candidate(3, true),
  candidate_id: "story-edit-hook-reordered-schema",
  edit_mode: "story_edit",
  composition_type: "hook_reordered",
  start_seconds: 90,
  end_seconds: 130,
  duration_seconds: 30,
  timeline_segments: [
    {
      segment_id: "timeline-hook",
      role: "cold_open_hook",
      source_start_seconds: 120,
      source_end_seconds: 127,
      source_start_timecode: "00:02:00:00",
      source_end_timecode: "00:02:07:00",
      utterance_ids: ["utt-redacted-hook"],
      speaker_labels: ["Layla"],
      transcript_excerpt: "{{REDACTED_LATER_HOOK_EXCERPT}}",
      reason_for_placement: "The later hook is moved first because it creates immediate curiosity.",
    },
    {
      segment_id: "timeline-context",
      role: "context",
      source_start_seconds: 90,
      source_end_seconds: 110,
      source_start_timecode: "00:01:30:00",
      source_end_timecode: "00:01:50:00",
      utterance_ids: ["utt-redacted-context-1", "utt-redacted-context-2"],
      speaker_labels: ["Fabienne"],
      transcript_excerpt: "{{REDACTED_CONTEXT_EXCERPT}}",
      reason_for_placement: "Earlier context explains the later hook without changing meaning.",
    },
    {
      segment_id: "timeline-closing",
      role: "closing_button",
      source_start_seconds: 127,
      source_end_seconds: 130,
      source_start_timecode: "00:02:07:00",
      source_end_timecode: "00:02:10:00",
      utterance_ids: ["utt-redacted-closing"],
      speaker_labels: ["Layla"],
      transcript_excerpt: "{{REDACTED_CLOSING_EXCERPT}}",
      reason_for_placement: "The closing line pays off the cold open.",
    },
  ],
  display_title: "Hook reordered schema candidate",
  display_teaser: "Later hook, earlier context, closing button.",
  opening_hook: "{{REDACTED_LATER_HOOK_EXCERPT}}",
  closing_line: "{{REDACTED_CLOSING_EXCERPT}}",
  coherence_score: 0.86,
  continuity_risk: "medium",
  edit_decision_rationale: "The later hook honestly previews the same idea and is paid off by the context.",
  review_flags: [],
});
socialReelsResponseSchema.parse({
  candidates: Array.from({ length: 30 }, (_, index) => candidate(index, true)),
  model_notes: "Schema smoke only; no provider call.",
});
socialReelsResponseSchema.parse({
  candidates: Array.from({ length: 50 }, (_, index) => candidate(index, true)),
  model_notes: "Mock 50-candidate pool schema smoke only; no provider call.",
});

assert(getEffectiveLiveShortlistCandidateCount(30, undefined) === 10, "Live shortlist should default to 10 candidates.");
assert(getEffectiveLiveShortlistCandidateCount(30, "8") === 8, "Live shortlist env override should be honored.");
assert(getEffectiveLiveShortlistCandidateCount(30, "80") === 10, "Live shortlist env override should be capped to 10.");
assert(getEffectiveLiveShortlistCandidateCount(30, "1") === 3, "Live shortlist env override should be floored at 3.");
assert(getEffectiveLiveShortlistCandidateCount(5, "10") === 5, "Live shortlist should never exceed a lower requested count.");
assert(durationFitsSocialReelsLiveBucket("15s", 15), "15s live bucket should accept 15 seconds.");
assert(!durationFitsSocialReelsLiveBucket("15s", 24), "15s live bucket should reject 24 seconds.");
assert(durationFitsSocialReelsLiveBucket("30s", 30), "30s live bucket should accept 30 seconds.");
assert(!durationFitsSocialReelsLiveBucket("30s", 45), "30s live bucket should reject 45 seconds.");
assert(durationFitsSocialReelsLiveBucket("60s", 60), "60s live bucket should accept 60 seconds.");
for (const bad60sDuration of [8, 12, 22, 32]) {
  assert(!durationFitsSocialReelsLiveBucket("60s", bad60sDuration), `60s live bucket should reject ${bad60sDuration} seconds.`);
}
assert(durationFitsSocialReelsLiveBucket("90s", 90), "90s live bucket should accept 90 seconds.");
assert(!durationFitsSocialReelsLiveBucket("90s", 60), "90s live bucket should reject 60 seconds.");
assert(durationFitsSocialReelsLiveBucket("5-10m", 420), "5-10m live bucket should accept 420 seconds.");
assert(!durationFitsSocialReelsLiveBucket("5-10m", 120), "5-10m live bucket should reject 120 seconds.");

const shortlistFormat = openAISocialReelsShortlistResponseFormat(10);
assert(shortlistFormat.schema.properties.candidates.minItems === 3, "Live shortlist response format should allow fewer than 10 valid items.");
assert(shortlistFormat.schema.properties.candidates.maxItems === 10, "Live shortlist response format should cap at 10 items.");
const shortlistItemFormat = shortlistFormat.schema.properties.candidates.items;
const shortlistRequiredFields = shortlistItemFormat.required as readonly string[];
const shortlistProperties = shortlistItemFormat.properties as Record<string, unknown>;
for (const field of ["viral_atoms", "core_question", "payoff", "context_dependency", "sensitivity_level"]) {
  assert(shortlistRequiredFields.includes(field), `Live shortlist schema is missing compact editorial field: ${field}.`);
  assert(field in shortlistProperties, `Live shortlist schema is missing compact editorial property: ${field}.`);
}
for (const field of [
  "edit_mode",
  "composition_type",
  "timeline_segments",
  "display_title",
  "display_teaser",
  "opening_hook",
  "closing_line",
  "coherence_score",
  "continuity_risk",
  "edit_decision_rationale",
  "review_flags",
]) {
  assert(!shortlistRequiredFields.includes(field), `Live shortlist reduced schema should not require Smart Story Edit field: ${field}.`);
  assert(!(field in shortlistProperties), `Live shortlist reduced schema should not ask OpenAI for Smart Story Edit property: ${field}.`);
}
assert(SOCIAL_REELS_CONTEXT_DEPENDENCIES.includes("low"), "Context dependency enum should include low.");
assert(SOCIAL_REELS_SENSITIVITY_LEVELS.includes("sensitive_topic"), "Sensitivity enum should include sensitive_topic.");
assert(SOCIAL_REELS_SENSITIVITY_LEVELS.includes("unsafe_or_policy_risk"), "Sensitivity enum should include unsafe_or_policy_risk.");
assert(
  SOCIAL_REELS_REJECTION_RISK_FLAGS.includes("sensitive_topic") &&
    SOCIAL_REELS_REJECTION_RISK_FLAGS.includes("unsafe_or_policy_risk") &&
    SOCIAL_REELS_REJECTION_RISK_FLAGS.includes("unsafe_or_sensitive"),
  "Risk flags should split sensitive_topic from unsafe_or_policy_risk while preserving unsafe_or_sensitive compatibility."
);

const utteranceV2Request = socialReelsRequestSchema.parse({
  project_hash: "schema-smoke-utterance-v2",
  duration_preferences: ["60s"],
  requested_candidate_count: 30,
  style: "balanced",
  layout: "vertical",
  caption_style: "bold",
  episode_metadata: { title: "Utterance v2 smoke" },
  context: { platform: "social" },
  utterances: [
    {
      utterance_id: "utt-layla-001",
      speaker_label: "Layla",
      start_seconds: 0,
      end_seconds: 18,
      start_timecode: "00:00:00:00",
      end_timecode: "00:00:18:00",
      text: "The question is why a strong moment can still feel confusing when the start hides the real tension from the viewer.",
    },
    {
      utterance_id: "utt-fabienne-001",
      speaker_label: "Fabienne",
      start_seconds: 18,
      end_seconds: 39,
      start_timecode: "00:00:18:00",
      end_timecode: "00:00:39:00",
      text: "The tension is that the clip needs enough context to show the feeling, the practical lesson, and the specific claim without dragging.",
    },
    {
      utterance_id: "utt-jef-001",
      speaker_label: "Jef",
      start_seconds: 39,
      end_seconds: 61,
      start_timecode: "00:00:39:00",
      end_timecode: "00:01:01:00",
      text: "The answer is to choose the window where the claim starts cleanly and the payoff lands after the reframe, not halfway through it.",
    },
    {
      utterance_id: "utt-layla-002",
      speaker_label: "Layla",
      start_seconds: 61,
      end_seconds: 74,
      start_timecode: "00:01:01:00",
      end_timecode: "00:01:14:00",
      text: "That ending makes the viewer feel the lesson because the thought resolves instead of stopping midstream.",
    },
  ],
});
assert(utteranceV2Request.utterances.length === 4, "Backend schema should accept transcript v2 utterances.");
assert(utteranceV2Request.segments.length === 4, "Backend schema should derive legacy-compatible segments from utterances when needed.");
const utteranceV2Windows = buildSocialReelsLiveDurationWindows({ ...utteranceV2Request, requested_candidate_count: 10 }, 10);
assert(utteranceV2Windows.length > 0, "Utterance-first window builder should create duration windows from utterances.");
assert(
  utteranceV2Windows.every((window) => window.transcript_source === "utterances" && window.utterance_ids.length > 0),
  "Utterance-first windows should preserve utterance_ids and source metadata."
);
const utteranceV2PromptWindows = buildSocialReelsLivePromptWindows(utteranceV2Request, utteranceV2Windows.slice(0, 3));
const utteranceV2PromptInput = buildSocialReelsOpenAIPromptInput(
  { ...utteranceV2Request, requested_candidate_count: 10 },
  {
    discoveryMode: "live_shortlist",
    requestedCandidateCount: 30,
    effectiveCandidateCount: 10,
    durationWindows: utteranceV2PromptWindows,
  }
);
const utteranceV2UserPrompt = String(utteranceV2PromptInput[1].content);
assert(utteranceV2UserPrompt.includes('"transcript_source":"utterances"'), "Live prompt should identify utterances as source of truth.");
assert(utteranceV2UserPrompt.includes('"utterance_ids"'), "Live prompt windows should include utterance_ids.");
assert(utteranceV2UserPrompt.includes('"utterances"'), "Live prompt windows should include utterance-level context.");
for (const expectedSpeaker of ["Layla", "Fabienne", "Jef"]) {
  assert(utteranceV2UserPrompt.includes(expectedSpeaker), `Live prompt should include clean speaker label ${expectedSpeaker}.`);
}
for (const expectedTimecode of ["00:00:00:00", "00:01:01:00"]) {
  assert(utteranceV2UserPrompt.includes(expectedTimecode), `Live prompt should include editor timecode ${expectedTimecode}.`);
}
for (const forbiddenLeak of ["wordAlignment", "whisper", "pyannote", "/Users/", "file://", "Layla:"]) {
  assert(!utteranceV2UserPrompt.includes(forbiddenLeak), `Live prompt should not include forbidden payload detail: ${forbiddenLeak}.`);
}

const editAssistantRequest = socialReelsEditAssistantRequestSchema.parse({
  project_hash: "edit-assistant-smoke-project",
  candidate_id: "candidate-female-blue-balls",
  moment_id: "moment-blue-balls",
  current_edit_recipe: { edit_mode: "linear", timeline_segments: [] },
  user_instruction: "I like this clip, but start with the blue balls line as the hook and give it a cleaner ending.",
  relevant_utterances: [
    {
      utterance_id: "utt-context-001",
      speaker_label: "Layla",
      start_seconds: 661,
      end_seconds: 681,
      start_timecode: "00:11:01:00",
      end_timecode: "00:11:21:00",
      text: "The context explains why the body needs movement before the later hook makes sense.",
    },
    {
      utterance_id: "utt-hook-001",
      speaker_label: "Layla",
      start_seconds: 725,
      end_seconds: 733,
      start_timecode: "00:12:05:00",
      end_timecode: "00:12:13:00",
      text: "If you are not moving your energy it can feel like female blue balls.",
    },
    {
      utterance_id: "utt-closing-001",
      speaker_label: "Layla",
      start_seconds: 755,
      end_seconds: 760,
      start_timecode: "00:12:35:00",
      end_timecode: "00:12:40:00",
      text: "That is the clean closing thought that makes the edit land.",
    },
  ],
  relevant_words: [
    {
      word_id: "word-hook-001",
      utterance_id: "utt-hook-001",
      start_seconds: 725,
      end_seconds: 725.4,
      text: "If",
    },
  ],
  neighboring_context_window: { start_seconds: 650, end_seconds: 770 },
  conversation_id: null,
  previous_response_id: null,
  edit_history: [],
});
const editAssistantPrompt = buildSocialReelsEditAssistantPromptInput(editAssistantRequest);
const editAssistantUserPrompt = String(editAssistantPrompt[1].content);
assert(editAssistantUserPrompt.includes('"endpoint_mode":"stateless"'), "Edit assistant prompt should declare stateless mode.");
assert(editAssistantUserPrompt.includes('"utterance_id":"utt-hook-001"'), "Edit assistant prompt should include real utterance IDs.");
assert(editAssistantUserPrompt.includes('"word_id":"word-hook-001"'), "Edit assistant prompt should include real word IDs when provided.");
assert(editAssistantUserPrompt.includes("00:12:05:00"), "Edit assistant prompt should include source timecodes.");
for (const forbiddenLeak of ["wordAlignment", "whisper", "pyannote", "/Users/", "file://", "OPENAI_API_KEY", "Bearer "]) {
  assert(!editAssistantUserPrompt.includes(forbiddenLeak), `Edit assistant prompt should not include forbidden payload detail: ${forbiddenLeak}.`);
}
const editAssistantResponse = proposeSocialReelsEdit(editAssistantRequest);
socialReelsEditAssistantResponseSchema.parse(editAssistantResponse);
assert(editAssistantResponse.conversation_state === "stateless", "Edit assistant endpoint should be explicitly stateless.");
assert(editAssistantResponse.needs_user_confirmation === true, "Edit assistant patches should require user confirmation.");
assert(editAssistantResponse.proposed_edit_recipe.edit_mode === "story_edit", "Hook relocation request should produce a story_edit recipe.");
assert(editAssistantResponse.proposed_edit_recipe.composition_type === "hook_reordered", "Hook relocation request should use hook_reordered composition.");
assert(
  editAssistantResponse.changed_segments.some((segment) =>
    segment.role === "cold_open_hook" && segment.utterance_ids.includes("utt-hook-001")
  ),
  "Edit assistant patch should move the requested source utterance into a cold_open_hook segment."
);
assert(
  editAssistantResponse.changed_segments.every((segment) => segment.utterance_ids.length > 0 && segment.source_end_seconds > segment.source_start_seconds),
  "Edit assistant changed segments should reference real utterance IDs and valid source times."
);
const editAssistantFixture = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "artifacts/social-reels-edit-assistant/latest/social_reels_edit_assistant_response.mock_fixture.json"),
    "utf8"
  )
) as unknown;
socialReelsEditAssistantResponseSchema.parse(editAssistantFixture);
const editAssistantFixtureJson = JSON.stringify(editAssistantFixture);
for (const forbiddenLeak of ["wordAlignment", "whisper", "pyannote", "/Users/", "file://", "OPENAI_API_KEY", "Bearer "]) {
  assert(!editAssistantFixtureJson.includes(forbiddenLeak), `Edit assistant fixture should not include forbidden payload detail: ${forbiddenLeak}.`);
}

const shortlistRequest = socialReelsRequestSchema.parse({
  project_hash: "schema-smoke-social-reels-project",
  source_duration_seconds: 600,
  duration_preferences: ["60s"],
  requested_candidate_count: 30,
  style: "balanced",
  layout: "vertical",
  caption_style: "bold",
  episode_metadata: { title: "Schema smoke" },
  context: { platform: "social" },
  segments: [
    {
      segment_id: "seg-1",
      start_seconds: 0,
      end_seconds: 120,
      speaker: "Speaker 1",
      text: "A useful clip starts with a question, creates tension, gives a clear answer, and lands a clean final reframe for the viewer.",
    },
  ],
});
const durationWindowRequest = socialReelsRequestSchema.parse({
  project_hash: "schema-smoke-duration-windows",
  source_duration_seconds: 630,
  duration_preferences: ["60s"],
  requested_candidate_count: 30,
  style: "balanced",
  layout: "vertical",
  caption_style: "bold",
  episode_metadata: { title: "Duration window smoke" },
  context: { platform: "social" },
  segments: Array.from({ length: 3 }, (_, index) => ({
    segment_id: `duration-window-seg-${index + 1}`,
    start_seconds: index * 210,
    end_seconds: index * 210 + 210,
    speaker: "Speaker 1",
    text: [
      "The opening question asks why a clip with one sharp line still fails when the viewer lacks context.",
      "The tension grows because the editor wants speed, but the audience needs enough pressure to understand the payoff.",
      "The middle turn explains that a sixty second clip must show the claim, the friction, and the practical answer.",
      "The answer lands when the speaker connects the original question to a clear editorial rule.",
      "The final reframe says duration is not padding; it is the shape that lets the ending feel earned.",
      "That complete arc gives the viewer a reason to remember the clip after it ends.",
    ].join(" "),
  })),
});
const durationWindows = buildSocialReelsLiveDurationWindows(
  {
    ...durationWindowRequest,
    requested_candidate_count: 10,
  },
  10
).filter((window) => window.duration_bucket === "60s");
assert(durationWindows.length >= 10, "Duration window helper should create at least 10 eligible 60s windows.");
for (const window of durationWindows) {
  assert(durationFitsSocialReelsLiveBucket("60s", window.duration_seconds), "Duration window helper should create 60s-compatible windows.");
  assert(window.end_seconds > window.start_seconds, "Duration window helper should create valid start/end times.");
  assert(window.start_anchor_hint.length >= 20, "Duration window helper should include a useful start anchor hint.");
  assert(window.end_anchor_hint.length >= 20, "Duration window helper should include a useful end anchor hint.");
}
const selectedDurationWindows = selectSocialReelsLiveDurationWindows(durationWindows, getSocialReelsLiveWindowCount("18"));
const selectedAgain = selectSocialReelsLiveDurationWindows(durationWindows, getSocialReelsLiveWindowCount("18"));
assert(selectedDurationWindows.length <= 18, "Window selection should cap the live prompt window count.");
assert(JSON.stringify(selectedDurationWindows) === JSON.stringify(selectedAgain), "Window selection should be deterministic.");
assert(
  selectedDurationWindows[0].start_seconds < selectedDurationWindows[selectedDurationWindows.length - 1].start_seconds,
  "Window selection should spread across the episode instead of clustering."
);
const scoredDurationWindows = scoreSocialReelsDurationWindows(durationWindowRequest, durationWindows);
const qualitySummary = summarizeSocialReelsWindowQuality(scoredDurationWindows);
assert(
  qualitySummary.windows_after_quality_filter === scoredDurationWindows.filter((window) => !window.window_exclusion_reason).length,
  "Window quality summary should count non-excluded windows."
);
assert(
  typeof qualitySummary.average_window_quality_score === "number" && qualitySummary.average_window_quality_score > 0,
  "Window quality summary should report an average quality score."
);
const promptWindows = buildSocialReelsLivePromptWindows(durationWindowRequest, selectedDurationWindows);
assert(promptWindows.length === selectedDurationWindows.length, "Prompt windows should keep selected windows with safe excerpts.");
assert(
  promptWindows.every((window) => typeof window.speaker === "string" && typeof window.window_quality_score === "number"),
  "Prompt windows should include speaker and quality metadata for live shortlist guidance."
);
const liveShortlistPromptInput = buildSocialReelsOpenAIPromptInput(
  { ...durationWindowRequest, requested_candidate_count: 10 },
  {
    discoveryMode: "live_shortlist",
    requestedCandidateCount: 30,
    effectiveCandidateCount: 10,
    durationWindows: promptWindows,
  }
);
const liveShortlistUserPrompt = String(liveShortlistPromptInput[1].content);
assert(!liveShortlistUserPrompt.includes("title_options"), "Live shortlist user prompt should not ask for title_options.");
for (const compactField of ["title", "hook_title", "core_question", "payoff", "viral_atoms", "why_it_works"]) {
  assert(liveShortlistUserPrompt.includes(compactField), `Live shortlist user prompt should ask for compact field: ${compactField}.`);
}
assert(
  estimateSocialReelsPromptWindowCharCount(promptWindows) < 18_000,
  "Prompt window context should stay bounded for live shortlist requests."
);

const windowQualityRequest = socialReelsRequestSchema.parse({
  project_hash: "schema-smoke-window-quality",
  source_duration_seconds: 960,
  duration_preferences: ["60s"],
  requested_candidate_count: 30,
  style: "balanced",
  layout: "vertical",
  caption_style: "bold",
  episode_metadata: { title: "Window quality smoke" },
  context: { platform: "social" },
  segments: [
    {
      segment_id: "quality-intro",
      start_seconds: 0,
      end_seconds: 120,
      speaker: "Host",
      text: "Welcome back before we start just a quick housekeeping note about the camera levels and the link down below in the show notes. Thanks for listening and make sure to like and subscribe before we get into the actual topic today.",
    },
    {
      segment_id: "quality-outro",
      start_seconds: 120,
      end_seconds: 240,
      speaker: "Host",
      text: "Where can people find you and buy my book, the link is in the description and linked down below with the promo code. Follow up on social and check the show notes for all the details after the episode.",
    },
    {
      segment_id: "quality-product",
      start_seconds: 240,
      end_seconds: 360,
      speaker: "Host",
      text: "This product has a supplement ingredient blend and the flavor tastes like citrus when we do the tasting reaction. You can order this product when it becomes available now and the brand will share a promo link later.",
    },
    {
      segment_id: "quality-meta-editing",
      start_seconds: 360,
      end_seconds: 480,
      speaker: "Host",
      text: "We will cut that out and edit that out later, so do not include this part when the episode is published. The camera setup was weird and we can fix it in post before the real story starts.",
    },
    ...Array.from({ length: 18 }, (_, index) => ({
      segment_id: `quality-strong-${String(index + 1).padStart(2, "0")}`,
      start_seconds: 480 + index * 40,
      end_seconds: 480 + index * 40 + 90,
      speaker: "Guest",
      text: [
        "The question is why people keep choosing the safe answer when the tension in their body is telling the truth.",
        "The conflict is that everyone wants clarity, but the honest confession arrives before the practical lesson is comfortable.",
        "The answer is to name the pressure directly, explain what changed, and give the viewer a rule they can use today.",
        "The payoff lands when the speaker reframes vulnerability as useful information instead of a problem to hide.",
        "That story beat gives the clip a clean ending and an identity trigger for people who recognize the pattern.",
      ].join(" "),
    })),
  ],
});
const introWindow = buildSocialReelsLiveDurationWindows({ ...windowQualityRequest, requested_candidate_count: 10 }, 10).find(
  (window) => window.segment_id === "quality-intro"
);
const outroWindow = buildSocialReelsLiveDurationWindows({ ...windowQualityRequest, requested_candidate_count: 10 }, 10).find(
  (window) => window.segment_id === "quality-outro"
);
const strongWindow = buildSocialReelsLiveDurationWindows({ ...windowQualityRequest, requested_candidate_count: 10 }, 10).find(
  (window) => window.segment_id === "quality-strong-01"
);
const productWindow = buildSocialReelsLiveDurationWindows({ ...windowQualityRequest, requested_candidate_count: 10 }, 10).find(
  (window) => window.segment_id === "quality-product"
);
const metaEditingWindow = buildSocialReelsLiveDurationWindows({ ...windowQualityRequest, requested_candidate_count: 10 }, 10).find(
  (window) => window.segment_id === "quality-meta-editing"
);
assert(
  Boolean(introWindow && outroWindow && productWindow && metaEditingWindow && strongWindow),
  "Window quality fixture should create intro, outro, product, meta-editing, and strong windows."
);
if (introWindow && outroWindow && productWindow && metaEditingWindow && strongWindow) {
  const scoredIntro = scoreSocialReelsDurationWindow(windowQualityRequest, introWindow);
  const scoredOutro = scoreSocialReelsDurationWindow(windowQualityRequest, outroWindow);
  const scoredProduct = scoreSocialReelsDurationWindow(windowQualityRequest, productWindow);
  const scoredMetaEditing = scoreSocialReelsDurationWindow(windowQualityRequest, metaEditingWindow);
  const scoredStrong = scoreSocialReelsDurationWindow(windowQualityRequest, strongWindow);
  assert(scoredIntro.window_exclusion_reason !== null, "Intro/setup window should be excluded or heavily demoted.");
  assert(scoredOutro.window_exclusion_reason !== null, "Outro/book-link logistics window should be excluded or heavily demoted.");
  assert(scoredProduct.window_exclusion_reason === "product_promo", "Product/promo-heavy window should be excluded as product_promo.");
  assert(scoredMetaEditing.window_exclusion_reason === "meta_editing", "Meta-editing window should be excluded as meta_editing.");
  assert(scoredStrong.window_quality_score > scoredIntro.window_quality_score, "Strong question/tension/payoff window should score above intro setup.");
  assert(scoredStrong.window_quality_score > scoredOutro.window_quality_score, "Strong question/tension/payoff window should score above outro logistics.");
  assert(scoredStrong.window_quality_score > scoredProduct.window_quality_score, "Strong question/tension/payoff window should score above product promo.");
  assert(scoredStrong.window_quality_score > scoredMetaEditing.window_quality_score, "Strong question/tension/payoff window should score above meta-editing.");
}
const selectedQualityWindows = selectSocialReelsLiveDurationWindows(
  buildSocialReelsLiveDurationWindows({ ...windowQualityRequest, requested_candidate_count: 10 }, 10),
  18,
  windowQualityRequest
);
assert(
  selectedQualityWindows.every((window) => !["quality-intro", "quality-outro", "quality-product", "quality-meta-editing"].includes(window.segment_id)),
  "Live window selection should avoid obvious intro/outro/product/meta-editing windows when enough better windows exist."
);
assert(
  new Set(selectedQualityWindows.map((window) => window.segment_id)).size >= 10,
  "Quality-aware live window selection should preserve spread across many useful windows."
);

const selectedQualityRange = getSocialReelsWindowQualityRange(selectedQualityWindows);
assert(
  selectedQualityRange.min !== null && selectedQualityRange.min >= 0.72,
  "Quality-aware selection should choose reasonably strong windows before preserving spread."
);

const sexualWellnessRequest = socialReelsRequestSchema.parse({
  project_hash: "schema-smoke-sexual-wellness-not-unsafe",
  source_duration_seconds: 120,
  duration_preferences: ["60s"],
  requested_candidate_count: 30,
  style: "balanced",
  layout: "vertical",
  caption_style: "bold",
  episode_metadata: { title: "Sexual wellness smoke" },
  context: { platform: "social" },
  segments: [
    {
      segment_id: "sexual-wellness-strong",
      start_seconds: 0,
      end_seconds: 120,
      speaker: "Guest",
      text: [
        "The question is why pleasure and intimacy can feel unsafe even when the body wants connection.",
        "The tension is that shame makes desire feel like a problem, but the answer is not to disconnect from the body.",
        "The practical lesson is to name the sensation, breathe through vulnerability, and reframe orgasm as information instead of performance.",
        "The payoff lands when healing becomes a way to listen to the body with more honesty and less pressure.",
      ].join(" "),
    },
  ],
});
const sexualWellnessWindow = buildSocialReelsLiveDurationWindows({ ...sexualWellnessRequest, requested_candidate_count: 10 }, 10)[0];
assert(Boolean(sexualWellnessWindow), "Sexual wellness fixture should create a duration window.");
if (sexualWellnessWindow) {
  const scoredSexualWellness = scoreSocialReelsDurationWindow(sexualWellnessRequest, sexualWellnessWindow);
  assert(
    scoredSexualWellness.window_exclusion_reason === null,
    "Sexual wellness content alone should not be treated as junk or policy risk by window filtering."
  );
  assert(
    scoredSexualWellness.window_quality_reasons.includes("emotional_turn"),
    "Sexual wellness content can still receive positive editorial signals."
  );
}

const appScaleSentence = [
  "The question is why a creator can have a strong idea and still lose the viewer before the point lands.",
  "The tension is that editors want the shortest possible quote, but social viewers need enough pressure to care.",
  "The answer starts when the speaker explains how context creates trust and makes the payoff feel earned.",
  "The reframe is that a reel is not a tiny quote; it is a complete story compressed into a clean minute.",
  "The payoff lands when the speaker gives a practical rule that another editor could apply immediately.",
].join(" ");
const appScaleWindowRequest = socialReelsRequestSchema.parse({
  project_hash: "schema-smoke-app-scale-windows",
  source_duration_seconds: 68 * 90,
  duration_preferences: ["60s"],
  requested_candidate_count: 30,
  style: "balanced",
  layout: "vertical",
  caption_style: "bold",
  episode_metadata: { title: "App-scale duration window smoke" },
  context: { platform: "social" },
  segments: Array.from({ length: 68 }, (_, index) => ({
    segment_id: `app-scale-seg-${String(index + 1).padStart(2, "0")}`,
    start_seconds: index * 90,
    end_seconds: index * 90 + 90,
    speaker: "Speaker 1",
    text: Array.from({ length: 2 }, () => appScaleSentence).join(" "),
  })),
});
const appScaleWindows = buildSocialReelsLiveDurationWindows({ ...appScaleWindowRequest, requested_candidate_count: 10 }, 10);
const appScaleSelectedWindows = selectSocialReelsLiveDurationWindows(appScaleWindows, getSocialReelsLiveWindowCount("18"), appScaleWindowRequest);
const appScalePromptWindows = buildSocialReelsLivePromptWindows(appScaleWindowRequest, appScaleSelectedWindows);
const appScaleSelectedSegmentIndexes = new Set(
  appScaleSelectedWindows.map((window) => Number(window.segment_id.replace("app-scale-seg-", ""))).filter(Number.isFinite)
);
assert(appScaleWindows.length > appScaleSelectedWindows.length, "App-scale live requests should have more eligible windows than the prompt sends.");
assert(appScaleSelectedWindows.length === 18, "App-scale live prompt should use the configured 18 selected windows.");
assert(appScaleSelectedSegmentIndexes.size >= 12, "App-scale live window selection should spread across many segments.");
assert(
  Math.min(...appScaleSelectedSegmentIndexes) <= 2 && Math.max(...appScaleSelectedSegmentIndexes) >= 64,
  "App-scale live window selection should preserve broad beginning-to-end episode coverage."
);
assert(
  estimateSocialReelsPromptWindowCharCount(appScalePromptWindows) < 25_000,
  "App-scale live prompt window context should stay under a bounded char cap."
);
const unsafeOutputShape = summarizeSocialReelsOutputShape({
  candidates: [
    {
      title: "Do not log this title",
      start_anchor_quote: "Do not log this quote",
      duration_bucket: "60s",
    },
  ],
});
const unsafeOutputSummary = JSON.stringify(unsafeOutputShape);
assert(unsafeOutputShape.has_candidates_array, "Invalid-response diagnostics should report candidate array presence.");
assert(unsafeOutputShape.first_candidate_keys.includes("start_anchor_quote"), "Invalid-response diagnostics may report keys.");
assert(!unsafeOutputSummary.includes("Do not log this"), "Invalid-response diagnostics must not include candidate text values.");
const reducedShortlist = socialReelsShortlistResponseSchema.parse({
  candidates: Array.from({ length: 10 }, (_, index) => ({
    candidate_id: `live-shortlist-${String(index + 1).padStart(2, "0")}`,
    title: `Live shortlist ${index + 1}`,
    hook_title: `Live shortlist ${index + 1}`,
    summary: "A reduced live shortlist candidate with enough fields to hydrate for the app.",
    duration_bucket: "60s",
    segment_id: "seg-1",
    start_seconds: 10,
    end_seconds: 70,
    duration_seconds: 60,
    start_anchor_quote: "A useful clip starts with a question",
    end_anchor_quote: "lands a clean final reframe for the viewer",
    clip_type: "quote_worthy_line",
    topic_tag: "schema smoke",
    why_it_works: "The clip opens with a clear question and ends after the answer lands.",
    viral_atoms: ["question", "clear_answer", "reframe"],
    core_question: "Why does this clip work as a standalone reel?",
    payoff: "The final reframe gives the viewer a clean takeaway.",
    context_dependency: "low",
    sensitivity_level: "none",
    rejection_risk_flags: [],
    score: 0.76,
    scores: {
      hook_strength: 0.78,
      standalone_clarity: 0.76,
      payoff_strength: 0.75,
      emotional_charge: 0.68,
      novelty: 0.7,
      editability: 0.8,
      shareability: 0.77,
      context_independence: 0.76,
      overall: 0.76,
    },
  })),
  model_notes: "Reduced shortlist smoke only.",
});
const hydratedShortlist = hydrateSocialReelsShortlistResponse(reducedShortlist, shortlistRequest);
assert(hydratedShortlist.response.candidates.length === 10, "Live shortlist hydration should preserve the effective 10-candidate count.");
assert(hydratedShortlist.returnedCandidateCount === 10, "Live shortlist metadata should report returned count.");
assert(hydratedShortlist.filteredCandidateCount === 0, "Live shortlist metadata should report zero filtered candidates for valid input.");
assert(hydratedShortlist.liveFilterReasons.duration_outside_bucket === 0, "Live shortlist filter reasons should report zero duration mismatches for valid input.");
socialReelsResponseSchema.parse(hydratedShortlist.response);
for (const hydratedCandidate of hydratedShortlist.response.candidates) {
  socialReelsCandidateSchema.parse(hydratedCandidate);
}
assert(
  getSocialReelsLiveDurationCompliance(reducedShortlist.candidates[0]).ok,
  "60s reduced shortlist candidate should pass duration compliance."
);
assert(reducedShortlist.candidates[0].edit_mode === "linear", "Reduced live shortlist candidates should default to linear edit_mode.");
assert(
  reducedShortlist.candidates[0].composition_type === "contiguous",
  "Reduced live shortlist candidates should default to contiguous composition_type."
);

const aliasShortlist = socialReelsShortlistResponseSchema.parse({
  candidates: Array.from({ length: 3 }, (_, index) => ({
    ...reducedShortlist.candidates[index],
    candidate_id: undefined,
    moment_id: `alias-moment-${index + 1}`,
    title: undefined,
    social_title: `Alias Social Title ${index + 1}`,
    hook_title: undefined,
    headline: `Alias Headline ${index + 1}`,
    summary: undefined,
    preview_text: "A safe alias preview that can hydrate into the app response.",
    score: undefined,
    raw_score: 0.74,
    rejection_risk_flags: undefined,
    review_flags: ["weak_hook"],
  })),
  model_notes: "Alias compatibility smoke only.",
});
assert(aliasShortlist.candidates[0].candidate_id === "alias-moment-1", "Shortlist parser should accept moment_id as candidate_id alias.");
assert(aliasShortlist.candidates[0].title === "Alias Social Title 1", "Shortlist parser should accept social_title as title alias.");
assert(aliasShortlist.candidates[0].score === 0.74, "Shortlist parser should accept raw_score as score alias.");
assert(
  aliasShortlist.candidates[0].rejection_risk_flags.includes("weak_hook"),
  "Shortlist parser should accept review_flags as rejection_risk_flags alias."
);

const durationFilteredShortlist = socialReelsShortlistResponseSchema.parse({
  candidates: [
    {
      ...reducedShortlist.candidates[0],
      candidate_id: "live-shortlist-valid-60s",
      start_seconds: 0,
      end_seconds: 60,
      duration_seconds: 60,
    },
    {
      ...reducedShortlist.candidates[1],
      candidate_id: "live-shortlist-too-short-60s",
      start_seconds: 0,
      end_seconds: 22,
      duration_seconds: 22,
    },
    {
      ...reducedShortlist.candidates[2],
      candidate_id: "live-shortlist-too-long-60s",
      start_seconds: 0,
      end_seconds: 90,
      duration_seconds: 90,
    },
  ],
  model_notes: "Duration filter smoke only.",
});
const filteredHydratedShortlist = hydrateSocialReelsShortlistResponse(durationFilteredShortlist, shortlistRequest);
assert(
  filteredHydratedShortlist.response.candidates.length === 1 &&
    filteredHydratedShortlist.response.candidates[0].candidate_id === "live-shortlist-valid-60s",
  "Live shortlist hydration should reject candidates outside the requested duration bucket."
);
assert(filteredHydratedShortlist.returnedCandidateCount === 1, "Filtered shortlist should report returned count.");
assert(filteredHydratedShortlist.filteredCandidateCount === 2, "Filtered shortlist should report filtered count.");
assert(
  filteredHydratedShortlist.liveFilterReasons.duration_outside_bucket === 2,
  "Filtered shortlist should report duration_outside_bucket reason count."
);
assert(
  filteredHydratedShortlist.response.model_notes.includes("filtered for duration bucket mismatch"),
  "Live shortlist model notes should record safe duration filtering metadata."
);

const responseFormatCandidate = openAISocialReelsResponseFormat.schema.properties.candidates.items;
const responseFormatRequired = responseFormatCandidate.required as readonly string[];
const responseFormatProperties = responseFormatCandidate.properties as Record<string, unknown>;
for (const field of [
  "viral_atoms",
  "core_question",
  "conflict",
  "payoff",
  "title_options",
  "title_score",
  "edit_feasibility_score",
  "risk_penalty",
]) {
  assert(responseFormatRequired.includes(field), `OpenAI response format is missing required field: ${field}.`);
  assert(field in responseFormatProperties, `OpenAI response format is missing property: ${field}.`);
}
for (const field of [
  "edit_mode",
  "composition_type",
  "timeline_segments",
  "display_title",
  "display_teaser",
  "opening_hook",
  "closing_line",
  "coherence_score",
  "continuity_risk",
  "edit_decision_rationale",
  "review_flags",
]) {
  assert(responseFormatRequired.includes(field), `OpenAI response format is missing Smart Story Edit required field: ${field}.`);
  assert(field in responseFormatProperties, `OpenAI response format is missing Smart Story Edit property: ${field}.`);
}
const storyEditFixture = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "artifacts/social-reels-story-edit/latest/social_reels_story_edit_response.backend_fixture.json"),
    "utf8"
  )
) as { candidates: unknown[]; model_notes: string | null };
socialReelsResponseSchema.parse({
  candidates: storyEditFixture.candidates,
  model_notes: storyEditFixture.model_notes,
});
const storyEditFixtureJson = JSON.stringify(storyEditFixture);
assert(storyEditFixture.candidates.some((item) => (item as { composition_type?: string }).composition_type === "hook_reordered"), "Story Edit fixture should include a hook_reordered example.");
assert(storyEditFixture.candidates.some((item) => (item as { composition_type?: string }).composition_type === "hook_setup_payoff"), "Story Edit fixture should include a hook_setup_payoff example.");
assert(storyEditFixture.candidates.some((item) => (item as { review_flags?: string[] }).review_flags?.includes("missing_payoff")), "Story Edit fixture should include a low-confidence review example.");
for (const forbiddenLeak of ["wordAlignment", "whisper", "pyannote", "/Users/", "file://", "Bearer ", "OPENAI_API_KEY"]) {
  assert(!storyEditFixtureJson.includes(forbiddenLeak), `Story Edit fixture should not include forbidden payload detail: ${forbiddenLeak}.`);
}

const matrixRequest = socialReelsRequestSchema.parse({
  project_hash: "matrix-request-smoke",
  requested_candidate_count: 30,
  requested_targets: [
    { style: "emotional", duration: "30s" },
    { style: "story", duration: "30s" },
    { style: "hookFirst", duration: "15s" },
    { style: "educational", duration: "90s" },
    { style: "inspirational", duration: "deepCut5To10m" },
    { style: "emotional", duration: "30s" },
  ],
  max_per_bucket: 99,
  max_unique_moments: 999,
  dedupe_shared_moments: true,
  style: "balanced",
  layout: "vertical",
  caption_style: "bold",
  episode_metadata: { title: "Discovery Matrix Smoke" },
  utterances: [
    {
      utterance_id: "utt-matrix-1",
      speaker_label: "Layla",
      start_seconds: 0,
      end_seconds: 18,
      start_timecode: "00:00:00:00",
      end_timecode: "00:00:18:00",
      text: "The question is how a single powerful story can work as more than one social reel target.",
    },
    {
      utterance_id: "utt-matrix-2",
      speaker_label: "Fabienne",
      start_seconds: 18,
      end_seconds: 44,
      start_timecode: "00:00:18:00",
      end_timecode: "00:00:44:00",
      text: "The tension is that we do not want duplicates, padding, or format variants pretending to be new discoveries.",
    },
    {
      utterance_id: "utt-matrix-3",
      speaker_label: "Jef",
      start_seconds: 44,
      end_seconds: 76,
      start_timecode: "00:00:44:00",
      end_timecode: "00:01:16:00",
      text: "The answer is to discover the moment identity once, then group it into every duration and style bucket it honestly fits.",
    },
  ],
  segments: [
    {
      segment_id: "seg-matrix-1",
      start_seconds: 0,
      end_seconds: 76,
      start_timecode: "00:00:00:00",
      end_timecode: "00:01:16:00",
      speakers: ["Layla", "Fabienne", "Jef"],
      utterance_ids: ["utt-matrix-1", "utt-matrix-2", "utt-matrix-3"],
      text: "The question, tension, and answer create one reusable discovery matrix moment.",
    },
  ],
});
const matrixFixture = socialReelsRequestSchema.parse(
  JSON.parse(readFileSync(resolve(process.cwd(), "tests/fixtures/social_reels_discovery_matrix_request.redacted.json"), "utf8")) as unknown
);
assert(matrixFixture.discovery_matrix !== null, "App redacted discovery matrix fixture should parse as matrix request.");
assert(matrixFixture.requested_targets.length === 5, "App redacted discovery matrix fixture should preserve requested target buckets.");
assert(matrixFixture.dedupe_shared_moments === true, "App redacted discovery matrix fixture should request shared moment dedupe.");
assert(matrixRequest.discovery_matrix !== null, "Matrix request should create discovery_matrix metadata.");
assert(matrixRequest.requested_targets.length === 5, "Matrix request should dedupe duplicate target buckets.");
assert(matrixRequest.duration_preferences.includes("15s"), "Matrix request should derive 15s duration preference from targets.");
assert(matrixRequest.duration_preferences.includes("30s"), "Matrix request should derive 30s duration preference from targets.");
assert(matrixRequest.duration_preferences.includes("90s"), "Matrix request should derive 90s duration preference from targets.");
assert(matrixRequest.duration_preferences.includes("5-10m"), "Matrix request should normalize deepCut5To10m to 5-10m.");
assert(matrixRequest.max_per_bucket === SOCIAL_REELS_DISCOVERY_MATRIX_MAX_PER_BUCKET_CAP, "Matrix max_per_bucket should cap at 20.");
assert(matrixRequest.max_unique_moments === 80, "Matrix max_unique_moments should cap at 80.");
assert(matrixRequest.dedupe_shared_moments === true, "Matrix request should preserve dedupe_shared_moments.");

const matrixPromptInput = buildSocialReelsOpenAIPromptInput(matrixRequest, {
  discoveryMode: "discovery_matrix",
  requestedCandidateCount: matrixRequest.requested_candidate_count,
  effectiveCandidateCount: 10,
  durationWindows: [],
});
const matrixUserPrompt = String(matrixPromptInput[1].content);
for (const expected of [
  '"requested_targets"',
  '"discovery_matrix"',
  '"max_per_bucket":20',
  '"max_unique_moments":80',
  "format",
  "caption",
  "not discovery targets",
  "utterances",
]) {
  assert(matrixUserPrompt.includes(expected), `Matrix prompt should include ${expected}.`);
}
assert(matrixUserPrompt.includes("Layla") && matrixUserPrompt.includes("Fabienne") && matrixUserPrompt.includes("Jef"), "Matrix prompt should preserve clean speaker labels.");
assert(!matrixUserPrompt.includes("wordAlignment"), "Matrix prompt must not include raw word-aligned JSON.");

const matrixResponseFormat = openAISocialReelsDiscoveryMatrixResponseFormat(matrixRequest.max_unique_moments, matrixRequest.max_per_bucket);
assert(matrixResponseFormat.schema.properties.moments.maxItems === 80, "Matrix response schema should cap unique moments.");
assert(
  matrixResponseFormat.schema.properties.moments.items.properties.buckets.items.properties.rank.maximum === 20,
  "Matrix response bucket rank should cap at max_per_bucket."
);
socialReelsDiscoveryMatrixResponseSchema.parse({
  moments: [
    {
      moment_id: "moment-shared-1",
      start_seconds: 18,
      end_seconds: 48,
      start_timecode: "00:00:18:00",
      end_timecode: "00:00:48:00",
      speakers: ["Fabienne", "Jef"],
      title: "One moment can serve multiple targets",
      summary: "A single moment identity is grouped into multiple target buckets without duplicate copies.",
      raw_score: 0.86,
      buckets: [
        { style: "emotional", duration: "30s", rank: 1, bucket_score: 0.88, why_it_fits: "It has tension and a payoff." },
        { style: "story", duration: "30s", rank: 1, bucket_score: 0.84, why_it_fits: "It has a clean story shape." },
      ],
      review_flags: [],
    },
  ],
  buckets: [
    { style: "emotional", duration: "30s", moment_ids: ["moment-shared-1"] },
    { style: "story", duration: "30s", moment_ids: ["moment-shared-1"] },
  ],
  model_notes: "Discovery matrix schema smoke; no provider call.",
});

const durationFirstManifest = socialReelsDurationFirstManifestSchema.parse(
  JSON.parse(readFileSync(resolve(process.cwd(), "artifacts/social-reels-duration-first/latest/duration_first_manifest_fixture.json"), "utf8")) as unknown
);
assert(durationFirstManifest.schema_version === SOCIAL_REELS_DURATION_FIRST_SCHEMA_VERSION, "Duration-first manifest should use the v1 schema version.");
assert(
  durationFirstManifest.generation_summary.max_per_duration_bucket === SOCIAL_REELS_DURATION_FIRST_MAX_PER_BUCKET,
  "Duration-first manifest should cap max_per_duration_bucket at 20."
);
assert(
  durationFirstManifest.generation_summary.max_unique_moments === SOCIAL_REELS_DURATION_FIRST_MAX_UNIQUE_MOMENTS,
  "Duration-first manifest should support 120 unique moments."
);
assert(
  durationFirstManifest.generation_summary.max_total_bucket_memberships === SOCIAL_REELS_DURATION_FIRST_MAX_TOTAL_BUCKET_MEMBERSHIPS,
  "Duration-first manifest should support 240 total bucket memberships."
);
for (const target of SOCIAL_REELS_DURATION_FIRST_TARGETS) {
  assert(durationFirstManifest.duration_buckets.some((bucket) => bucket.duration_target === target), `Duration-first manifest fixture should include ${target} bucket.`);
}
assert(
  durationFirstManifest.duration_buckets.every((bucket) => bucket.requested_max_candidates <= SOCIAL_REELS_DURATION_FIRST_MAX_PER_BUCKET),
  "Duration-first manifest buckets should never request more than 20 candidates."
);
assert(
  durationFirstManifest.moments.some((moment) => moment.edit_mode === "linear" && moment.composition_type === "contiguous"),
  "Duration-first manifest should validate a linear contiguous candidate."
);
assert(
  durationFirstManifest.moments.some((moment) => moment.edit_mode === "story_edit" && moment.timeline_segments.length >= 2 && moment.timeline_segments.length <= 4),
  "Duration-first manifest should validate a story_edit candidate with 2-4 timeline segments."
);
assert(
  durationFirstManifest.moments.some((moment) => moment.duration_bucket_memberships.length > 1),
  "Duration-first manifest should support deduped shared moments across compatible duration buckets."
);
assert(
  durationFirstManifest.moments.every((moment) => moment.generated_tags.every((tag) => SOCIAL_REELS_DURATION_FIRST_GENERATED_TAGS.includes(tag))),
  "Duration-first manifest should use backend-generated editorial tags instead of user preselected style buckets."
);
assert(
  durationFirstManifest.moments.some((moment) => moment.timeline_segments.some((segment) => segment.word_start_id && segment.word_end_id)),
  "Duration-first manifest should support word_start_id and word_end_id."
);
const durationFirstArtifactText = [
  readFileSync(resolve(process.cwd(), "artifacts/social-reels-duration-first/latest/duration_first_manifest_schema.json"), "utf8"),
  readFileSync(resolve(process.cwd(), "artifacts/social-reels-duration-first/latest/duration_first_manifest_fixture.json"), "utf8"),
  readFileSync(resolve(process.cwd(), "artifacts/social-reels-duration-first/latest/duration_first_contract_report.md"), "utf8"),
].join("\n");
for (const forbiddenLeak of ["wordAlignment", "whisper", "pyannote", "/Users/", "file://", "OPENAI_API_KEY", "Bearer "]) {
  assert(!durationFirstArtifactText.includes(forbiddenLeak), `Duration-first manifest artifacts should not include forbidden private detail: ${forbiddenLeak}.`);
}
assert(
  socialReelsCandidateSchema.safeParse(candidate(9, true)).success,
  "Legacy compact candidate response should remain compatible after adding duration-first manifest contract."
);

if (!failed) {
  console.log("PASS: social reels prompt/schema smoke passed without a live OpenAI call.");
}

process.exitCode = failed ? 1 : 0;
