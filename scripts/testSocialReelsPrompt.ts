import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  SOCIAL_REELS_VIRAL_ATOMS,
  openAISocialReelsResponseFormat,
  socialReelsCandidateSchema,
  socialReelsRequestSchema,
  socialReelsResponseSchema,
} from "../lib/socialReelsSchema";
import { summarizeSocialReelsOutputShape } from "../lib/socialReelsDiagnostics";
import {
  buildSocialReelsLiveDurationWindows,
  buildSocialReelsLivePromptWindows,
  estimateSocialReelsPromptWindowCharCount,
  getSocialReelsLiveWindowCount,
  selectSocialReelsLiveDurationWindows,
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
  };
}

const promptSource = readFileSync(resolve(process.cwd(), "lib/openaiSocialReels.ts"), "utf8");

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
]) {
  assert(promptSource.includes(durationWindowGuidance), `Prompt is missing duration window guidance: ${durationWindowGuidance}.`);
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

socialReelsCandidateSchema.parse(candidate(0, false));
socialReelsCandidateSchema.parse(candidate(0, true));
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
const promptWindows = buildSocialReelsLivePromptWindows(durationWindowRequest, selectedDurationWindows);
assert(promptWindows.length === selectedDurationWindows.length, "Prompt windows should keep selected windows with safe excerpts.");
assert(
  estimateSocialReelsPromptWindowCharCount(promptWindows) < 18_000,
  "Prompt window context should stay bounded for live shortlist requests."
);

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
const appScaleSelectedWindows = selectSocialReelsLiveDurationWindows(appScaleWindows, getSocialReelsLiveWindowCount("18"));
const appScalePromptWindows = buildSocialReelsLivePromptWindows(appScaleWindowRequest, appScaleSelectedWindows);
const appScaleSelectedSegmentIndexes = new Set(
  appScaleSelectedWindows.map((window) => Number(window.segment_id.replace("app-scale-seg-", ""))).filter(Number.isFinite)
);
assert(appScaleWindows.length > appScaleSelectedWindows.length, "App-scale live requests should have more eligible windows than the prompt sends.");
assert(appScaleSelectedWindows.length === 18, "App-scale live prompt should use the configured 18 selected windows.");
assert(appScaleSelectedSegmentIndexes.size >= 12, "App-scale live window selection should spread across many segments.");
assert(
  Math.min(...appScaleSelectedSegmentIndexes) <= 2 && Math.max(...appScaleSelectedSegmentIndexes) >= 67,
  "App-scale live window selection should preserve beginning-to-end episode coverage."
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

if (!failed) {
  console.log("PASS: social reels prompt/schema smoke passed without a live OpenAI call.");
}

process.exitCode = failed ? 1 : 0;
