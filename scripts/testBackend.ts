import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { socialReelsRequestSchema } from "../lib/socialReelsSchema";
import { buildSocialReelsLiveDurationWindows } from "../lib/socialReelsDurationWindows";
import { estimateSocialReelsDurationFirstCredits } from "../lib/socialReelsCreditEstimator";
import {
  SOCIAL_REELS_AI_EDITOR_WORD_EDIT_SYSTEM_PROMPT,
  buildSocialReelsEditAssistantPromptInput,
  buildSocialReelsAiEditorWordEditPromptInput,
  proposeSocialReelsEdit,
  proposeSocialReelsAiEditorWordEdit,
  SocialReelsAiEditorWordEditProviderError,
  socialReelsAiEditorWordEditRequestSchema,
  socialReelsAiEditorWordEditResponseSchema,
  socialReelsEditAssistantRequestSchema,
  socialReelsEditAssistantResponseSchema,
  validateSocialReelsAiEditorWordEditResponseWordIds,
} from "../lib/socialReelsEditAssistant";
import { runOpenAIProbeLadder } from "./openAIProbeLadder";

type ApiResult = {
  ok: boolean;
  status: number | "NETWORK_ERROR";
  body: unknown;
};

const DEFAULT_BASE_URL = "https://cutswitch-site.vercel.app";

loadDotEnvLocal();

