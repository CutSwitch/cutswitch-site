import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";

import { Badge, StatCard } from "@/components/admin/AdminShell";
import { formatHours, getAdminJobs } from "@/lib/admin/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATUSES = ["", "succeeded", "failed", "reused", "queued", "running"];
const RANGES = ["all", "7d", "30d", "90d"];
const PLANS = ["", "starter", "creator_pro", "studio"];

type Props = {
  searchParams?: {
    status?: string;
    plan?: string;
    range?: string;
    error_code?: string;
    q?: string;
  };
};

export default async function AdminJobsPage({ searchParams }: Props) {
  noStore();
  const filters = {
    status: searchParams?.status || undefined,
    plan: searchParams?.plan || undefined,
    range: searchParams?.range || "all",
    errorCode: searchParams?.error_code || undefined,
    q: searchParams?.q || undefined,
  };
  const jobs = await getAdminJobs(filters);
  const errorCodeOptions = jobs.summary.topErrorCodes.map((item) => item.code);
  const params = new URLSearchParams({
    ...(filters.q ? { q: filters.q } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.plan ? { plan: filters.plan } : {}),
    ...(filters.range ? { range: filters.range } : {}),
    ...(filters.errorCode ? { error_code: filters.errorCode } : {}),
  });

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Recent jobs" value={jobs.summary.total.toLocaleString()} detail="Filtered transcript/analyze jobs." />
        <StatCard label="Successful jobs" value={jobs.summary.succeeded.toLocaleString()} tone="good" />
        <StatCard label="Failed jobs" value={jobs.summary.failed.toLocaleString()} tone={jobs.summary.failed ? "danger" : "default"} />
        <StatCard label="Reused jobs" value={jobs.summary.reused.toLocaleString()} />
      </div>

      <div className="card overflow-hidden">
        <div className="sticky top-[104px] z-10 flex flex-col justify-between gap-4 border-b border-white/10 bg-[#111426]/95 p-5 backdrop-blur xl:flex-row xl:items-end">
          <div>
            <h2 className="text-xl font-semibold text-white">Jobs & errors</h2>
            <p className="mt-1 text-sm text-white/55">Recent analyze/transcript jobs, failures, and safe error clues.</p>
          </div>
          <form className="flex flex-wrap gap-2" action="/admin/jobs">
            <label className="grid gap-1 text-xs text-white/45">
              <span>Search</span>
              <input className="w-48 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand/60" name="q" defaultValue={filters.q || ""} placeholder="Email, error, app" />
            </label>
            <Select name="status" label="Status" value={filters.status || ""} values={STATUSES} />
            <Select name="plan" label="Plan" value={filters.plan || ""} values={PLANS} />
            <Select name="range" label="Range" value={filters.range || "all"} values={RANGES} />
            <label className="grid gap-1 text-xs text-white/45">
              <span>Error code</span>
              <input className="w-40 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand/60" name="error_code" defaultValue={filters.errorCode || ""} placeholder="Any" list="recent-error-codes" />
              <datalist id="recent-error-codes">
                {errorCodeOptions.map((code) => <option key={code} value={code} />)}
              </datalist>
            </label>
            <button className="btn btn-secondary self-end" type="submit">Filter</button>
            <Link className="btn btn-secondary self-end" href="/admin/jobs">Clear</Link>
          </form>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4 text-sm text-white/55">
          <div className="flex flex-wrap items-center gap-2">
            <span>Showing {jobs.rows.length.toLocaleString()} jobs. Default is all history so quiet weeks do not look broken.</span>
            <QuickChip href="/admin/jobs?status=failed&range=all">Failed</QuickChip>
            <QuickChip href="/admin/jobs?status=running&range=all">Running</QuickChip>
            <QuickChip href="/admin/jobs?status=reused&range=all">Reused</QuickChip>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="btn btn-secondary" href={`/api/admin/export/jobs.csv?${params.toString()}`}>Export CSV</Link>
            <Link className="btn btn-secondary" href={`/api/admin/export/jobs.json?${params.toString()}`}>Export JSON</Link>
          </div>
        </div>

        <div className="grid gap-3 border-b border-white/10 p-5 lg:grid-cols-4">
          {jobs.summary.topErrorCodes.length ? jobs.summary.topErrorCodes.map((item) => (
            <div key={item.code} className="rounded-2xl border border-red-300/20 bg-red-400/10 p-4">
              <div className="font-mono text-sm text-red-100">{item.code}</div>
              <div className="mt-2 text-xs text-white/50">{item.count} failures</div>
            </div>
          )) : <div className="text-sm text-white/50">No error codes in this filter.</div>}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-white/45">
              <tr>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Duration</th>
                <th className="px-5 py-3">Error</th>
                <th className="px-5 py-3">App</th>
                <th className="px-5 py-3">Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {jobs.rows.map((job) => (
                <tr key={job.id} className="align-top text-white/75 hover:bg-white/[0.025]">
                  <td className="px-5 py-4">{job.created_at ? new Date(job.created_at).toLocaleString() : "—"}</td>
                  <td className="max-w-[260px] truncate px-5 py-4 text-white">{job.user_email || "—"}</td>
                  <td className="px-5 py-4"><StatusBadge status={job.status} /></td>
                  <td className="px-5 py-4">{formatHours(job.duration_seconds)}</td>
                  <td className="min-w-[240px] px-5 py-4"><div className="font-mono text-xs text-white/70">{job.error_code || "—"}</div>{job.error_message ? <div className="mt-1 line-clamp-2 text-xs text-white/45">{job.error_message}</div> : null}</td>
                  <td className="px-5 py-4">{job.app_version || "—"}</td>
                  <td className="px-5 py-4">{job.completed_at ? new Date(job.completed_at).toLocaleString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {jobs.rows.length === 0 ? (
          <div className="p-8 text-center">
            <h3 className="text-lg font-semibold text-white">No jobs match these filters.</h3>
            <p className="mt-2 text-sm text-white/55">Try range “all”, remove the error code, or clear filters. No jobs in a quiet period is good news, but terrible UI if we do not say so.</p>
            <div className="mt-4 flex justify-center gap-2">
              <Link href="/admin/jobs?range=all" className="btn btn-secondary">Try all history</Link>
              <Link href="/admin/jobs" className="btn btn-secondary">Clear filters</Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function QuickChip({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/65 transition hover:border-brand/40 hover:bg-brand/15 hover:text-white">{children}</Link>;
}

function Select({ name, label, value, values }: { name: string; label: string; value: string; values: string[] }) {
  return (
    <label className="grid gap-1 text-xs text-white/45">
      <span>{label}</span>
      <select name={name} defaultValue={value} className="rounded-xl border border-white/10 bg-[#0E1020] px-3 py-2 text-sm text-white/80 outline-none focus:ring-2 focus:ring-brand/60">
        {values.map((item) => <option key={item || "all"} value={item}>{item ? item.replace(/_/g, " ") : "All"}</option>)}
      </select>
    </label>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (status === "failed") return <Badge tone="danger">failed</Badge>;
  if (status === "succeeded") return <Badge tone="good">succeeded</Badge>;
  if (status === "reused") return <Badge tone="brand">reused</Badge>;
  return <Badge>{status || "unknown"}</Badge>;
}
