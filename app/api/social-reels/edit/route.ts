export const runtime = "nodejs";

import { getUserFromBearerToken } from "@/lib/auth";
import { readJsonBody } from "@/lib/request";
import { enforceRateLimit, noStoreJson } from "@/lib/security";
import {
  getSafeSocialReelsEditIssues,
  proposeSocialReelsEdit,
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
    word_count: Array.isArray(record.relevant_words) ? record.relevant_words.length : null,
    history_count: Array.isArray(record.edit_history) ? record.edit_history.length : null,
    instruction_length: typeof record.user_instruction === "string" ? record.user_instruction.length : null,
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
