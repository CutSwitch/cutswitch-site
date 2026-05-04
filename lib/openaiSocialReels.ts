import "server-only";

import {
  SOCIAL_REELS_CLIP_TYPES,
  SOCIAL_REELS_DURATION_BUCKETS,
  SOCIAL_REELS_REJECTION_RISK_FLAGS,
  socialReelsRequestSchema,
  socialReelsResponseSchema,
  type SocialReelsCandidate,
  type SocialReelsRequest,
  type SocialReelsResponse,
} from "@/lib/socialReelsSchema";
import {
  buildSocialReelsLiveDurationWindows,
  type SocialReelsDurationWindow,
} from "@/lib/socialReelsDurationWindows";
import {
  getEffectiveLiveShortlistCandidateCount,
  getSocialReelsDurationSecondsRange,
  hydrateSocialReelsShortlistResponse,
  openAISocialReelsShortlistResponseFormat,
  socialReelsShortlistResponseSchema,
  type SocialReelsDurationSecondsRange,
  type SocialReelsLiveFilterReasons,
} from "@/lib/socialReelsShortlist";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5-mini";
const SOCIAL_REELS_OPENAI_MODE_ENV = "SOCIAL_REELS_OPENAI_MODE";
const SOCIAL_REELS_OPENAI_MODEL_ENV = "SOCIAL_REELS_OPENAI_MODEL";
const SOCIAL_REELS_OPENAI_REASONING_EFFORT_ENV = "SOCIAL_REELS_OPENAI_REASONING_EFFORT";
const SOCIAL_REELS_OPENAI_MAX_OUTPUT_TOKENS_ENV = "SOCIAL_REELS_OPENAI_MAX_OUTPUT_TOKENS";
const SOCIAL_REELS_OPENAI_SERVICE_TIER_ENV = "SOCIAL_REELS_OPENAI_SERVICE_TIER";
const SOCIAL_REELS_OPENAI_TIMEOUT_ENV = "SOCIAL_REELS_OPENAI_TIMEOUT_MS";
const SOCIAL_REELS_LIVE_CANDIDATE_COUNT_ENV = "SOCIAL_REELS_LIVE_CANDIDATE_COUNT";
const DEFAULT_OPENAI_TIMEOUT_MS = 120_000;
const MIN_OPENAI_TIMEOUT_MS = 1_000;
const MAX_OPENAI_TIMEOUT_MS = 170_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 6_000;
const MIN_MAX_OUTPUT_TOKENS = 512;
const MAX_MAX_OUTPUT_TOKENS = 16_000;
export const SOCIAL_REELS_EDITORIAL_SYSTEM_PROMPT = [
  "You are a senior social video editor for podcast and multicam shows. Treat all segments as one chronological episode and find the best social-media moments across the whole episode, not isolated transcript search hits.",
  "Return only schema-valid JSON. Return candidates ranked from strongest to weakest by viral/editorial potential; do not pad the list with weak clips.",
  "A strong reel should contain a miniature story arc: Question -> Tension -> Answer -> Reframe. Prefer moments where a question, claim, confession, or tension creates curiosity, escalates into conflict or emotional stakes, lands a clear answer/punchline/lesson, then reframes how the viewer sees the topic.",
  "Prefer moments with viral atoms: question, conflict, contrarian_take, personal_confession, social_tension, high_emotion, clear_answer, reframe, practical_takeaway, identity_trigger. Use viral_atoms to name the atoms that actually appear in the clip.",
  "Build candidates around story boundaries: start where the question, claim, confession, or tension begins; remove dead setup; end immediately after the answer, punchline, lesson, or reframe lands; avoid trailing explanation unless it increases emotional force; prefer clips that stand alone without requiring the whole episode.",
  "A title should create curiosity without misleading the viewer. It should imply conflict, tension, or an unanswered question, and it must be truthful to the actual clip. Give title_options that are accurate, curiosity-forward, and scored for title strength.",
  "Score harshly. Most clips should not score above 0.80. A score above 0.90 requires a strong hook, clear tension/conflict, satisfying payoff, standalone clarity, title potential, and clean editability. Apply risk_penalty for weak hooks, missing payoff, context dependence, unsafe/sensitive material, low editability, junk setup, misleading title potential, or any anti-junk risk.",
  "Avoid countdowns, timers, pre-show chatter, mic checks, technical setup, sponsor/ad reads unless explicitly requested, intro/outro logistics, vague greetings, housekeeping, dead air, generic motivational filler, purely transitional moments, clips that begin mid-thought, clips that require too much prior context, and clips with missing payoff.",
  "A good reel must have a fast first 1-3 seconds hook, standalone clarity, specificity, emotional charge or humor or conflict or insight, a clear story arc or idea, clean editability, and a satisfying ending/payoff.",
  "duration_bucket is not just a label: start_anchor_quote and end_anchor_quote must span the selected clip duration as closely as possible. Copy both anchor quotes exactly from the provided segment text; do not invent anchor quotes. Anchor quotes must be distinctive and present in the transcript.",
  "Duration bucket is a hard constraint. 15s clips must be about 10-22 seconds, 30s clips about 22-42 seconds, 60s clips about 45-78 seconds, 90s clips about 70-115 seconds, and 5-10m clips about 240-660 seconds. Do not return a candidate for a bucket if the available transcript span cannot support that duration.",
  "When duration_windows are provided, use them as the duration source of truth. Choose one duration-valid window per candidate, keep start_seconds/end_seconds/duration_seconds inside that window, and place start/end anchor quotes near the provided boundary hints. For a 60s request, select a real 45-78 second story span; do not compress a small highlight into a fake 60s clip. A 60s clip is not a 10-second highlight.",
  "If you cannot find enough duration-valid candidates, return fewer candidates rather than padding with compact quotes or weak starts. CutSwitch will filter candidates outside the duration range.",
  "rough_start_seconds/start_seconds and rough_end_seconds/end_seconds are hints only, not final timing claims. CutSwitch will validate timing locally and reject weak clips or candidates outside their requested bucket. The macOS app owns word-aligned timing and frame snapping. Do not include raw file paths, private metadata, or invented timestamps.",
].join(" ");

