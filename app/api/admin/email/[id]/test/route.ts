export const runtime = "nodejs";

import { requireAdminApi } from "@/lib/admin/auth";
import { sendCampaignTest } from "@/lib/admin/emailCampaigns";

type Context = { params: { id: string } };

export async function POST(_req: Request, context: Context) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const result = await sendCampaignTest({ id: context.params.id, adminEmail: auth.admin.email, adminUserId: auth.admin.user.id });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status, headers: { "Cache-Control": "no-store" } });
  }

  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
