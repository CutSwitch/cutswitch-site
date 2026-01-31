import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms",
  description: "CutSwitch Terms of Service",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="2025-12-30">
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the CutSwitch website and macOS
        application (&ldquo;CutSwitch&rdquo;). By downloading, installing, purchasing, or using CutSwitch, you agree to
        these Terms.
      </p>

      <h2 className="text-white/90 font-semibold">1. Contact</h2>
      <p>
        Support:{" "}
        <a className="underline decoration-white/20 hover:decoration-white/60" href={`mailto:${siteConfig.emails.support}`}>
          {siteConfig.emails.support}
        </a>
        <br />
        Feedback:{" "}
        <a className="underline decoration-white/20 hover:decoration-white/60" href={`mailto:${siteConfig.emails.feedback}`}>
          {siteConfig.emails.feedback}
        </a>
        <br />
        Affiliates:{" "}
        <a className="underline decoration-white/20 hover:decoration-white/60" href={`mailto:${siteConfig.emails.affiliate}`}>
          {siteConfig.emails.affiliate}
        </a>
      </p>

      <h2 className="text-white/90 font-semibold">2. Eligibility</h2>
      <p>
        You must be able to form a legally binding contract to use CutSwitch. If you purchase on behalf of a company,
        you represent that you have authority to bind that company to these Terms.
      </p>

      <h2 className="text-white/90 font-semibold">3. Purchases, trials, and billing</h2>
      <ul className="list-disc pl-5 space-y-2">
        <li>
          <strong className="text-white/90">Payment processor:</strong> Purchases are processed by Stripe. Taxes may be
          calculated automatically via Stripe Tax based on your location and tax information.
        </li>
        <li>
          <strong className="text-white/90">Trials:</strong> Subscription plans may include a free trial period. During
          a trial, your payment method may be collected and authorized, but you will not be charged until the trial
          ends. If you cancel before the trial ends, you will not be charged.
        </li>
        <li>
          <strong className="text-white/90">Renewals:</strong> Subscriptions renew automatically at the end of each
          billing period unless canceled.
        </li>
        <li>
          <strong className="text-white/90">No refunds:</strong> All sales are final. We do not offer refunds (see{" "}
          <Link className="underline decoration-white/20 hover:decoration-white/60" href="/refunds">
            Refund Policy
          </Link>
          ).
        </li>
      </ul>

      <h2 className="text-white/90 font-semibold">4. License and device limits</h2>
      <p>
        When you purchase CutSwitch, you receive a license key. Unless otherwise specified in writing, each license is
        limited to <strong className="text-white/90">two (2) active devices</strong>. Device limits are enforced through
        our licensing provider (Keygen) and app validation logic.
      </p>
      <ul className="list-disc pl-5 space-y-2">
        <li>You may not share your license key publicly or resell it.</li>
        <li>You may not bypass, disable, or interfere with licensing enforcement.</li>
        <li>
          If you need to transfer devices (e.g., new Mac), you may be able to deactivate an old device or contact
          Support.
        </li>
      </ul>

      <h2 className="text-white/90 font-semibold">5. Prohibited use</h2>
      <p>
        You agree not to misuse CutSwitch or the website. This includes attempting to reverse engineer, decompile,
        modify, circumvent security, scrape, or disrupt services.
      </p>

      <h2 className="text-white/90 font-semibold">6. Suspension and termination</h2>
      <p>
        We may suspend or terminate access to CutSwitch and associated licenses if we reasonably believe you violated
        these Terms, engaged in fraud, or initiated a chargeback or payment dispute. If a dispute is resolved in your
        favor, we may reinstate access.
      </p>

      <h2 className="text-white/90 font-semibold">7. Support</h2>
      <p>
        We aim to provide reasonable support via the Support channels. We do not guarantee specific response times, but
        we care about fast resolution because it keeps everyone sane.
      </p>

      <h2 className="text-white/90 font-semibold">8. Intellectual property</h2>
      <p>
        CutSwitch and all related IP are owned by {siteConfig.name}. These Terms grant you a limited, non-exclusive,
        non-transferable right to use CutSwitch during the term of your license/subscription.
      </p>

      <h2 className="text-white/90 font-semibold">9. Disclaimer</h2>
      <p>
        CutSwitch is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, express
        or implied, including warranties of merchantability, fitness for a particular purpose, and non-infringement.
      </p>

      <h2 className="text-white/90 font-semibold">10. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, {siteConfig.name} will not be liable for any indirect, incidental,
        special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or
        indirectly, or any loss of data, use, goodwill, or other intangible losses, resulting from your use of
        CutSwitch.
      </p>

      <h2 className="text-white/90 font-semibold">11. Changes</h2>
      <p>
        We may update these Terms from time to time. Updated Terms will be posted on this page with a new &ldquo;Last
        updated&rdquo; date.
      </p>

      <h2 className="text-white/90 font-semibold">12. Governing law</h2>
      <p>
        Choose the governing law and venue that matches your business. This section is intentionally generic and should
        be reviewed by counsel.
      </p>
    </LegalPage>
  );
}
