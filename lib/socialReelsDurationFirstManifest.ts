import { z } from "zod";

import {
  SOCIAL_REELS_COMPOSITION_TYPES,
  SOCIAL_REELS_EDIT_MODES,
  SOCIAL_REELS_TIMELINE_SEGMENT_ROLES,
} from "./socialReelsSchema";

export const SOCIAL_REELS_DURATION_FIRST_SCHEMA_VERSION =
  "cutswitch.social_reels.duration_first_manifest.v1";
export const SOCIAL_REELS_DURATION_FIRST_TARGETS = [
  "15s",
  "30s",
  "60s",
  "90s",
  "5_to_10m",
] as const;
export const SOCIAL_REELS_DURATION_FIRST_FUTURE_TARGETS = [
  "10_to_20m",
  "custom_long",
] as const;
export const SOCIAL_REELS_DURATION_FIRST_GENERATED_TAGS = [
  "strong_hook",
  "hook_first",
  "emotional",
  "educational",
  "funny",
  "controversial",
  "story",
  "inspirational",
  "practical_tip",
  "quoteable",
  "vulnerable",
  "contrarian",
  "high_energy",
  "deep_insight",
  "client_review",
  "long_clip",
] as const;

export const SOCIAL_REELS_DURATION_FIRST_MAX_PER_BUCKET = 20;
export const SOCIAL_REELS_DURATION_FIRST_MAX_UNIQUE_MOMENTS = 120;
export const SOCIAL_REELS_DURATION_FIRST_MAX_TOTAL_BUCKET_MEMBERSHIPS = 240;

const safeId = z.string().trim().min(1).max(160);
const safeText = (max: number) => z.string().trim().min(1).max(max);
const nullableSafeText = (max: number) => z.string().trim().max(max).nullable();
const manifestScoreSchema = z.number().finite().min(0).max(100);
const RAW_PATH_VALUE = /(^|[\s"'])(~\/|\/Users\/|[A-Za-z]:\\|file:\/\/|.*\\.*)/;

function looksLikeRawPath(value: string | null | undefined) {
  return Boolean(
    value && (RAW_PATH_VALUE.test(value) || /\.fcpxml\b/i.test(value)),
  );
}

export const socialReelsDurationFirstTargetSchema = z.enum(
  SOCIAL_REELS_DURATION_FIRST_TARGETS,
);
export const socialReelsDurationFirstGeneratedTagSchema = z.enum(
  SOCIAL_REELS_DURATION_FIRST_GENERATED_TAGS,
);

export const socialReelsDurationFirstGenerationSummarySchema = z.object({
  max_per_duration_bucket: z
    .number()
    .int()
    .min(1)
    .max(SOCIAL_REELS_DURATION_FIRST_MAX_PER_BUCKET),
  max_unique_moments: z
    .number()
    .int()
    .min(1)
    .max(SOCIAL_REELS_DURATION_FIRST_MAX_UNIQUE_MOMENTS),
  max_total_bucket_memberships: z
    .number()
    .int()
    .min(1)
    .max(SOCIAL_REELS_DURATION_FIRST_MAX_TOTAL_BUCKET_MEMBERSHIPS),
  dedupe_shared_moments: z.boolean(),
  return_fewer_if_weak: z.boolean(),
  selected_duration_targets: z
    .array(socialReelsDurationFirstTargetSchema)
    .min(1)
    .max(SOCIAL_REELS_DURATION_FIRST_TARGETS.length),
  generated_at: z.string().trim().max(80).nullable().optional(),
  provider: z.string().trim().max(80).nullable().optional(),
  model: z.string().trim().max(120).nullable().optional(),
});

export const socialReelsDurationFirstBucketSchema = z.object({
  bucket_id: safeId,
  duration_target: socialReelsDurationFirstTargetSchema,
  requested_max_candidates: z
    .number()
    .int()
    .min(1)
    .max(SOCIAL_REELS_DURATION_FIRST_MAX_PER_BUCKET),
  returned_moment_ids: z
    .array(safeId)
    .max(SOCIAL_REELS_DURATION_FIRST_MAX_PER_BUCKET),
  insufficient_reason: z.string().trim().max(240).nullable(),
});

export const socialReelsDurationFirstMembershipSchema = z.object({
  bucket_id: safeId,
  duration_target: socialReelsDurationFirstTargetSchema,
  rank: z.number().int().min(1).max(SOCIAL_REELS_DURATION_FIRST_MAX_PER_BUCKET),
  bucket_score: manifestScoreSchema,
  why_it_fits: safeText(360),
});

export const socialReelsDurationFirstTimelineSegmentSchema = z
  .object({
    segment_id: safeId,
    role: z.enum(SOCIAL_REELS_TIMELINE_SEGMENT_ROLES),
    source_start_seconds: z
      .number()
      .finite()
      .min(0)
      .max(24 * 60 * 60),
    source_end_seconds: z
      .number()
      .finite()
      .min(0)
      .max(24 * 60 * 60),
    source_start_timecode: nullableSafeText(32),
    source_end_timecode: nullableSafeText(32),
    utterance_ids: z.array(safeId).min(1).max(80),
    word_start_id: safeId.nullable().optional(),
    word_end_id: safeId.nullable().optional(),
    speaker_labels: z.array(z.string().trim().min(1).max(80)).min(1).max(24),
    reason_for_placement: safeText(360),
  })
  .superRefine((segment, ctx) => {
    if (segment.source_end_seconds <= segment.source_start_seconds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["source_end_seconds"],
        message:
          "source_end_seconds must be greater than source_start_seconds.",
      });
    }
  });

