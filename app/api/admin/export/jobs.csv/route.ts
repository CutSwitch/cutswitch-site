export const runtime = "nodejs";

import { requireAdminApi } from "@/lib/admin/auth";
import { getAdminJobs } from "@/lib/admin/data";
import { downloadResponse, toCsvWithMetadata } from "@/lib/admin/export";

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
  const csv = toCsvWithMetadata(
    ["id", "created_at", "user_email", "status", "duration_seconds", "error_code", "app_version", "completed_at"],
    jobs.rows.map((job) => [job.id, job.created_at, job.user_email, job.status, job.duration_seconds, job.error_code, job.app_version, job.completed_at]),
    { exported_at: new Date().toISOString(), ...filters, row_count: jobs.rows.length }
  );

  return downloadResponse(csv, "cutswitch-admin-jobs.csv", "text/csv");
}
