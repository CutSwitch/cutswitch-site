import { z } from "zod";

const RAW_PATH_VALUE = /(^|[\s"'])(~\/|\/Users\/|[A-Za-z]:\\|file:\/\/|.*\\.*|.*\/.*)/;
const COMMON_WORDS = new Set([
  "the",
  "and",
  "with",
  "this",
  "that",
  "like",
  "clip",
  "start",
  "hook",
  "line",
  "but",
  "for",
  "you",
  "your",
  "from",
  "into",
  "front",
  "move",
  "moved",
  "as",
  "a",
  "an",
  "i",
  "it",
  "is",
  "to",
  "of",
]);

export const SOCIAL_REELS_EDIT_ASSISTANT_SEGMENT_ROLES = [
  "cold_open_hook",
  "setup",
  "context",
  "evidence",
  "escalation",
  "payoff",
  "closing_button",
  "bridge",
] as const;

export const SOCIAL_REELS_EDIT_ASSISTANT_CONTINUITY_RISKS = ["low", "medium", "high"] as const;
export const SOCIAL_REELS_EDIT_ASSISTANT_WARNINGS = [
  "line_not_found",
  "possible_context_loss",
  "meaning_risk",
  "word_boundary_review_needed",
  "needs_user_confirmation",
] as const;

const safeId = z.string().trim().min(1).max(160);
const safeOptionalText = (max: number) => z.string().trim().max(max).optional().nullable();
const scoreSchema = z.number().min(0).max(1);

function looksLikeRawPath(value: string | null | undefined) {
  if (!value) return false;
  return RAW_PATH_VALUE.test(value) || /\.fcpxml\b/i.test(value);
}

export const socialReelsEditRelevantUtteranceSchema = z
  .object({
    utterance_id: safeId.optional(),
    id: safeId.optional(),
    speaker_label: z.string().trim().min(1).max(80),
    start_seconds: z.number().finite().min(0).max(24 * 60 * 60),
    end_seconds: z.number().finite().min(0).max(24 * 60 * 60),
    start_timecode: safeOptionalText(32),
    end_timecode: safeOptionalText(32),
    text: z.string().trim().min(1).max(2400),
  })
  .transform((utterance) => ({
    ...utterance,
    utterance_id: utterance.utterance_id ?? utterance.id ?? "",
  }))
  .superRefine((utterance, ctx) => {
    if (!utterance.utterance_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["utterance_id"], message: "utterance_id is required." });
    }
    if (utterance.end_seconds <= utterance.start_seconds) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["end_seconds"], message: "end_seconds must be greater than start_seconds." });
    }
  });

export const socialReelsEditRelevantWordSchema = z
  .object({
    word_id: safeId.optional(),
    id: safeId.optional(),
    utterance_id: safeOptionalText(160),
    start_seconds: z.number().finite().min(0).max(24 * 60 * 60),
    end_seconds: z.number().finite().min(0).max(24 * 60 * 60),
    text: z.string().trim().min(1).max(120),
  })
  .transform((word) => ({
    ...word,
    word_id: word.word_id ?? word.id ?? "",
  }))
  .superRefine((word, ctx) => {
    if (!word.word_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["word_id"], message: "word_id is required." });
    }
    if (word.end_seconds <= word.start_seconds) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["end_seconds"], message: "end_seconds must be greater than start_seconds." });
    }
  });

