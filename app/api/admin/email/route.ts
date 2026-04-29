export const runtime = "nodejs";

import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/auth";
import { createCampaign } from "@/lib/admin/emailCampaigns";
import { readJsonBody } from "@/lib/request";

const schema = z.object({
  name: z.string().trim().min(1).max(160),
  subject: z.string().trim().min(1).max(180),
  body_markdown: z.string().trim().min(10).max(8000),
  segment_key: z.string().trim().min(1).max(80),
});

export async function POST(req: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const parsedBody = await readJsonBody(req, 16 * 1024);
  if (!parsedBody.ok) {
    return Response.json({ error: parsedBody.message || "Invalid request." }, { status: parsedBody.status, headers: { "Cache-Control": "no-store" } });
  }

  const parsed = schema.safeParse(parsedBody.data);
  if (!parsed.success) {
    return Response.json({ error: "Invalid campaign payload." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const result = await createCampaign({
    name: parsed.data.name,
    subject: parsed.data.subject,
    bodyMarkdown: parsed.data.body_markdown,
    segmentKey: parsed.data.segment_key,
    adminUserId: auth.admin.user.id,
  });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status, headers: { "Cache-Control": "no-store" } });
  }

  return Response.json({ ok: true, id: result.id }, { headers: { "Cache-Control": "no-store" } });
}
