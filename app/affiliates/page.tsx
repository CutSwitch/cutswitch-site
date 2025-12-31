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
        subtitle="Recommend CutSwitch to editors who cut interviews, podcasts, and talking-head content. Earn recurring commissions with clean Rewardful tracking."
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="card p-6">
            <div className="text-sm font-semibold text-white/90">Program overview</div>
            <p className="mt-2 text-sm leading-relaxed text-white/65">
              We run affiliates through Rewardful and Stripe. That means reliable tracking, code-friendly attribution, and
              payouts you can actually trust.
            </p>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-5">
              <div className="text-sm font-semibold text-white/90">What CutSwitch does (your 10-second pitch)</div>
              <p className="mt-2 text-sm text-white/65">
                CutSwitch auto-switches a Final Cut Pro multicam based on who&rsquo;s speaking, then exports a new .fcpxmld timeline you can refine.
                It&rsquo;s the fastest way to get to a clean first cut on conversation edits.
              </p>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-sm font-semibold text-white/90">Commission</div>
                <p className="mt-2 text-sm text-white/65">
                  A strong default is <span className="text-white/90 font-semibold">20% commission</span>. You can tune this per partner inside Rewardful.
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

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-sm font-semibold text-white/90">Who it&rsquo;s perfect for</div>
                <ul className="mt-2 space-y-1 text-sm text-white/65">
                  <li>• Podcast &amp; interview editors</li>
                  <li>• YouTube talkers &amp; educators</li>
                  <li>• Agencies cutting weekly content</li>
                  <li>• Anyone tired of angle chasing</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-sm font-semibold text-white/90">What converts</div>
                <ul className="mt-2 space-y-1 text-sm text-white/65">
                  <li>• Show the before/after cut rhythm</li>
                  <li>• Mention Custom tuning (pro control)</li>
                  <li>• Emphasize local-first workflow</li>
                  <li>• Point to the 60s demo on the homepage</li>
                </ul>
              </div>
            </div>

            <div className="mt-6">
              <div className="text-sm font-semibold text-white/90">How attribution works (in practice)</div>
              <ol className="mt-3 space-y-2 text-sm text-white/70">
                <li>1) You share your Rewardful referral link.</li>
                <li>2) Rewardful drops a referral cookie for the buyer.</li>
                <li>3) Our Stripe Checkout session includes the referral ID.</li>
                <li>4) Rewardful ties the Stripe customer + purchase back to you.</li>
              </ol>
              <p className="mt-3 text-sm text-white/65">
                Promo codes are supported in checkout. If you prefer code-only attribution for a campaign, email us and we&rsquo;ll set it up.
              </p>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-semibold text-white/90">Copy-paste promo ideas</div>
              <div className="mt-3 space-y-3 text-sm text-white/70">
                <p>
                  <span className="text-white/85 font-semibold">Short tweet:</span> “CutSwitch auto-switches Final Cut multicam by who&rsquo;s talking. Export XML in, clean cut plan out. Huge time saver.”
                </p>
                <p>
                  <span className="text-white/85 font-semibold">YouTube mention:</span> “If you cut interviews in Final Cut, CutSwitch gets you to a clean first pass in minutes. You still finish the edit. It just deletes the boring part.”
                </p>
                <p>
                  <span className="text-white/85 font-semibold">CTA line:</span> “Grab it here and use my link for tracking.”
                </p>
              </div>
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
