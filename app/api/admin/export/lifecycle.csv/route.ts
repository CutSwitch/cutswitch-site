export const runtime = "nodejs";

import { requireAdminApi } from "@/lib/admin/auth";
import { downloadResponse, toCsvWithMetadata } from "@/lib/admin/export";
import { getLifecycleEvents } from "@/lib/lifecycle";

export async function GET(req: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const params = new URL(req.url).searchParams;
  const filters = {
    q: params.get("q") || undefined,
    range: params.get("range") || undefined,
    eventName: params.get("event") || undefined,
    provider: params.get("provider") || undefined,
    status: params.get("status") || undefined,
  };
  const events = await getLifecycleEvents({ limit: 1000, ...filters });
  const csv = toCsvWithMetadata(
    ["id", "created_at", "user_email", "event_name", "provider", "status", "sent_at", "error_message"],
    events.rows.map((row) => [row.id, row.created_at, row.user_email, row.event_name, row.provider, row.status, row.sent_at, row.error_message]),
    { exported_at: new Date().toISOString(), ...filters, row_count: events.rows.length }
  );

  return downloadResponse(csv, "cutswitch-lifecycle-events.csv", "text/csv");
}
