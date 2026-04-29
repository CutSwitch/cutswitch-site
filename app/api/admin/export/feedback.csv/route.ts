export const runtime = "nodejs";

import { requireAdminApi } from "@/lib/admin/auth";
import { getFeedbackRows } from "@/lib/admin/data";
import { downloadResponse, toCsv } from "@/lib/admin/export";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const feedback = await getFeedbackRows({ limit: 1000 });
  const csv = toCsv(
    ["id", "user_email", "type", "severity", "status", "screen", "message", "created_at"],
    feedback.map((item) => [item.id, item.user_email, item.type, item.severity, item.status, item.screen, item.message, item.created_at])
  );

  return downloadResponse(csv, "cutswitch-admin-feedback.csv", "text/csv");
}
