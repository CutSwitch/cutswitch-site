import "server-only";

import {
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

function pickCandidateBucket(input: SocialReelsRequest, index: number) {
  if (input.duration_bucket === "mixed" || input.duration_bucket === "custom") {
    return SOCIAL_REELS_DURATION_BUCKETS[index % SOCIAL_REELS_DURATION_BUCKETS.length];
  }

  return input.duration_bucket;
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

function makeMockCandidate(input: SocialReelsRequest, index: number): SocialReelsCandidate {
  const segment = input.segments[index % input.segments.length];
  const durationBucket = pickCandidateBucket(input, index);
  const start = Math.max(0, Math.round(segment.start_seconds));
  const targetDuration = bucketDurationSeconds(durationBucket);
  const duration = Math.max(5, Math.min(targetDuration, Math.max(5, input.source_duration_seconds - start)));
  const ordinal = index + 1;

  return {
    candidate_id: `mock-reel-${String(ordinal).padStart(2, "0")}`,
    title: `Clip ${ordinal}: Strong moment`,
    hook: segment.text.slice(0, 140) || "A concise moment from the conversation.",
    summary: `Mock social reel candidate ${ordinal} based on transcript segment ${segment.id}.`,
    duration_bucket: durationBucket,
    start_seconds: start,
    end_seconds: start + duration,
    duration_seconds: duration,
    score: Math.max(60, 96 - (index % 30)),
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
        "You identify short-form social reel candidates from podcast or multicam transcript segments. Return only schema-valid JSON. Do not include raw file paths, private metadata, or invented timestamps.",
    },
    {
      role: "user",
      content: JSON.stringify({
        source_duration_seconds: input.source_duration_seconds,
        duration_bucket: input.duration_bucket,
        requested_candidate_count: input.requested_candidate_count,
        custom_duration_seconds: input.custom_duration_seconds || null,
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
