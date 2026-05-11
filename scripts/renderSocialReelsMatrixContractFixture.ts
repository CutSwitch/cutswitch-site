import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { buildSocialReelsOpenAIPromptInput } from "../lib/socialReelsOpenAIPrompt";
import {
  buildSocialReelsLiveDurationWindows,
  buildSocialReelsLivePromptWindows,
  estimateSocialReelsPromptWindowCharCount,
  getSocialReelsLiveWindowCount,
  getSocialReelsWindowReasonCounts,
  scoreSocialReelsDurationWindows,
  selectSocialReelsLiveDurationWindows,
  summarizeSocialReelsWindowQuality,
  type SocialReelsPromptDurationWindow,
} from "../lib/socialReelsDurationWindows";
import {
  openAISocialReelsDiscoveryMatrixResponseFormat,
  socialReelsDiscoveryMatrixResponseSchema,
  socialReelsRequestSchema,
  type SocialReelsDiscoveryMatrixResponse,
  type SocialReelsRequest,
} from "../lib/socialReelsSchema";

const REQUEST_FIXTURE_PATH = resolve(process.cwd(), "tests/fixtures/social_reels_discovery_matrix_request.redacted.json");
const ARTIFACT_DIR = resolve(process.cwd(), "artifacts/social-reels-matrix-contract/latest");
const RESPONSE_FIXTURE_PATH = resolve(ARTIFACT_DIR, "social_reels_matrix_response.backend_fixture.json");
const PROMPT_WINDOWS_PATH = resolve(ARTIFACT_DIR, "social_reels_matrix_prompt_windows.redacted.json");
const REPORT_PATH = resolve(ARTIFACT_DIR, "backend_matrix_contract_report.md");
const PRIVATE_PATTERN = /(?:\/Users\/|file:\/\/|\.fcpxml\b|cache_path|media_path|OPENAI_API_KEY|access_token|refresh_token|Bearer\s+|wordAlignment|word_timing|words_aligned)/i;

type MatrixMoment = SocialReelsDiscoveryMatrixResponse["moments"][number];

