import { z } from "zod";

export const SOCIAL_REELS_OPENAI_DISCOVERY_CONTRACT_VERSION =
  "cutswitch.social_reels.openai_discovery.v1";

export const SOCIAL_REELS_OPENAI_DISCOVERY_DURATION_BUCKETS = [
  "15s",
  "30s",
  "60s",
  "90s",
  "mixed",
] as const;

export const SOCIAL_REELS_OPENAI_DISCOVERY_FORBIDDEN_FIELDS = [
  "platformRisk",
  "riskReason",
  "highRiskHighReward",
  "advertiserSafety",
  "brandSafety",
  "contentSafetyScore",
  "sexualRisk",
  "controversyRisk",
  "contentTopicRejection",
  "content_topic_rejection",
  "topicRejection",
  "topic_rejection",
  "syntheticSpokenText",
  "generatedSpokenText",
  "fakeTranscriptText",
  "generatedAudio",
  "voiceAudio",
  "voiceoverScript",
] as const;

const score100Schema = z.number().finite().min(0).max(100);
const confidenceSchema = z.number().finite().min(0).max(1);
const safeText = (max: number) => z.string().trim().min(1).max(max);
const optionalSafeText = (max: number) => z.string().trim().min(1).max(max).optional();
const safeWordId = z.string().trim().min(1).max(160);

type ForbiddenFieldIssue = {
  path: Array<string | number>;
  field: string;
};

function isForbiddenOpenAIContractField(key: string) {
  if ((SOCIAL_REELS_OPENAI_DISCOVERY_FORBIDDEN_FIELDS as readonly string[]).includes(key)) return true;
  const normalized = key.replace(/[-_\s]/g, "").toLowerCase();
  return (
    normalized.includes("contenttopicrejection") ||
    normalized.includes("platformrisk") ||
    normalized.includes("advertisersafety") ||
    normalized.includes("brandsafety") ||
    normalized.includes("sexualrisk") ||
    normalized.includes("controversyrisk") ||
    normalized.includes("syntheticspoken") ||
    normalized.includes("faketranscript") ||
    normalized.includes("generatedaudio") ||
    normalized.includes("voiceoverscript")
  );
}

export function findForbiddenSocialReelsOpenAIContractFields(
  value: unknown,
  path: Array<string | number> = [],
): ForbiddenFieldIssue[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      findForbiddenSocialReelsOpenAIContractFields(item, [...path, index]),
    );
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, nestedValue]) => {
    const currentPath = [...path, key];
    const ownIssues = isForbiddenOpenAIContractField(key)
      ? [{ path: currentPath, field: key }]
      : [];
    return [
      ...ownIssues,
      ...findForbiddenSocialReelsOpenAIContractFields(nestedValue, currentPath),
    ];
  });
}

function addForbiddenFieldIssues(value: unknown, ctx: z.RefinementCtx) {
  for (const issue of findForbiddenSocialReelsOpenAIContractFields(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: issue.path,
      message: `Forbidden Social Reels OpenAI contract field: ${issue.field}.`,
    });
  }
}

export const socialReelsOpenAIDiscoveryScoreSchema = z
  .object({
    hookScore: score100Schema,
    clarityScore: score100Schema,
    emotionalScore: score100Schema,
    retentionScore: score100Schema,
    platformScore: score100Schema,
    overallScore: score100Schema,
  })
  .strict();

export const socialReelsOpenAIDiscoverySpeakerInfoSchema = z
  .object({
    speakerLabels: z.array(z.string().trim().min(1).max(80)).min(1).max(24),
    primarySpeakerLabel: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

export const socialReelsOpenAIDiscoveryCandidateSchema = z
  .object({
    candidateId: z.string().trim().min(1).max(120),
    durationBucket: z.enum(SOCIAL_REELS_OPENAI_DISCOVERY_DURATION_BUCKETS),
    startTime: z.number().finite().min(0).max(24 * 60 * 60),
    endTime: z.number().finite().min(0).max(24 * 60 * 60),
    duration: z.number().finite().min(5).max(10 * 60),
    title: safeText(120),
    hook: safeText(240),
    summary: safeText(500),
    reasonSelected: safeText(500),
    score: score100Schema,
    confidence: confidenceSchema,
    transcriptExcerpt: safeText(1200),
    suggestedCaption: safeText(280),
    platformTags: z.array(z.string().trim().min(1).max(40)).min(1).max(12),
    speakerInfo: socialReelsOpenAIDiscoverySpeakerInfoSchema.nullable().optional(),
    startWordId: safeWordId.nullable().optional(),
    endWordId: safeWordId.nullable().optional(),
    openingLine: optionalSafeText(240).nullable(),
    closingLine: optionalSafeText(240).nullable(),
    scoring: socialReelsOpenAIDiscoveryScoreSchema,
  })
  .strict()
  .superRefine((candidate, ctx) => {
    if (candidate.endTime <= candidate.startTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endTime"],
        message: "endTime must be greater than startTime.",
      });
    }

    if (Math.abs(candidate.duration - (candidate.endTime - candidate.startTime)) > 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["duration"],
        message: "duration must match endTime minus startTime within two seconds.",
      });
    }

    if (candidate.startWordId && !candidate.endWordId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endWordId"],
        message: "endWordId is required when startWordId is present.",
      });
    }

    if (candidate.endWordId && !candidate.startWordId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startWordId"],
        message: "startWordId is required when endWordId is present.",
      });
    }
  });

