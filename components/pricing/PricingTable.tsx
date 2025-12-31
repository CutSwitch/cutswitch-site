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

export function PricingTable({ className }: { className?: string }) {
  const referral = useRewardfulReferral();

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
        name: "Annual",
        priceLabel: `${formatUsd(YEARLY_PRICE)}`,
        priceNote: "per year, billed annually",
        highlights: [
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

  const [ack, setAck] = useState(false);
  const [coupon, setCoupon] = useState(""); // ✅ FIX: define coupon state
  const [loading, setLoading] = useState<PlanKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(plan: PlanKey) {
    if (!ack) {
      setError("Please acknowledge the no-refunds policy before continuing.");
      return;
    }

    setError(null);
    setLoading(plan);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          // Keep coupon captured for later wiring; currently optional UI-only.
          coupon: coupon?.trim() || undefined,
          referralId: referral?.id || undefined,
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
    <div className={cn("grid gap-8", className)}>
      <div className="card p-5 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-white/90">Coupon code</div>
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
                className="mt-0.5"
              />
              <label htmlFor="ack" className="leading-relaxed">
                I understand CutSwitch purchases are final and we do not offer refunds. If I have
                issues, I will contact <Link className="underline" href="/support">Support</Link>.
              </label>
            </div>

            {error ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {error}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.key}
            className={cn(
              "card p-6",
              p.featured ? "ring-1 ring-brand/40" : undefined
            )}
          >
            {p.featured ? (
              <div className="chip w-fit">
                <span className="text-brand-highlight">Best value</span>
              </div>
            ) : null}

            <div className="mt-3 text-sm font-semibold text-white/90">{p.name}</div>
            <div className="mt-2 text-4xl font-semibold text-white">{p.priceLabel}</div>
            <div className="mt-2 text-sm text-white/65">{p.priceNote}</div>

            <ul className="mt-6 space-y-2 text-sm text-white/70">
              {p.highlights.map((h) => (
                <li key={h} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-white/35" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>

            <button
              className={cn("btn mt-6 w-full", p.featured ? "btn-primary" : "btn-secondary")}
              onClick={() => startCheckout(p.key)}
              disabled={loading !== null}
            >
              {loading === p.key ? "Starting…" : p.cta}
            </button>

            <p className="mt-4 text-xs text-white/55">
              By purchasing, you agree to our{" "}
              <Link className="underline" href="/terms">
                Terms
              </Link>{" "}
              and{" "}
              <Link className="underline" href="/privacy">
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
          We do not do refunds, but we do fix problems fast. If something feels off, reach out and we
          will help you get running.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
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