type OpenAIUsage = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
};

type OpenAIResponseBody = {
  id?: string;
  model?: string;
  output_text?: string;
  usage?: OpenAIUsage;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
      refusal?: string;
    }>;
  }>;
  error?: {
    type?: string;
    message?: string;
  };
};

type ConcreteDurationBucket = (typeof SOCIAL_REELS_DURATION_BUCKETS)[number];

export type SocialReelsTimeoutStage =
  | "app_unknown"
  | "route_before_openai"
  | "openai_fetch_timeout"
  | "openai_non2xx"
  | "openai_invalid_response"
  | "route_timeout"
  | "unknown";

export type DiscoverSocialReelsOptions = {
  mock?: boolean;
  model?: string;
};

export type SocialReelsDiscoveryMode = "mock_full_pool" | "live_shortlist";

export type SocialReelsServiceDiagnostics = {
  mode: "mock" | "live";
  openaiRequestStartedAt: string | null;
  openaiElapsedMs: number | null;
  responseParseMs: number | null;
  provider: "mock" | "openai";
  model: string | null;
  providerResponseId: string | null;
};

export type DiscoverSocialReelsResult = {
  response: SocialReelsResponse;
  usage: OpenAIUsage | null;
  providerResponseId: string | null;
  model: string;
  mock: boolean;
  requestedCandidateCount: number;
  effectiveCandidateCount: number;
  returnedCandidateCount: number;
  filteredCandidateCount: number;
  eligibleDurationWindowCount: number | null;
  liveFilterReasons: SocialReelsLiveFilterReasons;
  returnedDurationSecondsRange: SocialReelsDurationSecondsRange;
  discoveryMode: SocialReelsDiscoveryMode;
  diagnostics: SocialReelsServiceDiagnostics;
};

export class SocialReelsDiscoveryError extends Error {
  stage: SocialReelsTimeoutStage;
  elapsedMs: number | null;
  status: number | null;

