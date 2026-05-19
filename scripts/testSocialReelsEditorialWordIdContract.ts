import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildSocialReelsOpenAIPromptInput } from "../lib/socialReelsOpenAIPrompt";
import { socialReelsRequestSchema } from "../lib/socialReelsSchema";
import {
  SOCIAL_REELS_EDITORIAL_WORD_ID_SEGMENT_ROLES,
  SOCIAL_REELS_EDITORIAL_WORD_ID_STATUSES,
  SOCIAL_REELS_EDITORIAL_WORD_ID_VERSION,
  openAISocialReelsEditorialWordIdResponseFormat,
  socialReelsEditorialWordIdResponseSchema,
  validateSocialReelsEditorialWordIdResponseWordIds,
} from "../lib/socialReelsEditorialWordId";

let failed = false;
function assert(condition: unknown, message: string) {
  if (condition) return;
  failed = true;
  console.error(`FAIL: ${message}`);
}

function readJson(path: string) {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8")) as unknown;
}

const requestFixturePath = "docs/contracts/social_reels_editorial_word_id_request.backend_contract_fixture.json";
const responseFixturePath = "docs/contracts/social_reels_editorial_word_id_response.backend_fixture.json";
const pairedWordPacketPath = "docs/contracts/social_reels_editorial_word_id_word_packet.backend_fixture_pair.app_fixture.json";

const requestFixture = socialReelsRequestSchema.parse(readJson(requestFixturePath));
const responseFixture = socialReelsEditorialWordIdResponseSchema.parse(readJson(responseFixturePath));
const pairedWordPacket = readJson(pairedWordPacketPath) as { words?: Array<{ id?: string; word_id?: string }> };

assert(requestFixture.discovery_mode === "editorial_word_id", "Request fixture should use editorial_word_id mode.");
assert(requestFixture.editorial_word_id !== null, "Request fixture should include editorial_word_id options.");
assert(requestFixture.words.length > 0, "Request fixture should include a bounded app-style words packet.");
assert(responseFixture.version === SOCIAL_REELS_EDITORIAL_WORD_ID_VERSION, "Response fixture should use social_reels_editorial_word_id_v1.");
assert(responseFixture.reels.length >= 4, "Response fixture should include ready/trim/extension/client-specific examples.");

const requestWordIds = new Set(requestFixture.words.map((word) => word.word_id));
const pairedWordIds = new Set((pairedWordPacket.words ?? []).map((word) => word.word_id ?? word.id).filter(Boolean));
const responseWordIds = new Set(
  responseFixture.reels.flatMap((reel) => reel.segments.flatMap((segment) => [segment.startWordId, segment.endWordId]))
);
assert([...responseWordIds].every((wordId) => requestWordIds.has(wordId)), "Backend response word IDs should be a subset of backend request fixture word IDs.");
assert([...responseWordIds].every((wordId) => pairedWordIds.has(wordId)), "Backend response word IDs should be a subset of paired app/word-packet fixture word IDs.");
validateSocialReelsEditorialWordIdResponseWordIds(responseFixture, requestFixture.words);
const inventedWordIdFixture = structuredClone(responseFixture);
inventedWordIdFixture.reels[0].segments[0].startWordId = "w_not_in_request_packet";
const inventedWordIdRejected = (() => {
  try {
    validateSocialReelsEditorialWordIdResponseWordIds(inventedWordIdFixture, requestFixture.words);
    return false;
  } catch {
    return true;
  }
})();
assert(inventedWordIdRejected, "Invented response word IDs should fail contract validation.");

assert(
  responseFixture.reels.some((reel) => reel.editorialStatus === "ready") &&
    responseFixture.reels.some((reel) => reel.editorialStatus === "needs_trim") &&
    responseFixture.reels.some((reel) => reel.editorialStatus === "needs_extension"),
  "Response fixture should include ready, needs_trim, and needs_extension editorial statuses."
);
assert(
  responseFixture.reels.some((reel) => reel.segments.some((segment) => segment.role === "hook")) &&
    responseFixture.reels.some((reel) => reel.segments.some((segment) => segment.role === "context")) &&
    responseFixture.reels.some((reel) => reel.segments.some((segment) => segment.role === "payoff")),
  "Response fixture should include hook/context/payoff segment structure."
);
assert(
  responseFixture.reels.every((reel) => SOCIAL_REELS_EDITORIAL_WORD_ID_STATUSES.includes(reel.editorialStatus)) &&
    responseFixture.reels.every((reel) => reel.segments.every((segment) => SOCIAL_REELS_EDITORIAL_WORD_ID_SEGMENT_ROLES.includes(segment.role))),
  "Editorial statuses and segment roles should match the app contract enum values."
);
assert(
  responseFixture.reels.every((reel) => {
    const scoreKeys = Object.keys(reel.editorialScores).sort().join(",");
    return scoreKeys === "captionClarity,hook,overall,payoff,selfContained";
  }),
  "Editorial score fields should remain stable and documented."
);
assert(
  responseFixture.reels.some((reel) => reel.clientMomentId === "editorial-word-id-client-specific-001" && reel.editorialStatus === "ready"),
  "Explicit/client-specific material should not be rejected by topic in the editorial word-ID fixture."
);
assert(
  responseFixture.reels.some((reel) => reel.clientMomentId === "editorial-word-id-extension-001" && reel.editorialStatus === "needs_extension"),
  "Incomplete endings should use needs_extension without risk/rejection labels."
);