export const socialReelsEditTimelineSegmentSchema = z
  .object({
    segment_id: safeId,
    role: z.enum(SOCIAL_REELS_EDIT_ASSISTANT_SEGMENT_ROLES),
    source_start_seconds: z.number().finite().min(0).max(24 * 60 * 60),
    source_end_seconds: z.number().finite().min(0).max(24 * 60 * 60),
    source_start_timecode: z.string().trim().max(32).nullable(),
    source_end_timecode: z.string().trim().max(32).nullable(),
    utterance_ids: z.array(safeId).min(1).max(80),
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

export const socialReelsEditRecipeSchema = z.object({
  edit_mode: z.enum(["linear", "story_edit"]),
  composition_type: z.enum(["contiguous", "hook_reordered", "hook_setup_payoff", "question_answer", "callback", "mini_montage"]),
  timeline_segments: z.array(socialReelsEditTimelineSegmentSchema).max(4).default([]),
  display_title: safeOptionalText(120),
  display_teaser: safeOptionalText(240),
  opening_hook: safeOptionalText(240),
  closing_line: safeOptionalText(240),
  coherence_score: scoreSchema.nullable().optional(),
  continuity_risk: z.enum(SOCIAL_REELS_EDIT_ASSISTANT_CONTINUITY_RISKS).nullable().optional(),
  edit_decision_rationale: safeOptionalText(500),
  review_flags: z.array(z.string().trim().min(1).max(80)).max(24).default([]),
});

export const socialReelsEditAssistantRequestSchema = z
  .object({
    project_id: safeOptionalText(160),
    project_hash: safeId,
    candidate_id: safeId,
    moment_id: safeOptionalText(160),
    current_edit_recipe: z.record(z.unknown()).default({}),
    user_instruction: z.string().trim().min(1).max(2000),
    relevant_utterances: z.array(socialReelsEditRelevantUtteranceSchema).min(1).max(80),
    relevant_words: z.array(socialReelsEditRelevantWordSchema).max(2000).optional().default([]),
    neighboring_context_window: z.record(z.unknown()).optional().default({}),
    conversation_id: safeOptionalText(160),
    previous_response_id: safeOptionalText(160),
    edit_history: z.array(z.record(z.unknown())).max(40).optional().default([]),
  })
  .superRefine((request, ctx) => {
    for (const [key, value] of [
      ["project_id", request.project_id],
      ["project_hash", request.project_hash],
      ["candidate_id", request.candidate_id],
      ["moment_id", request.moment_id],
    ] as const) {
      if (looksLikeRawPath(value)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: `${key} must not contain a local/private path.` });
      }
    }
  });

export const socialReelsEditRecipePatchSchema = z.object({
  patch_type: z.literal("replace_edit_recipe"),
  operations: z.array(
    z.object({
      op: z.enum(["set", "replace"]),
      path: z.string().trim().min(1).max(160),
      value: z.unknown(),
    })
  ),
});

export const socialReelsEditAssistantResponseSchema = z.object({
  assistant_message: z.string().trim().min(1).max(600),
  proposed_edit_recipe: socialReelsEditRecipeSchema,
  edit_recipe_patch: socialReelsEditRecipePatchSchema,
  changed_segments: z.array(socialReelsEditTimelineSegmentSchema).max(4),
  rationale: z.string().trim().min(1).max(1000),
  warnings: z.array(z.enum(SOCIAL_REELS_EDIT_ASSISTANT_WARNINGS)).max(SOCIAL_REELS_EDIT_ASSISTANT_WARNINGS.length),
  confidence: scoreSchema,
  needs_user_confirmation: z.boolean(),
  conversation_id: z.string().trim().max(160).nullable(),
  previous_response_id: z.string().trim().max(160).nullable(),
  conversation_state: z.literal("stateless"),
});

export type SocialReelsEditAssistantRequest = z.infer<typeof socialReelsEditAssistantRequestSchema>;
export type SocialReelsEditAssistantResponse = z.infer<typeof socialReelsEditAssistantResponseSchema>;
export type SocialReelsEditTimelineSegment = z.infer<typeof socialReelsEditTimelineSegmentSchema>;

export const SOCIAL_REELS_EDIT_ASSISTANT_SYSTEM_PROMPT = [
  "You are the CutSwitch Social Reel Edit Assistant. You edit a real transcript non-destructively by returning structured JSON edit recipe patches, not rewritten video text.",
  "The spoken content must remain source-true. Do not invent spoken words, speaker names, utterance IDs, word IDs, timestamps, transitions, or synthetic source ranges.",
  "Use existing utterance IDs, word IDs when provided, source_start_seconds/source_end_seconds, and source_start_timecode/source_end_timecode. Use utterances[] as source of truth.",
  "If the user asks to start with a line, find that line in the provided transcript context and place it as a cold_open_hook only if the rest of the reel pays it off coherently.",
  "You may suggest title, teaser, opening_hook, and closing_line copy, but the timeline source ranges must reference real utterances/source time.",
  "May reorder source ranges only if coherent and meaning-preserving. If the edit would misrepresent meaning, warn and propose a safer alternative.",
  "Must not cut mid-word or mid-thought when word timing exists. Prefer clean sentence/thought endings and cleaner closing buttons.",
  "Conversation state is explicit and stateless for this endpoint: do not assume prior app interactions. The app must send current_edit_recipe, relevant_utterances, relevant_words, neighboring_context_window, and edit_history every time.",
  "The app applies edits only after user confirmation. Return JSON only.",
].join(" ");

