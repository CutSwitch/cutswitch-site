import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import type { ReactNode } from "react";

import { Badge, StatCard } from "@/components/admin/AdminShell";
import { formatHours, getAdminUserDetail } from "@/lib/admin/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { params: { id: string } };

export default async function AdminUserDetailPage({ params }: Props) {
  noStore();
  const detail = await getAdminUserDetail(params.id);
  if (!detail) notFound();

  const { row, user } = detail;
  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5 lg:flex-row lg:items-end">
        <div>
          <Link href="/admin/users" className="text-sm text-white/55 hover:text-white">← Users</Link>
          <h2 className="mt-3 text-2xl font-semibold text-white">{user.email || "Unknown user"}</h2>
          <p className="mt-1 text-sm text-white/50">User ID: <span className="font-mono">{user.id}</span></p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="brand">{(row.plan || "no plan").replace(/_/g, " ")}</Badge>
          <Badge tone={row.subscription_status === "active" ? "good" : row.subscription_status === "trialing" ? "warning" : "default"}>{(row.subscription_status || "no subscription").replace(/_/g, " ")}</Badge>
          <Badge tone={row.signal === "Stuck" ? "danger" : row.signal === "Near quota" || row.signal === "Trial inactive" ? "warning" : "good"}>{row.signal}</Badge>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Editing time used" value={formatHours(row.editing_seconds_used)} />
        <StatCard label="Editing time remaining" value={formatHours(row.editing_seconds_remaining)} />
        <StatCard label="Successful jobs" value={row.successful_jobs.toLocaleString()} tone="good" />
        <StatCard label="Failed jobs" value={row.failed_jobs.toLocaleString()} tone={row.failed_jobs ? "danger" : "default"} />
        <StatCard label="Reused transcripts/projects" value={detail.reusedCount.toLocaleString()} />
        <StatCard label="Feedback count" value={detail.feedback.length.toLocaleString()} />
        <StatCard label="First successful run" value={detail.firstSuccessfulRunAt ? new Date(detail.firstSuccessfulRunAt).toLocaleDateString() : "—"} />
        <StatCard label="Last active" value={row.last_active_at ? new Date(row.last_active_at).toLocaleDateString() : "—"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Recent product events">
          <TimelineEmpty show={!detail.productEvents.length} label="No product events yet." />
          {detail.productEvents.map((event, index) => (
            <TimelineItem key={`${event.created_at}-${index}`} title={event.event_type.replace(/_/g, " ")} date={event.created_at} meta={[event.screen, event.app_version, event.project_fingerprint ? `project ${event.project_fingerprint.slice(0, 12)}` : null].filter(Boolean).join(" · ")} />
          ))}
        </Panel>

        <Panel title="Recent jobs">
          <TimelineEmpty show={!detail.jobs.length} label="No transcript/analyze jobs yet." />
          {detail.jobs.map((job) => (
            <TimelineItem key={job.id} title={(job.status || "unknown").replace(/_/g, " ")} date={job.created_at} meta={[job.duration_seconds ? `${Math.round(job.duration_seconds / 60)} min` : null, job.error_code, job.error_message].filter(Boolean).join(" · ")} tone={job.status === "failed" ? "danger" : job.status === "succeeded" ? "good" : "default"} />
          ))}
        </Panel>
      </div>

      <Panel title="Recent feedback">
        <TimelineEmpty show={!detail.feedback.length} label="No feedback from this user yet." />
        <div className="grid gap-3">
          {detail.feedback.map((item) => (
            <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={item.type === "bug" ? "danger" : item.type === "praise" ? "good" : "default"}>{item.type}</Badge>
                <Badge tone={item.severity === "urgent" ? "danger" : item.severity === "high" ? "warning" : "default"}>{item.severity}</Badge>
                <span className="text-xs text-white/40">{new Date(item.created_at).toLocaleString()}</span>
              </div>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/70">{item.message}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="card p-5"><h3 className="text-lg font-semibold text-white">{title}</h3><div className="mt-4 grid gap-3">{children}</div></section>;
}

function TimelineEmpty({ show, label }: { show: boolean; label: string }) {
  return show ? <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/50">{label}</div> : null;
}

function TimelineItem({ title, date, meta, tone = "default" }: { title: string; date: string | null; meta?: string; tone?: "default" | "danger" | "good" }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <Badge tone={tone}>{title}</Badge>
        <span className="text-xs text-white/40">{date ? new Date(date).toLocaleString() : "—"}</span>
      </div>
      {meta ? <div className="mt-2 text-sm text-white/55">{meta}</div> : null}
    </div>
  );
}
