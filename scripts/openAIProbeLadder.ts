import { openAISocialReelsResponseFormat } from "../lib/socialReelsSchema";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_PROBE_TIMEOUT_MS = 30_000;
const DEFAULT_PROBE_REASONING_EFFORT = "minimal";

type ProbeStatus = "ok" | "timeout" | "non2xx" | "invalid_json" | "schema_invalid" | "missing_output" | "network_error";
type SchemaMode = "none" | "tiny" | "reduced_social" | "full_social";

type OpenAIProbeResponseBody = {
  id?: string;
  model?: string;
  status?: string;
  output_text?: string;
  incomplete_details?: {
    reason?: string;
  };
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
  };
};

type ProbeDefinition = {
  name: string;
  model: string;
  reasoningEffort: string | null;
  serviceTier: string | null;
  schemaMode: SchemaMode;
  maxOutputTokens: number;
  candidateCountRequested: number | null;
  body: Record<string, unknown>;
  candidateCountExpected?: number;
  expectsJson?: boolean;
};

type ProbeResult = {
  probe_name: string;
  request_id: string;
  model: string;
  reasoning_effort: string | null;
  service_tier: string | null;
  max_output_tokens: number;
  candidate_count_requested: number | null;
  schema_mode: SchemaMode;
  elapsed_ms: number;
  status: ProbeStatus;
  openai_status_code: number | null;
  timeout_stage: "openai_fetch_timeout" | null;
  output_present: boolean;
  output_text_length: number | null;
  candidate_count: number | null;
  parse_valid: boolean;
  incomplete_reason: string | null;
  provider_response_id: string | null;
  provider_model: string | null;
  safe_error_type: string | null;
};

function boundedNumber(raw: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function probeReasoningEffort(defaultEffort = DEFAULT_PROBE_REASONING_EFFORT) {
  const effort = process.env.SOCIAL_REELS_OPENAI_REASONING_EFFORT?.trim().toLowerCase();
  if (effort === "none") return null;
  return effort || defaultEffort || null;
}

function probeServiceTier() {
  const serviceTier = process.env.SOCIAL_REELS_OPENAI_SERVICE_TIER?.trim().toLowerCase();
  if (!serviceTier || serviceTier === "none" || serviceTier === "standard") return null;
  return serviceTier;
}

function probeTimeoutMs() {
  return boundedNumber(process.env.SOCIAL_REELS_OPENAI_PROBE_TIMEOUT_MS, DEFAULT_PROBE_TIMEOUT_MS, 1_000, 120_000);
}

function probeMaxOutputTokens(fallback: number) {
  return boundedNumber(process.env.SOCIAL_REELS_OPENAI_MAX_OUTPUT_TOKENS, fallback, 128, 16_000);
}

function responseFormat(name: string, schema: Record<string, unknown>) {
  return {
    type: "json_schema",
    name,
    strict: true,
    schema,
  };
}

function minimalOkFormat() {
  return responseFormat("minimal_ok", {
    type: "object",
    additionalProperties: false,
    required: ["ok", "message"],
    properties: {
      ok: { type: "boolean" },
      message: { type: "string", enum: ["ok"] },
    },
  });
}

function reducedSocialReelsFormat(candidateCount: number) {
  return responseFormat(`social_reels_reduced_${candidateCount}`, {
    type: "object",
    additionalProperties: false,
    required: ["candidates", "model_notes"],
    properties: {
      candidates: {
        type: "array",
        minItems: candidateCount,
        maxItems: candidateCount,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "candidate_id",
            "duration_bucket",
            "start_seconds",
            "end_seconds",
            "start_anchor_quote",
            "end_anchor_quote",
            "title",
            "score",
          ],
          properties: {
            candidate_id: { type: "string", minLength: 1, maxLength: 80 },
            duration_bucket: { type: "string", enum: ["60s"] },
            start_seconds: { type: "number", minimum: 0, maximum: 240 },
            end_seconds: { type: "number", minimum: 0, maximum: 240 },
            start_anchor_quote: { type: "string", minLength: 5, maxLength: 160 },
            end_anchor_quote: { type: "string", minLength: 5, maxLength: 160 },
            title: { type: "string", minLength: 1, maxLength: 120 },
            score: { type: "number", minimum: 0, maximum: 1 },
          },
        },
      },
      model_notes: {
        anyOf: [{ type: "string", maxLength: 500 }, { type: "null" }],
      },
    },
  });
}

