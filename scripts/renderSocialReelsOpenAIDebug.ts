import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import {
  buildSocialReelsLiveDurationWindows,
  buildSocialReelsLivePromptWindows,
  getSocialReelsLiveWindowCount,
  getSocialReelsWindowQualityDistribution,
  getSocialReelsWindowQualityRange,
  getSocialReelsWindowReasonCounts,
  scoreSocialReelsDurationWindows,
  selectSocialReelsLiveDurationWindows,
  summarizeSocialReelsWindowQuality,
} from "../lib/socialReelsDurationWindows";
import { buildSocialReelsOpenAIPromptInput } from "../lib/socialReelsOpenAIPrompt";
import { socialReelsRequestSchema } from "../lib/socialReelsSchema";
import {
  getEffectiveLiveShortlistCandidateCount,
  openAISocialReelsShortlistResponseFormat,
} from "../lib/socialReelsShortlist";

const DEFAULT_MODEL = "gpt-5-mini";
const DEFAULT_MAX_OUTPUT_TOKENS = 6_000;
const MIN_MAX_OUTPUT_TOKENS = 512;
const MAX_MAX_OUTPUT_TOKENS = 16_000;

const INPUT_CANDIDATES = [
  process.env.SOCIAL_REELS_DEBUG_INPUT_PATH || "",
  "/Users/studiosage/Desktop/SocialReels_10_10_Evaluation_App_Latest/app_social_reels_request.json",
  "/Users/jamisonerwin/Desktop/SocialReels_10_10_Evaluation_App_Latest/app_social_reels_request.json",
  "/Users/studiosage/Desktop/SocialReels_10_10_Evaluation_App_v2/app_social_reels_request.json",
  "/Users/jamisonerwin/GitHub/cutswitch-site/tmp/social-reels-debug/app_social_reels_request_v2.json",
  "/Users/studiosage/Desktop/SocialReels_OpenAI_Debug_App/app_social_reels_request.json",
  "/Users/jamisonerwin/Desktop/SocialReels_OpenAI_Debug_App/app_social_reels_request.json",
  "/Users/jamisonerwin/GitHub/cutswitch-site/tmp/social-reels-debug/app_social_reels_request.json",
].filter(Boolean);

const OUTPUT_CANDIDATES = [
  process.env.SOCIAL_REELS_DEBUG_OUTPUT_DIR || "",
  "/Users/jamisonerwin/Desktop/SocialReels_10_10_Evaluation_Backend_v2",
  "/Users/jamisonerwin/GitHub/cutswitch-site/SocialReels_10_10_Evaluation_Backend_v2",
  "/Users/jamisonerwin/Desktop/SocialReels_OpenAI_Debug_Backend",
  "/Users/jamisonerwin/GitHub/cutswitch-site/SocialReels_OpenAI_Debug_Backend",
].filter(Boolean);

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

function firstExistingPath(paths: string[]) {
  return paths.find((path) => existsSync(path)) || null;
}

function ensureOutputDir() {
  for (const outputDir of OUTPUT_CANDIDATES) {
    try {
      mkdirSync(outputDir, { recursive: true });
      return outputDir;
    } catch {
      // Try the repo-local fallback.
    }
  }

  throw new Error("Unable to create debug output directory.");
}

function writeText(path: string, value: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
}

function writeJson(path: string, value: unknown) {
  writeText(path, `${JSON.stringify(value, null, 2)}\n`);
}

function getMode() {
  return process.env.SOCIAL_REELS_OPENAI_MODE?.trim().toLowerCase() === "live" ? "live" : "mock";
}

function getModel() {
  return process.env.SOCIAL_REELS_OPENAI_MODEL?.trim() || DEFAULT_MODEL;
}

function getReasoningEffort() {
  const effort = process.env.SOCIAL_REELS_OPENAI_REASONING_EFFORT?.trim().toLowerCase();
  return effort && effort !== "none" ? effort : null;
}

function getServiceTier() {
  const serviceTier = process.env.SOCIAL_REELS_OPENAI_SERVICE_TIER?.trim().toLowerCase();
  return !serviceTier || serviceTier === "none" || serviceTier === "standard" ? null : serviceTier;
}

function getMaxOutputTokens() {
  const raw = process.env.SOCIAL_REELS_OPENAI_MAX_OUTPUT_TOKENS?.trim();
  if (!raw) return DEFAULT_MAX_OUTPUT_TOKENS;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_OUTPUT_TOKENS;
  return Math.min(MAX_MAX_OUTPUT_TOKENS, Math.max(MIN_MAX_OUTPUT_TOKENS, Math.round(parsed)));
}

