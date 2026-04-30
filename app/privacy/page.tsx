import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/LegalPage";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: "CutSwitch Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="2026-04-30">
      <p>
        This Privacy Policy explains how {siteConfig.name} collects, uses, shares, and protects information when you
        visit our website, create an account, subscribe, contact us, or use the CutSwitch macOS app.
      </p>

      <h2 className="font-semibold text-white/90">1. Information we collect</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong className="text-white/90">Account information:</strong> email address, authentication identifiers,
          account status, and basic profile details you provide.
        </li>
        <li>
          <strong className="text-white/90">Billing metadata:</strong> Stripe customer, subscription, plan, invoice, tax,
          and payment status details. We do not store full card numbers.
        </li>
        <li>
          <strong className="text-white/90">Usage and editing-time records:</strong> plan allowance, source-duration
          seconds, successful/reused/failed job status, project/audio fingerprints, app version, and safe diagnostics.
        </li>
        <li>
          <strong className="text-white/90">Product events:</strong> privacy-safe app events such as project imported,
          run started, run succeeded, run failed, export created, and feedback submitted.
        </li>
        <li>
          <strong className="text-white/90">Support and feedback:</strong> messages, topic, screen/context, safe
          metadata, screenshots, Cut Plan JSON files, and other attachments you choose to send.
        </li>
        <li>
          <strong className="text-white/90">Email and lifecycle metadata:</strong> email delivery status, suppression
          preferences, nudge/campaign records, and unsubscribe choices.
        </li>
        <li>
          <strong className="text-white/90">Cookies and local storage:</strong> account session storage, theme and cookie
          choices, checkout/security cookies, and affiliate attribution if you consent.
        </li>
      </ul>

      <h2 className="font-semibold text-white/90">2. How we use information</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>To create and secure accounts, sessions, and app access.</li>
        <li>To process subscriptions, trials, invoices, taxes, billing portals, and customer support.</li>
        <li>To measure editing-time usage and enforce plan/trial limits.</li>
        <li>To diagnose failed runs, improve onboarding, and fix product issues.</li>
        <li>To respond to support, privacy, billing, affiliate, and feedback requests.</li>
        <li>To send transactional account messages and, where allowed, relevant lifecycle or product emails.</li>
        <li>To attribute affiliate referrals and prevent fraud, abuse, spam, or security incidents.</li>
      </ul>

      <h2 className="font-semibold text-white/90">3. Service providers</h2>
      <p>We use trusted service providers to operate CutSwitch. They process information for us only as needed:</p>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong className="text-white/90">Supabase</strong> for authentication, database, account records, usage
          ledgers, feedback, and admin data.
        </li>
        <li>
          <strong className="text-white/90">Stripe</strong> for checkout, subscriptions, invoices, taxes, fraud
          prevention, and billing portals.
        </li>
        <li>
          <strong className="text-white/90">Vercel</strong> for website hosting, serverless functions, logs, and
          deployment infrastructure.
        </li>
        <li>
          <strong className="text-white/90">Resend</strong> for transactional, support, nudge, and campaign emails when
          email sending is enabled.
        </li>
        <li>
          <strong className="text-white/90">Rewardful</strong> for affiliate attribution, only after affiliate/marketing
          cookie consent where required.
        </li>
        <li>
          <strong className="text-white/90">Loops or Customer.io</strong> may be used for lifecycle email events if
          enabled in the future.
        </li>
      </ul>

      <h2 className="font-semibold text-white/90">4. Cookies and tracking choices</h2>
      <p>
        Necessary cookies and storage keep accounts, checkout, security, support forms, and preferences working.
        Nonessential affiliate/marketing or analytics cookies are controlled by our cookie banner and footer Cookie
        settings link. We honor Global Privacy Control by defaulting nonessential tracking off unless you opt in.
      </p>
      <p>
        See our{" "}
        <Link className="underline decoration-white/20 hover:decoration-white/60" href="/cookies">
          Cookie Policy
        </Link>{" "}
        for categories, providers, and controls.
      </p>

      <h2 className="font-semibold text-white/90">5. Support, feedback, and attachments</h2>
      <p>
        Support messages and attachments may include information you choose to provide. Please do not send raw audio,
        transcripts, private file paths, credentials, or unrelated personal information unless we specifically ask for
        it. Feedback and support records may be visible to CutSwitch admins and may be exported for support, security,
        product, or legal workflows.
      </p>

      <h2 className="font-semibold text-white/90">6. Email choices</h2>
      <p>
        You can opt out of nonessential marketing, lifecycle, campaign, or nudge emails at{" "}
        <Link className="underline decoration-white/20 hover:decoration-white/60" href="/unsubscribe">
          Email preferences
        </Link>
        . We may still send transactional emails about your account, billing, support requests, security, legal notices,
        or service operation.
      </p>

      <h2 className="font-semibold text-white/90">7. Retention</h2>
      <p>
        We keep information only as long as needed for the purposes above. Billing and usage-ledger records may be kept
        longer for accounting, tax, legal, fraud-prevention, and dispute reasons. Support and feedback records are kept
        while useful for support and product quality, then deleted or minimized where practical. Attachments are
        minimized and should not be used as long-term storage.
      </p>

      <h2 className="font-semibold text-white/90">8. Your rights and choices</h2>
      <p>
        Depending on where you live, you may have rights to access, correct, delete, export, object to, or restrict use
        of your personal information. You may also opt out of certain sharing or nonessential tracking. To make a
        request, use the{" "}
        <Link className="underline decoration-white/20 hover:decoration-white/60" href="/support">
          support form
        </Link>{" "}
        and choose Privacy / data request. We may need to verify your identity before fulfilling a request.
      </p>

      <h2 className="font-semibold text-white/90">9. Children</h2>
      <p>
        CutSwitch is not directed to children under 13, and we do not knowingly collect personal information from
        children.
      </p>

      <h2 className="font-semibold text-white/90">10. International transfers</h2>
      <p>
        We and our providers may process information in the United States and other countries. Those countries may have
        privacy laws different from your location, but we use provider contracts and safeguards appropriate for our
        services.
      </p>

      <h2 className="font-semibold text-white/90">11. Security</h2>
      <p>
        We use technical and organizational safeguards to protect customer information, including server-side admin
        access, role-limited service keys, privacy-safe logs where practical, and payment handling through Stripe. No
        internet service can be guaranteed perfectly secure.
      </p>

      <h2 className="font-semibold text-white/90">12. Changes and contact</h2>
      <p>
        We may update this policy as CutSwitch changes. Updates will be posted here with a new date. For privacy
        questions or data requests, use the{" "}
        <Link className="underline decoration-white/20 hover:decoration-white/60" href="/support">
          support form
        </Link>{" "}
        and choose Privacy / data request.
      </p>
    </LegalPage>
  );
}
