import { isAppPlanId, type AppPlanId } from "@/lib/plans";

const SOURCE_RE = /^[a-z0-9_-]{1,40}$/i;

export function sanitizeStartSource(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return SOURCE_RE.test(trimmed) ? trimmed : null;
}

export function sanitizeStartPlan(value: unknown): AppPlanId | null {
  return isAppPlanId(value) ? value : null;
}

export function sanitizeInternalPath(value: unknown) {
  if (typeof value !== "string") return "/pricing";
  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) return "/pricing";
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return "/pricing";
  try {
    const parsed = new URL(trimmed, "https://cutswitch.local");
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return "/pricing";
  }
}

export function buildTrialRedirectPath(input: {
  plan?: unknown;
  source?: unknown;
  next?: unknown;
}) {
  const plan = sanitizeStartPlan(input.plan);
  const source = sanitizeStartSource(input.source);
  const params = new URLSearchParams();

  if (plan) params.set("plan", plan);
  if (source) params.set("source", source);

  if (plan) return `/pricing?${params.toString()}`;

  return source ? `/pricing?source=${encodeURIComponent(source)}` : "/pricing";
}

export function buildAuthCallbackPath(input: {
  plan?: unknown;
  source?: unknown;
  next?: unknown;
}) {
  const params = new URLSearchParams();
  const plan = sanitizeStartPlan(input.plan);
  const source = sanitizeStartSource(input.source);

  if (plan) params.set("plan", plan);
  if (source) params.set("source", source);

  const query = params.toString();
  return query ? `/auth/callback?${query}` : "/auth/callback";
}
