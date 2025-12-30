import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: "CutSwitch Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="2025-12-30">
      <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-white/70">
        <strong className="text-white/90">Note:</strong> This is a practical template. Have it reviewed for your
        jurisdiction and data flows.
      </p>

      <p>
        This Privacy Policy explains how {siteConfig.name} collects, uses, and shares information when you visit our
        website or use the CutSwitch macOS application.
      </p>

      <h2 className="text-white/90 font-semibold">1. Information we collect</h2>
      <ul className="list-disc pl-5 space-y-2">
        <li>
          <strong className="text-white/90">Purchase information:</strong> When you buy CutSwitch, Stripe collects
          billing details (such as name, email, billing address, payment method). We receive purchase metadata (e.g.,
          Stripe customer ID, subscription status).
        </li>
        <li>
          <strong className="text-white/90">Support requests:</strong> If you contact Support, we collect the info you
          provide (name, email, message, and any attachments you send by email).
        </li>
        <li>
          <strong className="text-white/90">Licensing:</strong> We use Keygen to issue and validate license keys. Keygen
          may process device identifiers and activation events to enforce the 2-device limit.
        </li>
        <li>
          <strong className="text-white/90">Affiliate attribution:</strong> If you arrive via an affiliate link,
          Rewardful may set a referral cookie and we pass a referral identifier into Stripe Checkout for attribution.
        </li>
      </ul>

      <h2 className="text-white/90 font-semibold">2. How we use information</h2>
      <ul className="list-disc pl-5 space-y-2">
        <li>To deliver licenses and enable app access.</li>
        <li>To provide customer support and troubleshoot issues.</li>
        <li>To prevent fraud, abuse, and chargebacks (e.g., dispute handling may suspend licenses).</li>
        <li>To attribute affiliate referrals and calculate commissions.</li>
        <li>To improve the product and website (in aggregate).</li>
      </ul>

      <h2 className="text-white/90 font-semibold">3. Sharing</h2>
      <p>We share information with service providers only as needed to run CutSwitch:</p>
      <ul className="list-disc pl-5 space-y-2">
        <li>
          <strong className="text-white/90">Stripe</strong> for payments, subscriptions, invoicing, and tax calculation.
        </li>
        <li>
          <strong className="text-white/90">Rewardful</strong> for affiliate tracking and attribution.
        </li>
        <li>
          <strong className="text-white/90">Keygen</strong> for licensing and device activation limits.
        </li>
        <li>
          <strong className="text-white/90">Vercel</strong> for hosting and analytics logs (standard server logs).
        </li>
      </ul>

      <h2 className="text-white/90 font-semibold">4. Cookies</h2>
      <p>
        We may use cookies and similar technologies for affiliate attribution (Rewardful) and to keep the website
        working reliably. You can control cookies through your browser settings.
      </p>

      <h2 className="text-white/90 font-semibold">5. Data retention</h2>
      <p>
        We retain information only as long as necessary for legitimate business purposes, including compliance,
        accounting, and dispute handling.
      </p>

      <h2 className="text-white/90 font-semibold">6. Your rights</h2>
      <p>
        Depending on your location, you may have rights to access, delete, or correct your data. Contact us at{" "}
        <a className="underline decoration-white/20 hover:decoration-white/60" href={`mailto:${siteConfig.emails.support}`}>
          {siteConfig.emails.support}
        </a>{" "}
        to request help.
      </p>

      <h2 className="text-white/90 font-semibold">7. Changes</h2>
      <p>
        We may update this policy periodically. Updates will be posted on this page with a new &ldquo;Last
        updated&rdquo; date.
      </p>
    </LegalPage>
  );
}
