import { unstable_noStore as noStore } from "next/cache";

import { Badge, StatCard } from "@/components/admin/AdminShell";
import { formatHours, getAdminOverview } from "@/lib/admin/data";
import { formatUsd } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminOverviewPage() {
  noStore();
  const overview = await getAdminOverview();

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total users" value={overview.totalUsers.toLocaleString()} detail="All signed-up accounts." />
        <StatCard label="Active paid users" value={overview.activePaidUsers.toLocaleString()} detail={overview.trends.activePaidUsers.deltaLabel} tone="good" />
        <StatCard label="Trial users" value={overview.trialUsers.toLocaleString()} detail="Current trialing subscriptions." tone="warning" />
        <StatCard label="Editing time used" value={formatHours(overview.editingSecondsThisMonth)} detail={trendLabel(overview.trends.editingTime.value, overview.trends.editingTime.previousValue, "MoM")} />
        <StatCard label="Failed jobs" value={overview.failedJobs.toLocaleString()} detail={`Failure rate ${percent(overview.trends.failureRate.value)} · ${trendLabel(overview.trends.failureRate.value, overview.trends.failureRate.previousValue, "30d", true)}`} tone={overview.failedJobs > 0 ? "danger" : "default"} href="/admin/jobs?status=failed&range=all" />
        <StatCard label="Reused jobs" value={overview.reusedJobs.toLocaleString()} detail="Reused projects do not count again." />
        <StatCard
          label="Estimated pyannote cost"
          value={overview.estimatedProviderCost === null ? "Not set" : formatUsd(overview.estimatedProviderCost)}
          detail={overview.estimatedProviderCost === null ? "Set PYANNOTE_COST_PER_HOUR to estimate costs." : "Based on editing time used this month."}
          tone={overview.estimatedProviderCost === null ? "warning" : "default"}
        />
        <StatCard label="Branch-ready feedback" value={overview.branchReadyFeedback.toLocaleString()} detail="Ready for a focused implementation task." tone={overview.branchReadyFeedback ? "brand" : "default"} href="/admin/feedback?status=branch_ready" />
        <StatCard label="Love signals" value={overview.loveSignals.toLocaleString()} detail="Praise feedback and testimonial candidates." tone="good" href="/admin/segments/love-signals" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-brand/20 bg-brand/10 p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-brand-highlight/80">Usage rule</div>
          <p className="mt-2 text-sm leading-6 text-white/70">Editing time is based on source footage duration. Reused projects do not count again.</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-white/45">Fast read</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <QuickLink href="/admin/jobs?status=failed&range=all">Failed jobs</QuickLink>
            <QuickLink href="/admin/segments/trial-never-ran">Trial inactivity</QuickLink>
            <QuickLink href="/admin/feedback?status=branch_ready">Branch-ready feedback</QuickLink>
            <QuickLink href="/admin/segments/love-signals">Praise candidates</QuickLink>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <ChartPanel title="Jobs per day" detail="Last 90 days · successes vs failures">
          <JobsChart rows={overview.charts.jobsByDay.slice(-30)} />
        </ChartPanel>
        <ChartPanel title="Usage by plan" detail="Lifetime editing hours by current plan">
          <BarList rows={overview.charts.usageByPlan.map((item) => ({ label: item.label.replace(/_/g, " "), value: item.hours, suffix: "h" }))} />
        </ChartPanel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartPanel title="Feedback by type" detail="What users are telling us">
          <BarList rows={overview.charts.feedbackByType.map((item) => ({ label: item.label, value: item.count }))} />
        </ChartPanel>
        <ChartPanel title="Feedback by product area" detail="Where the work clusters">
          <BarList rows={overview.charts.feedbackByArea.map((item) => ({ label: item.label.replace(/_/g, " "), value: item.count }))} />
        </ChartPanel>
      </div>

      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">Top stuck signals</h2>
            <p className="mt-1 text-sm text-white/55">Small counts, high leverage. These are the people to help first.</p>
          </div>
          <Badge tone="brand">Phase 1C</Badge>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StuckSignal label="Signed up, never ran" value={overview.stuckSignals.signedUpNeverRan} href="/admin/segments/trial-never-ran" />
          <StuckSignal label="Imported, no completed run" value={overview.stuckSignals.importedNeverCompleted} href="/admin/segments/imported-not-completed" />
          <StuckSignal label="Run failed repeatedly" value={overview.stuckSignals.repeatedFailedJobs} href="/admin/segments/failed-twice" />
          <StuckSignal label="Ran once, did not return" value={overview.stuckSignals.ranOnceDidNotReturn} href="/admin/segments/ran-once-not-returned" />
          <StuckSignal label="Trial inactive 7d" value={overview.stuckSignals.trialNoActivity7d} href="/admin/segments/trial-never-ran" />
          <StuckSignal label="Near quota" value={overview.stuckSignals.nearQuota} href="/admin/segments/near-quota" />
        </div>
      </div>

      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">Data health</h2>
            <p className="mt-1 text-sm text-white/55">Tiny integrity checks that keep admin reads trustworthy.</p>
          </div>
          <Badge tone={overview.dataHealth.webhookGaps ? "warning" : "good"}>{overview.dataHealth.webhookGaps ? "Needs review" : "Clean enough"}</Badge>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <HealthSignal label="Missing plan" value={overview.dataHealth.missingPlan} />
          <HealthSignal label="No subscription row" value={overview.dataHealth.usersWithoutSubscription} />
          <HealthSignal label="Jobs missing duration" value={overview.dataHealth.jobsMissingDuration} />
          <HealthSignal label="Feedback missing type" value={overview.dataHealth.feedbackWithoutType} />
          <HealthSignal label="Product events 24h" value={overview.dataHealth.productEvents24h} tone="good" />
          <HealthSignal label="Webhook gaps" value={overview.dataHealth.webhookGaps} />
        </div>
      </div>
    </div>
  );
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function trendLabel(current: number, previous: number, label: string, lowerIsBetter = false) {
  if (!previous && !current) return `${label}: flat`;
  if (!previous) return `${label}: new activity`;
  const delta = (current - previous) / previous;
  const good = lowerIsBetter ? delta <= 0 : delta >= 0;
  const sign = delta >= 0 ? "+" : "";
  return `${label}: ${sign}${Math.round(delta * 100)}%${good ? "" : " watch"}`;
}

function QuickLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/75 hover:border-brand/40 hover:bg-brand/15 hover:text-white" href={href}>{children}</a>;
}

function StuckSignal({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <a href={href} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-brand/35 hover:bg-brand/10">
      <div className="text-2xl font-semibold text-white">{value.toLocaleString()}</div>
      <div className="mt-2 text-sm text-white/55">{label}</div>
      <div className="mt-3 text-xs uppercase tracking-[0.16em] text-brand-highlight/70">Open list →</div>
    </a>
  );
}

function HealthSignal({ label, value, tone = value ? "warning" : "good" }: { label: string; value: number; tone?: "warning" | "good" }) {
  return (
    <div className={`rounded-2xl border p-4 ${tone === "warning" ? "border-amber-300/20 bg-amber-300/10" : "border-emerald-300/20 bg-emerald-400/10"}`}>
      <div className="text-2xl font-semibold text-white">{value.toLocaleString()}</div>
      <div className="mt-2 text-sm text-white/55">{label}</div>
    </div>
  );
}

function ChartPanel({ title, detail, children }: { title: string; detail: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm text-white/50">{detail}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function JobsChart({ rows }: { rows: Array<{ date: string; total: number; succeeded: number; failed: number }> }) {
  const max = Math.max(1, ...rows.map((row) => Math.max(row.total, row.succeeded, row.failed)));
  return (
    <div className="grid h-52 grid-cols-[repeat(30,minmax(0,1fr))] items-end gap-1">
      {rows.map((row) => (
        <div key={row.date} className="flex h-full items-end gap-0.5" title={`${row.date}: ${row.succeeded} succeeded, ${row.failed} failed`}>
          <div className="w-1/2 rounded-t bg-emerald-300/70" style={{ height: `${Math.max(4, (row.succeeded / max) * 100)}%` }} />
          <div className="w-1/2 rounded-t bg-red-300/70" style={{ height: `${Math.max(4, (row.failed / max) * 100)}%` }} />
        </div>
      ))}
    </div>
  );
}

function BarList({ rows }: { rows: Array<{ label: string; value: number; suffix?: string }> }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  if (!rows.length) return <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/45">No data yet.</div>;
  return (
    <div className="grid gap-3">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span className="capitalize text-white/70">{row.label}</span>
            <span className="text-white/45">{row.value.toLocaleString(undefined, { maximumFractionDigits: row.value < 10 ? 1 : 0 })}{row.suffix || ""}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-brand-highlight" style={{ width: `${Math.max(3, (row.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
