import { supabaseAdmin } from "@/lib/supabaseAdmin";

export function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  const [scheme, token] = header?.split(" ") ?? [];

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export async function getUserFromBearerToken(req: Request) {
  const token = getBearerToken(req);

  if (!token) {
    return { user: null, error: "missing_token" as const };
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return { user: null, error: "invalid_token" as const };
  }

  return { user, error: null };
}
