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
  const maxWindows = Math.max(effectiveCandidateCount * 3, 12);
  const windows: SocialReelsDurationWindow[] = [];

  for (const bucket of buckets) {
    const targetDuration = liveWindowTargetDurationSeconds(bucket);
    const range = getSocialReelsLiveDurationRange(bucket);

    for (const segment of input.segments) {
      if (windows.length >= maxWindows) break;

      const segmentDuration = Math.max(0, segment.end_seconds - segment.start_seconds);
      if (segmentDuration < range.min) continue;

      const durationSeconds = Math.min(targetDuration, segmentDuration);
      if (!durationFitsSocialReelsLiveBucket(bucket, durationSeconds)) continue;

      const words = cleanWords(segment.text);
      if (words.length < 24) continue;

      const secondsPerToken = segmentDuration / Math.max(1, words.length - 1);
      for (const offset of uniqueWindowOffsets(segmentDuration, durationSeconds)) {
        if (windows.length >= maxWindows) break;

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