const baseUrl = (process.env.TEST_BACKEND_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;
const checkoutPlanId = process.env.TEST_CHECKOUT_PLAN_ID || "starter";
const transcriptDuration = Number(process.env.TEST_TRANSCRIPT_DURATION_SECONDS || 7);
const testProductEvents = process.env.TEST_PRODUCT_EVENTS === "1";
const testSocialReels = process.env.TEST_SOCIAL_REELS === "1";
const testSocialReelsLive = process.env.TEST_SOCIAL_REELS_LIVE === "1";
const testSocialReelsLiveAppScale = process.env.TEST_SOCIAL_REELS_LIVE_APP_SCALE === "1";
const testOpenAIProbe = process.env.TEST_OPENAI_PROBE === "1";

let failed = false;

function loadDotEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  const envFile = readFileSync(envPath, "utf8");
  for (const line of envFile.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const [key, ...valueParts] = trimmed.split("=");
    const value = valueParts.join("=").replace(/^[']|[']$/g, "").replace(/^["]|["]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function markFailed(message: string) {
  failed = true;
  console.error(`FAIL: ${message}`);
}

function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => {
      if (/access_token|refresh_token|token|password|secret/i.test(key)) {
        return [key, entryValue ? "[present]" : entryValue];
      }
      return [key, redactSecrets(entryValue)];
    })
  );
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function post(url: string, init: RequestInit): Promise<ApiResult> {
  try {
    const res = await fetch(url, { method: "POST", ...init });
    return { ok: res.ok, status: res.status, body: await readBody(res) };
  } catch (error) {
    return {
      ok: false,
      status: "NETWORK_ERROR",
      body: error instanceof Error ? error.message : String(error),
    };
  }
}

function logResult(label: string, result: ApiResult) {
  console.log(`${label} STATUS:`, result.status);

  if (typeof result.body === "string") {
    const body = result.body.length > 1200 ? `${result.body.slice(0, 1200)}\n...[truncated ${result.body.length - 1200} chars]` : result.body;
    console.log(`${label}:`, body);
    return;
  }

  console.log(`${label}:`, JSON.stringify(redactSecrets(result.body), null, 2));
}

function numberField(body: unknown, key: string): number | null {
  if (!body || typeof body !== "object" || !(key in body)) return null;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "number" ? value : null;
}

function booleanField(body: unknown, key: string): boolean | null {
  if (!body || typeof body !== "object" || !(key in body)) return null;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "boolean" ? value : null;
}

function makeSocialReelsSmokeText() {
  const sentences = [
    "CutSwitch helps editors find the strongest moments in a long conversation without guessing where the story begins.",
    "The best clip usually starts when someone makes a clear claim and ends when they land the payoff with a memorable line.",
    "This smoke segment gives the backend enough transcript density to choose anchors for short reels and longer highlights.",
    "The speaker explains a practical lesson, shares a transformation, challenges a common belief, and gives producers a reason to keep watching.",
    "A good social moment has context, escalation, and a clean final thought that can stand alone outside the full episode.",
  ];

  return Array.from({ length: 3 }, () => sentences.join(" ")).join(" ");
}

function makeTinyLiveSocialReelsSegments() {
  const safeSegments = [
    [
      "The opening claim is that a great social clip makes one promise and then keeps it before the viewer has time to drift.",
      "The first question is why some clips feel complete while sharper quotes still feel unfinished when they are posted alone.",
      "The tension comes from the fact that transcript search can find a clever sentence, but it cannot prove the audience understands the stakes.",
      "A producer needs the first twenty seconds to name the problem, because otherwise the payoff has nothing to push against.",
      "Around the middle of the minute, the speaker should turn the idea and explain why the obvious shortcut creates weaker edits.",
      "That turn matters because cutting only the punchline removes the pressure that made the punchline satisfying.",
      "The answer is to keep enough spoken context that the viewer can feel the setup, the friction, the decision, and the consequence.",
      "Near the end of the span, the point becomes clear: duration is not filler, duration is the room where the payoff earns trust.",
      "The closing reframe is that a sixty second reel is not a stretched highlight, it is a compact story with a door that closes.",
      "That final beat gives the editor permission to stop instead of trailing into the next topic.",
    ].join(" "),
    [
      "The opening question is whether automation should find the fastest cut or the moment that actually deserves to move fast.",
      "A random quote can sound impressive for a few seconds, but it collapses because the viewer never learns what was at risk.",
      "The stronger story beat starts with a claim, reveals why the claim is harder than it sounds, and then turns the corner.",
      "The pressure builds when the speaker admits that faster tools can create faster mistakes if the moment is chosen badly.",
      "Around the first minute, the useful distinction appears: speed helps only after the edit has a clear reason to exist.",
      "That distinction gives the clip a middle, because now the viewer is comparing two kinds of efficiency instead of hearing a slogan.",
      "The answer is that automation should protect editorial judgment, not replace the human decision about what is worth sharing.",
      "Near the end, the speaker lands the practical lesson: the best tool removes busywork so the editor can spend attention on taste.",
      "The reframe is that CutSwitch should surface complete story beats before anyone starts trimming by hand.",
      "The payoff is a clean sentence the audience can remember: faster is only valuable when the moment is already worth the speed.",
    ].join(" "),
    [
      "The opening question is how to write a title that creates curiosity without making a promise the clip cannot honestly keep.",
      "A misleading title gets the first click and loses the second viewer, because the audience feels the gap before the story resolves.",
      "The tension is that truthful titles can sound flat, while dramatic titles can outrun the actual idea.",
      "The better approach is to ask what question the viewer will carry into the first three seconds and what answer will satisfy it.",
      "Around the middle, the speaker explains that the title should point at a conflict already present in the clip, not invent a conflict from outside it.",
      "That gives the editor a practical test: if the title disappears when the ending is removed, the clip probably has a real payoff.",
      "The answer is to pair a specific question with a clean ending so the title and the final line support each other.",
      "Near the end, the reframe lands: a good title is not a trick, it is a map to the tension the viewer is about to feel.",
      "If the ending does not land, the candidate should be rejected instead of padded into the list.",
      "The payoff is that a good reel has a hook, a turn, and a final thought that makes sense without the entire episode.",
    ].join(" "),
  ];

  return safeSegments.map((text, index) => ({
    segment_id: `tiny-live-seg-${index + 1}`,
    start_seconds: index * 210,
    end_seconds: index * 210 + 210,
    speaker: "Speaker 1",
    text,
  }));
}

function makeTinyLiveSocialReelsPayload(projectHash: string) {
  const segments = makeTinyLiveSocialReelsSegments();

  return {
    project_hash: projectHash,
    source_duration_seconds: Math.ceil(Math.max(...segments.map((segment) => segment.end_seconds))),
    duration_preferences: ["60s"],
    requested_candidate_count: 30,
    style: "balanced",
    layout: "vertical",
    caption_style: "bold",
    episode_metadata: { title: "Tiny live social reels canary" },
    context: { platform: "social", content_notes: "Synthetic tiny live canary only." },
    segments,
  };
}

function makeAppScaleLiveSocialReelsPayload(projectHash: string) {
  const sentence = [
    "The question is why a strong idea can still fail as a reel when the viewer does not know what is at stake.",
    "The tension grows because a compact quote feels efficient to an editor, but the audience needs context before the payoff matters.",
    "The answer begins when the speaker explains that a one minute clip needs a claim, a complication, and a clean landing.",
    "The reframe is that duration is not padding; it is the shape that lets the ending feel earned instead of abrupt.",
    "The payoff is a practical editorial rule: keep enough story pressure for the final line to make sense on its own.",
  ].join(" ");
  const segments = Array.from({ length: 68 }, (_, index) => ({
    segment_id: `app-scale-live-seg-${String(index + 1).padStart(2, "0")}`,
    start_seconds: index * 90,
    end_seconds: index * 90 + 90,
    speaker: "Speaker 1",
    text: Array.from({ length: 2 }, () => sentence).join(" "),
  }));

  return {
    project_hash: projectHash,
    source_duration_seconds: Math.ceil(Math.max(...segments.map((segment) => segment.end_seconds))),
    duration_preferences: ["60s"],
    requested_candidate_count: 30,
    style: "balanced",
    layout: "vertical",
    caption_style: "bold",
    episode_metadata: { title: "App-scale live social reels canary" },
    context: { platform: "social", content_notes: "Synthetic app-scale live canary only." },
    segments,
  };
}

function validateTinyLiveCanaryFixture() {
  const parsed = socialReelsRequestSchema.parse(makeTinyLiveSocialReelsPayload("codex-social-live-fixture"));
  const segmentDurations = parsed.segments.map((segment) => segment.end_seconds - segment.start_seconds);
  const allSegmentsDurationRealistic = segmentDurations.every((duration) => duration >= 180 && duration <= 240);
  if (!allSegmentsDurationRealistic) {
    markFailed("Tiny live social reels fixture segments must each be 180-240 seconds.");
  }

  const eligibleWindows = buildSocialReelsLiveDurationWindows(
    {
      ...parsed,
      requested_candidate_count: 10,
    },
    10
  ).filter((window) => window.duration_bucket === "60s");

  if (eligibleWindows.length < 10) {
    markFailed("Tiny live social reels fixture must provide at least 10 eligible 60s duration windows.");
  }
}

function validateAppScaleLiveCanaryFixture() {
  const parsed = socialReelsRequestSchema.parse(makeAppScaleLiveSocialReelsPayload("codex-social-live-app-scale-fixture"));
  if (parsed.segments.length < 60 || parsed.segments.length > 70) {
    markFailed("App-scale live social reels fixture must include 60-70 synthetic segments.");
  }

  const textLengths = parsed.segments.map((segment) => segment.text.length);
  if (textLengths.some((length) => length < 800 || length > 1200)) {
    markFailed("App-scale live social reels fixture segments must be around 800-1200 chars.");
  }

  const eligibleWindows = buildSocialReelsLiveDurationWindows(
    {
      ...parsed,
      requested_candidate_count: 10,
    },
    10
  ).filter((window) => window.duration_bucket === "60s");

  if (eligibleWindows.length < 68) {
    markFailed("App-scale live social reels fixture must provide many eligible 60s duration windows.");
  }
}

function validateSocialReelsCreditEstimator() {
  const baseEstimate = estimateSocialReelsDurationFirstCredits({
    duration_buckets: ["15s", "30s", "60s"],
    episode_duration_seconds: 6287.8,
    speaker_count: 3,
    requested_max_per_bucket: 20,
  }).credit_estimate;

  if (baseEstimate.total_credits !== 12) {
    markFailed("Social Reels credit estimate should match the documented base + three short-duration example.");
  }

  if (baseEstimate.billing_mode !== "estimate_only" || baseEstimate.charge_now !== false) {
    markFailed("Social Reels credit estimate must be estimate-only and never charge credits.");
  }

  if (!baseEstimate.line_items.some((item) => item.name === "Base podcast analysis" && item.credits === 6)) {
    markFailed("Social Reels credit estimate should include the base podcast analysis line item.");
  }

  const fewerDurations = estimateSocialReelsDurationFirstCredits({
    duration_buckets: ["15s"],
    episode_duration_seconds: 6287.8,
    speaker_count: 3,
    requested_max_per_bucket: 20,
  }).credit_estimate;
  if (baseEstimate.total_credits <= fewerDurations.total_credits) {
    markFailed("Adding Social Reels duration buckets should increase the credit estimate.");
  }

  const longClipEstimate = estimateSocialReelsDurationFirstCredits({
    duration_buckets: ["5_to_10m"],
    episode_duration_seconds: 6287.8,
    speaker_count: 3,
    requested_max_per_bucket: 20,
  }).credit_estimate;
  const shortClipEstimate = estimateSocialReelsDurationFirstCredits({
    duration_buckets: ["15s"],
    episode_duration_seconds: 6287.8,
    speaker_count: 3,
    requested_max_per_bucket: 20,
  }).credit_estimate;
  const longClipItem = longClipEstimate.line_items.find((item) => item.name === "5-10m candidates");
  const shortClipItem = shortClipEstimate.line_items.find((item) => item.name === "15s candidates");
  if (!longClipItem || !shortClipItem || longClipItem.credits <= shortClipItem.credits) {
    markFailed("Long Social Reels duration buckets should cost more than 15s candidates.");
  }

  const estimateJson = JSON.stringify(baseEstimate);
  for (const forbidden of ["/Users/", "file://", "OPENAI_API_KEY", "Bearer ", "access_token", "refresh_token"]) {
    if (estimateJson.includes(forbidden)) {
      markFailed(`Social Reels credit estimate should not include private data: ${forbidden}.`);
    }
  }
}

function validateSocialReelsEditAssistantContract() {
  const request = socialReelsEditAssistantRequestSchema.parse({
    project_hash: "edit-assistant-backend-smoke",
    moment_id: "moment-blue-balls",
    current_edit_recipe: { edit_mode: "linear", timeline_segments: [] },
    user_instruction: "Start with the blue balls line as the hook, then give it a cleaner ending.",
    relevant_utterances: [
      {
        utterance_id: "utt-context-001",
        speaker_label: "Layla",
        start_seconds: 661,
        end_seconds: 681,
        start_timecode: "00:11:01:00",
        end_timecode: "00:11:21:00",
        text: "The context explains why the body needs movement before the later hook makes sense.",
      },
      {
        utterance_id: "utt-hook-001",
        speaker_label: "Layla",
        start_seconds: 725,
        end_seconds: 733,
        start_timecode: "00:12:05:00",
        end_timecode: "00:12:13:00",
        text: "If you are not moving your energy it can feel like female blue balls.",
      },
      {
        utterance_id: "utt-closing-001",
        speaker_label: "Layla",
        start_seconds: 755,
        end_seconds: 760,
        start_timecode: "00:12:35:00",
        end_timecode: "00:12:40:00",
        text: "That is the clean closing thought that makes the edit land.",
      },
    ],
    relevant_word_refs: [
      {
        word_id: "word-hook-001",
        utterance_id: "utt-hook-001",
        start_seconds: 725,
        end_seconds: 725.4,
        text: "If",
      },
    ],
    edit_history: [],
  });

  if (request.candidate_id !== "moment-blue-balls") {
    markFailed("Social Reels edit assistant should accept moment_id-only requests and normalize candidate_id.");
  }
  if (request.relevant_words.length !== 1) {
    markFailed("Social Reels edit assistant should accept relevant_word_refs as an alias for relevant_words.");
  }

  const prompt = buildSocialReelsEditAssistantPromptInput(request);
  const promptText = JSON.stringify(prompt);
  for (const required of ["Do not invent spoken words", "stateless", "relevant_word_refs", "utt-hook-001", "word-hook-001"]) {
    if (!promptText.includes(required)) {
      markFailed(`Social Reels edit assistant prompt should include ${required}.`);
    }
  }

  const response = proposeSocialReelsEdit(request);
  socialReelsEditAssistantResponseSchema.parse(response);
  if (response.conversation_state !== "stateless" || !response.needs_user_confirmation) {
    markFailed("Social Reels edit assistant response should be explicitly stateless and require user confirmation.");
  }
  if (!response.changed_segments.some((segment) => segment.role === "cold_open_hook" && segment.utterance_ids.includes("utt-hook-001"))) {
    markFailed("Social Reels edit assistant should return a structured hook relocation patch referencing real utterance IDs.");
  }
  if (response.changed_segments.some((segment) => segment.source_end_seconds <= segment.source_start_seconds)) {
    markFailed("Social Reels edit assistant changed segments should reference valid source ranges.");
  }

  const invalidPatch = socialReelsEditAssistantResponseSchema.safeParse({
    ...response,
    changed_segments: [
      {
        ...response.changed_segments[0],
        source_end_seconds: response.changed_segments[0].source_start_seconds,
      },
    ],
  });
  if (invalidPatch.success) {
    markFailed("Social Reels edit assistant schema should reject invalid source ranges.");
  }

  for (const forbidden of ["/Users/", "file://", "OPENAI_API_KEY", "Bearer ", "wordAlignment", "pyannote"]) {
    if (promptText.includes(forbidden) || JSON.stringify(response).includes(forbidden)) {
      markFailed(`Social Reels edit assistant contract should not include private data: ${forbidden}.`);
    }
  }

  const aiEditorRequestFixture = JSON.parse(
    readFileSync(resolve(process.cwd(), "docs/contracts/social_reels_ai_editor_word_edit_request.backend_contract_fixture.json"), "utf8")
  ) as unknown;
  const aiEditorResponseFixture = JSON.parse(
    readFileSync(resolve(process.cwd(), "docs/contracts/social_reels_ai_editor_word_edit_response.backend_fixture.json"), "utf8")
  ) as unknown;
  const parsedAiEditorRequest = socialReelsAiEditorWordEditRequestSchema.parse(aiEditorRequestFixture);
  const parsedAiEditorResponse = socialReelsAiEditorWordEditResponseSchema.parse(aiEditorResponseFixture);
  validateSocialReelsAiEditorWordEditResponseWordIds(parsedAiEditorRequest, parsedAiEditorResponse);
  const aiEditorPromptText = JSON.stringify(buildSocialReelsAiEditorWordEditPromptInput(parsedAiEditorRequest));
  for (const required of [
    "one selected reel only",
    "existing word IDs",
    "Do not invent spoken words",
    "Do not generate voice/audio",
    "CutSwitch app resolves final timing locally",
    "Do not return platform/content-risk fields",
  ]) {
    if (!aiEditorPromptText.includes(required) && !SOCIAL_REELS_AI_EDITOR_WORD_EDIT_SYSTEM_PROMPT.includes(required)) {
      markFailed(`Social Reels AI editor word-edit prompt should include ${required}.`);
    }
  }
  if (aiEditorPromptText.includes("relevant_utterances") || aiEditorPromptText.includes("fullTranscript")) {
    markFailed("Social Reels AI editor word-edit prompt should include boundedWordWindow only, not full transcript payloads.");
  }
  const validAiEditorProposal = proposeSocialReelsAiEditorWordEdit(parsedAiEditorRequest, { providerOutput: parsedAiEditorResponse });
  if (validAiEditorProposal.operations.length !== parsedAiEditorResponse.operations.length) {
    markFailed("Social Reels AI editor word-edit route/provider path should accept valid provider output.");
  }

  const unknownWordResponse = {
    ...parsedAiEditorResponse,
    operations: [{ ...parsedAiEditorResponse.operations[0], sourceStartWordID: "missing-word-id" }],
  };
  try {
    proposeSocialReelsAiEditorWordEdit(parsedAiEditorRequest, { providerOutput: unknownWordResponse });
    markFailed("Social Reels AI editor word-edit provider path should reject unknown word IDs.");
  } catch (error) {
    if (!(error instanceof SocialReelsAiEditorWordEditProviderError)) {
      markFailed("Social Reels AI editor word-edit unknown word failure should be recoverable provider error.");
    }
    // Expected.
  }

  const reversedSpanResponse = {
    ...parsedAiEditorResponse,
    operations: [{ ...parsedAiEditorResponse.operations[0], sourceStartWordID: "w006", sourceEndWordID: "w003" }],
  };
  try {
    proposeSocialReelsAiEditorWordEdit(parsedAiEditorRequest, { providerOutput: reversedSpanResponse });
    markFailed("Social Reels AI editor word-edit provider path should reject reversed word spans.");
  } catch (error) {
    if (!(error instanceof SocialReelsAiEditorWordEditProviderError)) {
      markFailed("Social Reels AI editor word-edit reversed span failure should be recoverable provider error.");
    }
    // Expected.
  }

  if (
    socialReelsAiEditorWordEditResponseSchema.safeParse({
      ...parsedAiEditorResponse,
      operations: [{ ...parsedAiEditorResponse.operations[0], spokenText: "New generated spoken line." }],
    }).success
  ) {
    markFailed("Social Reels AI editor word-edit schema should reject synthetic spoken text fields.");
  }

  if (socialReelsAiEditorWordEditResponseSchema.safeParse({ ...parsedAiEditorResponse, platformRisk: "not_allowed" }).success) {
    markFailed("Social Reels AI editor word-edit schema should reject platform/content risk fields.");
  }

  const ambiguousAiEditorRequest = socialReelsAiEditorWordEditRequestSchema.parse({
    ...parsedAiEditorRequest,
    requestID: "ai-editor-backend-ambiguous",
    userInstruction: "change the hook",
  });
  const ambiguousAiEditorResponse = proposeSocialReelsAiEditorWordEdit(ambiguousAiEditorRequest);
  if (!ambiguousAiEditorResponse.needsNarrowerInstruction) {
    markFailed("Social Reels AI editor word-edit ambiguous instruction should return needsNarrowerInstruction.");
  }
}

function safeSocialReelsResponseSummary(body: unknown) {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const candidates = Array.isArray(record.candidates) ? record.candidates : [];
  return {
    ok: record.ok,
    request_id: record.request_id,
    discovery_mode: record.discovery_mode,
    requested_candidate_count: record.requested_candidate_count,
    effective_candidate_count: record.effective_candidate_count,
    eligible_duration_window_count: record.eligible_duration_window_count,
    windows_after_quality_filter: record.windows_after_quality_filter,
    excluded_window_reason_counts: record.excluded_window_reason_counts,
    average_window_quality_score: record.average_window_quality_score,
    duration_window_count_sent_to_model: record.duration_window_count_sent_to_model,
    prompt_context_char_count_sent_to_model: record.prompt_context_char_count_sent_to_model,
    returned_candidate_count: record.returned_candidate_count,
    filtered_candidate_count: record.filtered_candidate_count,
    live_filter_reasons: record.live_filter_reasons,
    returned_duration_seconds_range: record.returned_duration_seconds_range ?? durationRange(candidates),
    provider: record.provider,
    model: record.model,
    mock: record.mock,
    candidate_count: candidates.length,
    diagnostics:
      record.diagnostics && typeof record.diagnostics === "object"
        ? {
            openai_elapsed_ms: (record.diagnostics as Record<string, unknown>).openai_elapsed_ms,
            response_parse_ms: (record.diagnostics as Record<string, unknown>).response_parse_ms,
            timeout_stage: (record.diagnostics as Record<string, unknown>).timeout_stage,
          }
        : null,
    invalid_response_diagnostics: record.invalid_response_diagnostics,
  };
}

function logSafeSocialReelsSummary(label: string, result: ApiResult) {
  console.log(`${label} STATUS:`, result.status);
  console.log(`${label}_SUMMARY:`, JSON.stringify(redactSecrets(safeSocialReelsResponseSummary(result.body)), null, 2));
}

function durationFitsSocialReelsBucket(bucket: unknown, duration: unknown) {
  if (typeof bucket !== "string" || typeof duration !== "number") return false;
  if (bucket === "15s") return duration >= 10 && duration <= 22;
  if (bucket === "30s") return duration >= 22 && duration <= 42;
  if (bucket === "60s") return duration >= 45 && duration <= 78;
  if (bucket === "90s") return duration >= 70 && duration <= 115;
  if (bucket === "5-10m") return duration >= 240 && duration <= 660;
  return false;
}

function durationRange(candidates: unknown[]) {
  const durations = candidates
    .map((candidate) =>
      candidate && typeof candidate === "object" && typeof (candidate as Record<string, unknown>).duration_seconds === "number"
        ? ((candidate as Record<string, unknown>).duration_seconds as number)
        : null
    )
    .filter((duration): duration is number => typeof duration === "number" && Number.isFinite(duration));

  if (durations.length === 0) return { min: null, max: null };
  return { min: Math.min(...durations), max: Math.max(...durations) };
}

if (testOpenAIProbe) {
  const probePassed = await runOpenAIProbeLadder();
  if (!probePassed) markFailed("OpenAI probe ladder failed. See OPENAI_PROBE_RESULT above for the first failing stage.");
}

validateTinyLiveCanaryFixture();
validateAppScaleLiveCanaryFixture();
validateSocialReelsCreditEstimator();
validateSocialReelsEditAssistantContract();

if (!email || !password) {
  markFailed("Set TEST_EMAIL and TEST_PASSWORD in .env.local or your shell.");
  process.exitCode = 1;
} else {
  const unauthCheckout = await post(`${baseUrl}/api/billing/checkout`, {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planId: checkoutPlanId }),
  });
  logResult("CHECKOUT_UNAUTHENTICATED", unauthCheckout);
  if (unauthCheckout.status !== 401) markFailed("Unauthenticated checkout did not return 401.");

  const unauthPortal = await post(`${baseUrl}/api/billing/portal`, { headers: {} });
  logResult("BILLING_PORTAL_UNAUTHENTICATED", unauthPortal);
  if (unauthPortal.status !== 401) markFailed("Unauthenticated billing portal did not return 401.");

  const unauthTranscript = await post(`${baseUrl}/api/transcripts/complete`, {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectFingerprint: "codex-unauth-project",
      audioFingerprint: "codex-unauth-audio",
      durationSeconds: 1,
      speakerCount: 1,
      providerJobId: null,
      status: "succeeded",
    }),
  });
  logResult("TRANSCRIPT_UNAUTHENTICATED", unauthTranscript);
  if (unauthTranscript.status !== 401) markFailed("Unauthenticated transcript completion did not return 401.");

  if (testProductEvents) {
    const unauthProductEvent = await post(`${baseUrl}/api/product-events`, {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: "app_opened" }),
    });
    logResult("PRODUCT_EVENT_UNAUTHENTICATED", unauthProductEvent);
    if (unauthProductEvent.status !== 401) markFailed("Unauthenticated product event did not return 401.");
  }

  if (testSocialReels || testSocialReelsLive || testSocialReelsLiveAppScale) {
    const unauthSocialReels = await post(`${baseUrl}/api/social-reels/discover`, {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    logResult("SOCIAL_REELS_UNAUTHENTICATED", unauthSocialReels);
    if (unauthSocialReels.status !== 401) markFailed("Unauthenticated social reels discovery did not return 401.");
  }

  const login = await post(`${baseUrl}/api/app/session`, {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      deviceName: "Codex Test",
      deviceFingerprint: "codex-test-001",
    }),
  });
  logResult("LOGIN", login);

  const token =
    login.body &&
    typeof login.body === "object" &&
    "access_token" in login.body &&
    typeof login.body.access_token === "string"
      ? login.body.access_token
      : undefined;
  const refreshToken =
    login.body &&
    typeof login.body === "object" &&
    "refresh_token" in login.body &&
    typeof login.body.refresh_token === "string"
      ? login.body.refresh_token
      : undefined;

  console.log("ACCESS_TOKEN_PRESENT:", Boolean(token));
  console.log("REFRESH_TOKEN_PRESENT:", Boolean(refreshToken));
  if (!login.ok) markFailed("Login request failed.");
  if (!token) markFailed("Login response did not include access_token.");
  if (!refreshToken) markFailed("Login response did not include refresh_token.");

  const invalidRefresh = await post(`${baseUrl}/api/app/session/refresh`, {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: "not-a-valid-refresh-token" }),
  });
  logResult("REFRESH_INVALID", invalidRefresh);
  if (invalidRefresh.status !== 401) markFailed("Invalid refresh token did not return 401.");

  if (refreshToken) {
    const refresh = await post(`${baseUrl}/api/app/session/refresh`, {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    logResult("REFRESH", refresh);
    const refreshedToken =
      refresh.body &&
      typeof refresh.body === "object" &&
      "access_token" in refresh.body &&
      typeof refresh.body.access_token === "string"
        ? refresh.body.access_token
        : undefined;
    console.log("REFRESH_ACCESS_TOKEN_PRESENT:", Boolean(refreshedToken));
    if (!refresh.ok || !refreshedToken) markFailed("Valid refresh did not return a new access_token.");
  }

  if (token) {
    if (testProductEvents) {
      const invalidProductEvent = await post(`${baseUrl}/api/product-events`, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ event_type: "not_a_product_event" }),
      });
      logResult("PRODUCT_EVENT_INVALID", invalidProductEvent);
      if (invalidProductEvent.status !== 400) markFailed("Invalid product event did not return 400.");

      const productEvent = await post(`${baseUrl}/api/product-events`, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          event_type: "app_opened",
          screen: "Codex Smoke",
          app_version: "codex-test",
          project_fingerprint: `codex-product-${Date.now()}`,
          metadata_json: { source: "testBackend" },
        }),
      });
      logResult("PRODUCT_EVENT", productEvent);
      if (!productEvent.ok) markFailed("Valid product event did not insert successfully.");
    } else {
      console.log("PRODUCT_EVENTS: skipped. Set TEST_PRODUCT_EVENTS=1 after applying the product_events migration.");
    }

    if (testSocialReelsLive) {
      const tinyLiveSocialReels = await post(`${baseUrl}/api/social-reels/discover`, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(makeTinyLiveSocialReelsPayload(`codex-social-live-tiny-${Date.now()}`)),
      });
      logResult("SOCIAL_REELS_TINY_LIVE", tinyLiveSocialReels);

      const body = tinyLiveSocialReels.body;
      const candidates =
        body && typeof body === "object" && "candidates" in body && Array.isArray(body.candidates) ? body.candidates : [];
      const mock = booleanField(body, "mock");
      const effectiveCandidateCount = numberField(body, "effective_candidate_count");
      const requestedCandidateCount = numberField(body, "requested_candidate_count");
      const returnedCandidateCount = numberField(body, "returned_candidate_count");
      const filteredCandidateCount = numberField(body, "filtered_candidate_count");
      const eligibleDurationWindowCount = numberField(body, "eligible_duration_window_count");
      const windowsAfterQualityFilter = numberField(body, "windows_after_quality_filter");
      const demotedWindowReasonCounts =
        body && typeof body === "object" && "demoted_window_reason_counts" in body
          ? (body as Record<string, unknown>).demoted_window_reason_counts
          : null;
      const selectedWindowQualityRange =
        body && typeof body === "object" && "selected_window_quality_range" in body
          ? (body as Record<string, unknown>).selected_window_quality_range
          : null;
      const liveFilterReasons =
        body && typeof body === "object" && "live_filter_reasons" in body
          ? (body as Record<string, unknown>).live_filter_reasons
          : null;
      const returnedDurationRange =
        body && typeof body === "object" && "returned_duration_seconds_range" in body
          ? (body as Record<string, unknown>).returned_duration_seconds_range
          : durationRange(candidates);
      const discoveryMode =
        body && typeof body === "object" && "discovery_mode" in body ? (body as Record<string, unknown>).discovery_mode : null;
      console.log(
        "SOCIAL_REELS_TINY_LIVE_SUMMARY:",
        JSON.stringify(
          {
            requested_candidate_count: requestedCandidateCount,
            effective_candidate_count: effectiveCandidateCount,
            eligible_duration_window_count: eligibleDurationWindowCount,
            windows_after_quality_filter: windowsAfterQualityFilter,
            demoted_window_reason_counts: demotedWindowReasonCounts,
            selected_window_quality_range: selectedWindowQualityRange,
            returned_candidate_count: returnedCandidateCount,
            filtered_candidate_count: filteredCandidateCount,
            live_filter_reasons: liveFilterReasons,
            returned_duration_seconds_range: returnedDurationRange,
          },
          null,
          2
        )
      );
      if (!tinyLiveSocialReels.ok || effectiveCandidateCount !== 10 || requestedCandidateCount !== 30) {
        markFailed("Tiny live social reels canary did not use the 10-candidate live shortlist request.");
      }
      if (eligibleDurationWindowCount === null || eligibleDurationWindowCount < 10) {
        markFailed("Tiny live social reels canary did not report enough eligible duration windows.");
      }
      if (windowsAfterQualityFilter === null || windowsAfterQualityFilter <= 0) {
        markFailed("Tiny live social reels canary did not report window quality filtering metadata.");
      }
      if (returnedCandidateCount !== candidates.length) {
        markFailed("Tiny live social reels canary returned_candidate_count did not match candidates length.");
      }
      if (filteredCandidateCount === null || filteredCandidateCount < 0) {
        markFailed("Tiny live social reels canary did not return safe filtered_candidate_count metadata.");
      }
      const invalidLiveDurations = candidates.some((candidate) => {
        if (!candidate || typeof candidate !== "object") return true;
        const record = candidate as Record<string, unknown>;
        return !durationFitsSocialReelsBucket(record.duration_bucket, record.duration_seconds);
      });
      if (invalidLiveDurations) {
        markFailed("Tiny live social reels canary returned candidates outside their live duration bucket range.");
      }
      if (discoveryMode !== "live_shortlist") {
        markFailed("Tiny live social reels canary did not use live_shortlist discovery mode.");
      }
      if (mock !== false) {
        markFailed("Tiny live social reels canary did not use the live provider. Confirm SOCIAL_REELS_OPENAI_MODE=live in the target environment.");
      }
    }

    if (testSocialReelsLiveAppScale) {
      const appScaleLiveSocialReels = await post(`${baseUrl}/api/social-reels/discover`, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(makeAppScaleLiveSocialReelsPayload(`codex-social-live-app-scale-${Date.now()}`)),
      });
      logSafeSocialReelsSummary("SOCIAL_REELS_APP_SCALE_LIVE", appScaleLiveSocialReels);

      const body = appScaleLiveSocialReels.body;
      const candidates =
        body && typeof body === "object" && "candidates" in body && Array.isArray(body.candidates) ? body.candidates : [];
      const mock = booleanField(body, "mock");
      const effectiveCandidateCount = numberField(body, "effective_candidate_count");
      const requestedCandidateCount = numberField(body, "requested_candidate_count");
      const durationWindowCountSentToModel = numberField(body, "duration_window_count_sent_to_model");
      const promptContextCharCountSentToModel = numberField(body, "prompt_context_char_count_sent_to_model");
      const selectedWindowQualityRange =
        body && typeof body === "object" && "selected_window_quality_range" in body
          ? (body as Record<string, unknown>).selected_window_quality_range
          : null;
      if (selectedWindowQualityRange) {
        console.log("SOCIAL_REELS_APP_SCALE_LIVE_SELECTED_WINDOW_QUALITY_RANGE:", JSON.stringify(selectedWindowQualityRange));
      }
      const discoveryMode =
        body && typeof body === "object" && "discovery_mode" in body ? (body as Record<string, unknown>).discovery_mode : null;

      if (!appScaleLiveSocialReels.ok || effectiveCandidateCount !== 10 || requestedCandidateCount !== 30) {
        markFailed("App-scale live social reels canary did not use the 10-candidate live shortlist request.");
      }
      if (durationWindowCountSentToModel === null || durationWindowCountSentToModel > 24) {
        markFailed("App-scale live social reels canary sent too many duration windows to the model.");
      }
      if (promptContextCharCountSentToModel === null || promptContextCharCountSentToModel > 35_000) {
        markFailed("App-scale live social reels prompt context was not bounded.");
      }
      if (discoveryMode !== "live_shortlist") {
        markFailed("App-scale live social reels canary did not use live_shortlist discovery mode.");
      }
      if (mock !== false) {
        markFailed("App-scale live social reels canary did not use the live provider. Confirm SOCIAL_REELS_OPENAI_MODE=live.");
      }
      const invalidLiveDurations = candidates.some((candidate) => {
        if (!candidate || typeof candidate !== "object") return true;
        const record = candidate as Record<string, unknown>;
        return !durationFitsSocialReelsBucket(record.duration_bucket, record.duration_seconds);
      });
      if (invalidLiveDurations) {
        markFailed("App-scale live social reels canary returned candidates outside their live duration bucket range.");
      }
    }

    if (testSocialReels) {
      const socialReelsSmokeText = makeSocialReelsSmokeText();
      const invalidSocialReels = await post(`${baseUrl}/api/social-reels/discover`, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          source_duration_seconds: 1800,
          project_hash: "codex-social-invalid",
          duration_preferences: ["not-a-duration"],
          requested_candidate_count: 2,
          style: "balanced",
          layout: "vertical",
          caption_style: "bold",
          episode_metadata: {},
          segments: [],
        }),
      });
      logResult("SOCIAL_REELS_INVALID", invalidSocialReels);
      if (invalidSocialReels.status !== 400) markFailed("Invalid social reels payload did not return 400.");

      const socialReels = await post(`${baseUrl}/api/social-reels/discover`, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          project_hash: `codex-social-${Date.now()}`,
          source_duration_seconds: 1800,
          duration_preferences: ["mixed"],
          requested_candidate_count: 30,
          style: "balanced",
          layout: "vertical",
          caption_style: "bold",
          episode_metadata: { title: "Codex smoke test" },
          context: { platform: "social", content_notes: "Smoke test only." },
          segments: [
            {
              segment_id: "codex-seg-1",
              start_seconds: 0,
              end_seconds: 720,
              speaker: "Speaker 1",
              text: socialReelsSmokeText,
            },
          ],
        }),
      });
      logResult("SOCIAL_REELS", socialReels);

      const candidates =
        socialReels.body &&
        typeof socialReels.body === "object" &&
        "candidates" in socialReels.body &&
        Array.isArray(socialReels.body.candidates)
          ? socialReels.body.candidates
          : [];
      if (!socialReels.ok || candidates.length < 30) {
        markFailed("Valid social reels discovery did not return at least 30 candidates.");
      }
      const missingAnchors = candidates.some((candidate) => {
        if (!candidate || typeof candidate !== "object") return true;
        const record = candidate as Record<string, unknown>;
        return (
          typeof record.start_anchor_quote !== "string" ||
          record.start_anchor_quote.trim().length === 0 ||
          !socialReelsSmokeText.includes(record.start_anchor_quote) ||
          typeof record.end_anchor_quote !== "string" ||
          record.end_anchor_quote.trim().length === 0 ||
          !socialReelsSmokeText.includes(record.end_anchor_quote)
        );
      });
      if (missingAnchors) {
        markFailed("Social reels candidates included empty anchor quotes.");
      }

      const buckets = new Set<string>();
      const invalidCandidateDiversity = candidates.some((candidate) => {
        if (!candidate || typeof candidate !== "object") return true;
        const record = candidate as Record<string, unknown>;
        const scores = record.scores as Record<string, unknown> | undefined;
        const titleOptions = record.title_options as Array<Record<string, unknown>> | undefined;
        if (record.duration_bucket === "mixed") return true;
        if (typeof record.duration_bucket === "string") buckets.add(record.duration_bucket);
        return (
          typeof record.clip_type !== "string" ||
          typeof record.topic_tag !== "string" ||
          typeof record.hook_title !== "string" ||
          typeof record.social_caption !== "string" ||
          typeof record.why_it_works !== "string" ||
          !Array.isArray(record.viral_atoms) ||
          record.viral_atoms.some((atom) => typeof atom !== "string" || atom.length === 0) ||
          typeof record.core_question !== "string" ||
          typeof record.conflict !== "string" ||
          typeof record.payoff !== "string" ||
          !Array.isArray(titleOptions) ||
          titleOptions.length === 0 ||
          titleOptions.some((option) => typeof option.title !== "string" || typeof option.score !== "number") ||
          typeof record.title_score !== "number" ||
          record.title_score < 0 ||
          record.title_score > 1 ||
          typeof record.edit_feasibility_score !== "number" ||
          record.edit_feasibility_score < 0 ||
          record.edit_feasibility_score > 1 ||
          typeof record.risk_penalty !== "number" ||
          record.risk_penalty < 0 ||
          record.risk_penalty > 1 ||
          !Array.isArray(record.rejection_risk_flags) ||
          !Array.isArray(record.risk_flags) ||
          typeof record.score !== "number" ||
          record.score < 0 ||
          record.score > 1 ||
          !scores ||
          typeof scores !== "object" ||
          typeof scores.overall !== "number" ||
          scores.overall < 0 ||
          scores.overall > 1 ||
          typeof scores.shareability !== "number" ||
          typeof scores.context_independence !== "number"
        );
      });
      if (invalidCandidateDiversity) {
        markFailed("Social reels candidates were missing editorial diversity fields or returned mixed as a concrete bucket.");
      }
      if (buckets.size < 2) {
        markFailed("Mixed social reels request did not return multiple concrete duration buckets.");
      }

      const invalidBucketDurations = candidates.some((candidate) => {
        if (!candidate || typeof candidate !== "object") return true;
        const record = candidate as Record<string, unknown>;
        return !durationFitsSocialReelsBucket(record.duration_bucket, record.duration_seconds);
      });
      if (invalidBucketDurations) {
        markFailed("Social reels candidates included rough durations outside their duration buckets.");
      }
    } else {
      console.log("SOCIAL_REELS: skipped. Set TEST_SOCIAL_REELS=1 after deploying /api/social-reels/discover.");
    }

    const invalidCheckout = await post(`${baseUrl}/api/billing/checkout`, {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ planId: "not_a_plan" }),
    });
    logResult("CHECKOUT_INVALID_PLAN", invalidCheckout);
    if (invalidCheckout.status !== 400) markFailed("Invalid checkout plan did not return 400.");

    const checkout = await post(`${baseUrl}/api/billing/checkout`, {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ planId: checkoutPlanId }),
    });
    logResult("CHECKOUT", checkout);

    const checkoutUrl =
      checkout.body &&
      typeof checkout.body === "object" &&
      "checkoutUrl" in checkout.body &&
      typeof checkout.body.checkoutUrl === "string"
        ? checkout.body.checkoutUrl
        : undefined;

    console.log("CHECKOUT_URL_PRESENT:", Boolean(checkoutUrl));
    if (!checkout.ok || !checkoutUrl?.startsWith("https://checkout.stripe.com/")) {
      markFailed("Authenticated checkout did not return a Stripe checkout URL.");
    }

    const usage = await post(`${baseUrl}/api/account/usage`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    logResult("USAGE", usage);
    if (!usage.ok) markFailed("Usage request failed.");
    if (usage.body && typeof usage.body === "object" && !("plan" in usage.body)) {
      markFailed("Usage response did not include plan.");
    }

    const usageBefore = numberField(usage.body, "totalUsedSeconds");
    const remainingBefore = numberField(usage.body, "remainingSeconds");
    const isTrial = booleanField(usage.body, "isTrial");
    if (isTrial === null) markFailed("Usage response did not include isTrial.");
    if (isTrial && numberField(usage.body, "trialIncludedSeconds") !== 14400) {
      markFailed("Trial usage response did not include 4 hours of editing time.");
    }
    const transcriptKey = `codex-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const transcriptPayload = {
      projectFingerprint: `${transcriptKey}-project`,
      audioFingerprint: `${transcriptKey}-audio`,
      durationSeconds: transcriptDuration,
      speakerCount: 2,
      providerJobId: null,
      status: "succeeded",
    };

    const transcriptSuccess = await post(`${baseUrl}/api/transcripts/complete`, {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(transcriptPayload),
    });
    logResult("TRANSCRIPT_SUCCESS", transcriptSuccess);
    if (numberField(transcriptSuccess.body, "billableSeconds") !== transcriptDuration) {
      markFailed("Successful transcript did not bill the expected duration.");
    }

    const transcriptDuplicate = await post(`${baseUrl}/api/transcripts/complete`, {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(transcriptPayload),
    });
    logResult("TRANSCRIPT_DUPLICATE", transcriptDuplicate);
    const duplicateReused =
      transcriptDuplicate.body &&
      typeof transcriptDuplicate.body === "object" &&
      "reused" in transcriptDuplicate.body &&
      transcriptDuplicate.body.reused === true;
    if (numberField(transcriptDuplicate.body, "billableSeconds") !== 0 || !duplicateReused) {
      markFailed("Duplicate successful transcript was not treated as reused.");
    }

    const failedTranscript = await post(`${baseUrl}/api/transcripts/complete`, {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        projectFingerprint: `${transcriptKey}-failed-project`,
        audioFingerprint: `${transcriptKey}-failed-audio`,
        durationSeconds: transcriptDuration,
        speakerCount: 2,
        providerJobId: null,
        status: "failed",
      }),
    });
    logResult("TRANSCRIPT_FAILED", failedTranscript);
    if (numberField(failedTranscript.body, "billableSeconds") !== 0) {
      markFailed("Failed transcript billed usage unexpectedly.");
    }

    const exportTelemetry = await post(`${baseUrl}/api/events/export`, {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_id: `codex-export-${transcriptKey.slice(-16)}`,
        export_success: true,
      }),
    });
    logResult("EXPORT_TELEMETRY", exportTelemetry);

    const usageAfter = await post(`${baseUrl}/api/account/usage`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    logResult("USAGE_AFTER_TRANSCRIPT", usageAfter);
    const usageAfterTotal = numberField(usageAfter.body, "totalUsedSeconds");
    const remainingAfter = numberField(usageAfter.body, "remainingSeconds");

    if (usageBefore !== null && usageAfterTotal !== usageBefore + transcriptDuration) {
      markFailed("Account usage did not increase by the successful transcript duration only.");
    }

    if (remainingBefore !== null && remainingAfter !== remainingBefore - transcriptDuration) {
      markFailed("Remaining editing seconds did not decrease by the successful transcript duration only.");
    }

    if (isTrial && remainingAfter !== null) {
      const overageDuration = Math.max(1, remainingAfter + 1);
      const trialOverage = await post(`${baseUrl}/api/transcripts/complete`, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          projectFingerprint: `${transcriptKey}-trial-overage-project`,
          audioFingerprint: `${transcriptKey}-trial-overage-audio`,
          durationSeconds: overageDuration,
          speakerCount: 2,
          providerJobId: null,
          status: "succeeded",
        }),
      });
      logResult("TRANSCRIPT_TRIAL_OVERAGE", trialOverage);
      const trialOverageError =
        trialOverage.body &&
        typeof trialOverage.body === "object" &&
        "error" in trialOverage.body &&
        trialOverage.body.error === "Trial editing time exhausted";
      if (trialOverage.status !== 402 || !trialOverageError) {
        markFailed("Trial overage did not return Trial editing time exhausted.");
      }
    } else {
      console.log("TRANSCRIPT_TRIAL_OVERAGE: skipped because test account is not trialing.");
    }

    const portal = await post(`${baseUrl}/api/billing/portal`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    logResult("BILLING_PORTAL", portal);

    const portalUrl =
      portal.body &&
      typeof portal.body === "object" &&
      "portalUrl" in portal.body &&
      typeof portal.body.portalUrl === "string"
        ? portal.body.portalUrl
        : undefined;
    const portalError =
      portal.body &&
      typeof portal.body === "object" &&
      "error" in portal.body &&
      typeof portal.body.error === "string"
        ? portal.body.error
        : undefined;

    console.log("BILLING_PORTAL_URL_PRESENT:", Boolean(portalUrl));
    if (portal.ok) {
      if (!portalUrl?.startsWith("https://")) markFailed("Billing portal did not return a URL.");
    } else if (portal.status !== 400 || portalError !== "No active billing account found.") {
      markFailed("Billing portal did not return a portal URL or friendly no-customer error.");
    }
  }

  const missingTokenUsage = await post(`${baseUrl}/api/account/usage`, { headers: {} });
  logResult("USAGE_MISSING_TOKEN", missingTokenUsage);
  if (missingTokenUsage.ok) markFailed("Usage request without Authorization unexpectedly succeeded.");

  process.exitCode = failed ? 1 : 0;
}
