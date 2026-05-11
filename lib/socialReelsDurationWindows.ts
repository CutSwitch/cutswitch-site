import {
  SOCIAL_REELS_DURATION_BUCKETS,
  type SocialReelsRequest,
} from "./socialReelsSchema";
import {
  durationFitsSocialReelsLiveBucket,
  getSocialReelsLiveDurationRange,
} from "./socialReelsShortlist";

type ConcreteDurationBucket = (typeof SOCIAL_REELS_DURATION_BUCKETS)[number];

export type SocialReelsDurationWindow = {
  window_id: string;
  segment_id: string;
  transcript_source: "utterances" | "segments";
  utterance_ids: string[];
  speakers: string[];
  start_timecode: string | null;
  end_timecode: string | null;
  duration_bucket: ConcreteDurationBucket;
  start_seconds: number;
  end_seconds: number;
  duration_seconds: number;
  start_anchor_hint: string;
  end_anchor_hint: string;
};

export type SocialReelsWindowExclusionReason =
  | "countdown_or_timer"
  | "pre_show_chatter"
  | "mic_check"
  | "audio_check"
  | "camera_check"
  | "technical_setup"
  | "housekeeping"
  | "intro_setup"
  | "outro_logistics"
  | "intro_outro_logistics"
  | "podcast_wrapup"
  | "sponsor_or_ad"
  | "book_link_outro"
  | "book_link_promo_outro"
  | "follow_up_logistics"
  | "product_promo"
  | "product_ingredient_discussion"
  | "tasting_product"
  | "meta_editing"
  | "dead_air_or_filler"
  | "vague_greeting"
  | "weak_opening_chatter";

export type SocialReelsScoredDurationWindow = SocialReelsDurationWindow & {
  window_quality_score: number;
  window_quality_reasons: string[];
  window_demotion_reasons: string[];
  window_exclusion_reason: SocialReelsWindowExclusionReason | null;
};

export type SocialReelsWindowQualitySummary = {
  windows_after_quality_filter: number;
  excluded_window_reason_counts: Record<string, number>;
  average_window_quality_score: number | null;
  demoted_window_reason_counts: Record<string, number>;
  selected_window_quality_range: { min: number | null; max: number | null };
  selected_window_quality_distribution: { strong: number; decent: number; weak: number };
};

export type SocialReelsWindowReasonCounts = {
  quality_reasons: Record<string, number>;
  demotion_reasons: Record<string, number>;
  selected_windows_with_demotion_count: number;
};

export type SocialReelsPromptDurationWindow = SocialReelsScoredDurationWindow & {
  speaker: string | null;
  speakers?: string[];
  utterance_ids?: string[];
  start_timecode?: string | null;
  end_timecode?: string | null;
  transcript_source?: "utterances" | "segments";
  text_excerpt: string;
  utterances?: Array<{
    utterance_id: string;
    speaker_label: string | null;
    start_seconds: number;
    end_seconds: number;
    start_timecode: string | null;
    end_timecode: string | null;
    text: string;
  }>;
};

export const SOCIAL_REELS_LIVE_WINDOW_DEFAULT_COUNT = 18;
export const SOCIAL_REELS_LIVE_WINDOW_MIN_COUNT = 6;
export const SOCIAL_REELS_LIVE_WINDOW_MAX_COUNT = 24;
const SOCIAL_REELS_LIVE_WINDOW_EXCERPT_CHARS = 680;

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

