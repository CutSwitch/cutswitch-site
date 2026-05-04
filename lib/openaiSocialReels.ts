import "server-only";

import {
  SOCIAL_REELS_CLIP_TYPES,
  SOCIAL_REELS_DURATION_BUCKETS,
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

function bucketDurationSeconds(bucket: (typeof SOCIAL_REELS_DURATION_BUCKETS)[number]) {
  if (bucket === "15s") return 15;
  if (bucket === "30s") return 30;
  if (bucket === "60s") return 60;
  if (bucket === "90s") return 90;
  return 300;
}

function getConcreteDurationBuckets(input: SocialReelsRequest) {
  const preferences = input.duration_preferences || [input.duration_bucket];
  if (preferences.includes("mixed") || preferences.includes("custom")) {
    return SOCIAL_REELS_DURATION_BUCKETS;
  }

  const concreteBuckets = preferences.filter((preference): preference is (typeof SOCIAL_REELS_DURATION_BUCKETS)[number] =>
    SOCIAL_REELS_DURATION_BUCKETS.includes(preference as (typeof SOCIAL_REELS_DURATION_BUCKETS)[number])
  );

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

function findAnchorQuotes(text: string, index: number) {
  const words = cleanWords(text);
  if (words.length < 10) return null;

  const maxStart = Math.max(0, words.length - 10);
  const firstStart = Math.min(maxStart, (index * 3) % Math.max(1, Math.floor(words.length / 2)));
  const secondStart = Math.min(maxStart, Math.max(firstStart + 5, Math.floor(words.length / 2) + (index % 4)));

  const startQuote = phraseFromWords(words, firstStart);
  const endQuote = phraseFromWords(words, secondStart) || phraseFromWords(words, Math.max(firstStart + 5, words.length - 8));

  if (!startQuote || !endQuote || normalizeForSearch(startQuote) === normalizeForSearch(endQuote)) return null;

  return {
    startAnchorQuote: startQuote,
    endAnchorQuote: endQuote,
  };
}

function getMockSourceSegment(input: SocialReelsRequest, index: number) {
  const usableSegments = input.segments.filter((segment) => findAnchorQuotes(segment.text, index));
  return usableSegments[index % usableSegments.length] || input.segments[index % input.segments.length];
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
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
  const overall = clampScore(96 - (index % 30));
  return {
    hook_strength: clampScore(overall - (index % 5)),
    standalone_clarity: clampScore(overall - ((index + 2) % 6)),
    payoff_strength: clampScore(overall - ((index + 4) % 7)),
    emotional_charge: clampScore(70 + (index % 24)),
    novelty: clampScore(68 + ((index * 3) % 27)),
    editability: clampScore(82 + ((index * 2) % 14)),
    overall,
  };
}

function makeMockCandidate(input: SocialReelsRequest, index: number): SocialReelsCandidate {
  const segment = getMockSourceSegment(input, index);
  const anchors = findAnchorQuotes(segment.text, index);
  if (!anchors) {
    throw new Error("Mock social reels request needs transcript segments with enough distinctive words for anchor quotes.");
  }

  const durationBucket = pickCandidateBucket(input, index);
  const start = Math.max(0, Math.round(segment.start_seconds));
  const targetDuration = bucketDurationSeconds(durationBucket);
  const segmentDuration = Math.max(5, Math.round(segment.end_seconds - segment.start_seconds));
  const duration = Math.max(5, Math.min(targetDuration, segmentDuration));
  const end = Math.min(Math.round(segment.end_seconds), start + duration);
  const ordinal = index + 1;
  const clipType = pickClipType(index);
  const scores = makeScoreBreakdown(index);
  const topicTag = makeTopicTag(segment.text, index);
  const hookTitle = `Clip ${ordinal}: ${topicTag}`;
  const socialCaption = `${anchors.startAnchorQuote}... ${anchors.endAnchorQuote}`.slice(0, 280);

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
      content:
        "You identify short-form social reel candidates from podcast or multicam transcript segments. Return only schema-valid JSON. Build a large, editorially diverse candidate pool with varied concrete duration buckets and varied clip_type values. Copy start_anchor_quote and end_anchor_quote exactly from the provided segment text; do not invent anchor quotes. rough start/end times are hints only, not final timing claims. The macOS app owns word-aligned timing and frame snapping. Do not include raw file paths, private metadata, or invented timestamps.",
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