export const socialReelsOpenAIDiscoveryResponseSchema = z
  .object({
    schemaVersion: z.literal(SOCIAL_REELS_OPENAI_DISCOVERY_CONTRACT_VERSION),
    candidates: z
      .array(socialReelsOpenAIDiscoveryCandidateSchema)
      .min(1)
      .max(80),
    modelNotes: z.string().trim().max(1000).nullable(),
  })
  .strict()
  .superRefine((response, ctx) => {
    addForbiddenFieldIssues(response, ctx);
  });

export type SocialReelsOpenAIDiscoveryCandidate = z.infer<
  typeof socialReelsOpenAIDiscoveryCandidateSchema
>;
export type SocialReelsOpenAIDiscoveryResponse = z.infer<
  typeof socialReelsOpenAIDiscoveryResponseSchema
>;

const scoringJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "hookScore",
    "clarityScore",
    "emotionalScore",
    "retentionScore",
    "platformScore",
    "overallScore",
  ],
  properties: {
    hookScore: { type: "number", minimum: 0, maximum: 100 },
    clarityScore: { type: "number", minimum: 0, maximum: 100 },
    emotionalScore: { type: "number", minimum: 0, maximum: 100 },
    retentionScore: { type: "number", minimum: 0, maximum: 100 },
    platformScore: { type: "number", minimum: 0, maximum: 100 },
    overallScore: { type: "number", minimum: 0, maximum: 100 },
  },
} as const;

export function openAISocialReelsDiscoveryContractResponseFormat(maxCandidates = 80) {
  const boundedMaxCandidates = Math.min(80, Math.max(1, Math.round(maxCandidates)));
  const optionalString = (maxLength: number) => ({
    anyOf: [{ type: "string", minLength: 1, maxLength }, { type: "null" }],
  });

  return {
    type: "json_schema",
    name: "social_reels_openai_discovery_v1",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["schemaVersion", "candidates", "modelNotes"],
      properties: {
        schemaVersion: {
          type: "string",
          enum: [SOCIAL_REELS_OPENAI_DISCOVERY_CONTRACT_VERSION],
        },
        candidates: {
          type: "array",
          minItems: 1,
          maxItems: boundedMaxCandidates,
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "candidateId",
              "durationBucket",
              "startTime",
              "endTime",
              "duration",
              "title",
              "hook",
              "summary",
              "reasonSelected",
              "score",
              "confidence",
              "transcriptExcerpt",
              "suggestedCaption",
              "platformTags",
              "speakerInfo",
              "startWordId",
              "endWordId",
              "openingLine",
              "closingLine",
              "scoring",
            ],
            properties: {
              candidateId: { type: "string", minLength: 1, maxLength: 120 },
              durationBucket: {
                type: "string",
                enum: SOCIAL_REELS_OPENAI_DISCOVERY_DURATION_BUCKETS,
              },
              startTime: { type: "number", minimum: 0, maximum: 86400 },
              endTime: { type: "number", minimum: 0, maximum: 86400 },
              duration: { type: "number", minimum: 5, maximum: 600 },
              title: { type: "string", minLength: 1, maxLength: 120 },
              hook: { type: "string", minLength: 1, maxLength: 240 },
              summary: { type: "string", minLength: 1, maxLength: 500 },
              reasonSelected: { type: "string", minLength: 1, maxLength: 500 },
              score: { type: "number", minimum: 0, maximum: 100 },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              transcriptExcerpt: { type: "string", minLength: 1, maxLength: 1200 },
              suggestedCaption: { type: "string", minLength: 1, maxLength: 280 },
              platformTags: {
                type: "array",
                minItems: 1,
                maxItems: 12,
                items: { type: "string", minLength: 1, maxLength: 40 },
              },
              speakerInfo: {
                anyOf: [
                  {
                    type: "object",
                    additionalProperties: false,
                    required: ["speakerLabels", "primarySpeakerLabel"],
                    properties: {
                      speakerLabels: {
                        type: "array",
                        minItems: 1,
                        maxItems: 24,
                        items: { type: "string", minLength: 1, maxLength: 80 },
                      },
                      primarySpeakerLabel: optionalString(80),
                    },
                  },
                  { type: "null" },
                ],
              },
              startWordId: optionalString(160),
              endWordId: optionalString(160),
              openingLine: optionalString(240),
              closingLine: optionalString(240),
              scoring: scoringJsonSchema,
            },
          },
        },
        modelNotes: {
          anyOf: [{ type: "string", maxLength: 1000 }, { type: "null" }],
        },
      },
    },
  } as const;
}
