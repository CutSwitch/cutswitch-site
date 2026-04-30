import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";

import { Badge } from "@/components/admin/AdminShell";
import { getAdminSegments } from "@/lib/admin/segments";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FEATURED = new Set([
  "trial_never_ran",
  "imported_not_completed",
  "failed_twice",
  "near_quota",
  "heavy_user",
  "positive_feedback",
  "trial_exhausted",
  "ran_once_not_returned",
]);

export default async function AdminSegmentsPage() {
  noStore();
  const segments = await getAdminSegments();
  const featured = segments.filter((segment) => FEATURED.has(segment.key));

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5 lg:flex-row lg:items-end">
        <div>
          <h2 className="text-2xl font-semibold text-white">Smart segments</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
            Simple founder/operator lists for stuck users, churn risk, heavy users, quota pressure, and love signals. No emails are sent from here.
          </p>
        </div>
        <Link href="/api/admin/export/segments.csv" className="btn btn-secondary">Export segments</Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {featured.map((segment) => (
          <div key={segment.key} className="group rounded-3xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-brand/45 hover:bg-brand/10" title={segment.description}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-3xl font-semibold text-white">{segment.count.toLocaleString()}</div>
                <h3 className="mt-3 text-lg font-semibold text-white group-hover:text-brand-highlight">{segment.shortTitle}</h3>
              </div>
              <SegmentBadge keyName={segment.key} />
            </div>
            <p className="mt-3 text-sm leading-6 text-white/55">{segment.description}</p>
            <p className="mt-2 text-xs text-white/35">Last updated: live on refresh</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/admin/segments/${segment.slug}`} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 hover:text-white">View segment →</Link>
              <Link href={usersFilterHref(segment.key)} className="rounded-full border border-brand/25 bg-brand/10 px-3 py-1.5 text-xs text-brand-highlight hover:bg-brand/20">View users →</Link>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Prepared for nudges, not sending them</h3>
            <p className="mt-1 text-sm text-white/55">These are exports and review queues only. Email automation remains out of scope for Phase 2A.</p>
          </div>
          <Badge tone="brand">Phase 2A</Badge>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Custom segment builder MVP</h3>
            <p className="mt-1 text-sm text-white/55">Pick a saved filter shape now; persistent custom segments can come later without turning this into Salesforce in a trench coat.</p>
          </div>
          <Link href="/admin/users?status=trialing&range=7d" className="btn btn-secondary">Trial users active 7d</Link>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {["plan", "status", "editing time used", "last active"].map((item) => (
            <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm capitalize text-white/65">{item}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function usersFilterHref(key: string) {
  if (key === "trial_never_ran") return "/admin/users?status=trialing&signal=Trial+inactive";
  if (key === "imported_not_completed" || key === "failed_twice") return "/admin/users?signal=Stuck";
  if (key === "near_quota" || key === "trial_exhausted" || key === "paid_user_near_limit") return "/admin/users?signal=Near+quota";
  if (key === "heavy_user") return "/admin/users?signal=Heavy+user";
  if (key === "positive_feedback") return "/admin/segments/love-signals";
  return "/admin/users";
}

function SegmentBadge({ keyName }: { keyName: string }) {
  if (keyName.includes("failed") || keyName.includes("risk") || keyName.includes("exhausted")) return <Badge tone="danger">Action</Badge>;
  if (keyName.includes("quota") || keyName.includes("trial")) return <Badge tone="warning">Watch</Badge>;
  if (keyName.includes("heavy") || keyName.includes("positive")) return <Badge tone="good">Upside</Badge>;
  return <Badge>Signal</Badge>;
}
