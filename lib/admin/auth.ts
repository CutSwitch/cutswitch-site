import type { User } from "@supabase/supabase-js";
import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabaseServer";

export type AdminAuth = {
  user: User;
  email: string;
};

type AdminAuthResult =
  | { ok: true; admin: AdminAuth }
  | { ok: false; reason: "signed_out" | "forbidden" | "config_error" };

function getAdminEmailSet() {
  return new Set(
    (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  return getAdminEmailSet().has(email.trim().toLowerCase());
}

export async function getAdminAuth(): Promise<AdminAuthResult> {
  noStore();

  let supabase;
  try {
    supabase = createSupabaseServerClient();
  } catch {
    return { ok: false, reason: "config_error" };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, reason: "signed_out" };
  }

  const email = user.email?.trim().toLowerCase() || "";
  if (!isAdminEmail(email)) {
    return { ok: false, reason: "forbidden" };
  }

  return { ok: true, admin: { user, email } };
}

export async function requireAdminPage(next = "/admin") {
  const auth = await getAdminAuth();

  if (!auth.ok && auth.reason === "signed_out") {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  return auth;
}

export async function requireAdminApi() {
  const auth = await getAdminAuth();

  if (auth.ok) {
    return auth;
  }

  const status = auth.reason === "signed_out" ? 401 : 403;
  return {
    ok: false as const,
    reason: auth.reason,
    response: Response.json(
      { error: auth.reason === "signed_out" ? "Admin sign-in required." : "Admin access required." },
      { status, headers: { "Cache-Control": "no-store" } }
    ),
  };
}
