import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getIpHash } from "@/lib/request";
import { rateLimit, type RateLimitResult } from "@/lib/rateLimit";

export const runtime = "nodejs";

function isCheckoutSessionId(value: string): boolean {
  // Stripe Checkout Session IDs begin with cs_ and are long, high-entropy identifiers.
  return /^cs_(test|live)_[A-Za-z0-9]+$/.test(value);
}

async function safeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  try {
    return await rateLimit(key, limit, windowSeconds);
  } catch {
    // Endpoint is non-critical; fail-open if KV is unavailable.
    return { allowed: true, remaining: limit, limit, reset_seconds: windowSeconds };
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }
  if (!isCheckoutSessionId(sessionId)) {
    return NextResponse.json({ error: "Invalid session_id" }, { status: 400 });
  }

  try {
    // Protect this endpoint from abuse against Stripe's API.
    const ipHash = getIpHash(req);
    const rl = await safeRateLimit(`rl:checkout_session_lookup:ip:${ipHash}`, 60, 60 * 60);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.max(1, rl.reset_seconds ?? 60)) },
        }
      );
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    return NextResponse.json({
      email: session.customer_details?.email || session.customer_email || null,
      mode: session.mode || null,
      amountTotal: session.amount_total ?? null,
      currency: session.currency ?? null,
      plan: (session.metadata?.plan as string | undefined) || null,
    });
  } catch (err: any) {
    console.error("session retrieve error", err);
    return NextResponse.json({ error: "Unable to retrieve session" }, { status: 500 });
  }
}