function approximateTotalTextChars(segments: Array<{ text: string }>) {
  return segments.reduce((sum, segment) => sum + segment.text.length, 0);
}

function segmentSpeakerMap(segments: Array<{ id?: string; segment_id?: string; speaker?: string | null }>) {
  return new Map(
    segments.map((segment) => [segment.id || segment.segment_id || "", typeof segment.speaker === "string" ? segment.speaker : null])
  );
}

const RAW_SPEAKER_LABEL = /\bSPEAKER[_\s-]*\d+\b/i;
const POLLUTED_PROJECT_EPISODE_SUFFIX =
  /\s(?:[-–—|]|::)\s.*(?:project|episode|social\s*reels|evaluation|packet|debug|\.fcpxml|\.xml)\b/i;

function uniqueSpeakerLabels(segments: Array<{ speaker?: string | null }>) {
  return [
    ...new Set(
      segments
        .map((segment) => (typeof segment.speaker === "string" ? segment.speaker.replace(/\s+/g, " ").trim() : ""))
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b));
}

function hasRawSpeakerLabels(labels: string[], userPrompt: string) {
  return labels.some((label) => RAW_SPEAKER_LABEL.test(label)) || RAW_SPEAKER_LABEL.test(userPrompt);
}

function hasPollutedProjectEpisodeSuffix(labels: string[]) {
  return labels.some((label) => POLLUTED_PROJECT_EPISODE_SUFFIX.test(label));
}

function safeWindowForJson(window: {
  window_id: string;
  segment_id: string;
  duration_bucket: string;
  start_seconds: number;
  end_seconds: number;
  duration_seconds: number;
  start_anchor_hint: string;
  end_anchor_hint: string;
  window_quality_score?: number;
  window_quality_reasons?: string[];
  window_demotion_reasons?: string[];
  window_exclusion_reason?: string | null;
  text_excerpt?: string;
}, speakersBySegmentId: Map<string, string | null>) {
  return {
    window_id: window.window_id,
    segment_id: window.segment_id,
    speaker: speakersBySegmentId.get(window.segment_id) ?? null,
    duration_bucket: window.duration_bucket,
    start_seconds: window.start_seconds,
    end_seconds: window.end_seconds,
    duration_seconds: window.duration_seconds,
    window_quality_score: window.window_quality_score ?? null,
    window_quality_reasons: window.window_quality_reasons ?? [],
    window_demotion_reasons: window.window_demotion_reasons ?? [],
    window_exclusion_reason: window.window_exclusion_reason ?? null,
    start_anchor_hint: window.start_anchor_hint,
    end_anchor_hint: window.end_anchor_hint,
    text_excerpt: window.text_excerpt ?? null,
  };
}

function markdownTable(rows: Array<[string, string | number | null]>) {
  return [
    "| Field | Value |",
    "|---|---|",
    ...rows.map(([field, value]) => `| \`${field}\` | ${value === null ? "`null`" : String(value)} |`),
  ].join("\n");
}

loadDotEnvLocal();

const inputPath = firstExistingPath(INPUT_CANDIDATES);
if (!inputPath) {
  console.error(
    "No app Social Reels request JSON was found. Copy it to /Users/jamisonerwin/GitHub/cutswitch-site/tmp/social-reels-debug/app_social_reels_request.json and rerun this script."
  );
  process.exit(1);
}

const rawPayload = JSON.parse(readFileSync(inputPath, "utf8")) as unknown;
const parsed = socialReelsRequestSchema.safeParse(rawPayload);
if (!parsed.success) {
  console.error(
    "Invalid app Social Reels request JSON:",
    JSON.stringify(
      parsed.error.issues.map((issue) => ({ path: issue.path.map(String).join("."), code: issue.code })),
      null,
      2
    )
  );
  process.exit(1);
}