export const socialReelsDurationFirstMomentSchema = z
  .object({
    moment_id: safeId,
    edit_mode: z.enum(SOCIAL_REELS_EDIT_MODES),
    composition_type: z.enum(SOCIAL_REELS_COMPOSITION_TYPES),
    display_title: safeText(120),
    display_teaser: safeText(240),
    opening_hook: safeText(240),
    closing_line: safeText(240),
    score: manifestScoreSchema,
    duration_seconds: z
      .number()
      .finite()
      .min(5)
      .max(20 * 60),
    duration_bucket_memberships: z
      .array(socialReelsDurationFirstMembershipSchema)
      .min(1)
      .max(SOCIAL_REELS_DURATION_FIRST_TARGETS.length),
    generated_tags: z
      .array(socialReelsDurationFirstGeneratedTagSchema)
      .min(1)
      .max(SOCIAL_REELS_DURATION_FIRST_GENERATED_TAGS.length),
    primary_speakers: z.array(z.string().trim().min(1).max(80)).min(1).max(24),
    timeline_segments: z
      .array(socialReelsDurationFirstTimelineSegmentSchema)
      .min(1)
      .max(4),
    reason_it_works: safeText(500),
    review_flags: z.array(z.string().trim().min(1).max(80)).max(24),
  })
  .superRefine((moment, ctx) => {
    if (moment.edit_mode === "linear") {
      if (moment.composition_type !== "contiguous") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["composition_type"],
          message:
            "linear duration-first moments must use contiguous composition_type.",
        });
      }
      if (moment.timeline_segments.length !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["timeline_segments"],
          message:
            "linear duration-first moments must include exactly one timeline segment.",
        });
      }
    }

    if (moment.edit_mode === "story_edit") {
      if (moment.timeline_segments.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["timeline_segments"],
          message:
            "story_edit duration-first moments must include two to four timeline segments.",
        });
      }
      if (moment.composition_type === "contiguous") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["composition_type"],
          message:
            "story_edit duration-first moments must use a non-contiguous composition_type.",
        });
      }
    }

    const timelineDuration = moment.timeline_segments.reduce(
      (total, segment) =>
        total + segment.source_end_seconds - segment.source_start_seconds,
      0,
    );
    if (Math.abs(timelineDuration - moment.duration_seconds) > 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["duration_seconds"],
        message:
          "duration_seconds must match timeline segment duration within two seconds.",
      });
    }
  });

export const socialReelsDurationFirstManifestSchema = z
  .object({
    schema_version: z.literal(SOCIAL_REELS_DURATION_FIRST_SCHEMA_VERSION),
    project_hash: safeId,
    transcript_version: z.string().trim().max(80).nullable(),
    generation_summary: socialReelsDurationFirstGenerationSummarySchema,
    duration_buckets: z
      .array(socialReelsDurationFirstBucketSchema)
      .min(1)
      .max(SOCIAL_REELS_DURATION_FIRST_TARGETS.length),
    moments: z
      .array(socialReelsDurationFirstMomentSchema)
      .max(SOCIAL_REELS_DURATION_FIRST_MAX_UNIQUE_MOMENTS),
  })
  .superRefine((manifest, ctx) => {
    if (looksLikeRawPath(manifest.project_hash)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["project_hash"],
        message:
          "project_hash must be a privacy-safe hash, not a local/private path.",
      });
    }

    const momentIds = new Set(
      manifest.moments.map((moment) => moment.moment_id),
    );
    const bucketIds = new Set(
      manifest.duration_buckets.map((bucket) => bucket.bucket_id),
    );
    const durationTargets = new Set(
      manifest.duration_buckets.map((bucket) => bucket.duration_target),
    );
    const membershipPairs = new Set<string>();
    let totalMemberships = 0;

    for (const bucket of manifest.duration_buckets) {
      if (bucket.bucket_id !== `duration_${bucket.duration_target}`) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["duration_buckets", bucket.bucket_id],
          message: "bucket_id should use the duration_<target> convention.",
        });
      }
      for (const momentId of bucket.returned_moment_ids) {
        if (!momentIds.has(momentId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["duration_buckets", bucket.bucket_id, "returned_moment_ids"],
            message: "duration bucket references an unknown moment_id.",
          });
        }
      }
    }

    for (const target of manifest.generation_summary
      .selected_duration_targets) {
      if (!durationTargets.has(target)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["generation_summary", "selected_duration_targets"],
          message: "selected duration target is missing from duration_buckets.",
        });
      }
    }

    for (const moment of manifest.moments) {
      for (const membership of moment.duration_bucket_memberships) {
        totalMemberships += 1;
        const pair = `${moment.moment_id}:${membership.bucket_id}`;
        if (membershipPairs.has(pair)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["moments", moment.moment_id, "duration_bucket_memberships"],
            message: "duplicate bucket membership for moment.",
          });
        }
        membershipPairs.add(pair);

        if (!bucketIds.has(membership.bucket_id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["moments", moment.moment_id, "duration_bucket_memberships"],
            message: "moment membership references an unknown bucket_id.",
          });
        }
      }
    }

    if (
      totalMemberships >
      manifest.generation_summary.max_total_bucket_memberships
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["moments"],
        message:
          "total duration bucket memberships exceed manifest summary limit.",
      });
    }
  });

export type SocialReelsDurationFirstManifest = z.infer<
  typeof socialReelsDurationFirstManifestSchema
>;
export type SocialReelsDurationFirstMoment = z.infer<
  typeof socialReelsDurationFirstMomentSchema
>;
