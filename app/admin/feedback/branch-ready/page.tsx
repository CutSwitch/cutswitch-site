import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";

import { Badge } from "@/components/admin/AdminShell";
import { getFeedbackRows } from "@/lib/admin/data";
import { taskSlug } from "@/lib/admin/export";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BranchReadyFeedbackPage() {
  noStore();
  const feedback = await getFeedbackRows({ branchReady: true, limit: 100 });

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5 lg:flex-row lg:items-end">
        <div>
          <h2 className="text-2xl font-semibold text-white">Branch-ready feedback</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
            Feedback that is structured enough to become a focused app, backend, or website task.
          </p>
        </div>
        <Link href="/api/admin/export/feedback-branch-ready.md" className="btn btn-secondary">
          Export Markdown
        </Link>
      </div>

      {feedback.length ? (
        <div className="grid gap-4">
          {feedback.map((item) => {
            const title = item.title || item.ai_title || `${item.type} feedback${item.screen ? ` on ${item.screen}` : ""}`;
            const summary = item.summary || item.ai_summary || "No summary yet.";
            const branchName = item.suggested_branch_name || item.ai_suggested_branch_name || taskSlug(title || item.message);
            return (
              <article key={item.id} className="card p-5">
                <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="brand">branch-ready</Badge>
                      <Badge tone={item.type === "bug" ? "danger" : item.type === "praise" ? "good" : "default"}>{item.type}</Badge>
                      <Badge tone={item.severity === "urgent" ? "danger" : item.severity === "high" ? "warning" : "default"}>{item.severity}</Badge>
                      <Badge tone={item.admin_priority === "urgent" || item.admin_priority === "high" ? "warning" : "default"}>{item.admin_priority || "normal"} priority</Badge>
                    </div>
                    <h3 className="mt-4 text-xl font-semibold text-white">{title}</h3>
                    <p className="mt-2 text-sm text-white/50">
                      {item.user_email || "Unknown user"} · {item.user_plan || "unknown plan"} / {item.user_subscription_status || "unknown status"} · {item.screen || "Unknown screen"} · {new Date(item.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 font-mono text-xs text-white/65">
                    {branchName}
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 lg:col-span-2">
                    <div className="text-xs uppercase tracking-[0.18em] text-white/40">Summary</div>
                    <p className="mt-3 text-sm leading-6 text-white/75">{summary}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-white/40">User quote</div>
                    <p className="mt-3 line-clamp-5 text-sm leading-6 text-white/75">{item.message}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-white/40">Recommended next action</div>
                    <p className="mt-3 text-sm leading-6 text-white/70">
                      {item.recommended_next_action || item.ai_recommended_next_action || "Review the feedback, inspect related events/jobs, and decide if this should become a Codex task."}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 lg:col-span-2">
                    <div className="text-xs uppercase tracking-[0.18em] text-white/40">Triage fields</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge>{(item.product_area || item.ai_category || "unclear").replace(/_/g, " ")}</Badge>
                      <Badge>{item.reproduction_likelihood || "unknown"} repro</Badge>
                      <Badge>{item.suggested_owner || "unassigned"}</Badge>
                    </div>
                    {item.context_json ? <pre className="mt-3 max-h-44 overflow-auto rounded-xl bg-black/30 p-3 text-xs text-white/55">{JSON.stringify(item.context_json, null, 2)}</pre> : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="card p-8 text-center text-sm text-white/55">
          No branch-ready feedback yet. Mark feedback as branch_ready from the feedback inbox when it is ready for action.
        </div>
      )}
    </div>
  );
}
