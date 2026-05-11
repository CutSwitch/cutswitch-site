import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { SOCIAL_REELS_EDITORIAL_SYSTEM_PROMPT, buildSocialReelsOpenAIPromptInput } from "../lib/socialReelsOpenAIPrompt";
import {
  buildSocialReelsLiveDurationWindows,
  buildSocialReelsLivePromptWindows,
  estimateSocialReelsPromptWindowCharCount,
  getSocialReelsLiveWindowCount,
  getSocialReelsWindowQualityRange,
  scoreSocialReelsDurationWindows,
  selectSocialReelsLiveDurationWindows,
  summarizeSocialReelsWindowQuality,
} from "../lib/socialReelsDurationWindows";
import { socialReelsRequestSchema, type SocialReelsRequest } from "../lib/socialReelsSchema";
import { getEffectiveLiveShortlistCandidateCount } from "../lib/socialReelsShortlist";

const ARTIFACT_DIR = resolve(process.cwd(), "artifacts/social-reels-v2-fixture-review/latest");
const REAL_FIXTURE_PATH = resolve(process.cwd(), "tests/fixtures/social_reels_transcript_v2_real_request.local.json");
const REDACTED_FIXTURE_PATH = resolve(process.cwd(), "tests/fixtures/social_reels_transcript_v2_outbound_request.redacted.json");
const LIVE_CALL_AUTHORIZED = false;
const TEXT_PLACEHOLDER = "{{CLEAN_UTTERANCE_TEXT}}";

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b));
}

function fixtureSummary(path: string, raw: unknown, parsed: SocialReelsRequest) {
  const record = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    fixture_path: path.replace(process.cwd() + "/", ""),
    top_level_utterances: parsed.utterances.length,
    segments: parsed.segments.length,
    segments_with_utterance_ids: parsed.segments.filter((segment) => segment.utterance_ids.length > 0).length,
    speaker_labels: uniqueStrings(parsed.utterances.map((utterance) => utterance.speaker_label)),
    raw_requested_candidate_count: typeof record.requested_candidate_count === "number" ? record.requested_candidate_count : null,
    backend_requested_candidate_count: parsed.requested_candidate_count,
    duration_preferences: parsed.duration_preferences,
    transcript_source: parsed.utterances.length > 0 ? "utterances" : "segments",
  };
}

function redactPromptWindow(window: Record<string, unknown>) {
  const utterances = Array.isArray(window.utterances)
    ? window.utterances.map((utterance) => {
        const record = utterance && typeof utterance === "object" ? (utterance as Record<string, unknown>) : {};
        return {
          utterance_id: record.utterance_id,
          speaker_label: record.speaker_label,
          start_seconds: record.start_seconds,
          end_seconds: record.end_seconds,
          start_timecode: record.start_timecode,
          end_timecode: record.end_timecode,
          text: TEXT_PLACEHOLDER,
        };
      })
    : [];

  return {
    window_id: window.window_id,
    segment_id: window.segment_id,
    transcript_source: window.transcript_source ?? "utterances",
    duration_bucket: window.duration_bucket,
    start_seconds: window.start_seconds,
    end_seconds: window.end_seconds,
    duration_seconds: window.duration_seconds,
    start_timecode: window.start_timecode ?? null,
    end_timecode: window.end_timecode ?? null,
    speakers: window.speakers ?? (window.speaker ? [window.speaker] : []),
    utterance_ids: window.utterance_ids ?? [],
    start_anchor_hint: "{{START_ANCHOR_HINT_FROM_TRANSCRIPT}}",
    end_anchor_hint: "{{END_ANCHOR_HINT_FROM_TRANSCRIPT}}",
    window_quality_score: window.window_quality_score,
    window_quality_reasons: window.window_quality_reasons,
    window_demotion_reasons: window.window_demotion_reasons,
    window_exclusion_reason: window.window_exclusion_reason,
    text_excerpt: TEXT_PLACEHOLDER,
    utterances,
  };
}

