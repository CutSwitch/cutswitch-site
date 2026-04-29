export const runtime = "nodejs";

import { requireAdminApi } from "@/lib/admin/auth";
import { getFeedbackRows } from "@/lib/admin/data";
import { downloadResponse, jsonlLine } from "@/lib/admin/export";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const feedback = await getFeedbackRows({ limit: 1000 });
  const body = feedback
    .map((item) =>
      jsonlLine({
        feedback_id: item.id,
        created_at: item.created_at,
        type: item.type,
        severity: item.severity,
        status: item.status,
        product_area: item.product_area || item.ai_category || null,
        title: item.title || item.ai_title || null,
        summary: item.summary || item.ai_summary || null,
        message: item.message,
        screen: item.screen,
        user_plan: item.user_plan || null,
        subscription_status: item.user_subscription_status || null,
        safe_context: item.context_json || {},
        recommended_next_action: item.recommended_next_action || item.ai_recommended_next_action || null,
        suggested_owner: item.suggested_owner || null,
        suggested_branch_name: item.suggested_branch_name || item.ai_suggested_branch_name || null,
        reproduction_likelihood: item.reproduction_likelihood || null,
        customer_impact: item.customer_impact || null,
        admin_priority: item.admin_priority || null,
        codex_ready: item.codex_ready === true || item.ai_should_be_codex_task === true || item.status === "branch_ready",
      })
    )
    .join("");

  return downloadResponse(body, "cutswitch-feedback-ai.jsonl", "application/x-ndjson");
}
