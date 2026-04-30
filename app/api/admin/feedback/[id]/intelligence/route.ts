export const runtime = "nodejs";

import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/auth";
import { updateFeedbackIntelligence } from "@/lib/admin/data";
import { readJsonBody } from "@/lib/request";

const emptyToNull = (value: unknown) => (typeof value === "string" && value.trim() === "" ? null : value);

const schema = z.object({
  title: z.preprocess(emptyToNull, z.string().trim().max(180).nullable().optional()),
  summary: z.preprocess(emptyToNull, z.string().trim().max(1200).nullable().optional()),
  product_area: z.preprocess(emptyToNull, z.enum(["onboarding", "import", "transcription_or_analysis", "run", "export", "billing", "account", "website", "performance", "unclear"]).nullable().optional()),
  severity: z.enum(["low", "normal", "high", "urgent"]).optional(),
  admin_priority: z.preprocess(emptyToNull, z.enum(["low", "normal", "high", "urgent"]).nullable().optional()),
  status: z.enum(["new", "reviewed", "planned", "shipped", "declined", "branch_ready", "resolved", "ignored"]).optional(),
  codex_ready: z.boolean().optional(),
  suggested_owner: z.preprocess(emptyToNull, z.string().trim().max(120).nullable().optional()),
  suggested_branch_name: z.preprocess(emptyToNull, z.string().trim().max(120).nullable().optional()),
  reproduction_likelihood: z.preprocess(emptyToNull, z.enum(["unknown", "low", "medium", "high"]).nullable().optional()),
  recommended_next_action: z.preprocess(emptyToNull, z.string().trim().max(1200).nullable().optional()),
  customer_impact: z.preprocess(emptyToNull, z.string().trim().max(1200).nullable().optional()),
});

type Context = { params: { id: string } };

export async function POST(req: Request, context: Context) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const parsedBody = await readJsonBody(req, 16 * 1024);
  if (!parsedBody.ok) {
    return Response.json({ error: parsedBody.message || "Invalid request." }, { status: parsedBody.status, headers: { "Cache-Control": "no-store" } });
  }

  const parsed = schema.safeParse(parsedBody.data);
  if (!parsed.success) {
    return Response.json({ error: "Invalid feedback intelligence payload." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  await updateFeedbackIntelligence({ id: context.params.id, adminUserId: auth.admin.user.id, patch: parsed.data });
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
