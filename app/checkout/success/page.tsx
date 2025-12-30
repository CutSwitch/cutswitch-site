import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeading } from "@/components/SectionHeading";
import { SuccessClient } from "@/components/checkout/SuccessClient";

export const metadata: Metadata = {
  title: "Success",
  description: "Thanks for purchasing CutSwitch.",
};

export default function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const sessionIdRaw = searchParams["session_id"];
  const sessionId = Array.isArray(sessionIdRaw) ? sessionIdRaw[0] : sessionIdRaw;

  return (
    <div className="container-edge">
      <SectionHeading
        eyebrow="Checkout"
        title="You're in"
        subtitle="Receipt confirmed. License delivery happens via email from our system."
      />

      <div className="mt-8">
        {sessionId ? (
          <SuccessClient sessionId={sessionId} />
        ) : (
          <div className="card p-6">
            <div className="text-sm font-semibold text-white/90">Missing session ID</div>
            <p className="mt-2 text-sm text-white/65">
              If you completed checkout but landed here without a session ID, check your email for the receipt or contact Support.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Link className="btn btn-secondary" href="/support">
                Contact Support
              </Link>
              <Link className="btn btn-ghost" href="/pricing">
                Back to pricing
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
