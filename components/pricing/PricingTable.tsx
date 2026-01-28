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
type PricingTableProps = {
  /** Use tighter spacing when PricingTable is embedded inside another section (e.g. home page final act). */
  embedded?: boolean;
};

export function PricingTable({ embedded = false }: PricingTableProps) {
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

  const Heading = embedded ? "h2" : "h1";

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
      const res = await fetch("/api/checkout/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          couponCode: coupon?.trim() || undefined,
          referral: referralId,
          acknowledgedNoRefunds: ack,
        }),
      });

      // Robust parsing: API should return JSON, but on misroutes or errors
      // it may return empty/HTML. Handle gracefully so UI shows a real error.
      const raw = await res.text();
      let data: { url?: string; error?: string } = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = {};
      }

      if (!res.ok || !data.url) {
        throw new Error(
          data.error ||
            (raw?.slice(0, 140) ? `Checkout error: ${raw.slice(0, 140)}` : "Unable to start checkout.")
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
    <div
      className={cn(
        "w-full pricing-block relative isolate overflow-hidden",
        embedded ? "pricing-block--embedded" : ""
      )}
    >
      <div
        className={cn(
          "container-edge relative z-10",
          embedded ? "pt-14 pb-4 sm:pt-16 sm:pb-6" : "py-10"
        )}
      >
        <div className={cn(embedded ? "mb-7" : "mb-8")}>
          <Heading className="text-3xl font-semibold tracking-tight text-white">Pricing</Heading>
          <p className="mt-2 text-sm text-white/70">
            Simple plans. Serious speed.
          </p>
          <p className="mt-2 text-sm text-white/70">
            Subscriptions include a 7-day free trial. Taxes are calculated
            automatically with Stripe Tax. All purchases are final: no refunds.
          </p>
        </div>

        <div className="relative mb-6 overflow-hidden rounded-2xl border border-line bg-surface-2 p-6">
          <div className="pointer-events-none absolute inset-0 bg-card-sheen opacity-40" />
          <div className="relative">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-sm font-medium">Coupon code</div>
            <Link href="/affiliates" className="text-sm text-brand-highlight hover:text-white">
              Become an affiliate
            </Link>
          </div>

          <p className="mt-1 text-sm text-white/65">
            Codes are optional. You can also enter a promotion code inside Stripe
            Checkout.
          </p>

          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
            <input
              value={coupon}
              onChange={(e) => setCoupon(e.target.value)}
              placeholder="Enter code"
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/90 placeholder:text-white/40 outline-none focus:border-white/20 md:max-w-sm"
            />
            <label className="flex items-start gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-white/20 bg-black/30 text-brand focus:ring-brand/70"
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

          <div className="mt-2 text-xs text-white/55">
            Tip: affiliates link you in, Rewardful tracks, Stripe closes. Clean
            chain.
          </div>

          {error ? (
            <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          ) : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.key}
              className={cn(
                "relative overflow-hidden rounded-2xl border border-line bg-surface-2 p-6 transition hover:-translate-y-0.5 hover:border-white/20",
                p.featured ? "border-brand/40 ring-brand" : ""
              )}
            >
              <div className="pointer-events-none absolute inset-0 bg-card-sheen opacity-35" />
              <div className="relative">
              {p.featured ? (
                <div className="mb-3 inline-flex rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium text-white/80">
                  Best value
                </div>
              ) : null}

              <div className="text-lg font-semibold">{p.name}</div>
              <div className="mt-2 text-4xl font-semibold tracking-tight">
                {p.priceLabel}
              </div>
              <div className="mt-1 text-sm text-white/65">
                {p.priceNote}
              </div>

              <ul className="mt-4 space-y-2 text-sm text-white/70">
                {p.highlights.map((h) => (
                  <li key={h} className="flex gap-2">
                    <span className="mt-[2px] inline-block h-4 w-4 rounded-full bg-white/5 ring-1 ring-white/10" />
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
                    ? "btn btn-primary"
                    : "btn btn-secondary"
                )}
              >
                {loading === p.key ? "Starting…" : p.cta}
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
          ))}
        </div>

        <div
          className={cn(
            "relative overflow-hidden rounded-2xl border border-line bg-surface-2 p-6",
            embedded ? "mt-8" : "mt-10"
          )}
        >
          <div className="pointer-events-none absolute inset-0 bg-card-sheen opacity-35" />
          <div className="relative">
          <div className="text-lg font-semibold">Questions before you buy?</div>
          <p className="mt-2 text-sm text-white/65">
            We do not do refunds, but we do fix problems fast. If something feels
            off, reach out and we will help you get running.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/support"
              className="btn btn-secondary"
            >
              Contact Support
            </Link>
            <Link
              href="/refunds"
              className="btn btn-ghost"
            >
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