import { z } from "zod";

import {
  SOCIAL_REELS_CLIP_TYPES,
  SOCIAL_REELS_DURATION_BUCKETS,
  SOCIAL_REELS_PLATFORMS,
  SOCIAL_REELS_REJECTION_RISK_FLAGS,
  SOCIAL_REELS_VIRAL_ATOMS,
  socialReelsCandidateSchema,
  type SocialReelsCandidate,
  type SocialReelsRequest,
} from "./socialReelsSchema";

export const SOCIAL_REELS_LIVE_SHORTLIST_DEFAULT_CANDIDATES = 10;
export const SOCIAL_REELS_LIVE_SHORTLIST_MIN_CANDIDATES = 1;
export const SOCIAL_REELS_LIVE_SHORTLIST_MAX_CANDIDATES = 30;

const scoreSchema = z.number().min(0).max(1);

export const socialReelsShortlistCandidateSchema = z
  .object({
    candidate_id: z.string().trim().min(1).max(80),
    title: z.string().trim().min(1).max(120),
    duration_bucket: z.enum(SOCIAL_REELS_DURATION_BUCKETS),
    segment_id: z.string().trim().min(1).max(128),
    start_seconds: z.number().finite().min(0).max(24 * 60 * 60),
    end_seconds: z.number().finite().min(0).max(24 * 60 * 60),
    start_anchor_quote: z.string().trim().min(20).max(240),
    end_anchor_quote: z.string().trim().min(20).max(240),
    score: scoreSchema,
  })
  .superRefine((candidate, ctx) => {
    if (candidate.end_seconds <= candidate.start_seconds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end_seconds"],
        message: "end_seconds must be greater than start_seconds.",
      });
    }
  });

export const socialReelsShortlistResponseSchema = z.object({
  candidates: z
    .array(socialReelsShortlistCandidateSchema)
    .min(SOCIAL_REELS_LIVE_SHORTLIST_MIN_CANDIDATES)
    .max(SOCIAL_REELS_LIVE_SHORTLIST_MAX_CANDIDATES),
  model_notes: z.string().trim().max(1000).nullable(),
});

export type SocialReelsShortlistCandidate = z.infer<typeof socialReelsShortlistCandidateSchema>;
export type SocialReelsShortlistResponse = z.infer<typeof socialReelsShortlistResponseSchema>;

export function getEffectiveLiveShortlistCandidateCount(requestedCandidateCount: number, rawEnvValue?: string | null) {
  const parsed = rawEnvValue?.trim() ? Number(rawEnvValue.trim()) : SOCIAL_REELS_LIVE_SHORTLIST_DEFAULT_CANDIDATES;
  const configured = Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : SOCIAL_REELS_LIVE_SHORTLIST_DEFAULT_CANDIDATES;
  const boundedConfigured = Math.min(
    SOCIAL_REELS_LIVE_SHORTLIST_MAX_CANDIDATES,
    Math.max(SOCIAL_REELS_LIVE_SHORTLIST_MIN_CANDIDATES, configured)
  );

  return Math.min(requestedCandidateCount, boundedConfigured);
}

export function openAISocialReelsShortlistResponseFormat(candidateCount: number) {
  const boundedCandidateCount = Math.min(
    SOCIAL_REELS_LIVE_SHORTLIST_MAX_CANDIDATES,
    Math.max(SOCIAL_REELS_LIVE_SHORTLIST_MIN_CANDIDATES, Math.round(candidateCount))
  );

  return {
    type: "json_schema",
    name: "social_reels_live_shortlist",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["candidates", "model_notes"],
      properties: {
        candidates: {
          type: "array",
          minItems: boundedCandidateCount,
          maxItems: boundedCandidateCount,
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "candidate_id",
              "title",
              "duration_bucket",
              "segment_id",
              "start_seconds",
              "end_seconds",
              "start_anchor_quote",
              "end_anchor_quote",
              "score",
            ],
            properties: {
              candidate_id: { type: "string", minLength: 1, maxLength: 80 },
              title: { type: "string", minLength: 1, maxLength: 120 },
              duration_bucket: { type: "string", enum: SOCIAL_REELS_DURATION_BUCKETS },
              segment_id: { type: "string", minLength: 1, maxLength: 128 },
              start_seconds: { type: "number", minimum: 0, maximum: 86400 },
              end_seconds: { type: "number", minimum: 0, maximum: 86400 },
              start_anchor_quote: { type: "string", minLength: 20, maxLength: 240 },
              end_anchor_quote: { type: "string", minLength: 20, maxLength: 240 },
              score: { type: "number", minimum: 0, maximum: 1 },
            },
          },
        },
        model_notes: {
          anyOf: [{ type: "string", maxLength: 1000 }, { type: "null" }],
        },
      },
    },
  } as const;
}

