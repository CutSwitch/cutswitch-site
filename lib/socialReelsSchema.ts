import { z } from "zod";

export const SOCIAL_REELS_DURATION_BUCKETS = ["15s", "30s", "60s", "90s", "5-10m"] as const;
export const SOCIAL_REELS_REQUEST_DURATION_PACKS = [...SOCIAL_REELS_DURATION_BUCKETS, "mixed", "custom"] as const;
export const SOCIAL_REELS_DISCOVERY_MATRIX_STYLES = [
  "balanced",
  "hookFirst",
  "educational",
  "emotional",
  "funny",
  "story",
  "inspirational",
  "controversial",
] as const;
export const SOCIAL_REELS_DISCOVERY_MATRIX_DURATIONS = [...SOCIAL_REELS_DURATION_BUCKETS, "deepCut5To10m"] as const;
export const SOCIAL_REELS_DURATION_FIRST_TARGETS = ["15s", "30s", "60s", "90s", "5_to_10m"] as const;
export const SOCIAL_REELS_PLATFORMS = ["instagram_reels", "tiktok", "youtube_shorts", "social"] as const;
export const SOCIAL_REELS_STYLES = ["balanced", "educational", "funny", "dramatic", "promo", "story"] as const;
export const SOCIAL_REELS_LAYOUTS = ["vertical", "square", "horizontal"] as const;
export const SOCIAL_REELS_CAPTION_STYLES = ["none", "minimal", "bold", "karaoke", "subtitles"] as const;
export const SOCIAL_REELS_CLIP_TYPES = [
  "strong_opinion",
  "story_beat",
  "emotional_moment",
  "funny_moment",
  "useful_lesson",
  "contrarian_take",
  "quote_worthy_line",
  "debate_conflict",
  "transformation",
  "educational_explainer",
  "long_form_highlight",
] as const;
export const SOCIAL_REELS_VIRAL_ATOMS = [
  "question",
  "conflict",
  "contrarian_take",
  "personal_confession",
  "social_tension",
  "high_emotion",
  "clear_answer",
  "reframe",
  "practical_takeaway",
  "identity_trigger",
] as const;
export const SOCIAL_REELS_REJECTION_RISK_FLAGS = [
  "countdown_or_timer",
  "pre_show_chatter",
  "mic_check",
  "technical_setup",
  "sponsor_or_ad",
  "intro_outro_logistics",
  "weak_hook",
  "missing_payoff",
  "too_context_dependent",
  "generic_advice",
  "unclear_speaker",
  "sensitive_topic",
  "unsafe_or_policy_risk",
  "unsafe_or_sensitive",
  "low_editability",
] as const;
export const SOCIAL_REELS_CONTEXT_DEPENDENCIES = ["low", "medium", "high"] as const;
export const SOCIAL_REELS_SENSITIVITY_LEVELS = ["none", "sensitive_topic", "unsafe_or_policy_risk"] as const;
export const SOCIAL_REELS_EDIT_MODES = ["linear", "story_edit"] as const;
export const SOCIAL_REELS_COMPOSITION_TYPES = [
  "contiguous",
  "hook_reordered",
  "hook_setup_payoff",
  "question_answer",
  "callback",
  "mini_montage",
] as const;
export const SOCIAL_REELS_TIMELINE_SEGMENT_ROLES = [
  "cold_open_hook",
  "setup",
  "context",
  "evidence",
  "escalation",
  "payoff",
  "closing_button",
  "bridge",
] as const;
export const SOCIAL_REELS_CONTINUITY_RISKS = ["low", "medium", "high"] as const;

export const SOCIAL_REELS_MIN_CANDIDATES = 30;
export const SOCIAL_REELS_MIN_RESPONSE_CANDIDATES = 3;
export const SOCIAL_REELS_DEFAULT_CANDIDATES = 50;
export const SOCIAL_REELS_MAX_CANDIDATES = 80;
export const SOCIAL_REELS_DISCOVERY_MATRIX_MAX_PER_BUCKET_CAP = 20;
export const SOCIAL_REELS_DISCOVERY_MATRIX_DEFAULT_MAX_PER_BUCKET = 10;
export const SOCIAL_REELS_DISCOVERY_MATRIX_MAX_UNIQUE_MOMENTS_CAP = 80;
export const SOCIAL_REELS_DISCOVERY_MATRIX_DEFAULT_MAX_UNIQUE_MOMENTS = 50;
export const SOCIAL_REELS_MAX_SEGMENTS = 2000;
export const SOCIAL_REELS_MAX_SEGMENT_TEXT_CHARS = 2000;

