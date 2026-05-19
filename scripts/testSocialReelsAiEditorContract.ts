import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  SOCIAL_REELS_AI_EDITOR_FORBIDDEN_FIELDS,
  SOCIAL_REELS_AI_EDITOR_WORD_EDIT_OPERATION_TYPES,
  SOCIAL_REELS_AI_EDITOR_WORD_EDIT_SCHEMA_VERSION,
  buildSocialReelsAiEditorWordEditPromptInput,
  proposeSocialReelsEdit,
  socialReelsAiEditorWordEditRequestSchema,
  socialReelsAiEditorWordEditResponseSchema,
  socialReelsEditAssistantRequestSchema,
  socialReelsEditAssistantResponseSchema,
  validateSocialReelsAiEditorWordEditResponseWordIds,
} from "../lib/socialReelsEditAssistant";

let failed = false;

function assert(condition: unknown, message: string) {
  if (condition) return;
  failed = true;
  console.error(`FAIL: ${message}`);
}

function readJson(path: string) {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8")) as unknown;
}

function collectResponseWordIds(response: ReturnType<typeof socialReelsAiEditorWordEditResponseSchema.parse>) {
  const wordIds = new Set<string>();

  for (const operation of response.operations) {
    if (operation.type === "updateTitleSuggestion") continue;

    wordIds.add(operation.sourceStartWordID);
    wordIds.add(operation.sourceEndWordID);

    if (operation.type === "replaceSpanWithExistingSpan") {
      wordIds.add(operation.targetStartWordID);
      wordIds.add(operation.targetEndWordID);
    }

    if (operation.type === "reorderExistingSegments") {
      for (const span of operation.orderedSpans) {
        wordIds.add(span.sourceStartWordID);
        wordIds.add(span.sourceEndWordID);
      }
    }
  }

  return wordIds;
}

function rejects(value: unknown, parser: (candidate: unknown) => unknown) {
  try {
    parser(value);
    return false;
  } catch {
    return true;
  }
}

const requestFixturePath = "docs/contracts/social_reels_ai_editor_word_edit_request.backend_contract_fixture.json";
const responseFixturePath = "docs/contracts/social_reels_ai_editor_word_edit_response.backend_fixture.json";

const requestFixture = socialReelsAiEditorWordEditRequestSchema.parse(readJson(requestFixturePath));
const responseFixture = socialReelsAiEditorWordEditResponseSchema.parse(readJson(responseFixturePath));

assert(requestFixture.schemaVersion === SOCIAL_REELS_AI_EDITOR_WORD_EDIT_SCHEMA_VERSION, "Request fixture should use social_reels_ai_editor_word_edit_v1.");
assert(responseFixture.schemaVersion === SOCIAL_REELS_AI_EDITOR_WORD_EDIT_SCHEMA_VERSION, "Response fixture should use social_reels_ai_editor_word_edit_v1.");
validateSocialReelsAiEditorWordEditResponseWordIds(requestFixture, responseFixture);

const requestWordIds = new Set(requestFixture.boundedWordWindow.words.map((word) => word.wordID));
const responseWordIds = collectResponseWordIds(responseFixture);
assert([...responseWordIds].every((wordId) => requestWordIds.has(wordId)), "Response IDs should be a subset of request boundedWordWindow word IDs.");

assert(
  responseFixture.operations.every((operation) => SOCIAL_REELS_AI_EDITOR_WORD_EDIT_OPERATION_TYPES.includes(operation.type)),
  "Response operations should use allowed operation types only."
);
assert(
  responseFixture.operations.some((operation) => operation.type === "updateTitleSuggestion" && operation.titleText.length > 0),
  "Fixture should include title-only generated text via updateTitleSuggestion."
);
assert(
  responseFixture.operations
    .filter((operation) => operation.type === "updateTitleSuggestion")
    .every((operation) => !("sourceStartWordID" in operation) && !("sourceEndWordID" in operation)),
  "updateTitleSuggestion should not be treated as spoken source material."
);

const syntheticSpokenResponse = {
  ...responseFixture,
  operations: [{ ...responseFixture.operations[0], syntheticSpokenText: "Invent this spoken line." }],
};
assert(
  rejects(syntheticSpokenResponse, (candidate) => socialReelsAiEditorWordEditResponseSchema.parse(candidate)),
  "Synthetic spoken text operation should not be accepted."
);

const forbiddenRiskResponse = {
  ...responseFixture,
  platformRisk: "not_allowed",
};
assert(
  rejects(forbiddenRiskResponse, (candidate) => socialReelsAiEditorWordEditResponseSchema.parse(candidate)),
  "Forbidden platform/content-risk fields should not be accepted."
);

const fixtureText = [
  readFileSync(resolve(process.cwd(), requestFixturePath), "utf8"),
  readFileSync(resolve(process.cwd(), responseFixturePath), "utf8"),
].join("\n");
for (const field of [...SOCIAL_REELS_AI_EDITOR_FORBIDDEN_FIELDS, "syntheticSpokenText", "spokenText", "generatedAudio", "generatedVoice"]) {
  assert(!fixtureText.includes(field), `AI editor fixtures should not contain forbidden field: ${field}.`);
}

const promptInput = buildSocialReelsAiEditorWordEditPromptInput(requestFixture);
const promptText = promptInput.map((message) => String(message.content)).join("\n");
for (const expected of [
  "Do not invent spoken words",
  "Do not generate voice/audio",
  "CutSwitch app resolves final timing locally",
  "Do not return final timestamps as source of truth",
  "Do not return platform/content-risk fields",
]) {
  assert(promptText.includes(expected), `AI editor prompt should include ${expected}.`);
}
assert(promptText.includes("boundedWordWindow"), "AI editor prompt should include boundedWordWindow.");
assert(!promptText.includes("fullTranscript"), "AI editor prompt should not include full transcript payloads.");

const legacyRequest = socialReelsEditAssistantRequestSchema.parse({
  project_hash: "legacy-edit-assistant-09b",
  moment_id: "legacy-moment-09b",
  current_edit_recipe: { edit_mode: "linear", timeline_segments: [] },
  user_instruction: "Start with the hook line.",
  relevant_utterances: [
    {
      utterance_id: "utt-legacy-context",
      speaker_label: "Speaker 1",
      start_seconds: 1,
      end_seconds: 5,
      text: "This gives the clip enough context before the hook.",
    },
    {
      utterance_id: "utt-legacy-hook",
      speaker_label: "Speaker 1",
      start_seconds: 8,
      end_seconds: 12,
      text: "This is the hook line that should open the reel.",
    },
  ],
  relevant_word_refs: [
    {
      word_id: "legacy-word-001",
      utterance_id: "utt-legacy-hook",
      start_seconds: 8,
      end_seconds: 8.2,
      text: "This",
    },
  ],
  edit_history: [],
});
const legacyResponse = proposeSocialReelsEdit(legacyRequest);
socialReelsEditAssistantResponseSchema.parse(legacyResponse);
assert(legacyResponse.conversation_state === "stateless", "Legacy edit endpoint behavior should remain compatible.");
assert(legacyResponse.needs_user_confirmation === true, "Legacy edit endpoint should still require user confirmation.");

if (failed) {
  process.exit(1);
}

console.log("PASS: social reels AI editor word-edit fixture integration gate passed without a live OpenAI call.");