  constructor(message: string, details: { stage: SocialReelsTimeoutStage; elapsedMs?: number | null; status?: number | null }) {
    super(message);
    this.name = "SocialReelsDiscoveryError";
    this.stage = details.stage;
    this.elapsedMs = details.elapsedMs ?? null;
    this.status = details.status ?? null;
  }
}

export function getSocialReelsOpenAIMode() {
  return process.env[SOCIAL_REELS_OPENAI_MODE_ENV]?.trim().toLowerCase() === "live" ? "live" : "mock";
}

export function getSocialReelsOpenAIModel() {
  return process.env[SOCIAL_REELS_OPENAI_MODEL_ENV]?.trim() || DEFAULT_MODEL;
}

export function getSocialReelsOpenAIReasoningEffort() {
  const effort = process.env[SOCIAL_REELS_OPENAI_REASONING_EFFORT_ENV]?.trim().toLowerCase();
  return effort && effort !== "none" ? effort : null;
}

export function getSocialReelsOpenAIServiceTier() {
  const serviceTier = process.env[SOCIAL_REELS_OPENAI_SERVICE_TIER_ENV]?.trim().toLowerCase();
  if (!serviceTier || serviceTier === "none" || serviceTier === "standard") return null;
  return serviceTier;
}

export function getSocialReelsOpenAIMaxOutputTokens() {
  const raw = process.env[SOCIAL_REELS_OPENAI_MAX_OUTPUT_TOKENS_ENV]?.trim();
  if (!raw) return DEFAULT_MAX_OUTPUT_TOKENS;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_OUTPUT_TOKENS;

  return Math.min(MAX_MAX_OUTPUT_TOKENS, Math.max(MIN_MAX_OUTPUT_TOKENS, Math.round(parsed)));
}

export function getSocialReelsOpenAITimeoutMs() {
  const raw = process.env[SOCIAL_REELS_OPENAI_TIMEOUT_ENV]?.trim();
  if (!raw) return DEFAULT_OPENAI_TIMEOUT_MS;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_OPENAI_TIMEOUT_MS;

  return Math.min(MAX_OPENAI_TIMEOUT_MS, Math.max(MIN_OPENAI_TIMEOUT_MS, Math.round(parsed)));
}

export function getSocialReelsLiveCandidateCount(requestedCandidateCount: number) {
  return getEffectiveLiveShortlistCandidateCount(requestedCandidateCount, process.env[SOCIAL_REELS_LIVE_CANDIDATE_COUNT_ENV]);
}

function shouldUseMock(options: DiscoverSocialReelsOptions) {
  if (typeof options.mock === "boolean") return options.mock;
  return getSocialReelsOpenAIMode() !== "live";
}

function bucketTargetDurationSeconds(bucket: ConcreteDurationBucket, index: number) {
  if (bucket === "15s") return 15;
  if (bucket === "30s") return 30;
  if (bucket === "60s") return 60;
  if (bucket === "90s") return 90;
  return 300 + (index % 6) * 60;
}

function bucketMinimumUsableSeconds(bucket: ConcreteDurationBucket) {
  if (bucket === "15s") return 12;
  if (bucket === "30s") return 26;
  if (bucket === "60s") return 54;
  if (bucket === "90s") return 82;
  return 300;
}

function getConcreteDurationBuckets(input: SocialReelsRequest) {
  const preferences = input.duration_preferences || [input.duration_bucket];
  if (preferences.includes("mixed") || preferences.includes("custom")) {
    const usableBuckets = SOCIAL_REELS_DURATION_BUCKETS.filter((bucket) => input.segments.some((segment) => canSegmentSupportBucket(segment, bucket)));
    return usableBuckets.length > 0 ? usableBuckets : SOCIAL_REELS_DURATION_BUCKETS;
  }

  const concreteBuckets = preferences.filter((preference): preference is (typeof SOCIAL_REELS_DURATION_BUCKETS)[number] =>
    SOCIAL_REELS_DURATION_BUCKETS.includes(preference as (typeof SOCIAL_REELS_DURATION_BUCKETS)[number])
  );

  const usableBuckets = concreteBuckets.filter((bucket) => input.segments.some((segment) => canSegmentSupportBucket(segment, bucket)));
  if (usableBuckets.length > 0) return usableBuckets;

  return concreteBuckets.length > 0 ? concreteBuckets : SOCIAL_REELS_DURATION_BUCKETS;
}

