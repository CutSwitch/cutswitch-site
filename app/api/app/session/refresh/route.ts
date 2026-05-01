export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api";
import { readJsonBody } from "@/lib/request";
import { enforceRateLimit, hashRateLimitValue, NO_STORE_HEADERS } from "@/lib/security";
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
    return jsonError(parsed.status, parsed.error, parsed.message, { headers: NO_STORE_HEADERS });
  }

  const refreshToken = normalizeToken(parsed.data.refresh_token);
  if (!refreshToken) {
    return jsonError(400, "invalid_payload", "refresh_token is required.", { headers: NO_STORE_HEADERS });
  }

  const rateLimited = await enforceRateLimit(
    req,
    [`refresh:${hashRateLimitValue(refreshToken)}`],
    30,
    60 * 60,
    "app_session_refresh"
  );
  if (rateLimited) {
    return rateLimited;
  }

  const { data, error } = await supabaseClient.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error || !data.session || !data.user) {
    return jsonError(401, "invalid_refresh", "Refresh token is invalid or expired.", { headers: NO_STORE_HEADERS });
  }

  return NextResponse.json({
    user: {
      id: data.user.id,
      email: data.user.email,
    },
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  }, { headers: NO_STORE_HEADERS });
}
