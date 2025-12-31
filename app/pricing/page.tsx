import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeading } from "@/components/SectionHeading";
import { PricingTable } from "@/components/pricing/PricingTable";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Choose a plan. Start a 7-day trial on subscriptions. Stripe Tax is calculated automatically.",
};

export default function PricingPage() {
  return (
    <div className="container-edge">
      <SectionHeading
        eyebrow="Pricing"
        title="Simple plans. Serious speed."
        subtitle="Subscriptions include a 7-day free trial. Taxes are calculated automatically with Stripe Tax. All purchases are final: no refunds."
      />

      <div className="mt-8">
        <PricingTable />
      </div>

      <div className="mt-12 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-sm font-semibold text-white/90">No refunds, by design</div>
        <p className="mt-2 text-sm leading-relaxed text-white/65">
          We keep pricing straightforward and the policy clear: all purchases are final. This reduces support loops,
          eliminates refund churn, and lets us focus on shipping. If something is broken, Support will help you.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Link className="btn btn-secondary" href="/support">
            Contact Support
          </Link>
          <Link className="btn btn-ghost" href="/refunds">
            Read the policy
          </Link>
          <a className="btn btn-ghost" href={`mailto:${siteConfig.emails.support}`}>
            Email support
          </a>
        </div>
      </div>
    </div>
  );
}
