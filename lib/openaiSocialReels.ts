import "server-only";

import { z } from "zod";

import {
  getSafeZodIssueSummary,
  summarizeSocialReelsOutputShape,
  type SafeSocialReelsOutputShape,
} from "@/lib/socialReelsDiagnostics";
import {
  buildSocialReelsOpenAIPromptInput,
  SOCIAL_REELS_EDITORIAL_SYSTEM_PROMPT,
} from "@/lib/socialReelsOpenAIPrompt";
import {
  SOCIAL_REELS_CLIP_TYPES,
  SOCIAL_REELS_DURATION_BUCKETS,
  SOCIAL_REELS_REJECTION_RISK_FLAGS,
  openAISocialReelsDiscoveryMatrixResponseFormat,
  socialReelsDiscoveryMatrixResponseSchema,
  socialReelsRequestSchema,
  socialReelsResponseSchema,
  type SocialReelsCandidate,
  type SocialReelsDiscoveryMatrixResponse,
  type SocialReelsRequest,
  type SocialReelsResponse,
} from "@/lib/socialReelsSchema";
import {
  buildSocialReelsLivePromptWindows,
  buildSocialReelsLiveDurationWindows,
  getSocialReelsLiveWindowCount,
  getSocialReelsWindowQualityDistribution,
  getSocialReelsWindowQualityRange,
  getSocialReelsWindowReasonCounts,
  scoreSocialReelsDurationWindows,
  selectSocialReelsLiveDurationWindows,
  summarizeSocialReelsWindowQuality,
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
const SOCIAL_REELS_LIVE_WINDOW_COUNT_ENV = "SOCIAL_REELS_LIVE_WINDOW_COUNT";
const DEFAULT_OPENAI_TIMEOUT_MS = 120_000;
const MIN_OPENAI_TIMEOUT_MS = 1_000;
const MAX_OPENAI_TIMEOUT_MS = 170_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 6_000;
const MIN_MAX_OUTPUT_TOKENS = 512;
const MAX_MAX_OUTPUT_TOKENS = 16_000;
export { SOCIAL_REELS_EDITORIAL_SYSTEM_PROMPT };

type OpenAIUsage = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
};

