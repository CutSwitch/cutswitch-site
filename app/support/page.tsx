import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeading } from "@/components/SectionHeading";
import { SupportForm } from "@/components/support/SupportForm";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Support",
  description: "Get help fast. Email support or send feedback. No refunds, but we fix issues quickly.",
};

export default function SupportPage() {
  return (
    <div className="container-edge">
      <SectionHeading
        eyebrow="Support"
        title="Support that actually helps"
        subtitle="We do not offer refunds. We do offer fast, competent help. If something is broken, confusing, or blocking you, tell us."
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <div className="text-sm font-semibold text-white/90">Email</div>
          <p className="mt-2 text-sm text-white/65">
            Prefer email? Great. It's often the fastest way to fix licensing and device issues.
          </p>

          <div className="mt-4 grid gap-2 text-sm">
            <a className="btn btn-secondary w-fit" href={`mailto:${siteConfig.emails.support}`}>
              {siteConfig.emails.support}
            </a>
            <a className="btn btn-ghost w-fit" href={`mailto:${siteConfig.emails.feedback}`}>
              {siteConfig.emails.feedback}
            </a>
          </div>

          <div className="mt-6 gradient-line" />

          <div className="mt-6 text-sm text-white/70">
            <div className="font-semibold text-white/90">Helpful details to include</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-white/65">
              <li>macOS version</li>
              <li>App version</li>
              <li>What you expected vs what happened</li>
              <li>Any error message screenshots</li>
              <li>License email (if billing related)</li>
            </ul>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Link className="btn btn-ghost" href="/refunds">
              No-refunds policy
            </Link>
            <Link className="btn btn-ghost" href="/terms">
              Terms
            </Link>
            <Link className="btn btn-ghost" href="/privacy">
              Privacy
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold text-white/90">Contact form</div>
          <p className="mt-2 text-sm text-white/65">
            This form posts to <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">/api/support</code>. It logs
            locally and is ready to wire to Resend/Postmark later.
          </p>

          <div className="mt-5">
            <SupportForm />
          </div>
        </div>
      </div>
    </div>
  );
}
