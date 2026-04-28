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
    audience: "For solo podcasters",
    description: "Enough room for a steady solo show or interview workflow.",
  },
  creator_pro: {
    id: "creator_pro",
    name: "Creator Pro",
    priceLabel: "$79/mo",
    transcriptHours: 50,
    audience: "For weekly creators/editors",
    description: "Built for regular releases and client edits without angle-chasing.",
    featured: true,
  },
  studio: {
    id: "studio",
    name: "Studio",
    priceLabel: "$149/mo",
    transcriptHours: 120,
    audience: "For teams/agencies",
    description: "More transcript hours for high-volume teams and agencies.",
  },
};

export function isAppPlanId(value: unknown): value is AppPlanId {
  return APP_PLAN_IDS.includes(value as AppPlanId);
}

export function getAppPlan(planId: string | null | undefined) {
  return isAppPlanId(planId) ? APP_PLANS[planId] : null;
}
