export const runtime = "nodejs";

import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/auth";
import { updateNudgeStatus } from "@/lib/admin/nudges";
import { readJsonBody } from "@/lib/request";

const schema = z.object({
  status: z.enum(["draft", "reviewed", "suppressed", "sent_placeholder"]),
});

type Context = { params: { id: string } };

export async function POST(req: Request, context: Context) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const parsedBody = await readJsonBody(req, 4 * 1024);
  if (!parsedBody.ok) {
    return Response.json({ error: parsedBody.message || "Invalid request." }, { status: parsedBody.status, headers: { "Cache-Control": "no-store" } });
  }

  const parsed = schema.safeParse(parsedBody.data);
  if (!parsed.success) {
    return Response.json({ error: "Invalid nudge status." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  if (parsed.data.status === "sent_placeholder") {
    return Response.json({ error: "Email sending is not enabled." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  await updateNudgeStatus({ id: context.params.id, status: parsed.data.status, adminUserId: auth.admin.user.id });
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
