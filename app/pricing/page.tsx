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
            title="Start free. Cut faster."
            subtitle="Try CutSwitch free for 7 days with 4 hours of editing included. Pick the plan you’ll continue on after the trial. Cancel anytime before billing."
          />
          <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-6 text-white/55">
            Editing time is based on the length of your source footage. Taxes are calculated at checkout.
          </p>
        </div>

        {/* Pricing table (includes its own `container-edge` for consistent alignment) */}
        <PricingTable />

        {/* Footer note */}
        <div className="container-edge">
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-white">Billing, cancellations, and refunds</h2>
            <p className="mt-2 text-sm text-white/70">
              You can cancel anytime from your account to stop future monthly payments.
              After the free trial ends, subscription payments are final and non-refundable.
              If something breaks or you need help, Support will help you get unstuck.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href="/support" className="btn btn-secondary">
                Contact Support
              </a>
              <a href="/refunds" className="btn btn-secondary">
                Read refund policy
              </a>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <FAQ
              question="Can I try CutSwitch before paying?"
              answer="Yes. Every plan starts with a 7-day free trial with 4 hours of editing included."
            />
            <FAQ
              question="What happens after the trial?"
              answer="Your selected plan begins automatically after 7 days unless you cancel before billing."
            />
            <FAQ
              question="Can I cancel anytime?"
              answer="Yes. You can cancel from your account anytime to stop future monthly payments."
            />
            <FAQ
              question="What if I want to skip the trial?"
              answer="Most users start with the trial. If you need immediate paid access, contact Support."
            />
          </div>
        </div>
      </section>
    </main>
  );
}

function FAQ({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <h3 className="font-semibold text-white">{question}</h3>
      <p className="mt-2 text-sm leading-6 text-white/65">{answer}</p>
    </div>
  );
}
