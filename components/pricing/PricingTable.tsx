"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn, formatUsd } from "@/lib/utils";
import { PlanKey } from "@/lib/site";
import { useRewardfulReferral } from "@/components/rewardful/useRewardfulReferral";

type Plan = {
  key: PlanKey;
  name: string;
  priceLabel: string;
  priceNote: string;
  highlights: string[];
  featured?: boolean;
  cta: string;
};

const MONTHLY_PRICE = 19.99;
const YEARLY_PRICE = 199;
const LIFETIME_PRICE = 299;

/**
 * NOTE:
 * We intentionally export BOTH:
 *  - named export: { PricingTable }
 *  - default export: PricingTable
 * so existing imports like `import { PricingTable } from ...` keep working,
 * and default imports also work.
 */
export function PricingTable() {
  const plans = useMemo<Plan[]>(
    () => [
      {
        key: "monthly",
        name: "Monthly",
        priceLabel: `${formatUsd(MONTHLY_PRICE)}`,
        priceNote: "per month, billed monthly",
        highlights: [
          "7-day free trial (card required)",
          "All core features",
          "License for 2 Macs",
          "Cancel anytime",
          "Stripe Tax calculated at checkout",
        ],
        cta: "Start trial",
      },
      {
        key: "yearly",
        name: "Yearly",
        priceLabel: `${formatUsd(YEARLY_PRICE)}`,
        priceNote: "per year, billed annually",
        highlights: [
          "Save vs monthly",
          "7-day free trial (card required)",
          "All core features",
          "License for 2 Macs",
          "Priority support",
        ],
        featured: true,
        cta: "Start trial",
      },
      {
        key: "lifetime",
        name: "Lifetime",
        priceLabel: `${formatUsd(LIFETIME_PRICE)}`,
        priceNote: "one-time purchase",
        highlights: [
          "Pay once, use forever",
          "All core features",
          "License for 2 Macs",
          "Includes major updates",
          "Stripe Tax calculated at checkout",
        ],
        cta: "Buy lifetime",
      },
    ],
    []
  );

  const referral = useRewardfulReferral();
  const [coupon, setCoupon] = useState("");
  const [ack, setAck] = useState(true);
  const [loading, setLoading] = useState<PlanKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(plan: PlanKey) {
    if (!ack) {
      setError("Please acknowledge the no-refunds policy before continuing.");
      return;
    }

    setError(null);
    setLoading(plan);

    // Rewardful referral can be either a string (common) or an object with an `id`.
    // Normalize it to a clean string or undefined.
    const referralIdRaw =
      typeof referral === "string" ? referral : (referral as any)?.id;
    const referralId =
      typeof referralIdRaw === "string"
        ? referralIdRaw.trim() || undefined
        : undefined;

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          // Keep coupon captured for later wiring; currently optional UI-only.
          coupon: coupon?.trim() || undefined,
          referralId,
        }),
      });

      const data = (await res.json()) as { url?: string; error?: string };

      if (!res.ok || !data.url) {
        throw new Error(
          data.error || "Unable to start checkout. Please try again."
        );
      }

      window.location.href = data.url;
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="w-full">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Pricing</h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
            Simple plans. Serious speed.
          </p>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
            Subscriptions include a 7-day free trial. Taxes are calculated
            automatically with Stripe Tax. All purchases are final: no refunds.
          </p>
        </div>

        <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-sm font-medium">Coupon or affiliate code</div>
            <Link
              href="/affiliates"
              className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Become an affiliate
            </Link>
          </div>

          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
            Codes are optional. You can also enter a promotion code inside Stripe
            Checkout.
          </p>

          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
            <input
              value={coupon}
              onChange={(e) => setCoupon(e.target.value)}
              placeholder="Enter code"
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:focus:border-neutral-700 md:max-w-sm"
            />
            <label className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-200">
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-600 dark:border-neutral-700"
              />
              <span>
                I understand CutSwitch purchases are final and we do not offer
                refunds. If I have issues, I will contact{" "}
                <Link className="underline" href="/support">
                  Support
                </Link>
                .
              </span>
            </label>
          </div>

          <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            Tip: affiliates link you in, Rewardful tracks, Stripe closes. Clean
            chain.
          </div>

          {error ? (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.key}
              className={cn(
                "rounded-2xl border bg-white p-6 shadow-sm dark:bg-neutral-950",
                p.featured
                  ? "border-indigo-200 ring-1 ring-indigo-200 dark:border-indigo-900/50 dark:ring-indigo-900/50"
                  : "border-neutral-200 dark:border-neutral-800"
              )}
            >
              {p.featured ? (
                <div className="mb-3 inline-flex rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                  Best value
                </div>
              ) : null}

              <div className="text-lg font-semibold">{p.name}</div>
              <div className="mt-2 text-4xl font-semibold tracking-tight">
                {p.priceLabel}
              </div>
              <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                {p.priceNote}
              </div>

              <ul className="mt-4 space-y-2 text-sm text-neutral-700 dark:text-neutral-200">
                {p.highlights.map((h) => (
                  <li key={h} className="flex gap-2">
                    <span className="mt-[2px] inline-block h-4 w-4 rounded-full bg-neutral-100 dark:bg-neutral-900" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => startCheckout(p.key)}
                disabled={loading !== null}
                className={cn(
                  "mt-6 w-full rounded-xl px-4 py-2 text-sm font-medium",
                  p.featured
                    ? "bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
                    : "bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-60 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                )}
              >
                {loading === p.key ? "Starting…" : p.cta}
              </button>

              <div className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
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
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <div className="text-lg font-semibold">Questions before you buy?</div>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
            We do not do refunds, but we do fix problems fast. If something feels
            off, reach out and we will help you get running.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/support"
              className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Contact Support
            </Link>
            <Link
              href="/refunds"
              className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-900"
            >
              No-refunds policy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PricingTable;