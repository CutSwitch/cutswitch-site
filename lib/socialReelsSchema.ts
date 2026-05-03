import { z } from "zod";

export const SOCIAL_REELS_DURATION_BUCKETS = ["15s", "30s", "60s", "90s", "5-10m"] as const;
export const SOCIAL_REELS_REQUEST_DURATION_PACKS = [...SOCIAL_REELS_DURATION_BUCKETS, "mixed", "custom"] as const;
export const SOCIAL_REELS_PLATFORMS = ["instagram_reels", "tiktok", "youtube_shorts", "social"] as const;
export const SOCIAL_REELS_STYLES = ["balanced", "educational", "funny", "dramatic", "promo", "story"] as const;
export const SOCIAL_REELS_LAYOUTS = ["vertical", "square", "horizontal"] as const;
export const SOCIAL_REELS_CAPTION_STYLES = ["none", "minimal", "bold", "karaoke", "subtitles"] as const;

export const SOCIAL_REELS_MIN_CANDIDATES = 30;
export const SOCIAL_REELS_DEFAULT_CANDIDATES = 50;
export const SOCIAL_REELS_MAX_CANDIDATES = 80;
export const SOCIAL_REELS_MAX_SEGMENTS = 2000;
export const SOCIAL_REELS_MAX_SEGMENT_TEXT_CHARS = 2000;

const RAW_PATH_VALUE = /(^|[\s"'])(~\/|\/Users\/|[A-Za-z]:\\|file:\/\/|.*\\.*|.*\/.*)/;

function looksLikeRawPath(value: string) {
  return RAW_PATH_VALUE.test(value) || /\.fcpxml\b/i.test(value);
}

const safeOptionalText = (max: number) => z.string().trim().max(max).optional().nullable();
const requestedCandidateCountSchema = z
  .number()
  .int()
  .min(SOCIAL_REELS_MIN_CANDIDATES)
  .max(SOCIAL_REELS_MAX_CANDIDATES)
  .default(SOCIAL_REELS_DEFAULT_CANDIDATES);

export const socialReelsCustomDurationSchema = z
  .object({
    min: z.number().int().min(5).max(10 * 60),
    max: z.number().int().min(5).max(10 * 60),
  })
  .superRefine((duration, ctx) => {
    if (duration.max < duration.min) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["max"],
        message: "max must be greater than or equal to min.",
      });
    }
  });

const socialReelsRawTranscriptSegmentSchema = z
  .object({
    id: z.string().trim().min(1).max(128).optional(),
    segment_id: z.string().trim().min(1).max(128).optional(),
    start_seconds: z.number().finite().min(0).max(24 * 60 * 60),
    end_seconds: z.number().finite().min(0).max(24 * 60 * 60),
    speaker: safeOptionalText(80),
    text: z.string().trim().min(1).max(SOCIAL_REELS_MAX_SEGMENT_TEXT_CHARS),
  })
  .superRefine((segment, ctx) => {
    if (!segment.id && !segment.segment_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["segment_id"],
        message: "segment_id is required.",
      });
    }

    if (segment.end_seconds <= segment.start_seconds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end_seconds"],
        message: "end_seconds must be greater than start_seconds.",
      });
    }
  });

export const socialReelsTranscriptSegmentSchema = socialReelsRawTranscriptSegmentSchema
  .transform((segment) => ({
    ...segment,
    id: segment.id ?? segment.segment_id ?? "",
  }));

export const socialReelsRequestSchema = z
  .object({
    project_hash: z.string().trim().min(1).max(512),
    project_fingerprint: z.string().trim().min(1).max(512).optional().nullable(),
    source_duration_seconds: z.number().int().min(1).max(24 * 60 * 60).optional(),
    duration_preferences: z.array(z.enum(SOCIAL_REELS_REQUEST_DURATION_PACKS)).min(1).max(SOCIAL_REELS_REQUEST_DURATION_PACKS.length),
    duration_bucket: z.enum(SOCIAL_REELS_REQUEST_DURATION_PACKS).optional(),
    requested_candidate_count: requestedCandidateCountSchema.optional(),
    candidate_count: requestedCandidateCountSchema.optional(),
    custom_duration_seconds: socialReelsCustomDurationSchema.optional().nullable(),
    style: z.enum(SOCIAL_REELS_STYLES).or(z.string().trim().min(1).max(80)),
    layout: z.enum(SOCIAL_REELS_LAYOUTS).or(z.string().trim().min(1).max(80)),
    caption_style: z.enum(SOCIAL_REELS_CAPTION_STYLES).or(z.string().trim().min(1).max(80)),
    episode_metadata: z
      .object({
        title: safeOptionalText(160),
        show_name: safeOptionalText(120),
        episode_number: safeOptionalText(80),
        published_at: safeOptionalText(80),
        guest_names: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
      })
      .passthrough(),
    segments: z.array(socialReelsTranscriptSegmentSchema).min(1).max(SOCIAL_REELS_MAX_SEGMENTS),
    context: z
      .object({
        platform: z.enum(SOCIAL_REELS_PLATFORMS).optional().default("social"),
        show_name: safeOptionalText(120),
        content_notes: safeOptionalText(1000),
      })
      .optional()
      .default({}),
  })
  .transform((payload) => ({
    ...payload,
    project_fingerprint: payload.project_fingerprint ?? payload.project_hash,
    source_duration_seconds:
      payload.source_duration_seconds ??
      Math.max(...payload.segments.map((segment) => Math.ceil(segment.end_seconds))),
    duration_bucket: payload.duration_bucket ?? payload.duration_preferences[0],
    requested_candidate_count: payload.requested_candidate_count ?? payload.candidate_count ?? SOCIAL_REELS_DEFAULT_CANDIDATES,
  }))
  .superRefine((payload, ctx) => {
    if (payload.project_hash && looksLikeRawPath(payload.project_hash)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["project_hash"],
        message: "project_hash must be a privacy-safe hash.",
      });
    }

    if (payload.project_fingerprint && looksLikeRawPath(payload.project_fingerprint)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["project_fingerprint"],
        message: "project_fingerprint must be a privacy-safe fingerprint.",
      });
    }

    if (payload.duration_bucket === "custom" && !payload.custom_duration_seconds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["custom_duration_seconds"],
        message: "custom_duration_seconds is required when custom duration is requested.",
      });
    }

    if (!payload.duration_preferences.includes("custom") && payload.duration_bucket !== "custom" && payload.custom_duration_seconds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["custom_duration_seconds"],
        message: "custom_duration_seconds is only allowed when custom duration is requested.",
      });
    }
  });