function fullSocialReelsFormat(candidateCount: number) {
  const cloned = JSON.parse(JSON.stringify(openAISocialReelsResponseFormat)) as {
    schema: {
      properties: {
        candidates: {
          minItems?: number;
          maxItems?: number;
        };
      };
    };
    name: string;
  };
  cloned.name = `social_reels_full_${candidateCount}`;
  cloned.schema.properties.candidates.minItems = candidateCount;
  cloned.schema.properties.candidates.maxItems = candidateCount;
  return cloned;
}

function syntheticSegments() {
  return [
    "A strong reel starts when the speaker names a problem that a viewer immediately understands. The tension builds when they explain why the usual advice fails. The answer lands when they give a practical reframe that changes the viewer's next step.",
    "The clip should not include mic checks, countdowns, or setup chatter. It should begin with a clear claim, keep the conflict, and end after the payoff. This synthetic segment exists only for backend OpenAI probing.",
    "A title can create curiosity without misleading anyone. The best moment is specific, standalone, and easy to edit. The final sentence should feel like a clean landing, not a trailing explanation.",
  ];
}

function socialPrompt(candidateCount: number, schemaKind: "reduced" | "full") {
  return [
    {
      role: "system",
      content:
        schemaKind === "full"
          ? "Return only schema-valid JSON. Find synthetic Social Reels candidates from the provided safe transcript. Use exact anchor quotes from the transcript. Rank strongest to weakest."
          : "Return only schema-valid JSON. Produce the requested number of simple Social Reels candidates from the provided safe transcript.",
    },
    {
      role: "user",
      content: JSON.stringify({
        requested_candidate_count: candidateCount,
        duration_preferences: ["60s"],
        segments: syntheticSegments().map((text, index) => ({
          segment_id: `probe-seg-${index + 1}`,
          start_seconds: index * 80,
          end_seconds: index * 80 + 80,
          speaker: "Speaker 1",
          text,
        })),
      }),
    },
  ];
}

function extractOutputText(body: OpenAIProbeResponseBody) {
  if (typeof body.output_text === "string" && body.output_text.trim()) return body.output_text;

  for (const output of body.output || []) {
    for (const content of output.content || []) {
      if (typeof content.refusal === "string" && content.refusal.trim()) {
        return null;
      }

      if (content.type === "output_text" && typeof content.text === "string" && content.text.trim()) {
        return content.text;
      }
    }
  }

  return null;
}

function candidateCountFromParsed(parsed: unknown) {
  if (!parsed || typeof parsed !== "object") return null;
  const candidates = (parsed as Record<string, unknown>).candidates;
  return Array.isArray(candidates) ? candidates.length : null;
}

function parseOutput(outputText: string | null, expectedCandidateCount?: number, expectsJson = true) {
  if (!outputText) {
    return {
      status: "missing_output" as const,
      outputPresent: false,
      outputTextLength: null,
      candidateCount: null,
      parseValid: false,
    };
  }

  if (!expectsJson) {
    return {
      status: "ok" as const,
      outputPresent: true,
      outputTextLength: outputText.length,
      candidateCount: null,
      parseValid: true,
    };
  }

  try {
    const parsed = JSON.parse(outputText) as unknown;
    const candidateCount = candidateCountFromParsed(parsed);
    const parseValid = typeof expectedCandidateCount === "number" ? candidateCount === expectedCandidateCount : true;
    return {
      status: parseValid ? ("ok" as const) : ("schema_invalid" as const),
      outputPresent: true,
      outputTextLength: outputText.length,
      candidateCount,
      parseValid,
    };
  } catch {
    return {
      status: "invalid_json" as const,
      outputPresent: true,
      outputTextLength: outputText.length,
      candidateCount: null,
      parseValid: false,
    };
  }
}

function buildProbeBody(probe: ProbeDefinition) {
  const body: Record<string, unknown> = {
    ...probe.body,
    model: probe.model,
    max_output_tokens: probe.maxOutputTokens,
  };

  if (probe.reasoningEffort) {
    body.reasoning = { effort: probe.reasoningEffort };
  }

  if (probe.serviceTier) {
    body.service_tier = probe.serviceTier;
  }

  return body;
}

