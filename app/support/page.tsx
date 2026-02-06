import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeading } from "@/components/SectionHeading";
import { SupportForm } from "@/components/support/SupportForm";

export const metadata: Metadata = {
  title: "Support",
  description:
    "Get help fast. Use the contact form and include a Cut Plan JSON from File → Export → Export Cut Plan (JSON)… so we can troubleshoot faster.",
};

export default function SupportPage() {
  return (
    <div className="container-edge">
      <SectionHeading
        eyebrow="Support"
        title="Support that actually helps"
        subtitle="If something is broken, confusing, or blocking you, tell us. In the app you can export a Cut Plan JSON via File → Export → Export Cut Plan (JSON)… so we can fix it faster."
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <div className="text-sm font-semibold text-white/90">What helps us troubleshoot fast</div>
          <p className="mt-2 text-sm text-white/65">
            The form on this page is the fastest way to reach us. If you can, include a Cut Plan JSON and a screenshot or two.
          </p>

          <div className="mt-6 text-sm text-white/70">
            <div className="font-semibold text-white/90">Helpful details to include</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-white/65">
              <li>macOS version</li>
              <li>App version</li>
              <li>What you expected vs what happened</li>
              <li>Any error message screenshots</li>
              <li>
                Cut Plan JSON from <span className="text-white/80">File → Export → Export Cut Plan (JSON)…</span> (best)
              </li>
            </ul>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Link className="btn btn-ghost" href="/refunds">
              Refund policy
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
            Don’t want to switch to Mail? Drop a note here and we’ll reply ASAP. Including a Cut Plan JSON helps us move fast.
          </p>

          <div className="mt-5">
            <SupportForm />
          </div>
        </div>
      </div>
    </div>
  );
}