const EXCLUSION_PATTERNS: Array<{ reason: SocialReelsWindowExclusionReason; pattern: RegExp }> = [
  { reason: "countdown_or_timer", pattern: /\b(countdown|counting down|three two one|3\s*2\s*1|timer)\b/i },
  { reason: "pre_show_chatter", pattern: /\b(pre[-\s]?show|haven't started|have not started|before we start|before recording)\b/i },
  { reason: "meta_editing", pattern: /\b(cut that out|cut this out|we'll cut|we will cut|edit that out|leave that in|don't include this|do not include this|fix it in post)\b/i },
  { reason: "mic_check", pattern: /\b(mic check|microphone check|check one two|testing testing|can you hear me)\b/i },
  { reason: "audio_check", pattern: /\b(audio check|sound check|audio levels|levels are|is my audio|audio okay)\b/i },
  { reason: "camera_check", pattern: /\b(camera check|camera setup|is my camera|video check|lighting check|camera angle|frame me up)\b/i },
  {
    reason: "product_promo",
    pattern:
      /\b(product|supplement|ingredient|ingredients|capsule|powder|dose|dosage|flavor|tastes like|taste test|tasting|try this|order this|buy this|purchase|available now|launching|brand|skincare|serum|merch|use code|promo link|formulated to|take it every day|caffeine)\b/i,
  },
  { reason: "technical_setup", pattern: /\b(recording setup|zoom|riverside|plugged in|headphones|microphone|lighting|screen share|tech setup|setup issue)\b/i },
  { reason: "housekeeping", pattern: /\b(housekeeping|quick note|admin note|quick announcement|before we get into it)\b/i },
  { reason: "intro_setup", pattern: /\b(welcome back|welcome to|today we are talking|in this episode|before we dive in|before we get started|before we start)\b/i },
  { reason: "outro_logistics", pattern: /\b(thanks for listening|thanks for joining|see you next time|until next time|like and subscribe|subscribe and review|leave a review|thanks for being here)\b/i },
  { reason: "podcast_wrapup", pattern: /\b(come back on the podcast|have you back on|wrap this up|as we wrap|final question|where can people find you|where can listeners find you)\b/i },
  { reason: "sponsor_or_ad", pattern: /\b(sponsor|sponsored by|promo code|use code|ad read|advertisement)\b/i },
  {
    reason: "book_link_outro",
    pattern:
      /\b(linked down below|linked below|show notes|link in (the )?(description|bio)|buy my book|order my book|my book is available|book is out|grab the book|promo link|affiliate link)\b/i,
  },
  { reason: "follow_up_logistics", pattern: /\b(follow up|follow me|follow us|find me on|find us on|check out my|go to my website|website is|newsletter|dm me|reach out)\b/i },
  { reason: "dead_air_or_filler", pattern: /\b(um+|uh+|you know|sort of|kind of|whatever|anyway|blah blah|and so yeah)\b/i },
];

const QUALITY_SIGNALS: Array<{ reason: string; pattern: RegExp; weight: number }> = [
  { reason: "question", pattern: /\b(why|how|what|when|where|question|ask|wonder)\b/i, weight: 0.07 },
  { reason: "tension", pattern: /\b(tension|problem|hard|difficult|struggle|pressure|risk|stakes|conflict|but)\b/i, weight: 0.09 },
  { reason: "confession", pattern: /\b(confess|confession|truth|honestly|i realized|i learned|i felt|i was afraid|i used to)\b/i, weight: 0.08 },
  { reason: "contrarian_take", pattern: /\b(wrong|myth|counterintuitive|actually|not true|opposite|instead|people think)\b/i, weight: 0.08 },
  { reason: "practical_lesson", pattern: /\b(lesson|rule|practice|tool|framework|step|how to|what works|the answer)\b/i, weight: 0.08 },
  { reason: "emotional_turn", pattern: /\b(fear|shame|grief|love|desire|intimacy|vulnerable|emotional|heart|body)\b/i, weight: 0.07 },
  { reason: "clear_reframe", pattern: /\b(reframe|not .* it's|not .* but|the point is|what this means|really about)\b/i, weight: 0.1 },
  { reason: "payoff", pattern: /\b(payoff|lands|finally|so that|because|therefore|the result|what changed)\b/i, weight: 0.1 },
  { reason: "story_beat", pattern: /\b(then|suddenly|moment|story|turn|change|became|before|after)\b/i, weight: 0.06 },
  { reason: "identity_trigger", pattern: /\b(women|men|mother|creator|editor|artist|entrepreneur|people like us|identity)\b/i, weight: 0.04 },
  { reason: "specific_claim", pattern: /\b(the reason is|the truth is|what happens is|the thing is|here's the|here is the|I believe|I know that)\b/i, weight: 0.07 },
  { reason: "transformation", pattern: /\b(transformed|transformation|changed my life|what changed|before and after|became|shifted)\b/i, weight: 0.08 },
  { reason: "vivid_example", pattern: /\b(for example|imagine|picture this|specific example|one time|I remember|the moment when)\b/i, weight: 0.06 },
  { reason: "strong_answer", pattern: /\b(the answer is|the solution is|what you do is|the way through|here's what works)\b/i, weight: 0.09 },
  { reason: "surprising_statement", pattern: /\b(surprising|nobody tells you|most people miss|you would think|the weird thing|secretly)\b/i, weight: 0.07 },
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
    if (phrase) return phrase;
  }

  return null;
}

function anchorHintAt(words: string[], tokenIndex: number) {
  const near = phraseNearWords(words, tokenIndex);
  if (near) return near;

  const safeStart = Math.max(0, Math.min(tokenIndex, Math.max(0, words.length - 8)));
  return words.slice(safeStart, safeStart + 8).join(" ").trim().slice(0, 160) || "Use an exact quote near this window boundary.";
}

function liveWindowTargetDurationSeconds(bucket: ConcreteDurationBucket) {
  if (bucket === "15s") return 15;
  if (bucket === "30s") return 30;
  if (bucket === "60s") return 60;
  if (bucket === "90s") return 90;
  return 300;
}

function roundWindowSeconds(value: number) {
  return Number(value.toFixed(1));
}

function uniqueCleanStrings(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const clean = value?.trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    result.push(clean);
  }

  return result;
}

function getUtteranceSpeakerLabel(utterance: SocialReelsRequest["utterances"][number]) {
  return utterance.speaker_label ?? utterance.speaker ?? null;
}

function getSegmentSpeakers(segment: SocialReelsRequest["segments"][number]) {
  return uniqueCleanStrings([...(segment.speakers ?? []), segment.speaker]);
}

function getUtteranceUnits(input: SocialReelsRequest) {
  return [...input.utterances]
    .sort((a, b) => a.start_seconds - b.start_seconds || a.id.localeCompare(b.id))
    .map((utterance) => ({
      id: utterance.id,
      start_seconds: utterance.start_seconds,
      end_seconds: utterance.end_seconds,
      start_timecode: utterance.start_timecode ?? null,
      end_timecode: utterance.end_timecode ?? null,
      speakers: uniqueCleanStrings([getUtteranceSpeakerLabel(utterance)]),
      utterance_ids: [utterance.id],
      text: utterance.text,
    }));
}

function clampQualityScore(value: number) {
  return Number(Math.max(0, Math.min(1, value)).toFixed(2));
}

function getDemotionReasons(text: string) {
  const demotions: string[] = [];
  const demotionPatterns: Array<{ reason: string; pattern: RegExp }> = [
    { reason: "promo_adjacent", pattern: /\b(product details|product line|available now|launching|promo|use code|brand deal)\b/i },
    { reason: "logistics_adjacent", pattern: /\b(where can people find|linked below|show notes|come back on|follow up|newsletter)\b/i },
    { reason: "setup_adjacent", pattern: /\b(before we start|before we get started|welcome back|camera|audio|microphone|recording)\b/i },
    { reason: "filler_adjacent", pattern: /\b(you know|sort of|kind of|anyway|and so yeah)\b/i },
  ];

  for (const { reason, pattern } of demotionPatterns) {
    if (pattern.test(text)) demotions.push(reason);
  }

  return demotions;
}

function demotionPenalty(reason: string) {
  if (reason === "promo_adjacent") return 0.28;
  if (reason === "logistics_adjacent") return 0.22;
  if (reason === "setup_adjacent") return 0.14;
  if (reason === "filler_adjacent") return 0.1;
  return 0.08;
}

function hasReason(reasons: string[], ...candidates: string[]) {
  return candidates.some((candidate) => reasons.includes(candidate));
}

function firstExclusionReason(text: string, positiveReasonCount: number): SocialReelsWindowExclusionReason | null {
  for (const { reason, pattern } of EXCLUSION_PATTERNS) {
    if (pattern.test(text)) {
      if (reason === "dead_air_or_filler" && positiveReasonCount >= 3) continue;
      if (reason === "technical_setup" && positiveReasonCount >= 4) continue;
      return reason;
    }
  }

  if (/\bwelcome\b/i.test(text) && positiveReasonCount < 2) return "intro_setup";
  if (/\b(hi everyone|hello everyone|hey everybody|thanks so much)\b/i.test(text) && positiveReasonCount < 2) return "vague_greeting";
  return null;
}

export function scoreSocialReelsDurationWindow(input: SocialReelsRequest, window: SocialReelsDurationWindow): SocialReelsScoredDurationWindow {
  const excerpt = windowTextExcerpt(input, window, SOCIAL_REELS_LIVE_WINDOW_EXCERPT_CHARS);
  const reasons: string[] = [];
  let score = 0.34;

  for (const signal of QUALITY_SIGNALS) {
    if (signal.pattern.test(excerpt)) {
      reasons.push(signal.reason);
      score += signal.weight;
    }
  }

  const demotionReasons = getDemotionReasons(excerpt);
  const exclusionReason = firstExclusionReason(excerpt, reasons.length);
  const hasQuestion = hasReason(reasons, "question");
  const hasTension = hasReason(reasons, "tension", "confession", "contrarian_take");
  const hasAnswer = hasReason(reasons, "clear_reframe", "strong_answer", "practical_lesson");
  const hasPayoff = hasReason(reasons, "payoff", "transformation");
  if (hasQuestion && hasTension && hasAnswer && hasPayoff) score += 0.08;
  else if ((hasQuestion || hasTension) && hasAnswer && hasPayoff) score += 0.04;
  if (reasons.length >= 6 && hasPayoff) score += 0.03;
  if (exclusionReason) score -= exclusionReason === "dead_air_or_filler" ? 0.26 : 0.46;
  for (const demotionReason of demotionReasons) score -= demotionPenalty(demotionReason);
  if (reasons.length === 0) score -= 0.14;
  if (!hasAnswer && !hasPayoff) score = Math.min(score, 0.74);
  else if (!hasAnswer || !hasPayoff) score = Math.min(score, 0.84);

  return {
    ...window,
    window_quality_score: clampQualityScore(score),
    window_quality_reasons: reasons.slice(0, 10),
    window_demotion_reasons: demotionReasons.slice(0, 6),
    window_exclusion_reason: exclusionReason,
  };
}

export function scoreSocialReelsDurationWindows(input: SocialReelsRequest, windows: SocialReelsDurationWindow[]) {
  return windows.map((window) => scoreSocialReelsDurationWindow(input, window));
}

function toScoredWindow(window: SocialReelsDurationWindow | SocialReelsScoredDurationWindow): SocialReelsScoredDurationWindow {
  if ("window_quality_score" in window && "window_quality_reasons" in window && "window_demotion_reasons" in window && "window_exclusion_reason" in window) {
    return window;
  }

  return {
    ...window,
    window_quality_score: 0.5,
    window_quality_reasons: [],
    window_demotion_reasons: [],
    window_exclusion_reason: null,
  };
}

export function summarizeSocialReelsWindowQuality(windows: Array<SocialReelsDurationWindow | SocialReelsScoredDurationWindow>): SocialReelsWindowQualitySummary {
  const scored = windows.map(toScoredWindow);
  const included = scored.filter((window) => !window.window_exclusion_reason);
  const excludedCounts: Record<string, number> = {};
  const demotedCounts: Record<string, number> = {};

  for (const window of scored) {
    if (window.window_exclusion_reason) {
      excludedCounts[window.window_exclusion_reason] = (excludedCounts[window.window_exclusion_reason] || 0) + 1;
    }

    for (const reason of window.window_demotion_reasons) {
      demotedCounts[reason] = (demotedCounts[reason] || 0) + 1;
    }
  }

  const qualityScores = scored.map((window) => window.window_quality_score);

  return {
    windows_after_quality_filter: included.length,
    excluded_window_reason_counts: excludedCounts,
    average_window_quality_score:
      scored.length > 0
        ? Number((scored.reduce((sum, window) => sum + window.window_quality_score, 0) / scored.length).toFixed(2))
        : null,
    demoted_window_reason_counts: demotedCounts,
    selected_window_quality_range: {
      min: qualityScores.length > 0 ? Math.min(...qualityScores) : null,
      max: qualityScores.length > 0 ? Math.max(...qualityScores) : null,
    },
    selected_window_quality_distribution: getSocialReelsWindowQualityDistribution(scored),
  };
}

export function getSocialReelsWindowQualityRange(windows: Array<SocialReelsDurationWindow | SocialReelsScoredDurationWindow>) {
  const scores = windows.map((window) => toScoredWindow(window).window_quality_score);
  return {
    min: scores.length > 0 ? Math.min(...scores) : null,
    max: scores.length > 0 ? Math.max(...scores) : null,
  };
}

export function getSocialReelsWindowQualityDistribution(windows: Array<SocialReelsDurationWindow | SocialReelsScoredDurationWindow>) {
  const scores = windows.map((window) => toScoredWindow(window).window_quality_score);
  return {
    strong: scores.filter((score) => score >= 0.85).length,
    decent: scores.filter((score) => score >= 0.65 && score < 0.85).length,
    weak: scores.filter((score) => score < 0.65).length,
  };
}

export function getSocialReelsWindowReasonCounts(windows: Array<SocialReelsDurationWindow | SocialReelsScoredDurationWindow>): SocialReelsWindowReasonCounts {
  const qualityReasons: Record<string, number> = {};
  const demotionReasons: Record<string, number> = {};
  let selectedWindowsWithDemotionCount = 0;

  for (const window of windows.map(toScoredWindow)) {
    for (const reason of window.window_quality_reasons) {
      qualityReasons[reason] = (qualityReasons[reason] || 0) + 1;
    }

    if (window.window_demotion_reasons.length > 0) selectedWindowsWithDemotionCount += 1;
    for (const reason of window.window_demotion_reasons) {
      demotionReasons[reason] = (demotionReasons[reason] || 0) + 1;
    }
  }

  return {
    quality_reasons: qualityReasons,
    demotion_reasons: demotionReasons,
    selected_windows_with_demotion_count: selectedWindowsWithDemotionCount,
  };
}

function clampWindowCount(value: number) {
  return Math.min(SOCIAL_REELS_LIVE_WINDOW_MAX_COUNT, Math.max(SOCIAL_REELS_LIVE_WINDOW_MIN_COUNT, Math.round(value)));
}

export function getSocialReelsLiveWindowCount(rawEnvValue?: string | null) {
  const parsed = rawEnvValue?.trim() ? Number(rawEnvValue.trim()) : SOCIAL_REELS_LIVE_WINDOW_DEFAULT_COUNT;
  if (!Number.isFinite(parsed) || parsed <= 0) return SOCIAL_REELS_LIVE_WINDOW_DEFAULT_COUNT;
  return clampWindowCount(parsed);
}

function uniqueWindowOffsets(segmentDuration: number, targetDuration: number) {
  const maxOffset = Math.max(0, segmentDuration - targetDuration);
  if (maxOffset <= 0) return [0];

  const step = Math.max(8, Math.min(30, maxOffset / 4));
  const offsets = [0, maxOffset, maxOffset / 2, maxOffset / 3, (maxOffset * 2) / 3, step, Math.max(0, maxOffset - step)];
  const seen = new Set<string>();

  return offsets
    .map((offset) => Math.max(0, Math.min(maxOffset, offset)))
    .filter((offset) => {
      const key = offset.toFixed(1);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function segmentSupportsLiveBucket(segment: SocialReelsRequest["segments"][number], bucket: ConcreteDurationBucket) {
  const range = getSocialReelsLiveDurationRange(bucket);
  const segmentDuration = Math.max(0, segment.end_seconds - segment.start_seconds);
  const words = cleanWords(segment.text);
  return segmentDuration >= range.min && words.length >= 24;
}

function utterancesSupportLiveBucket(input: SocialReelsRequest, bucket: ConcreteDurationBucket) {
  const units = getUtteranceUnits(input);
  const range = getSocialReelsLiveDurationRange(bucket);

  for (let startIndex = 0; startIndex < units.length; startIndex += 1) {
    let wordCount = 0;
    for (let endIndex = startIndex; endIndex < units.length; endIndex += 1) {
      wordCount += cleanWords(units[endIndex].text).length;
      const duration = units[endIndex].end_seconds - units[startIndex].start_seconds;
      if (duration > range.max) break;
      if (duration >= range.min && wordCount >= 24) return true;
    }
  }

  return false;
}

export function getConcreteSocialReelsDurationBuckets(input: SocialReelsRequest) {
  const preferences = input.duration_preferences || [input.duration_bucket];
  if (preferences.includes("mixed") || preferences.includes("custom")) {
    const usableBuckets = SOCIAL_REELS_DURATION_BUCKETS.filter((bucket) =>
      input.utterances.length > 0
        ? utterancesSupportLiveBucket(input, bucket)
        : input.segments.some((segment) => segmentSupportsLiveBucket(segment, bucket))
    );
    return usableBuckets.length > 0 ? usableBuckets : SOCIAL_REELS_DURATION_BUCKETS;
  }

  const concreteBuckets = preferences.filter((preference): preference is ConcreteDurationBucket =>
    SOCIAL_REELS_DURATION_BUCKETS.includes(preference as ConcreteDurationBucket)
  );
  const usableBuckets = concreteBuckets.filter((bucket) =>
    input.utterances.length > 0
      ? utterancesSupportLiveBucket(input, bucket)
      : input.segments.some((segment) => segmentSupportsLiveBucket(segment, bucket))
  );

  if (usableBuckets.length > 0) return usableBuckets;
  return concreteBuckets.length > 0 ? concreteBuckets : SOCIAL_REELS_DURATION_BUCKETS;
}

function makeUtteranceDurationWindow(
  bucket: ConcreteDurationBucket,
  windowIndex: number,
  units: ReturnType<typeof getUtteranceUnits>,
  startIndex: number,
  endIndex: number,
  segmentId?: string
): SocialReelsDurationWindow | null {
  const includedUnits = units.slice(startIndex, endIndex + 1);
  if (includedUnits.length === 0) return null;

  const firstUnit = includedUnits[0];
  const lastUnit = includedUnits[includedUnits.length - 1];
  const durationSeconds = Math.round(lastUnit.end_seconds - firstUnit.start_seconds);
  if (!durationFitsSocialReelsLiveBucket(bucket, durationSeconds)) return null;

  const combinedWords = cleanWords(includedUnits.map((unit) => unit.text).join(" "));
  if (combinedWords.length < 24) return null;

  const firstWords = cleanWords(firstUnit.text);
  const lastWords = cleanWords(lastUnit.text);

  return {
    window_id: `window-${bucket}-${String(windowIndex).padStart(2, "0")}`,
    segment_id: segmentId ?? firstUnit.id,
    transcript_source: "utterances",
    utterance_ids: includedUnits.flatMap((unit) => unit.utterance_ids),
    speakers: uniqueCleanStrings(includedUnits.flatMap((unit) => unit.speakers)),
    start_timecode: firstUnit.start_timecode,
    end_timecode: lastUnit.end_timecode,
    duration_bucket: bucket,
    start_seconds: roundWindowSeconds(firstUnit.start_seconds),
    end_seconds: roundWindowSeconds(lastUnit.end_seconds),
    duration_seconds: durationSeconds,
    start_anchor_hint: anchorHintAt(firstWords.length > 0 ? firstWords : combinedWords, 0),
    end_anchor_hint: anchorHintAt(lastWords.length > 0 ? lastWords : combinedWords, Math.max(0, (lastWords.length > 0 ? lastWords : combinedWords).length - 8)),
  };
}

function buildSegmentReferencedUtteranceWindows(
  input: SocialReelsRequest,
  buckets: readonly ConcreteDurationBucket[],
  units: ReturnType<typeof getUtteranceUnits>
) {
  const windows: SocialReelsDurationWindow[] = [];
  const unitsById = new Map(units.map((unit) => [unit.id, unit]));

  for (const bucket of buckets) {
    for (const segment of input.segments) {
      if (!segment.utterance_ids || segment.utterance_ids.length === 0) continue;

      const includedUnits = segment.utterance_ids
        .map((utteranceId) => unitsById.get(utteranceId))
        .filter((unit): unit is NonNullable<typeof unit> => Boolean(unit))
        .sort((a, b) => a.start_seconds - b.start_seconds || a.id.localeCompare(b.id));
      if (includedUnits.length === 0) continue;

      const window = makeUtteranceDurationWindow(
        bucket,
        windows.length + 1,
        includedUnits,
        0,
        includedUnits.length - 1,
        segment.id
      );
      if (window) {
        windows.push({
          ...window,
          speakers: uniqueCleanStrings([...(segment.speakers ?? []), ...window.speakers]),
        });
      }
    }
  }

  return windows;
}

function buildUtteranceDurationWindows(input: SocialReelsRequest, buckets: readonly ConcreteDurationBucket[]) {
  const units = getUtteranceUnits(input);
  const windows: SocialReelsDurationWindow[] = buildSegmentReferencedUtteranceWindows(input, buckets, units);

  for (const bucket of buckets) {
    const targetDuration = liveWindowTargetDurationSeconds(bucket);
    const range = getSocialReelsLiveDurationRange(bucket);

    for (let startIndex = 0; startIndex < units.length; startIndex += 1) {
      let wordCount = 0;
      let bestEndIndex: number | null = null;
      let bestDelta = Number.POSITIVE_INFINITY;

      for (let endIndex = startIndex; endIndex < units.length; endIndex += 1) {
        wordCount += cleanWords(units[endIndex].text).length;
        const duration = units[endIndex].end_seconds - units[startIndex].start_seconds;
        if (duration > range.max) break;
        if (duration < range.min || wordCount < 24) continue;

        const delta = Math.abs(duration - targetDuration);
        if (delta < bestDelta) {
          bestDelta = delta;
          bestEndIndex = endIndex;
        }
      }

      if (bestEndIndex === null) continue;
      const window = makeUtteranceDurationWindow(bucket, windows.length + 1, units, startIndex, bestEndIndex);
      if (window) windows.push(window);
    }
  }

  return windows;
}

export function buildSocialReelsLiveDurationWindows(input: SocialReelsRequest, effectiveCandidateCount: number) {
  const buckets = getConcreteSocialReelsDurationBuckets(input);
  const windows: SocialReelsDurationWindow[] = [];
  void effectiveCandidateCount;

  if (input.utterances.length > 0) {
    return buildUtteranceDurationWindows(input, buckets);
  }

  for (const bucket of buckets) {
    const targetDuration = liveWindowTargetDurationSeconds(bucket);
    const range = getSocialReelsLiveDurationRange(bucket);

    for (const segment of input.segments) {
      const segmentDuration = Math.max(0, segment.end_seconds - segment.start_seconds);
      if (segmentDuration < range.min) continue;

      const durationSeconds = Math.min(targetDuration, segmentDuration);
      if (!durationFitsSocialReelsLiveBucket(bucket, durationSeconds)) continue;

      const words = cleanWords(segment.text);
      if (words.length < 24) continue;

      const secondsPerToken = segmentDuration / Math.max(1, words.length - 1);
      for (const offset of uniqueWindowOffsets(segmentDuration, durationSeconds)) {
        const startSeconds = segment.start_seconds + offset;
        const endSeconds = Math.min(segment.end_seconds, startSeconds + durationSeconds);
        const actualDuration = Math.round(endSeconds - startSeconds);
        if (!durationFitsSocialReelsLiveBucket(bucket, actualDuration)) continue;

        const startTokenIndex = Math.max(0, Math.min(words.length - 1, Math.round(offset / secondsPerToken)));
        const endTokenIndex = Math.max(0, Math.min(words.length - 1, Math.round((offset + actualDuration) / secondsPerToken)));

        windows.push({
          window_id: `window-${bucket}-${String(windows.length + 1).padStart(2, "0")}`,
          segment_id: segment.id,
          transcript_source: "segments",
          utterance_ids: segment.utterance_ids ?? [],
          speakers: getSegmentSpeakers(segment),
          start_timecode: segment.start_timecode ?? null,
          end_timecode: segment.end_timecode ?? null,
          duration_bucket: bucket,
          start_seconds: roundWindowSeconds(startSeconds),
          end_seconds: roundWindowSeconds(endSeconds),
          duration_seconds: actualDuration,
          start_anchor_hint: anchorHintAt(words, startTokenIndex),
          end_anchor_hint: anchorHintAt(words, endTokenIndex),
        });
      }
    }
  }

  return windows;
}

function selectBestSpreadWindows(
  windows: SocialReelsScoredDurationWindow[],
  desiredWindowCount: number
): SocialReelsScoredDurationWindow[] {
  const targetCount = clampWindowCount(desiredWindowCount);
  if (windows.length <= targetCount) {
    return [...windows].sort((a, b) => a.start_seconds - b.start_seconds || a.window_id.localeCompare(b.window_id));
  }

  const sorted = [...windows].sort((a, b) => a.start_seconds - b.start_seconds || a.window_id.localeCompare(b.window_id));
  const selected = new Map<string, SocialReelsScoredDurationWindow>();
  const selectedPerSegment = new Map<string, number>();
  const minStart = sorted[0].start_seconds;
  const maxStart = sorted[sorted.length - 1].start_seconds;
  const span = Math.max(1, maxStart - minStart);
  const maxWindowsPerSegment = windows.length >= targetCount * 2 ? 1 : Number.POSITIVE_INFINITY;
  const canSelectWindow = (window: SocialReelsScoredDurationWindow) =>
    !selected.has(window.window_id) && (selectedPerSegment.get(window.segment_id) || 0) < maxWindowsPerSegment;
  const addWindow = (window: SocialReelsScoredDurationWindow) => {
    selected.set(window.window_id, window);
    selectedPerSegment.set(window.segment_id, (selectedPerSegment.get(window.segment_id) || 0) + 1);
  };

  for (let index = 0; index < targetCount; index += 1) {
    const binStart = minStart + (span * index) / targetCount;
    const binEnd = index === targetCount - 1 ? maxStart + 1 : minStart + (span * (index + 1)) / targetCount;
    const bestInBin = sorted
      .filter((window) => window.start_seconds >= binStart && window.start_seconds < binEnd && canSelectWindow(window))
      .sort((a, b) => b.window_quality_score - a.window_quality_score || a.start_seconds - b.start_seconds)[0];
    if (bestInBin) addWindow(bestInBin);
  }

  if (selected.size < targetCount) {
    for (const window of sorted.sort((a, b) => b.window_quality_score - a.window_quality_score || a.start_seconds - b.start_seconds)) {
      if (selected.size >= targetCount) break;
      if (canSelectWindow(window)) addWindow(window);
    }
  }

  if (selected.size < targetCount) {
    for (const window of sorted.sort((a, b) => b.window_quality_score - a.window_quality_score || a.start_seconds - b.start_seconds)) {
      if (selected.size >= targetCount) break;
      if (!selected.has(window.window_id)) addWindow(window);
    }
  }

  return [...selected.values()].sort((a, b) => a.start_seconds - b.start_seconds || a.window_id.localeCompare(b.window_id));
}

export function selectSocialReelsLiveDurationWindows(
  windows: Array<SocialReelsDurationWindow | SocialReelsScoredDurationWindow>,
  desiredWindowCount: number,
  input?: SocialReelsRequest
): SocialReelsScoredDurationWindow[] {
  const targetCount = clampWindowCount(desiredWindowCount);
  const scored = input ? scoreSocialReelsDurationWindows(input, windows) : windows.map(toScoredWindow);
  const qualityPool = scored.filter((window) => !window.window_exclusion_reason);
  const strongQualityPool = qualityPool.filter((window) => window.window_quality_score >= 0.78);
  const pool = strongQualityPool.length >= targetCount ? strongQualityPool : qualityPool.length >= targetCount ? qualityPool : scored;

  return selectBestSpreadWindows(pool, targetCount);
}

function findSegment(input: SocialReelsRequest, segmentId: string) {
  return input.segments.find((segment) => segment.id === segmentId || segment.segment_id === segmentId) || null;
}

function findUtterance(input: SocialReelsRequest, utteranceId: string) {
  return input.utterances.find((utterance) => utterance.id === utteranceId || utterance.utterance_id === utteranceId) || null;
}

function trimExcerpt(text: string, maxChars: number) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= maxChars) return compact;
  return compact.slice(0, maxChars).replace(/\s+\S*$/, "").trim();
}

function windowTextExcerpt(input: SocialReelsRequest, window: SocialReelsDurationWindow, maxChars = SOCIAL_REELS_LIVE_WINDOW_EXCERPT_CHARS) {
  if (input.utterances.length > 0 && window.utterance_ids.length > 0) {
    const text = window.utterance_ids
      .map((utteranceId) => findUtterance(input, utteranceId)?.text ?? "")
      .filter(Boolean)
      .join(" ");

    return trimExcerpt(text, maxChars);
  }

  const segment = findSegment(input, window.segment_id);
  if (!segment) return "";

  const words = cleanWords(segment.text);
  if (words.length === 0) return "";

  const segmentDuration = Math.max(1, segment.end_seconds - segment.start_seconds);
  const secondsPerToken = segmentDuration / Math.max(1, words.length - 1);
  const startOffsetSeconds = Math.max(0, window.start_seconds - segment.start_seconds);
  const endOffsetSeconds = Math.max(startOffsetSeconds, window.end_seconds - segment.start_seconds);
  const startTokenIndex = Math.max(0, Math.floor(startOffsetSeconds / secondsPerToken) - 18);
  const endTokenIndex = Math.min(words.length, Math.ceil(endOffsetSeconds / secondsPerToken) + 18);

  const excerpt = words.slice(startTokenIndex, Math.max(startTokenIndex + 24, endTokenIndex)).join(" ");
  return trimExcerpt(excerpt || segment.text, maxChars);
}

function promptUtterancesForWindow(input: SocialReelsRequest, window: SocialReelsDurationWindow) {
  if (input.utterances.length === 0 || window.utterance_ids.length === 0) return [];

  return window.utterance_ids
    .map((utteranceId) => findUtterance(input, utteranceId))
    .filter((utterance): utterance is NonNullable<ReturnType<typeof findUtterance>> => Boolean(utterance))
    .map((utterance) => ({
      utterance_id: utterance.id,
      speaker_label: getUtteranceSpeakerLabel(utterance),
      start_seconds: roundWindowSeconds(utterance.start_seconds),
      end_seconds: roundWindowSeconds(utterance.end_seconds),
      start_timecode: utterance.start_timecode ?? null,
      end_timecode: utterance.end_timecode ?? null,
      text: trimExcerpt(utterance.text, 260),
    }));
}

export function buildSocialReelsLivePromptWindows(
  input: SocialReelsRequest,
  windows: SocialReelsDurationWindow[]
): SocialReelsPromptDurationWindow[] {
  return windows
    .map((window) => {
      const scoredWindow = toScoredWindow(window);
      const segment = findSegment(input, window.segment_id);
      const speakers = window.speakers.length > 0 ? window.speakers : segment ? getSegmentSpeakers(segment) : [];
      const promptUtterances = promptUtterancesForWindow(input, window);

      return {
        ...scoredWindow,
        speaker: speakers[0] ?? segment?.speaker ?? null,
        ...(speakers.length > 1 ? { speakers } : {}),
        ...(window.utterance_ids.length > 0 ? { utterance_ids: window.utterance_ids } : {}),
        ...(window.start_timecode ? { start_timecode: window.start_timecode } : {}),
        ...(window.end_timecode ? { end_timecode: window.end_timecode } : {}),
        ...(window.transcript_source === "utterances" ? { transcript_source: window.transcript_source } : {}),
        text_excerpt: windowTextExcerpt(input, window),
        ...(promptUtterances.length > 0 ? { utterances: promptUtterances } : {}),
      };
    })
    .filter((window) => window.text_excerpt.length > 0);
}

export function estimateSocialReelsPromptWindowCharCount(windows: SocialReelsPromptDurationWindow[]) {
  return JSON.stringify(windows).length;
}
