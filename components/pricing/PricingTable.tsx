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

export function PricingTable({ embedded = false }: PricingTableProps) {
  const router = useRouter();
  const { session, user, loading: authLoading } = useSupabaseSession();
  const [ack, setAck] = useState(true);
  const [loading, setLoading] = useState<AppPlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoStarted = useRef(false);

  async function startCheckout(planId: AppPlanId) {
    if (!ack) {
      setError("Please acknowledge the no-refunds policy before continuing.");
      return;
    }

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
            Start with included trial transcript minutes. Transcript hours reset monthly.
          </p>
        </div>

        <div className="relative mb-6 overflow-hidden rounded-2xl border border-line bg-surface-2 p-6 sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-card-sheen opacity-40" />
          <div className="relative">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-4 text-base font-medium leading-relaxed text-white/90 sm:p-5 sm:text-lg">
              <input
                type="checkbox"
                checked={ack}
                onChange={(event) => setAck(event.target.checked)}
                className="mt-1 h-5 w-5 rounded border-white/20 bg-black/30 text-brand focus:ring-brand/70 sm:h-6 sm:w-6"
              />
              <span>
                I understand CutSwitch purchases are final and we do not offer refunds. If I have issues, I will contact{" "}
                <Link className="underline" href="/support">
                  Support
                </Link>
                .
              </span>
            </label>

            {error ? (
              <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {APP_PLAN_IDS.map((planId) => {
            const plan = APP_PLANS[planId];
            return (
              <div
                key={plan.id}
                className={cn(
                  "relative overflow-hidden rounded-2xl border border-line bg-surface-2 p-6 transition hover:-translate-y-0.5 hover:border-white/20",
                  plan.featured ? "border-brand/40 ring-brand" : ""
                )}
              >
                <div className="pointer-events-none absolute inset-0 bg-card-sheen opacity-35" />
                <div className="relative flex h-full flex-col">
                  {plan.featured ? (
                    <div className="mb-3 inline-flex w-fit rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium text-white/80">
                      Most popular
                    </div>
                  ) : null}

                  <div className="text-lg font-semibold text-white">{plan.name}</div>
                  <div className="mt-2 text-4xl font-semibold tracking-tight text-white">{plan.priceLabel}</div>
                  <div className="mt-1 text-sm text-white/65">{plan.audience}</div>

                  <ul className="mt-5 space-y-2 text-sm text-white/70">
                    <li className="flex gap-2">
                      <span className="mt-[2px] inline-block h-4 w-4 rounded-full bg-white/5 ring-1 ring-white/10" />
                      <span>{plan.transcriptHours} transcript hours/month</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-[2px] inline-block h-4 w-4 rounded-full bg-white/5 ring-1 ring-white/10" />
                      <span>{plan.description}</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-[2px] inline-block h-4 w-4 rounded-full bg-white/5 ring-1 ring-white/10" />
                      <span>Editable Final Cut timelines</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-[2px] inline-block h-4 w-4 rounded-full bg-white/5 ring-1 ring-white/10" />
                      <span>Cancel anytime</span>
                    </li>
                  </ul>

                  <button
                    onClick={() => startCheckout(plan.id)}
                    disabled={loading !== null}
                    className={cn("btn mt-6 w-full", plan.featured ? "btn-primary" : "btn-secondary")}
                  >
                    {loading === plan.id ? "Starting..." : user ? "Choose plan" : "Log in to start"}
                  </button>

                  <div className="mt-3 text-xs text-white/55">
                    By purchasing, you agree to our{" "}
                    <Link className="underline" href="/terms">
                      Terms
                    </Link>{" "}
                    and{" "}
                    <Link className="underline" href="/privacy">
                      Privacy Policy
                    </Link>
                    .
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className={cn("relative overflow-hidden rounded-2xl border border-line bg-surface-2 p-6", embedded ? "mt-8" : "mt-10")}>
          <div className="pointer-events-none absolute inset-0 bg-card-sheen opacity-35" />
          <div className="relative">
            <div className="text-lg font-semibold text-white">How transcript hours work</div>
            <p className="mt-2 text-sm text-white/65">
              Transcript hours are used only when CutSwitch creates a new transcript. Reused transcripts do not count again.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/support" className="btn btn-secondary">
                Contact Support
              </Link>
              <Link href="/refunds" className="btn btn-ghost">
                No-refunds policy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PricingTable;
