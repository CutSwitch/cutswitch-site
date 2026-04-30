export const runtime = "nodejs";

import { requireAdminApi } from "@/lib/admin/auth";
import { getFeedbackRows } from "@/lib/admin/data";
import { jsonDownloadResponse } from "@/lib/admin/export";

export async function GET(req: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const params = new URL(req.url).searchParams;
  const filters = {
    q: params.get("q") || undefined,
    type: params.get("type") || undefined,
    severity: params.get("severity") || undefined,
    status: params.get("status") || undefined,
    range: params.get("range") || undefined,
  };
  const feedback = await getFeedbackRows({ ...filters, limit: 1000 });

  return jsonDownloadResponse(
    {
      metadata: {
        exported_at: new Date().toISOString(),
        filters,
        row_count: feedback.length,
      },
      rows: feedback,
    },
    "cutswitch-admin-feedback.json"
  );
}
