import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { buildTrialRedirectPath, sanitizeStartPlan, sanitizeStartSource } from "@/lib/startFlow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const plan = sanitizeStartPlan(url.searchParams.get("plan"));
  const source = sanitizeStartSource(url.searchParams.get("source"));

  if (!code) {
    return NextResponse.redirect(new URL("/start?error=callback", url.origin));
  }

  let error: unknown = null;
  try {
    const supabase = createSupabaseServerClient();
    const result = await supabase.auth.exchangeCodeForSession(code);
    error = result.error;
  } catch {
    error = true;
  }

  if (error) {
    const params = new URLSearchParams({ error: "callback" });
    if (plan) params.set("plan", plan);
    if (source) params.set("source", source);
    return NextResponse.redirect(new URL(`/start?${params.toString()}`, url.origin));
  }

  return NextResponse.redirect(
    new URL(
      buildTrialRedirectPath({
        plan,
        source,
        next: url.searchParams.get("next"),
      }),
      url.origin
    )
  );
}