function pickCandidateBucket(input: SocialReelsRequest, index: number) {
  const buckets = getConcreteDurationBuckets(input);
  return buckets[index % buckets.length];
}

function extractOutputText(body: OpenAIResponseBody) {
  if (typeof body.output_text === "string" && body.output_text.trim()) return body.output_text;

  for (const output of body.output || []) {
    for (const content of output.content || []) {
      if (typeof content.refusal === "string" && content.refusal.trim()) {
        throw new Error("OpenAI refused the social reels request.");
      }

      if (content.type === "output_text" && typeof content.text === "string" && content.text.trim()) {
        return content.text;
      }
    }
  }

  return null;
}

const GENERIC_ANCHOR_WORDS = new Set([
  "yeah",
  "okay",
  "ok",
  "um",
  "uh",
  "like",
  "right",
  "so",
  "well",
  "yes",
  "no",
  "cool",
  "totally",
  "basically",
  "actually",
  "think",
]);

const JUNK_REJECTION_PATTERNS: Array<{ flag: (typeof SOCIAL_REELS_REJECTION_RISK_FLAGS)[number]; pattern: RegExp }> = [
  { flag: "countdown_or_timer", pattern: /\b(countdown|counting down|three two one|3\s*2\s*1|timer)\b/i },
  { flag: "pre_show_chatter", pattern: /\b(pre[-\s]?show|haven't started|have not started|before we start|before recording)\b/i },
  { flag: "mic_check", pattern: /\b(mic check|microphone check|check one two|testing testing|can you hear me)\b/i },
  { flag: "technical_setup", pattern: /\b(camera|audio|levels|recording|zoom|riverside|setup|plugged in|headphones)\b/i },
  { flag: "sponsor_or_ad", pattern: /\b(sponsor|sponsored by|promo code|use code|ad read|advertisement)\b/i },
  { flag: "intro_outro_logistics", pattern: /\b(welcome back|thanks for listening|subscribe|like and subscribe|see you next time|housekeeping)\b/i },
  { flag: "generic_advice", pattern: /\b(just believe in yourself|follow your dreams|never give up)\b/i },
];

function cleanWords(text: string) {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => word.trim())
    .filter(Boolean);
}

function normalizeForSearch(text: string) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, "").replace(/\s+/g, " ").trim();
}

function getRejectionRiskFlags(text: string) {
  const flags = JUNK_REJECTION_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ flag }) => flag);
  return [...new Set(flags)];
}

function segmentLooksJunk(text: string) {
  return getRejectionRiskFlags(text).length > 0;
}

function phraseIsDistinctive(phrase: string) {
  const normalizedWords = normalizeForSearch(phrase).split(" ").filter(Boolean);
  if (phrase.length < 20 || normalizedWords.length < 5) return false;
  const meaningfulWords = normalizedWords.filter((word) => !GENERIC_ANCHOR_WORDS.has(word));
  return meaningfulWords.length >= 3;
}

function phraseFromWords(words: string[], startIndex: number, preferredLength = 8) {
  const maxStart = Math.max(0, words.length - 5);
  const safeStart = Math.min(Math.max(0, startIndex), maxStart);

  for (let length = Math.min(12, words.length - safeStart); length >= 5; length -= 1) {
    const phrase = words.slice(safeStart, safeStart + Math.min(length, preferredLength)).join(" ").trim();
    if (phraseIsDistinctive(phrase)) return phrase;
  }

  return null;
}

