export const runtime = "nodejs";

import { requireAdminApi } from "@/lib/admin/auth";
import { sendReviewedNudge } from "@/lib/admin/nudges";

type Context = { params: { id: string } };

export async function POST(_req: Request, context: Context) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const result = await sendReviewedNudge({ id: context.params.id, adminUserId: auth.admin.user.id });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status, headers: { "Cache-Control": "no-store" } });
  }

  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
