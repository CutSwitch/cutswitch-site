"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useSupabaseSession } from "@/components/auth/useSupabaseSession";
import { APP_PLANS, APP_PLAN_IDS, isAppPlanId, type AppPlanId } from "@/lib/plans";
import { cn } from "@/lib/utils";

type PricingTableProps = {
  embedded?: boolean;
};

const PLAN_FEATURE_COPY: Record<AppPlanId, { features: string[]; billingNote: string }> = {
  starter: {
    features: [
      "4 trial hours included",
      "15 hours of editing/month after trial",
      "Built for a weekly podcast cadence",
      "Speaker-based multicam switching",
      "Editable Final Cut timelines",
      "Cancel anytime",
    ],
    billingNote: "Then $29/month unless canceled.",
  },
  creator_pro: {
    features: [
      "4 trial hours included",
      "50 hours of editing/month after trial",
      "Room for 25+ podcast or event edits/month",
      "Better fit for roundtables and multi-speaker shows",
      "Built for client and full-time creator workflows",
      "Cancel anytime",
    ],
    billingNote: "Then $79/month unless canceled.",
  },
  studio: {
    features: [
      "4 trial hours included",
      "120 hours of editing/month after trial",
      "High-volume podcast, interview, and event workflows",
      "More editing time for production teams",
      "Built for teams and agencies",
      "Cancel anytime",
    ],
    billingNote: "Then $149/month unless canceled.",
  },
};

function getPriceParts(priceLabel: string) {
  const [price] = priceLabel.split("/");
  return { price, cadence: "/ month" };
}

export function PricingTable({ embedded = false }: PricingTableProps) {
  const router = useRouter();
  const { session, user, loading: authLoading } = useSupabaseSession();
  const [loading, setLoading] = useState<AppPlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoStarted = useRef(false);

  async function startCheckout(planId: AppPlanId) {
    setError(null);

    if (!user || !session?.access_token) {
      router.push(`/login?next=/pricing&plan=${planId}`);
      return;
    }

    setLoading(planId);

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ planId }),
      });

      const data = (await res.json().catch(() => ({}))) as { checkoutUrl?: string; error?: string };

      if (!res.ok || !data.checkoutUrl) {
        throw new Error(data.error || "Unable to start checkout.");
      }

      window.location.href = data.checkoutUrl;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoading(null);
    }
  }

  useEffect(() => {
    if (autoStarted.current || authLoading || !user) return;
    const plan = new URLSearchParams(window.location.search).get("plan");
    if (!isAppPlanId(plan)) return;

    autoStarted.current = true;
    void startCheckout(plan);
  }, [authLoading, user]);

  return (
    <div className={cn("w-full pricing-block", embedded ? "pricing-block--embedded" : "")}>
      <div className={cn("container-edge relative z-10", embedded ? "pt-14 pb-4 sm:pt-16 sm:pb-6" : "py-10")}>
        <div className="mb-6">
          <h2 className="text-3xl font-semibold tracking-tight text-white">Pricing</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/65">
            Every plan starts with a 7-day free trial.
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/60">
            Your trial includes 4 hours of editing. After 7 days, your selected plan begins unless canceled.
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
            Editing time is based on the length of your source footage.
          </p>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="grid items-stretch gap-4 lg:grid-cols-3">
          {APP_PLAN_IDS.map((planId) => {
            const plan = APP_PLANS[planId];
            const price = getPriceParts(plan.priceLabel);
            const featureCopy = PLAN_FEATURE_COPY[plan.id];
            return (
              <div
                key={plan.id}
                className={cn(
                  "relative overflow-hidden rounded-2xl border border-line bg-surface-2 p-6 transition hover:-translate-y-0.5 hover:border-white/20",
                  plan.featured
                    ? "border-brand/60 bg-[linear-gradient(180deg,rgba(112,92,255,0.14),rgba(18,20,34,0.72))] shadow-[0_24px_80px_rgba(112,92,255,0.18)] ring-1 ring-brand/60"
                    : ""
                )}
              >
                <div className="pointer-events-none absolute inset-0 bg-card-sheen opacity-35" />
                <div className="relative flex h-full flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-light">
                      {plan.audience}
                    </div>
                    {plan.featured ? (
                      <div className="shrink-0 rounded-full border border-brand/30 bg-brand/15 px-2 py-1 text-[11px] font-medium text-white/85">
                        Most popular
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-7 text-4xl font-semibold leading-none tracking-tight text-white sm:text-5xl">
                    {plan.name}
                  </div>
                  <div className="mt-3 flex items-end gap-3">
                    <div className="text-4xl font-semibold leading-none tracking-tight text-white/70">{price.price}</div>
                    <div className="pb-1 text-sm leading-tight text-white/50">{price.cadence}</div>
                  </div>
                  <div className="mt-4 w-fit rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-100">
                    7-day free trial included
                  </div>

                  <div className="my-7 h-px bg-white/10" />

                  <p className="min-h-[72px] text-base leading-relaxed text-white/70">{plan.description}</p>

                  <div className="my-7 h-px bg-white/10" />

                  <ul className="mt-4 space-y-3 text-sm leading-relaxed text-white/68">
                    {featureCopy.features.map((feature) => (
                      <li key={feature} className="flex gap-3">
                        <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-light/80 shadow-[0_0_16px_rgba(136,153,255,0.45)]" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-8">
                    <button
                      onClick={() => startCheckout(plan.id)}
                      disabled={loading !== null}
                      className={cn("btn w-full", plan.featured ? "btn-primary" : "btn-secondary")}
                    >
                      {loading === plan.id ? "Starting..." : "Start Free Trial"}
                    </button>
                    <p className="mt-3 text-center text-xs text-white/50">{featureCopy.billingNote}</p>
                  </div>

                  <div className="mt-3 text-xs leading-relaxed text-white/55">
                    By starting a trial, you agree to our{" "}
                    <Link className="underline" href="/terms">
                      Terms
                    </Link>{" "}
                    and{" "}
                    <Link className="underline" href="/privacy">
                      Privacy Policy
                    </Link>
                    .
                    <span className="block">Billing begins after your trial unless canceled.</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className={cn("relative overflow-hidden rounded-2xl border border-line bg-surface-2 p-6", embedded ? "mt-8" : "mt-10")}>
          <div className="pointer-events-none absolute inset-0 bg-card-sheen opacity-35" />
          <div className="relative">
            <div className="text-lg font-semibold text-white">How editing time works</div>
            <p className="mt-2 text-sm text-white/65">
              Editing time is based on the length of your source footage, not the time CutSwitch takes to process it. A 60-minute multicam edit uses 60 minutes of editing time. Reused transcripts do not count again.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/support" className="btn btn-secondary">
                Contact Support
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PricingTable;
