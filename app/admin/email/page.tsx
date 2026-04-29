import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";

import { Badge } from "@/components/admin/AdminShell";
import { campaignSegmentLabel, getCampaigns } from "@/lib/admin/emailCampaigns";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminEmailPage() {
  noStore();
  const campaigns = await getCampaigns();

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5 lg:flex-row lg:items-end">
        <div>
          <h2 className="text-2xl font-semibold text-white">Segmented email</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
            Targeted campaigns with dry-run previews, suppression checks, review gates, and audit logs. Not a blast cannon.
          </p>
        </div>
        <Link href="/admin/email/new" className="btn btn-primary">New campaign</Link>
      </div>

      {campaigns.schemaMissing ? (
        <div className="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-5 text-sm text-amber-50">
          Apply the Phase 3C email campaign migration before using segmented email.
        </div>
      ) : null}

      <div className="card overflow-hidden">
        <div className="border-b border-white/10 p-5">
          <h3 className="text-lg font-semibold text-white">Campaigns</h3>
          <p className="mt-1 text-sm text-white/55">Draft, review, test, then explicitly confirm final sends.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-white/45">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Segment</th>
                <th className="px-5 py-3">Subject</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {campaigns.rows.map((campaign) => (
                <tr key={campaign.id} className="text-white/75 hover:bg-white/[0.025]">
                  <td className="max-w-[260px] truncate px-5 py-4 font-medium text-white">
                    <Link className="underline decoration-white/20 underline-offset-4 hover:decoration-white/70" href={`/admin/email/${campaign.id}`}>{campaign.name}</Link>
                  </td>
                  <td className="px-5 py-4">{campaignSegmentLabel(campaign.segment_key)}</td>
                  <td className="max-w-[360px] truncate px-5 py-4">{campaign.subject}</td>
                  <td className="px-5 py-4"><StatusBadge status={campaign.status} /></td>
                  <td className="px-5 py-4">{campaign.created_at ? new Date(campaign.created_at).toLocaleDateString() : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {campaigns.rows.length === 0 ? <div className="p-8 text-center text-sm text-white/55">No campaigns yet.</div> : null}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "sent") return <Badge tone="good">sent</Badge>;
  if (status === "reviewed") return <Badge tone="brand">reviewed</Badge>;
  if (status === "sending") return <Badge tone="warning">sending</Badge>;
  if (status === "canceled") return <Badge tone="danger">canceled</Badge>;
  return <Badge>draft</Badge>;
}