function phraseNearWords(words: string[], desiredStartIndex: number) {
  const offsets = [0, -1, 1, -2, 2, -3, 3, -5, 5, -8, 8, -12, 12];
  for (const offset of offsets) {
    const startIndex = desiredStartIndex + offset;
    const phrase = phraseFromWords(words, startIndex);
    if (phrase) {
      return {
        phrase,
        startIndex: Math.min(Math.max(0, startIndex), Math.max(0, words.length - 5)),
      };
    }
  }

  return null;
}

function canSegmentSupportBucket(segment: SocialReelsRequest["segments"][number], bucket: ConcreteDurationBucket) {
  const segmentDuration = Math.max(0, segment.end_seconds - segment.start_seconds);
  const words = cleanWords(segment.text);
  if (segmentDuration < bucketMinimumUsableSeconds(bucket) || words.length < 12) return false;

  const secondsPerToken = segmentDuration / Math.max(1, words.length - 1);
  const targetTokenDistance = Math.max(5, Math.round(bucketTargetDurationSeconds(bucket, 0) / secondsPerToken));
  return words.length - targetTokenDistance >= 10;
}

function findDurationAwareAnchors(
  segment: SocialReelsRequest["segments"][number],
  bucket: ConcreteDurationBucket,
  index: number
) {
  const text = segment.text;
  const words = cleanWords(text);
  if (words.length < 12) return null;

  const segmentDuration = Math.max(0, segment.end_seconds - segment.start_seconds);
  if (segmentDuration < bucketMinimumUsableSeconds(bucket)) return null;

  const targetDuration = Math.min(bucketTargetDurationSeconds(bucket, index), segmentDuration);
  const secondsPerToken = segmentDuration / Math.max(1, words.length - 1);
  const targetTokenDistance = Math.max(5, Math.round(targetDuration / secondsPerToken));
  const maxStart = words.length - targetTokenDistance - 5;
  if (maxStart < 0) return null;

  const startTokenIndex = Math.max(0, Math.min(maxStart, (index * 7) % Math.max(1, maxStart + 1)));
  const endTokenIndex = Math.max(startTokenIndex + 5, Math.min(words.length - 5, startTokenIndex + targetTokenDistance));

  const startQuote = phraseNearWords(words, startTokenIndex);
  const endQuote = phraseNearWords(words, endTokenIndex);

  if (!startQuote || !endQuote || normalizeForSearch(startQuote.phrase) === normalizeForSearch(endQuote.phrase)) return null;

  const startSeconds = segment.start_seconds + startQuote.startIndex * secondsPerToken;
  const endSeconds = segment.start_seconds + endQuote.startIndex * secondsPerToken;
  if (endSeconds <= startSeconds) return null;

  return {
    startAnchorQuote: startQuote.phrase,
    endAnchorQuote: endQuote.phrase,
    startSeconds,
    endSeconds,
  };
}

function getMockSourceSegment(input: SocialReelsRequest, bucket: ConcreteDurationBucket, index: number) {
  const usableSegments = input.segments.filter((segment) => !segmentLooksJunk(segment.text) && findDurationAwareAnchors(segment, bucket, index));
  if (usableSegments.length > 0) return usableSegments[index % usableSegments.length];

  const durationUsableSegments = input.segments.filter((segment) => findDurationAwareAnchors(segment, bucket, index));
  if (durationUsableSegments.length > 0) return durationUsableSegments[index % durationUsableSegments.length];

  return input.segments[index % input.segments.length];
}

function clampScore(score: number) {
  return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}

function pickClipType(index: number) {
  return SOCIAL_REELS_CLIP_TYPES[index % SOCIAL_REELS_CLIP_TYPES.length];
}

function makeTopicTag(text: string, index: number) {
  const words = normalizeForSearch(text)
    .split(" ")
    .filter((word) => word.length > 3 && !GENERIC_ANCHOR_WORDS.has(word));
  const start = words.length ? index % words.length : 0;
  const tag = words.slice(start, start + 2).join(" ").trim() || "conversation moment";
  return tag.slice(0, 80);
}

