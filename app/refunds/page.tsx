import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "CutSwitch does not offer refunds. All sales are final.",
};

export default function RefundsPage() {
  return (
    <LegalPage title="Refund Policy" updated="2025-12-30">
      <p className="rounded-xl border border-brand/30 bg-white/5 p-4 text-white/75">
        <strong className="text-white/95">No refunds.</strong> CutSwitch is a digital product. All purchases are final,
        and we do not offer refunds.
      </p>

      <p>
        We make this policy clear before checkout to reduce confusion and chargebacks. If something is not working,
        please contact Support and we will help you resolve it quickly.
      </p>

      <p>
        Support:{" "}
        <a className="underline decoration-white/20 hover:decoration-white/60" href={`mailto:${siteConfig.emails.support}`}>
          {siteConfig.emails.support}
        </a>
      </p>

      <h2 className="text-white/90 font-semibold">What we will do instead</h2>
      <ul className="list-disc pl-5 space-y-2">
        <li>Help you troubleshoot installation and licensing issues.</li>
        <li>Fix product bugs and ship updates.</li>
        <li>
         If you're stuck, we'll work with you to get CutSwitch behaving the way it's supposed to.
        </li>
      </ul>

      <h2 className="text-white/90 font-semibold">Subscriptions</h2>
      <p>
        Subscription plans include a 7-day trial. If you cancel during the trial, you will not be charged. After the
        trial, canceling stops future renewals. It does not trigger refunds for past charges.
      </p>

      <p>
        Also see our <Link className="underline decoration-white/20 hover:decoration-white/60" href="/terms">Terms</Link>.
      </p>
    </LegalPage>
  );
}
