export const runtime = "nodejs";

import { requireAdminApi } from "@/lib/admin/auth";
import { getAllAdminUserRows } from "@/lib/admin/data";
import { downloadResponse, toCsv } from "@/lib/admin/export";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const users = await getAllAdminUserRows();
  const csv = toCsv(
    ["user_id", "email", "plan", "subscription_status", "editing_hours_used", "editing_hours_remaining", "failed_jobs", "successful_jobs", "last_product_event", "last_active", "signal"],
    users.map((user) => [
      user.id,
      user.email,
      user.plan,
      user.subscription_status,
      (user.editing_seconds_used / 3600).toFixed(2),
      user.editing_seconds_remaining === null ? "" : (user.editing_seconds_remaining / 3600).toFixed(2),
      user.failed_jobs,
      user.successful_jobs,
      user.last_product_event,
      user.last_active_at,
      user.signal,
    ])
  );

  return downloadResponse(csv, "cutswitch-admin-users.csv", "text/csv");
}
