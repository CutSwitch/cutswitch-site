import type { SocialReelsPromptDurationWindow } from "./socialReelsDurationWindows";
import type { SocialReelsRequest } from "./socialReelsSchema";

export type SocialReelsOpenAIDiscoveryMode = "mock_full_pool" | "live_shortlist";

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
  "Use duration window quality metadata as a guide, not as a replacement for editorial judgment. Prefer windows with standalone Question -> Tension -> Answer -> Reframe shape, clear tension, confession, practical lesson, emotional turn, reframe, or payoff. Avoid windows marked as intro/outro logistics, promotional housekeeping, sponsor/ad, book/link outro logistics, mic checks, technical setup, pre-show chatter, dead air, or filler unless the requested style explicitly requires that material.",
  "Set context_dependency accurately: low means the clip stands alone, medium means mild context helps, high means the clip probably needs prior episode context and should usually be skipped. Use core_question and payoff compactly so the app can rank candidates without a second heavy enrichment pass.",
  "Use sensitivity_level precisely. Sexual wellness, emotional vulnerability, grief, intimacy, or adult-but-appropriate discussion should be sensitive_topic, not automatically unsafe. Use unsafe_or_policy_risk only for genuinely risky, platform-safety, medical/legal, explicit, hateful, harassing, exploitative, or otherwise policy-risk content. Prefer rejection_risk_flags sensitive_topic over the older broad unsafe_or_sensitive label.",
  "If you cannot find enough duration-valid candidates, return fewer candidates rather than padding with compact quotes or weak starts. CutSwitch will filter candidates outside the duration range.",
  "rough_start_seconds/start_seconds and rough_end_seconds/end_seconds are hints only, not final timing claims. CutSwitch will validate timing locally and reject weak clips or candidates outside their requested bucket. The macOS app owns word-aligned timing and frame snapping. Do not include raw file paths, private metadata, or invented timestamps.",
].join(" ");

export function buildSocialReelsOpenAIPromptInput(
  input: SocialReelsRequest,
  metadata?: {
    discoveryMode?: SocialReelsOpenAIDiscoveryMode;
    requestedCandidateCount?: number;
    effectiveCandidateCount?: number;
    durationWindows?: SocialReelsPromptDurationWindow[];
  }
) {
  const useLiveWindowInput = metadata?.discoveryMode === "live_shortlist";

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
          useLiveWindowInput
            ? "Return up to effective_candidate_count candidates using the reduced shortlist schema. Preserve the Viral Reel Method: Question -> Tension -> Answer -> Reframe, anti-junk exclusions, duration-aware anchors, and ranked strongest-to-weakest choices. Prefer high-quality windows with question, tension, confession, practical lesson, emotional turn, reframe, payoff, or story beat signals. Do not choose intro/outro logistics, promo housekeeping, book/link outro logistics, mic checks, pre-show chatter, or technical setup windows when better options exist. Duration bucket compliance is mandatory: for a 60s request, each candidate must span roughly 45-78 seconds of spoken content; never return 8s, 12s, 16s, 22s, or 32s clips as 60s candidates. A 60s clip is not a 10-second highlight. Choose from duration_windows when present. Use each window's start/end/duration as the clip span, then copy distinctive transcript anchor quotes near that window's boundary hints. If there are fewer duration-valid candidates than requested, return fewer candidates rather than padding."
            : null,
        duration_window_instruction:
          useLiveWindowInput
            ? "Choose only from provided duration_windows. These are backend-generated duration windows, not a full transcript scan. Do not scan or invent from a full transcript blob. Each duration_window contains a bounded transcript excerpt, speaker metadata when available, start/end boundary hints, window_quality_score, window_quality_reasons, and window_exclusion_reason. Use high-quality non-excluded windows first. Use the selected window start/end as the intended clip span, choose start_anchor_quote near the beginning of text_excerpt, choose end_anchor_quote near the end of text_excerpt, and do not output candidates from outside the provided windows. Set candidate_id to the chosen window_id or a stable derivative."
            : null,
        duration_windows: metadata?.durationWindows ?? [],
        source_segments_sent: useLiveWindowInput ? "duration_windows_only" : "full_segments",
        source_segment_count: input.segments.length,
        custom_duration_seconds: input.custom_duration_seconds || null,
        style: input.style,
        layout: input.layout,
        caption_style: input.caption_style,
        episode_metadata: input.episode_metadata,
        context: input.context,
        segments: useLiveWindowInput ? [] : input.segments,
      }),
    },
  ];
}