function probeDefinitions(): ProbeDefinition[] {
  const gpt5MiniReasoning = probeReasoningEffort("minimal");
  const gpt54MiniReasoning = probeReasoningEffort("minimal");
  const gpt54Reasoning = probeReasoningEffort("low");
  const serviceTier = probeServiceTier();

  return [
    {
      name: "01_gpt5mini_minimal_ping",
      model: "gpt-5-mini",
      reasoningEffort: gpt5MiniReasoning,
      serviceTier,
      schemaMode: "none",
      maxOutputTokens: 32,
      candidateCountRequested: null,
      expectsJson: false,
      body: {
        input: "Return ok.",
      },
    },
    {
      name: "02_gpt5mini_minimal_structured_output",
      model: "gpt-5-mini",
      reasoningEffort: gpt5MiniReasoning,
      serviceTier,
      schemaMode: "tiny",
      maxOutputTokens: 64,
      candidateCountRequested: null,
      body: {
        input: "Return exactly the requested JSON object with ok true and message ok.",
        text: { format: minimalOkFormat() },
      },
    },
    {
      name: "03_gpt5mini_reduced_social_3_candidates",
      model: "gpt-5-mini",
      reasoningEffort: gpt5MiniReasoning,
      serviceTier,
      schemaMode: "reduced_social",
      maxOutputTokens: probeMaxOutputTokens(1_200),
      candidateCountRequested: 3,
      candidateCountExpected: 3,
      body: {
        input: socialPrompt(3, "reduced"),
        text: { format: reducedSocialReelsFormat(3) },
      },
    },
    {
      name: "04_gpt5mini_reduced_social_10_candidates",
      model: "gpt-5-mini",
      reasoningEffort: gpt5MiniReasoning,
      serviceTier,
      schemaMode: "reduced_social",
      maxOutputTokens: probeMaxOutputTokens(2_500),
      candidateCountRequested: 10,
      candidateCountExpected: 10,
      body: {
        input: socialPrompt(10, "reduced"),
        text: { format: reducedSocialReelsFormat(10) },
      },
    },
    {
      name: "05_gpt5mini_reduced_social_30_candidates",
      model: "gpt-5-mini",
      reasoningEffort: gpt5MiniReasoning,
      serviceTier,
      schemaMode: "reduced_social",
      maxOutputTokens: probeMaxOutputTokens(6_000),
      candidateCountRequested: 30,
      candidateCountExpected: 30,
      body: {
        input: socialPrompt(30, "reduced"),
        text: { format: reducedSocialReelsFormat(30) },
      },
    },
    {
      name: "06_gpt54mini_reduced_social_30_candidates",
      model: "gpt-5.4-mini",
      reasoningEffort: gpt54MiniReasoning,
      serviceTier,
      schemaMode: "reduced_social",
      maxOutputTokens: probeMaxOutputTokens(6_000),
      candidateCountRequested: 30,
      candidateCountExpected: 30,
      body: {
        input: socialPrompt(30, "reduced"),
        text: { format: reducedSocialReelsFormat(30) },
      },
    },
    {
      name: "07_gpt54_reduced_social_10_candidates",
      model: "gpt-5.4",
      reasoningEffort: gpt54Reasoning,
      serviceTier,
      schemaMode: "reduced_social",
      maxOutputTokens: probeMaxOutputTokens(2_500),
      candidateCountRequested: 10,
      candidateCountExpected: 10,
      body: {
        input: socialPrompt(10, "reduced"),
        text: { format: reducedSocialReelsFormat(10) },
      },
    },
    {
      name: "08_gpt54_full_social_10_candidates",
      model: "gpt-5.4",
      reasoningEffort: gpt54Reasoning,
      serviceTier,
      schemaMode: "full_social",
      maxOutputTokens: probeMaxOutputTokens(8_000),
      candidateCountRequested: 10,
      candidateCountExpected: 10,
      body: {
        input: socialPrompt(10, "full"),
        text: { format: fullSocialReelsFormat(10) },
      },
    },
    {
      name: "09_gpt54_full_social_30_candidates",
      model: "gpt-5.4",
      reasoningEffort: gpt54Reasoning,
      serviceTier,
      schemaMode: "full_social",
      maxOutputTokens: probeMaxOutputTokens(12_000),
      candidateCountRequested: 30,
      candidateCountExpected: 30,
      body: {
        input: socialPrompt(30, "full"),
        text: { format: fullSocialReelsFormat(30) },
      },
    },
  ];
}