function clampScore(score: number) {
  return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}

function truncate(value: string | null | undefined, max: number, fallback: string) {
  const cleaned = value?.replace(/\s+/g, " ").trim();
  if (!cleaned) return fallback;
  return cleaned.slice(0, max);
}

function getSegmentText(input: SocialReelsRequest, segmentId: string) {
  return input.segments.find((segment) => segment.id === segmentId || segment.segment_id === segmentId)?.text || "";
}

function hydrateScoreBreakdown(score: number) {
  const overall = clampScore(score);
  return {
    hook_strength: clampScore(overall),
    standalone_clarity: clampScore(overall - 0.02),
    payoff_strength: clampScore(overall - 0.03),
    emotional_charge: clampScore(overall - 0.08),
    novelty: clampScore(overall - 0.06),
    editability: clampScore(overall - 0.01),
    shareability: clampScore(overall - 0.02),
    context_independence: clampScore(overall - 0.03),
    overall,
  };
}

export function hydrateSocialReelsShortlistCandidate(
  candidate: SocialReelsShortlistCandidate,
  input: SocialReelsRequest
): SocialReelsCandidate {
  const score = clampScore(candidate.score);
  const durationSeconds = Math.max(5, Math.min(10 * 60, Math.round(candidate.end_seconds - candidate.start_seconds)));
  const segmentText = getSegmentText(input, candidate.segment_id);
  const title = truncate(candidate.title, 120, "Social reel shortlist candidate");
  const startAnchor = truncate(candidate.start_anchor_quote, 240, "A strong opening anchor from the transcript");
  const endAnchor = truncate(candidate.end_anchor_quote, 240, "A clean ending anchor from the transcript");
  const caption = truncate(`${startAnchor} ... ${endAnchor}`, 280, title);
  const topicTag = truncate(title.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").trim(), 80, "shortlist");
  const hook = truncate(segmentText || startAnchor, 240, startAnchor);
  const scores = hydrateScoreBreakdown(score);
  const titleScore = clampScore(Math.max(0.5, score - 0.02));
  const editFeasibilityScore = clampScore(Math.max(0.5, score - 0.01));

  const hydrated = {
    candidate_id: candidate.candidate_id,
    title,
    hook,
    summary: "Live shortlist candidate selected from a reduced Social Reels schema for fast first-pass discovery.",
    start_anchor_quote: startAnchor,
    end_anchor_quote: endAnchor,
    clip_type: "quote_worthy_line" as (typeof SOCIAL_REELS_CLIP_TYPES)[number],
    topic_tag: topicTag,
    hook_title: title,
    subtitle_intro: truncate(startAnchor, 160, title),
    social_caption: caption,
    why_it_works:
      "The moment has a clear opening anchor, a later payoff anchor, and enough standalone context for a fast shortlist pass.",
    viral_atoms: ["question", "clear_answer"] as Array<(typeof SOCIAL_REELS_VIRAL_ATOMS)[number]>,
    core_question: truncate(title, 240, "What makes this moment worth watching?"),
    conflict: "The clip needs to create tension quickly and avoid dead setup.",
    payoff: truncate(endAnchor, 240, "The ending lands the point."),
    title_options: [{ title, score: titleScore }],
    title_score: titleScore,
    edit_feasibility_score: editFeasibilityScore,
    risk_penalty: 0,
    rejection_risk_flags: [] as Array<(typeof SOCIAL_REELS_REJECTION_RISK_FLAGS)[number]>,
    risk_flags: [] as Array<(typeof SOCIAL_REELS_REJECTION_RISK_FLAGS)[number]>,
    duration_bucket: candidate.duration_bucket,
    start_seconds: Math.max(0, candidate.start_seconds),
    end_seconds: Math.max(candidate.start_seconds + 5, candidate.end_seconds),
    duration_seconds: durationSeconds,
    score,
    scores,
    rationale: "Live shortlist result hydrated for app compatibility; full enrichment is reserved for a later refinement pass.",
    segment_ids: [candidate.segment_id],
    captions: [truncate(startAnchor, 160, title)],
    suggested_platforms: [input.context.platform || "social"] as Array<(typeof SOCIAL_REELS_PLATFORMS)[number]>,
    safety_notes: null,
  };

  return socialReelsCandidateSchema.parse(hydrated);
}

export function hydrateSocialReelsShortlistResponse(
  shortlist: SocialReelsShortlistResponse,
  input: SocialReelsRequest
) {
  return {
    candidates: shortlist.candidates.map((candidate) => hydrateSocialReelsShortlistCandidate(candidate, input)),
    model_notes:
      shortlist.model_notes ||
      "Live shortlist response generated with reduced schema; full enrichment is reserved for a later refinement pass.",
  };
}
