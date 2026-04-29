export const runtime = "nodejs";

import { requireAdminApi } from "@/lib/admin/auth";
import { downloadResponse, toCsv } from "@/lib/admin/export";
import { getAdminSegment } from "@/lib/admin/segments";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const segment = await getAdminSegment("heavy-users");
  const rows = (segment?.rows || []).map((user) => [
    user.id,
    user.email,
    user.plan,
    user.subscription_status,
    (user.editing_seconds_used / 3600).toFixed(2),
    user.successful_jobs,
    user.failed_jobs,
    user.reason,
    user.heavyUserScore,
  ]);

  return downloadResponse(
    toCsv(["user_id", "email", "plan", "subscription_status", "editing_hours_used", "successful_jobs", "failed_jobs", "reason", "heavy_user_score"], rows),
    "cutswitch-heavy-users.csv",
    "text/csv"
  );
}
