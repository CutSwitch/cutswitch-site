export const runtime = "nodejs";

import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/auth";
import { updateFeedbackStatus } from "@/lib/admin/data";
import { readJsonBody } from "@/lib/request";

const schema = z.object({
  status: z.enum(["new", "reviewed", "branch_ready", "resolved", "ignored"]),
});

type Context = {
  params: {
    id: string;
  };
};

export async function POST(req: Request, context: Context) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const parsedBody = await readJsonBody(req, 4 * 1024);
  if (!parsedBody.ok) {
    return Response.json({ error: parsedBody.message || "Invalid request." }, { status: parsedBody.status, headers: { "Cache-Control": "no-store" } });
  }

  const parsed = schema.safeParse(parsedBody.data);
  if (!parsed.success) {
    return Response.json({ error: "Invalid feedback status." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  await updateFeedbackStatus({ id: context.params.id, status: parsed.data.status, adminUserId: auth.admin.user.id });
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