function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function redactPromptWindow(window: SocialReelsPromptDurationWindow) {
  return {
    window_id: window.window_id,
    segment_id: window.segment_id,
    transcript_source: window.transcript_source,
    duration_bucket: window.duration_bucket,
    start_seconds: window.start_seconds,
    end_seconds: window.end_seconds,
    duration_seconds: window.duration_seconds,
    start_timecode: window.start_timecode ?? null,
    end_timecode: window.end_timecode ?? null,
    speakers: window.speakers ?? (window.speaker ? [window.speaker] : []),
    utterance_ids: window.utterance_ids ?? [],
    start_anchor_hint: "{{REDACTED_ANCHOR_HINT}}",
    end_anchor_hint: "{{REDACTED_ANCHOR_HINT}}",
    text_excerpt: "{{REDACTED_WINDOW_TEXT}}",
    utterances: (window.utterances ?? []).map((utterance) => ({
      utterance_id: utterance.utterance_id,
      speaker_label: utterance.speaker_label,
      start_seconds: utterance.start_seconds,
      end_seconds: utterance.end_seconds,
      start_timecode: utterance.start_timecode,
      end_timecode: utterance.end_timecode,
      text: "{{REDACTED_UTTERANCE_TEXT}}",
    })),
    window_quality_score: window.window_quality_score,
    window_quality_reasons: window.window_quality_reasons,
    window_demotion_reasons: window.window_demotion_reasons,
    window_exclusion_reason: window.window_exclusion_reason,
  };
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function speakerLabels(input: SocialReelsRequest) {
  return uniqueStrings([
    ...input.utterances.map((utterance) => utterance.speaker_label ?? ""),
    ...input.segments.flatMap((segment) => segment.speakers ?? []),
  ]);
}

function timecodeFor(input: SocialReelsRequest, seconds: number, kind: "start" | "end") {
  const utterances = [...input.utterances].sort((a, b) => {
    const aSeconds = kind === "start" ? a.start_seconds : a.end_seconds;
    const bSeconds = kind === "start" ? b.start_seconds : b.end_seconds;
    return Math.abs(aSeconds - seconds) - Math.abs(bSeconds - seconds);
  });
  const closest = utterances[0];
  return kind === "start" ? closest?.start_timecode ?? null : closest?.end_timecode ?? null;
}

function baseMoment(input: SocialReelsRequest, fields: Omit<MatrixMoment, "start_timecode" | "end_timecode" | "speakers">): MatrixMoment {
  const speakers = speakerLabels(input);
  return {
    ...fields,
    start_timecode: timecodeFor(input, fields.start_seconds, "start"),
    end_timecode: timecodeFor(input, fields.end_seconds, "end"),
    speakers: speakers.length > 0 ? speakers : ["Speaker"],
  };
}

function buildBackendFixtureResponse(input: SocialReelsRequest): SocialReelsDiscoveryMatrixResponse {
  const moments: MatrixMoment[] = [
    baseMoment(input, {
      moment_id: "moment-shared-emotional-educational-30s",
      start_seconds: 0,
      end_seconds: 30,
      title: "One Moment Can Teach and Move People",
      summary: "A compact matrix moment showing why the same identity can satisfy emotional and educational 30s buckets.",
      raw_score: 0.9,
      buckets: [
        {
          style: "emotional",
          duration: "30s",
          rank: 1,
          bucket_score: 0.9,
          why_it_fits: "It has emotional stakes and a clean payoff within the 30s target.",
        },
        {
          style: "educational",
          duration: "30s",
          rank: 1,
          bucket_score: 0.86,
          why_it_fits: "It teaches the discovery-matrix idea without creating a duplicate moment.",
        },
      ],
      review_flags: [],
    }),
    baseMoment(input, {
      moment_id: "moment-ready-hookfirst-15s",
      start_seconds: 4,
      end_seconds: 19,
      title: "The Fastest Hook Is the Real Question",
      summary: "A short hook-first moment intended to validate 15s bucket decoding.",
      raw_score: 0.84,
      buckets: [
        {
          style: "hookFirst",
          duration: "15s",
          rank: 1,
          bucket_score: 0.84,
          why_it_fits: "It starts quickly and resolves before the clip drags.",
        },
      ],
      review_flags: [],
    }),
    baseMoment(input, {
      moment_id: "moment-review-story-90s",
      start_seconds: 0,
      end_seconds: 90,
      title: "A Bigger Story Arc Needs Review",
      summary: "A 90s story candidate with enough structure for app-side review and timing validation.",
      raw_score: 0.72,
      buckets: [
        {
          style: "story",
          duration: "90s",
          rank: 1,
          bucket_score: 0.72,
          why_it_fits: "It can carry a longer story arc, but should be reviewed for context dependence.",
        },
      ],
      review_flags: ["too_context_dependent"],
    }),
    baseMoment(input, {
      moment_id: "moment-rejected-controversial-30s",
      start_seconds: 8,
      end_seconds: 38,
      title: "A Controversial Angle With Weak Payoff",
      summary: "A deliberately lower-quality example so the app can verify rejected matrix states.",
      raw_score: 0.48,
      buckets: [
        {
          style: "controversial",
          duration: "30s",
          rank: 1,
          bucket_score: 0.48,
          why_it_fits: "It has a provocative angle but lacks a satisfying payoff.",
        },
      ],
      review_flags: ["weak_hook", "missing_payoff"],
    }),
    baseMoment(input, {
      moment_id: "moment-review-deepcut-5-10m",
      start_seconds: 0,
      end_seconds: 300,
      title: "The Longform Deep Cut Needs a Full Arc",
      summary: "A conservative deepCut5To10m fixture example for apps that expose long-form matrix buckets.",
      raw_score: 0.68,
      buckets: [
        {
          style: "inspirational",
          duration: "5-10m",
          rank: 1,
          bucket_score: 0.68,
          why_it_fits: "It models a long-form bucket while remaining clearly marked for review.",
        },
      ],
      review_flags: ["too_context_dependent"],
    }),
  ];

  return socialReelsDiscoveryMatrixResponseSchema.parse({
    moments,
    buckets: [
      {
        style: "emotional",
        duration: "30s",
        moment_ids: ["moment-shared-emotional-educational-30s"],
      },
      {
        style: "educational",
        duration: "30s",
        moment_ids: ["moment-shared-emotional-educational-30s"],
      },
      {
        style: "hookFirst",
        duration: "15s",
        moment_ids: ["moment-ready-hookfirst-15s"],
      },
      {
        style: "story",
        duration: "90s",
        moment_ids: ["moment-review-story-90s"],
      },
      {
        style: "controversial",
        duration: "30s",
        moment_ids: ["moment-rejected-controversial-30s"],
      },
      {
        style: "inspirational",
        duration: "5-10m",
        moment_ids: ["moment-review-deepcut-5-10m"],
      },
    ],
    model_notes: "Backend-generated mock/golden matrix fixture. No live OpenAI call was made.",
  });
}

function validatePrivacy(path: string) {
  const content = readFileSync(path, "utf8");
  if (PRIVATE_PATTERN.test(content)) {
    throw new Error(`Privacy scan failed for ${path}`);
  }
}

function main() {
  const input = socialReelsRequestSchema.parse(JSON.parse(readFileSync(REQUEST_FIXTURE_PATH, "utf8")) as unknown);
  const effectiveCandidateCount = Math.min(10, input.max_unique_moments);
  const durationWindows = buildSocialReelsLiveDurationWindows(input, effectiveCandidateCount);
  const scoredWindows = scoreSocialReelsDurationWindows(input, durationWindows);
  const qualitySummary = summarizeSocialReelsWindowQuality(scoredWindows);
  const selectedWindows = selectSocialReelsLiveDurationWindows(scoredWindows, getSocialReelsLiveWindowCount("18"));
  const promptWindows = buildSocialReelsLivePromptWindows(input, selectedWindows);
  const promptInput = buildSocialReelsOpenAIPromptInput(input, {
    discoveryMode: "discovery_matrix",
    requestedCandidateCount: input.requested_candidate_count,
    effectiveCandidateCount,
    durationWindows: promptWindows,
  });
  const responseSchema = openAISocialReelsDiscoveryMatrixResponseFormat(input.max_unique_moments, input.max_per_bucket);
  const responseFixture = buildBackendFixtureResponse(input);
  const statusCounts = {
    ready: responseFixture.moments.filter((moment) => moment.review_flags.length === 0 && moment.raw_score >= 0.78).length,
    needs_review: responseFixture.moments.filter((moment) => moment.review_flags.length > 0 && moment.raw_score >= 0.55).length,
    rejected: responseFixture.moments.filter((moment) => moment.review_flags.includes("weak_hook") || moment.raw_score < 0.55).length,
  };
  const promptContextCharCount = JSON.stringify(promptInput).length;
  const promptWindowCharCount = estimateSocialReelsPromptWindowCharCount(promptWindows);
  const windowReasonCounts = getSocialReelsWindowReasonCounts(selectedWindows);

  mkdirSync(ARTIFACT_DIR, { recursive: true });
  writeJson(RESPONSE_FIXTURE_PATH, {
    ok: true,
    fixture_kind: "backend_generated_mock_golden",
    response_schema: "discovery_matrix",
    moments: responseFixture.moments,
    buckets: responseFixture.buckets,
    modelNotes: responseFixture.model_notes,
  });
  writeJson(PROMPT_WINDOWS_PATH, {
    fixture_kind: "redacted_backend_prompt_window_shape",
    transcript_source: input.utterances.length > 0 ? "utterances" : "segments",
    requested_targets: input.requested_targets,
    max_per_bucket: input.max_per_bucket,
    max_unique_moments: input.max_unique_moments,
    dedupe_shared_moments: input.dedupe_shared_moments,
    duration_window_count: durationWindows.length,
    selected_duration_window_count: selectedWindows.length,
    prompt_context_char_count: promptContextCharCount,
    prompt_window_char_count: promptWindowCharCount,
    quality_summary: qualitySummary,
    selected_window_reason_counts: windowReasonCounts,
    response_schema_summary: {
      type: responseSchema.type,
      name: responseSchema.name,
      strict: responseSchema.strict,
      top_level_required: responseSchema.schema.required,
      bucket_field_name: "buckets",
      moment_id_field_name: "moment_id",
    },
    duration_windows: promptWindows.map(redactPromptWindow),
  });
  writeFileSync(
    REPORT_PATH,
    [
      "# Backend Social Reels Matrix Contract Report",
      "",
      "- Fixture kind: backend-generated mock/golden",
      "- Live OpenAI call made: no",
      "- Response schema used: discovery_matrix",
      "- Canonical bucket field: buckets",
      "- Moment ID field: moment_id",
      `- Moments: ${responseFixture.moments.length}`,
      `- Buckets: ${responseFixture.buckets.length}`,
      `- Shared bucket moment represented: ${responseFixture.moments.some((moment) => moment.buckets.length > 1) ? "yes" : "no"}`,
      `- Ready examples: ${statusCounts.ready}`,
      `- Needs Review examples: ${statusCounts.needs_review}`,
      `- Rejected examples: ${statusCounts.rejected}`,
      `- Transcript source: ${input.utterances.length > 0 ? "utterances" : "segments"}`,
      `- Clean speaker labels: ${speakerLabels(input).join(", ")}`,
      `- Selected prompt windows: ${selectedWindows.length}`,
      `- Prompt context chars: ${promptContextCharCount}`,
      "",
      "## Notes",
      "- This fixture represents the backend canonical matrix response shape, not an app-only convenience shape.",
      "- Transcript/window text is redacted in prompt-window artifacts.",
      "- The macOS app owns export variants, captions, layout, word snapping, and final frame timing.",
      "",
    ].join("\n")
  );

  for (const path of [RESPONSE_FIXTURE_PATH, PROMPT_WINDOWS_PATH, REPORT_PATH]) {
    validatePrivacy(path);
  }

  console.log(JSON.stringify({
    ok: true,
    fixture_path: RESPONSE_FIXTURE_PATH.replace(`${process.cwd()}/`, ""),
    prompt_windows_path: PROMPT_WINDOWS_PATH.replace(`${process.cwd()}/`, ""),
    report_path: REPORT_PATH.replace(`${process.cwd()}/`, ""),
    fixture_kind: "backend_generated_mock_golden",
    response_schema: "discovery_matrix",
    moments: responseFixture.moments.length,
    buckets: responseFixture.buckets.length,
    shared_bucket_moment: responseFixture.moments.some((moment) => moment.buckets.length > 1),
    status_counts: statusCounts,
    live_openai_call_made: false,
  }, null, 2));
}

main();