function makeScoreBreakdown(index: number) {
  const overall = clampScore(0.9 - (index % 30) * 0.01);
  return {
    hook_strength: clampScore(overall - (index % 5) * 0.01),
    standalone_clarity: clampScore(overall - ((index + 2) % 6) * 0.01),
    payoff_strength: clampScore(overall - ((index + 4) % 7) * 0.01),
    emotional_charge: clampScore(0.72 + (index % 24) * 0.01),
    novelty: clampScore(0.68 + ((index * 3) % 27) * 0.01),
    editability: clampScore(0.82 + ((index * 2) % 14) * 0.01),
    shareability: clampScore(overall - ((index + 1) % 5) * 0.01),
    context_independence: clampScore(overall - ((index + 3) % 6) * 0.01),
    overall,
  };
}

function makeMockCandidate(input: SocialReelsRequest, index: number): SocialReelsCandidate {
  const durationBucket = pickCandidateBucket(input, index);
  const segment = getMockSourceSegment(input, durationBucket, index);
  const anchors = findDurationAwareAnchors(segment, durationBucket, index);
  if (!anchors) {
    throw new Error("Mock social reels request needs transcript segments long enough for the requested duration bucket.");
  }

  const start = Math.max(0, Math.round(anchors.startSeconds));
  const end = Math.max(start + 5, Math.min(Math.round(segment.end_seconds), Math.round(anchors.endSeconds)));
  const ordinal = index + 1;
  const clipType = pickClipType(index);
  const scores = makeScoreBreakdown(index);
  const topicTag = makeTopicTag(segment.text, index);
  const hookTitle = `Clip ${ordinal}: ${topicTag}`;
  const socialCaption = `${anchors.startAnchorQuote}... ${anchors.endAnchorQuote}`.slice(0, 280);
  const rejectionRiskFlags = getRejectionRiskFlags(segment.text);
  const titleScore = clampScore(Math.max(0.58, scores.hook_strength - 0.03));
  const editFeasibilityScore = scores.editability;
  const riskPenalty = rejectionRiskFlags.length > 0 ? clampScore(Math.min(0.4, rejectionRiskFlags.length * 0.08)) : 0;

  return {
    candidate_id: `mock-reel-${String(ordinal).padStart(2, "0")}`,
    title: hookTitle,
    hook: segment.text.slice(0, 140) || "A concise moment from the conversation.",
    summary: `Mock social reel candidate ${ordinal} based on transcript segment ${segment.id}.`,
    start_anchor_quote: anchors.startAnchorQuote,
    end_anchor_quote: anchors.endAnchorQuote,
    clip_type: clipType,
    topic_tag: topicTag,
    hook_title: hookTitle,
    subtitle_intro: anchors.startAnchorQuote.slice(0, 160),
    social_caption: socialCaption,
    why_it_works: "The moment has a clear opening anchor, a later payoff, and enough context to stand alone as a social clip.",
    viral_atoms: ["question", "clear_answer", "practical_takeaway"],
    core_question: "What makes this moment useful as a standalone social clip?",
    conflict: "The clip needs to cut past setup and keep only the strongest idea.",
    payoff: anchors.endAnchorQuote,
    title_options: [
      { title: hookTitle, score: titleScore },
      { title: `${topicTag}: the payoff`, score: clampScore(titleScore - 0.04) },
    ],
    title_score: titleScore,
    edit_feasibility_score: editFeasibilityScore,
    risk_penalty: riskPenalty,
    rejection_risk_flags: rejectionRiskFlags,
    risk_flags: rejectionRiskFlags,
    duration_bucket: durationBucket,
    start_seconds: start,
    end_seconds: end,
    duration_seconds: Math.max(5, Math.round(end - start)),
    score: scores.overall,
    scores,
    rationale: "Mock candidate for local development and schema validation.",
    segment_ids: [segment.id],
    captions: [
      segment.text.slice(0, 120) || "A short, social-ready caption.",
      "Cut this into a fast vertical highlight.",
    ],
    suggested_platforms: [input.context.platform || "social"],
    safety_notes: null,
  };
}

