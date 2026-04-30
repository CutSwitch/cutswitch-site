export const runtime = "nodejs";

import { requireAdminApi } from "@/lib/admin/auth";
import { getFilteredAdminUserRows } from "@/lib/admin/data";
import { jsonDownloadResponse } from "@/lib/admin/export";

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

  return jsonDownloadResponse(
    {
      metadata: {
        exported_at: new Date().toISOString(),
        filters,
        row_count: users.length,
      },
      rows: users,
    },
    "cutswitch-admin-users.json"
  );
}
