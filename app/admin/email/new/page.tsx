import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";

import { Badge } from "@/components/admin/AdminShell";
import { EmailCampaignCreateForm } from "@/components/admin/EmailCampaignCreateForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function NewEmailCampaignPage() {
  noStore();
  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5 lg:flex-row lg:items-end">
        <div>
          <Link href="/admin/email" className="text-sm text-white/55 hover:text-white">&larr; Email campaigns</Link>
          <h2 className="mt-3 text-2xl font-semibold text-white">New segmented email</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
            Build a draft from a known segment. Dry-run preview runs before creation; no email sends from this page.
          </p>
        </div>
        <Badge tone="warning">Dry-run first</Badge>
      </div>
      <EmailCampaignCreateForm />
    </div>
  );
}