const request = parsed.data;
const requestedCandidateCount = request.requested_candidate_count;
const effectiveCandidateCount = getEffectiveLiveShortlistCandidateCount(
  requestedCandidateCount,
  process.env.SOCIAL_REELS_LIVE_CANDIDATE_COUNT
);
const liveWindowCount = getSocialReelsLiveWindowCount(process.env.SOCIAL_REELS_LIVE_WINDOW_COUNT);
const liveShortlistInput = {
  ...request,
  requested_candidate_count: effectiveCandidateCount,
};
const eligibleDurationWindows = buildSocialReelsLiveDurationWindows(liveShortlistInput, effectiveCandidateCount);
const scoredDurationWindows = scoreSocialReelsDurationWindows(liveShortlistInput, eligibleDurationWindows);
const windowQualitySummary = summarizeSocialReelsWindowQuality(scoredDurationWindows);
const selectedDurationWindows = selectSocialReelsLiveDurationWindows(scoredDurationWindows, liveWindowCount);
const selectedWindowQualityRange = getSocialReelsWindowQualityRange(selectedDurationWindows);
const selectedWindowQualityDistribution = getSocialReelsWindowQualityDistribution(selectedDurationWindows);
const selectedWindowReasonCounts = getSocialReelsWindowReasonCounts(selectedDurationWindows);
const promptDurationWindows = buildSocialReelsLivePromptWindows(liveShortlistInput, selectedDurationWindows);
const promptInput = buildSocialReelsOpenAIPromptInput(liveShortlistInput, {
  discoveryMode: "live_shortlist",
  requestedCandidateCount,
  effectiveCandidateCount,
  durationWindows: promptDurationWindows,
});
const promptContextCharCount = JSON.stringify(promptInput).length;
const userPromptContent = String(promptInput[1].content);
const responseSchema = openAISocialReelsShortlistResponseFormat(effectiveCandidateCount);
const outputDir = ensureOutputDir();
const mode = getMode();
const model = getModel();
const reasoningEffort = getReasoningEffort();
const serviceTier = getServiceTier();
const maxOutputTokens = getMaxOutputTokens();
const durationPreferences = request.duration_preferences;
const segmentCount = request.segments.length;
const approximateChars = approximateTotalTextChars(request.segments);
const speakersBySegmentId = segmentSpeakerMap(request.segments);
const speakers = uniqueSpeakerLabels(request.segments);
const rawSpeakerLabelsRemain = hasRawSpeakerLabels(speakers, userPromptContent);
const pollutedSuffixRemain = hasPollutedProjectEpisodeSuffix(speakers);
const summaryRows: Array<[string, string | number | null]> = [
  ["input_app_request_path", inputPath],
  ["mode_that_would_be_used_from_env", mode],
  ["rendered_discovery_mode", "live_shortlist"],
  ["model", model],
  ["reasoning_effort", reasoningEffort ?? "omitted"],
  ["service_tier", serviceTier ?? "standard/omitted"],
  ["max_output_tokens", maxOutputTokens],
  ["requested_candidate_count", requestedCandidateCount],
  ["effective_candidate_count", effectiveCandidateCount],
  ["duration_preferences", durationPreferences.join(", ")],
  ["style", request.style],
  ["layout", request.layout],
  ["caption_style", request.caption_style],
  ["segment_count", segmentCount],
  ["approximate_total_text_chars", approximateChars],
  ["eligible_duration_window_count", eligibleDurationWindows.length],
  ["windows_after_quality_filter", windowQualitySummary.windows_after_quality_filter],
  ["excluded_window_reason_counts", JSON.stringify(windowQualitySummary.excluded_window_reason_counts)],
  ["demoted_window_reason_counts", JSON.stringify(windowQualitySummary.demoted_window_reason_counts)],
  ["average_window_quality_score", windowQualitySummary.average_window_quality_score],
  ["selected_window_quality_range", JSON.stringify(selectedWindowQualityRange)],
  ["selected_window_quality_distribution", JSON.stringify(selectedWindowQualityDistribution)],
  ["selected_window_reason_counts", JSON.stringify(selectedWindowReasonCounts)],
  ["duration_window_count_sent_to_model", promptDurationWindows.length],
  ["prompt_context_char_count_sent_to_model", promptContextCharCount],
  ["selected_live_window_count", liveWindowCount],
  ["unique_speaker_labels_detected", speakers.length > 0 ? speakers.join(", ") : "none"],
  ["raw_SPEAKER_labels_remain", rawSpeakerLabelsRemain ? "yes" : "no"],
  ["polluted_project_episode_suffix_remains", pollutedSuffixRemain ? "yes" : "no"],
  ["returned_response_schema_mode", "reduced live shortlist"],
  ["openai_call_made", "no"],
];

writeText(
  join(outputDir, "01_backend_request_summary.md"),
  [
    "# Backend Social Reels OpenAI Request Summary",
    "",
    "> No OpenAI call was made. This is a local render of the live-shortlist prompt package.",
    "",
    mode === "live"
      ? "Current environment mode is `live`, so this reflects the live OpenAI materials the backend would prepare."
      : "Current environment mode is `mock`, so production would not call OpenAI unless `SOCIAL_REELS_OPENAI_MODE=live`; this package still renders the live-shortlist OpenAI materials for inspection.",
    "",
    markdownTable(summaryRows),
    "",
  ].join("\n")
);

writeJson(
  join(outputDir, "02_duration_windows.json"),
  promptDurationWindows.map((window) => safeWindowForJson(window, speakersBySegmentId))
);

