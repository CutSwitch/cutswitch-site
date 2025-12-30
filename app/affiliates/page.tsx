import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeading } from "@/components/SectionHeading";
import { siteConfig } from "@/lib/site";

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
        title="Make money promoting CutSwitch"
        subtitle="Affiliate marketing is our main growth channel. We built the checkout and attribution pipeline to be clean, accurate, and code-friendly."
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="card p-6">
            <div className="text-sm font-semibold text-white/90">Program overview</div>
            <p className="mt-2 text-sm leading-relaxed text-white/65">
              We run affiliates through Rewardful and Stripe. That means fast payouts, reliable tracking, and the
              ability to attribute sales using links and promo codes.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-sm font-semibold text-white/90">Commission</div>
                <p className="mt-2 text-sm text-white/65">
                  A strong default is <span className="text-white/90 font-semibold">30% commission</span>. You can tune
                  this per partner inside Rewardful.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-sm font-semibold text-white/90">Cookie window</div>
                <p className="mt-2 text-sm text-white/65">
                  A common setup is <span className="text-white/90 font-semibold">60 days</span>. Longer windows reward
                  long-consideration buyers.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-sm font-semibold text-white/90">Payout cadence</div>
                <p className="mt-2 text-sm text-white/65">
                  Monthly payouts are the usual rhythm. That gives time for dispute windows to settle.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-sm font-semibold text-white/90">Link + code friendly</div>
                <p className="mt-2 text-sm text-white/65">
                  Use your Rewardful link for tracking. Buyers can still apply promo codes in Stripe Checkout and you
                  can be credited.
                </p>
              </div>
            </div>

            <div className="mt-6 gradient-line" />

            <div className="mt-6">
              <div className="text-sm font-semibold text-white/90">How attribution works (in practice)</div>
              <ol className="mt-3 space-y-2 text-sm text-white/70">
                <li>1) You share your Rewardful referral link.</li>
                <li>2) Rewardful drops a referral cookie for the buyer.</li>
                <li>3) Our Stripe Checkout session includes the referral ID.</li>
                <li>4) Rewardful ties the Stripe customer + purchase back to you.</li>
              </ol>
              <p className="mt-3 text-sm text-white/65">
                Promo codes are supported in checkout. If you prefer code-based attribution, ask us and we will help
                you set it up.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <a className="btn btn-primary" href={`mailto:${siteConfig.emails.affiliate}?subject=CutSwitch%20Affiliate%20Application`}>
                Apply via email <span className="text-white/80">→</span>
              </a>
              <Link className="btn btn-secondary" href="/pricing">
                See pricing
              </Link>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold text-white/90">Already an affiliate?</div>
          <p className="mt-2 text-sm text-white/65">
            Log in to Rewardful to grab your link, view conversions, and update payout details.
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
              Want custom assets, tracking guidance, or a code-based campaign? Email{" "}
              <a className="underline decoration-white/20 hover:decoration-white/60" href={`mailto:${siteConfig.emails.affiliate}`}>
                {siteConfig.emails.affiliate}
              </a>
              .
            </p>
          </div>

          <div className="mt-6">
            <div className="text-xs font-semibold uppercase tracking-widest text-white/45">
              Pro tip
            </div>
            <p className="mt-2 text-sm text-white/65">
              Send buyers to <Link className="underline decoration-white/20 hover:decoration-white/60" href="/pricing">/pricing</Link>. 
              It has the cleanest conversion flow and supports promo codes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
