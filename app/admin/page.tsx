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
        <StatCard label="Active paid users" value={overview.activePaidUsers.toLocaleString()} detail="Current active subscriptions." tone="good" />
        <StatCard label="Trial users" value={overview.trialUsers.toLocaleString()} detail="Current trialing subscriptions." tone="warning" />
        <StatCard label="Editing time used" value={formatHours(overview.editingSecondsThisMonth)} detail="This calendar month." />
        <StatCard label="Failed jobs" value={overview.failedJobs.toLocaleString()} detail="Transcript/analyze failures this month." tone={overview.failedJobs > 0 ? "danger" : "default"} />
        <StatCard label="Reused jobs" value={overview.reusedJobs.toLocaleString()} detail="Reused projects do not count again." />
        <StatCard
          label="Estimated pyannote cost"
          value={overview.estimatedProviderCost === null ? "Not set" : formatUsd(overview.estimatedProviderCost)}
          detail={overview.estimatedProviderCost === null ? "Set PYANNOTE_COST_PER_HOUR to estimate costs." : "Based on editing time used this month."}
          tone={overview.estimatedProviderCost === null ? "warning" : "default"}
        />
        <StatCard label="Branch-ready feedback" value={overview.branchReadyFeedback.toLocaleString()} detail="Ready for a focused implementation task." tone={overview.branchReadyFeedback ? "brand" : "default"} />
        <StatCard label="Love signals" value={overview.loveSignals.toLocaleString()} detail="Praise feedback and testimonial candidates." tone="good" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-brand/20 bg-brand/10 p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-brand-highlight/80">Usage rule</div>
          <p className="mt-2 text-sm leading-6 text-white/70">Editing time is based on source footage duration. Reused projects do not count again.</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-white/45">Fast read</div>
          <p className="mt-2 text-sm leading-6 text-white/70">Start with failed jobs, trial inactivity, branch-ready feedback, then praise. That tells us who is stuck, who may churn, and who might become a case study.</p>
        </div>
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
          <StuckSignal label="Signed up, never ran" value={overview.stuckSignals.signedUpNeverRan} />
          <StuckSignal label="Imported, no completed run" value={overview.stuckSignals.importedNeverCompleted} />
          <StuckSignal label="Run failed repeatedly" value={overview.stuckSignals.repeatedFailedJobs} />
          <StuckSignal label="Ran once, did not return" value={overview.stuckSignals.ranOnceDidNotReturn} />
          <StuckSignal label="Trial inactive 7d" value={overview.stuckSignals.trialNoActivity7d} />
          <StuckSignal label="Near quota" value={overview.stuckSignals.nearQuota} />
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

function StuckSignal({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-2xl font-semibold text-white">{value.toLocaleString()}</div>
      <div className="mt-2 text-sm text-white/55">{label}</div>
    </div>
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