const RAW_PATH_VALUE = /(^|[\s"'])(~\/|\/Users\/|[A-Za-z]:\\|file:\/\/|.*\\.*|.*\/.*)/;

function looksLikeRawPath(value: string) {
  return RAW_PATH_VALUE.test(value) || /\.fcpxml\b/i.test(value);
}

const safeOptionalText = (max: number) => z.string().trim().max(max).optional().nullable();
const safeOptionalIdArray = z.array(z.string().trim().min(1).max(128)).max(500).optional().nullable();
const safeOptionalSpeakerArray = z.array(z.string().trim().min(1).max(80)).max(24).optional().nullable();
const scoreSchema = z.number().min(0).max(1);
const socialReelsTitleOptionSchema = z.object({
  title: z.string().trim().min(1).max(120),
  score: scoreSchema,
});
const requestedCandidateCountSchema = z
  .number()
  .int()
  .min(1)
  .max(SOCIAL_REELS_MAX_CANDIDATES)
  .default(SOCIAL_REELS_DEFAULT_CANDIDATES);

function normalizeRequestedCandidateCount(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return SOCIAL_REELS_DEFAULT_CANDIDATES;
  return Math.min(SOCIAL_REELS_MAX_CANDIDATES, Math.max(SOCIAL_REELS_MIN_CANDIDATES, value));
}

function clampInteger(value: number | undefined, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function normalizeMatrixDuration(value: string) {
  const normalized = value.trim().replace(/[–—]/g, "-");
  if (normalized === "deepCut5To10m" || normalized === "5-10m" || normalized === "5 to 10m") return "5-10m";
  return normalized;
}

function durationFirstTargetToConcreteBucket(value: (typeof SOCIAL_REELS_DURATION_FIRST_TARGETS)[number]) {
  return value === "5_to_10m" ? "5-10m" : value;
}

const socialReelsDiscoveryMatrixDurationSchema = z.preprocess(
  (value) => (typeof value === "string" ? normalizeMatrixDuration(value) : value),
  z.enum(SOCIAL_REELS_DURATION_BUCKETS)
);

export const socialReelsDiscoveryMatrixTargetSchema = z.object({
  target_id: safeOptionalText(120),
  style: z.enum(SOCIAL_REELS_DISCOVERY_MATRIX_STYLES),
  duration: socialReelsDiscoveryMatrixDurationSchema,
  max_candidates: z.number().int().min(1).max(SOCIAL_REELS_DISCOVERY_MATRIX_MAX_PER_BUCKET_CAP).optional().nullable(),
});

export const socialReelsDurationFirstBucketRequestSchema = z.object({
  duration_target: z.enum(SOCIAL_REELS_DURATION_FIRST_TARGETS),
  max_candidates: z.number().int().min(1).max(SOCIAL_REELS_DISCOVERY_MATRIX_MAX_PER_BUCKET_CAP).optional().nullable(),
});

const socialReelsDurationFirstLimitsSchema = z
  .object({
    max_per_duration_bucket: z.number().int().min(1).max(SOCIAL_REELS_DISCOVERY_MATRIX_MAX_PER_BUCKET_CAP).optional().nullable(),
    max_unique_moments: z.number().int().min(1).max(120).optional().nullable(),
    max_total_bucket_memberships: z.number().int().min(1).max(240).optional().nullable(),
    dedupe_shared_moments: z.boolean().optional().nullable(),
    return_fewer_if_weak: z.boolean().optional().nullable(),
  })
  .optional()
  .default({});

function normalizeDurationFirstBuckets(
  buckets: Array<z.input<typeof socialReelsDurationFirstBucketRequestSchema>> | undefined
) {
  const parsedBuckets = (buckets ?? [])
    .map((bucket) => socialReelsDurationFirstBucketRequestSchema.safeParse(bucket))
    .filter((result): result is z.SafeParseSuccess<z.infer<typeof socialReelsDurationFirstBucketRequestSchema>> => result.success)
    .map((result) => result.data);
  const seen = new Set<string>();
  const normalized: Array<z.infer<typeof socialReelsDurationFirstBucketRequestSchema>> = [];

  for (const bucket of parsedBuckets) {
    if (seen.has(bucket.duration_target)) continue;
    seen.add(bucket.duration_target);
    normalized.push(bucket);
  }

  return normalized;
}

function normalizeDiscoveryMatrixTargets(
  targets: Array<z.input<typeof socialReelsDiscoveryMatrixTargetSchema>> | undefined
) {
  const parsedTargets = (targets ?? [])
    .map((target) => socialReelsDiscoveryMatrixTargetSchema.safeParse(target))
    .filter((result): result is z.SafeParseSuccess<z.infer<typeof socialReelsDiscoveryMatrixTargetSchema>> => result.success)
    .map((result) => result.data);
  const seen = new Set<string>();
  const normalized: Array<z.infer<typeof socialReelsDiscoveryMatrixTargetSchema>> = [];

  for (const target of parsedTargets) {
    const key = `${target.style}:${target.duration}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(target);
  }

  return normalized;
}

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
    start_timecode: safeOptionalText(32),
    end_timecode: safeOptionalText(32),
    speaker: safeOptionalText(80),
    speakers: safeOptionalSpeakerArray,
    utterance_ids: safeOptionalIdArray,
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
    speakers: segment.speakers ?? (segment.speaker ? [segment.speaker] : []),
    utterance_ids: segment.utterance_ids ?? [],
  }));

const socialReelsRawTranscriptUtteranceSchema = z
  .object({
    id: z.string().trim().min(1).max(128).optional(),
    utterance_id: z.string().trim().min(1).max(128).optional(),
    start_seconds: z.number().finite().min(0).max(24 * 60 * 60),
    end_seconds: z.number().finite().min(0).max(24 * 60 * 60),
    start_timecode: safeOptionalText(32),
    end_timecode: safeOptionalText(32),
    speaker_label: safeOptionalText(80),
    speaker: safeOptionalText(80),
    text: z.string().trim().min(1).max(SOCIAL_REELS_MAX_SEGMENT_TEXT_CHARS),
  })
  .superRefine((utterance, ctx) => {
    if (!utterance.id && !utterance.utterance_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["utterance_id"],
        message: "utterance_id is required.",
      });
    }

    if (utterance.end_seconds <= utterance.start_seconds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end_seconds"],
        message: "end_seconds must be greater than start_seconds.",
      });
    }
  });

export const socialReelsTranscriptUtteranceSchema = socialReelsRawTranscriptUtteranceSchema
  .transform((utterance) => {
    const id = utterance.id ?? utterance.utterance_id ?? "";
    const speakerLabel = utterance.speaker_label ?? utterance.speaker ?? null;

    return {
      ...utterance,
      id,
      utterance_id: id,
      speaker_label: speakerLabel,
      speaker: utterance.speaker ?? speakerLabel,
    };
  });

function maxEndSeconds(
  timedItems: Array<{ end_seconds: number }>,
  fallback = 1
) {
  if (timedItems.length === 0) return fallback;
  return Math.max(fallback, ...timedItems.map((item) => Math.ceil(item.end_seconds)));
}

function segmentsFromUtterances(utterances: Array<z.infer<typeof socialReelsTranscriptUtteranceSchema>>) {
  return utterances.map((utterance) => ({
    id: utterance.id,
    segment_id: utterance.id,
    start_seconds: utterance.start_seconds,
    end_seconds: utterance.end_seconds,
    start_timecode: utterance.start_timecode,
    end_timecode: utterance.end_timecode,
    speaker: utterance.speaker_label,
    speakers: utterance.speaker_label ? [utterance.speaker_label] : [],
    utterance_ids: [utterance.id],
    text: utterance.text,
  }));
}

export const socialReelsRequestSchema = z
  .object({
    project_hash: z.string().trim().min(1).max(512),
    project_fingerprint: z.string().trim().min(1).max(512).optional().nullable(),
    source_duration_seconds: z.number().int().min(1).max(24 * 60 * 60).optional(),
    project_duration_seconds: z.number().finite().min(1).max(24 * 60 * 60).optional(),
    duration_preferences: z.array(z.enum(SOCIAL_REELS_REQUEST_DURATION_PACKS)).min(1).max(SOCIAL_REELS_REQUEST_DURATION_PACKS.length).optional(),
    duration_bucket: z.enum(SOCIAL_REELS_REQUEST_DURATION_PACKS).optional(),
    requested_candidate_count: requestedCandidateCountSchema.optional(),
    candidate_count: requestedCandidateCountSchema.optional(),
    requested_duration_buckets: z.array(socialReelsDurationFirstBucketRequestSchema).max(SOCIAL_REELS_DURATION_FIRST_TARGETS.length).optional().default([]),
    limits: socialReelsDurationFirstLimitsSchema,
    requested_targets: z.array(socialReelsDiscoveryMatrixTargetSchema).max(80).optional().default([]),
    max_per_bucket: z.number().int().min(1).max(100).optional(),
    max_unique_moments: z.number().int().min(1).max(1000).optional(),
    dedupe_shared_moments: z.boolean().optional(),
    custom_duration_seconds: socialReelsCustomDurationSchema.optional().nullable(),
    style: z.enum(SOCIAL_REELS_STYLES).or(z.string().trim().min(1).max(80)).optional().default("balanced"),
    layout: z.enum(SOCIAL_REELS_LAYOUTS).or(z.string().trim().min(1).max(80)).optional().default("vertical"),
    caption_style: z.enum(SOCIAL_REELS_CAPTION_STYLES).or(z.string().trim().min(1).max(80)).optional().default("bold"),
    episode_metadata: z
      .object({
        title: safeOptionalText(160),
        show_name: safeOptionalText(120),
        episode_number: safeOptionalText(80),
        published_at: safeOptionalText(80),
        guest_names: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
      })
      .passthrough()
      .optional()
      .default({}),
    metadata: z.record(z.unknown()).optional().nullable(),
    utterances: z.array(socialReelsTranscriptUtteranceSchema).max(SOCIAL_REELS_MAX_SEGMENTS).optional().default([]),
    segments: z.array(socialReelsTranscriptSegmentSchema).max(SOCIAL_REELS_MAX_SEGMENTS).optional().default([]),
    context: z
      .object({
        platform: z.enum(SOCIAL_REELS_PLATFORMS).optional().default("social"),
        show_name: safeOptionalText(120),
        content_notes: safeOptionalText(1000),
      })
      .optional()
      .default({}),
  })
  .transform((payload) => {
    const utterances = payload.utterances ?? [];
    const segments = payload.segments && payload.segments.length > 0 ? payload.segments : segmentsFromUtterances(utterances);
    const requestedTargets = normalizeDiscoveryMatrixTargets(payload.requested_targets);
    const requestedDurationBuckets = normalizeDurationFirstBuckets(payload.requested_duration_buckets);
    const targetDurations = requestedTargets.map((target) => target.duration);
    const durationFirstDurations = requestedDurationBuckets.map((bucket) => durationFirstTargetToConcreteBucket(bucket.duration_target));
    const durationPreferences =
      payload.duration_preferences && payload.duration_preferences.length > 0
        ? payload.duration_preferences
        : durationFirstDurations.length > 0
          ? [...new Set(durationFirstDurations)]
        : targetDurations.length > 0
          ? [...new Set(targetDurations)]
          : [];
    const maxPerBucket = clampInteger(
      payload.max_per_bucket,
      SOCIAL_REELS_DISCOVERY_MATRIX_DEFAULT_MAX_PER_BUCKET,
      1,
      SOCIAL_REELS_DISCOVERY_MATRIX_MAX_PER_BUCKET_CAP
    );
    const maxUniqueMoments = clampInteger(
      payload.max_unique_moments ?? payload.limits?.max_unique_moments ?? undefined,
      SOCIAL_REELS_DISCOVERY_MATRIX_DEFAULT_MAX_UNIQUE_MOMENTS,
      1,
      SOCIAL_REELS_DISCOVERY_MATRIX_MAX_UNIQUE_MOMENTS_CAP
    );
    const durationFirstMaxUniqueMoments = clampInteger(
      payload.limits?.max_unique_moments ?? payload.max_unique_moments ?? undefined,
      120,
      1,
      120
    );
    const maxPerDurationBucket = clampInteger(
      payload.limits?.max_per_duration_bucket ?? undefined,
      SOCIAL_REELS_DISCOVERY_MATRIX_MAX_PER_BUCKET_CAP,
      1,
      SOCIAL_REELS_DISCOVERY_MATRIX_MAX_PER_BUCKET_CAP
    );
    const maxTotalBucketMemberships = clampInteger(
      payload.limits?.max_total_bucket_memberships ?? undefined,
      240,
      1,
      240
    );

    const projectDurationSeconds =
      typeof payload.project_duration_seconds === "number" ? Math.ceil(payload.project_duration_seconds) : undefined;

    return {
      ...payload,
      utterances,
      segments,
      duration_preferences: durationPreferences,
      project_fingerprint: payload.project_fingerprint ?? payload.project_hash,
      source_duration_seconds:
        payload.source_duration_seconds ??
        projectDurationSeconds ??
        maxEndSeconds([...segments, ...utterances]),
      duration_bucket: payload.duration_bucket ?? durationPreferences[0],
      requested_candidate_count: normalizeRequestedCandidateCount(payload.requested_candidate_count ?? payload.candidate_count),
      requested_duration_buckets: requestedDurationBuckets,
      limits: payload.limits ?? {},
      requested_targets: requestedTargets,
      max_per_bucket: maxPerBucket,
      max_unique_moments: maxUniqueMoments,
      dedupe_shared_moments:
        payload.dedupe_shared_moments ??
        payload.limits?.dedupe_shared_moments ??
        (requestedTargets.length > 0 || requestedDurationBuckets.length > 0),
      discovery_matrix:
        requestedTargets.length > 0
          ? {
              requested_targets: requestedTargets,
              max_per_bucket: maxPerBucket,
              max_unique_moments: maxUniqueMoments,
              dedupe_shared_moments: payload.dedupe_shared_moments ?? true,
            }
          : null,
      duration_first_manifest:
        requestedDurationBuckets.length > 0
          ? {
              requested_duration_buckets: requestedDurationBuckets.map((bucket) => ({
                ...bucket,
                max_candidates: clampInteger(
                  bucket.max_candidates ?? payload.limits?.max_per_duration_bucket ?? undefined,
                  maxPerDurationBucket,
                  1,
                  SOCIAL_REELS_DISCOVERY_MATRIX_MAX_PER_BUCKET_CAP
                ),
              })),
              max_per_duration_bucket: maxPerDurationBucket,
              max_unique_moments: durationFirstMaxUniqueMoments,
              max_total_bucket_memberships: maxTotalBucketMemberships,
              dedupe_shared_moments: payload.limits?.dedupe_shared_moments ?? payload.dedupe_shared_moments ?? true,
              return_fewer_if_weak: payload.limits?.return_fewer_if_weak ?? true,
            }
          : null,
    };
  })
  .superRefine((payload, ctx) => {
    if (payload.duration_preferences.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["duration_preferences"],
        message: "duration_preferences or requested_targets are required.",
      });
    }

    if (payload.segments.length === 0 && payload.utterances.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["utterances"],
        message: "segments or utterances are required.",
      });
    }

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

    if (
      payload.utterances.length === 0 &&
      payload.segments.length > 0 &&
      payload.segments.every((segment) => segment.start_seconds === 0 && segment.end_seconds === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["segments"],
        message: "segments must include real timing or use utterances as timing source.",
      });
    }
  });


export const socialReelsTimelineSegmentSchema = z
  .object({
    segment_id: z.string().trim().min(1).max(128),
    role: z.enum(SOCIAL_REELS_TIMELINE_SEGMENT_ROLES),
    source_start_seconds: z.number().finite().min(0).max(24 * 60 * 60),
    source_end_seconds: z.number().finite().min(0).max(24 * 60 * 60),
    source_start_timecode: z.string().trim().max(32).nullable(),
    source_end_timecode: z.string().trim().max(32).nullable(),
    utterance_ids: z.array(z.string().trim().min(1).max(128)).min(1).max(80),
    speaker_labels: z.array(z.string().trim().min(1).max(80)).min(1).max(24),
    transcript_excerpt: z.string().trim().min(1).max(360),
    reason_for_placement: z.string().trim().min(1).max(360),
  })
  .superRefine((segment, ctx) => {
    if (segment.source_end_seconds <= segment.source_start_seconds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["source_end_seconds"],
        message: "source_end_seconds must be greater than source_start_seconds.",
      });
    }
  });

export const socialReelsCandidateSchema = z
  .object({
    candidate_id: z.string().trim().min(1).max(80),
    title: z.string().trim().min(1).max(120),
    hook: z.string().trim().min(1).max(240),
    summary: z.string().trim().min(1).max(500),
    start_anchor_quote: z.string().trim().min(20).max(240),
    end_anchor_quote: z.string().trim().min(20).max(240),
    clip_type: z.enum(SOCIAL_REELS_CLIP_TYPES),
    topic_tag: z.string().trim().min(1).max(80),
    hook_title: z.string().trim().min(1).max(120),
    subtitle_intro: z.string().trim().min(1).max(160),
    social_caption: z.string().trim().min(1).max(280),
    why_it_works: z.string().trim().min(1).max(500),
    edit_mode: z.enum(SOCIAL_REELS_EDIT_MODES).optional().default("linear"),
    composition_type: z.enum(SOCIAL_REELS_COMPOSITION_TYPES).optional().default("contiguous"),
    timeline_segments: z.array(socialReelsTimelineSegmentSchema).max(4).optional().default([]),
    display_title: safeOptionalText(120),
    display_teaser: safeOptionalText(240),
    opening_hook: safeOptionalText(240),
    closing_line: safeOptionalText(240),
    coherence_score: scoreSchema.optional().nullable(),
    continuity_risk: z.enum(SOCIAL_REELS_CONTINUITY_RISKS).optional().nullable(),
    edit_decision_rationale: safeOptionalText(500),
    review_flags: z.array(z.enum(SOCIAL_REELS_REJECTION_RISK_FLAGS)).max(SOCIAL_REELS_REJECTION_RISK_FLAGS.length).optional().default([]),
    viral_atoms: z.array(z.enum(SOCIAL_REELS_VIRAL_ATOMS)).max(SOCIAL_REELS_VIRAL_ATOMS.length).optional().nullable(),
    core_question: safeOptionalText(240),
    conflict: safeOptionalText(240),
    payoff: safeOptionalText(240),
    title_options: z.array(socialReelsTitleOptionSchema).max(5).optional().nullable(),
    title_score: scoreSchema.optional().nullable(),
    edit_feasibility_score: scoreSchema.optional().nullable(),
    risk_penalty: scoreSchema.optional().nullable(),
    context_dependency: z.enum(SOCIAL_REELS_CONTEXT_DEPENDENCIES).optional().nullable(),
    sensitivity_level: z.enum(SOCIAL_REELS_SENSITIVITY_LEVELS).optional().nullable(),
    rejection_risk_flags: z.array(z.enum(SOCIAL_REELS_REJECTION_RISK_FLAGS)).max(SOCIAL_REELS_REJECTION_RISK_FLAGS.length),
    risk_flags: z.array(z.enum(SOCIAL_REELS_REJECTION_RISK_FLAGS)).max(SOCIAL_REELS_REJECTION_RISK_FLAGS.length),
    duration_bucket: z.enum(SOCIAL_REELS_DURATION_BUCKETS),
    start_seconds: z.number().finite().min(0).max(24 * 60 * 60),
    end_seconds: z.number().finite().min(0).max(24 * 60 * 60),
    duration_seconds: z.number().int().min(5).max(10 * 60),
    score: scoreSchema,
    scores: z.object({
      hook_strength: scoreSchema,
      standalone_clarity: scoreSchema,
      payoff_strength: scoreSchema,
      emotional_charge: scoreSchema,
      novelty: scoreSchema,
      editability: scoreSchema,
      shareability: scoreSchema,
      context_independence: scoreSchema,
      overall: scoreSchema,
    }),
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

    if (candidate.edit_mode === "story_edit") {
      if (candidate.timeline_segments.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["timeline_segments"],
          message: "story_edit candidates must include at least two timeline_segments.",
        });
      }

      if (candidate.composition_type === "contiguous") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["composition_type"],
          message: "story_edit candidates must use a non-contiguous composition_type.",
        });
      }
    }

    const actualDuration =
      candidate.timeline_segments.length > 0
        ? Math.round(
            candidate.timeline_segments.reduce(
              (total, segment) => total + (segment.source_end_seconds - segment.source_start_seconds),
              0
            )
          )
        : Math.round(candidate.end_seconds - candidate.start_seconds);
    if (Math.abs(actualDuration - candidate.duration_seconds) > 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["duration_seconds"],
        message: "duration_seconds must match source duration or timeline segment duration.",
      });
    }
  });

export const socialReelsResponseSchema = z.object({
  candidates: z.array(socialReelsCandidateSchema).min(SOCIAL_REELS_MIN_RESPONSE_CANDIDATES).max(SOCIAL_REELS_MAX_CANDIDATES),
  model_notes: z.string().trim().max(1000).nullable(),
});

export const socialReelsDiscoveryMatrixMomentBucketSchema = z.object({
  style: z.enum(SOCIAL_REELS_DISCOVERY_MATRIX_STYLES),
  duration: z.enum(SOCIAL_REELS_DURATION_BUCKETS),
  rank: z.number().int().min(1).max(SOCIAL_REELS_DISCOVERY_MATRIX_MAX_PER_BUCKET_CAP),
  bucket_score: scoreSchema,
  why_it_fits: z.string().trim().min(1).max(360),
});

export const socialReelsDiscoveryMatrixMomentSchema = z
  .object({
    moment_id: z.string().trim().min(1).max(100),
    start_seconds: z.number().finite().min(0).max(24 * 60 * 60),
    end_seconds: z.number().finite().min(0).max(24 * 60 * 60),
    start_timecode: z.string().trim().max(32).nullable(),
    end_timecode: z.string().trim().max(32).nullable(),
    speakers: z.array(z.string().trim().min(1).max(80)).min(1).max(24),
    title: z.string().trim().min(1).max(120),
    summary: z.string().trim().min(1).max(500),
    raw_score: scoreSchema,
    buckets: z.array(socialReelsDiscoveryMatrixMomentBucketSchema).min(1).max(80),
    review_flags: z.array(z.enum(SOCIAL_REELS_REJECTION_RISK_FLAGS)).max(SOCIAL_REELS_REJECTION_RISK_FLAGS.length),
  })
  .superRefine((moment, ctx) => {
    if (moment.end_seconds <= moment.start_seconds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end_seconds"],
        message: "end_seconds must be greater than start_seconds.",
      });
    }
  });

export const socialReelsDiscoveryMatrixBucketSchema = z.object({
  style: z.enum(SOCIAL_REELS_DISCOVERY_MATRIX_STYLES),
  duration: z.enum(SOCIAL_REELS_DURATION_BUCKETS),
  moment_ids: z.array(z.string().trim().min(1).max(100)).max(SOCIAL_REELS_DISCOVERY_MATRIX_MAX_UNIQUE_MOMENTS_CAP),
});

export const socialReelsDiscoveryMatrixResponseSchema = z.object({
  moments: z.array(socialReelsDiscoveryMatrixMomentSchema).max(SOCIAL_REELS_DISCOVERY_MATRIX_MAX_UNIQUE_MOMENTS_CAP),
  buckets: z.array(socialReelsDiscoveryMatrixBucketSchema).max(80),
  model_notes: z.string().trim().max(1000).nullable(),
});

export type SocialReelsRequest = z.infer<typeof socialReelsRequestSchema>;
export type SocialReelsTranscriptSegment = z.infer<typeof socialReelsTranscriptSegmentSchema>;
export type SocialReelsTranscriptUtterance = z.infer<typeof socialReelsTranscriptUtteranceSchema>;
export type SocialReelsTimelineSegment = z.infer<typeof socialReelsTimelineSegmentSchema>;
export type SocialReelsCandidate = z.infer<typeof socialReelsCandidateSchema>;
export type SocialReelsResponse = z.infer<typeof socialReelsResponseSchema>;
export type SocialReelsDiscoveryMatrixTarget = z.infer<typeof socialReelsDiscoveryMatrixTargetSchema>;
export type SocialReelsDiscoveryMatrixResponse = z.infer<typeof socialReelsDiscoveryMatrixResponseSchema>;

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
            "start_anchor_quote",
            "end_anchor_quote",
            "clip_type",
            "topic_tag",
            "hook_title",
            "subtitle_intro",
            "social_caption",
            "why_it_works",
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
            "viral_atoms",
            "core_question",
            "conflict",
            "payoff",
            "title_options",
            "title_score",
            "edit_feasibility_score",
            "risk_penalty",
            "rejection_risk_flags",
            "risk_flags",
            "duration_bucket",
            "start_seconds",
            "end_seconds",
            "duration_seconds",
            "score",
            "scores",
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
            start_anchor_quote: { type: "string", minLength: 20, maxLength: 240 },
            end_anchor_quote: { type: "string", minLength: 20, maxLength: 240 },
            clip_type: { type: "string", enum: SOCIAL_REELS_CLIP_TYPES },
            topic_tag: { type: "string", minLength: 1, maxLength: 80 },
            hook_title: { type: "string", minLength: 1, maxLength: 120 },
            subtitle_intro: { type: "string", minLength: 1, maxLength: 160 },
            social_caption: { type: "string", minLength: 1, maxLength: 280 },
            why_it_works: { type: "string", minLength: 1, maxLength: 500 },
            edit_mode: { type: "string", enum: SOCIAL_REELS_EDIT_MODES },
            composition_type: { type: "string", enum: SOCIAL_REELS_COMPOSITION_TYPES },
            timeline_segments: {
              type: "array",
              maxItems: 4,
              items: {
                type: "object",
                additionalProperties: false,
                required: [
                  "segment_id",
                  "role",
                  "source_start_seconds",
                  "source_end_seconds",
                  "source_start_timecode",
                  "source_end_timecode",
                  "utterance_ids",
                  "speaker_labels",
                  "transcript_excerpt",
                  "reason_for_placement",
                ],
                properties: {
                  segment_id: { type: "string", minLength: 1, maxLength: 128 },
                  role: { type: "string", enum: SOCIAL_REELS_TIMELINE_SEGMENT_ROLES },
                  source_start_seconds: { type: "number", minimum: 0, maximum: 86400 },
                  source_end_seconds: { type: "number", minimum: 0, maximum: 86400 },
                  source_start_timecode: { anyOf: [{ type: "string", maxLength: 32 }, { type: "null" }] },
                  source_end_timecode: { anyOf: [{ type: "string", maxLength: 32 }, { type: "null" }] },
                  utterance_ids: {
                    type: "array",
                    minItems: 1,
                    maxItems: 80,
                    items: { type: "string", minLength: 1, maxLength: 128 },
                  },
                  speaker_labels: {
                    type: "array",
                    minItems: 1,
                    maxItems: 24,
                    items: { type: "string", minLength: 1, maxLength: 80 },
                  },
                  transcript_excerpt: { type: "string", minLength: 1, maxLength: 360 },
                  reason_for_placement: { type: "string", minLength: 1, maxLength: 360 },
                },
              },
            },
            display_title: { anyOf: [{ type: "string", maxLength: 120 }, { type: "null" }] },
            display_teaser: { anyOf: [{ type: "string", maxLength: 240 }, { type: "null" }] },
            opening_hook: { anyOf: [{ type: "string", maxLength: 240 }, { type: "null" }] },
            closing_line: { anyOf: [{ type: "string", maxLength: 240 }, { type: "null" }] },
            coherence_score: { anyOf: [{ type: "number", minimum: 0, maximum: 1 }, { type: "null" }] },
            continuity_risk: { anyOf: [{ type: "string", enum: SOCIAL_REELS_CONTINUITY_RISKS }, { type: "null" }] },
            edit_decision_rationale: { anyOf: [{ type: "string", maxLength: 500 }, { type: "null" }] },
            review_flags: {
              type: "array",
              maxItems: SOCIAL_REELS_REJECTION_RISK_FLAGS.length,
              items: { type: "string", enum: SOCIAL_REELS_REJECTION_RISK_FLAGS },
            },
            viral_atoms: {
              type: "array",
              maxItems: SOCIAL_REELS_VIRAL_ATOMS.length,
              items: { type: "string", enum: SOCIAL_REELS_VIRAL_ATOMS },
            },
            core_question: { type: "string", maxLength: 240 },
            conflict: { type: "string", maxLength: 240 },
            payoff: { type: "string", maxLength: 240 },
            title_options: {
              type: "array",
              minItems: 1,
              maxItems: 5,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["title", "score"],
                properties: {
                  title: { type: "string", minLength: 1, maxLength: 120 },
                  score: { type: "number", minimum: 0, maximum: 1 },
                },
              },
            },
            title_score: { type: "number", minimum: 0, maximum: 1 },
            edit_feasibility_score: { type: "number", minimum: 0, maximum: 1 },
            risk_penalty: { type: "number", minimum: 0, maximum: 1 },
            rejection_risk_flags: {
              type: "array",
              maxItems: SOCIAL_REELS_REJECTION_RISK_FLAGS.length,
              items: { type: "string", enum: SOCIAL_REELS_REJECTION_RISK_FLAGS },
            },
            risk_flags: {
              type: "array",
              maxItems: SOCIAL_REELS_REJECTION_RISK_FLAGS.length,
              items: { type: "string", enum: SOCIAL_REELS_REJECTION_RISK_FLAGS },
            },
            duration_bucket: { type: "string", enum: SOCIAL_REELS_DURATION_BUCKETS },
            start_seconds: { type: "number", minimum: 0, maximum: 86400 },
            end_seconds: { type: "number", minimum: 0, maximum: 86400 },
            duration_seconds: { type: "integer", minimum: 5, maximum: 600 },
            score: { type: "number", minimum: 0, maximum: 1 },
            scores: {
              type: "object",
              additionalProperties: false,
              required: [
                "hook_strength",
                "standalone_clarity",
                "payoff_strength",
                "emotional_charge",
                "novelty",
                "editability",
                "shareability",
                "context_independence",
                "overall",
              ],
              properties: {
                hook_strength: { type: "number", minimum: 0, maximum: 1 },
                standalone_clarity: { type: "number", minimum: 0, maximum: 1 },
                payoff_strength: { type: "number", minimum: 0, maximum: 1 },
                emotional_charge: { type: "number", minimum: 0, maximum: 1 },
                novelty: { type: "number", minimum: 0, maximum: 1 },
                editability: { type: "number", minimum: 0, maximum: 1 },
                shareability: { type: "number", minimum: 0, maximum: 1 },
                context_independence: { type: "number", minimum: 0, maximum: 1 },
                overall: { type: "number", minimum: 0, maximum: 1 },
              },
            },
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

export function openAISocialReelsDiscoveryMatrixResponseFormat(maxUniqueMoments: number, maxPerBucket: number) {
  const boundedMaxUniqueMoments = Math.min(
    SOCIAL_REELS_DISCOVERY_MATRIX_MAX_UNIQUE_MOMENTS_CAP,
    Math.max(1, Math.round(maxUniqueMoments))
  );
  const boundedMaxPerBucket = Math.min(
    SOCIAL_REELS_DISCOVERY_MATRIX_MAX_PER_BUCKET_CAP,
    Math.max(1, Math.round(maxPerBucket))
  );

  return {
    type: "json_schema",
    name: "social_reels_discovery_matrix",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["moments", "buckets", "model_notes"],
      properties: {
        moments: {
          type: "array",
          maxItems: boundedMaxUniqueMoments,
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "moment_id",
              "start_seconds",
              "end_seconds",
              "start_timecode",
              "end_timecode",
              "speakers",
              "title",
              "summary",
              "raw_score",
              "buckets",
              "review_flags",
            ],
            properties: {
              moment_id: { type: "string", minLength: 1, maxLength: 100 },
              start_seconds: { type: "number", minimum: 0, maximum: 86400 },
              end_seconds: { type: "number", minimum: 0, maximum: 86400 },
              start_timecode: { anyOf: [{ type: "string", maxLength: 32 }, { type: "null" }] },
              end_timecode: { anyOf: [{ type: "string", maxLength: 32 }, { type: "null" }] },
              speakers: {
                type: "array",
                minItems: 1,
                maxItems: 24,
                items: { type: "string", minLength: 1, maxLength: 80 },
              },
              title: { type: "string", minLength: 1, maxLength: 120 },
              summary: { type: "string", minLength: 1, maxLength: 500 },
              raw_score: { type: "number", minimum: 0, maximum: 1 },
              buckets: {
                type: "array",
                minItems: 1,
                maxItems: 80,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["style", "duration", "rank", "bucket_score", "why_it_fits"],
                  properties: {
                    style: { type: "string", enum: SOCIAL_REELS_DISCOVERY_MATRIX_STYLES },
                    duration: { type: "string", enum: SOCIAL_REELS_DURATION_BUCKETS },
                    rank: { type: "integer", minimum: 1, maximum: boundedMaxPerBucket },
                    bucket_score: { type: "number", minimum: 0, maximum: 1 },
                    why_it_fits: { type: "string", minLength: 1, maxLength: 360 },
                  },
                },
              },
              review_flags: {
                type: "array",
                maxItems: SOCIAL_REELS_REJECTION_RISK_FLAGS.length,
                items: { type: "string", enum: SOCIAL_REELS_REJECTION_RISK_FLAGS },
              },
            },
          },
        },
        buckets: {
          type: "array",
          maxItems: 80,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["style", "duration", "moment_ids"],
            properties: {
              style: { type: "string", enum: SOCIAL_REELS_DISCOVERY_MATRIX_STYLES },
              duration: { type: "string", enum: SOCIAL_REELS_DURATION_BUCKETS },
              moment_ids: {
                type: "array",
                maxItems: boundedMaxPerBucket,
                items: { type: "string", minLength: 1, maxLength: 100 },
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
}
