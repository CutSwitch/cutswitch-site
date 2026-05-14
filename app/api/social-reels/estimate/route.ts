export const runtime = "nodejs";

import { readJsonBody } from "@/lib/request";
import { enforceRateLimit, noStoreJson } from "@/lib/security";
import {
  estimateSocialReelsDurationFirstCredits,
  socialReelsCreditEstimateRequestSchema,
} from "@/lib/socialReelsCreditEstimator";

const MAX_BODY_BYTES = 16 * 1024;

export async function POST(req: Request) {
  const rateLimited = await enforceRateLimit(req, [], 120, 60 * 60, "social_reels_credit_estimate_ip");
  if (rateLimited) return rateLimited;

  const parsedBody = await readJsonBody(req, MAX_BODY_BYTES);
  if (!parsedBody.ok) {
    return noStoreJson({ error: parsedBody.message || "Invalid request." }, parsedBody.status);
  }

  const parsed = socialReelsCreditEstimateRequestSchema.safeParse(parsedBody.data);
  if (!parsed.success) {
    return noStoreJson(
      {
        error: "Invalid social reels credit estimate payload",
        issues: parsed.error.issues.slice(0, 12).map((issue) => ({
          path: issue.path.map((part) => String(part)).join("."),
          code: issue.code,
        })),
      },
      400
    );
  }

  return noStoreJson(estimateSocialReelsDurationFirstCredits(parsed.data));
}
