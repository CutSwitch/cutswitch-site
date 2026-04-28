export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api";
import { readJsonBody } from "@/lib/request";
import { supabaseClient } from "@/lib/supabaseClient";

type SessionBody = {
  email?: unknown;
  password?: unknown;
  deviceName?: unknown;
  deviceFingerprint?: unknown;
};

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(req: Request) {
  const parsed = await readJsonBody<SessionBody>(req, 16 * 1024);
  if (!parsed.ok) {
    return jsonError(parsed.status, parsed.error, parsed.message);
  }

  const email = normalizeString(parsed.data.email);
  const password = normalizeString(parsed.data.password);
  const deviceName = normalizeString(parsed.data.deviceName);
  const deviceFingerprint = normalizeString(parsed.data.deviceFingerprint);

  if (!email || !password) {
    return jsonError(400, "invalid_payload", "email and password are required.");
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session || !data.user) {
    return jsonError(401, "invalid_login", "Invalid email or password.");
  }

  return NextResponse.json({
    user: {
      id: data.user.id,
      email: data.user.email,
    },
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    token_type: data.session.token_type,
    device: {
      name: deviceName,
      fingerprint: deviceFingerprint,
    },
  });
}