type OpenAIResponseBody = {
  id?: string;
  model?: string;
  status?: string;
  incomplete_details?: {
    reason?: string;
  };
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
    code?: string;
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

export type SocialReelsDiscoveryMode = "mock_full_pool" | "live_shortlist" | "discovery_matrix";

export type SocialReelsServiceDiagnostics = {
  mode: "mock" | "live";
  openaiRequestStartedAt: string | null;
  openaiElapsedMs: number | null;
  responseParseMs: number | null;
  provider: "mock" | "openai";
  model: string | null;
  providerResponseId: string | null;
  durationWindowCountSentToModel: number | null;
  promptContextCharCountSentToModel: number | null;
  windowsAfterQualityFilter: number | null;
  excludedWindowReasonCounts: Record<string, number> | null;
  averageWindowQualityScore: number | null;
  demotedWindowReasonCounts: Record<string, number> | null;
  selectedWindowQualityRange: { min: number | null; max: number | null } | null;
  selectedWindowQualityDistribution: { strong: number; decent: number; weak: number } | null;
  selectedWindowReasonCounts: { quality_reasons: Record<string, number>; demotion_reasons: Record<string, number>; selected_windows_with_demotion_count: number } | null;
};

export type SocialReelsInvalidResponseDiagnostics = {
  provider: "openai";
  model: string;
  provider_response_id: string | null;
  openai_status: number | null;
  elapsed_ms: number | null;
  schema_mode: "live_shortlist_reduced" | "discovery_matrix";
  effective_candidate_count: number;
  duration_preferences: string[];
  segment_count: number;
  approximate_total_text_chars: number;
  eligible_duration_window_count: number;
  windows_after_quality_filter: number | null;
  excluded_window_reason_counts: Record<string, number> | null;
  average_window_quality_score: number | null;
  demoted_window_reason_counts: Record<string, number> | null;
  selected_window_quality_range: { min: number | null; max: number | null } | null;
  selected_window_quality_distribution: { strong: number; decent: number; weak: number } | null;
  selected_window_reason_counts: { quality_reasons: Record<string, number>; demotion_reasons: Record<string, number>; selected_windows_with_demotion_count: number } | null;
  duration_window_count_sent_to_model: number;
  prompt_context_char_count_sent_to_model: number;
  max_output_tokens: number;
  response_status: string | null;
  incomplete_reason: string | null;
  parse_error: string | null;
  zod_issues: Array<{ path: string; code: string }> | null;
  output_shape: SafeSocialReelsOutputShape;
};

export type DiscoverSocialReelsResult = {
  response: SocialReelsResponse | null;
  matrixResponse: SocialReelsDiscoveryMatrixResponse | null;
  usage: OpenAIUsage | null;
  providerResponseId: string | null;
  model: string;
  mock: boolean;
  requestedCandidateCount: number;
  effectiveCandidateCount: number;
  returnedCandidateCount: number;
  filteredCandidateCount: number;
  eligibleDurationWindowCount: number | null;
  windowsAfterQualityFilter: number | null;
  excludedWindowReasonCounts: Record<string, number> | null;
  averageWindowQualityScore: number | null;
  demotedWindowReasonCounts: Record<string, number> | null;
  selectedWindowQualityRange: { min: number | null; max: number | null } | null;
  selectedWindowQualityDistribution: { strong: number; decent: number; weak: number } | null;
  selectedWindowReasonCounts: { quality_reasons: Record<string, number>; demotion_reasons: Record<string, number>; selected_windows_with_demotion_count: number } | null;
  durationWindowCountSentToModel: number | null;
  promptContextCharCountSentToModel: number | null;
  liveFilterReasons: SocialReelsLiveFilterReasons;
  returnedDurationSecondsRange: SocialReelsDurationSecondsRange;
  discoveryMode: SocialReelsDiscoveryMode;
  diagnostics: SocialReelsServiceDiagnostics;
};

export class SocialReelsDiscoveryError extends Error {
  stage: SocialReelsTimeoutStage;
  elapsedMs: number | null;
  status: number | null;
  safeDiagnostics: SocialReelsInvalidResponseDiagnostics | null;

  constructor(
    message: string,
    details: {
      stage: SocialReelsTimeoutStage;
      elapsedMs?: number | null;
      status?: number | null;
      safeDiagnostics?: SocialReelsInvalidResponseDiagnostics | null;
    }
  ) {
    super(message);
    this.name = "SocialReelsDiscoveryError";
    this.stage = details.stage;
    this.elapsedMs = details.elapsedMs ?? null;
    this.status = details.status ?? null;
    this.safeDiagnostics = details.safeDiagnostics ?? null;
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

export function getSocialReelsLivePromptWindowCount() {
  return getSocialReelsLiveWindowCount(process.env[SOCIAL_REELS_LIVE_WINDOW_COUNT_ENV]);
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

function buildMockMatrixResponse(input: SocialReelsRequest): SocialReelsDiscoveryMatrixResponse {
  const matrix = input.discovery_matrix;
  if (!matrix) {
    return { moments: [], buckets: [], model_notes: "No discovery matrix requested." };
  }

  const momentsById = new Map<string, SocialReelsDiscoveryMatrixResponse["moments"][number]>();
  const buckets = matrix.requested_targets.map((target) => {
    const matchingMomentIds: string[] = [];
    const limit = Math.min(input.max_per_bucket, target.max_candidates ?? input.max_per_bucket);

    for (let index = 0; index < limit && momentsById.size < input.max_unique_moments; index += 1) {
      const source = input.segments[(index + matchingMomentIds.length) % input.segments.length] ?? input.segments[0];
      const momentId = matrix.dedupe_shared_moments && index === 0 ? "mock-shared-moment-001" : `mock-moment-${target.style}-${target.duration}-${index + 1}`;
      matchingMomentIds.push(momentId);

      const existing = momentsById.get(momentId);
      const bucketMembership = {
        style: target.style,
        duration: target.duration,
        rank: index + 1,
        bucket_score: clampScore(0.86 - index * 0.02),
        why_it_fits: "Mock matrix bucket membership for schema and prompt validation.",
      };

      if (existing) {
        existing.buckets.push(bucketMembership);
        continue;
      }

      momentsById.set(momentId, {
        moment_id: momentId,
        start_seconds: source?.start_seconds ?? 0,
        end_seconds: source?.end_seconds ?? Math.min(30, input.source_duration_seconds),
        start_timecode: source?.start_timecode ?? null,
        end_timecode: source?.end_timecode ?? null,
        speakers: source?.speakers && source.speakers.length > 0 ? source.speakers : [source?.speaker || "Speaker"],
        title: `Mock ${target.style} ${target.duration} moment`,
        summary: "Mock discovery matrix moment identity for local validation.",
        raw_score: bucketMembership.bucket_score,
        buckets: [bucketMembership],
        review_flags: [],
      });
    }

    return {
      style: target.style,
      duration: target.duration,
      moment_ids: matchingMomentIds,
    };
  });

  return socialReelsDiscoveryMatrixResponseSchema.parse({
    moments: [...momentsById.values()],
    buckets,
    model_notes: "Mock discovery matrix response generated locally; no transcript text was sent to OpenAI.",
  });
}

function approximateInputTextChars(input: SocialReelsRequest) {
  return input.segments.reduce((sum, segment) => sum + segment.text.length, 0);
}

function safeParseErrorCode(error: unknown) {
  if (error instanceof SyntaxError) return "json_parse_error";
  if (error instanceof Error) return error.message.slice(0, 120) || "parse_error";
  return "unknown_parse_error";
}

function invalidOpenAIResponseDiagnostics(input: {
  body: OpenAIResponseBody;
  parsedOutput: unknown;
  parseError: unknown;
  zodError: z.ZodError | null;
  model: string;
  elapsedMs: number;
  status: number;
  effectiveCandidateCount: number;
  inputPayload: SocialReelsRequest;
  eligibleDurationWindowCount: number;
  windowsAfterQualityFilter: number | null;
  excludedWindowReasonCounts: Record<string, number> | null;
  averageWindowQualityScore: number | null;
  demotedWindowReasonCounts: Record<string, number> | null;
  selectedWindowQualityRange: { min: number | null; max: number | null } | null;
  selectedWindowQualityDistribution: { strong: number; decent: number; weak: number } | null;
  selectedWindowReasonCounts: { quality_reasons: Record<string, number>; demotion_reasons: Record<string, number>; selected_windows_with_demotion_count: number } | null;
  durationWindowCountSentToModel: number;
  promptContextCharCountSentToModel: number;
  maxOutputTokens: number;
  schemaMode: SocialReelsInvalidResponseDiagnostics["schema_mode"];
}): SocialReelsInvalidResponseDiagnostics {
  return {
    provider: "openai",
    model: input.body.model || input.model,
    provider_response_id: input.body.id || null,
    openai_status: input.status,
    elapsed_ms: input.elapsedMs,
    schema_mode: input.schemaMode,
    effective_candidate_count: input.effectiveCandidateCount,
    duration_preferences: input.inputPayload.duration_preferences.slice(0, 12),
    segment_count: input.inputPayload.segments.length,
    approximate_total_text_chars: approximateInputTextChars(input.inputPayload),
    eligible_duration_window_count: input.eligibleDurationWindowCount,
    windows_after_quality_filter: input.windowsAfterQualityFilter,
    excluded_window_reason_counts: input.excludedWindowReasonCounts,
    average_window_quality_score: input.averageWindowQualityScore,
    demoted_window_reason_counts: input.demotedWindowReasonCounts,
    selected_window_quality_range: input.selectedWindowQualityRange,
    selected_window_quality_distribution: input.selectedWindowQualityDistribution,
    selected_window_reason_counts: input.selectedWindowReasonCounts,
    duration_window_count_sent_to_model: input.durationWindowCountSentToModel,
    prompt_context_char_count_sent_to_model: input.promptContextCharCountSentToModel,
    max_output_tokens: input.maxOutputTokens,
    response_status: input.body.status || null,
    incomplete_reason: input.body.incomplete_details?.reason || null,
    parse_error: input.parseError ? safeParseErrorCode(input.parseError) : null,
    zod_issues: input.zodError ? getSafeZodIssueSummary(input.zodError) : null,
    output_shape: summarizeSocialReelsOutputShape(input.parsedOutput),
  };
}

export async function discoverSocialReelsCandidates(
  rawInput: unknown,
  options: DiscoverSocialReelsOptions = {}
): Promise<DiscoverSocialReelsResult> {
  const input = socialReelsRequestSchema.parse(rawInput);
  const model = options.model || getSocialReelsOpenAIModel();

  if (shouldUseMock(options)) {
    if (input.discovery_matrix) {
      const matrixResponse = buildMockMatrixResponse(input);
      return {
        response: null,
        matrixResponse,
        usage: null,
        providerResponseId: null,
        model: "mock",
        mock: true,
        requestedCandidateCount: input.requested_candidate_count,
        effectiveCandidateCount: input.max_unique_moments,
        returnedCandidateCount: matrixResponse.moments.length,
        filteredCandidateCount: 0,
        eligibleDurationWindowCount: null,
        windowsAfterQualityFilter: null,
        excludedWindowReasonCounts: null,
        averageWindowQualityScore: null,
        demotedWindowReasonCounts: null,
        selectedWindowQualityRange: null,
        selectedWindowQualityDistribution: null,
        selectedWindowReasonCounts: null,
        durationWindowCountSentToModel: null,
        promptContextCharCountSentToModel: null,
        liveFilterReasons: { duration_outside_bucket: 0 },
        returnedDurationSecondsRange: { min: null, max: null },
        discoveryMode: "discovery_matrix",
        diagnostics: {
          mode: "mock",
          openaiRequestStartedAt: null,
          openaiElapsedMs: null,
          responseParseMs: null,
          provider: "mock",
          model: "mock",
          providerResponseId: null,
          durationWindowCountSentToModel: null,
          promptContextCharCountSentToModel: null,
          windowsAfterQualityFilter: null,
          excludedWindowReasonCounts: null,
          averageWindowQualityScore: null,
          demotedWindowReasonCounts: null,
          selectedWindowQualityRange: null,
          selectedWindowQualityDistribution: null,
          selectedWindowReasonCounts: null,
        },
      };
    }

    const response = socialReelsResponseSchema.parse(buildMockResponse(input));
    return {
      response,
      matrixResponse: null,
      usage: null,
      providerResponseId: null,
      model: "mock",
      mock: true,
      requestedCandidateCount: input.requested_candidate_count,
      effectiveCandidateCount: input.requested_candidate_count,
      returnedCandidateCount: response.candidates.length,
      filteredCandidateCount: 0,
      eligibleDurationWindowCount: null,
      windowsAfterQualityFilter: null,
      excludedWindowReasonCounts: null,
      averageWindowQualityScore: null,
      demotedWindowReasonCounts: null,
      selectedWindowQualityRange: null,
      selectedWindowQualityDistribution: null,
      selectedWindowReasonCounts: null,
      durationWindowCountSentToModel: null,
      promptContextCharCountSentToModel: null,
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
        durationWindowCountSentToModel: null,
        promptContextCharCountSentToModel: null,
        windowsAfterQualityFilter: null,
        excludedWindowReasonCounts: null,
        averageWindowQualityScore: null,
        demotedWindowReasonCounts: null,
        selectedWindowQualityRange: null,
        selectedWindowQualityDistribution: null,
        selectedWindowReasonCounts: null,
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
  const scoredDurationWindows = scoreSocialReelsDurationWindows(liveShortlistInput, durationWindows);
  const windowQualitySummary = summarizeSocialReelsWindowQuality(scoredDurationWindows);
  const selectedDurationWindows = selectSocialReelsLiveDurationWindows(scoredDurationWindows, getSocialReelsLivePromptWindowCount());
  const selectedWindowQualityRange = getSocialReelsWindowQualityRange(selectedDurationWindows);
  const selectedWindowQualityDistribution = getSocialReelsWindowQualityDistribution(selectedDurationWindows);
  const selectedWindowReasonCounts = getSocialReelsWindowReasonCounts(selectedDurationWindows);
  const promptDurationWindows = buildSocialReelsLivePromptWindows(liveShortlistInput, selectedDurationWindows);
  const controller = new AbortController();
  const openaiStartedMs = Date.now();
  const openaiRequestStartedAt = new Date(openaiStartedMs).toISOString();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const isDiscoveryMatrix = Boolean(input.discovery_matrix);
  const promptInput = buildSocialReelsOpenAIPromptInput(liveShortlistInput, {
    discoveryMode: isDiscoveryMatrix ? "discovery_matrix" : "live_shortlist",
    requestedCandidateCount,
    effectiveCandidateCount,
    durationWindows: promptDurationWindows,
  });
  const promptContextCharCountSentToModel = JSON.stringify(promptInput).length;
  const durationWindowCountSentToModel = promptDurationWindows.length;
  const requestBody: Record<string, unknown> = {
    model,
    input: promptInput,
    max_output_tokens: maxOutputTokens,
    text: {
      format: isDiscoveryMatrix
        ? openAISocialReelsDiscoveryMatrixResponseFormat(input.max_unique_moments, input.max_per_bucket)
        : openAISocialReelsShortlistResponseFormat(effectiveCandidateCount),
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
    if (isDiscoveryMatrix) {
      const matrixResponse = socialReelsDiscoveryMatrixResponseSchema.parse(parsedOutput);
      const responseParseMs = Date.now() - responseParseStartedMs;

      return {
        response: null,
        matrixResponse,
        usage: body.usage || null,
        providerResponseId: body.id || null,
        model: body.model || model,
        mock: false,
        requestedCandidateCount,
        effectiveCandidateCount: input.max_unique_moments,
        returnedCandidateCount: matrixResponse.moments.length,
        filteredCandidateCount: 0,
        eligibleDurationWindowCount: durationWindows.length,
        windowsAfterQualityFilter: windowQualitySummary.windows_after_quality_filter,
        excludedWindowReasonCounts: windowQualitySummary.excluded_window_reason_counts,
        averageWindowQualityScore: windowQualitySummary.average_window_quality_score,
        demotedWindowReasonCounts: windowQualitySummary.demoted_window_reason_counts,
        selectedWindowQualityRange,
        selectedWindowQualityDistribution,
        selectedWindowReasonCounts,
        durationWindowCountSentToModel,
        promptContextCharCountSentToModel,
        liveFilterReasons: { duration_outside_bucket: 0 },
        returnedDurationSecondsRange: { min: null, max: null },
        discoveryMode: "discovery_matrix",
        diagnostics: {
          mode: "live",
          openaiRequestStartedAt,
          openaiElapsedMs,
          responseParseMs,
          provider: "openai",
          model: body.model || model,
          providerResponseId: body.id || null,
          durationWindowCountSentToModel,
          promptContextCharCountSentToModel,
          windowsAfterQualityFilter: windowQualitySummary.windows_after_quality_filter,
          excludedWindowReasonCounts: windowQualitySummary.excluded_window_reason_counts,
          averageWindowQualityScore: windowQualitySummary.average_window_quality_score,
          demotedWindowReasonCounts: windowQualitySummary.demoted_window_reason_counts,
          selectedWindowQualityRange,
          selectedWindowQualityDistribution,
          selectedWindowReasonCounts,
        },
      };
    }

    const shortlist = socialReelsShortlistResponseSchema.parse(parsedOutput);
    const hydratedShortlist = hydrateSocialReelsShortlistResponse(shortlist, liveShortlistInput);
    const responseParseMs = Date.now() - responseParseStartedMs;

    return {
      response: hydratedShortlist.response,
      matrixResponse: null,
      usage: body.usage || null,
      providerResponseId: body.id || null,
      model: body.model || model,
      mock: false,
      requestedCandidateCount,
      effectiveCandidateCount,
      returnedCandidateCount: hydratedShortlist.returnedCandidateCount,
      filteredCandidateCount: hydratedShortlist.filteredCandidateCount,
      eligibleDurationWindowCount: durationWindows.length,
      windowsAfterQualityFilter: windowQualitySummary.windows_after_quality_filter,
      excludedWindowReasonCounts: windowQualitySummary.excluded_window_reason_counts,
      averageWindowQualityScore: windowQualitySummary.average_window_quality_score,
      demotedWindowReasonCounts: windowQualitySummary.demoted_window_reason_counts,
      selectedWindowQualityRange,
      selectedWindowQualityDistribution,
      selectedWindowReasonCounts,
      durationWindowCountSentToModel,
      promptContextCharCountSentToModel,
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
        durationWindowCountSentToModel,
        promptContextCharCountSentToModel,
        windowsAfterQualityFilter: windowQualitySummary.windows_after_quality_filter,
        excludedWindowReasonCounts: windowQualitySummary.excluded_window_reason_counts,
        averageWindowQualityScore: windowQualitySummary.average_window_quality_score,
        demotedWindowReasonCounts: windowQualitySummary.demoted_window_reason_counts,
        selectedWindowQualityRange,
        selectedWindowQualityDistribution,
        selectedWindowReasonCounts,
      },
    };
  } catch (error) {
    if (error instanceof SocialReelsDiscoveryError) throw error;
    let parsedOutput: unknown = null;
    let parseError: unknown = null;
    let zodError: z.ZodError | null = null;

    try {
      const outputText = extractOutputText(body);
      if (outputText) {
        parsedOutput = JSON.parse(outputText) as unknown;
        const responseResult = isDiscoveryMatrix
          ? socialReelsDiscoveryMatrixResponseSchema.safeParse(parsedOutput)
          : socialReelsShortlistResponseSchema.safeParse(parsedOutput);
        if (!responseResult.success) zodError = responseResult.error;
      } else {
        parseError = new Error("missing_output_text");
      }
    } catch (diagnosticError) {
      parseError = diagnosticError;
    }

    throw new SocialReelsDiscoveryError("OpenAI response was invalid.", {
      stage: "openai_invalid_response",
      elapsedMs: openaiElapsedMs,
      status: res.status,
      safeDiagnostics: invalidOpenAIResponseDiagnostics({
        body,
        parsedOutput,
        parseError,
        zodError,
        model,
        elapsedMs: openaiElapsedMs,
        status: res.status,
        effectiveCandidateCount,
        inputPayload: input,
        eligibleDurationWindowCount: durationWindows.length,
        durationWindowCountSentToModel,
        promptContextCharCountSentToModel,
        maxOutputTokens,
        windowsAfterQualityFilter: windowQualitySummary.windows_after_quality_filter,
        excludedWindowReasonCounts: windowQualitySummary.excluded_window_reason_counts,
        averageWindowQualityScore: windowQualitySummary.average_window_quality_score,
        demotedWindowReasonCounts: windowQualitySummary.demoted_window_reason_counts,
        selectedWindowQualityRange,
        selectedWindowQualityDistribution,
        selectedWindowReasonCounts,
        schemaMode: isDiscoveryMatrix ? "discovery_matrix" : "live_shortlist_reduced",
      }),
    });
  }
}
