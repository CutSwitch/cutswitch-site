export const runtime = "nodejs";

import { getUserFromBearerToken } from "@/lib/auth";
import { readJsonBody } from "@/lib/request";
import { enforceRateLimit, noStoreJson } from "@/lib/security";
import {
  SOCIAL_REELS_AI_EDITOR_WORD_EDIT_SCHEMA_VERSION,
  SocialReelsAiEditorWordEditProviderError,
  getSafeSocialReelsAiEditorWordEditIssues,
  getSafeSocialReelsEditIssues,
  proposeSocialReelsAiEditorWordEdit,
  proposeSocialReelsEdit,
  socialReelsAiEditorWordEditRequestSchema,
  socialReelsEditAssistantRequestSchema,
} from "@/lib/socialReelsEditAssistant";

const MAX_BODY_BYTES = 1024 * 1024;

function safeEditPayloadShape(value: unknown) {
  if (!value || typeof value !== "object") {
    return { utterance_count: null, word_count: null, history_count: null, instruction_length: null };
  }

  const record = value as Record<string, unknown>;
  return {
    utterance_count: Array.isArray(record.relevant_utterances) ? record.relevant_utterances.length : null,
    current_segment_count: Array.isArray(record.currentSegments) ? record.currentSegments.length : null,
    word_count: Array.isArray(record.relevant_words)
      ? record.relevant_words.length
      : Array.isArray(record.relevant_word_refs)
        ? record.relevant_word_refs.length
        : record.boundedWordWindow &&
            typeof record.boundedWordWindow === "object" &&
            Array.isArray((record.boundedWordWindow as Record<string, unknown>).words)
          ? ((record.boundedWordWindow as Record<string, unknown>).words as unknown[]).length
          : null,
    history_count: Array.isArray(record.edit_history) ? record.edit_history.length : null,
    instruction_length:
      typeof record.user_instruction === "string"
        ? record.user_instruction.length
        : typeof record.userInstruction === "string"
          ? record.userInstruction.length
          : null,
  };
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const ipRateLimited = await enforceRateLimit(req, [], 120, 60 * 60, "social_reels_edit_ip");
  if (ipRateLimited) return ipRateLimited;

  const { user, error: authError } = await getUserFromBearerToken(req);
  if (authError === "missing_token") {
    return noStoreJson({ error: "Missing Authorization bearer token", request_id: requestId }, 401);
  }
  if (authError || !user) {
    return noStoreJson({ error: "Invalid or expired token", request_id: requestId }, 401);
  }

  const userRateLimited = await enforceRateLimit(req, [user.id], 60, 60 * 60, "social_reels_edit_user");
  if (userRateLimited) return userRateLimited;

  const parsedBody = await readJsonBody(req, MAX_BODY_BYTES);
  if (!parsedBody.ok) {
    return noStoreJson({ error: parsedBody.message || "Invalid request.", request_id: requestId }, parsedBody.status);
  }

  if (
    parsedBody.data &&
    typeof parsedBody.data === "object" &&
    (parsedBody.data as Record<string, unknown>).schemaVersion === SOCIAL_REELS_AI_EDITOR_WORD_EDIT_SCHEMA_VERSION
  ) {
    const parsedWordEdit = socialReelsAiEditorWordEditRequestSchema.safeParse(parsedBody.data);
    if (!parsedWordEdit.success) {
      const issues = getSafeSocialReelsAiEditorWordEditIssues(parsedWordEdit.error);
      console.warn("[social-reels-edit] invalid word-edit payload", {
        request_id: requestId,
        issues,
        shape: safeEditPayloadShape(parsedBody.data),
      });
      return noStoreJson({ error: "Invalid social reels AI editor word-edit payload", issues, request_id: requestId }, 400);
    }

    try {
      const response = proposeSocialReelsAiEditorWordEdit(parsedWordEdit.data);
      console.info("[social-reels-edit] word-edit proposal generated", {
        request_id: requestId,
        shape: safeEditPayloadShape(parsedWordEdit.data),
        operation_count: response.operations.length,
        needs_narrower_instruction: response.needsNarrowerInstruction === true,
      });

      return noStoreJson({ ok: true, request_id: requestId, ...response });
    } catch (error) {
      if (error instanceof SocialReelsAiEditorWordEditProviderError) {
        console.warn("[social-reels-edit] word-edit provider output invalid", {
          request_id: requestId,
          reason_code: error.reasonCode,
          issues: error.issues,
        });
        return noStoreJson(
          {
            error: "Social reels AI editor provider output was invalid.",
            request_id: requestId,
            reason_code: error.reasonCode,
            retry_allowed: error.retryAllowed,
            issues: error.issues,
          },
          502
        );
      }
      throw error;
    }
  }

  const parsed = socialReelsEditAssistantRequestSchema.safeParse(parsedBody.data);
  if (!parsed.success) {
    const issues = getSafeSocialReelsEditIssues(parsed.error);
    console.warn("[social-reels-edit] invalid payload", {
      request_id: requestId,
      issues,
      shape: safeEditPayloadShape(parsedBody.data),
    });
    return noStoreJson({ error: "Invalid social reels edit payload", issues, request_id: requestId }, 400);
  }

  const response = proposeSocialReelsEdit(parsed.data);
  console.info("[social-reels-edit] patch proposed", {
    request_id: requestId,
    shape: safeEditPayloadShape(parsed.data),
    conversation_state: response.conversation_state,
    changed_segment_count: response.changed_segments.length,
    warning_count: response.warnings.length,
  });

  return noStoreJson({ ok: true, request_id: requestId, ...response });
}
