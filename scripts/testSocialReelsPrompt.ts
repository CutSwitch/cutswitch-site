import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  SOCIAL_REELS_VIRAL_ATOMS,
  openAISocialReelsResponseFormat,
  socialReelsCandidateSchema,
  socialReelsRequestSchema,
  socialReelsResponseSchema,
} from "../lib/socialReelsSchema";
import {
  getEffectiveLiveShortlistCandidateCount,
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
  promptSource.includes("live_shortlist") && promptSource.includes("getSocialReelsLiveCandidateCount"),
  "Live mode should use the capped shortlist path."
);

socialReelsCandidateSchema.parse(candidate(0, false));
socialReelsCandidateSchema.parse(candidate(0, true));
socialReelsResponseSchema.parse({
  candidates: Array.from({ length: 30 }, (_, index) => candidate(index, true)),
  model_notes: "Schema smoke only; no provider call.",
});

assert(getEffectiveLiveShortlistCandidateCount(30, undefined) === 10, "Live shortlist should default to 10 candidates.");
assert(getEffectiveLiveShortlistCandidateCount(30, "8") === 8, "Live shortlist env override should be honored.");
assert(getEffectiveLiveShortlistCandidateCount(30, "80") === 30, "Live shortlist env override should be capped to 30.");

const shortlistFormat = openAISocialReelsShortlistResponseFormat(10);
assert(shortlistFormat.schema.properties.candidates.minItems === 10, "Live shortlist response format should require 10 items.");
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
const reducedShortlist = socialReelsShortlistResponseSchema.parse({
  candidates: Array.from({ length: 10 }, (_, index) => ({
    candidate_id: `live-shortlist-${String(index + 1).padStart(2, "0")}`,
    title: `Live shortlist ${index + 1}`,
    duration_bucket: "60s",
    segment_id: "seg-1",
    start_seconds: 10,
    end_seconds: 70,
    start_anchor_quote: "A useful clip starts with a question",
    end_anchor_quote: "lands a clean final reframe for the viewer",
    score: 0.76,
  })),
  model_notes: "Reduced shortlist smoke only.",
});
const hydratedShortlist = hydrateSocialReelsShortlistResponse(reducedShortlist, shortlistRequest);
assert(hydratedShortlist.candidates.length === 10, "Live shortlist hydration should preserve the effective 10-candidate count.");
for (const hydratedCandidate of hydratedShortlist.candidates) {
  socialReelsCandidateSchema.parse(hydratedCandidate);
}

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
