import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { Badge } from "@/components/admin/AdminShell";
import { formatHours } from "@/lib/admin/data";
import { getAdminSegment } from "@/lib/admin/segments";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { params: { slug: string } };

export default async function AdminSegmentPage({ params }: Props) {
  noStore();
  const result = await getAdminSegment(params.slug);
  if (!result) notFound();
  const { segment, rows } = result;

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5 lg:flex-row lg:items-end">
        <div>
          <Link href="/admin/segments" className="text-sm text-white/55 hover:text-white">&larr; Segments</Link>
          <h2 className="mt-3 text-2xl font-semibold text-white">{segment.title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">{segment.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand">{rows.length.toLocaleString()} users</Badge>
          <Link href="/api/admin/export/segments.csv" className="btn btn-secondary">Export all segments</Link>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-white/10 p-5">
          <h3 className="text-lg font-semibold text-white">Users in segment</h3>
          <p className="mt-1 text-sm text-white/55">Suggested next action: {segment.nextAction}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-white/45">
              <tr>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Used</th>
                <th className="px-5 py-3">Remaining</th>
                <th className="px-5 py-3">Last active</th>
                <th className="px-5 py-3">Reason</th>
                <th className="px-5 py-3">Scores</th>
                <th className="px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {rows.map((user) => (
                <tr key={user.id} className="align-top text-white/75 hover:bg-white/[0.025]">
                  <td className="max-w-[240px] truncate px-5 py-4 font-medium text-white">
                    <Link href={`/admin/users/${user.id}`} className="underline decoration-white/20 underline-offset-4 hover:decoration-white/70">{user.email || "-"}</Link>
                  </td>
                  <td className="px-5 py-4 capitalize">{(user.plan || "none").replace(/_/g, " ")}</td>
                  <td className="px-5 py-4 capitalize">{(user.subscription_status || "none").replace(/_/g, " ")}</td>
                  <td className="px-5 py-4">{formatHours(user.editing_seconds_used)}</td>
                  <td className="px-5 py-4">{formatHours(user.editing_seconds_remaining)}</td>
                  <td className="px-5 py-4">{user.last_active_at ? new Date(user.last_active_at).toLocaleDateString() : "-"}</td>
                  <td className="min-w-[260px] px-5 py-4 text-white/65">{user.reason}</td>
                  <td className="min-w-[220px] px-5 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      <Score label="stuck" value={user.stuckScore} />
                      <Score label="churn" value={user.churnRiskScore} />
                      <Score label="love" value={user.loveScore} />
                      <Score label="heavy" value={user.heavyUserScore} />
                    </div>
                  </td>
                  <td className="min-w-[240px] px-5 py-4 text-white/65">{user.suggestedNextAction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? <div className="p-8 text-center text-sm text-white/55">No users currently match this segment.</div> : null}
      </div>
    </div>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/60">{label} {value}</span>;
}
