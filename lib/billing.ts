import { PlanKey } from "@/lib/site";
import { stripe, getStripePrices } from "@/lib/stripe";

export type CheckoutPlan = {
  key: PlanKey;
  label: string;
  mode: "subscription" | "payment";
  priceId: string;
  trialDays: number;
};

export function getTrialDays(): number {
  const raw = process.env.TRIAL_DAYS;
  const parsed = raw ? Number(raw) : 7;
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 60) return 7;
  return Math.floor(parsed);
}

export function getCheckoutPlan(key: PlanKey): CheckoutPlan {
  const prices = getStripePrices();
  const trialDays = getTrialDays();

  if (key === "lifetime") {
    return { key, label: "Lifetime", mode: "payment", priceId: prices.lifetime, trialDays: 0 };
  }

  if (key === "monthly") {
    return { key, label: "Monthly", mode: "subscription", priceId: prices.monthly, trialDays };
  }

  return { key, label: "Yearly", mode: "subscription", priceId: prices.yearly, trialDays };
}

export async function findPromotionCodeId(code: string): Promise<string | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;

  const list = await stripe.promotionCodes.list({
    code: trimmed,
    active: true,
    limit: 1,
  });

  const promo = list.data[0];
  return promo?.id || null;
}
