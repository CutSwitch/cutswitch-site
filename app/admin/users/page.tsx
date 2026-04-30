import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";

import { Badge } from "@/components/admin/AdminShell";
import { CopyButton } from "@/components/admin/CopyButton";
import { formatHours, getAdminUsers } from "@/lib/admin/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SIGNALS = ["", "Active", "Stuck", "Near quota", "Heavy user", "Trial inactive"];
const STATUSES = ["", "active", "trialing", "inactive", "churn-risk"];
const PLANS = ["", "starter", "creator_pro", "studio"];
const RANGES = ["", "7d", "30d", "90d"];
const SORTS = ["last_active", "used", "plan", "email"];

type Props = {
  searchParams?: {
    q?: string;
    signal?: string;
    status?: string;
    plan?: string;
    range?: string;
    sort?: string;
    page?: string;
  };
};

export default async function AdminUsersPage({ searchParams }: Props) {
  noStore();
  const page = Number(searchParams?.page || "1");
  const q = searchParams?.q || "";
  const signal = searchParams?.signal || "";
  const status = searchParams?.status || "";
  const plan = searchParams?.plan || "";
  const range = searchParams?.range || "";
  const sort = searchParams?.sort || "last_active";
  const result = await getAdminUsers({ search: q, signal: signal || undefined, status: status || undefined, plan: plan || undefined, range: range || undefined, sort, page });
  const lastPage = Math.max(1, Math.ceil(result.total / result.pageSize));
  const params = new URLSearchParams({
    ...(q ? { q } : {}),
    ...(signal ? { signal } : {}),
    ...(status ? { status } : {}),
    ...(plan ? { plan } : {}),
    ...(range ? { range } : {}),
    ...(sort ? { sort } : {}),
  });

  return (
    <div className="card overflow-hidden">
      <div className="sticky top-[104px] z-10 flex flex-col justify-between gap-4 border-b border-white/10 bg-[#111426]/95 p-5 backdrop-blur sm:flex-row sm:items-end">
        <div>
          <h2 className="text-xl font-semibold text-white">Users</h2>
          <p className="mt-1 text-sm text-white/55">Search accounts, plan state, editing time, and simple action signals.</p>
        </div>
        <form className="flex flex-wrap gap-2" action="/admin/users">
          <input
            className="w-64 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:ring-2 focus:ring-brand/60"
            name="q"
            defaultValue={q}
            placeholder="Search email"
          />
          <Select name="status" label="Status" value={status} values={STATUSES} />
          <Select name="plan" label="Plan" value={plan} values={PLANS} />
          <Select name="range" label="Last active" value={range} values={RANGES} />
          <select
            name="signal"
            defaultValue={signal}
            className="rounded-xl border border-white/10 bg-[#0E1020] px-3 py-2 text-sm text-white/80 outline-none focus:ring-2 focus:ring-brand/60"
          >
            {SIGNALS.map((item) => <option key={item || "all"} value={item}>{item || "All signals"}</option>)}
          </select>
          <Select name="sort" label="Sort" value={sort} values={SORTS} />
          <button className="btn btn-secondary" type="submit">Search</button>
          <Link className="btn btn-secondary" href="/admin/users">Clear</Link>
        </form>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4 text-sm text-white/55">
        <div>{result.total.toLocaleString()} users match current filters.</div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn btn-secondary" href={`/api/admin/export/users.csv?${params.toString()}`}>Export CSV</Link>
          <Link className="btn btn-secondary" href={`/api/admin/export/users.json?${params.toString()}`}>Export JSON</Link>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-white/10 text-left text-sm">
          <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-white/45">
            <tr>
              <th className="px-5 py-3">Email</th>
              <th className="px-5 py-3">Plan</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Used</th>
              <th className="px-5 py-3">Remaining</th>
              <th className="px-5 py-3">Last event</th>
              <th className="px-5 py-3">Last active</th>
              <th className="px-5 py-3">Signal</th>
              <th className="px-5 py-3">Tags</th>
              <th className="px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {result.rows.map((user) => (
              <tr key={user.id} className="text-white/75 hover:bg-white/[0.025]">
                <td className="max-w-[260px] truncate px-5 py-4 font-medium text-white">
                  <Link className="underline decoration-white/20 underline-offset-4 hover:decoration-white/70" href={`/admin/users/${user.id}`}>
                    {user.email || "—"}
                  </Link>
                </td>
                <td className="px-5 py-4 capitalize">{(user.plan || "none").replace(/_/g, " ")}</td>
                <td className="px-5 py-4 capitalize">{(user.subscription_status || "none").replace(/_/g, " ")}</td>
                <td className="px-5 py-4">{formatHours(user.editing_seconds_used)}</td>
                <td className="px-5 py-4">{formatHours(user.editing_seconds_remaining)}</td>
                <td className="px-5 py-4">{user.last_product_event ? user.last_product_event.replace(/_/g, " ") : "—"}</td>
                <td className="px-5 py-4">{user.last_active_at ? new Date(user.last_active_at).toLocaleDateString() : "—"}</td>
                <td className="px-5 py-4"><SignalBadge signal={user.signal} /></td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    {user.successful_jobs >= 3 ? <Badge tone="good">case study?</Badge> : null}
                    {user.failed_jobs ? <Badge tone="danger">{user.failed_jobs} failed</Badge> : null}
                    {user.successful_jobs ? <Badge>{user.successful_jobs} success</Badge> : null}
                  </div>
                </td>
                <td className="min-w-[220px] px-5 py-4">
                  <div className="flex flex-wrap gap-2">
                    <CopyButton value={user.email} label="Copy email" />
                    <Link className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/60 hover:bg-white/10 hover:text-white" href={`/admin/users/${user.id}`}>Open</Link>
                    <Link className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/60 hover:bg-white/10 hover:text-white" href={`/admin/nudges?q=${encodeURIComponent(user.email || user.id)}`}>Nudge</Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {result.rows.length === 0 ? (
        <div className="p-8 text-center">
          <h3 className="text-lg font-semibold text-white">No users match these filters.</h3>
          <p className="mt-2 text-sm text-white/55">Clear filters, widen the last-active range, or search by a shorter email fragment.</p>
          <Link href="/admin/users" className="btn btn-secondary mt-4">Clear filters</Link>
        </div>
      ) : null}

      <div className="flex items-center justify-between border-t border-white/10 p-5 text-sm text-white/55">
        <span>{result.total.toLocaleString()} users · page {result.page} of {lastPage}</span>
        <div className="flex gap-2">
          <PageLink disabled={result.page <= 1} href={`/admin/users?${new URLSearchParams({ ...Object.fromEntries(params), page: String(result.page - 1) })}`}>Previous</PageLink>
          <PageLink disabled={result.page >= lastPage} href={`/admin/users?${new URLSearchParams({ ...Object.fromEntries(params), page: String(result.page + 1) })}`}>Next</PageLink>
        </div>
      </div>
    </div>
  );
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

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  if (disabled) return <span className="rounded-xl border border-white/10 px-3 py-2 text-white/30">{children}</span>;
  return <Link className="rounded-xl border border-white/10 px-3 py-2 text-white/75 hover:bg-white/5 hover:text-white" href={href}>{children}</Link>;
}

function SignalBadge({ signal }: { signal: string }) {
  if (signal === "Stuck") return <Badge tone="danger">Stuck</Badge>;
  if (signal === "Near quota" || signal === "Trial inactive") return <Badge tone="warning">{signal}</Badge>;
  if (signal === "Heavy user") return <Badge tone="brand">Heavy user</Badge>;
  return <Badge tone="good">Active</Badge>;
}
