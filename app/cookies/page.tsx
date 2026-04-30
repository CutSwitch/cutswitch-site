import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/LegalPage";
import { CookieSettingsLink } from "@/components/privacy/CookieSettingsLink";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "How CutSwitch uses cookies, local storage, and affiliate attribution.",
};

export default function CookiePolicyPage() {
  return (
    <LegalPage title="Cookie Policy" updated="2026-04-30">
      <p>
        This Cookie Policy explains how {siteConfig.name} uses cookies, local storage, pixels, and similar technologies
        on {siteConfig.domain} and related checkout, account, support, and affiliate flows.
      </p>

      <h2 className="font-semibold text-white/90">1. What cookies and local storage do</h2>
      <p>
        Cookies are small files stored by your browser. Local storage is similar browser storage. We use both to keep the
        site secure, remember choices, process checkout, and, if you consent, support affiliate attribution.
      </p>

      <h2 className="font-semibold text-white/90">2. Cookie categories</h2>
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-full divide-y divide-white/10 text-left text-sm">
          <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-white/45">
            <tr>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Purpose</th>
              <th className="px-4 py-3">Examples</th>
              <th className="px-4 py-3">Choice</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            <tr>
              <td className="px-4 py-3 font-semibold text-white/85">Necessary</td>
              <td className="px-4 py-3">Authentication, checkout, security, support forms, and site operation.</td>
              <td className="px-4 py-3">Supabase sessions, Stripe Checkout, rate limiting, CSRF/security storage.</td>
              <td className="px-4 py-3">Always on.</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-semibold text-white/85">Preferences</td>
              <td className="px-4 py-3">Remembering display and privacy choices.</td>
              <td className="px-4 py-3">Theme setting and cookie consent state.</td>
              <td className="px-4 py-3">Managed in Cookie settings.</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-semibold text-white/85">Affiliate / marketing</td>
              <td className="px-4 py-3">Affiliate attribution and referral measurement.</td>
              <td className="px-4 py-3">Rewardful referral cookies and checkout attribution metadata.</td>
              <td className="px-4 py-3">Off until accepted.</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-semibold text-white/85">Analytics</td>
              <td className="px-4 py-3">Future product/site analytics if enabled.</td>
              <td className="px-4 py-3">No nonessential analytics provider is required for core site use.</td>
              <td className="px-4 py-3">Off until accepted.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="font-semibold text-white/90">3. Providers that may use cookies</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong className="text-white/90">Supabase:</strong> account sessions and authentication. These are necessary
          for login and account pages.
        </li>
        <li>
          <strong className="text-white/90">Stripe:</strong> secure checkout, billing portal, fraud prevention, and
          payment processing. These are necessary when you use billing features.
        </li>
        <li>
          <strong className="text-white/90">Rewardful:</strong> affiliate referral attribution. Rewardful loads only
          after affiliate/marketing consent.
        </li>
        <li>
          <strong className="text-white/90">Vercel:</strong> hosting and standard server logs. These help operate and
          secure the site.
        </li>
      </ul>

      <h2 className="font-semibold text-white/90">4. Your choices</h2>
      <p>
        You can accept all cookies, reject nonessential cookies, or manage categories in our banner. You can reopen your
        choices any time from the footer:
      </p>
      <p>
        <CookieSettingsLink className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm" />
      </p>
      <p>
        Your browser may also let you delete, block, or limit cookies. If you block necessary cookies, login, checkout,
        support forms, or account pages may not work correctly.
      </p>

      <h2 className="font-semibold text-white/90">5. Global Privacy Control and opt-out rights</h2>
      <p>
        If your browser sends a Global Privacy Control signal, we default nonessential tracking and sharing categories
        off unless you choose otherwise. We also provide opt-out-style controls for affiliate/marketing cookies and
        nonessential emails as a best practice, including for California-style "Do Not Sell or Share" expectations.
      </p>

      <h2 className="font-semibold text-white/90">6. Updates and contact</h2>
      <p>
        We may update this policy as providers or product features change. Questions or privacy requests can be sent
        through the{" "}
        <Link className="underline decoration-white/20 hover:decoration-white/60" href="/support">
          support form
        </Link>
        .
      </p>
    </LegalPage>
  );
}