function baseResult(probe: ProbeDefinition, requestId: string, elapsedMs: number): Pick<ProbeResult, "probe_name" | "request_id" | "model" | "reasoning_effort" | "service_tier" | "max_output_tokens" | "candidate_count_requested" | "schema_mode" | "elapsed_ms"> {
  return {
    probe_name: probe.name,
    request_id: requestId,
    model: probe.model,
    reasoning_effort: probe.reasoningEffort,
    service_tier: probe.serviceTier,
    max_output_tokens: probe.maxOutputTokens,
    candidate_count_requested: probe.candidateCountRequested,
    schema_mode: probe.schemaMode,
    elapsed_ms: elapsedMs,
  };
}

async function runProbe(probe: ProbeDefinition): Promise<ProbeResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  if (!apiKey) {
    return {
      ...baseResult(probe, requestId, 0),
      status: "network_error",
      openai_status_code: null,
      timeout_stage: null,
      output_present: false,
      output_text_length: null,
      candidate_count: null,
      parse_valid: false,
      incomplete_reason: null,
      provider_response_id: null,
      provider_model: null,
      safe_error_type: "missing_openai_api_key",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), probeTimeoutMs());

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildProbeBody(probe)),
      signal: controller.signal,
    });
    const elapsedMs = Date.now() - startedAt;
    const body = (await response.json().catch(() => ({}))) as OpenAIProbeResponseBody;

    if (!response.ok) {
      return {
        ...baseResult(probe, requestId, elapsedMs),
        status: "non2xx",
        openai_status_code: response.status,
        timeout_stage: null,
        output_present: false,
        output_text_length: null,
        candidate_count: null,
        parse_valid: false,
        incomplete_reason: body.incomplete_details?.reason || null,
        provider_response_id: body.id || null,
        provider_model: body.model || null,
        safe_error_type: body.error?.type || body.error?.code || "openai_non2xx",
      };
    }

    const outputText = extractOutputText(body);
    const parsed = parseOutput(outputText, probe.candidateCountExpected, probe.expectsJson !== false);
    return {
      ...baseResult(probe, requestId, elapsedMs),
      status: body.status === "incomplete" ? "schema_invalid" : parsed.status,
      openai_status_code: response.status,
      timeout_stage: null,
      output_present: parsed.outputPresent,
      output_text_length: parsed.outputTextLength,
      candidate_count: parsed.candidateCount,
      parse_valid: body.status !== "incomplete" && parsed.parseValid,
      incomplete_reason: body.incomplete_details?.reason || null,
      provider_response_id: body.id || null,
      provider_model: body.model || null,
      safe_error_type: null,
    };
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    return {
      ...baseResult(probe, requestId, elapsedMs),
      status: error instanceof Error && error.name === "AbortError" ? "timeout" : "network_error",
      openai_status_code: null,
      timeout_stage: error instanceof Error && error.name === "AbortError" ? "openai_fetch_timeout" : null,
      output_present: false,
      output_text_length: null,
      candidate_count: null,
      parse_valid: false,
      incomplete_reason: null,
      provider_response_id: null,
      provider_model: null,
      safe_error_type: error instanceof Error ? error.name : "unknown_error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function runOpenAIProbeLadder() {
  if (process.env.TEST_OPENAI_PROBE !== "1") {
    console.log("OPENAI_PROBE: skipped. Set TEST_OPENAI_PROBE=1 to run the live OpenAI probe ladder.");
    return true;
  }

  const probes = probeDefinitions();
  console.log("OPENAI_PROBE: running gated live model ladder with synthetic safe text only.");
  console.log(
    "OPENAI_PROBE_CONFIG:",
    JSON.stringify({
      ladder_models: [...new Set(probes.map((probe) => probe.model))],
      reasoning_effort_env: process.env.SOCIAL_REELS_OPENAI_REASONING_EFFORT?.trim() || null,
      service_tier: probeServiceTier(),
      probe_timeout_ms: probeTimeoutMs(),
      max_output_tokens_env_present: Boolean(process.env.SOCIAL_REELS_OPENAI_MAX_OUTPUT_TOKENS),
    })
  );

  for (const probe of probes) {
    const result = await runProbe(probe);
    console.log("OPENAI_PROBE_RESULT:", JSON.stringify(result));

    if (result.status !== "ok") {
      console.log("OPENAI_PROBE: stopping after first failing probe.");
      return false;
    }
  }

  console.log("OPENAI_PROBE: all probes passed.");
  return true;
}
