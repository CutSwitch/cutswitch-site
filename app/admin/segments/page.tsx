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
          <Link key={segment.key} href={`/admin/segments/${segment.slug}`} className="group rounded-3xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-brand/45 hover:bg-brand/10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-3xl font-semibold text-white">{segment.count.toLocaleString()}</div>
                <h3 className="mt-3 text-lg font-semibold text-white group-hover:text-brand-highlight">{segment.shortTitle}</h3>
              </div>
              <SegmentBadge keyName={segment.key} />
            </div>
            <p className="mt-3 text-sm leading-6 text-white/55">{segment.description}</p>
            <p className="mt-4 text-xs uppercase tracking-[0.18em] text-white/35">View users &rarr;</p>
          </Link>
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
    </div>
  );
}

function SegmentBadge({ keyName }: { keyName: string }) {
  if (keyName.includes("failed") || keyName.includes("risk") || keyName.includes("exhausted")) return <Badge tone="danger">Action</Badge>;
  if (keyName.includes("quota") || keyName.includes("trial")) return <Badge tone="warning">Watch</Badge>;
  if (keyName.includes("heavy") || keyName.includes("positive")) return <Badge tone="good">Upside</Badge>;
  return <Badge>Signal</Badge>;
}
