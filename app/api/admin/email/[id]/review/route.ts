export const runtime = "nodejs";

import { requireAdminApi } from "@/lib/admin/auth";
import { reviewCampaign } from "@/lib/admin/emailCampaigns";

type Context = { params: { id: string } };

export async function POST(_req: Request, context: Context) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  await reviewCampaign({ id: context.params.id, adminUserId: auth.admin.user.id });
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