function buildMockResponse(input: SocialReelsRequest): SocialReelsResponse {
  return {
    candidates: Array.from({ length: input.requested_candidate_count }, (_, index) => makeMockCandidate(input, index)),
    model_notes: "Mock response generated locally; no transcript text was sent to OpenAI.",
  };
}

function buildPromptInput(
  input: SocialReelsRequest,
  metadata?: {
    discoveryMode?: SocialReelsDiscoveryMode;
    requestedCandidateCount?: number;
    effectiveCandidateCount?: number;
    durationWindows?: SocialReelsDurationWindow[];
  }
) {
  return [
    {
      role: "system",
      content: SOCIAL_REELS_EDITORIAL_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: JSON.stringify({
        source_duration_seconds: input.source_duration_seconds,
        duration_bucket: input.duration_bucket,
        duration_preferences: input.duration_preferences,
        requested_candidate_count: input.requested_candidate_count,
        original_requested_candidate_count: metadata?.requestedCandidateCount ?? input.requested_candidate_count,
        effective_candidate_count: metadata?.effectiveCandidateCount ?? input.requested_candidate_count,
        discovery_mode: metadata?.discoveryMode ?? "mock_full_pool",
        live_shortlist_note:
          metadata?.discoveryMode === "live_shortlist"
            ? "Return up to effective_candidate_count candidates using the reduced shortlist schema. Preserve the Viral Reel Method: Question -> Tension -> Answer -> Reframe, anti-junk exclusions, duration-aware anchors, and ranked strongest-to-weakest choices. Duration bucket compliance is mandatory: for a 60s request, each candidate must span roughly 45-78 seconds of spoken content; never return 8s, 12s, 16s, 22s, or 32s clips as 60s candidates. A 60s clip is not a 10-second highlight. Choose from duration_windows when present. Use each window's start/end/duration as the clip span, then copy distinctive transcript anchor quotes near that window's boundary hints. If there are fewer duration-valid candidates than requested, return fewer candidates rather than padding."
            : null,
        duration_window_instruction:
          metadata?.discoveryMode === "live_shortlist"
            ? "duration_windows are backend-generated candidate spans that already fit the requested duration bucket. They are hints, not transcript replacements. Pick windows that contain a complete Question -> Tension -> Answer -> Reframe arc. Set candidate_id to the chosen window_id or a stable derivative."
            : null,
        duration_windows: metadata?.durationWindows ?? [],
        custom_duration_seconds: input.custom_duration_seconds || null,
        style: input.style,
        layout: input.layout,
        caption_style: input.caption_style,
        episode_metadata: input.episode_metadata,
        context: input.context,
        segments: input.segments,
      }),
    },
  ];
}

