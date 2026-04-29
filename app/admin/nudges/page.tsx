import { unstable_noStore as noStore } from "next/cache";

import { Badge } from "@/components/admin/AdminShell";
import { NudgeActions } from "@/components/admin/NudgeActions";
import { ensureNudgeDrafts, getNudgeQueue } from "@/lib/admin/nudges";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminNudgesPage() {
  noStore();
  const generation = await ensureNudgeDrafts();
  const queue = await getNudgeQueue();
  const rows = queue.rows;

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5 lg:flex-row lg:items-end">
        <div>
          <h2 className="text-2xl font-semibold text-white">Contextual nudge queue</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
            Prepared nudge drafts for review. Only reviewed one-off nudges can be sent; bulk sending is still disabled.
          </p>
        </div>
        <a href="/api/admin/export/nudges.csv" className="btn btn-secondary">Export nudges</a>
      </div>

      {queue.schemaMissing || generation.schemaMissing ? (
        <div className="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-5 text-sm text-amber-50">
          Apply the Phase 2C nudge_events migration before using the nudge queue.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Draft" value={rows.filter((row) => row.status === "draft").length} />
          <Stat label="Reviewed" value={rows.filter((row) => row.status === "reviewed").length} />
          <Stat label="Suppressed" value={rows.filter((row) => row.status === "suppressed").length} />
          <Stat label="Sent" value={rows.filter((row) => row.status === "sent").length} />
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="border-b border-white/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">Review queue</h3>
              <p className="mt-1 text-sm text-white/55">Mark good drafts reviewed, suppress noisy ones, or copy a message for manual use.</p>
            </div>
            <Badge tone="brand">One-off only</Badge>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-white/45">
              <tr>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Reason</th>
                <th className="px-5 py-3">Message</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {rows.map((row) => (
                <tr key={row.id} className="align-top text-white/75 hover:bg-white/[0.025]">
                  <td className="max-w-[240px] truncate px-5 py-4 font-medium text-white">{row.user_email || "-"}</td>
                  <td className="px-5 py-4"><Badge tone={badgeTone(row.nudge_type)}>{row.nudge_type.replace(/_/g, " ")}</Badge></td>
                  <td className="min-w-[240px] px-5 py-4 text-white/60">{row.trigger_reason || "-"}</td>
                  <td className="min-w-[360px] px-5 py-4">
                    <div className="font-medium text-white">{row.subject || "Untitled nudge"}</div>
                    <p className="mt-2 line-clamp-4 leading-6 text-white/60">{row.message || "-"}</p>
                  </td>
                  <td className="px-5 py-4"><StatusBadge status={row.status} /></td>
                  <td className="px-5 py-4">{row.created_at ? new Date(row.created_at).toLocaleDateString() : "-"}</td>
                  <td className="min-w-[260px] px-5 py-4"><NudgeActions id={row.id} subject={row.subject || ""} message={row.message || ""} status={row.status} userEmail={row.user_email} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? <div className="p-8 text-center text-sm text-white/55">No nudge drafts yet.</div> : null}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="text-xs uppercase tracking-[0.18em] text-white/45">{label}</div>
      <div className="mt-3 text-2xl font-semibold text-white">{value.toLocaleString()}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "reviewed") return <Badge tone="good">reviewed</Badge>;
  if (status === "suppressed") return <Badge tone="warning">suppressed</Badge>;
  if (status === "sent") return <Badge tone="brand">sent</Badge>;
  if (status === "sent_placeholder") return <Badge tone="brand">sent placeholder</Badge>;
  return <Badge>draft</Badge>;
}

function badgeTone(type: string) {
  if (type.includes("failed") || type.includes("exhausted") || type.includes("error")) return "danger" as const;
  if (type.includes("heavy") || type.includes("praise")) return "good" as const;
  if (type.includes("quota") || type.includes("trial")) return "warning" as const;
  return "default" as const;
}
