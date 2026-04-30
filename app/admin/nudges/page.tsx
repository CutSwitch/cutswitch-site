import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";

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
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/nudges" className="btn btn-secondary">Create drafts</Link>
          <a href="/api/admin/export/nudges.csv" className="btn btn-secondary">Export nudges</a>
        </div>
      </div>

      {queue.schemaMissing || generation.schemaMissing ? (
        <SetupChecklist
          items={[
            { label: "Phase 2C migration applied", state: "missing", detail: "nudge_events is not available yet." },
            { label: "Draft review workflow", state: "ready", detail: "Review/suppress/copy actions are built." },
            { label: "Email sending", state: "watch", detail: "One-off reviewed sends only; no bulk sending." },
          ]}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Draft" value={rows.filter((row) => row.status === "draft").length} />
          <Stat label="Reviewed" value={rows.filter((row) => row.status === "reviewed").length} />
          <Stat label="Suppressed" value={rows.filter((row) => row.status === "suppressed").length} />
          <Stat label="Sent" value={rows.filter((row) => row.status === "sent").length} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <TemplateCard title="Trial never ran" subject="Want help creating your first CutSwitch edit?" />
        <TemplateCard title="Failed twice" subject="Looks like CutSwitch hit a snag" />
        <TemplateCard title="Praise" subject="Could we quote your CutSwitch feedback?" />
      </div>

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
        {rows.length === 0 ? (
          <div className="p-8 text-center">
            <h3 className="text-lg font-semibold text-white">No nudge drafts yet.</h3>
            <p className="mt-2 text-sm text-white/55">Refresh this page to generate drafts from current segments, or inspect segments first to see who qualifies.</p>
            <div className="mt-4 flex justify-center gap-2">
              <Link href="/admin/nudges" className="btn btn-secondary">Generate drafts</Link>
              <Link href="/admin/segments" className="btn btn-secondary">View segments</Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SetupChecklist({ items }: { items: Array<{ label: string; state: "ready" | "watch" | "missing"; detail: string }> }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <h3 className="text-lg font-semibold text-white">Setup checklist</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {items.map((item) => (
          <Link key={item.label} href="/admin/nudges" className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-brand/35 hover:bg-brand/10">
            <div className="flex items-center gap-2 font-medium text-white">
              <span>{item.state === "ready" ? "✅" : item.state === "watch" ? "⚠️" : "❌"}</span>
              <span>{item.label}</span>
            </div>
            <p className="mt-2 text-sm leading-5 text-white/50">{item.detail}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function TemplateCard({ title, subject }: { title: string; subject: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="text-xs uppercase tracking-[0.18em] text-white/40">Draft template</div>
      <h3 className="mt-2 font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-5 text-white/55">{subject}</p>
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
