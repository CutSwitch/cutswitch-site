export const runtime = "nodejs";

import { requireAdminApi } from "@/lib/admin/auth";
import { downloadResponse, toCsv } from "@/lib/admin/export";
import { getAdminSegment } from "@/lib/admin/segments";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const segment = await getAdminSegment("cancellation-risk");
  const rows = (segment?.rows || []).map((user) => [
    user.id,
    user.email,
    user.plan,
    user.subscription_status,
    user.last_active_at,
    user.reason,
    user.suggestedNextAction,
    user.churnRiskScore,
    user.stuckScore,
  ]);

  return downloadResponse(
    toCsv(["user_id", "email", "plan", "subscription_status", "last_active_at", "reason", "suggested_next_action", "churn_risk_score", "stuck_score"], rows),
    "cutswitch-churn-risk.csv",
    "text/csv"
  );
}