writeText(join(outputDir, "03_openai_prompt_system.txt"), `${promptInput[0].content}\n`);
writeText(join(outputDir, "04_openai_prompt_user.txt"), `${promptInput[1].content}\n`);
writeJson(join(outputDir, "05_openai_response_schema.json"), responseSchema);
writeText(
  join(outputDir, "06_chatgpt_visual_review_prompt.md"),
  [
    "# ChatGPT Visual Review Prompt",
    "",
    "You are reviewing a CutSwitch Social Reels backend OpenAI prompt package for editorial quality and schema fit.",
    "",
    "Use the accompanying files:",
    "",
    "- `01_backend_request_summary.md` for safe metadata",
    "- `02_duration_windows.json` for selected candidate windows and boundary hints",
    "- `03_openai_prompt_system.txt` for the exact system prompt",
    "- `04_openai_prompt_user.txt` for the exact user prompt body sent to OpenAI",
    "- `05_openai_response_schema.json` for the Structured Outputs schema",
    "",
    "Please analyze whether the prompt is likely to produce high-quality social reel candidates.",
    "",
    "Return:",
    "",
    "1. The 5 strongest likely reel windows by `window_id`, with why each has hook/tension/payoff potential.",
    "2. Any windows that look like weak setup, context-dependent, or missing-payoff moments.",
    "3. Whether the prompt gives enough guidance for 60s duration honesty.",
    "4. Whether the response schema is too strict, too loose, or missing useful editorial fields.",
    "5. Suggested prompt changes, if any, without changing app timing ownership.",
    "",
    "Privacy rules: do not quote large transcript passages. Short anchor excerpts are okay only when needed. Do not infer identities or expose private data.",
    "",
  ].join("\n")
);

writeText(
  join(outputDir, "README.md"),
  [
    "# Social Reels OpenAI Debug Backend Package",
    "",
    "This folder was generated locally for human inspection.",
    "",
    "- No OpenAI call was made.",
    "- No API key, bearer token, auth header, or secret is included.",
    "- The prompt files may include private transcript/window text because they represent what the model would see.",
    "- Do not commit or share this folder publicly.",
    "- The macOS app owns exact word-aligned timing and frame snapping.",
    "- OpenAI rough timing is only a hint; CutSwitch validates timing locally.",
    "",
    "Files:",
    "",
    "- `01_backend_request_summary.md`: safe request/config summary.",
    "- `02_duration_windows.json`: selected duration windows without full text excerpts.",
    "- `03_openai_prompt_system.txt`: exact system prompt.",
    "- `04_openai_prompt_user.txt`: exact user prompt body, including model-visible window excerpts.",
    "- `05_openai_response_schema.json`: Structured Outputs response schema.",
    "- `06_chatgpt_visual_review_prompt.md`: ready-to-paste review instructions.",
    "",
    `Source input path used locally: \`${inputPath}\``,
    "",
  ].join("\n")
);

console.log(
  JSON.stringify(
    {
      output_dir: outputDir,
      source_input_found: true,
      mode_that_would_be_used_from_env: mode,
      model,
      reasoning_effort: reasoningEffort ?? "omitted",
      max_output_tokens: maxOutputTokens,
      requested_candidate_count: requestedCandidateCount,
      effective_candidate_count: effectiveCandidateCount,
      duration_preferences: durationPreferences,
      segment_count: segmentCount,
      approximate_total_text_chars: approximateChars,
      eligible_duration_window_count: eligibleDurationWindows.length,
      windows_after_quality_filter: windowQualitySummary.windows_after_quality_filter,
      excluded_window_reason_counts: windowQualitySummary.excluded_window_reason_counts,
      demoted_window_reason_counts: windowQualitySummary.demoted_window_reason_counts,
      average_window_quality_score: windowQualitySummary.average_window_quality_score,
      selected_window_quality_range: selectedWindowQualityRange,
      selected_window_quality_distribution: selectedWindowQualityDistribution,
      selected_window_reason_counts: selectedWindowReasonCounts,
      duration_window_count_sent_to_model: promptDurationWindows.length,
      prompt_context_char_count_sent_to_model: promptContextCharCount,
      selected_live_window_count: liveWindowCount,
      unique_speaker_label_count: speakers.length,
      raw_speaker_labels_remain: rawSpeakerLabelsRemain,
      polluted_project_episode_suffix_remains: pollutedSuffixRemain,
      files_written: [
        "01_backend_request_summary.md",
        "02_duration_windows.json",
        "03_openai_prompt_system.txt",
        "04_openai_prompt_user.txt",
        "05_openai_response_schema.json",
        "06_chatgpt_visual_review_prompt.md",
        "README.md",
      ],
      openai_call_made: false,
      secrets_included: false,
    },
    null,
    2
  )
);
