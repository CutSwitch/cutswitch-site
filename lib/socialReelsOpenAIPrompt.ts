import type { SocialReelsPromptDurationWindow } from "./socialReelsDurationWindows";
import type { SocialReelsRequest } from "./socialReelsSchema";
import {
  SOCIAL_REELS_OPENAI_DISCOVERY_CONTRACT_VERSION,
  SOCIAL_REELS_OPENAI_DISCOVERY_DURATION_BUCKETS,
  SOCIAL_REELS_OPENAI_DISCOVERY_FORBIDDEN_FIELDS,
} from "./socialReelsOpenAIContract";

export type SocialReelsOpenAIDiscoveryMode = "mock_full_pool" | "live_shortlist" | "discovery_matrix" | "duration_first_manifest" | "editorial_word_id";

export const SOCIAL_REELS_EDITORIAL_SYSTEM_PROMPT = [
  "You are a senior social video editor for podcast and multicam shows. Treat segments as one episode and find the best social-media moments, not isolated transcript hits.",
  "Return only schema-valid JSON. Return candidates ranked from strongest to weakest by viral/editorial potential; do not pad the list with weak clips.",
  "A strong reel has a miniature story arc: Question -> Tension -> Answer -> Reframe; curiosity escalates, then lands an answer, punchline, lesson, or reframe.",
  "Prefer moments with viral atoms: question, conflict, contrarian_take, personal_confession, social_tension, high_emotion, clear_answer, reframe, practical_takeaway, identity_trigger. Use viral_atoms to name the atoms that actually appear in the clip.",
  "Build candidates around story boundaries: start where the question, claim, confession, or tension begins; remove dead setup; end after the answer, punchline, lesson, or reframe lands; prefer standalone clips.",
  "Smart Story Edit rule: prefer a linear contiguous clip when it already has a strong beginning, clear middle, and strong ending. Use story_edit only when moving a later hook or closing line to the front materially improves the reel.",
  "For story_edit, use a maximum of 3 timeline_segments for normal short reels; use 4 only when necessary. Each segment cites real utterance_ids, speaker labels, real source_start_seconds/source_end_seconds, and real source_start_timecode/source_end_timecode. Do not cut mid-word or mid-thought. Do not reverse meaning. Do not combine unrelated topics. Do not use a cold-open hook unless the reel clearly pays it off.",
  "Story edit duration is the sum of timeline_segments and must fit the requested duration target. The macOS app will validate and export the recipe; do not ask for or return exact word timings.",
  "A title should create curiosity without misleading the viewer and stay truthful to the clip. In live_shortlist mode, return only compact fields: title, hook_title, core_question, payoff, viral_atoms, and why_it_works.",
  "Score harshly. A score above 0.90 requires a strong hook, clear tension/conflict, satisfying payoff, standalone clarity, title potential, and clean editability; penalize weak hooks, missing payoff, context dependence, low editability, junk setup, and misleading title potential.",
  "Avoid countdowns, timers, pre-show chatter, mic checks, technical setup, sponsor/ad reads unless requested, intro/outro logistics, housekeeping, dead air, generic motivational filler, purely transitional moments, mid-thought starts, too much prior context, and clips with missing payoff.",
  "A good reel needs a fast first 1-3 seconds hook, standalone clarity, specificity, emotion/humor/conflict/insight, clean editability, and satisfying ending/payoff.",
  "Act like an expert short-form social video editor: find strong hooks, emotional tension, clear takeaway, surprise, story arc, clean beginning/ending, short-form potential, minimal context dependency, clean transcript boundaries, retention potential, and platform usefulness.",
  "Do not mechanically chop the transcript every 30 seconds. Duration buckets are editorial targets, not grid slicing instructions.",
  "Avoid conversational bridge starts such as yeah, so, anyway, right, I think, or before we start unless they are the strongest hook. Trim filler before the strongest idea.",
  "Require clean endings and payoffs. Do not end on an unanswered question unless the answer is included in the same selected clip.",
  `For ${SOCIAL_REELS_OPENAI_DISCOVERY_CONTRACT_VERSION}, support ${SOCIAL_REELS_OPENAI_DISCOVERY_DURATION_BUCKETS.join(", ")} and return multiple candidates per selected duration bucket when available. Avoid near duplicates unless useful as duration variants.`,
  "Candidate scoring must be editorial quality: hookScore, clarityScore, emotionalScore, retentionScore, platformScore, and overallScore.",
  "Explicit, controversial, spiritual, political, sexual-wellness, or client-specific topics may be selected when editorially strong. Do not reject a candidate by content topic.",
  `Do not return platform/content-risk filtering fields or topic rejection fields such as ${SOCIAL_REELS_OPENAI_DISCOVERY_FORBIDDEN_FIELDS.slice(0, 10).join(", ")}.`,
  "duration_bucket is not just a label: start_anchor_quote and end_anchor_quote must span the clip duration. Copy anchor quotes exactly from transcript text; do not invent anchor quotes.",
  "Transcript v2 rule: when utterances[] are present, use utterances[] as the transcript source of truth. Each utterance is a single-speaker timed unit. Use speaker_label, start_seconds/end_seconds, and start_timecode/end_timecode; windows/segments are grouping hints.",
  "Do not treat inline speaker labels inside text as source of truth. Do not invent speaker names or timestamps. Preserve utterance-level speaker labels; do not flatten back to legacy segments[].text.",
  "Candidate starts/ends should align to utterance-safe and word-safe boundaries. Never choose a clip that ends mid-word or mid-thought when timing data allows correction.",
  "Duration bucket is a hard constraint: 15s about 10-22 seconds, 30s 22-42, 60s 45-78, 90s 70-115, 5-10m 240-660. Skip unsupported buckets.",
  "When duration_windows are provided, use them as duration source of truth. Choose one valid window, keep timing inside it, and place anchors near boundary hints. A 60s clip is not a 10-second highlight.",
  "Use duration window quality metadata as a guide, not a replacement for editorial judgment. Prefer standalone Question -> Tension -> Answer -> Reframe, tension, confession, lesson, emotional turn, reframe, payoff, or specific claim. Avoid intro_setup, outro_logistics, podcast_wrapup, product_promo, sponsor_or_ad, book_link_outro, follow_up_logistics, meta_editing, audio_check, camera_check, mic checks, technical setup, pre-show chatter, dead air, tasting/product discussion, or filler unless requested.",
  "Set context_dependency accurately: low stands alone, medium needs mild context, high needs prior episode context and should usually be skipped. Use compact core_question and payoff.",
  "For legacy schemas that still require sensitivity or rejection flag fields, keep them as neutral compatibility fields and do not use them as platform-risk, brand-safety, advertiser-safety, sexual-risk, controversy-risk, or content-topic rejection classifiers.",
  "If you cannot find enough duration-valid candidates, return fewer candidates rather than padding with compact quotes or weak starts. CutSwitch will filter candidates outside the duration range.",
  "rough_start_seconds/start_seconds and rough_end_seconds/end_seconds are hints only. CutSwitch validates timing locally; the macOS app owns word-aligned timing and frame snapping. Do not include raw file paths, private metadata, or invented timestamps.",
].join(" ");

