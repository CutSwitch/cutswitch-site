export const runtime = "nodejs";

import { requireAdminApi } from "@/lib/admin/auth";
import { getCampaignPreview } from "@/lib/admin/emailCampaigns";

export async function GET(req: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const result = await getCampaignPreview(url.searchParams.get("segment_key") || "");
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  return Response.json(
    {
      ...result,
      recipients: result.recipients.slice(0, 20),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
