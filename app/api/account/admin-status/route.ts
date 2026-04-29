export const runtime = "nodejs";

import { getUserFromBearerToken } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin/auth";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: Request) {
  const { user, error: authError } = await getUserFromBearerToken(req);

  if (authError === "missing_token") {
    return Response.json({ error: "Missing Authorization bearer token" }, { status: 401, headers: NO_STORE });
  }

  if (authError || !user) {
    return Response.json({ error: "Invalid or expired token" }, { status: 401, headers: NO_STORE });
  }

  return Response.json({ isAdmin: isAdminEmail(user.email) }, { headers: NO_STORE });
}