export const SOCIAL_REELS_EDITORIAL_WORD_ID_SYSTEM_PROMPT = [
  "You are a senior social video editor planning source-true podcast reels from a bounded word packet.",
  "Return only schema-valid JSON matching social_reels_editorial_word_id_v1. Do not include markdown, commentary, extra keys, timestamps, or unsupported fields.",
  "CutSwitch owns reality: return word IDs and editorial segment plans only. The macOS app validates word IDs and resolves exact timestamps from local word-aligned JSON.",
  "Use only provided word IDs. Do not invent word IDs, utterance IDs, speaker names, words, timestamps, transitions, or source ranges.",
  "Improve editorial shape: start on the strongest hook, avoid conversational bridge starts, trim filler before the strongest idea, include enough self-contained context, and end after a clean payoff.",
  "Do not end on an unanswered question unless the answer is included in the same reel. If a moment needs more context or trimming, use editorialStatus needs_extension, needs_trim, or weak_shape instead of pretending it is ready.",
  "The title must match the actual clip and should not overpromise, misrepresent, or imply a payoff the selected words do not deliver.",
  "Allowed segment roles are only hook, context, bridge, payoff, and closing. Use 1-5 segments, each with startWordId, endWordId, quote, and reason.",
  "Do not reject or downgrade clips because they are explicit, controversial, sexual, spiritual, political, or client-specific. This is an editorial-quality pipeline, not a platform-risk or content-topic safety classifier.",
  "Do not return risk, safety, advertiser, brand, sexual, controversy, platform, or content-topic classification fields of any kind.",
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
  const useLiveWindowInput =
    metadata?.discoveryMode === "live_shortlist" ||
    metadata?.discoveryMode === "discovery_matrix" ||
    metadata?.discoveryMode === "duration_first_manifest";
  const useDurationFirstManifest = metadata?.discoveryMode === "duration_first_manifest";
  const useEditorialWordId = metadata?.discoveryMode === "editorial_word_id";

  return [
    {
      role: "system",
      content: useEditorialWordId ? SOCIAL_REELS_EDITORIAL_WORD_ID_SYSTEM_PROMPT : SOCIAL_REELS_EDITORIAL_SYSTEM_PROMPT,
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
        ...(useDurationFirstManifest && input.duration_first_manifest
          ? {
              duration_first_manifest: input.duration_first_manifest,
              requested_duration_buckets: input.requested_duration_buckets,
              duration_first_manifest_instruction:
                "Duration-first manifest mode: the user selects duration buckets, not editorial style categories. Analyze the whole podcast for requested_duration_buckets only; never pad weak clips. Do not mechanically chop the transcript every 30 seconds or ask for preselected editorial styles. Do not use educational, emotional, hook_first, funny, story, inspirational, or controversial as input buckets. Generate tags only after deciding each moment by assigning generated_tags after the moment is selected. Return duration_buckets with up to max_candidates per bucket, dedupe shared moments, and set insufficient_reason when fewer strong moments exist. Prefer linear moments; use story_edit only when hook/context/payoff reordering materially improves the reel. Avoid bridge starts, trim filler, require clean endings/payoffs, and do not end on an unanswered question unless the answer is included. Do not reject explicit/client-specific topics by topic. Do not invent word IDs, utterance IDs, timestamps, speakers, source ranges, or spoken words. Do not return platform/content-risk or topic-rejection fields. Return only JSON matching cutswitch.social_reels.duration_first_manifest.v1.",
              duration_first_export_variant_instruction:
                "formats, aspect ratios, caption styles, typography, and Final Cut export variants are handled by the app and must not become discovery buckets.",
            }
          : {}),
        ...(useEditorialWordId && input.editorial_word_id
          ? {
              editorial_word_id: input.editorial_word_id,
              editorial_word_id_instruction:
                "Editorial word-ID mode: return version social_reels_editorial_word_id_v1 with reels[]. Use startWordId/endWordId from provided words only. Improve hook, trim bridge/filler starts, keep self-contained context, include payoff, avoid ending on an unanswered question, and make title match the actual selected words. Return editorialStatus only as ready, needs_extension, needs_trim, or weak_shape. Do not return platform-risk, brand-safety, content-topic rejection, timestamp-first, or safety-classification fields.",
              word_packet_source: "bounded_app_provided_words",
              duration_targets_seconds: input.editorial_word_id.duration_targets_seconds,
              words: input.words.map((word) => ({
                word_id: word.word_id,
                utterance_id: word.utterance_id,
                text: word.text,
              })),
            }
          : {}),
        live_shortlist_note:
          useLiveWindowInput && !useDurationFirstManifest
            ? "Return up to effective_candidate_count candidates using the reduced live_shortlist schema. Return compact linear candidates only; Smart Story Edit recipe fields are reserved for later. Preserve Question -> Tension -> Answer -> Reframe, anti-junk exclusions, duration-aware anchors, and compact fields: title, hook_title, core_question, payoff, viral_atoms, why_it_works, context_dependency, sensitivity_level, scores, and existing compatibility flags. Prefer question, tension, confession, lesson, emotional turn, reframe, payoff, story beat, or specific claim. Do not choose intro/outro logistics, promotional housekeeping, book/link outro logistics, product_promo, sponsor_or_ad, meta_editing, audio_check, camera_check, mic checks, pre-show chatter, product/tasting discussion, or technical setup when better options exist. Duration compliance is mandatory: 60s means 45-78 seconds, not 8s, 12s, 16s, 22s, or 32s. Do not mechanically chop transcript windows, reject explicit/client-specific topics by topic, or return platform/content-risk or topic-rejection fields. Choose from duration_windows, use each window span, copy anchors near boundary hints, and return fewer candidates rather than padding."
            : null,
        duration_window_instruction:
          useLiveWindowInput
            ? "Choose from duration_windows. These backend-generated duration windows are not a full transcript scan. Each window includes utterance_ids/utterances, speakers, timecodes, boundary hints, window_quality_score, window_quality_reasons, window_demotion_reasons, and window_exclusion_reason. Treat utterances as source-of-truth and windows as grouping hints. Use high-quality non-excluded windows first, use the selected window span, place anchors near text_excerpt/utterance boundaries, never output outside the provided windows, and set candidate_id to the chosen window_id or derivative."
            : null,
        duration_windows: metadata?.durationWindows ?? [],
        transcript_source: useEditorialWordId ? "bounded_words" : input.utterances.length > 0 ? "utterances" : "segments",
        source_segments_sent: useEditorialWordId ? "bounded_words_only" : useLiveWindowInput ? "duration_windows_only" : "full_segments",
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
        segments: useLiveWindowInput || useEditorialWordId ? [] : input.segments,
      }),
    },
  ];
}
