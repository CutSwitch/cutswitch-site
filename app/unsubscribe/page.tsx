import type { Metadata } from "next";
import Link from "next/link";

import { UnsubscribeForm } from "@/components/privacy/UnsubscribeForm";

export const metadata: Metadata = {
  title: "Email preferences",
  description: "Opt out of nonessential CutSwitch emails.",
  robots: {
    index: false,
    follow: false,
  },
};

function safeEmail(value: string | string[] | undefined) {
  const email = Array.isArray(value) ? value[0] : value;
  if (!email) return "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

export default function UnsubscribePage({
  searchParams,
}: {
  searchParams?: { email?: string | string[] };
}) {
  return (
    <div className="container-edge">
      <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20">
        <p className="text-sm text-brand-light">Email preferences</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Opt out of nonessential emails</h1>
        <p className="mt-3 text-sm leading-6 text-white/65">
          We will stop marketing, lifecycle, and admin nudge emails for this address. You may still receive account,
          security, billing, support, and other transactional emails needed to run CutSwitch.
        </p>

        <div className="mt-6">
          <UnsubscribeForm initialEmail={safeEmail(searchParams?.email)} />
        </div>

        <p className="mt-6 text-xs leading-5 text-white/45">
          Need something else, like account deletion or a data access request? Use the{" "}
          <Link className="underline decoration-white/20 hover:decoration-white/60" href="/support">
            support form
          </Link>{" "}
          and choose Privacy / data request.
        </p>
      </div>
    </div>
  );
}
