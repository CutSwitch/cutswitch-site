export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api";
import { readJsonBody } from "@/lib/request";
import { supabaseClient } from "@/lib/supabaseClient";

type RefreshBody = {
  refresh_token?: unknown;
};

function normalizeToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(req: Request) {
  const parsed = await readJsonBody<RefreshBody>(req, 16 * 1024);
  if (!parsed.ok) {
    return jsonError(parsed.status, parsed.error, parsed.message);
  }

  const refreshToken = normalizeToken(parsed.data.refresh_token);
  if (!refreshToken) {
    return jsonError(400, "invalid_payload", "refresh_token is required.");
  }

  const { data, error } = await supabaseClient.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error || !data.session || !data.user) {
    return jsonError(401, "invalid_refresh", "Refresh token is invalid or expired.");
  }

  return NextResponse.json({
    user: {
      id: data.user.id,
      email: data.user.email,
    },
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
}
