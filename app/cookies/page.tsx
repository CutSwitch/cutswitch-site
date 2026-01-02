import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "How CutSwitch uses cookies, including affiliate attribution.",
};

export default function CookiePolicyPage() {
  return (
    <LegalPage title="Cookie Policy" updated="2026-01-02">
      <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-white/70">
        <strong className="text-white/90">Note:</strong> This is a practical template, not legal advice. Cookie
        requirements vary by jurisdiction (e.g., GDPR/ePrivacy, CCPA/CPRA). Have counsel review.
      </p>

      <p>
        This Cookie Policy explains how {siteConfig.name} uses cookies and similar technologies on {siteConfig.domain}
        (the “Site”) and in connection with the CutSwitch purchase/affiliate flow.
      </p>

      <h2 className="text-white/90 font-semibold">1. What are cookies?</h2>
      <p>
        Cookies are small text files stored on your device by your browser. They help websites remember information
        about your visit, such as preferences, session state, and referral attribution.
      </p>

      <h2 className="text-white/90 font-semibold">2. What we use cookies for</h2>
      <ul className="list-disc pl-5 space-y-2">
        <li>
          <strong className="text-white/90">Essential site functionality:</strong> basic navigation, security
          protections, and keeping the site reliable.
        </li>
        <li>
          <strong className="text-white/90">Affiliate attribution (Rewardful):</strong> if you arrive via an affiliate
          link, Rewardful may set a cookie to remember the referral. We may pass a referral identifier into Stripe
          Checkout so commissions can be calculated correctly.
        </li>
        <li>
          <strong className="text-white/90">Payments (Stripe):</strong> Stripe may set cookies necessary to process
          checkout securely and prevent fraud.
        </li>
      </ul>

      <h2 className="text-white/90 font-semibold">3. Types of cookies</h2>
      <ul className="list-disc pl-5 space-y-2">
        <li>
          <strong className="text-white/90">First-party cookies</strong> are set by {siteConfig.domain}.
        </li>
        <li>
          <strong className="text-white/90">Third-party cookies</strong> are set by service providers (like Rewardful or
          Stripe) when they help us deliver purchases, attribution, or security.
        </li>
        <li>
          <strong className="text-white/90">Session cookies</strong> expire when you close your browser.
        </li>
        <li>
          <strong className="text-white/90">Persistent cookies</strong> last for a period of time (for example, an
          affiliate cookie window).
        </li>
      </ul>

      <h2 className="text-white/90 font-semibold">4. Your choices</h2>
      <p>
        You can control cookies through your browser settings (including deleting existing cookies and blocking future
        ones). If you disable cookies, parts of the Site may not function properly, and affiliate attribution may not
        work.
      </p>

      <h2 className="text-white/90 font-semibold">5. Updates</h2>
      <p>
        We may update this Cookie Policy as our product or providers change. Updates will be posted on this page with a
        new “Last updated” date.
      </p>

      <h2 className="text-white/90 font-semibold">6. Contact</h2>
      <p>
        Questions? Email{" "}
        <a className="underline decoration-white/20 hover:decoration-white/60" href={`mailto:${siteConfig.emails.support}`}>
          {siteConfig.emails.support}
        </a>
        .
      </p>
    </LegalPage>
  );
}
