import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeading } from "@/components/SectionHeading";
import { PortalLinkForm } from "@/components/account/PortalLinkForm";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Account",
  description: "Manage your CutSwitch subscription and get help with licensing and devices.",
};

export default function AccountPage() {
  return (
    <div className="container-edge">
      <SectionHeading
        eyebrow="Account"
        title="Manage subscription and devices"
        subtitle="This is a lightweight customer portal. For security, we email you a Stripe Billing Portal link instead of showing it publicly."
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <div className="text-sm font-semibold text-white/90">Subscription management</div>
          <p className="mt-2 text-sm text-white/65">
            Enter the email you used at checkout and we'll send a secure link to manage your subscription (cancel,
            update payment method, view invoices).
          </p>

          <div className="mt-5">
            <PortalLinkForm />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold text-white/90">Licensing + devices</div>
          <p className="mt-2 text-sm text-white/65">
            CutSwitch licenses are limited to <strong className="text-white/90">2 active Macs</strong>.
            Device activations are enforced via Keygen. If you hit the limit unexpectedly, Support can help.
          </p>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Link className="btn btn-secondary" href="/support">
              Contact Support
            </Link>
            <a className="btn btn-ghost" href={`mailto:${siteConfig.emails.support}`}>
              Email support
            </a>
          </div>

          <div className="mt-6 gradient-line" />

          <p className="mt-6 text-sm text-white/65">
            Reminder: <Link className="underline decoration-white/20 hover:decoration-white/60" href="/refunds">no refunds</Link>.
            If you think you're being charged incorrectly, contact Support and we will investigate.
          </p>
        </div>
      </div>
    </div>
  );
}
