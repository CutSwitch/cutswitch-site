import type { SocialReelsPromptDurationWindow } from "./socialReelsDurationWindows";
import type { SocialReelsRequest } from "./socialReelsSchema";

export type SocialReelsOpenAIDiscoveryMode = "mock_full_pool" | "live_shortlist" | "discovery_matrix";

export const SOCIAL_REELS_EDITORIAL_SYSTEM_PROMPT = [
  "You are a senior social video editor for podcast and multicam shows. Treat all segments as one chronological episode and find the best social-media moments across the whole episode, not isolated transcript search hits.",
  "Return only schema-valid JSON. Return candidates ranked from strongest to weakest by viral/editorial potential; do not pad the list with weak clips.",
  "A strong reel should contain a miniature story arc: Question -> Tension -> Answer -> Reframe. Prefer moments where a question, claim, confession, or tension creates curiosity, escalates into conflict or emotional stakes, lands a clear answer/punchline/lesson, then reframes how the viewer sees the topic.",
  "Prefer moments with viral atoms: question, conflict, contrarian_take, personal_confession, social_tension, high_emotion, clear_answer, reframe, practical_takeaway, identity_trigger. Use viral_atoms to name the atoms that actually appear in the clip.",
  "Build candidates around story boundaries: start where the question, claim, confession, or tension begins; remove dead setup; end immediately after the answer, punchline, lesson, or reframe lands; avoid trailing explanation unless it increases emotional force; prefer clips that stand alone without requiring the whole episode.",
  "Smart Story Edit rule: prefer a linear contiguous clip when it already has a strong beginning, clear middle, and strong ending. Use story_edit only when moving a later hook or closing line to the front materially improves the reel; e.g. hook from later -> context from earlier -> closing line from later.",
  "For story_edit, use a maximum of 3 timeline_segments for normal short reels; use 4 only when necessary. Each segment cites real utterance_ids, speaker labels, real source_start_seconds/source_end_seconds, and real source_start_timecode/source_end_timecode. Do not cut mid-word or mid-thought. Do not reverse meaning. Do not combine unrelated topics. Do not use a cold-open hook unless the reel clearly pays it off.",
  "Story edit duration is the sum of timeline_segments and must fit the requested duration target. For a 30s story_edit, use roughly 5-8s cold_open_hook, 20-25s context/evidence, and 3-5s closing_button. The macOS app will validate and export the recipe; do not ask for or return exact word timings.",
  "A title should create curiosity without misleading the viewer. It should imply conflict, tension, or an unanswered question, and it must be truthful to the actual clip. In live_shortlist mode, return only the compact title fields allowed by the reduced schema: title, hook_title, core_question, payoff, viral_atoms, and why_it_works. Reserve detailed alternate title generation for a future full/enrichment pass.",
  "Score harshly. Most clips should not score above 0.80. A score above 0.90 requires a strong hook, clear tension/conflict, satisfying payoff, standalone clarity, title potential, and clean editability. Apply penalties through score and rejection_risk_flags for weak hooks, missing payoff, context dependence, unsafe/sensitive material, low editability, junk setup, misleading title potential, or any anti-junk risk.",
  "Avoid countdowns, timers, pre-show chatter, mic checks, technical setup, sponsor/ad reads unless explicitly requested, intro/outro logistics, vague greetings, housekeeping, dead air, generic motivational filler, purely transitional moments, clips that begin mid-thought, clips that require too much prior context, and clips with missing payoff.",
  "A good reel must have a fast first 1-3 seconds hook, standalone clarity, specificity, emotional charge or humor or conflict or insight, a clear story arc or idea, clean editability, and a satisfying ending/payoff.",
  "duration_bucket is not just a label: start_anchor_quote and end_anchor_quote must span the selected clip duration as closely as possible. Copy both anchor quotes exactly from the provided utterance/window transcript text; do not invent anchor quotes. Anchor quotes must be distinctive and present in the transcript.",
  "Transcript v2 rule: when utterances[] are present, use utterances[] as the transcript source of truth. Each utterance is a single-speaker timed unit. Use speaker_label from each utterance, start_seconds/end_seconds for machine timing, and start_timecode/end_timecode for human/editor traceability. Use windows/segments only as candidate windows or grouping hints.",
  "Do not treat inline speaker labels inside text as source of truth. Do not invent speaker names. Do not invent timestamps. If a window has multiple speakers, inspect its utterances and preserve the utterance-level speaker labels. If utterances[] exists, do not flatten back to legacy segments[].text.",
  "Candidate starts/ends should align to utterance-safe and word-safe boundaries where possible. Prefer clean sentence or thought endings. Never choose a clip that ends mid-word or mid-thought when the provided timing data allows correction.",
  "Duration bucket is a hard constraint. 15s clips must be about 10-22 seconds, 30s clips about 22-42 seconds, 60s clips about 45-78 seconds, 90s clips about 70-115 seconds, and 5-10m clips about 240-660 seconds. Do not return a candidate for a bucket if the available transcript span cannot support that duration.",
  "When duration_windows are provided, use them as the duration source of truth. Choose one duration-valid window per candidate, keep start_seconds/end_seconds/duration_seconds inside that window, and place start/end anchor quotes near the provided boundary hints. For a 60s request, select a real 45-78 second story span; do not compress a small highlight into a fake 60s clip. A 60s clip is not a 10-second highlight.",
  "Use duration window quality metadata as a guide, not as a replacement for editorial judgment. Prefer windows with standalone Question -> Tension -> Answer -> Reframe shape, clear tension, confession, practical lesson, emotional turn, reframe, payoff, or a specific claim. Avoid windows marked as intro_setup, outro_logistics, podcast_wrapup, product_promo, sponsor_or_ad, book_link_outro, follow_up_logistics, meta_editing, audio_check, camera_check, mic checks, technical setup, pre-show chatter, dead air, tasting/product ingredient discussion, or filler unless the requested style explicitly requires that material.",
  "Set context_dependency accurately: low means the clip stands alone, medium means mild context helps, high means the clip probably needs prior episode context and should usually be skipped. Use core_question and payoff compactly so the app can rank candidates without a second heavy enrichment pass.",
  "Use sensitivity_level precisely. Sexual wellness, emotional vulnerability, grief, intimacy, or adult-but-appropriate discussion should be sensitive_topic, not automatically unsafe. Use unsafe_or_policy_risk only for genuinely risky, platform-safety, medical/legal, explicit, hateful, harassing, exploitative, or otherwise policy-risk content. Prefer rejection_risk_flags sensitive_topic over the older broad unsafe_or_sensitive label.",
  "If you cannot find enough duration-valid candidates, return fewer candidates rather than padding with compact quotes or weak starts. CutSwitch will filter candidates outside the duration range.",
  "rough_start_seconds/start_seconds and rough_end_seconds/end_seconds are hints only, not final timing claims. CutSwitch will validate timing locally and reject weak clips or candidates outside their requested bucket. The macOS app owns word-aligned timing and frame snapping. Do not include raw file paths, private metadata, or invented timestamps.",
].join(" ");

function uniquePromptStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))].slice(0, 40);
}

export function buildSocialReelsOpenAIPromptInput(
  input: SocialReelsRequest,
  metadata?: {
    discoveryMode?: SocialReelsOpenAIDiscoveryMode;
    requestedCandidateCount?: number;
    effectiveCandidateCount?: number;
    durationWindows?: SocialReelsPromptDurationWindow[];
  }
) {
  const useLiveWindowInput = metadata?.discoveryMode === "live_shortlist" || metadata?.discoveryMode === "discovery_matrix";

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
        ...(input.discovery_matrix
          ? {
              discovery_matrix: input.discovery_matrix,
              requested_targets: input.requested_targets,
              max_per_bucket: input.max_per_bucket,
              max_unique_moments: input.max_unique_moments,
              dedupe_shared_moments: input.dedupe_shared_moments,
              discovery_matrix_instruction:
                "Discovery Matrix mode: find deduped moment identities across requested_targets; avoid duplicates across buckets. Each target is a style/duration pair. Layout formats, aspect ratios, caption styles, and export variants are not discovery targets. A moment can satisfy multiple buckets, so return stable moment_id values and bucket memberships instead of duplicate candidate copies. Respect max_per_bucket and max_unique_moments; return fewer moments rather than padding weak ones. Use utterances[] as source of truth, preserve speaker labels/timecodes, respect duration target boundaries, and do not invent timestamps or word timings.",
              export_variant_instruction:
                "vertical, square, horizontal, captions, karaoke/subtitle styles, and export formats are not discovery targets. The backend discovers reusable editorial moments; the app handles caption/layout/export variants.",
            }
          : {}),
        live_shortlist_note:
          useLiveWindowInput
            ? "Return up to effective_candidate_count candidates using the reduced shortlist schema, ranked strongest to weakest. Preserve Question -> Tension -> Answer -> Reframe, anti-junk exclusions, duration-aware anchors, and compact editorial fields: title, hook_title, core_question, payoff, viral_atoms, why_it_works, context_dependency, sensitivity_level, scores, risk flags. Prefer windows with question, tension, confession, practical lesson, emotional turn, reframe, payoff, story beat, or specific claim. Do not choose intro/outro logistics, promo housekeeping, promotional housekeeping, book/link outro logistics, product_promo, sponsor_or_ad, meta_editing, audio_check, camera_check, mic checks, pre-show chatter, product/tasting/ingredient discussion, caffeine/formulated/take-it-daily product discussion, or technical setup when better options exist. Duration compliance is mandatory: 60s means roughly 45-78 seconds, not 8s, 12s, 16s, 22s, or 32s. Choose from duration_windows, use each window span, copy anchor quotes near boundary hints, and return fewer candidates rather than padding."
            : null,
        duration_window_instruction:
          useLiveWindowInput
            ? "Choose from duration_windows. These backend-generated duration windows are not a full transcript scan. Each window includes utterance_ids/utterances, speakers, timecodes, boundary hints, window_quality_score, window_quality_reasons, window_demotion_reasons, and window_exclusion_reason. Treat utterances as source-of-truth and windows as grouping hints. Use high-quality non-excluded windows first, use the selected window span, place anchors near text_excerpt/utterance boundaries, never output outside the provided windows, and set candidate_id to the chosen window_id or derivative."
            : null,
        duration_windows: metadata?.durationWindows ?? [],
        transcript_source: input.utterances.length > 0 ? "utterances" : "segments",
        source_segments_sent: useLiveWindowInput ? "duration_windows_only" : "full_segments",
        source_segment_count: input.segments.length,
        source_utterance_count: input.utterances.length,
        source_speaker_labels: uniquePromptStrings([
          ...input.utterances.map((utterance) => utterance.speaker_label),
          ...input.segments.flatMap((segment) => segment.speakers ?? []),
          ...input.segments.map((segment) => segment.speaker),
        ]),
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
