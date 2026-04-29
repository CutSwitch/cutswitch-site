import { unstable_noStore as noStore } from "next/cache";

import { Badge, StatCard } from "@/components/admin/AdminShell";
import { getLifecycleEvents, getLifecycleProviderStatus } from "@/lib/lifecycle";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminLifecyclePage() {
  noStore();
  const provider = getLifecycleProviderStatus();
  const events = await getLifecycleEvents(150);
  const rows = events.rows;

  const sent = rows.filter((row) => row.status === "sent").length;
  const failed = rows.filter((row) => row.status === "failed").length;
  const skipped = rows.filter((row) => row.status === "skipped").length;

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5 lg:flex-row lg:items-end">
        <div>
          <h2 className="text-2xl font-semibold text-white">Lifecycle events</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
            Safe product and billing signals prepared for lifecycle email tooling. Resend transactional email stays separate.
          </p>
        </div>
        <Badge tone={provider.enabled ? (provider.configured ? "good" : "warning") : "default"}>
          {provider.provider === "none" ? "provider disabled" : `${provider.provider} ${provider.configured ? "configured" : "needs env"}`}
        </Badge>
      </div>

      {events.schemaMissing ? (
        <div className="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-5 text-sm text-amber-50">
          Apply the Phase 3B lifecycle_events migration before using this page.
        </div>
      ) : null}

      {provider.unresolved ? (
        <div className="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-5 text-sm text-amber-50">
          [Unresolved] {provider.unresolved}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Recent events" value={rows.length.toLocaleString()} detail="Latest lifecycle records." />
        <StatCard label="Sent" value={sent.toLocaleString()} detail="Delivered to the configured provider." tone="good" />
        <StatCard label="No-op/skipped" value={skipped.toLocaleString()} detail="Recorded without provider sending." />
        <StatCard label="Failed" value={failed.toLocaleString()} detail="Provider or config failures." tone={failed ? "danger" : "default"} />
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-white/10 p-5">
          <h3 className="text-lg font-semibold text-white">Recent lifecycle activity</h3>
          <p className="mt-1 text-sm text-white/55">Only safe metadata is recorded. No transcripts, raw paths, FCPXML, tokens, or provider secrets.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-white/45">
              <tr>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Event</th>
                <th className="px-5 py-3">Provider</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {rows.map((row) => (
                <tr key={row.id} className="align-top text-white/75 hover:bg-white/[0.025]">
                  <td className="whitespace-nowrap px-5 py-4">{row.created_at ? new Date(row.created_at).toLocaleString() : "-"}</td>
                  <td className="max-w-[240px] truncate px-5 py-4 font-medium text-white">{row.user_email || row.user_id || "-"}</td>
                  <td className="px-5 py-4"><Badge tone="brand">{row.event_name.replace(/_/g, " ")}</Badge></td>
                  <td className="px-5 py-4">{row.provider || "-"}</td>
                  <td className="px-5 py-4"><StatusBadge status={row.status} /></td>
                  <td className="max-w-[320px] truncate px-5 py-4 text-white/55">{row.error_message || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? <div className="p-8 text-center text-sm text-white/55">No lifecycle events yet.</div> : null}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "sent") return <Badge tone="good">sent</Badge>;
  if (status === "failed") return <Badge tone="danger">failed</Badge>;
  if (status === "skipped") return <Badge>skipped</Badge>;
  return <Badge tone="warning">queued</Badge>;
}
