import { getBaseUrl } from "@/lib/env";
import { rateLimit, type RateLimitResult } from "@/lib/rateLimit";
import { getIpHash, hashToken } from "@/lib/request";

export const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

export function noStoreJson(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

export function isEnabledEnv(name: string) {
  return process.env[name]?.trim().toLowerCase() === "true";
}

export function hashRateLimitValue(value: string) {
  return hashToken(value.trim().toLowerCase());
}

export async function safeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  scope: string
): Promise<RateLimitResult> {
  try {
    return await rateLimit(key, limit, windowSeconds);
  } catch (error) {
    console.warn(`[security:${scope}] rate limit unavailable`, {
      message: error instanceof Error ? error.message : "unknown",
    });
    return { allowed: true, remaining: limit, limit, reset_seconds: windowSeconds };
  }
}

export async function enforceRateLimit(
  req: Request,
  keyParts: Array<string | null | undefined>,
  limit: number,
  windowSeconds: number,
  scope: string
) {
  const ipHash = getIpHash(req);
  const key = ["rl", scope, `ip:${ipHash}`, ...keyParts.filter(Boolean)].join(":");
  const rl = await safeRateLimit(key, limit, windowSeconds, scope);
  if (rl.allowed) return null;

  return Response.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        ...NO_STORE_HEADERS,
        "Retry-After": String(Math.max(1, rl.reset_seconds ?? 60)),
      },
    }
  );
}

function getTrustedOrigins(req: Request) {
  const origins = new Set<string>();
  const configured = getBaseUrl();
  try {
    origins.add(new URL(configured).origin);
  } catch {
    // Ignore malformed deploy env values here; getBaseUrl consumers will surface it elsewhere.
  }

  const host = req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (host) origins.add(`${proto}://${host}`);

  return origins;
}

export function hasSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const candidate = origin || referer;

  // Non-browser callers often omit these headers. Only reject explicit cross-origin browser requests.
  if (!candidate) return true;

  try {
    const candidateOrigin = new URL(candidate).origin;
    return getTrustedOrigins(req).has(candidateOrigin);
  } catch {
    return false;
  }
}

export function requireSameOrigin(req: Request) {
  if (hasSameOrigin(req)) return null;
  return Response.json(
    { error: "Cross-origin request denied." },
    { status: 403, headers: NO_STORE_HEADERS }
  );
}
