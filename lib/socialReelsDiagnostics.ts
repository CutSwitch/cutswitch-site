import { type z } from "zod";

export type SafeSocialReelsOutputShape = {
  type: string;
  has_candidates_array: boolean;
  candidate_count: number | null;
  first_candidate_keys: string[];
};

function valueType(value: unknown) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

export function summarizeSocialReelsOutputShape(value: unknown): SafeSocialReelsOutputShape {
  const type = valueType(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      type,
      has_candidates_array: false,
      candidate_count: null,
      first_candidate_keys: [],
    };
  }

  const record = value as Record<string, unknown>;
  const candidates = record.candidates;
  const firstCandidate =
    Array.isArray(candidates) && candidates[0] && typeof candidates[0] === "object" && !Array.isArray(candidates[0])
      ? (candidates[0] as Record<string, unknown>)
      : null;

  return {
    type,
    has_candidates_array: Array.isArray(candidates),
    candidate_count: Array.isArray(candidates) ? candidates.length : null,
    first_candidate_keys: firstCandidate ? Object.keys(firstCandidate).sort().slice(0, 80) : [],
  };
}

export function getSafeZodIssueSummary(error: z.ZodError) {
  return error.issues.slice(0, 20).map((issue) => ({
    path: issue.path.map(String).join("."),
    code: issue.code,
  }));
}
