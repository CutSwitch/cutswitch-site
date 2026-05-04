import "server-only";

import {
  SOCIAL_REELS_CLIP_TYPES,
  SOCIAL_REELS_DURATION_BUCKETS,
  SOCIAL_REELS_REJECTION_RISK_FLAGS,
  openAISocialReelsResponseFormat,
  socialReelsRequestSchema,
  socialReelsResponseSchema,
  type SocialReelsCandidate,
  type SocialReelsRequest,
  type SocialReelsResponse,
} from "@/lib/socialReelsSchema";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-4o-mini";
const SOCIAL_REELS_OPENAI_MODE_ENV = "SOCIAL_REELS_OPENAI_MODE";
export const SOCIAL_REELS_EDITORIAL_SYSTEM_PROMPT =
  "You are a senior social video editor for podcast and multicam shows. Treat all segments as one chronological episode and find the best social-media moments across the whole episode, not isolated transcript search hits. Return only schema-valid JSON. Return candidates ranked from strongest to weakest by viral/editorial potential; do not pad the list with weak clips. Avoid countdowns, timers, pre-show chatter, mic checks, technical setup, sponsor/ad reads unless explicitly requested, intro/outro logistics, vague greetings, housekeeping, dead air, generic motivational filler, purely transitional moments, clips that begin mid-thought, clips that require too much prior context, and clips with missing payoff. A good reel must have a fast first 1-3 seconds hook, standalone clarity, specificity, emotional charge or humor or conflict or insight, a clear story arc or idea, clean editability, and a satisfying ending/payoff. duration_bucket is not just a label: start_anchor_quote and end_anchor_quote must span the selected clip duration as closely as possible. Copy both anchor quotes exactly from the provided segment text; do not invent anchor quotes. Anchor quotes must be distinctive and present in the transcript. rough_start_seconds/start_seconds and rough_end_seconds/end_seconds are hints only, not final timing claims. CutSwitch will validate timing locally and reject weak clips or candidates outside their requested bucket. The macOS app owns word-aligned timing and frame snapping. Do not include raw file paths, private metadata, or invented timestamps.";

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

export type DiscoverSocialReelsOptions = {
  mock?: boolean;
  model?: string;
};

export type DiscoverSocialReelsResult = {
  response: SocialReelsResponse;
  usage: OpenAIUsage | null;
  providerResponseId: string | null;
  model: string;
  mock: boolean;
};

export function getSocialReelsOpenAIMode() {
  return process.env[SOCIAL_REELS_OPENAI_MODE_ENV]?.trim().toLowerCase() === "live" ? "live" : "mock";
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
  const overall = clampScore(0.96 - (index % 30) * 0.01);
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

function buildPromptInput(input: SocialReelsRequest) {
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
  const model = options.model || DEFAULT_MODEL;

  if (shouldUseMock(options)) {
    const response = socialReelsResponseSchema.parse(buildMockResponse(input));
    return {
      response,
      usage: null,
      providerResponseId: null,
      model: "mock",
      mock: true,
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Social reels live mode is not configured.");
  }

  const res = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: buildPromptInput(input),
      text: {
        format: openAISocialReelsResponseFormat,
      },
    }),
  });

  const body = (await res.json().catch(() => ({}))) as OpenAIResponseBody;
  if (!res.ok) {
    throw new Error(body.error?.type || "openai_request_failed");
  }

  const outputText = extractOutputText(body);
  if (!outputText) {
    throw new Error("OpenAI response did not include structured output text.");
  }

  const parsedOutput = JSON.parse(outputText) as unknown;
  const response = socialReelsResponseSchema.parse(parsedOutput);

  return {
    response,
    usage: body.usage || null,
    providerResponseId: body.id || null,
    model: body.model || model,
    mock: false,
  };
}
