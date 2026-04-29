import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { Badge } from "@/components/admin/AdminShell";
import { EmailCampaignActions } from "@/components/admin/EmailCampaignActions";
import { campaignSegmentLabel, getCampaign } from "@/lib/admin/emailCampaigns";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { params: { id: string } };

export default async function EmailCampaignDetailPage({ params }: Props) {
  noStore();
  const result = await getCampaign(params.id);
  if (!result) notFound();
  const { campaign, recipients } = result;
  const counts = {
    pending: recipients.filter((row) => row.status === "pending").length,
    suppressed: recipients.filter((row) => row.status === "suppressed").length,
    invalid: recipients.filter((row) => row.status === "invalid").length,
    sent: recipients.filter((row) => row.status === "sent").length,
    failed: recipients.filter((row) => row.status === "failed").length,
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5 lg:flex-row lg:items-end">
        <div>
          <Link href="/admin/email" className="text-sm text-white/55 hover:text-white">&larr; Email campaigns</Link>
          <h2 className="mt-3 text-2xl font-semibold text-white">{campaign.name}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">{campaign.subject}</p>
        </div>
        <StatusBadge status={campaign.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-6">
          <div className="card p-5">
            <div className="grid gap-3 sm:grid-cols-5">
              <Stat label="Pending" value={counts.pending} />
              <Stat label="Suppressed" value={counts.suppressed} />
              <Stat label="Invalid" value={counts.invalid} />
              <Stat label="Sent" value={counts.sent} />
              <Stat label="Failed" value={counts.failed} />
            </div>
            <div className="mt-4 text-sm text-white/55">Segment: {campaignSegmentLabel(campaign.segment_key)}</div>
          </div>

          <div className="card p-5">
            <h3 className="text-lg font-semibold text-white">Message preview</h3>
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm uppercase tracking-[0.16em] text-white/35">Subject</div>
              <div className="mt-2 text-white">{campaign.subject}</div>
              <div className="mt-5 text-sm uppercase tracking-[0.16em] text-white/35">Body</div>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-6 text-white/70">{campaign.body_markdown}</pre>
              <div className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-50">
                Compliance footer is appended automatically with support/contact opt-out language. Dedicated unsubscribe route remains unresolved.
              </div>
            </div>
          </div>
        </div>

        <EmailCampaignActions id={campaign.id} status={campaign.status} />
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-white/10 p-5">
          <h3 className="text-lg font-semibold text-white">Recipients</h3>
          <p className="mt-1 text-sm text-white/55">Suppressed and invalid recipients are skipped. Final send uses pending recipients only.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-white/45">
              <tr>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Reason/Error</th>
                <th className="px-5 py-3">Sent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {recipients.map((recipient) => (
                <tr key={recipient.id} className="text-white/75 hover:bg-white/[0.025]">
                  <td className="max-w-[280px] truncate px-5 py-4 font-medium text-white">{recipient.email}</td>
                  <td className="px-5 py-4"><RecipientBadge status={recipient.status} /></td>
                  <td className="max-w-[360px] truncate px-5 py-4 text-white/55">{recipient.suppression_reason || recipient.error_message || "-"}</td>
                  <td className="px-5 py-4">{recipient.sent_at ? new Date(recipient.sent_at).toLocaleString() : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className="text-xs uppercase tracking-[0.16em] text-white/35">{label}</div>
      <div className="mt-2 text-xl font-semibold text-white">{value.toLocaleString()}</div>
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

function RecipientBadge({ status }: { status: string }) {
  if (status === "sent") return <Badge tone="good">sent</Badge>;
  if (status === "failed" || status === "invalid") return <Badge tone="danger">{status}</Badge>;
  if (status === "suppressed") return <Badge tone="warning">suppressed</Badge>;
  return <Badge>pending</Badge>;
}
