export const runtime = "nodejs";

import { requireAdminApi } from "@/lib/admin/auth";
import { downloadResponse, toCsv } from "@/lib/admin/export";
import { ensureNudgeDrafts, getNudgeQueue } from "@/lib/admin/nudges";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  await ensureNudgeDrafts();
  const queue = await getNudgeQueue();
  const csv = toCsv(
    ["id", "user_id", "email", "nudge_type", "channel", "status", "segment_key", "trigger_reason", "subject", "message", "created_at", "reviewed_at", "suppressed_at", "sent_at"],
    queue.rows.map((row) => [
      row.id,
      row.user_id,
      row.user_email,
      row.nudge_type,
      row.channel,
      row.status,
      row.segment_key,
      row.trigger_reason,
      row.subject,
      row.message,
      row.created_at,
      row.reviewed_at,
      row.suppressed_at,
      row.sent_at,
    ])
  );

  return downloadResponse(csv, "cutswitch-nudges.csv", "text/csv");
}
