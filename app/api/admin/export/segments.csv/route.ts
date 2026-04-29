export const runtime = "nodejs";

import { requireAdminApi } from "@/lib/admin/auth";
import { downloadResponse, toCsv } from "@/lib/admin/export";
import { getAdminSegments } from "@/lib/admin/segments";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const segments = await getAdminSegments();
  const rows = segments.flatMap((segment) =>
    segment.rows.map((user) => [
      segment.key,
      segment.title,
      user.id,
      user.email,
      user.plan,
      user.subscription_status,
      (user.editing_seconds_used / 3600).toFixed(2),
      user.editing_seconds_remaining === null ? "" : (user.editing_seconds_remaining / 3600).toFixed(2),
      user.last_active_at,
      user.reason,
      user.suggestedNextAction,
      user.stuckScore,
      user.churnRiskScore,
      user.loveScore,
      user.heavyUserScore,
    ])
  );

  return downloadResponse(
    toCsv([
      "segment_key",
      "segment_title",
      "user_id",
      "email",
      "plan",
      "subscription_status",
      "editing_hours_used",
      "editing_hours_remaining",
      "last_active_at",
      "reason",
      "suggested_next_action",
      "stuck_score",
      "churn_risk_score",
      "love_score",
      "heavy_user_score",
    ], rows),
    "cutswitch-admin-segments.csv",
    "text/csv"
  );
}
