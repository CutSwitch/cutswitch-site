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

const MONTHLY_PRICE = 14.49;
const YEARLY_PRICE = 100;
const LIFETIME_PRICE = 200;

function computeYearlySavePercent(): number {
  const annualMonthly = MONTHLY_PRICE * 12;
  const save = 1 - YEARLY_PRICE / annualMonthly;
  return Math.round(save * 100);
}

export function PricingTable() {
  const referral = useRewardfulReferral();

  const savePct = useMemo(() => computeYearlySavePercent(), []);

  const plans: Plan[] = useMemo(
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
          `Save ${savePct}% vs monthly`,
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
    [savePct]
  );

  const [coupon, setCoupon] = useState("");
  const [ack, setAck] = useState(false);
  const [loading, setLoading] = useState<PlanKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(plan: PlanKey) {
    setError(null);

    if (!ack) {
      setError("Please acknowledge the no-refunds policy to continue.");
      return;
    }

    try {
      setLoading(plan);
      const res = await fetch("/api/checkout/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          couponCode: coupon || undefined,
          referral: referral || undefined,
          acknowledgedNoRefunds: true,
        }),
      });

      const data = (await res.json()) as { url?: string; error?: string };

      if (!res.ok || !data.url) {
        throw new Error(data.error || "Unable to start checkout. Please try again.");
      }

      window.location.href = data.url;
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="grid gap-8">
      <div className="card p-5 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-white/90">Coupon or affiliate code</div>
            <p className="mt-1 text-xs text-white/60">
              Codes are optional. You can also enter a promotion code inside Stripe Checkout.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 md:w-[420px]">
            <div className="flex gap-2">
              <input
                value={coupon}
                onChange={(e) => setCoupon(e.target.value)}
                placeholder="Enter code (optional)"
                className={cn(
                  "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90",
                  "placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-brand/50"
                )}
              />
              <Link className="btn btn-secondary shrink-0" href="/affiliates">
                Become an affiliate
              </Link>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-white/70">
              <input
                id="ack"
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/10 text-brand focus:ring-brand/60"
              />
              <label htmlFor="ack" className="leading-relaxed">
                I understand CutSwitch purchases are{" "}
                <span className="text-white/90 font-semibold">final</span> and we{" "}
                <span className="text-white/90 font-semibold">do not offer refunds</span>. If I have issues, I will contact{" "}
                <Link className="underline decoration-white/20 hover:decoration-white/60" href="/support">
                  Support
                </Link>
                .
              </label>
            </div>

            {referral ? (
              <div className="text-xs text-brand-highlight">
                Affiliate attribution detected. Your referral will be credited.
              </div>
            ) : (
              <div className="text-xs text-white/45">
                Tip: affiliates link you in, Rewardful tracks, Stripe closes. Clean chain.
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.key}
            className={cn(
              "relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6",
              p.featured ? "ring-brand" : "",
              "transition hover:-translate-y-0.5 hover:border-white/20"
            )}
          >
            {p.featured && (
              <div className="absolute right-4 top-4 chip">
                <span className="text-brand-highlight">Best value</span>
              </div>
            )}

            <div className="text-sm font-semibold text-white/90">{p.name}</div>
            <div className="mt-3 flex items-end gap-2">
              <div className="text-4xl font-semibold tracking-tight">{p.priceLabel}</div>
              <div className="pb-1 text-xs text-white/55">{p.priceNote}</div>
            </div>

            <ul className="mt-5 space-y-2 text-sm text-white/70">
              {p.highlights.map((h) => (
                <li key={h} className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-brand/80" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>

            <button
              className={cn(
                "mt-6 w-full btn",
                p.featured ? "btn-primary" : "btn-secondary",
                loading === p.key ? "opacity-70 cursor-not-allowed" : ""
              )}
              onClick={() => startCheckout(p.key)}
              disabled={loading !== null}
            >
              {loading === p.key ? "Opening checkout…" : p.cta}
            </button>

            <p className="mt-3 text-xs text-white/50">
              By purchasing, you agree to our{" "}
              <Link className="underline decoration-white/20 hover:decoration-white/60" href="/terms">
                Terms
              </Link>{" "}
              and{" "}
              <Link className="underline decoration-white/20 hover:decoration-white/60" href="/privacy">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        ))}
      </div>

      <div className="card p-6">
        <div className="text-sm font-semibold text-white/90">Questions before you buy?</div>
        <p className="mt-2 text-sm text-white/65">
          We do not do refunds, but we do fix problems fast. If something feels off, reach out and we will help you
          get running.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Link className="btn btn-secondary" href="/support">
            Contact Support
          </Link>
          <Link className="btn btn-ghost" href="/refunds">
            No-refunds policy
          </Link>
        </div>
      </div>
    </div>
  );
}