export const socialReelsCandidateSchema = z
  .object({
    candidate_id: z.string().trim().min(1).max(80),
    title: z.string().trim().min(1).max(120),
    hook: z.string().trim().min(1).max(240),
    summary: z.string().trim().min(1).max(500),
    duration_bucket: z.enum(SOCIAL_REELS_DURATION_BUCKETS),
    start_seconds: z.number().finite().min(0).max(24 * 60 * 60),
    end_seconds: z.number().finite().min(0).max(24 * 60 * 60),
    duration_seconds: z.number().int().min(5).max(10 * 60),
    score: z.number().int().min(0).max(100),
    rationale: z.string().trim().min(1).max(500),
    segment_ids: z.array(z.string().trim().min(1).max(128)).min(1).max(30),
    captions: z.array(z.string().trim().min(1).max(160)).min(1).max(5),
    suggested_platforms: z.array(z.enum(SOCIAL_REELS_PLATFORMS)).min(1).max(4),
    safety_notes: z.string().trim().max(240).nullable(),
  })
  .superRefine((candidate, ctx) => {
    if (candidate.end_seconds <= candidate.start_seconds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end_seconds"],
        message: "end_seconds must be greater than start_seconds.",
      });
    }

    const actualDuration = Math.round(candidate.end_seconds - candidate.start_seconds);
    if (Math.abs(actualDuration - candidate.duration_seconds) > 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["duration_seconds"],
        message: "duration_seconds must match start_seconds/end_seconds.",
      });
    }
  });

export const socialReelsResponseSchema = z.object({
  candidates: z.array(socialReelsCandidateSchema).min(SOCIAL_REELS_MIN_CANDIDATES).max(SOCIAL_REELS_MAX_CANDIDATES),
  model_notes: z.string().trim().max(1000).nullable(),
});

export type SocialReelsRequest = z.infer<typeof socialReelsRequestSchema>;
export type SocialReelsTranscriptSegment = z.infer<typeof socialReelsTranscriptSegmentSchema>;
export type SocialReelsCandidate = z.infer<typeof socialReelsCandidateSchema>;
export type SocialReelsResponse = z.infer<typeof socialReelsResponseSchema>;

export function getSafeSocialReelsIssues(error: z.ZodError) {
  return error.issues.slice(0, 20).map((issue) => ({
    path: issue.path.map((part) => String(part)).join("."),
    code: issue.code,
  }));
}

export const openAISocialReelsResponseFormat = {
  type: "json_schema",
  name: "social_reels_candidates",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["candidates", "model_notes"],
    properties: {
      candidates: {
        type: "array",
        minItems: SOCIAL_REELS_MIN_CANDIDATES,
        maxItems: SOCIAL_REELS_MAX_CANDIDATES,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "candidate_id",
            "title",
            "hook",
            "summary",
            "duration_bucket",
            "start_seconds",
            "end_seconds",
            "duration_seconds",
            "score",
            "rationale",
            "segment_ids",
            "captions",
            "suggested_platforms",
            "safety_notes",
          ],
          properties: {
            candidate_id: { type: "string", minLength: 1, maxLength: 80 },
            title: { type: "string", minLength: 1, maxLength: 120 },
            hook: { type: "string", minLength: 1, maxLength: 240 },
            summary: { type: "string", minLength: 1, maxLength: 500 },
            duration_bucket: { type: "string", enum: SOCIAL_REELS_DURATION_BUCKETS },
            start_seconds: { type: "number", minimum: 0, maximum: 86400 },
            end_seconds: { type: "number", minimum: 0, maximum: 86400 },
            duration_seconds: { type: "integer", minimum: 5, maximum: 600 },
            score: { type: "integer", minimum: 0, maximum: 100 },
            rationale: { type: "string", minLength: 1, maxLength: 500 },
            segment_ids: {
              type: "array",
              minItems: 1,
              maxItems: 30,
              items: { type: "string", minLength: 1, maxLength: 128 },
            },
            captions: {
              type: "array",
              minItems: 1,
              maxItems: 5,
              items: { type: "string", minLength: 1, maxLength: 160 },
            },
            suggested_platforms: {
              type: "array",
              minItems: 1,
              maxItems: 4,
              items: { type: "string", enum: SOCIAL_REELS_PLATFORMS },
            },
            safety_notes: {
              anyOf: [{ type: "string", maxLength: 240 }, { type: "null" }],
            },
          },
        },
      },
      model_notes: {
        anyOf: [{ type: "string", maxLength: 1000 }, { type: "null" }],
      },
    },
  },
} as const;