const responseFormat = openAISocialReelsEditorialWordIdResponseFormat(requestFixture.editorial_word_id?.max_reels ?? 20);
assert(responseFormat.strict === true, "Editorial word-ID provider response should use strict structured output.");
assert(
  JSON.stringify(responseFormat.schema).includes(SOCIAL_REELS_EDITORIAL_WORD_ID_VERSION),
  "Editorial word-ID Structured Output schema should emit the contract version."
);

const promptInput = buildSocialReelsOpenAIPromptInput(requestFixture, {
  discoveryMode: "editorial_word_id",
  requestedCandidateCount: 30,
  effectiveCandidateCount: requestFixture.editorial_word_id?.max_reels ?? 20,
  durationWindows: [],
});
const promptText = promptInput.map((message) => String(message.content)).join("\n");
for (const expected of [
  "social_reels_editorial_word_id_v1",
  "startWordId",
  "endWordId",
  "strongest hook",
  "conversational bridge starts",
  "unanswered question",
  "title must match",
]) {
  assert(promptText.includes(expected), `Editorial word-ID prompt should include ${expected}.`);
}

const forbiddenFields = [
  "platformRisk",
  "riskReason",
  "highRiskHighReward",
  "advertiserSafety",
  "brandSafety",
  "contentSafetyScore",
  "sexualRisk",
  "controversyRisk",
];
const fixtureAndSchemaText = [
  JSON.stringify(responseFixture),
  JSON.stringify(responseFormat.schema),
  JSON.stringify(pairedWordPacket),
  promptText,
].join("\n");
for (const field of forbiddenFields) {
  assert(!fixtureAndSchemaText.includes(field), `Editorial word-ID fixture/schema should not contain forbidden field ${field}.`);
}

const legacyRequest = socialReelsRequestSchema.parse({
  project_hash: "legacy-live-shortlist-compat-smoke",
  duration_preferences: ["30s"],
  requested_candidate_count: 30,
  utterances: [
    {
      utterance_id: "utt-legacy-001",
      speaker_label: "Speaker 1",
      start_seconds: 1,
      end_seconds: 35,
      start_timecode: "00:00:01:00",
      end_timecode: "00:00:35:00",
      text: "A legacy request still parses without editorial word IDs.",
    },
  ],
});
assert(legacyRequest.editorial_word_id === null, "Legacy live_shortlist request should not become editorial_word_id mode.");

const matrixRequest = socialReelsRequestSchema.parse({
  project_hash: "matrix-compat-smoke",
  duration_preferences: ["30s"],
  requested_targets: [{ style: "emotional", duration: "30s", max_candidates: 3 }],
  utterances: [
    {
      utterance_id: "utt-matrix-001",
      speaker_label: "Speaker 1",
      start_seconds: 1,
      end_seconds: 35,
      start_timecode: "00:00:01:00",
      end_timecode: "00:00:35:00",
      text: "A matrix request still parses without editorial word IDs.",
    },
  ],
});
assert(matrixRequest.discovery_matrix !== null, "Matrix request compatibility should be preserved.");
assert(matrixRequest.editorial_word_id === null, "Matrix request should not silently become editorial_word_id mode.");

const durationFirstRequest = socialReelsRequestSchema.parse({
  project_hash: "duration-first-compat-smoke",
  requested_duration_buckets: [{ duration_target: "30s", max_candidates: 3 }],
  utterances: [
    {
      utterance_id: "utt-duration-first-001",
      speaker_label: "Speaker 1",
      start_seconds: 1,
      end_seconds: 35,
      start_timecode: "00:00:01:00",
      end_timecode: "00:00:35:00",
      text: "A duration-first request still parses without editorial word IDs.",
    },
  ],
});
assert(durationFirstRequest.duration_first_manifest !== null, "Duration-first request compatibility should be preserved.");
assert(durationFirstRequest.editorial_word_id === null, "Duration-first request should not silently become editorial_word_id mode.");

const artifactText = [
  readFileSync(resolve(process.cwd(), requestFixturePath), "utf8"),
  readFileSync(resolve(process.cwd(), responseFixturePath), "utf8"),
  readFileSync(resolve(process.cwd(), pairedWordPacketPath), "utf8"),
].join("\n");
for (const forbiddenLeak of ["wordAlignment", "whisper", "pyannote", "/Users/", "file://", "OPENAI_API_KEY", "Bearer "]) {
  assert(!artifactText.includes(forbiddenLeak), `Editorial word-ID contract fixtures should not include private detail: ${forbiddenLeak}.`);
}

if (failed) {
  process.exit(1);
}

console.log("PASS: social reels editorial word-ID contract fixture tests passed without a live OpenAI call.");
