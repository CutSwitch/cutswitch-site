import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";

import { Badge } from "@/components/admin/AdminShell";
import { FeedbackIntelligenceEditor } from "@/components/admin/FeedbackIntelligenceEditor";
import { FeedbackStatusControl } from "@/components/admin/FeedbackStatusControl";
import type { FeedbackRow } from "@/lib/admin/data";
import { getFeedbackRows } from "@/lib/admin/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TYPES = ["", "bug", "idea", "confusion", "praise", "pricing", "onboarding", "performance", "export", "account"];
const SEVERITIES = ["", "low", "normal", "high", "urgent"];
const STATUSES = ["", "new", "reviewed", "planned", "shipped", "declined", "branch_ready", "resolved", "ignored"];
const RANGES = ["", "7d", "30d", "90d"];

type Props = {
  searchParams?: {
    type?: string;
    severity?: string;
    status?: string;
    range?: string;
    q?: string;
  };
};

export default async function AdminFeedbackPage({ searchParams }: Props) {
  noStore();
  const filters = {
    type: searchParams?.type || undefined,
    severity: searchParams?.severity || undefined,
    status: searchParams?.status || undefined,
    range: searchParams?.range || undefined,
    q: searchParams?.q || undefined,
  };
  const [feedback, allFeedback] = await Promise.all([
    getFeedbackRows(filters),
    getFeedbackRows({ limit: 1000 }),
  ]);
  const themes = getRepeatedThemes(feedback);
  const summary = {
    new: allFeedback.filter((item) => item.status === "new").length,
    branchReady: allFeedback.filter((item) => item.status === "branch_ready" || item.codex_ready === true || item.ai_should_be_codex_task === true).length,
    total: allFeedback.length,
  };
  const params = new URLSearchParams({
    ...(filters.q ? { q: filters.q } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.severity ? { severity: filters.severity } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.range ? { range: filters.range } : {}),
  });

  return (
    <div className="grid gap-6">
    <div className="card overflow-hidden">
      <div className="sticky top-[104px] z-10 border-b border-white/10 bg-[#111426]/95 p-5 backdrop-blur">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <h2 className="text-xl font-semibold text-white">Feedback & feature requests</h2>
            <p className="mt-1 text-sm text-white/55">Newest submissions first. Mark new items reviewed once they have been triaged.</p>
          </div>
          <form className="flex flex-wrap gap-2" action="/admin/feedback">
            <label className="grid gap-1 text-xs text-white/45">
              <span>Search</span>
              <input className="w-56 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand/60" name="q" defaultValue={filters.q || ""} placeholder="Message, user, screen" />
            </label>
            <Select name="type" label="Type" value={searchParams?.type || ""} values={TYPES} />
            <Select name="severity" label="Severity" value={searchParams?.severity || ""} values={SEVERITIES} />
            <Select name="status" label="Status" value={searchParams?.status || ""} values={STATUSES} />
            <Select name="range" label="Range" value={searchParams?.range || ""} values={RANGES} />
            <button className="btn btn-secondary" type="submit">Filter</button>
            <Link className="btn btn-secondary" href="/admin/feedback">Clear</Link>
          </form>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-white/55">
          <div className="flex flex-wrap gap-2">
            <SummaryPill tone="warning" href="/admin/feedback?status=new">New {summary.new.toLocaleString()}</SummaryPill>
            <SummaryPill tone="brand" href="/admin/feedback?status=branch_ready">Branch-ready {summary.branchReady.toLocaleString()}</SummaryPill>
            <SummaryPill href="/admin/feedback">Total {summary.total.toLocaleString()}</SummaryPill>
            <span className="px-2 py-1">{feedback.length.toLocaleString()} match current filters.</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="btn btn-secondary" href={`/api/admin/export/feedback.csv?${params.toString()}`}>Export CSV</Link>
            <Link className="btn btn-secondary" href={`/api/admin/export/feedback.json?${params.toString()}`}>Export JSON</Link>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-white/10 text-left text-sm">
          <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-white/45">
            <tr>
              <th className="px-5 py-3">User</th>
              <th className="px-5 py-3">Type</th>
              <th className="px-5 py-3">Severity</th>
              <th className="px-5 py-3">Area</th>
              <th className="px-5 py-3">Message</th>
              <th className="px-5 py-3">Screen</th>
              <th className="px-5 py-3">Created</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {feedback.map((item) => (
              <tr key={item.id} className="align-top text-white/75 hover:bg-white/[0.025]">
                <td className="max-w-[220px] truncate px-5 py-4 font-medium text-white">{item.user_email || "—"}</td>
                <td className="px-5 py-4"><Badge tone={item.type === "praise" ? "good" : item.type === "bug" ? "danger" : "default"}>{item.type}</Badge></td>
                <td className="px-5 py-4"><SeverityBadge severity={item.severity} /></td>
                <td className="px-5 py-4"><Badge>{(item.product_area || item.ai_category || "unclear").replace(/_/g, " ")}</Badge></td>
                <td className="min-w-[340px] max-w-[520px] px-5 py-4">
                  <div className="font-medium text-white">{item.title || item.ai_title || "Untitled feedback"}</div>
                  {item.summary || item.ai_summary ? <div className="mt-1 line-clamp-2 text-white/55">{item.summary || item.ai_summary}</div> : null}
                  <div className="line-clamp-3 leading-6 text-white/75">{item.message}</div>
                  {item.codex_ready || item.ai_should_be_codex_task || item.status === "branch_ready" ? <div className="mt-2"><Badge tone="brand">Branch-ready</Badge></div> : null}
                  <FeedbackIntelligenceEditor item={item} />
                </td>
                <td className="px-5 py-4">
                  <div>{item.screen || item.app_area || "—"}</div>
                  {item.current_page ? <div className="mt-1 max-w-[180px] truncate text-xs text-white/40">{item.current_page}</div> : null}
                </td>
                <td className="px-5 py-4">{new Date(item.created_at).toLocaleDateString()}</td>
                <td className="px-5 py-4"><FeedbackStatusControl id={item.id} status={item.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {feedback.length === 0 ? (
        <div className="p-8 text-center">
          <h3 className="text-lg font-semibold text-white">No feedback matches these filters.</h3>
          <p className="mt-2 text-sm text-white/55">Try a wider date range, clear status, or search a shorter keyword.</p>
          <Link className="btn btn-secondary mt-4" href="/admin/feedback">Clear filters</Link>
        </div>
      ) : null}
    </div>
      {feedback.length ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <ThemePanel title="By type" rows={themes.byType} />
          <ThemePanel title="By product area" rows={themes.byArea} />
          <ThemePanel title="Repeated keywords" rows={themes.byKeyword} />
        </div>
      ) : null}
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

function SeverityBadge({ severity }: { severity: string }) {
  if (severity === "urgent") return <Badge tone="danger">urgent</Badge>;
  if (severity === "high") return <Badge tone="warning">high</Badge>;
  if (severity === "low") return <Badge>low</Badge>;
  return <Badge tone="brand">normal</Badge>;
}

function SummaryPill({ href, children, tone = "default" }: { href: string; children: React.ReactNode; tone?: "default" | "warning" | "brand" }) {
  const className = {
    default: "border-white/10 bg-white/5 text-white/65",
    warning: "border-amber-300/25 bg-amber-300/10 text-amber-50",
    brand: "border-brand/35 bg-brand/15 text-brand-highlight",
  }[tone];
  return <Link href={href} className={`rounded-full border px-3 py-1 text-xs font-medium ${className}`}>{children}</Link>;
}

function getRepeatedThemes(feedback: FeedbackRow[]) {
  const byType = countBy(feedback, (item) => item.type || "unknown");
  const byArea = countBy(feedback, (item) => item.product_area || item.ai_category || "unclear");
  const stopWords = new Set(["the", "and", "for", "that", "this", "with", "from", "have", "when", "into", "cut", "cutswitch", "just", "really", "would", "could", "there", "where"]);
  const keywords = new Map<string, { count: number; latest: string }>();
  for (const item of feedback) {
    const words = item.message.toLowerCase().match(/[a-z][a-z0-9]{3,}/g) || [];
    for (const word of new Set(words)) {
      if (stopWords.has(word)) continue;
      const existing = keywords.get(word);
      keywords.set(word, { count: (existing?.count || 0) + 1, latest: maxDate(existing?.latest, item.created_at) });
    }
  }
  const byKeyword = [...keywords.entries()]
    .filter(([, value]) => value.count > 1)
    .sort((a, b) => b[1].count - a[1].count || String(b[1].latest).localeCompare(String(a[1].latest)))
    .slice(0, 8)
    .map(([label, value]) => ({ label, count: value.count, latest: value.latest }));
  return { byType, byArea, byKeyword };
}

function countBy(feedback: FeedbackRow[], getKey: (item: FeedbackRow) => string) {
  const map = new Map<string, { count: number; latest: string }>();
  for (const item of feedback) {
    const key = getKey(item);
    const existing = map.get(key);
    map.set(key, { count: (existing?.count || 0) + 1, latest: maxDate(existing?.latest, item.created_at) });
  }
  return [...map.entries()]
    .sort((a, b) => b[1].count - a[1].count || String(b[1].latest).localeCompare(String(a[1].latest)))
    .slice(0, 8)
    .map(([label, value]) => ({ label, count: value.count, latest: value.latest }));
}

function maxDate(a: string | undefined, b: string) {
  if (!a) return b;
  return a > b ? a : b;
}

function ThemePanel({ title, rows }: { title: string; rows: Array<{ label: string; count: number; latest: string }> }) {
  return (
    <section className="card p-5">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <div className="mt-4 grid gap-2">
        {rows.length ? rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm">
            <span className="capitalize text-white/75">{row.label.replace(/_/g, " ")}</span>
            <span className="text-white/45">{row.count} · {new Date(row.latest).toLocaleDateString()}</span>
          </div>
        )) : <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/45">No repeated themes yet.</div>}
      </div>
    </section>
  );
}