function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  mkdirSync(ARTIFACT_DIR, { recursive: true });

  const realRaw = readJson(REAL_FIXTURE_PATH);
  const redactedRaw = readJson(REDACTED_FIXTURE_PATH);
  const real = socialReelsRequestSchema.parse(realRaw);
  const redacted = socialReelsRequestSchema.parse(redactedRaw);
  const requestedCandidateCount = real.requested_candidate_count;
  const effectiveCandidateCount = getEffectiveLiveShortlistCandidateCount(requestedCandidateCount, "10");
  const liveInput: SocialReelsRequest = { ...real, requested_candidate_count: effectiveCandidateCount };
  const durationWindows = buildSocialReelsLiveDurationWindows(liveInput, effectiveCandidateCount);
  const scoredWindows = scoreSocialReelsDurationWindows(liveInput, durationWindows);
  const qualitySummary = summarizeSocialReelsWindowQuality(scoredWindows);
  const selectedWindows = selectSocialReelsLiveDurationWindows(scoredWindows, getSocialReelsLiveWindowCount("18"), liveInput);
  const promptWindows = buildSocialReelsLivePromptWindows(liveInput, selectedWindows);
  const promptInput = buildSocialReelsOpenAIPromptInput(liveInput, {
    discoveryMode: "live_shortlist",
    requestedCandidateCount,
    effectiveCandidateCount,
    durationWindows: promptWindows,
  });
  const promptContextChars = JSON.stringify(promptInput).length;
  const promptWindowShape = {
    generated_from: "tests/fixtures/social_reels_transcript_v2_real_request.local.json",
    transcript_source: real.utterances.length > 0 ? "utterances" : "segments",
    requested_candidate_count: requestedCandidateCount,
    effective_candidate_count: effectiveCandidateCount,
    duration_preferences: real.duration_preferences,
    eligible_duration_window_count: durationWindows.length,
    selected_duration_window_count: selectedWindows.length,
    prompt_window_count: promptWindows.length,
    prompt_context_char_count: promptContextChars,
    windows_after_quality_filter: qualitySummary.windows_after_quality_filter,
    selected_window_quality_range: getSocialReelsWindowQualityRange(selectedWindows),
    duration_windows: promptWindows.map((window) => redactPromptWindow(window as unknown as Record<string, unknown>)),
  };
  writeJson(resolve(ARTIFACT_DIR, "redacted_prompt_window_shape.json"), promptWindowShape);

  const utteranceRules = SOCIAL_REELS_EDITORIAL_SYSTEM_PROMPT
    .split(/(?<=\.)\s+/)
    .filter((line) => /utterance|speaker_label|segments\[\]|mid-word|mid-thought|source of truth/i.test(line));
  writeFileSync(
    resolve(ARTIFACT_DIR, "prompt_excerpt_redacted.md"),
    [
      "# Redacted Prompt Excerpt",
      "",
      "No OpenAI call was made. Transcript/window text is redacted.",
      "",
      "## System Prompt Rules",
      ...utteranceRules.map((line) => `- ${line}`),
      "",
      "## User Prompt Shape",
      "```json",
      JSON.stringify(
        {
          transcript_source: "utterances",
          source_utterance_count: real.utterances.length,
          source_segments_sent: "duration_windows_only",
          duration_windows: [redactPromptWindow(promptWindows[0] as unknown as Record<string, unknown>)],
          segments: [],
        },
        null,
        2
      ),
      "```",
      "",
    ].join("\n")
  );

  const candidateOutputPath = "candidate_output_unavailable.md";
  const candidateOutputKind = "unavailable";
  writeFileSync(
    resolve(ARTIFACT_DIR, "candidate_output_unavailable.md"),
    [
      "# Candidate Output Unavailable",
      "",
      "No live OpenAI discovery call was authorized in the user request, and this artifact pass intentionally avoids importing the server-only OpenAI service from a standalone script.",
      "",
      "To generate real candidates later, rerun with explicit one-call authorization and save only structured candidate fields without raw transcript text, anchors, tokens, or private paths.",
      "",
    ].join("\n")
  );

  const report = [
    "# Backend Social Reels Transcript v2 Fixture Acceptance Report",
    "",
    "## Summary",
    "- Backend accepted the real local app-generated transcript v2 fixture.",
    "- Backend accepted the redacted app-generated transcript v2 fixture.",
    "- Prompt/window rendering uses `utterances[]` as the source of truth when present.",
    "- Legacy `segments[]` remains available as a fallback/grouping hint only.",
    "- No live OpenAI call was made.",
    `- Candidate output artifact: \`${candidateOutputPath}\` (${candidateOutputKind}).`,
    "",
    "## Fixtures",
    "```json",
    JSON.stringify(
      {
        real: fixtureSummary("tests/fixtures/social_reels_transcript_v2_real_request.local.json", realRaw, real),
        redacted: fixtureSummary("tests/fixtures/social_reels_transcript_v2_outbound_request.redacted.json", redactedRaw, redacted),
      },
      null,
      2
    ),
    "```",
    "",
    "## Prompt Window Evidence",
    "```json",
    JSON.stringify(
      {
        transcript_source: promptWindowShape.transcript_source,
        eligible_duration_window_count: promptWindowShape.eligible_duration_window_count,
        selected_duration_window_count: promptWindowShape.selected_duration_window_count,
        prompt_context_char_count: promptWindowShape.prompt_context_char_count,
        windows_after_quality_filter: promptWindowShape.windows_after_quality_filter,
        selected_window_quality_range: promptWindowShape.selected_window_quality_range,
      },
      null,
      2
    ),
    "```",
    "",
    "## Privacy",
    "- No raw transcript text is included in `redacted_prompt_window_shape.json`.",
    "- No raw word-aligned JSON, cache files, API keys, tokens, or local media paths are included in generated artifacts.",
    "- Candidate output omits anchor quotes and captions to avoid transcript leakage.",
    "",
  ].join("\n");
  writeFileSync(resolve(ARTIFACT_DIR, "backend_final_report.md"), report);

  console.log(
    JSON.stringify(
      {
        artifact_dir: ARTIFACT_DIR.replace(process.cwd() + "/", ""),
        backend_final_report: "artifacts/social-reels-v2-fixture-review/latest/backend_final_report.md",
        redacted_prompt_window_shape: "artifacts/social-reels-v2-fixture-review/latest/redacted_prompt_window_shape.json",
        prompt_excerpt: "artifacts/social-reels-v2-fixture-review/latest/prompt_excerpt_redacted.md",
        candidate_output: `artifacts/social-reels-v2-fixture-review/latest/${candidateOutputPath}`,
        live_openai_call_made: false,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Failed to render Social Reels v2 fixture review artifacts.");
  process.exitCode = 1;
});
