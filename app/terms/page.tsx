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
        Nobody wakes up hoping to read Terms of Service. Fair. But these Terms of Service
        (&ldquo;Terms&rdquo;) govern your access to and use of the CutSwitch website and macOS
        application (&ldquo;CutSwitch&rdquo;). By downloading, installing, purchasing, or using
        CutSwitch, you agree to these Terms.
      </p>

      <h2 className="text-white/90 font-semibold">1. Contact</h2>
      <p>
        You can contact us through the{" "}
        <Link className="underline decoration-white/20 hover:decoration-white/60" href="/support">
          support form
        </Link>
        .
      </p>

      <h2 className="text-white/90 font-semibold">2. Eligibility</h2>
      <p>
        You must be legally able to enter into a binding contract to use CutSwitch. If you
        purchase on behalf of a company, you represent that you have authority to bind that
        company to these Terms.
      </p>

      <h2 className="text-white/90 font-semibold">3. Purchases, trials, and billing</h2>
      <p>A few billing basics, in plain English:</p>
      <ul className="list-disc pl-5 space-y-2">
        <li>
          <strong className="text-white/90">Payment processor:</strong> Purchases are processed by Stripe. Taxes may be
          calculated automatically through Stripe Tax based on your location and tax information.
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
          <strong className="text-white/90">No refunds:</strong> All sales are final. We do not offer refunds. Please
          review our{" "}
          <Link className="underline decoration-white/20 hover:decoration-white/60" href="/refunds">
            Refund Policy
          </Link>
          . We know that is nobody&rsquo;s favorite sentence, but we prefer to be direct about it.
        </li>
      </ul>

      <h2 className="text-white/90 font-semibold">4. Account access and device limits</h2>
      <p>
        When you subscribe to CutSwitch, access is tied to your CutSwitch account and subscription status. Unless
        otherwise specified in writing, each account may be limited to{" "}
        <strong className="text-white/90">two (2) active devices</strong>. Two devices means two devices. Not two-ish.
      </p>
      <ul className="list-disc pl-5 space-y-2">
        <li>You may not share, resell, or transfer your account access without permission.</li>
        <li>You may not bypass, disable, or interfere with account, subscription, or device-limit enforcement.</li>
        <li>
          If you need to transfer devices, for example because you got a new Mac, you may be
          able to sign out on an old device or contact Support.
        </li>
      </ul>

      <h2 className="text-white/90 font-semibold">5. Prohibited use</h2>
      <p>
        Please do not use CutSwitch in ways that break it, abuse it, or try to get around the
        rules. You agree not to:
      </p>
      <ul className="list-disc pl-5 space-y-2">
        <li>reverse engineer or decompile CutSwitch;</li>
        <li>modify CutSwitch in unauthorized ways;</li>
        <li>circumvent security, account, subscription, or usage controls;</li>
        <li>scrape the website or related services; or</li>
        <li>disrupt CutSwitch or related services.</li>
      </ul>

      <h2 className="text-white/90 font-semibold">6. Suspension and termination</h2>
      <p>
        We may suspend or terminate access to CutSwitch if we reasonably
        believe you violated these Terms, engaged in fraud, or initiated a chargeback or payment
        dispute. If that dispute is resolved in your favor, we may restore access.
      </p>

      <h2 className="text-white/90 font-semibold">7. Support</h2>
      <p>
        We aim to provide reasonable support through our Support channels. We do not promise
        specific response times, but we do care about resolving issues quickly because it keeps
        everyone sane.
      </p>

      <h2 className="text-white/90 font-semibold">8. Intellectual property</h2>
      <p>
        CutSwitch and all related intellectual property are owned by {siteConfig.name}. These
        Terms give you a limited, non-exclusive, non-transferable right to use CutSwitch during
        the term of your subscription. That is a right to use the product, not a
        transfer of ownership.
      </p>

      <h2 className="text-white/90 font-semibold">9. Disclaimer</h2>
      <p>
        CutSwitch is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranties
        of any kind, whether express or implied. This includes implied warranties of
        merchantability, fitness for a particular purpose, and non-infringement.
      </p>

      <h2 className="text-white/90 font-semibold">10. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, {siteConfig.name} will not be liable for any
        indirect, incidental, special, consequential, or punitive damages, or for any loss of
        profits or revenues, whether incurred directly or indirectly, or for any loss of data,
        use, goodwill, or other intangible losses resulting from your use of CutSwitch.
      </p>

      <h2 className="text-white/90 font-semibold">11. Changes</h2>
      <p>
        We may update these Terms from time to time. Any updated version will be posted on this
        page with a new &ldquo;Last updated&rdquo; date. The legal equivalent of &ldquo;please
        check back once in a while.&rdquo;
      </p>

      <h2 className="text-white/90 font-semibold">12. Governing law</h2>
      <p>
        These Terms should specify the governing law and venue that apply to your business. This
        section is intentionally left generic and should be reviewed and finalized by counsel
        before publication.
      </p>
    </LegalPage>
  );
}
