import { z } from "zod";

import { SOCIAL_REELS_DURATION_FIRST_TARGETS } from "./socialReelsSchema";

export const SOCIAL_REELS_CREDIT_ESTIMATE_BILLING_MODE = "estimate_only" as const;

const durationBucketSchema = z.enum(SOCIAL_REELS_DURATION_FIRST_TARGETS);

export const socialReelsCreditEstimateRequestSchema = z.object({
  duration_buckets: z.array(durationBucketSchema).min(1).max(SOCIAL_REELS_DURATION_FIRST_TARGETS.length),
  episode_duration_seconds: z.number().finite().min(1).max(24 * 60 * 60),
  speaker_count: z.number().int().min(1).max(64).optional().default(1),
  requested_max_per_bucket: z.number().int().min(1).max(20).optional().default(20),
});

export type SocialReelsCreditEstimateRequest = z.infer<typeof socialReelsCreditEstimateRequestSchema>;

export type SocialReelsCreditEstimateLineItem = {
  name: string;
  credits: number;
};

export type SocialReelsCreditEstimate = {
  total_credits: number;
  line_items: SocialReelsCreditEstimateLineItem[];
  billing_mode: typeof SOCIAL_REELS_CREDIT_ESTIMATE_BILLING_MODE;
  charge_now: false;
};

const DURATION_BUCKET_CREDITS: Record<(typeof SOCIAL_REELS_DURATION_FIRST_TARGETS)[number], number> = {
  "15s": 2,
  "30s": 2,
  "60s": 2,
  "90s": 3,
  "5_to_10m": 6,
};

function uniqueDurationBuckets(buckets: readonly (typeof SOCIAL_REELS_DURATION_FIRST_TARGETS)[number][]) {
  const seen = new Set<(typeof SOCIAL_REELS_DURATION_FIRST_TARGETS)[number]>();
  const result: (typeof SOCIAL_REELS_DURATION_FIRST_TARGETS)[number][] = [];

  for (const bucket of buckets) {
    if (seen.has(bucket)) continue;
    seen.add(bucket);
    result.push(bucket);
  }

  return result;
}

function basePodcastAnalysisCredits(episodeDurationSeconds: number, speakerCount: number) {
  const durationHours = episodeDurationSeconds / 3600;
  const durationCredits = Math.max(4, Math.ceil(durationHours * 3));
  const speakerComplexityCredits = speakerCount >= 9 ? 2 : speakerCount >= 5 ? 1 : 0;

  return durationCredits + speakerComplexityCredits;
}

function candidateVolumeMultiplier(requestedMaxPerBucket: number) {
  if (requestedMaxPerBucket <= 10) return 0.75;
  if (requestedMaxPerBucket <= 15) return 0.9;
  return 1;
}

function labelForDurationBucket(bucket: (typeof SOCIAL_REELS_DURATION_FIRST_TARGETS)[number]) {
  return bucket === "5_to_10m" ? "5-10m candidates" : `${bucket} candidates`;
}

export function estimateSocialReelsDurationFirstCredits(
  rawInput: SocialReelsCreditEstimateRequest
): { credit_estimate: SocialReelsCreditEstimate } {
  const input = socialReelsCreditEstimateRequestSchema.parse(rawInput);
  const buckets = uniqueDurationBuckets(input.duration_buckets);
  const volumeMultiplier = candidateVolumeMultiplier(input.requested_max_per_bucket);
  const lineItems: SocialReelsCreditEstimateLineItem[] = [
    {
      name: "Base podcast analysis",
      credits: basePodcastAnalysisCredits(input.episode_duration_seconds, input.speaker_count),
    },
  ];

  for (const bucket of buckets) {
    lineItems.push({
      name: labelForDurationBucket(bucket),
      credits: Math.max(1, Math.ceil(DURATION_BUCKET_CREDITS[bucket] * volumeMultiplier)),
    });
  }

  return {
    credit_estimate: {
      total_credits: lineItems.reduce((sum, item) => sum + item.credits, 0),
      line_items: lineItems,
      billing_mode: SOCIAL_REELS_CREDIT_ESTIMATE_BILLING_MODE,
      charge_now: false,
    },
  };
}
