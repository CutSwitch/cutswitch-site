export const runtime = "nodejs";

import { requireAdminApi } from "@/lib/admin/auth";
import { getAdminJobs } from "@/lib/admin/data";
import { jsonDownloadResponse } from "@/lib/admin/export";

export async function GET(req: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const params = new URL(req.url).searchParams;
  const filters = {
    q: params.get("q") || undefined,
    status: params.get("status") || undefined,
    plan: params.get("plan") || undefined,
    range: params.get("range") || "all",
    errorCode: params.get("error_code") || undefined,
  };
  const jobs = await getAdminJobs(filters);

  return jsonDownloadResponse(
    {
      metadata: {
        exported_at: new Date().toISOString(),
        filters,
        row_count: jobs.rows.length,
      },
      summary: jobs.summary,
      rows: jobs.rows,
    },
    "cutswitch-admin-jobs.json"
  );
}
