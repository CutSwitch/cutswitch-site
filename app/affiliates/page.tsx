import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeading } from "@/components/SectionHeading";

export const metadata: Metadata = {
  title: "Affiliates",
  description: "Earn commissions promoting CutSwitch. Rewardful tracking, codes supported, and clean attribution.",
};

export default function AffiliatesPage() {
  const portal =
    process.env.NEXT_PUBLIC_REWARDFUL_PORTAL_URL ||
    process.env.REWARDFUL_PORTAL_URL ||
    "https://example.com/rewardful-portal";

  return (
    <div className="container-edge">
      <SectionHeading
        eyebrow="Affiliates"
        title="Earn by recommending CutSwitch"
        subtitle="Share a link. CutSwitch cuts the multicam. Rewardful tracks it. Stripe pays you."
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="card p-6">
            <div className="text-sm font-semibold text-white/90">Program overview</div>
            <p className="mt-2 text-sm leading-relaxed text-white/65">
              CutSwitch is a clean win for Final Cut editors: it removes angle-chasing and hands you a timeline you can
              refine.
            </p>

            <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
              <div className="aspect-[16/9]">
                <img
                  src="/illust/affiliate-earnings.gif"
                  alt="Affiliate earnings calculator preview"
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-white/55">
              A handful of referrals can turn into real monthly revenue.
            </p>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-5">
              <div className="text-sm font-semibold text-white/90">10-second pitch</div>
              <p className="mt-2 text-sm text-white/65">
                CutSwitch auto-switches your Final Cut multicam by who&rsquo;s speaking and exports a clean .fcpxmld you
                can keep editing.
              </p>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-sm font-semibold text-white/90">Why CutSwitch converts</div>
                <ul className="mt-2 space-y-1 text-sm text-white/65">
                  <li>• Pain is obvious: multicam switching is pure grind.</li>
                  <li>• Output is editable: you still control the final cut.</li>
                  <li>• Local-first: no uploads, no waiting.</li>
                  <li>• Pro controls: Calm / Normal / Punchy + Custom tuning.</li>
                  <li>• 7-day trial helps close.</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-sm font-semibold text-white/90">How you get paid</div>
                <ul className="mt-2 space-y-1 text-sm text-white/65">
                  <li>• 20% commission (default)</li>
                  <li>• 60-day cookie</li>
                  <li>• Monthly plan: recurring commission for up to 12 months</li>
                  <li>• Yearly plan: one-time commission (credited on purchase)</li>
                  <li>• Tracked in Rewardful, paid via Stripe on the normal payout schedule</li>
                </ul>
                <p className="mt-3 text-xs text-white/55">
                  Share your link; Rewardful tracks it through Stripe Checkout.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-semibold text-white/90">We&rsquo;ll send you an Affiliate Kit</div>
              <ul className="mt-2 space-y-1 text-sm text-white/65">
                <li>• A test podcast + sample XML/workflow</li>
                <li>• Before/after clips + thumbnails</li>
                <li>• Short captions + talking points</li>
                <li>• Posting checklist + tracking link</li>
              </ul>
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Link className="btn btn-primary" href="/support">
                Apply to become an affiliate <span className="text-white/80">→</span>
              </Link>
              <Link className="btn btn-secondary" href="/pricing">
                See pricing
              </Link>
            </div>

            <p className="mt-3 text-xs text-white/55">
              By applying, you agree to our{" "}
              <Link className="underline decoration-white/20 hover:decoration-white/60" href="/affiliate-terms">
                Affiliate Program Terms
              </Link>
              .
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold text-white/90">Already an affiliate?</div>
          <p className="mt-2 text-sm text-white/65">
            Log in to Rewardful to grab your link and view payouts.
          </p>
          <div className="mt-5">
            <a className="btn btn-secondary w-full" href={portal} target="_blank" rel="noreferrer">
              Login to Rewardful
            </a>
          </div>

          <div className="mt-6 gradient-line" />

          <div className="mt-6">
            <div className="text-sm font-semibold text-white/90">Need help?</div>
            <p className="mt-2 text-sm text-white/65">
              Want assets, tracking help, or a custom campaign? Use the{" "}
              <Link className="underline decoration-white/20 hover:decoration-white/60" href="/support">
                support form
              </Link>
              .
            </p>
          </div>

          <div className="mt-6">
            <div className="text-xs font-semibold uppercase tracking-widest text-white/45">
              Pro tip
            </div>
            <p className="mt-2 text-sm text-white/65">
              Link to the homepage demo first, then send buyers to{" "}
              <Link className="underline decoration-white/20 hover:decoration-white/60" href="/pricing">
                /pricing
              </Link>
              . The demo explains the product in under a minute and pricing closes the loop.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
