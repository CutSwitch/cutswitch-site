export const runtime = "nodejs";

import { requireAdminApi } from "@/lib/admin/auth";
import { getFilteredAdminUserRows } from "@/lib/admin/data";
import { downloadResponse, toCsvWithMetadata } from "@/lib/admin/export";

export async function GET(req: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const params = new URL(req.url).searchParams;
  const filters = {
    search: params.get("q") || undefined,
    signal: params.get("signal") || undefined,
    status: params.get("status") || undefined,
    plan: params.get("plan") || undefined,
    range: params.get("range") || undefined,
    sort: params.get("sort") || undefined,
  };
  const users = await getFilteredAdminUserRows(filters);
  const csv = toCsvWithMetadata(
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
    ]),
    { exported_at: new Date().toISOString(), ...filters, row_count: users.length }
  );

  return downloadResponse(csv, "cutswitch-admin-users.csv", "text/csv");
}
