import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeading } from "@/components/SectionHeading";

export const metadata: Metadata = {
  title: "Checkout canceled",
  description: "Your checkout was canceled.",
};

export default function CheckoutCanceledPage() {
  return (
    <div className="container-edge">
      <SectionHeading
        eyebrow="Checkout"
        title="Checkout canceled"
        subtitle="No worries. Nothing was charged. When you're ready, you can try again."
      />

      <div className="mt-8 card p-6">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link className="btn btn-primary" href="/pricing">
            Return to pricing <span className="text-white/80">→</span>
          </Link>
          <Link className="btn btn-secondary" href="/support">
            Contact Support
          </Link>
        </div>

        <p className="mt-4 text-sm text-white/65">
          If you hit an error in Stripe Checkout, tell us what happened and we'll fix it.
        </p>
      </div>
    </div>
  );
}
