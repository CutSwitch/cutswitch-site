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
  duration_bucket: ConcreteDurationBucket;
  start_seconds: number;
  end_seconds: number;
  duration_seconds: number;
  start_anchor_hint: string;
  end_anchor_hint: string;
};

export type SocialReelsPromptDurationWindow = SocialReelsDurationWindow & {
  text_excerpt: string;
};

export const SOCIAL_REELS_LIVE_WINDOW_DEFAULT_COUNT = 18;
export const SOCIAL_REELS_LIVE_WINDOW_MIN_COUNT = 6;
export const SOCIAL_REELS_LIVE_WINDOW_MAX_COUNT = 24;
const SOCIAL_REELS_LIVE_WINDOW_EXCERPT_CHARS = 900;

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

export function getConcreteSocialReelsDurationBuckets(input: SocialReelsRequest) {
  const preferences = input.duration_preferences || [input.duration_bucket];
  if (preferences.includes("mixed") || preferences.includes("custom")) {
    const usableBuckets = SOCIAL_REELS_DURATION_BUCKETS.filter((bucket) =>
      input.segments.some((segment) => segmentSupportsLiveBucket(segment, bucket))
    );
    return usableBuckets.length > 0 ? usableBuckets : SOCIAL_REELS_DURATION_BUCKETS;
  }

  const concreteBuckets = preferences.filter((preference): preference is ConcreteDurationBucket =>
    SOCIAL_REELS_DURATION_BUCKETS.includes(preference as ConcreteDurationBucket)
  );
  const usableBuckets = concreteBuckets.filter((bucket) => input.segments.some((segment) => segmentSupportsLiveBucket(segment, bucket)));

  if (usableBuckets.length > 0) return usableBuckets;
  return concreteBuckets.length > 0 ? concreteBuckets : SOCIAL_REELS_DURATION_BUCKETS;
}

export function buildSocialReelsLiveDurationWindows(input: SocialReelsRequest, effectiveCandidateCount: number) {
  const buckets = getConcreteSocialReelsDurationBuckets(input);
  const windows: SocialReelsDurationWindow[] = [];
  void effectiveCandidateCount;

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

function chooseNearestUnusedIndex(length: number, desiredIndex: number, usedIndexes: Set<number>) {
  if (!usedIndexes.has(desiredIndex)) return desiredIndex;

  for (let distance = 1; distance < length; distance += 1) {
    const left = desiredIndex - distance;
    const right = desiredIndex + distance;
    if (left >= 0 && !usedIndexes.has(left)) return left;
    if (right < length && !usedIndexes.has(right)) return right;
  }

  return null;
}

export function selectSocialReelsLiveDurationWindows(
  windows: SocialReelsDurationWindow[],
  desiredWindowCount: number
): SocialReelsDurationWindow[] {
  const targetCount = clampWindowCount(desiredWindowCount);
  if (windows.length <= targetCount) {
    return [...windows].sort((a, b) => a.start_seconds - b.start_seconds || a.window_id.localeCompare(b.window_id));
  }

  const sorted = [...windows].sort((a, b) => a.start_seconds - b.start_seconds || a.window_id.localeCompare(b.window_id));
  const usedIndexes = new Set<number>();
  const selected: SocialReelsDurationWindow[] = [];

  for (let index = 0; index < targetCount; index += 1) {
    const desiredIndex = targetCount === 1 ? 0 : Math.round((index * (sorted.length - 1)) / (targetCount - 1));
    const chosenIndex = chooseNearestUnusedIndex(sorted.length, desiredIndex, usedIndexes);
    if (chosenIndex === null) break;
    usedIndexes.add(chosenIndex);
    selected.push(sorted[chosenIndex]);
  }

  return selected.sort((a, b) => a.start_seconds - b.start_seconds || a.window_id.localeCompare(b.window_id));
}

function findSegment(input: SocialReelsRequest, segmentId: string) {
  return input.segments.find((segment) => segment.id === segmentId || segment.segment_id === segmentId) || null;
}

function trimExcerpt(text: string, maxChars: number) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= maxChars) return compact;
  return compact.slice(0, maxChars).replace(/\s+\S*$/, "").trim();
}

function windowTextExcerpt(input: SocialReelsRequest, window: SocialReelsDurationWindow, maxChars = SOCIAL_REELS_LIVE_WINDOW_EXCERPT_CHARS) {
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

export function buildSocialReelsLivePromptWindows(
  input: SocialReelsRequest,
  windows: SocialReelsDurationWindow[]
): SocialReelsPromptDurationWindow[] {
  return windows
    .map((window) => ({
      ...window,
      text_excerpt: windowTextExcerpt(input, window),
    }))
    .filter((window) => window.text_excerpt.length > 0);
}

export function estimateSocialReelsPromptWindowCharCount(windows: SocialReelsPromptDurationWindow[]) {
  return JSON.stringify(windows).length;
}
