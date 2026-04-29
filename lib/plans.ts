export type AppPlanId = "starter" | "creator_pro" | "studio";

export const APP_PLAN_IDS = ["starter", "creator_pro", "studio"] as const;

export type AppPlan = {
  id: AppPlanId;
  name: string;
  priceLabel: string;
  transcriptHours: number;
  audience: string;
  description: string;
  featured?: boolean;
};

export const APP_PLANS: Record<AppPlanId, AppPlan> = {
  starter: {
    id: "starter",
    name: "Starter",
    priceLabel: "$29/mo",
    transcriptHours: 15,
    audience: "For weekly shows",
    description: "For podcasters publishing consistently without spending hours angle-switching.",
  },
  creator_pro: {
    id: "creator_pro",
    name: "Pro",
    priceLabel: "$79/mo",
    transcriptHours: 50,
    audience: "For full-time creators",
    description: "For creators, editors, and producers turning around many multi-speaker edits each month.",
    featured: true,
  },
  studio: {
    id: "studio",
    name: "Studio",
    priceLabel: "$149/mo",
    transcriptHours: 120,
    audience: "For teams & agencies",
    description: "For teams handling high-volume podcasts, roundtables, interviews, and client productions.",
  },
};

export function isAppPlanId(value: unknown): value is AppPlanId {
  return APP_PLAN_IDS.includes(value as AppPlanId);
}

export function getAppPlan(planId: string | null | undefined) {
  return isAppPlanId(planId) ? APP_PLANS[planId] : null;
}
