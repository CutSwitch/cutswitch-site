import { PricingTable } from "@/components/pricing/PricingTable";
import { SectionHeading } from "@/components/SectionHeading";

export default function PricingPage() {
  return (
    <main className="min-h-screen">
      <section className="relative py-16 sm:py-24">
        {/* Page heading */}
        <div className="container-edge">
          <SectionHeading
            eyebrow="Pricing"
            title="Simple plans. Serious speed."
            subtitle="Subscriptions include a 7-day free trial. Taxes are calculated automatically with Stripe Tax. All purchases are final: no refunds."
          />
        </div>

        {/* Pricing table (includes its own `container-edge` for consistent alignment) */}
        <PricingTable />

        {/* Footer note */}
        <div className="container-edge">
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-white">No refunds, by design</h2>
            <p className="mt-2 text-sm text-white/70">
              We keep pricing straightforward and the policy clear: all purchases are final.
              This reduces support loops, eliminates refund churn, and lets us focus on
              shipping. If something is broken, Support will help you.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href="/support" className="btn btn-secondary">
                Contact Support
              </a>
              <a href="/refunds" className="btn btn-secondary">
                Read the policy
              </a>
              <a href="mailto:support@cutswitch.com" className="btn btn-secondary">
                Email support
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
