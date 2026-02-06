import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Affiliate Terms",
  description: "Terms for the CutSwitch affiliate program.",
};

export default function AffiliateTermsPage() {
  return (
    <LegalPage title="Affiliate Program Terms" updated="2026-01-02">
      <p>
        These Affiliate Program Terms ("Affiliate Terms") govern participation in the CutSwitch affiliate program
        (the “Program”). By applying to or participating in the Program, you agree to these Affiliate Terms in
        addition to our{" "}
        <Link className="underline decoration-white/20 hover:decoration-white/60" href="/terms">
          Terms of Service
        </Link>
        .
      </p>

      <h2 className="text-white/90 font-semibold">1. Program basics</h2>
      <ul className="list-disc pl-5 space-y-2">
        <li>
          We run attribution using Rewardful and charge customers via Stripe. Your referral link (or code, if enabled)
          is how purchases are credited.
        </li>
        <li>
          Commission rates, cookie windows, and payout timing may vary by partner and may change over time.
        </li>
        <li>
          We may refuse or remove any affiliate at our discretion (for example, if traffic sources are low quality or
          non-compliant).
        </li>
      </ul>

      <h2 className="text-white/90 font-semibold">2. FTC/ASA disclosure requirements</h2>
      <p>
        If you promote CutSwitch, you must clearly disclose that you may receive compensation for referrals. Put the
        disclosure near the endorsement (not hidden in a footer). Examples: “I may earn a commission” or “Affiliate
        link.”
      </p>

      <h2 className="text-white/90 font-semibold">3. Prohibited practices</h2>
      <p>To protect users and keep attribution fair, the following are not allowed:</p>
      <ul className="list-disc pl-5 space-y-2">
        <li>Spam (email, DMs, comments) or any unsolicited bulk messaging.</li>
        <li>Cookie stuffing, forced clicks, or any attempt to set a referral without a genuine user action.</li>
        <li>
          Misleading claims (for example: promising guaranteed earnings, misrepresenting features, or implying CutSwitch
          is endorsed by Apple).
        </li>
        <li>Using our brand in a way that confuses users (e.g., pretending to be CutSwitch support).</li>
        <li>
          Buying search ads that bid on our trademark or domain (unless we explicitly approve in writing). This includes
          variations and misspellings.
        </li>
        <li>Promoting via sites or content that are illegal, hateful, or violate others’ rights.</li>
      </ul>

      <h2 className="text-white/90 font-semibold">4. Commissions, chargebacks, and reversals</h2>
      <ul className="list-disc pl-5 space-y-2">
        <li>
          Commissions are typically earned when a customer completes a qualifying purchase that is successfully
          attributed to you.
        </li>
        <li>
          If a payment is reversed, refunded, disputed, or charged back, the related commission may be reversed.
        </li>
        <li>
          We may hold payouts for a reasonable period to account for fraud checks and dispute windows.
        </li>
      </ul>

      <h2 className="text-white/90 font-semibold">5. Taxes</h2>
      <p>
        You are responsible for any taxes owed on commissions. We may request tax forms or payout details as required
        by our payment partners.
      </p>

      <h2 className="text-white/90 font-semibold">6. Brand + content guidelines</h2>
      <p>
        You may describe CutSwitch accurately and use official assets we provide. Do not modify logos in a misleading
        way or imply an official partnership beyond the affiliate relationship.
      </p>

      <h2 className="text-white/90 font-semibold">7. Termination</h2>
      <p>
        You may leave the Program at any time. We may suspend or terminate your participation immediately if we believe
        you violated these Affiliate Terms or engaged in fraud or abuse.
      </p>

      <h2 className="text-white/90 font-semibold">8. Contact</h2>
      <p>
        Affiliate support:{" "}
        <Link className="underline decoration-white/20 hover:decoration-white/60" href="/support">
          contact form
        </Link>
      </p>
    </LegalPage>
  );
}
