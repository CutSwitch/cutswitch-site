import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Security",
  description: "Security and data-handling overview for CutSwitch.",
};

export default function SecurityPage() {
  return (
    <LegalPage title="Security" updated="2026-01-02">
      <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-white/70">
        <strong className="text-white/90">Note:</strong> This page describes our intentions and current practices. It
        is not a warranty or contractual guarantee.
      </p>

      <p>
        CutSwitch is built to be <strong className="text-white/90">local-first</strong>. Your media stays on your Mac.
        We aim to keep data collection minimal and focused on what&rsquo;s necessary to deliver licenses, billing, and
        support.
      </p>

      <h2 className="text-white/90 font-semibold">1. Local-first workflow</h2>
      <ul className="list-disc pl-5 space-y-2">
        <li>
          CutSwitch analyzes the audio files you provide <strong className="text-white/90">on-device</strong>.
        </li>
        <li>
          CutSwitch generates a new <span className="font-mono">.fcpxmld</span> bundle you import back into Final Cut
          Pro.
        </li>
        <li>
          We do <strong className="text-white/90">not</strong> upload your source media to our servers for processing.
        </li>
      </ul>

      <h2 className="text-white/90 font-semibold">2. Data we do handle</h2>
      <p>To run a paid macOS app, some non-media data is unavoidable. In practice this includes:</p>
      <ul className="list-disc pl-5 space-y-2">
        <li>
          <strong className="text-white/90">Billing:</strong> Stripe processes payments and subscriptions.
        </li>
        <li>
          <strong className="text-white/90">Licensing:</strong> Keygen validates license keys and may record device
          activations to enforce limits.
        </li>
        <li>
          <strong className="text-white/90">Affiliate attribution:</strong> Rewardful may set a referral cookie and
          attribute purchases to partners.
        </li>
        <li>
          <strong className="text-white/90">Support:</strong> If you email us or submit a support form, we receive the
          info you provide and any attachments you include.
        </li>
      </ul>
      <p>
        For details on data categories and providers, see our {" "}
        <a className="underline decoration-white/20 hover:decoration-white/60" href="/privacy">
          Privacy Policy
        </a>
        .
      </p>

      <h2 className="text-white/90 font-semibold">3. Transport security</h2>
      <p>
        We serve the site over HTTPS and rely on reputable infrastructure providers for hosting and payments. Like any
        modern SaaS setup, security is shared across the stack: our app and site, your device, and our vendors.
      </p>

      <h2 className="text-white/90 font-semibold">4. Responsible disclosure</h2>
      <p>
        If you believe you&rsquo;ve found a security issue, please email{" "}
        <a className="underline decoration-white/20 hover:decoration-white/60" href={`mailto:${siteConfig.emails.support}`}>
          {siteConfig.emails.support}
        </a>
        {" "}with the subject line <span className="font-mono">Security report</span>. Please include steps to reproduce
        and any relevant logs.
      </p>

      <h2 className="text-white/90 font-semibold">5. Updates</h2>
      <p>
        We ship updates to improve stability, accuracy, and security. This page may change as the product evolves.
      </p>
    </LegalPage>
  );
}