function normalizeWords(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !COMMON_WORDS.has(word));
}

function utteranceId(utterance: SocialReelsEditAssistantRequest["relevant_utterances"][number]) {
  return utterance.utterance_id;
}

function textPreview(value: string, max = 180) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function scoreInstructionMatch(instructionWords: string[], utteranceText: string) {
  const normalized = new Set(normalizeWords(utteranceText));
  return instructionWords.reduce((score, word) => score + (normalized.has(word) ? 1 : 0), 0);
}

function pickHookUtterance(input: SocialReelsEditAssistantRequest) {
  const instructionWords = normalizeWords(input.user_instruction);
  const scored = input.relevant_utterances.map((utterance) => ({
    utterance,
    score: scoreInstructionMatch(instructionWords, utterance.text),
  }));

  scored.sort((a, b) => b.score - a.score || b.utterance.start_seconds - a.utterance.start_seconds);
  return scored[0]?.score > 0 ? scored[0].utterance : input.relevant_utterances[0];
}

function pickContextUtterance(input: SocialReelsEditAssistantRequest, hook: SocialReelsEditAssistantRequest["relevant_utterances"][number]) {
  const earlier = [...input.relevant_utterances]
    .filter((utterance) => utterance.end_seconds <= hook.start_seconds && utteranceId(utterance) !== utteranceId(hook))
    .sort((a, b) => a.start_seconds - b.start_seconds);
  return earlier[0] ?? input.relevant_utterances.find((utterance) => utteranceId(utterance) !== utteranceId(hook)) ?? hook;
}

function pickClosingUtterance(input: SocialReelsEditAssistantRequest, hook: SocialReelsEditAssistantRequest["relevant_utterances"][number]) {
  const later = [...input.relevant_utterances]
    .filter((utterance) => utterance.start_seconds >= hook.end_seconds && utteranceId(utterance) !== utteranceId(hook))
    .sort((a, b) => a.start_seconds - b.start_seconds);
  return later[later.length - 1] ?? input.relevant_utterances[input.relevant_utterances.length - 1] ?? hook;
}

function makeTimelineSegment(
  utterance: SocialReelsEditAssistantRequest["relevant_utterances"][number],
  role: SocialReelsEditTimelineSegment["role"],
  reasonForPlacement: string,
  suffix: string
): SocialReelsEditTimelineSegment {
  return {
    segment_id: `edit-${utteranceId(utterance)}-${suffix}`.slice(0, 160),
    role,
    source_start_seconds: utterance.start_seconds,
    source_end_seconds: utterance.end_seconds,
    source_start_timecode: utterance.start_timecode ?? null,
    source_end_timecode: utterance.end_timecode ?? null,
    utterance_ids: [utteranceId(utterance)],
    speaker_labels: [utterance.speaker_label],
    transcript_excerpt: textPreview(utterance.text, 240),
    reason_for_placement: reasonForPlacement,
  };
}

function hasHookRelocationIntent(instruction: string) {
  return /\b(start|open|begin|front|first|hook|cold[-\s]?open|move)\b/i.test(instruction);
}

function hasCleanerEndingIntent(instruction: string) {
  return /\b(end|ending|close|closing|button|payoff|finish|cleaner)\b/i.test(instruction);
}

export function buildSocialReelsEditAssistantPromptInput(input: SocialReelsEditAssistantRequest) {
  return [
    { role: "system", content: SOCIAL_REELS_EDIT_ASSISTANT_SYSTEM_PROMPT },
    {
      role: "user",
      content: JSON.stringify({
        endpoint_mode: "stateless",
        conversation_id: input.conversation_id,
        previous_response_id: input.previous_response_id,
        candidate_id: input.candidate_id,
        moment_id: input.moment_id,
        user_instruction: input.user_instruction,
        current_edit_recipe: input.current_edit_recipe,
        relevant_utterances: input.relevant_utterances,
        relevant_words: input.relevant_words.map((word) => ({
          word_id: word.word_id,
          utterance_id: word.utterance_id,
          start_seconds: word.start_seconds,
          end_seconds: word.end_seconds,
          text: word.text,
        })),
        neighboring_context_window: input.neighboring_context_window,
        edit_history: input.edit_history,
        output_contract:
          "Return assistant_message, proposed_edit_recipe, edit_recipe_patch, changed_segments, rationale, warnings, confidence, needs_user_confirmation, and null conversation IDs unless the app supplies explicit state.",
      }),
    },
  ];
}

