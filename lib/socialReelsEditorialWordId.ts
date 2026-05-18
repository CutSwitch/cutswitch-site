import { z } from "zod";

export const SOCIAL_REELS_EDITORIAL_WORD_ID_VERSION = "social_reels_editorial_word_id_v1";
export const SOCIAL_REELS_EDITORIAL_WORD_ID_STATUSES = [
  "ready",
  "needs_extension",
  "needs_trim",
  "weak_shape",
] as const;
export const SOCIAL_REELS_EDITORIAL_WORD_ID_SEGMENT_ROLES = [
  "hook",
  "context",
  "bridge",
  "payoff",
  "closing",
] as const;
const safeId = z.string().trim().min(1).max(160);
const safeText = (max: number) => z.string().trim().min(1).max(max);
const scoreTenSchema = z.number().finite().min(0).max(10);

export const socialReelsEditorialWordIdSegmentSchema = z
  .object({
    role: z.enum(SOCIAL_REELS_EDITORIAL_WORD_ID_SEGMENT_ROLES),
    startWordId: safeId,
    endWordId: safeId,
    quote: safeText(360),
    reason: safeText(360),
  })
  .strict();

export const socialReelsEditorialWordIdScoresSchema = z
  .object({
    hook: scoreTenSchema,
    selfContained: scoreTenSchema,
    payoff: scoreTenSchema,
    captionClarity: scoreTenSchema,
    overall: scoreTenSchema,
  })
  .strict();

export const socialReelsEditorialWordIdReelSchema = z
  .object({
    clientMomentId: safeId,
    title: safeText(120),
    durationTargetSeconds: z.number().int().min(5).max(10 * 60),
    openingLine: safeText(240),
    closingLine: safeText(240),
    editorialStatus: z.enum(SOCIAL_REELS_EDITORIAL_WORD_ID_STATUSES),
    segments: z.array(socialReelsEditorialWordIdSegmentSchema).min(1).max(5),
    editorialScores: socialReelsEditorialWordIdScoresSchema,
    notes: z.array(z.string().trim().min(1).max(240)).max(10),
  })
  .strict();

export const socialReelsEditorialWordIdResponseSchema = z
  .object({
    version: z.literal(SOCIAL_REELS_EDITORIAL_WORD_ID_VERSION),
    reels: z.array(socialReelsEditorialWordIdReelSchema).min(1).max(120),
  })
  .strict();

export type SocialReelsEditorialWordIdResponse = z.infer<typeof socialReelsEditorialWordIdResponseSchema>;

export function openAISocialReelsEditorialWordIdResponseFormat(maxReels: number) {
  const boundedMaxReels = Math.min(120, Math.max(1, Math.round(maxReels)));

  return {
    type: "json_schema",
    name: "social_reels_editorial_word_id",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["version", "reels"],
      properties: {
        version: {
          type: "string",
          enum: [SOCIAL_REELS_EDITORIAL_WORD_ID_VERSION],
        },
        reels: {
          type: "array",
          minItems: 1,
          maxItems: boundedMaxReels,
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "clientMomentId",
              "title",
              "durationTargetSeconds",
              "openingLine",
              "closingLine",
              "editorialStatus",
              "segments",
              "editorialScores",
              "notes",
            ],
            properties: {
              clientMomentId: { type: "string", minLength: 1, maxLength: 160 },
              title: { type: "string", minLength: 1, maxLength: 120 },
              durationTargetSeconds: { type: "integer", minimum: 5, maximum: 600 },
              openingLine: { type: "string", minLength: 1, maxLength: 240 },
              closingLine: { type: "string", minLength: 1, maxLength: 240 },
              editorialStatus: {
                type: "string",
                enum: SOCIAL_REELS_EDITORIAL_WORD_ID_STATUSES,
              },
              segments: {
                type: "array",
                minItems: 1,
                maxItems: 5,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["role", "startWordId", "endWordId", "quote", "reason"],
                  properties: {
                    role: {
                      type: "string",
                      enum: SOCIAL_REELS_EDITORIAL_WORD_ID_SEGMENT_ROLES,
                    },
                    startWordId: { type: "string", minLength: 1, maxLength: 160 },
                    endWordId: { type: "string", minLength: 1, maxLength: 160 },
                    quote: { type: "string", minLength: 1, maxLength: 360 },
                    reason: { type: "string", minLength: 1, maxLength: 360 },
                  },
                },
              },
              editorialScores: {
                type: "object",
                additionalProperties: false,
                required: ["hook", "selfContained", "payoff", "captionClarity", "overall"],
                properties: {
                  hook: { type: "number", minimum: 0, maximum: 10 },
                  selfContained: { type: "number", minimum: 0, maximum: 10 },
                  payoff: { type: "number", minimum: 0, maximum: 10 },
                  captionClarity: { type: "number", minimum: 0, maximum: 10 },
                  overall: { type: "number", minimum: 0, maximum: 10 },
                },
              },
              notes: {
                type: "array",
                maxItems: 10,
                items: { type: "string", minLength: 1, maxLength: 240 },
              },
            },
          },
        },
      },
    },
  } as const;
}
