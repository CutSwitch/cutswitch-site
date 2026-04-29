export const runtime = "nodejs";

import { requireAdminApi } from "@/lib/admin/auth";
import { downloadResponse, toCsv } from "@/lib/admin/export";
import { getAdminSegment } from "@/lib/admin/segments";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const segment = await getAdminSegment("love-signals");
  const rows = (segment?.rows || []).map((user) => [
    user.id,
    user.email,
    user.plan,
    user.subscription_status,
    user.successful_jobs,
    user.failed_jobs,
    user.reason,
    user.suggestedNextAction,
    user.loveScore,
  ]);

  return downloadResponse(
    toCsv(["user_id", "email", "plan", "subscription_status", "successful_jobs", "failed_jobs", "reason", "suggested_next_action", "love_score"], rows),
    "cutswitch-love-signals.csv",
    "text/csv"
  );
}