export async function discoverSocialReelsCandidates(
  rawInput: unknown,
  options: DiscoverSocialReelsOptions = {}
): Promise<DiscoverSocialReelsResult> {
  const input = socialReelsRequestSchema.parse(rawInput);
  const model = options.model || getSocialReelsOpenAIModel();

  if (shouldUseMock(options)) {
    const response = socialReelsResponseSchema.parse(buildMockResponse(input));
    return {
      response,
      usage: null,
      providerResponseId: null,
      model: "mock",
      mock: true,
      requestedCandidateCount: input.requested_candidate_count,
      effectiveCandidateCount: input.requested_candidate_count,
      returnedCandidateCount: response.candidates.length,
      filteredCandidateCount: 0,
      eligibleDurationWindowCount: null,
      liveFilterReasons: { duration_outside_bucket: 0 },
      returnedDurationSecondsRange: getSocialReelsDurationSecondsRange(response.candidates),
      discoveryMode: "mock_full_pool",
      diagnostics: {
        mode: "mock",
        openaiRequestStartedAt: null,
        openaiElapsedMs: null,
        responseParseMs: null,
        provider: "mock",
        model: "mock",
        providerResponseId: null,
      },
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new SocialReelsDiscoveryError("Social reels live mode is not configured.", {
      stage: "route_before_openai",
    });
  }

  const timeoutMs = getSocialReelsOpenAITimeoutMs();
  const maxOutputTokens = getSocialReelsOpenAIMaxOutputTokens();
  const reasoningEffort = getSocialReelsOpenAIReasoningEffort();
  const serviceTier = getSocialReelsOpenAIServiceTier();
  const requestedCandidateCount = input.requested_candidate_count;
  const effectiveCandidateCount = getSocialReelsLiveCandidateCount(requestedCandidateCount);
  const liveShortlistInput: SocialReelsRequest = {
    ...input,
    requested_candidate_count: effectiveCandidateCount,
  };
  const durationWindows = buildSocialReelsLiveDurationWindows(liveShortlistInput, effectiveCandidateCount);
  const controller = new AbortController();
  const openaiStartedMs = Date.now();
  const openaiRequestStartedAt = new Date(openaiStartedMs).toISOString();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const requestBody: Record<string, unknown> = {
    model,
    input: buildPromptInput(liveShortlistInput, {
      discoveryMode: "live_shortlist",
      requestedCandidateCount,
      effectiveCandidateCount,
      durationWindows,
    }),
    max_output_tokens: maxOutputTokens,
    text: {
      format: openAISocialReelsShortlistResponseFormat(effectiveCandidateCount),
    },
  };
  if (reasoningEffort) {
    requestBody.reasoning = { effort: reasoningEffort };
  }
  if (serviceTier) {
    requestBody.service_tier = serviceTier;
  }

  let res: Response;
  try {
    res = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } catch (error) {
    const elapsedMs = Date.now() - openaiStartedMs;
    if (error instanceof Error && error.name === "AbortError") {
      throw new SocialReelsDiscoveryError("Social reels discovery timed out.", {
        stage: "openai_fetch_timeout",
        elapsedMs,
      });
    }

    throw new SocialReelsDiscoveryError("OpenAI request failed.", {
      stage: "unknown",
      elapsedMs,
    });
  } finally {
    clearTimeout(timeout);
  }

  const openaiElapsedMs = Date.now() - openaiStartedMs;
  const responseParseStartedMs = Date.now();
  const body = (await res.json().catch(() => ({}))) as OpenAIResponseBody;

  if (!res.ok) {
    throw new SocialReelsDiscoveryError(body.error?.type || "openai_request_failed", {
      stage: "openai_non2xx",
      elapsedMs: openaiElapsedMs,
      status: res.status,
    });
  }

  try {
    const outputText = extractOutputText(body);
    if (!outputText) {
      throw new Error("missing_output_text");
    }

    const parsedOutput = JSON.parse(outputText) as unknown;
    const shortlist = socialReelsShortlistResponseSchema.parse(parsedOutput);
    const hydratedShortlist = hydrateSocialReelsShortlistResponse(shortlist, liveShortlistInput);
    const responseParseMs = Date.now() - responseParseStartedMs;

    return {
      response: hydratedShortlist.response,
      usage: body.usage || null,
      providerResponseId: body.id || null,
      model: body.model || model,
      mock: false,
      requestedCandidateCount,
      effectiveCandidateCount,
      returnedCandidateCount: hydratedShortlist.returnedCandidateCount,
      filteredCandidateCount: hydratedShortlist.filteredCandidateCount,
      eligibleDurationWindowCount: durationWindows.length,
      liveFilterReasons: hydratedShortlist.liveFilterReasons,
      returnedDurationSecondsRange: hydratedShortlist.returnedDurationSecondsRange,
      discoveryMode: "live_shortlist",
      diagnostics: {
        mode: "live",
        openaiRequestStartedAt,
        openaiElapsedMs,
        responseParseMs,
        provider: "openai",
        model: body.model || model,
        providerResponseId: body.id || null,
      },
    };
  } catch (error) {
    if (error instanceof SocialReelsDiscoveryError) throw error;
    throw new SocialReelsDiscoveryError("OpenAI response was invalid.", {
      stage: "openai_invalid_response",
      elapsedMs: openaiElapsedMs,
      status: res.status,
    });
  }
}