export function proposeSocialReelsEdit(input: SocialReelsEditAssistantRequest): SocialReelsEditAssistantResponse {
  const wantsHookRelocation = hasHookRelocationIntent(input.user_instruction);
  const wantsCleanerEnding = hasCleanerEndingIntent(input.user_instruction);
  const hook = pickHookUtterance(input);
  const context = pickContextUtterance(input, hook);
  const closing = wantsCleanerEnding ? pickClosingUtterance(input, hook) : pickClosingUtterance(input, hook);
  const uniqueSegments = [
    makeTimelineSegment(hook, wantsHookRelocation ? "cold_open_hook" : "setup", "Selected because it best matches the user's requested line or hook intent.", "hook"),
    ...(utteranceId(context) !== utteranceId(hook)
      ? [makeTimelineSegment(context, "context", "Keeps the original context after the relocated hook so the edit remains source-true.", "context")]
      : []),
    ...(utteranceId(closing) !== utteranceId(hook) && utteranceId(closing) !== utteranceId(context)
      ? [makeTimelineSegment(closing, "closing_button", "Provides a cleaner ending or payoff from real source context.", "closing")]
      : []),
  ].slice(0, 3);

  const storyEdit = wantsHookRelocation || uniqueSegments.length > 1;
  const warnings = storyEdit ? ["needs_user_confirmation" as const] : ["possible_context_loss" as const, "needs_user_confirmation" as const];
  const proposedEditRecipe = {
    edit_mode: storyEdit ? "story_edit" as const : "linear" as const,
    composition_type: storyEdit ? "hook_reordered" as const : "contiguous" as const,
    timeline_segments: uniqueSegments,
    display_title: null,
    display_teaser: textPreview(input.user_instruction, 160),
    opening_hook: textPreview(hook.text, 180),
    closing_line: textPreview(closing.text, 180),
    coherence_score: storyEdit ? 0.82 : 0.74,
    continuity_risk: storyEdit ? "medium" as const : "low" as const,
    edit_decision_rationale: storyEdit
      ? "The user requested a hook/front-placement edit, so the patch moves the best matching source utterance to the cold open and keeps real source context after it."
      : "The request can be represented as a source-true linear edit recipe with confirmation required.",
    review_flags: [],
  };

  const response = {
    assistant_message: storyEdit
      ? "I moved the requested source line to the front as a cold-open hook and kept real source context after it for review."
      : "I prepared a source-true edit recipe patch for review.",
    proposed_edit_recipe: proposedEditRecipe,
    edit_recipe_patch: {
      patch_type: "replace_edit_recipe" as const,
      operations: [
        { op: "set" as const, path: "/edit_mode", value: proposedEditRecipe.edit_mode },
        { op: "set" as const, path: "/composition_type", value: proposedEditRecipe.composition_type },
        { op: "replace" as const, path: "/timeline_segments", value: proposedEditRecipe.timeline_segments },
        { op: "set" as const, path: "/opening_hook", value: proposedEditRecipe.opening_hook },
        { op: "set" as const, path: "/closing_line", value: proposedEditRecipe.closing_line },
      ],
    },
    changed_segments: proposedEditRecipe.timeline_segments,
    rationale:
      "This endpoint is stateless and returns a non-destructive patch only. The app must validate utterance IDs, source times, word boundaries, and user confirmation before applying the edit.",
    warnings,
    confidence: storyEdit ? 0.82 : 0.72,
    needs_user_confirmation: true,
    conversation_id: null,
    previous_response_id: null,
    conversation_state: "stateless" as const,
  };

  return socialReelsEditAssistantResponseSchema.parse(response);
}

export function getSafeSocialReelsEditIssues(error: z.ZodError) {
  return error.issues.slice(0, 20).map((issue) => ({
    path: issue.path.map((part) => String(part)).join("."),
    code: issue.code,
  }));
}
